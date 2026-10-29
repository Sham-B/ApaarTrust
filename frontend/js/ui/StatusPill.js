/**
 * StatusPill Component (Icon + Word, Color Semantics, Plain-Meaning Tooltips)
 * green: good
 * amber: look / needs a look
 * red: problem / critical
 * blue: waiting / pending
 * grey: unavailable / idle
 */

import { iconHtml } from './icons.js';

const PLAIN_MEANINGS = {
  good: 'Compliant: Meets all approved validation criteria and quotas.',
  compliant: 'Compliant: Meets all approved validation criteria and quotas.',
  genuine: 'Genuine: Cryptographically verified with valid Ed25519 signature.',
  verified: 'Verified: Academic credential confirmed authentic.',
  active: 'Active: Enrolment record current and valid for academic session.',
  resolved: 'Resolved: Triage finding reviewed and cleared by regulatory authority.',
  valid: 'Valid: Presentation verified against active student consent.',

  look: 'Needs review: Potential anomaly or pending institution clarification.',
  needs_review: 'Needs review: Cross-college duplicate or quota alert requires inspection.',
  medium: 'Warning: Moderate severity issue needing scrutiny.',
  warning: 'Warning: Cautionary validation flag detected.',
  in_review: 'In review: Under active scrutiny by regulatory officer.',

  problem: 'Non-compliant: Critical violation of intake caps or regulations.',
  non_compliant: 'Non-compliant: Approved intake cap exceeded or severe breach.',
  critical: 'Critical: High-severity violation blocking submission.',
  high: 'High priority: Regulatory scrutiny finding requiring prompt action.',
  tampered: 'Tampered: Cryptographic hash mismatch detected! Data has been altered.',
  revoked: 'Revoked: Student has explicitly withdrawn consent for this credential.',
  invalid: 'Invalid: Presentation verification failed or credential expired.',

  waiting: 'Pending: Dry-run simulation or awaiting official submission commit.',
  pending: 'Pending: Action or regulatory adjudication awaiting completion.',
  dry_run: 'Dry run: Simulation mode only; zero changes committed to database.',

  unavailable: 'Unavailable: Status cannot be determined from available data.',
  idle: 'Idle: Normal non-alert state.',
};

export function statusPill(statusType, labelText) {
  let cls = 'status-unavailable';
  let iconName = 'info';

  const low = String(statusType || '').toLowerCase();

  if (low === 'good' || low === 'compliant' || low === 'genuine' || low === 'verified' || low === 'active' || low === 'resolved' || low === 'valid') {
    cls = 'status-good';
    iconName = 'check-circle-2';
  } else if (low === 'look' || low === 'needs_review' || low === 'medium' || low === 'warning' || low === 'in_review') {
    cls = 'status-look';
    iconName = 'alert-triangle';
  } else if (low === 'problem' || low === 'non_compliant' || low === 'critical' || low === 'high' || low === 'tampered' || low === 'revoked' || low === 'invalid') {
    cls = 'status-problem';
    iconName = 'alert-circle';
  } else if (low === 'waiting' || low === 'pending' || low === 'dry_run') {
    cls = 'status-waiting';
    iconName = 'file-clock';
  } else {
    cls = 'status-unavailable';
    iconName = 'info';
  }

  const label = labelText || statusType;
  const tooltip = PLAIN_MEANINGS[low] || `${label} status`;

  return `<span class="status-pill ${cls}" title="${tooltip}" data-tooltip="${tooltip}" aria-label="${label}: ${tooltip}" tabindex="0">${iconHtml(iconName, 'icon-sm')} ${label}</span>`;
}

export function renderStatusPill(statusOrOpts, maybeLabel) {
  if (typeof statusOrOpts === 'object' && statusOrOpts !== null) {
    return statusPill(statusOrOpts.status, statusOrOpts.label || statusOrOpts.text);
  }
  return statusPill(statusOrOpts, maybeLabel);
}
