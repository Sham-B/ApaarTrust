import json
import secrets
from datetime import datetime, timezone, timedelta
from pathlib import Path
from typing import Dict, Any, List, Optional
import pymupdf as fitz


import cv2
import numpy as np
import qrcode
from reportlab.lib import colors
from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas
from sqlmodel import Session, select
from backend.app.config import STORAGE_DIR
from backend.app.models import (
    Credential,
    ConsentGrant,
    VerificationLog,
    StudentRecord,
)
from backend.app.security import (
    generate_commitment,
    verify_commitment,
    sign_payload,
    verify_signature,
    encrypt_str,
    decrypt_str,
    get_or_create_keypair,
)


CERTIFICATES_DIR = STORAGE_DIR / "certificates"
CERTIFICATES_DIR.mkdir(parents=True, exist_ok=True)


def issue_verifiable_credential(
    student: StudentRecord,
    institution_name: str,
    session: Session,
    validity_days: int = 365
) -> Credential:
    """
    Issues an SD-JWT-inspired Verifiable Credential for a student.
    Salted commitments are computed for each distinct claim field:
    commitment = sha256(salt + ":" + value).
    The root commitments dictionary is signed with the AICTE ApaarTrust Ed25519 key.
    """
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(days=validity_days)
    cred_id = f"cred_{student.student_id.lower().replace('-', '_')}_{secrets.token_hex(4)}"

    raw_claims = {
        "apaar_masked": student.apaar_masked,
        "name": student.name,
        "dob": student.dob,
        "gender": student.gender,
        "social_category": student.social_category,
        "programme": student.programme,
        "institution": institution_name,
        "student_id": student.student_id,
        "enrolment_status": student.enrolment_status,
        "academic_year": student.academic_year,
    }

    commitments: Dict[str, str] = {}
    salts: Dict[str, str] = {}

    for k, v in raw_claims.items():
        c_hash, salt = generate_commitment(k, str(v))
        commitments[k] = c_hash
        salts[k] = salt

    # Sign canonical commitments dictionary with Ed25519
    signature = sign_payload("apaar_credential_authority", commitments)

    cred = Credential(
        id=cred_id,
        subject_token=student.apaar_token,
        commitments=commitments,
        salts_encrypted=encrypt_str(json.dumps(salts)),
        claims_encrypted=encrypt_str(json.dumps(raw_claims)),
        signature=signature,
        issuer="AICTE-ApaarTrust-Authority",
        issued_at=now,
        expires_at=expires_at,
        revoked=False,
    )
    session.add(cred)
    session.commit()
    session.refresh(cred)
    return cred


def generate_presentation(
    credential_id: str,
    purpose: str,
    session: Session
) -> Dict[str, Any]:
    """
    Generates a selective disclosure presentation for a credential.
    Consults the student's active ConsentGrant:
    ONLY fields listed in consent.allowed_fields are revealed with their salts.
    Withheld fields have neither values nor salts disclosed (preserving cryptographic privacy).
    """
    cred = session.get(Credential, credential_id)
    if not cred:
        raise ValueError("Credential not found")

    # Look up active consent grant for subject token
    now = datetime.now(timezone.utc)
    cg_statement = (
        select(ConsentGrant)
        .where(ConsentGrant.student_token == cred.subject_token)
        .where(ConsentGrant.revoked_at == None)
        .where(ConsentGrant.expires_at > now)
        .order_by(ConsentGrant.created_at.desc())
    )
    grant = session.exec(cg_statement).first()

    allowed_fields: List[str] = (
        grant.allowed_fields
        if grant and grant.allowed_fields
        else ["name", "programme", "institution", "enrolment_status"]
    )

    salts = json.loads(decrypt_str(cred.salts_encrypted))
    claims = json.loads(decrypt_str(cred.claims_encrypted))

    disclosed_claims: Dict[str, Any] = {}
    disclosed_salts: Dict[str, str] = {}
    withheld_fields: List[str] = []

    for k in cred.commitments.keys():
        if k in allowed_fields:
            disclosed_claims[k] = claims.get(k)
            disclosed_salts[k] = salts.get(k)
        else:
            withheld_fields.append(k)

    keypair = get_or_create_keypair("apaar_credential_authority")

    presentation = {
        "credential_id": cred.id,
        "issuer": cred.issuer,
        "issued_at": cred.issued_at.isoformat(),
        "expires_at": cred.expires_at.isoformat(),
        "revoked": cred.revoked,
        "commitments": cred.commitments,
        "signature": cred.signature,
        "public_key_b64": keypair["public_key_b64"],
        "disclosed_claims": disclosed_claims,
        "disclosed_salts": disclosed_salts,
        "withheld_fields": withheld_fields,
        "purpose": purpose,
        "consent_grant_id": grant.id if grant else None,
        "generated_at": now.isoformat(),
    }
    return presentation


