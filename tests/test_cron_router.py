"""Tests for cron job management router."""


def test_list_cron_jobs(client):
    """List cron jobs."""
    response = client.get("/api/cron/jobs")
    assert response.status_code == 200
    data = response.json()
    assert len(data["jobs"]) == 1
    assert data["jobs"][0]["name"] == "Daily Summary"


def test_create_cron_job(client):
    """Create a new cron job."""
    response = client.post(
        "/api/cron/jobs",
        json={
            "name": "Hourly Check",
            "schedule": "0 * * * *",
            "prompt": "Check system status",
        },
    )
    assert response.status_code == 200
    data = response.json()
    assert data["success"] is True
    assert data["job"]["name"] == "Hourly Check"

    # Verify it was added
    response = client.get("/api/cron/jobs")
    assert len(response.json()["jobs"]) == 2


def test_update_cron_job(client):
    """Update an existing cron job."""
    response = client.patch(
        "/api/cron/jobs/job-1",
        json={"enabled": False},
    )
    assert response.status_code == 200
    assert response.json()["job"]["enabled"] is False


def test_delete_cron_job(client):
    """Delete a cron job."""
    response = client.delete("/api/cron/jobs/job-1")
    assert response.status_code == 200

    # Verify deletion
    response = client.get("/api/cron/jobs")
    assert len(response.json()["jobs"]) == 0


def test_delete_nonexistent_job(client):
    """Delete a non-existent job returns 404."""
    response = client.delete("/api/cron/jobs/nonexistent")
    assert response.status_code == 404
