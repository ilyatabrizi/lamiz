// Light, dark, or whatever the phone is set to. The choice is applied before the
// first paint by the inline script in index.html; this module keeps it in step
// afterwards — the Settings control, the phone switching at sunset, the colour of
// the browser bar.

import { STORAGE } from "./config.js";
import { reduced } from "./motion.js";

const KEY = STORAGE + "theme";
const BAR = { light: "#F6F4F1", dark: "#0C0C0D" };
const media = matchMedia("(prefers-color-scheme: dark)");
const root = document.documentElement;
const listeners = new Set();

export const pref = () => { try { return localStorage.getItem(KEY) || "system"; } catch { return "system"; } };
const resolve = (p) => (p === "dark" || (p === "system" && media.matches) ? "dark" : "light");
export const mode = () => root.dataset.mode || resolve(pref());
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

function apply(p) {
  const m = resolve(p);
  root.dataset.theme = p;
  root.dataset.mode = m;
  document.getElementById("theme-color")?.setAttribute("content", BAR[m]);
  listeners.forEach((fn) => fn(m, p));
}

/** Change the preference. `from` is the tap point, so the new theme spreads out from it. */
export function setPref(p, from) {
  try { if (p === "system") localStorage.removeItem(KEY); else localStorage.setItem(KEY, p); } catch {}
  if (resolve(p) === mode()) { apply(p); return; }
  if (document.startViewTransition && !reduced()) {
    const x = from?.x ?? innerWidth / 2, y = from?.y ?? innerHeight / 2;
    const r = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    const t = document.startViewTransition(() => apply(p));
    t.ready.then(() => root.animate(
      { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${r}px at ${x}px ${y}px)`] },
      { duration: 560, easing: "cubic-bezier(.22, 1, .36, 1)", pseudoElement: "::view-transition-new(root)" },
    )).catch(() => {});
    return;
  }
  apply(p);
}

export function initTheme() {
  apply(pref());
  media.addEventListener?.("change", () => { if (pref() === "system") apply("system"); });
}
