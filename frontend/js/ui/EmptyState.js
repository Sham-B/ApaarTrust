/**
 * EmptyState Component with inline SVG illustrations
 */

import { iconHtml } from './icons.js';

export function renderEmptyState({ iconName = 'file-text', title = 'No records found', description = 'There is currently no data matching your query.', actionHtml = '' }) {
  return `
    <div class="empty-state">
      <div class="empty-state-icon">
        ${iconHtml(iconName, 'icon-lg')}
      </div>
      <h3>${title}</h3>
      <p>${description}</p>
      ${actionHtml ? `<div style="margin-top: var(--space-2);">${actionHtml}</div>` : ''}
    </div>
  `;
}
