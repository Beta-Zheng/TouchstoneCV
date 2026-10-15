export interface ResumeLocation {
  sectionId: string;
  blockId?: string;
  requestId: number;
  scroll?: boolean;
}

/** Scroll just the owning pane: scrollIntoView may also move the other pane/page. */
export function scrollInPane(target: HTMLElement, boundary: HTMLElement, inset = 56, useBoundary = false) {
  let pane: HTMLElement | null = useBoundary ? boundary : target.parentElement;
  while (pane) {
    if (/(auto|scroll)/.test(getComputedStyle(pane).overflowY) && pane.scrollHeight > pane.clientHeight) break;
    if (pane === boundary) { pane = null; break; }
    pane = pane.parentElement;
  }
  if (!pane) return false;
  // Cancel an older smooth request before deciding whether this target needs movement.
  pane.scrollTo({ top: pane.scrollTop, behavior: 'instant' });
  const bounds = pane.getBoundingClientRect();
  const visibleTop = bounds.top + pane.clientTop + inset;
  const visibleBottom = bounds.top + pane.clientTop + pane.clientHeight - 12;
  const rect = target.getBoundingClientRect();
  const tall = rect.height > visibleBottom - visibleTop;
  if ((rect.top >= visibleTop && rect.top < visibleBottom && (rect.bottom <= visibleBottom || tall)) ||
      (tall && rect.top <= visibleTop && rect.bottom >= visibleBottom)) return false;
  const delta = rect.top < visibleTop || tall ? rect.top - visibleTop : rect.bottom - visibleBottom;
  pane.scrollTo({ top: Math.max(0, pane.scrollTop + delta), behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  return true;
}

export function flashLocation(target: HTMLElement, kind: 'preview' | 'editor') {
  const attribute = `data-${kind}-location`;
  target.setAttribute(attribute, 'true');
  const timer = window.setTimeout(() => target.removeAttribute(attribute), 1200);
  return () => { clearTimeout(timer); target.removeAttribute(attribute); };
}
