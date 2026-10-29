/**
 * Stepper Wizard Component
 */

export function renderStepper(steps, activeIndex = 0) {
  return `
    <div class="stepper" role="progressbar" aria-valuemin="1" aria-valuemax="${steps.length}" aria-valuenow="${activeIndex + 1}">
      ${steps
        .map((step, idx) => {
          let stateCls = '';
          if (idx < activeIndex) stateCls = 'completed';
          else if (idx === activeIndex) stateCls = 'active';

          return `
          <div class="step-item ${stateCls}">
            <div class="step-circle tabular">
              ${idx < activeIndex ? '✓' : idx + 1}
            </div>
            <div class="step-title">${step.title}</div>
          </div>
        `;
        })
        .join('')}
    </div>
  `;
}
