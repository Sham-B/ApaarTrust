# ApaarTrust - System Specification & Architecture Brief

**Platform**: ApaarTrust • AICTE APAAR ID-Based Student Data Management and Verification Platform  
**Positioning**: *"One ID. Verified students. Zero exposure." AI only advises; officers decide.*  
**Environment**: 100% Local Offline Prototype (`python run.py`, default port 8080).

---

## 1. System Overview & Philosophy

**ApaarTrust** is an assistive, privacy-preserving regulatory management and verifiable credential prototype built for the AICTE problem statement: **"Development of an APAAR ID-Based Student Data Management and Verification Platform for AICTE-Approved Institutions"**.

### Non-Negotiables & Guiding Principles
1. **Zero-Exposure Architecture**:
   - 12-digit APAAR IDs are masked by default (`XXXX-XXXX-1234`) and stored encrypted at rest using Fernet (AES-128-CBC with HMAC-SHA256).
   - Deterministic indexing uses HMAC-SHA256 tokens (`apaar_token`) so database lookups occur without exposing the raw identifier.
   - Verifiable credentials use SD-JWT-inspired salted commitments (`sha256(salt:claim)`) allowing students to selectively disclose only consented attributes while withholding sensitive demographic data.
2. **AI Only Advises; Officers Decide**:
   - Automated components, pipelines, or models can NEVER execute an adverse regulatory action (e.g. holding or rejecting a college submission).
   - Adverse decisions strictly require an authenticated **Officer** role, a written justification (minimum 10 characters), and are permanently recorded in an append-only SHA-256 hash-chained audit ledger.
3. **14 Multi-Rule Validation Engine**:
   - Validates student intake against format, registry status, name concordance, DOB concordance, intra-batch duplicates, cross-institution duplicate enrolments, regular intake limits, and supernumerary quotas.
   - Seat caps and supernumerary quotas are labelled: *DEMO VALUES, not AICTE rules; configure from the Approval Process Handbook*.
4. **Clearly Labelled Mock Central Registry**:
   - The central registry is an internal SQLite mock simulating the Academic Bank of Credits. All responses are cryptographically sealed with Ed25519.
   - A down-switch toggle demonstrates that service disruptions yield `cannot_assess` / `source_unavailable` rather than false positives.
   - *Production access would require formal authorization and a security review; we have not assessed those requirements.*
5. **Sample Verifiable Credentials Studio**:
   - Generates tamper-proof ReportLab sample certificates of enrolment embedding student roll ID, masked APAAR ID, and machine-readable signed QR seals.
6. **Built with GIGW-style accessibility in mind (not audited)**:
   - Interface includes high-contrast tri-colour styling, text-resizing controls (A-/A/A+), and full keyboard navigation.

---

## 2. Multi-Rule Validation Engine (14 Rules)

All 14 validation rules are defined in YAML configuration (`rules/validation_rules.yaml`):
1. `APAAR_FORMAT`: 12-digit numeric format check.
2. `REGISTRY_LOOKUP`: Mock APAAR Central Registry resolution.
3. `REGISTRY_MISMATCH_NAME`: Name concordance via RapidFuzz.
4. `REGISTRY_MISMATCH_DOB`: Date of birth concordance.
5. `REGISTRY_CONSENT_MISSING`: Citizen verification consent flag check.
6. `DUPLICATE_IN_BATCH`: Intra-batch duplicate student detection.
7. `DUPLICATE_CROSS_INSTITUTION`: Cross-institution concurrent enrolment check with log-odds probabilistic scoring.
8. `SEAT_CAP_REGULAR`: Sanctioned regular intake ceiling check *(DEMO VALUES, not AICTE rules; configure from the Approval Process Handbook)*.
9. `SEAT_CAP_SUPERNUMERARY`: Quota checks for TFW, EWS, KM, PMSSS, and NRI/FN *(DEMO VALUES, not AICTE rules; configure from the Approval Process Handbook)*.
10. `CONSISTENCY_NATIONALITY_QUOTA`: Nationality and quota alignment.
11. `CONSISTENCY_AGE_RANGE`: Programme age band consistency (16–35).
12. `CONSISTENCY_ADMISSION_DATE`: Academic year intake window consistency.
13. `ANOMALY_DOB_CLUSTER`: Statistical birth date clustering anomaly (01-Jan default convention detection).
14. `ANOMALY_NRI_FN_SPIKE`: Supernumerary NRI/FN outlier distribution spike detection.

---

## 3. Speed Benchmark Specification

- **Benchmark Type**: In-memory speed benchmark (`POST /api/v1/drill/benchmark?row_count=20000`).
- **Exact Checks Executed**:
  1. Synthetic student record synthesis (12-digit format check, name, DOB generation).
  2. HMAC-SHA256 blind indexing token derivation.
  3. In-memory intra-batch duplicate token collision detection.
- **Scope Notice**: *This is an in-memory measurement on this machine. It skips central registry network lookups and cross-institution database matching.*

---

## 4. Offline AI Compliance Copilot

- Answers **ONLY** from the YAML rule files and the glossary.
- Every response starts with `"Based on the demo rule set (<file/key>):"`.
- If the question is outside configured content, answers `"That is not in the configured rules"` and does not guess.
- Never cites specific APH clause numbers unless they exist in config.
- Seat caps and supernumerary quotas are labelled with: `"DEMO VALUES, not AICTE rules; configure from the Approval Process Handbook"`.
- Ends with: `"Demo assistant. Not legal or regulatory advice."`.
- Default mode is template; if Ollama is enabled, sends only configured context and labels each answer with `"template"` or `"local model"`.
