/**
 * SVG Sprite Icon Renderer using vendored Lucide sprite sheet.
 * No CDN requests, offline-first.
 */

export function icon(name, className = '') {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', `icon ${className}`.trim());
  svg.setAttribute('aria-hidden', 'true');
  
  const use = document.createElementNS(ns, 'use');
  use.setAttribute('href', `vendor/lucide-sprite.svg#icon-${name}`);
  svg.appendChild(use);
  
  return svg;
}

export function iconHtml(name, className = '') {
  return `<svg class="icon ${className}" aria-hidden="true"><use href="vendor/lucide-sprite.svg#icon-${name}"></use></svg>`;
}
