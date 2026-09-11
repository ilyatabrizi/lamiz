// The tab bar, iOS 26 style: a capsule of glass with a lens behind the selected tab.
// The lens travels on a spring — a little liquid, stretching with its own speed — and
// it can be picked up: press and drag along the bar and it follows the finger 1:1,
// lifts, and on release throws to wherever the flick was going.

import { spring, project, rubberband, haptic, reduced } from "./motion.js";

export function mountTabs({ nav, lens, onPick }) {
  const tabs = [...nav.querySelectorAll(".tab")];
  const n = tabs.length;
  let u = 0;             // lens position, in tab widths
  let anim = null;
  let selected = -1;
  let first = true;

  const paint = (v, stretch = 1) => {
    u = v;
    const sy = 1 / Math.sqrt(stretch);
    lens.style.transform = `translateX(${(v * 100).toFixed(3)}%) scale(${stretch.toFixed(3)}, ${sy.toFixed(3)})`;
  };

  const glide = (to, velocity = 0, damping = .8) => {
    anim?.stop();
    const h = spring({
      from: u, to, velocity, damping, response: .42, precision: .0015,
      onUpdate: (v) => paint(v, 1 + Math.min(Math.abs(h?.velocity || 0) * .045, .2)),
    });
    anim = h;
  };

  const swapIcons = (index) => tabs.forEach((t, i) => {
    const ico = t.querySelector(".tab-ico");
    const want = t._icons?.[i === index ? 1 : 0];
    if (want && ico.dataset.state !== String(i === index)) { ico.innerHTML = want; ico.dataset.state = String(i === index); }
  });

  /** Called on every route change. -1 hides the lens (a screen with no tab of its own). */
  function select(index) {
    tabs.forEach((t, i) => t.setAttribute("aria-current", i === index ? "page" : "false"));
    swapIcons(index);
    if (index < 0) { lens.style.opacity = "0"; selected = -1; return; }
    lens.style.removeProperty("opacity");
    if (first || reduced() || selected < 0) { anim?.stop(); paint(index); first = false; nav.dataset.ready = "1"; }
    else if (index !== selected && !dragging) glide(index);
    selected = index;
  }

  /* ------------------------------------------------------------- dragging */
  let dragging = false, pressed = false, sx = 0, samples = [], suppress = false, lastHover = -1;
  const geo = () => {
    const r = nav.getBoundingClientRect();
    const pad = parseFloat(getComputedStyle(nav).paddingLeft) || 5;
    return { left: r.left + pad, w: (r.width - pad * 2) / n };
  };
  const unitAt = (clientX) => {
    const { left, w } = geo();
    const raw = (clientX - left - w / 2) / w;
    if (raw < 0) return rubberband(raw, 1.5, .5);
    if (raw > n - 1) return n - 1 + rubberband(raw - (n - 1), 1.5, .5);
    return raw;
  };

  nav.addEventListener("pointerdown", (e) => {
    if (e.button !== 0) return;
    pressed = true; dragging = false; sx = e.clientX; samples = [[performance.now(), e.clientX]];
  });
  nav.addEventListener("pointermove", (e) => {
    if (!pressed) return;
    if (!dragging && Math.abs(e.clientX - sx) > 9) {
      dragging = true;
      try { nav.setPointerCapture(e.pointerId); } catch {}
      anim?.stop();
      if (selected < 0) { paint(unitAt(e.clientX)); lens.style.removeProperty("opacity"); }
      nav.classList.add("lifted");
    }
    if (!dragging) return;
    samples.push([performance.now(), e.clientX]);
    if (samples.length > 6) samples.shift();
    const v = unitAt(e.clientX);
    paint(v, 1.12);
    const hover = Math.round(Math.min(n - 1, Math.max(0, v)));
    if (hover !== lastHover) { lastHover = hover; haptic(5); tabs.forEach((t, i) => t.classList.toggle("hover", i === hover)); }
  });
  const end = () => {
    if (!pressed) return;
    pressed = false;
    if (!dragging) return;
    dragging = false;
    suppress = true;
    nav.classList.remove("lifted");
    tabs.forEach((t) => t.classList.remove("hover"));
    const { w } = geo();
    const [t0, x0] = samples[0], [t1, x1] = samples[samples.length - 1];
    const vpx = t1 > t0 ? ((x1 - x0) / (t1 - t0)) * 1000 : 0;
    const landing = u + project(vpx, .99) / w;
    const target = Math.round(Math.min(n - 1, Math.max(0, landing)));
    glide(target, vpx / w, .78);
    if (target !== selected) onPick(target, tabs[target]);
    setTimeout(() => { suppress = false; }, 50);
    lastHover = -1;
  };
  nav.addEventListener("pointerup", end);
  nav.addEventListener("pointercancel", () => { if (dragging) end(); pressed = false; });
  // a drag that ends over a tab must not also click it
  nav.addEventListener("click", (e) => { if (suppress) { e.preventDefault(); e.stopPropagation(); } }, true);

  return { select, get index() { return selected; } };
}