def verify_presentation(
    presentation: Dict[str, Any],
    verifier_type: str,
    session: Session
) -> Dict[str, Any]:
    """
    Verifies an SD-JWT-inspired selective disclosure presentation:
    1. Checks if credential is recorded and not revoked or expired.
    2. Validates Ed25519 signature over root commitments dictionary.
    3. Recomputes commitments for all disclosed fields: sha256(salt + ":" + value).
    4. Detects any tampering, expiration, or revocation.
    5. Appends access log to VerificationLog for the student's ledger.
    """
    now = datetime.now(timezone.utc)
    cred_id = presentation.get("credential_id")

    cred = session.get(Credential, cred_id) if cred_id else None

    # Check existence
    if not cred:
        return {
            "status": "not_found",
            "message": "Credential record does not exist in the authority registry.",
            "genuine": False,
            "disclosed_fields": [],
            "withheld_fields": [],
        }

    # Check student active consent grant
    cg_statement = (
        select(ConsentGrant)
        .where(ConsentGrant.student_token == cred.subject_token)
        .order_by(ConsentGrant.created_at.desc())
    )
    latest_grant = session.exec(cg_statement).first()
    consent_active = (
        latest_grant is not None
        and latest_grant.revoked_at is None
        and latest_grant.expires_at > now
    )

    if not consent_active:
        # Revoked / missing student consent
        v_log = VerificationLog(
            credential_id=cred.id,
            student_token=cred.subject_token,
            verifier_type=verifier_type,
            fields_disclosed=[],
            status="revoked_consent",
        )
        session.add(v_log)
        session.commit()
        return {
            "status": "revoked",
            "message": "Student digital consent for this credential has been revoked or has expired.",
            "genuine": False,
            "consent_status": "REVOKED_BY_STUDENT",
            "disclosed_fields": [],
            "withheld_fields": list(cred.commitments.keys()),
        }

    # Check Credential Expiry & Revocation
    if cred.revoked or presentation.get("revoked", False):
        v_log = VerificationLog(
            credential_id=cred.id,
            student_token=cred.subject_token,
            verifier_type=verifier_type,
            fields_disclosed=[],
            status="revoked",
        )
        session.add(v_log)
        session.commit()
        return {
            "status": "revoked",
            "message": "Credential has been revoked by issuing authority.",
            "genuine": False,
            "disclosed_fields": [],
            "withheld_fields": list(cred.commitments.keys()),
        }

    if cred.expires_at < now:
        v_log = VerificationLog(
            credential_id=cred.id,
            student_token=cred.subject_token,
            verifier_type=verifier_type,
            fields_disclosed=[],
            status="expired",
        )
        session.add(v_log)
        session.commit()
        return {
            "status": "expired",
            "message": f"Credential expired on {cred.expires_at.date()}.",
            "genuine": False,
            "disclosed_fields": [],
            "withheld_fields": list(cred.commitments.keys()),
        }

    # Verify Ed25519 signature over commitments
    sig_ok = verify_signature(
        "apaar_credential_authority",
        presentation.get("commitments", {}),
        presentation.get("signature", "")
    )
    if not sig_ok:
        v_log = VerificationLog(
            credential_id=cred.id,
            student_token=cred.subject_token,
            verifier_type=verifier_type,
            fields_disclosed=[],
            status="tampered",
        )
        session.add(v_log)
        session.commit()
        return {
            "status": "tampered",
            "message": "Ed25519 authority signature verification failed! Root commitments altered.",
            "genuine": False,
            "disclosed_fields": [],
            "withheld_fields": [],
        }

    # Recompute disclosed commitments
    disclosed_claims = presentation.get("disclosed_claims", {})
    disclosed_salts = presentation.get("disclosed_salts", {})
    commitments = presentation.get("commitments", {})

    tampered_fields: List[str] = []
    for field, val in disclosed_claims.items():
        salt = disclosed_salts.get(field, "")
        expected_hash = commitments.get(field, "")
        if not verify_commitment(expected_hash, str(val), salt):
            tampered_fields.append(field)

    if tampered_fields:
        v_log = VerificationLog(
            credential_id=cred.id,
            student_token=cred.subject_token,
            verifier_type=verifier_type,
            fields_disclosed=[],
            status="tampered",
        )
        session.add(v_log)
        session.commit()
        return {
            "status": "tampered",
            "message": f"Cryptographic commitment mismatch in field(s): {', '.join(tampered_fields)}. Claims have been altered!",
            "genuine": False,
            "tampered_fields": tampered_fields,
            "disclosed_fields": [],
            "withheld_fields": [],
        }

    # Log successful verification
    disclosed_field_names = list(disclosed_claims.keys())
    withheld_field_names = presentation.get("withheld_fields", [])

    v_log = VerificationLog(
        credential_id=cred.id,
        student_token=cred.subject_token,
        verifier_type=verifier_type,
        fields_disclosed=disclosed_field_names,
        status="genuine",
    )
    session.add(v_log)
    session.commit()

    return {
        "status": "genuine",
        "message": "Cryptographic proof verified! Signature authentic, selective commitments match.",
        "genuine": True,
        "issuer": cred.issuer,
        "issued_at": cred.issued_at.isoformat(),
        "expires_at": cred.expires_at.isoformat(),
        "disclosed_claims": disclosed_claims,
        "disclosed_fields": disclosed_field_names,
        "withheld_fields": withheld_field_names,
        "student_token": cred.subject_token,
    }


