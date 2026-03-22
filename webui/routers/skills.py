"""Skills browser endpoints."""

import re
from pathlib import Path

import yaml
from fastapi import APIRouter, Depends, HTTPException

from webui.auth import require_auth
from webui.hermes_bridge import get_custom_skills_dir, get_skills_dir

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


def _scan_skills_dir(base_dir: Path) -> list[dict]:
    """Scan a skills directory and return skill metadata."""
    if not base_dir.exists():
        return []

    skills = []
    for entry in sorted(base_dir.iterdir()):
        if not entry.is_dir() or entry.name.startswith(".") or entry.name == "__pycache__":
            continue

        meta = _read_skill_metadata(entry)

        skill_info = {
            "name": meta.get("name", entry.name),
            "dir_name": entry.name,
            "path": str(entry),
            "description": meta.get("description", ""),
            "license": meta.get("license", ""),
            "tools": [],
        }

        # Count Python files as proxy for tool count
        py_files = list(entry.glob("*.py"))
        tool_files = [f.stem for f in py_files if f.stem != "__init__"]
        skill_info["tools"] = tool_files

        # Count markdown docs
        md_files = [f.name for f in entry.glob("*.md")]
        skill_info["docs"] = md_files

        skills.append(skill_info)

    return skills


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
async def skill_detail(source: str, dir_name: str):
    """Get full skill detail — all file contents for inspection."""
    if source == "builtin":
        base = get_skills_dir()
    elif source == "custom":
        base = get_custom_skills_dir()
    else:
        raise HTTPException(status_code=400, detail="source must be 'builtin' or 'custom'")

    skill_dir = base / dir_name
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
