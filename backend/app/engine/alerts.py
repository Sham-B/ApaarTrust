from datetime import datetime, timezone, timedelta
from typing import List
from sqlmodel import Session, select
from backend.app.models import (
    Alert,
    StudentRecord,
    Submission,
    Finding,
    ConsentGrant,
)



class AlertEngine:
    """
    Governance Alerts Framework for ApaarTrust:
    Detects operational and compliance risks:
    1. Over-intake (regular capacity or supernumerary quotas breached)
    2. Cross-institution duplicate (multi-enrolment collisions)
    3. High registry mismatch rate (elevated identity discrepancies)
    4. Overdue submission (pending confirmation past deadline)
    5. Consent expiring (student digital consent expiring within 14 days)
    """

    @classmethod
    def scan_institution_alerts(
        cls,
        session: Session,
        institution_id: str
    ) -> List[Alert]:
        now = datetime.now(timezone.utc)
        generated_alerts: List[Alert] = []

        # 1. Over-intake Alerts
        over_intake_findings = session.exec(
            select(Finding)
            .where(Finding.institution_id == institution_id)
            .where(Finding.rule_id.in_(["SEAT_CAP_REGULAR", "SEAT_CAP_SUPERNUMERARY"]))
            .where(Finding.status == "open")
        ).all()
        if over_intake_findings:
            alert = Alert(
                id=f"alert-intake-{institution_id}",
                institution_id=institution_id,
                alert_type="over_intake",
                severity="critical",
                title="Approved Intake Norms Breached",
                message=f"Found {len(over_intake_findings)} active intake excess findings across regular or supernumerary quotas.",
                rule_id="ALERT_OVER_INTAKE",
                created_at=now,
            )
            generated_alerts.append(alert)

        # 2. Cross-institution Duplicate Alert
        dup_findings = session.exec(
            select(Finding)
            .where(Finding.institution_id == institution_id)
            .where(Finding.rule_id == "DUPLICATE_CROSS_INSTITUTION")
            .where(Finding.status == "open")
        ).all()
        if dup_findings:
            alert = Alert(
                id=f"alert-dup-{institution_id}",
                institution_id=institution_id,
                alert_type="cross_institution_duplicate",
                severity="critical",
                title="Cross-Institution Duplicate Enrolment Flagged",
                message=f"{len(dup_findings)} student(s) concurrently recorded at another AICTE-approved institution.",
                rule_id="ALERT_DUPLICATE_ENROLMENT",
                created_at=now,
            )
            generated_alerts.append(alert)

        # 3. High Registry Mismatch Rate
        reg_findings = session.exec(
            select(Finding)
            .where(Finding.institution_id == institution_id)
            .where(Finding.rule_id.in_(["REGISTRY_LOOKUP", "REGISTRY_MISMATCH_NAME", "REGISTRY_MISMATCH_DOB"]))
            .where(Finding.status == "open")
        ).all()
        total_students = len(session.exec(
            select(StudentRecord).where(StudentRecord.institution_id == institution_id)
        ).all())

        if total_students > 0 and (len(reg_findings) / total_students) >= 0.08:
            rate_pct = round((len(reg_findings) / total_students) * 100.0, 1)
            alert = Alert(
                id=f"alert-reg-{institution_id}",
                institution_id=institution_id,
                alert_type="registry_mismatch",
                severity="warning",
                title="Elevated APAAR Registry Mismatch Rate",
                message=f"Discrepancy rate is {rate_pct}% ({len(reg_findings)} mismatch/not-found issues out of {total_students} students).",
                rule_id="ALERT_REGISTRY_DISCREPANCY",
                created_at=now,
            )
            generated_alerts.append(alert)

        # 4. Overdue Submissions
        pending_subs = session.exec(
            select(Submission)
            .where(Submission.institution_id == institution_id)
            .where(Submission.status == "dry_run")
        ).all()
        for sub in pending_subs:
            sub_created = sub.created_at
            if sub_created.tzinfo is None:
                sub_created = sub_created.replace(tzinfo=timezone.utc)
            if (now - sub_created).days >= 3:
                alert = Alert(
                    id=f"alert-overdue-{sub.id}",
                    institution_id=institution_id,
                    alert_type="overdue",
                    severity="info",
                    title="Dry-Run Intake Submission Pending Final Commit",
                    message=f"Simulation batch {sub.id} uploaded on {sub_created.date()} has not been committed.",
                    rule_id="ALERT_SUBMISSION_OVERDUE",
                    created_at=now,
                )
                generated_alerts.append(alert)

        # 5. Consent Expiring Soon (< 14 days)
        threshold_dt = now + timedelta(days=14)
        expiring_grants = session.exec(
            select(ConsentGrant)
            .where(ConsentGrant.revoked_at == None)
            .where(ConsentGrant.expires_at <= threshold_dt)
            .where(ConsentGrant.expires_at > now)
        ).all()
        if expiring_grants:
            alert = Alert(
                id=f"alert-consent-{institution_id}",
                institution_id=institution_id,
                alert_type="consent_expiring",
                severity="info",
                title="Student Digital Consent Expiring Soon",
                message=f"{len(expiring_grants)} student consent grant(s) will lapse within the next 14 days.",
                rule_id="ALERT_CONSENT_EXPIRING",
                created_at=now,
            )
            generated_alerts.append(alert)

        # Save to database
        for a in generated_alerts:
            existing = session.get(Alert, a.id)
            if not existing:
                session.add(a)
        session.commit()

        return generated_alerts
