"""Cron job management endpoints."""

import json
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException

from webui.auth import require_auth
from webui.hermes_bridge import get_cron_dir, is_hermes_available
from webui.schemas.cron import (
    CronJob,
    CronJobCreateRequest,
    CronJobListResponse,
    CronJobUpdateRequest,
    CronOutputResponse,
)

router = APIRouter(prefix="/api/cron", tags=["cron"], dependencies=[Depends(require_auth)])


def _get_jobs_path() -> Path:
    return get_cron_dir() / "jobs.json"


def _load_jobs() -> list[dict]:
    """Load cron jobs, trying hermes module first, falling back to direct file read."""
    if is_hermes_available():
        try:
            from cron.jobs import load_jobs
            return load_jobs()
        except ImportError:
            pass

    path = _get_jobs_path()
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        # Handle both formats: plain list or {"jobs": [...], ...}
        if isinstance(data, list):
            return data
        if isinstance(data, dict):
            return data.get("jobs", [])
        return []
    except (json.JSONDecodeError, OSError):
        return []


def _save_jobs(jobs: list[dict]) -> None:
    """Save cron jobs."""
    if is_hermes_available():
        try:
            from cron.jobs import save_jobs
            save_jobs(jobs)
            return
        except ImportError:
            pass

    path = _get_jobs_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(jobs, indent=2, ensure_ascii=False), encoding="utf-8")


@router.get("/jobs", response_model=CronJobListResponse)
async def list_jobs():
    """List all cron jobs."""
    jobs = _load_jobs()
    return CronJobListResponse(
        jobs=[CronJob(**j) for j in jobs if isinstance(j, dict)]
    )


@router.post("/jobs")
async def create_job(req: CronJobCreateRequest):
    """Create a new cron job."""
    jobs = _load_jobs()

    new_job = {
        "id": str(uuid.uuid4())[:8],
        "name": req.name,
        "schedule": req.schedule,
        "prompt": req.prompt,
        "enabled": req.enabled,
        "last_run": None,
        "next_run": None,
    }
    jobs.append(new_job)
    _save_jobs(jobs)

    return {"success": True, "job": new_job}


@router.patch("/jobs/{job_id}")
async def update_job(job_id: str, req: CronJobUpdateRequest):
    """Update an existing cron job."""
    jobs = _load_jobs()

    target = None
    for job in jobs:
        if isinstance(job, dict) and job.get("id") == job_id:
            target = job
            break

    if not target:
        raise HTTPException(status_code=404, detail="Job not found")

    update_data = req.model_dump(exclude_none=True)
    updated_job = {**target, **update_data}

    jobs = [updated_job if (isinstance(j, dict) and j.get("id") == job_id) else j for j in jobs]
    _save_jobs(jobs)

    return {"success": True, "job": updated_job}


@router.delete("/jobs/{job_id}")
async def delete_job(job_id: str):
    """Delete a cron job."""
    jobs = _load_jobs()
    original_count = len(jobs)
    jobs = [j for j in jobs if not (isinstance(j, dict) and j.get("id") == job_id)]

    if len(jobs) == original_count:
        raise HTTPException(status_code=404, detail="Job not found")

    _save_jobs(jobs)
    return {"success": True}


@router.get("/jobs/{job_id}/output")
async def get_job_output(job_id: str):
    """Get execution history for a cron job."""
    output_dir = get_cron_dir() / "output" / job_id
    if not output_dir.exists():
        return CronOutputResponse(job_id=job_id, outputs=[])

    outputs = []
    for output_file in sorted(output_dir.glob("*.json"), reverse=True)[:20]:
        try:
            data = json.loads(output_file.read_text(encoding="utf-8"))
            outputs.append(data)
        except (json.JSONDecodeError, OSError):
            continue

    return CronOutputResponse(job_id=job_id, outputs=outputs)
