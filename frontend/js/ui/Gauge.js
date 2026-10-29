/**
 * Seat Matrix Gauge Component
 */

export function renderSeatGauge({ programme, approved, admitted, excess = 0, quota = 'Regular' }) {
  const percent = approved > 0 ? Math.min(Math.round((admitted / approved) * 100), 100) : 0;
  let statusClass = 'good';
  if (excess > 0 || admitted > approved) {
    statusClass = 'problem';
  } else if (percent >= 90) {
    statusClass = 'look';
  }

  return `
    <div class="gauge-card">
      <div class="gauge-header">
        <span class="font-medium">${programme} (${quota})</span>
        <span class="tabular ${statusClass === 'problem' ? 'font-bold' : ''}" style="${statusClass === 'problem' ? 'color: var(--red);' : ''}">
          ${admitted} / ${approved} ${excess > 0 ? `(+${excess} excess)` : ''}
        </span>
      </div>
      <div class="gauge-bar-track">
        <div class="gauge-bar-fill ${statusClass}" style="width: ${percent}%;"></div>
      </div>
      <div style="display: flex; justify-content: space-between; font-size: 0.72rem; color: var(--text-muted);">
        <span>DEMO VALUES, not AICTE rules</span>
        <span class="tabular">${percent}% utilized</span>
      </div>
    </div>
  `;
}
