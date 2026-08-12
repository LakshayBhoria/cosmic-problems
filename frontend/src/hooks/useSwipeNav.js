import { useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

// Horizontal swipe-to-navigate between top-level pages, chained in one
// left-to-right order:
//
//   Settings  <—swipe—>  Home  <—swipe—>  Chat  <—swipe—>  Notifications  <—swipe—>  Profile
//
// Swiping right (finger moves left→right... i.e. a "next" gesture in RTL
// terms, but here matched to the product spec: swipe right from Home opens
// Chat) walks forward through the chain; swiping left walks back.
//
// `getTargets(pathname)` returns { left, right } — the route to go to for a
// left-swipe and a right-swipe from the current page (either may be null).
export function useSwipeNav(getTargets) {
  const nav = useNavigate();
  const start = useRef(null);

  const onTouchStart = useCallback((e) => {
    // Ignore multi-touch (pinch/zoom) gestures.
    if (e.touches.length !== 1) { start.current = null; return; }
    // Don't hijack swipes that start inside an explicitly horizontal-scroll
    // area (story rail, category chips, etc.) — let those scroll instead.
    if (e.target.closest && e.target.closest('[data-no-swipe-nav]')) { start.current = null; return; }
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY, time: Date.now() };
  }, []);

  const onTouchEnd = useCallback((e) => {
    const s = start.current;
    start.current = null;
    if (!s) return;
    const t = e.changedTouches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    const dt = Date.now() - s.time;
    const absDx = Math.abs(dx);
    const absDy = Math.abs(dy);

    // Require a clearly horizontal, reasonably fast, sufficiently long swipe
    // so normal vertical scrolling and taps are never mistaken for a swipe.
    const MIN_DISTANCE = 70;
    const MAX_OFF_AXIS = 60;
    const MAX_DURATION = 600;
    if (absDx < MIN_DISTANCE || absDy > MAX_OFF_AXIS || dt > MAX_DURATION) return;

    const { left, right } = getTargets(window.location.pathname) || {};
    if (dx < 0 && left) nav(left);       // swiped finger right→left → "left" target
    else if (dx > 0 && right) nav(right); // swiped finger left→right → "right" target
  }, [getTargets, nav]);

  return { onTouchStart, onTouchEnd };
}
