import base64
import hashlib
import hmac
import json
import secrets
from typing import Optional, Dict, Any, Tuple

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives.asymmetric import ed25519
from cryptography.hazmat.primitives import serialization
from fastapi import Header, HTTPException, status
from backend.app.config import settings, STORAGE_DIR


# ----------------- Fernet Encryption at Rest -----------------
def get_fernet() -> Fernet:
    return Fernet(settings.SECRET_FERNET_KEY.encode("utf-8"))


def encrypt_str(plain_text: str) -> str:
    return get_fernet().encrypt(plain_text.encode("utf-8")).decode("utf-8")


def decrypt_str(cipher_text: str) -> str:
    return get_fernet().decrypt(cipher_text.encode("utf-8")).decode("utf-8")


def encrypt_apaar(apaar_id: str) -> str:
    return encrypt_str(apaar_id)


def decrypt_apaar(encrypted: str) -> str:
    return decrypt_str(encrypted)


# ----------------- APAAR Masking & Pseudonymization -----------------
def mask_apaar(apaar_id: str) -> str:
    """Mask 12-digit APAAR ID as XXXX-XXXX-1234."""
    clean = str(apaar_id).strip().replace("-", "").replace(" ", "")
    if len(clean) >= 4:
        last4 = clean[-4:]
        return f"XXXX-XXXX-{last4}"
    return "XXXX-XXXX-XXXX"


def compute_apaar_token(apaar_id: str) -> str:
    """Deterministic, pseudonymous HMAC-SHA256 token for indexing and duplicate cross-referencing."""
    clean = str(apaar_id).strip().replace("-", "").replace(" ", "")
    key = settings.SECRET_KEY.encode("utf-8")
    return hmac.new(key, clean.encode("utf-8"), hashlib.sha256).hexdigest()


# ----------------- Role-Based Access Control -----------------
class Role:
    OFFICER = "Officer"
    INSTITUTION = "Institution"
    STUDENT = "Student"
    VERIFIER = "Verifier"

    ALL_ROLES = [OFFICER, INSTITUTION, STUDENT, VERIFIER]


# ----------------- Signed Demo Token Engine -----------------
def create_demo_token(
    role: str,
    institution_id: Optional[str] = None,
    student_token: Optional[str] = None,
    expires_in_seconds: int = 86400,
) -> str:
    """Creates an HMAC-SHA256 signed demo token containing role and context."""
    import time
    payload = {
        "role": role,
        "inst_id": institution_id,
        "stu_tok": student_token,
        "exp": int(time.time()) + expires_in_seconds,
        "iat": int(time.time()),
    }
    payload_b64 = base64.urlsafe_b64encode(json.dumps(payload).encode("utf-8")).decode("utf-8").rstrip("=")
    key = settings.SECRET_KEY.encode("utf-8")
    sig = hmac.new(key, payload_b64.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"{payload_b64}.{sig}"


def verify_demo_token(token_str: str) -> Optional[Dict[str, Any]]:
    """Verifies HMAC signature and expiration of demo token."""
    import time
    if not token_str or "." not in token_str:
        return None
    try:
        parts = token_str.strip().split(".")
        if len(parts) != 2:
            return None
        payload_b64, sig = parts
        key = settings.SECRET_KEY.encode("utf-8")
        expected_sig = hmac.new(key, payload_b64.encode("utf-8"), hashlib.sha256).hexdigest()
        if not hmac.compare_digest(sig, expected_sig):
            return None

        # Pad base64 if needed
        padded = payload_b64 + "=" * ((4 - len(payload_b64) % 4) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded.encode("utf-8")).decode("utf-8"))
        if payload.get("exp", 0) < int(time.time()):
            return None
        return payload
    except Exception:
        return None


def get_current_role(
    authorization: Optional[str] = Header(default=None),
    x_role: Optional[str] = Header(default=None),
    x_user_role: Optional[str] = Header(default=None)
) -> str:
    """Extract role from Authorization Bearer token with fallback to X-Role header."""
    if authorization and authorization.startswith("Bearer "):
        token_str = authorization[7:].strip()
        payload = verify_demo_token(token_str)
        if payload and payload.get("role"):
            return payload["role"]

    effective_role = x_role or x_user_role or "Officer"
    role_normalized = effective_role.strip().capitalize()
    if role_normalized in Role.ALL_ROLES:
        return role_normalized

    low = effective_role.strip().lower()
    if "officer" in low:
        return Role.OFFICER
    if "institution" in low or "college" in low or "registrar" in low:
        return Role.INSTITUTION
    if "student" in low:
        return Role.STUDENT
    if "verifier" in low or "public" in low or "employer" in low:
        return Role.VERIFIER

    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail=f"Invalid role '{effective_role}'. Allowed roles: {', '.join(Role.ALL_ROLES)}"
    )


def require_officer(
    authorization: Optional[str] = Header(default=None),
    x_role: Optional[str] = Header(default=None),
    x_user_role: Optional[str] = Header(default=None)
) -> str:
    current = get_current_role(authorization=authorization, x_role=x_role, x_user_role=x_user_role)
    if current != Role.OFFICER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted: AICTE Officer role required for this action."
        )
    return current


