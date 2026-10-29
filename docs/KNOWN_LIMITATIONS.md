# ApaarTrust: Known Limitations & System Boundaries

This document provides complete, transparent disclosure of the design boundaries, cryptographic scope, and regulatory assumptions of the **ApaarTrust** platform prototype.

---

## 1. Regulatory Status & Scope
- **Prototype Status**: ApaarTrust is a demonstration prototype developed for the AICTE Problem Statement: *"Development of an APAAR ID-Based Student Data Management and Verification Platform for AICTE-Approved Institutions"*. It is **not** an official AICTE platform or statutory regulatory system.
- **Seat Matrix Values**: All seat matrix intake caps and supernumerary quota percentages (e.g., TFW 5%, EWS 10%, KM 3 seats, PMSSS 2 seats, NRI/FN 15%) are **DEMO VALUES, not statutory AICTE rules**; they must be configured from the official AICTE Approval Process Handbook (APH) for any jurisdictional deployment.
- **AI Assistive Role Only**: The local AI Compliance Assistant provides assistive explanations grounded in configured YAML rules and glossary entries. It does **not** make regulatory decisions. All adverse regulatory actions (e.g. holding or rejecting an institutional submission) legally require an authenticated human Scrutiny Officer with a logged justification (>= 10 characters).

---

## 2. Cryptographic Implementation
- **Fernet Encryption at Rest**: Student records and APAAR IDs are encrypted using standard Fernet (`AES-128-CBC` with `HMAC-SHA256` for ciphertext authentication and PKCS7 padding), derived via PBKDF2-HMAC-SHA256 from the master secret. It is **not** raw AES-256-GCM.
- **SD-JWT-Inspired Format**: Verifiable credential presentations use an educational format inspired by the IETF SD-JWT draft (`sha256(salt:claim)` with Ed25519 digital signature envelope). It is **not** a formal, fully RFC-compliant IETF SD-JWT implementation.
- **No Statutory Checksum Claim**: APAAR ID validation in this prototype checks for 12-digit numeric formatting and non-triviality; it does not claim to execute the proprietary Verhoeff checksum algorithm of the central government UIDAI/ABC system without formal government specification access.

---

## 3. Data & Registry Boundaries
- **100% Synthetic Data**: All student names, enrolment IDs, institutions, and APAAR identifiers in this repository are procedurally generated synthetic artifacts. Zero real student personally identifiable information (PII) is included or stored.
- **Mock Central APAAR Registry**: The Central Registry adapter communicates with an internal high-fidelity mock node (`backend/app/mock_registry`). Production integration would interface via Government API Setu and DigiLocker ABC protocols under formal government authorization.
- **DPDP Design Principles**: The system is designed with Digital Personal Data Protection (DPDP) consent principles in mind (purpose specification, selective disclosure, instant revocation, access transparency); it does not constitute a certified legal compliance claim.

---

## 4. Runtime & Deployment Constraints
- **Tested Environment**: The platform is strictly tested and supported on **Python 3.12**. Compatibility with Python 3.13 or 3.14 is unverified and not claimed.
- **Offline / Local Design**: The platform runs 100% locally (`python run.py`) without paid APIs, external cloud infrastructure, or runtime CDNs. All fonts (Inter, Noto Sans), libraries (Chart.js, Cytoscape), and icons (Lucide SVG) are locally vendored with licenses.
- **Performance & Scale**: Tested and benchmarked up to 20,000 in-memory student records with sub-second dry-run throughput. High-concurrency nationwide production deployments (millions of concurrent students) would require migration from SQLite to distributed PostgreSQL with connection pooling.
