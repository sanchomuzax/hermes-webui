"""Skills browser endpoints."""

import re
from pathlib import Path
from typing import Optional

import yaml
from fastapi import APIRouter, Depends, HTTPException

from webui.auth import require_auth
from webui.hermes_bridge import get_custom_skills_dir, get_session_db, get_skills_dir

router = APIRouter(prefix="/api/skills", tags=["skills"], dependencies=[Depends(require_auth)])


def _parse_frontmatter(content: str) -> dict:
    """Extract YAML frontmatter from a markdown file."""
    match = re.match(r"^---\s*\n(.*?)\n---", content, re.DOTALL)
    if not match:
        return {}
    try:
        data = yaml.safe_load(match.group(1))
        return data if isinstance(data, dict) else {}
    except Exception:
        return {}


def _read_skill_metadata(entry: Path) -> dict:
    """Read skill metadata from SKILL.md or DESCRIPTION.md."""
    for md_name in ("SKILL.md", "DESCRIPTION.md"):
        md_path = entry / md_name
        if md_path.exists():
            try:
                content = md_path.read_text(encoding="utf-8")
                meta = _parse_frontmatter(content)
                if meta.get("description"):
                    return meta
                # Fallback: first non-frontmatter line
                body = re.sub(r"^---.*?---\s*", "", content, flags=re.DOTALL).strip()
                if body:
                    first_line = body.splitlines()[0].lstrip("# ").strip()
                    return {**meta, "description": first_line}
            except OSError:
                pass
    return {}


def _is_skill_dir(entry: Path) -> bool:
    """Check if a directory is a skill (has SKILL.md, .py files, or DESCRIPTION.md)."""
    if entry.name.startswith(".") or entry.name == "__pycache__":
        return False
    return (
        (entry / "SKILL.md").exists()
        or (entry / "DESCRIPTION.md").exists()
        or any(entry.glob("*.py"))
    )


def _scan_skills_dir(base_dir: Path) -> list[dict]:
    """Scan a skills directory recursively and return skill metadata.

    Supports nested structures like: skills/social-media/linkedin-routine/
    A directory is a "category" if it has subdirs that are skills.
    A directory is a "skill" if it has SKILL.md, DESCRIPTION.md, or .py files.
    """
    if not base_dir.exists():
        return []

    skills = []

    for entry in sorted(base_dir.iterdir()):
        if not entry.is_dir() or entry.name.startswith(".") or entry.name == "__pycache__":
            continue

        if _is_skill_dir(entry):
            # This is a skill itself
            skills.append(_build_skill_info(entry, category=None))

        # Also scan subdirectories (category folders)
        for sub_entry in sorted(entry.iterdir()):
            if not sub_entry.is_dir() or sub_entry.name.startswith(".") or sub_entry.name == "__pycache__":
                continue
            if _is_skill_dir(sub_entry):
                skills.append(_build_skill_info(sub_entry, category=entry.name))

    return skills


def _build_skill_info(entry: Path, category: str | None) -> dict:
    """Build skill info dict from a skill directory."""
    meta = _read_skill_metadata(entry)

    skill_info = {
        "name": meta.get("name", entry.name),
        "dir_name": entry.name,
        "path": str(entry),
        "description": meta.get("description", ""),
        "license": meta.get("license", ""),
        "category": category,
        "tools": [],
    }

    # Count Python files as proxy for tool count
    py_files = list(entry.glob("*.py"))
    tool_files = [f.stem for f in py_files if f.stem != "__init__"]
    skill_info["tools"] = tool_files

    # Count markdown docs
    md_files = [f.name for f in entry.glob("*.md")]
    skill_info["docs"] = md_files

    return skill_info


@router.get("/builtin")
async def list_builtin_skills():
    """List built-in skills from the hermes-agent skills directory."""
    skills = _scan_skills_dir(get_skills_dir())
    return {"skills": skills, "source": "builtin"}


@router.get("/custom")
async def list_custom_skills():
    """List custom skills from the user skills directory."""
    skills = _scan_skills_dir(get_custom_skills_dir())
    return {"skills": skills, "source": "custom"}


@router.get("/detail/{source}/{dir_name}")
async def skill_detail(source: str, dir_name: str, category: Optional[str] = None):
    """Get full skill detail — all file contents for inspection."""
    if source == "builtin":
        base = get_skills_dir()
    elif source == "custom":
        base = get_custom_skills_dir()
    else:
        raise HTTPException(status_code=400, detail="source must be 'builtin' or 'custom'")

    # Try direct path first, then with category prefix
    skill_dir = base / dir_name
    if not skill_dir.exists() and category:
        skill_dir = base / category / dir_name
    # Fallback: search recursively for the dir_name
    if not skill_dir.exists():
        for candidate in base.rglob(dir_name):
            if candidate.is_dir() and _is_skill_dir(candidate):
                skill_dir = candidate
                break
    if not skill_dir.exists() or not skill_dir.is_dir():
        raise HTTPException(status_code=404, detail="Skill not found")

    meta = _read_skill_metadata(skill_dir)

    # Read all markdown files
    docs = {}
    for md_file in sorted(skill_dir.glob("*.md")):
        try:
            docs[md_file.name] = md_file.read_text(encoding="utf-8")
        except OSError:
            docs[md_file.name] = "(read error)"

    # Read Python files (just names + first docstring)
    py_files = {}
    for py_file in sorted(skill_dir.glob("*.py")):
        if py_file.stem == "__pycache__":
            continue
        try:
            content = py_file.read_text(encoding="utf-8")
            py_files[py_file.name] = content
        except OSError:
            py_files[py_file.name] = "(read error)"

    return {
        "name": meta.get("name", dir_name),
        "dir_name": dir_name,
        "source": source,
        "description": meta.get("description", ""),
        "meta": meta,
        "docs": docs,
        "py_files": py_files,
    }


@router.get("/usage")
async def skill_usage():
    """Get skill invocation counts from messages (last 7 days + all time)."""
    db = get_session_db(readonly=True)
    try:
        conn = db.conn if hasattr(db, "conn") else db._conn if hasattr(db, "_conn") else None
        if not conn:
            return {"usage_7d": {}, "usage_all": {}}

        # Extract skill name from messages matching the pattern:
        # [SYSTEM: The user has invoked the "skill-name" skill...]
        query = """
            SELECT
                substr(content,
                    instr(content, 'invoked the "') + 13,
                    instr(substr(content, instr(content, 'invoked the "') + 13), '"') - 1
                ) as skill_name,
                COUNT(*) as cnt,
                SUM(CASE WHEN timestamp > (strftime('%%s', 'now') - 7*86400) THEN 1 ELSE 0 END) as cnt_7d
            FROM messages
            WHERE content LIKE '%%has invoked the "%%skill%%'
            GROUP BY skill_name
            ORDER BY cnt DESC
        """
        rows = conn.execute(query).fetchall()

        usage_all = {}
        usage_7d = {}
        for row in rows:
            name = row[0]
            if name:
                usage_all[name] = row[1]
                if row[2] > 0:
                    usage_7d[name] = row[2]

        return {"usage_7d": usage_7d, "usage_all": usage_all}
    except Exception:
        return {"usage_7d": {}, "usage_all": {}}
    finally:
        if hasattr(db, "close"):
            db.close()
