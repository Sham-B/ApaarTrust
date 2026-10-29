"""
Stateful in-app notification engine for ApaarTrust.
Tracks unread statuses and records real-time notifications for Officer, Institution, and Student events.
"""
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional
import uuid

# In-memory store for notification items
_NOTIFICATIONS: List[Dict[str, Any]] = [
    {
        "id": "notif_seed_off_1",
        "role": "Officer",
        "institution_id": "1-1090234567",
        "student_token": None,
        "type": "critical",
        "title": "Over-intake Alert",
        "message": "Bhaskara College exceeded sanctioned CSE intake by 8 students.",
        "time": "12m ago",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "unread": True,
    },
    {
        "id": "notif_seed_off_2",
        "role": "Officer",
        "institution_id": "1-1090123456",
        "student_token": None,
        "type": "warning",
        "title": "Duplicate Enrolment",
        "message": "Cross-institution collision flagged between Aryabhata and Chanakya.",
        "time": "1h ago",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "unread": True,
    },
    {
        "id": "notif_seed_off_3",
        "role": "Officer",
        "institution_id": None,
        "student_token": None,
        "type": "success",
        "title": "Audit Chain Valid",
        "message": "Automated verification confirmed cryptographic audit chain is unbroken.",
        "time": "3h ago",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "unread": False,
    },
    {
        "id": "notif_seed_inst_1",
        "role": "Institution",
        "institution_id": "1-1090123456",
        "student_token": None,
        "type": "info",
        "title": "Intake Window Open",
        "message": "Academic Year 2024-25 reporting window is open.",
        "time": "2h ago",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "unread": True,
    },
    {
        "id": "notif_seed_inst_2",
        "role": "Institution",
        "institution_id": "1-1090123456",
        "student_token": None,
        "type": "warning",
        "title": "Seat Matrix Check",
        "message": "Ensure supernumerary quotas match Approval Process Handbook demo limits.",
        "time": "1d ago",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "unread": False,
    },
    {
        "id": "notif_seed_stu_1",
        "role": "Student",
        "institution_id": None,
        "student_token": None,
        "type": "info",
        "title": "Credential Verified",
        "message": "Your enrolment credential was verified by an authorized portal.",
        "time": "4h ago",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "unread": True,
    },
    {
        "id": "notif_seed_stu_2",
        "role": "Student",
        "institution_id": None,
        "student_token": None,
        "type": "info",
        "title": "Consent Active",
        "message": "Higher Education verification consent active for 85 more days.",
        "time": "2d ago",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "unread": False,
    },
]


def add_notification(
    role: str,
    title: str,
    message: str,
    notif_type: str = "info",
    institution_id: Optional[str] = None,
    student_token: Optional[str] = None,
) -> Dict[str, Any]:
    """Appends a new notification event to the store."""
    item = {
        "id": f"notif_{uuid.uuid4().hex[:10]}",
        "role": role,
        "institution_id": institution_id,
        "student_token": student_token,
        "type": notif_type,
        "title": title,
        "message": message,
        "time": "Just now",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "unread": True,
    }
    _NOTIFICATIONS.insert(0, item)
    return item


def get_notifications_for_context(
    role: str,
    institution_id: Optional[str] = None,
    student_token: Optional[str] = None,
) -> Dict[str, Any]:
    """Retrieves notifications filtered for the current authenticated context."""
    items = []
    for n in _NOTIFICATIONS:
        if n["role"].lower() != role.lower():
            continue
        if role.lower() == "institution" and institution_id and n.get("institution_id"):
            if n["institution_id"] != institution_id:
                continue
        if role.lower() == "student" and student_token and n.get("student_token"):
            if n["student_token"] != student_token:
                continue
        items.append(n)

    unread_count = sum(1 for x in items if x.get("unread", False))
    return {
        "unread_count": unread_count,
        "items": items,
    }


def mark_notification_as_read(notif_id: str) -> bool:
    """Marks a single notification as read."""
    for n in _NOTIFICATIONS:
        if n["id"] == notif_id:
            n["unread"] = False
            return True
    return False


def mark_all_notifications_as_read(
    role: str,
    institution_id: Optional[str] = None,
    student_token: Optional[str] = None,
) -> int:
    """Marks all notifications matching the current context as read."""
    count = 0
    for n in _NOTIFICATIONS:
        if n["role"].lower() != role.lower():
            continue
        if role.lower() == "institution" and institution_id and n.get("institution_id"):
            if n["institution_id"] != institution_id:
                continue
        if role.lower() == "student" and student_token and n.get("student_token"):
            if n["student_token"] != student_token:
                continue
        if n.get("unread", False):
            n["unread"] = False
            count += 1
    return count
