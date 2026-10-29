/**
 * StatCard Component with Sparkline
 */

import { iconHtml } from './icons.js';

export function renderStatCard({ label, value, trendPct, trendDir = 'up', series = [], id = '' }) {
  const trendCls = trendDir === 'up' ? 'up' : trendDir === 'down' ? 'down' : 'neutral';
  const trendIcon = trendDir === 'up' ? 'arrow-up-down' : trendDir === 'down' ? 'arrow-up-down' : 'info';

  const canvasId = id || `sparkline_${Math.random().toString(36).substr(2, 9)}`;

  const cardHtml = `
    <div class="stat-card" data-stat-id="${canvasId}">
      <div class="stat-card-header">
        <span class="stat-label">${label}</span>
        ${trendPct ? `
          <span class="stat-trend ${trendCls}">
            ${iconHtml(trendIcon, 'icon-sm')} ${trendPct}
          </span>
        ` : ''}
      </div>
      <div class="stat-card-body">
        <span class="stat-value tabular">${value}</span>
        <canvas class="sparkline-canvas" id="${canvasId}" width="90" height="35" aria-hidden="true"></canvas>
      </div>
    </div>
  `;

  // Draw sparkline after DOM mount
  setTimeout(() => {
    drawSparkline(canvasId, series, trendDir);
  }, 10);

  return cardHtml;
}

export function drawSparkline(canvasId, series, trendDir = 'up') {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !series || series.length < 2) return;

  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;

  ctx.beginPath();
  const strokeColor = trendDir === 'up' ? '#138808' : trendDir === 'down' ? '#c62828' : '#1565c0';
  ctx.strokeStyle = strokeColor;
  ctx.lineWidth = 2;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';

  const step = (w - 6) / (series.length - 1);
  series.forEach((val, i) => {
    const x = 3 + i * step;
    const y = h - 4 - ((val - min) / range) * (h - 10);
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  });
  ctx.stroke();

  // Subtle gradient fill under curve
  ctx.lineTo(w - 3, h);
  ctx.lineTo(3, h);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, 0, 0, h);
  grad.addColorStop(0, `${strokeColor}22`);
  grad.addColorStop(1, `${strokeColor}00`);
  ctx.fillStyle = grad;
  ctx.fill();
}

export function animateCountUp(element, endVal, duration = 750) {
  if (!element) return;
  const num = typeof endVal === 'number' ? endVal : parseFloat(String(endVal).replace(/[^0-9.-]+/g, ''));
  if (isNaN(num)) return;

  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    element.textContent = num.toLocaleString();
    return;
  }

  const startTime = performance.now();
  function tick(now) {
    const elapsed = now - startTime;
    const progress = Math.min(elapsed / duration, 1);
    const easeOut = 1 - Math.pow(1 - progress, 3);
    const current = Math.round(num * easeOut);
    element.textContent = current.toLocaleString();
    if (progress < 1) {
      requestAnimationFrame(tick);
    } else {
      element.textContent = num.toLocaleString();
    }
  }
  requestAnimationFrame(tick);
}

