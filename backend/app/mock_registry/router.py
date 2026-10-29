from datetime import datetime, timezone
from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends
from sqlmodel import Session, select

from backend.app.config import settings
from backend.app.db import get_session
from backend.app.models import MockCitizen, StatusEnum
from backend.app.security import sign_payload, get_or_create_keypair

router = APIRouter(prefix="/api/v1/mock-registry", tags=["Mock APAAR Registry"])


@router.get("/status")
def get_registry_status() -> Dict[str, Any]:
    return {
        "status": "source_unavailable" if settings.REGISTRY_DOWN else "operational",
        "down_switch_active": settings.REGISTRY_DOWN,
        "mode": "SYNTHETIC_MOCK_REGISTRY",
        "notice": "CLEARLY LABELLED MOCK: Production access would require formal authorization and a security review; we have not assessed those requirements."
    }


@router.post("/toggle-down")
def toggle_registry_down(force_down: Optional[bool] = None) -> Dict[str, Any]:
    if force_down is not None:
        settings.REGISTRY_DOWN = force_down
    else:
        settings.REGISTRY_DOWN = not settings.REGISTRY_DOWN

    return {
        "status": "source_unavailable" if settings.REGISTRY_DOWN else "operational",
        "down_switch_active": settings.REGISTRY_DOWN,
        "message": "APAAR Registry Down Switch toggled to " + ("DOWN (Simulating outage)" if settings.REGISTRY_DOWN else "OPERATIONAL")
    }


@router.get("/lookup/{apaar_id}")
def lookup_apaar_citizen(
    apaar_id: str,
    session: Session = Depends(get_session)
) -> Dict[str, Any]:
    """
    Look up synthetic citizen in mock APAAR registry.
    All responses are signed with Ed25519 for tamper-evident verification.
    When down-switch is active, returns source_unavailable ("cannot assess").
    """
    clean_id = str(apaar_id).strip().replace("-", "").replace(" ", "")

    keypair = get_or_create_keypair("apaar_mock_registry")
    timestamp = datetime.now(timezone.utc).isoformat()

    if settings.REGISTRY_DOWN:
        payload = {
            "apaar_id": clean_id,
            "status": StatusEnum.SOURCE_UNAVAILABLE,
            "disposition": StatusEnum.CANNOT_ASSESS,
            "name": None,
            "dob": None,
            "gender": None,
            "consent_flag": False,
            "timestamp": timestamp,
            "registry_label": "MOCK_CENTRAL_REGISTRY_OFFLINE"
        }
        signature = sign_payload("apaar_mock_registry", payload)
        return {
            "payload": payload,
            "signature": signature,
            "public_key_b64": keypair["public_key_b64"]
        }

    # Query citizen
    citizen = session.exec(select(MockCitizen).where(MockCitizen.apaar_id == clean_id)).first()

    if not citizen:
        payload = {
            "apaar_id": clean_id,
            "status": StatusEnum.NOT_FOUND,
            "disposition": "not_found",
            "name": None,
            "dob": None,
            "gender": None,
            "consent_flag": False,
            "timestamp": timestamp,
            "registry_label": "MOCK_CENTRAL_REGISTRY"
        }
    else:
        payload = {
            "apaar_id": clean_id,
            "status": citizen.status,  # "active" or "suspended"
            "disposition": StatusEnum.VERIFIED if citizen.status == "active" else StatusEnum.MANUAL_REVIEW_REQUIRED,
            "name": citizen.name,
            "dob": citizen.dob,
            "gender": citizen.gender,
            "consent_flag": citizen.consent_flag,
            "phone_masked": citizen.phone_masked,
            "timestamp": timestamp,
            "registry_label": "MOCK_CENTRAL_REGISTRY"
        }

    signature = sign_payload("apaar_mock_registry", payload)

    return {
        "payload": payload,
        "signature": signature,
        "public_key_b64": keypair["public_key_b64"]
    }


@router.get("/qr")
def generate_mock_registry_qr(text: str = "APAAR-TRUST-DEMO"):
    """Generates offline PNG QR code image for digital ID cards and certificates."""
    import io
    import qrcode
    from fastapi import Response

    qr = qrcode.QRCode(box_size=4, border=1)
    qr.add_data(text)
    qr.make(fit=True)
    img = qr.make_image(fill_color="#14307a", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return Response(content=buf.getvalue(), media_type="image/png")
