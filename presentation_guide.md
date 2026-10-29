# 🏆 ApaarTrust — 2-Minute Hackathon Winning Pitch Guide

> **Prototype URL**: `http://127.0.0.1:8080` (Local Offline Prototype)  
> **Target Duration**: Exactly 120 Seconds (2 Minutes)  
> **Core Theme**: *"One ID. Verified students. Zero exposure." AI only advises; officers decide.*

---

## ⚡ The 7 Innovation Pillars (Cheat-Sheet)

1. **Zero-Exposure Architecture**: 12-digit APAAR IDs are masked (`XXXX-XXXX-1234`), encrypted with Fernet at rest, and deterministically indexed using HMAC-SHA256 tokens (`apaar_token`).
2. **AI Only Advises; Officers Decide**: No model can take adverse action; adverse decisions strictly require an authenticated Scrutiny Officer, a written justification (>= 10 chars), and are permanently recorded in an append-only SHA-256 hash-chained audit ledger.
3. **14 Multi-Rule Validation Engine**: Dry-run engine evaluates intake spreadsheets with zero database mutations, reporting plain reasons, benign hypotheses, and actionable fix hints.
4. **Seat Matrix & Quota Compliance**: Live capacity gauges for regular intake and supernumerary categories (TFW, EWS, KM, PMSSS, NRI/FN). *(DEMO VALUES, not AICTE rules; configure from the Approval Process Handbook).*
5. **Cross-Institution Linkage with Privacy Redaction**: Detects concurrent active student enrolments across colleges while redacting peer institutional details to preserve privacy.
6. **Verifiable Sample Certificates & Selective Disclosure**: ReportLab sample certificate studio with Ed25519-signed QR seals and SD-JWT-inspired salted commitments (`sha256(salt:claim)`).
7. **Offline AI Compliance Copilot**: Built-in compliance advisor answering strictly from configured YAML rules and glossary, always stating source rules and disclaimers.

---

## ⏱️ Second-by-Second Presentation Script (120 Seconds)

### 🎬 Part 1: The Hook & The Problem (0:00 – 0:25 | 25s)
- **Starting Screen**: AICTE Officer Dashboard (`http://127.0.0.1:8080`).
- **Verbatim**:
  > *"Respected Judges, AICTE-approved institutions admit millions of students annually, but verifying genuine admissions without exposing sensitive citizen data has been an unsolved dilemma.  
  > Meet **ApaarTrust**—built on the principle: **'One ID. Verified students. Zero exposure.'**  
  > We provide institutional intake management, 14 validation checks, and verifiable credentials with mathematical proof—without ever exposing raw APAAR IDs to third parties or peer institutions."*

### 🔍 Part 2: Registrar Intake Wizard & Dry-Run Engine (0:25 – 0:55 | 30s)
- **Action**: Switch role to **College Registrar**, select **Bhaskara College of Engineering & Research**.
- **Action**: Show live seat gauges (regular CSE overflow +28, TFW +8). *(DEMO VALUES, not AICTE rules; configure from the Approval Process Handbook)*.
- **Action**: Click **Check My File (Dry Run)**.
- **Verbatim**:
  > *"When a college uploads student records, our **Dry-Run Engine** runs 14 validation checks without persisting a single row to the database.  
  > It highlights intake overflows, format discrepancies, and name mismatches, providing benign hypotheses and actionable fix hints. When they commit, our delta diff engine shows exactly what changed."*

### 🕸️ Part 3: Cross-Institution Duplicate Linkage & Privacy Redaction (0:55 – 1:20 | 25s)
- **Action**: Switch to Officer role, open **Duplicates & Collisions** tab.
- **Action**: Show match card for student Rohan Aditya Sharma concurrently enrolled at two colleges.
- **Action**: Switch to College Registrar role and show the competing college name is strictly redacted!
- **Verbatim**:
  > *"Single-college checks can never detect duplicate admissions. ApaarTrust detects concurrent enrolments across institutions using probabilistic log-odds scoring.  
  > Crucially, we enforce peer privacy: when a college registrar inspects the collision, the competing college's identity is strictly redacted, preventing institutional snooping."*

### 📜 Part 4: Verifiable Sample Credentials & Selective Disclosure (1:20 – 1:45 | 25s)
- **Action**: In Certificate Studio, click **Download Sample Certificate PDF**. Open the generated ReportLab PDF with signed QR seal.
- **Action**: In Public Verifier workspace, verify the certificate, and toggle disclosed vs withheld claims.
- **Verbatim**:
  > *"We issue tamper-proof sample certificates with Ed25519-signed QR seals.  
  > Using SD-JWT-inspired salted commitments, students exercise sovereign privacy: an employer can verify valid engineering enrolment while withholding sensitive birth dates and social categories."*

### 🤖 Part 5: Killer Innovation — Offline AI Compliance Copilot (1:45 – 2:00 | 15s)
- **Action**: Open AI Copilot, click prompt *"What are the rules for TFW supernumerary intake?"*.
- **Verbatim**:
  > *"Finally, our **AI Compliance Copilot** works 100% locally and offline without external API keys. It answers strictly from configured YAML rules, always citing rule keys and including mandatory disclaimers. Zero hallucination, zero data leakage."*

---

## 🛡️ Essential Notices
- **Seat Caps & Quotas**: DEMO VALUES, not AICTE rules; configure from the Approval Process Handbook.
- **Production Access**: Production access would require formal authorization and a security review; we have not assessed those requirements.
- **Accessibility**: Built with GIGW-style accessibility in mind (not audited).
- **Speed Benchmark**: In-memory measurement on this machine (skips central registry network lookups and cross-institution matching).
