const stackedLayout = '(max-width: 1100px)';

function focusAndReveal(element: HTMLElement | null) {
  if (!element) return;
  const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  element.focus({ preventScroll: true });
  element.scrollIntoView?.({ block: 'start', behavior: reducedMotion ? 'instant' : 'smooth' });
}

export function focusDetailsOnSmallScreen() {
  if (!window.matchMedia?.(stackedLayout).matches) return;
  focusAndReveal(document.getElementById('business-details'));
}

export function returnToSelectedResult() {
  focusAndReveal(
    document.querySelector<HTMLButtonElement>('.business-select[aria-pressed="true"]'),
  );
}
