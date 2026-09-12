// The tab bar: five tabs on a floating capsule of glass, with the bag beside it as its
// own round button — the way iOS sets a standing action apart from places.
//
// - The lens (the brighter capsule under the current tab) slides on a spring, and
//   follows a finger dragged along the bar; letting go lands on the nearest tab.
// - Scrolling down a long page folds the capsule to the current tab alone; scrolling
//   back up, tapping it, or going anywhere opens it again.
// - The row keeps the open bar's width whatever the capsule is doing, so folding
//   CLIPS the tabs instead of squeezing them — and the collapsed width is never
//   measured from a tab that is itself shrinking.

import { $, $$, clamp } from "./util.js";
import { icon } from "./icons.js";
import { haptic } from "./motion.js";

const bar = $("#dockbar");
const caps = $("#tabs");
const row = $("#tabs-row");
const tabs = $$(".tab", row);
const narrow = matchMedia("(max-width: 999px)");

let active = null;
let minimized = false;

/* ------------------------------------------------------------------- lens */
function place() {
  const i = tabs.findIndex((t) => t.dataset.tab === active);
  if (i < 0) { bar.classList.add("no-lens"); return; }
  bar.classList.remove("no-lens");
  const t = tabs[i];
  const shift = minimized ? -t.offsetLeft : 0;
  bar.style.setProperty("--row-x", `${shift}px`);
  bar.style.setProperty("--lens-x", `${t.offsetLeft + shift}px`);
  bar.style.setProperty("--lens-w", `${t.offsetWidth}px`);
  bar.style.setProperty("--min-w", `${t.offsetWidth}px`);
  bar.dataset.ready = "1";
}

/** Called on every render. `key` is a tab name, or null for a screen with no tab. */
export function paintTabs(key) {
  active = key;
  tabs.forEach((t) => t.setAttribute("aria-current", t.dataset.tab === key ? "page" : "false"));
  place();
}

/** The face on the Profile tab: their photo once there is one, the glyph until then. */
export function setTabFace(key, html) {
  const t = tabs.find((x) => x.dataset.tab === key);
  if (t) t.querySelector(".tab-ico").innerHTML = html;
}
export const tabIcons = (name) => icon(name) + icon(name + "Fill");

/* ------------------------------------------------------------ fold on scroll */
function setMin(on) {
  if (on === minimized) return;
  // never on a wide screen, never with no tab open, and never on a page too short to
  // have earned it — a bar that folds on a screen you cannot scroll reads as a glitch
  if (on && (!narrow.matches || !active || document.documentElement.scrollHeight - innerHeight < 700)) return;
  minimized = on;
  bar.classList.toggle("min", on);
  place();
}
export const expandTabs = () => setMin(false);

let lastY = scrollY, run = 0;
addEventListener("scroll", () => {
  const y = scrollY, dy = y - lastY;
  lastY = y;
  if (y < 120) { run = 0; setMin(false); return; }
  run = Math.sign(dy) === Math.sign(run) ? run + dy : dy;
  if (run > 48) setMin(true);
  else if (run < -28) setMin(false);
}, { passive: true });

/* ---------------------------------------------------------- drag the lens */
let drag = null, swallow = false;
// The tabs are links, and a mouse dragged across a link starts the browser's own drag —
// which cancels the pointer on the first move. Ours is the only drag here.
caps.addEventListener("dragstart", (e) => e.preventDefault());
caps.addEventListener("pointerdown", (e) => {
  if (minimized || e.button > 0 || !tabs.length) return;
  drag = { x0: e.clientX, id: e.pointerId, moved: false, idx: -1 };
});
caps.addEventListener("pointermove", (e) => {
  if (!drag || e.pointerId !== drag.id) return;
  const dx = e.clientX - drag.x0;
  if (!drag.moved) {
    if (Math.abs(dx) < 8) return;
    drag.moved = true;
    try { caps.setPointerCapture(e.pointerId); } catch {}
    bar.classList.add("dragging");
    bar.classList.remove("no-lens");
  }
  const w = tabs[0].offsetWidth;
  const r = row.getBoundingClientRect();
  const x = clamp(e.clientX - r.left - w / 2, 0, r.width - w);
  bar.style.setProperty("--lens-x", `${x}px`);
  bar.style.setProperty("--lens-w", `${w}px`);
  const idx = clamp(Math.round(x / w), 0, tabs.length - 1);
  if (idx !== drag.idx) {
    drag.idx = idx;
    haptic(4);
    tabs.forEach((t, i) => t.classList.toggle("under", i === idx));
  }
});
const endDrag = () => {
  if (!drag) return;
  const d = drag;
  drag = null;
  bar.classList.remove("dragging");
  tabs.forEach((t) => t.classList.remove("under"));
  if (!d.moved) return;
  swallow = true;
  setTimeout(() => { swallow = false; }, 0);
  const t = tabs[d.idx];
  if (t && location.hash.split("?")[0] !== t.getAttribute("href")) location.hash = t.getAttribute("href");
  else place();
};
caps.addEventListener("pointerup", endDrag);
// a cancelled pointer (a system gesture taking over) puts the lens back, and goes nowhere
caps.addEventListener("pointercancel", () => {
  drag = null;
  bar.classList.remove("dragging");
  tabs.forEach((t) => t.classList.remove("under"));
  place();
});
caps.addEventListener("click", (e) => {
  if (swallow) { e.preventDefault(); e.stopPropagation(); return; }
  // a folded bar opens on tap instead of navigating
  if (minimized) { e.preventDefault(); e.stopPropagation(); setMin(false); return; }
  // the tab you are already on takes you back to the top, as on iOS
  const t = e.target.closest(".tab");
  if (t && t.getAttribute("href") === (location.hash.split("?")[0] || "#/")) {
    e.preventDefault();
    scrollTo({ top: 0, behavior: "smooth" });
  }
}, true);

export function initTabs() {
  tabs.forEach((t) => { t.querySelector(".tab-ico").innerHTML = tabIcons(t.dataset.tab); });
  addEventListener("resize", () => { if (!narrow.matches) setMin(false); place(); });
  if ("ResizeObserver" in window) new ResizeObserver(() => place()).observe(row);
  document.fonts?.ready?.then(place).catch(() => {});
}
