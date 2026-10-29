import yaml
from datetime import datetime, timezone, timedelta
from typing import Dict, Any

from sqlmodel import Session, select
from backend.app.config import BASE_DIR, RULES_DIR
from backend.app.models import Submission, Finding, VerificationLog
from backend.app.audit import log_audit_event
from backend.app.security import Role

RETENTION_YAML_PATH = RULES_DIR / "retention.yaml"
if not RETENTION_YAML_PATH.exists():
    RETENTION_YAML_PATH = BASE_DIR / "rules" / "retention.yaml"


def get_retention_config() -> Dict[str, Any]:
    if RETENTION_YAML_PATH.exists():
        try:
            with open(RETENTION_YAML_PATH, "r", encoding="utf-8") as f:
                return yaml.safe_load(f) or {}
        except Exception:
            pass
    return {
        "retention_horizons_days": {
            "dry_run_submissions": 7,
            "uncommitted_findings": 14,
            "verification_logs": 180,
            "audit_trail": 365,
        }
    }


def execute_retention_purge(
    session: Session,
    actor_role: str,
    reason: str,
    dry_run: bool = False
) -> Dict[str, Any]:
    """
    Executes automated data retention purge based on rules/retention.yaml.
    STRICT SAFEGUARD:
    Requires AICTE Officer role and minimum 10-character written reason.
    Logs purge actions to tamper-evident cryptographic audit chain.
    """
    if actor_role != Role.OFFICER:
        raise PermissionError("Only AICTE Officer role is authorized to execute retention purges.")

    if not reason or len(reason.strip()) < 10:
        raise ValueError("A formal written justification of at least 10 characters is required.")

    cfg = get_retention_config().get("retention_horizons_days", {})
    sub_days = cfg.get("dry_run_submissions", 7)
    vlog_days = cfg.get("verification_logs", 180)

    now = datetime.now(timezone.utc)
    sub_cutoff = now - timedelta(days=sub_days)
    vlog_cutoff = now - timedelta(days=vlog_days)

    # 1. Identify stale dry-run submissions
    stale_subs = session.exec(
        select(Submission)
        .where(Submission.status == "dry_run")
        .where(Submission.created_at < sub_cutoff)
    ).all()

    stale_sub_ids = [s.id for s in stale_subs]

    # 2. Identify uncommitted findings attached to those submissions
    stale_findings_count = 0
    if stale_sub_ids:
        stale_findings = session.exec(
            select(Finding).where(Finding.submission_id.in_(stale_sub_ids))
        ).all()
        stale_findings_count = len(stale_findings)

    # 3. Identify stale verification logs
    stale_vlogs = session.exec(
        select(VerificationLog).where(VerificationLog.timestamp < vlog_cutoff)
    ).all()
    stale_vlogs_count = len(stale_vlogs)

    purged_counts = {
        "dry_run_submissions": len(stale_subs),
        "uncommitted_findings": stale_findings_count,
        "verification_logs": stale_vlogs_count,
    }

    if not dry_run:
        # Delete stale findings
        if stale_sub_ids:
            for f in session.exec(select(Finding).where(Finding.submission_id.in_(stale_sub_ids))).all():
                session.delete(f)
            for s in stale_subs:
                session.delete(s)

        for v in stale_vlogs:
            session.delete(v)

        session.commit()

        # Audit log entry
        log_audit_event(
            session=session,
            actor_role=actor_role,
            action="DATA_RETENTION_PURGE_EXECUTED",
            application_id="SYSTEM_MAINTENANCE",
            payload={
                "reason": reason,
                "purged_counts": purged_counts,
                "sub_cutoff": sub_cutoff.isoformat(),
                "vlog_cutoff": vlog_cutoff.isoformat(),
            }
        )

    return {
        "executed": not dry_run,
        "reason": reason,
        "actor_role": actor_role,
        "purged_records": purged_counts,
        "message": f"Purge {'preview' if dry_run else 'completed'}: {purged_counts['dry_run_submissions']} dry-run batches and {purged_counts['verification_logs']} stale verification logs."
    }