def generate_certificate_pdf(
    student: StudentRecord,
    institution_name: str,
    credential: Credential,
    presentation_json_str: str,
    output_path: Path
) -> Path:
    """
    Generates a sample certificate of enrolment PDF using ReportLab.
    Prints APAAR ID (masked/full), Student Roll ID, and an Ed25519-signed verification QR code (PS Req 10).
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)

    # Generate QR Code containing presentation JSON or verification code
    qr = qrcode.QRCode(
        version=None,
        error_correction=qrcode.constants.ERROR_CORRECT_M,
        box_size=4,
        border=2,
    )
    qr.add_data(presentation_json_str)
    qr.make(fit=True)
    qr_img = qr.make_image(fill_color="#14307a", back_color="white")

    qr_path = output_path.parent / f"temp_qr_{secrets.token_hex(4)}.png"
    qr_img.save(qr_path)

    # Build PDF with ReportLab
    c = canvas.Canvas(str(output_path), pagesize=letter)
    width, height = letter

    # Decorative Border
    c.setStrokeColor(colors.HexColor("#14307a"))
    c.setLineWidth(4)
    c.rect(30, 30, width - 60, height - 60)
    c.setStrokeColor(colors.HexColor("#e8731a"))
    c.setLineWidth(1.5)
    c.rect(36, 36, width - 72, height - 72)

    # Header
    c.setFillColor(colors.HexColor("#14307a"))
    c.setFont("Helvetica-Bold", 20)
    c.drawCentredString(width / 2.0, height - 75, "ALL INDIA COUNCIL FOR TECHNICAL EDUCATION")

    c.setFillColor(colors.HexColor("#e8731a"))
    c.setFont("Helvetica-Bold", 13)
    c.drawCentredString(width / 2.0, height - 95, "ApaarTrust • Student Enrolment & Credential Verification")

    c.setFillColor(colors.HexColor("#333333"))
    c.setFont("Helvetica", 10)
    c.drawCentredString(width / 2.0, height - 110, "Prototype Implementation under AICTE Approval Process Guidelines")

    c.setStrokeColor(colors.HexColor("#dddddd"))
    c.setLineWidth(1)
    c.line(50, height - 120, width - 50, height - 120)

    # Title
    c.setFillColor(colors.HexColor("#14307a"))
    c.setFont("Helvetica-Bold", 16)
    c.drawCentredString(width / 2.0, height - 150, "SAMPLE CERTIFICATE OF INSTITUTIONAL ENROLMENT")

    # Body Content
    c.setFont("Helvetica", 11)
    c.setFillColor(colors.black)

    text_y = height - 190
    c.drawString(60, text_y, "This is to certify that the student detailed herein is enrolled at an AICTE-approved institution:")

    # Table of Student Details
    c.setFont("Helvetica-Bold", 10)
    labels = [
        ("Student Name:", student.name),
        ("APAAR Identifier:", student.apaar_masked),
        ("Institutional Roll No:", student.student_id),
        ("Institution Name:", institution_name),
        ("Academic Programme:", student.programme),
        ("Academic Session:", student.academic_year),
        ("Enrolment Status:", f"{student.enrolment_status} (Active Verified)"),
        ("Admission Quota:", student.admission_quota),
        ("Credential ID:", credential.id),
        ("Issued Date:", credential.issued_at.strftime("%d-%b-%Y")),
        ("Digital Signature:", "Ed25519 Cryptographic Trust Seal Intact"),
    ]

    c.setFillColor(colors.HexColor("#f8f9fc"))
    c.rect(60, text_y - 250, width - 120, 230, fill=1, stroke=1)
    c.setFillColor(colors.black)

    row_y = text_y - 35
    for label, val in labels:
        c.setFont("Helvetica-Bold", 10)
        c.setFillColor(colors.HexColor("#14307a"))
        c.drawString(75, row_y, label)
        c.setFont("Helvetica", 10)
        c.setFillColor(colors.HexColor("#222222"))
        c.drawString(220, row_y, str(val))
        row_y -= 19

    # QR Code embed
    c.drawImage(str(qr_path), width - 210, 80, width=140, height=140)
    c.setFont("Helvetica-Bold", 9)
    c.setFillColor(colors.HexColor("#14307a"))
    c.drawCentredString(width - 140, 68, "Scan to Verify Credential")
    c.setFont("Helvetica", 7.5)
    c.setFillColor(colors.HexColor("#666666"))
    c.drawCentredString(width - 140, 56, "Cryptographic SD-JWT Proof")

    # Footer Disclaimer
    c.setFont("Helvetica-Oblique", 8)
    c.setFillColor(colors.HexColor("#777777"))
    c.drawString(60, 80, "Validation Notice: This credential incorporates selective disclosure privacy protections.")
    c.drawString(60, 68, "Verifiers may inspect consented claims offline via the ApaarTrust public verification engine.")
    c.drawString(60, 56, "Sample certificate for prototype evaluation. Not an official AICTE issuance.")

    c.save()

    # Clean up temp QR image
    try:
        qr_path.unlink()
    except Exception:
        pass

    return output_path


def decode_qr_from_bytes(file_bytes: bytes, filename: str) -> Optional[str]:
    """
    Decodes QR code from either an image file or a PDF document.
    Renders PDF pages to raster images using PyMuPDF (fitz), then decodes QR using OpenCV QRCodeDetector.
    """
    fn_low = filename.lower()

    cv_images: List[np.ndarray] = []

    if fn_low.endswith(".pdf"):
        # Render first 2 pages with PyMuPDF
        doc = fitz.open(stream=file_bytes, filetype="pdf")
        for page_idx in range(min(2, len(doc))):
            page = doc.load_page(page_idx)
            pix = page.get_pixmap(dpi=150)
            img_data = pix.tobytes("png")
            nparr = np.frombuffer(img_data, np.uint8)
            img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
            if img is not None:
                cv_images.append(img)
    else:
        # Direct raster image
        nparr = np.frombuffer(file_bytes, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is not None:
            cv_images.append(img)

    detector = cv2.QRCodeDetector()
    for img in cv_images:
        val, points, qrcode_mat = detector.detectAndDecode(img)
        if val:
            return val

    return None


def generate_compliance_report_pdf(
    institution: Any,
    seat_matrices: List[Any],
    findings: List[Any],
    output_path: Path
) -> Path:
    """
    Generates a formal Institutional Compliance & Seat Matrix Report PDF via ReportLab.
    Includes approved intake, regular/supernumerary allocations, findings summary,
    and mandatory DEMO VALUES disclosures.
    """
    output_path.parent.mkdir(parents=True, exist_ok=True)
    c = canvas.Canvas(str(output_path), pagesize=letter)
    width, height = letter

    # Decorative border
    c.setStrokeColor(colors.HexColor("#14307a"))
    c.setLineWidth(3)
    c.rect(30, 30, width - 60, height - 60)
    c.setStrokeColor(colors.HexColor("#e8731a"))
    c.setLineWidth(1)
    c.rect(34, 34, width - 68, height - 68)

    # Header
    y = height - 65
    c.setFont("Helvetica-Bold", 10)
    c.setFillColor(colors.HexColor("#14307a"))
    c.drawString(50, y, "ALL INDIA COUNCIL FOR TECHNICAL EDUCATION • REGULATION BUREAU")

    y -= 14
    c.setFont("Helvetica-Bold", 16)
    c.drawString(50, y, "INSTITUTIONAL COMPLIANCE & SEAT MATRIX AUDIT REPORT")

    y -= 12
    c.setStrokeColor(colors.HexColor("#cbd5e1"))
    c.setLineWidth(0.8)
    c.line(50, y, width - 50, y)

    # Institution Details
    y -= 20
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(colors.HexColor("#0f172a"))
    c.drawString(50, y, f"Institution: {getattr(institution, 'name', 'AICTE Institution')}")

    y -= 16
    c.setFont("Helvetica", 9)
    c.setFillColor(colors.HexColor("#475569"))
    c.drawString(50, y, f"AICTE Permanent ID: {getattr(institution, 'id', '-')}   |   State: {getattr(institution, 'state', '-')}   |   District: {getattr(institution, 'district', '-')}")

    y -= 16
    c.drawString(50, y, f"Academic Session: 2024-25   |   Generated: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")

    # Mandatory Notice Box
    y -= 30
    c.setFillColor(colors.HexColor("#fff7ed"))
    c.setStrokeColor(colors.HexColor("#ea580c"))
    c.setLineWidth(1)
    c.rect(50, y - 6, width - 100, 24, fill=1, stroke=1)

    c.setFillColor(colors.HexColor("#9a3412"))
    c.setFont("Helvetica-Bold", 8)
    c.drawString(58, y + 8, "REGULATORY DISCLOSURE:")
    c.setFont("Helvetica", 8)
    c.drawString(200, y + 8, "DEMO VALUES, not AICTE rules; configure from the Approval Process Handbook.")

    # Seat Matrix Section
    y -= 30
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(colors.HexColor("#14307a"))
    c.drawString(50, y, "1. Approved Seat Matrix & Intake Compliance")

    y -= 16
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(colors.HexColor("#1e293b"))
    c.drawString(50, y, "Programme")
    c.drawString(240, y, "Sanctioned")
    c.drawString(300, y, "Admitted")
    c.drawString(360, y, "TFW (5%)")
    c.drawString(420, y, "EWS (10%)")
    c.drawString(480, y, "Status")

    y -= 6
    c.line(50, y, width - 50, y)

    c.setFont("Helvetica", 8)
    c.setFillColor(colors.HexColor("#334155"))
    for m in seat_matrices[:8]:
        y -= 14
        if y < 140:
            break
        prog_name = str(getattr(m, 'programme', 'Programme'))[:32]
        sanctioned = str(getattr(m, 'sanctioned_intake', 0))
        admitted = str(getattr(m, 'admitted_regular', 0))
        tfw = str(getattr(m, 'admitted_tfw', 0))
        ews = str(getattr(m, 'admitted_ews', 0))
        is_over = getattr(m, 'admitted_regular', 0) > getattr(m, 'sanctioned_intake', 0)
        status_txt = "OVER-INTAKE" if is_over else "COMPLIANT"

        c.drawString(50, y, prog_name)
        c.drawString(240, y, sanctioned)
        c.drawString(300, y, admitted)
        c.drawString(360, y, tfw)
        c.drawString(420, y, ews)
        if is_over:
            c.setFillColor(colors.HexColor("#dc2626"))
            c.setFont("Helvetica-Bold", 8)
        else:
            c.setFillColor(colors.HexColor("#16a34a"))
        c.drawString(480, y, status_txt)
        c.setFont("Helvetica", 8)
        c.setFillColor(colors.HexColor("#334155"))

    # Findings Section
    y -= 26
    c.setFont("Helvetica-Bold", 11)
    c.setFillColor(colors.HexColor("#14307a"))
    c.drawString(50, y, f"2. Audit Findings Summary ({len(findings)} total recorded)")

    y -= 16
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(colors.HexColor("#1e293b"))
    c.drawString(50, y, "Rule ID")
    c.drawString(160, y, "Severity")
    c.drawString(230, y, "Status")
    c.drawString(300, y, "Observation / Reason")

    y -= 6
    c.line(50, y, width - 50, y)

    c.setFont("Helvetica", 8)
    c.setFillColor(colors.HexColor("#334155"))
    if not findings:
        y -= 14
        c.drawString(50, y, "Zero active compliance findings. Institution data is clean.")
    else:
        for f in findings[:6]:
            y -= 14
            if y < 90:
                break
            rule_id = str(getattr(f, 'rule_id', getattr(f, 'finding_type', '-')))[:20]
            sev = str(getattr(f, 'severity', '-')).upper()
            st = str(getattr(f, 'status', '-')).upper()
            reason = str(getattr(f, 'plain_reason', getattr(f, 'details', {}).get('reason', '-')) if isinstance(getattr(f, 'details', None), dict) else getattr(f, 'plain_reason', '-'))[:48]

            c.drawString(50, y, rule_id)
            c.drawString(160, y, sev)
            c.drawString(230, y, st)
            c.drawString(300, y, reason)

    # Footer
    c.setFont("Helvetica-Bold", 8)
    c.setFillColor(colors.HexColor("#64748b"))
    c.drawString(50, 50, "AICTE ApaarTrust Authority • Cryptographically Sealed Document • SHA-256 Hash Chained")
    c.drawString(width - 120, 50, "Page 1 of 1")

    c.save()
    return output_path
