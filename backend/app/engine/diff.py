from typing import Dict, Any, List, Optional
from sqlmodel import Session, select
from backend.app.models import Finding



def compute_submission_diff(
    current_submission_id: str,
    previous_submission_id: Optional[str],
    session: Session
) -> Dict[str, Any]:
    """
    Computes a transparent, versioned 'What changed since last upload' delta report.
    Tracks newly introduced issues, successfully resolved findings, and persistent defects.
    """
    current_findings = session.exec(
        select(Finding).where(Finding.submission_id == current_submission_id)
    ).all()

    if not previous_submission_id:
        return {
            "is_initial_submission": True,
            "previous_submission_id": None,
            "new_count": len(current_findings),
            "fixed_count": 0,
            "still_open_count": 0,
            "new_findings": [f.model_dump() for f in current_findings],
            "fixed_findings": [],
            "still_open": [],
            "narrative": f"Initial baseline submission: {len(current_findings)} findings identified across the batch."
        }

    prev_findings = session.exec(
        select(Finding).where(Finding.submission_id == previous_submission_id)
    ).all()

    # Fingerprint finding by rule_id and plain_reason/row
    def get_fingerprint(f: Finding) -> str:
        # Use rule_id and core evidence field
        apaar = f.evidence.get("apaar_masked") or f.evidence.get("programme") or str(f.row_number)
        return f"{f.rule_id}::{apaar}"

    prev_map = {get_fingerprint(f): f for f in prev_findings}
    curr_map = {get_fingerprint(f): f for f in current_findings}

    new_items: List[Dict[str, Any]] = []
    still_open_items: List[Dict[str, Any]] = []
    fixed_items: List[Dict[str, Any]] = []

    for fp, f in curr_map.items():
        if fp not in prev_map:
            new_items.append({
                "rule_id": f.rule_id,
                "severity": f.severity,
                "row_number": f.row_number,
                "plain_reason": f.plain_reason,
                "fix_hint": f.fix_hint,
                "status": "new",
                "why": "Introduced in latest upload batch (new record or modified quota/programme)."
            })
        else:
            still_open_items.append({
                "rule_id": f.rule_id,
                "severity": f.severity,
                "row_number": f.row_number,
                "plain_reason": f.plain_reason,
                "fix_hint": f.fix_hint,
                "status": "still_open",
                "why": "Unresolved from prior upload; discrepancy remains in submitted data."
            })

    for fp, f in prev_map.items():
        if fp not in curr_map:
            fixed_items.append({
                "rule_id": f.rule_id,
                "severity": f.severity,
                "row_number": f.row_number,
                "plain_reason": f.plain_reason,
                "status": "fixed",
                "why": "Successfully corrected by institution in revised spreadsheet!"
            })

    net_improvement = len(fixed_items) - len(new_items)
    narrative = f"Comparison with {previous_submission_id}: {len(fixed_items)} findings resolved, {len(new_items)} new findings introduced, {len(still_open_items)} persist."
    if net_improvement > 0:
        narrative += f" (Net compliance improvement: +{net_improvement})"

    return {
        "is_initial_submission": False,
        "previous_submission_id": previous_submission_id,
        "new_count": len(new_items),
        "fixed_count": len(fixed_items),
        "still_open_count": len(still_open_items),
        "net_improvement": net_improvement,
        "narrative": narrative,
        "new_findings": new_items,
        "fixed_findings": fixed_items,
        "still_open": still_open_items,
    }