def get_institution_context(
    authorization: Optional[str] = Header(default=None),
    x_institution_id: Optional[str] = Header(default=None)
) -> Optional[str]:
    """Optional institution filter header for institution role."""
    if authorization and authorization.startswith("Bearer "):
        payload = verify_demo_token(authorization[7:].strip())
        if payload and payload.get("inst_id"):
            return payload["inst_id"]
    return x_institution_id.strip() if x_institution_id else None


def get_student_token_context(
    authorization: Optional[str] = Header(default=None),
    x_student_token: Optional[str] = Header(default=None)
) -> Optional[str]:
    """Optional student token context header for student role."""
    if authorization and authorization.startswith("Bearer "):
        payload = verify_demo_token(authorization[7:].strip())
        if payload and payload.get("stu_tok"):
            return payload["stu_tok"]
    return x_student_token.strip() if x_student_token else None


def assert_officer(role: str) -> None:
    if role != Role.OFFICER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: this endpoint requires the AICTE Officer role."
        )


def assert_institution_access(requested_inst_id: str, role: str, caller_inst_id: Optional[str]) -> None:
    if role == Role.OFFICER:
        return
    if role == Role.INSTITUTION:
        if caller_inst_id and caller_inst_id != requested_inst_id:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Access forbidden: Institution '{caller_inst_id}' cannot access records for '{requested_inst_id}'."
            )
        return
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access forbidden: this action requires an AICTE Officer or College Registrar role."
    )


def assert_student_access(requested_token: str, role: str, caller_token: Optional[str]) -> None:
    if role == Role.OFFICER:
        return
    canonical_rohan = compute_apaar_token("554433221100")
    req_norm = canonical_rohan if requested_token in ("tok_rohan_sharma", "rohan", "default") else requested_token
    cal_norm = (canonical_rohan if caller_token in ("tok_rohan_sharma", "rohan", "default") else caller_token) if caller_token else None

    if role == Role.STUDENT:
        if cal_norm and cal_norm != req_norm:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access forbidden: Students may only access their own records."
            )
        return
    if role == Role.VERIFIER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access forbidden: Public verifiers must use the /api/v1/verify/presentation endpoint."
        )
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="Access forbidden: this record is restricted to the student owner or AICTE Officer."
    )


# ----------------- Ed25519 Cryptographic Keys & Signing -----------------
KEYS_DIR = STORAGE_DIR / "keys"
KEYS_DIR.mkdir(parents=True, exist_ok=True)
_KEY_CACHE: Dict[str, Dict[str, Any]] = {}


def get_or_create_keypair(key_id: str) -> Dict[str, Any]:
    if key_id in _KEY_CACHE:
        return _KEY_CACHE[key_id]

    priv_file = KEYS_DIR / f"{key_id}_priv.pem"
    pub_file = KEYS_DIR / f"{key_id}_pub.pem"

    if priv_file.exists() and pub_file.exists():
        priv_key = serialization.load_pem_private_key(priv_file.read_bytes(), password=None)
        pub_key = serialization.load_pem_public_key(pub_file.read_bytes())
    else:
        priv_key = ed25519.Ed25519PrivateKey.generate()
        pub_key = priv_key.public_key()

        priv_bytes = priv_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        )
        pub_bytes = pub_key.public_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PublicFormat.SubjectPublicKeyInfo
        )
        priv_file.write_bytes(priv_bytes)
        pub_file.write_bytes(pub_bytes)

    pub_raw = pub_key.public_bytes(
        encoding=serialization.Encoding.Raw,
        format=serialization.PublicFormat.Raw
    )
    pub_b64 = base64.b64encode(pub_raw).decode("ascii")

    _KEY_CACHE[key_id] = {
        "private_key": priv_key,
        "public_key": pub_key,
        "public_key_b64": pub_b64
    }
    return _KEY_CACHE[key_id]


def sign_payload(key_id: str, payload_dict: Dict[str, Any]) -> str:
    keypair = get_or_create_keypair(key_id)
    canonical_json = json.dumps(payload_dict, sort_keys=True, separators=(',', ':')).encode('utf-8')
    signature = keypair["private_key"].sign(canonical_json)
    return base64.b64encode(signature).decode('ascii')


def verify_signature(key_id: str, payload_dict: Dict[str, Any], signature_b64: str) -> bool:
    try:
        keypair = get_or_create_keypair(key_id)
        pub_key: ed25519.Ed25519PublicKey = keypair["public_key"]
        canonical_json = json.dumps(payload_dict, sort_keys=True, separators=(',', ':')).encode('utf-8')
        signature_bytes = base64.b64decode(signature_b64)
        pub_key.verify(signature_bytes, canonical_json)
        return True
    except Exception:
        return False


# ----------------- SD-JWT Inspired Salted Commitments -----------------
def generate_commitment(field_name: str, value: str, salt: Optional[str] = None) -> Tuple[str, str]:
    """
    Creates a cryptographic salted commitment: sha256(salt + ":" + value).
    Returns (commitment_hash, salt).
    """
    if not salt:
        salt = secrets.token_hex(16)
    token = f"{salt}:{str(value)}"
    digest = hashlib.sha256(token.encode("utf-8")).hexdigest()
    return digest, salt


def verify_commitment(commitment_hash: str, value: str, salt: str) -> bool:
    recomputed = hashlib.sha256(f"{salt}:{str(value)}".encode("utf-8")).hexdigest()
    return hmac.compare_digest(recomputed, commitment_hash)
