// Motion. Springs in Apple's own terms — damping ratio and response — rather than
// stiffness and mass, because those are the two numbers a designer can reason about:
// 1.0 settles without overshoot, below 1.0 bounces; response is roughly how long it
// takes to get there. A spring starts from wherever the thing is and at whatever
// speed it is already moving, so anything here can be grabbed mid-flight.

export const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;

/** A short tap on the phone's haptic engine, where the browser allows it. */
export function haptic(pattern = 10) {
  try { navigator.vibrate?.(pattern); } catch {}
}

/** Re-run a CSS animation class on a node. */
export function replay(node, cls) {
  if (!node) return;
  node.classList.remove(cls);
  void node.offsetWidth;
  node.classList.add(cls);
}

/**
 * Animate a number from `from` to `to`. Returns { stop, value, velocity }.
 * Reduced motion, or a hidden tab (rAF does not run there), lands immediately.
 */
export function spring({ from, to, velocity = 0, damping = 1, response = .4, precision = .01, onUpdate, onDone }) {
  const k = (2 * Math.PI / response) ** 2;
  const c = (4 * Math.PI * damping) / response;
  let x = from, v = velocity, last = 0, raf = 0, stopped = false;
  const handle = {
    stop() { stopped = true; cancelAnimationFrame(raf); },
    get value() { return x; },
    get velocity() { return v; },
  };
  const finish = () => { x = to; v = 0; onUpdate?.(to); onDone?.(); };
  if (reduced() || document.hidden) {
    queueMicrotask(() => { if (!stopped) finish(); });
    return handle;
  }
  const step = (now) => {
    if (stopped) return;
    if (!last) last = now - 16.7;
    const dt = Math.min(.064, (now - last) / 1000);
    last = now;
    const n = Math.max(1, Math.ceil(dt / .004));
    const h = dt / n;
    for (let i = 0; i < n; i++) {
      const a = -k * (x - to) - c * v;
      v += a * h;
      x += v * h;
    }
    if (Math.abs(x - to) < precision && Math.abs(v) < precision * 10) { finish(); return; }
    onUpdate?.(x);
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return handle;
}

/** Where a flick would come to rest — the same decay iOS scroll views use. */
export const project = (velocity, rate = .998) => ((velocity / 1000) * rate) / (1 - rate);

/** Progressive resistance past an edge: the further you pull, the less it follows. */
export const rubberband = (overshoot, dimension, constant = .55) =>
  (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));

/** Count a number up in a node over ms. */
export function countUp(node, to, ms = 900, fmt = (n) => Math.round(n).toLocaleString("en-US"), from = 0) {
  if (!node) return;
  if (reduced() || document.hidden) { node.textContent = fmt(to); return; }
  const start = performance.now();
  const ease = (t) => 1 - Math.pow(1 - t, 3);
  const step = (now) => {
    const t = Math.min(1, (now - start) / ms);
    node.textContent = fmt(from + (to - from) * ease(t));
    if (t < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
