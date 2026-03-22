"""Pydantic models for cron job management."""

from typing import Any, Optional

from pydantic import BaseModel


class CronJob(BaseModel):
    """Single cron job."""

    id: str
    name: str = ""
    schedule: Any = None  # Can be string or dict (e.g. {"kind": "cron", "expr": "..."})
    prompt: str = ""
    enabled: bool = True
    last_run: Optional[str] = None
    next_run: Optional[str] = None
    created_at: Optional[str] = None


class CronJobListResponse(BaseModel):
    """List of cron jobs."""

    jobs: list[CronJob]


class CronJobCreateRequest(BaseModel):
    """Request to create a new cron job."""

    name: str
    schedule: str
    prompt: str
    enabled: bool = True


class CronJobUpdateRequest(BaseModel):
    """Request to update an existing cron job."""

    name: Optional[str] = None
    schedule: Optional[str] = None
    prompt: Optional[str] = None
    enabled: Optional[bool] = None


class CronOutputResponse(BaseModel):
    """Cron job execution output."""

    job_id: str
    outputs: list[dict[str, Any]]
