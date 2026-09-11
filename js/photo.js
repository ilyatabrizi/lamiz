// Profile photos. Pick one (camera or library), frame it in a circle — drag to
// move, pinch or slide to zoom — and keep a 480-pixel square JPEG on this phone.
// Nothing is uploaded anywhere.

import { openSheet, closeSheet, toast } from "./ui.js";
import { icon } from "./icons.js";
import { haptic } from "./motion.js";

const OUT = 480;   // exported side, px
const V = 264;     // the circle on screen, css px

/** Open the system picker; onDone(dataUrl) once the photo has been framed. */
export function choosePhoto({ camera = false, onDone } = {}) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = "image/*";
  if (camera) input.setAttribute("capture", "user");
  input.className = "photo-input";
  input.style.cssText = "position:fixed;left:-9999px;top:0;opacity:0;width:1px;height:1px";
  document.body.append(input);
  input.addEventListener("change", () => {
    const file = input.files && input.files[0];
    input.remove();
    if (file) load(file, onDone);
  }, { once: true });
  input.click();
  setTimeout(() => { if (input.isConnected) input.remove(); }, 120000);
}

function load(file, onDone) {
  const url = URL.createObjectURL(file);
  const img = new Image();
  img.decoding = "async";
  img.onload = () => crop(img, (out) => { URL.revokeObjectURL(url); onDone?.(out); }, () => URL.revokeObjectURL(url));
  img.onerror = () => { URL.revokeObjectURL(url); toast("That photo couldn't be opened — try a JPEG or PNG"); };
  img.src = url;
}

const dist = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);
const mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];

function crop(img, done, cancel) {
  const iw = img.naturalWidth, ih = img.naturalHeight;
  const base = Math.max(V / iw, V / ih);          // cover the circle at zoom 1
  let z = 1, x = 0, y = 0, used = false;

  openSheet({
    title: "Move and scale",
    sub: "Drag to frame your face. Pinch or slide to zoom.",
    label: "Frame your photo",
    body: `
      <div class="crop">
        <div class="crop-view" id="crop-view"><img id="crop-img" alt="" draggable="false"><span class="crop-ring"></span></div>
        <label class="crop-zoom">${icon("minus")}<input id="crop-z" type="range" min="1" max="4" step="0.01" value="1" aria-label="Zoom">${icon("plus")}</label>
      </div>`,
    foot: `<button class="btn btn--block" id="crop-use" type="button">Use photo</button>`,
    onClose: () => { if (!used) cancel?.(); },
    mount(sheet) {
      const view = sheet.querySelector("#crop-view");
      const el = sheet.querySelector("#crop-img");
      const zr = sheet.querySelector("#crop-z");
      el.src = img.src;
      el.style.width = `${iw}px`;
      el.style.height = `${ih}px`;

      const paint = () => {
        const s = base * z, mx = (iw * s - V) / 2, my = (ih * s - V) / 2;
        x = Math.max(-mx, Math.min(mx, x));
        y = Math.max(-my, Math.min(my, y));
        el.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${s})`;
      };
      paint();

      // one finger pans, two pinch; the sheet must not read these as a swipe to close
      const pts = new Map();
      ["touchstart", "touchmove", "touchend"].forEach((t) => view.addEventListener(t, (e) => e.stopPropagation(), { passive: true }));
      view.addEventListener("pointerdown", (e) => { view.setPointerCapture?.(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); });
      view.addEventListener("pointermove", (e) => {
        if (!pts.has(e.pointerId)) return;
        const prev = [...pts.values()];
        pts.set(e.pointerId, [e.clientX, e.clientY]);
        const now = [...pts.values()];
        if (now.length === 1) { x += now[0][0] - prev[0][0]; y += now[0][1] - prev[0][1]; }
        else {
          const d0 = dist(prev[0], prev[1]), d1 = dist(now[0], now[1]);
          if (d0 > 0) { z = Math.min(4, Math.max(1, z * d1 / d0)); zr.value = z; }
          const c0 = mid(prev[0], prev[1]), c1 = mid(now[0], now[1]);
          x += c1[0] - c0[0]; y += c1[1] - c0[1];
        }
        paint();
      });
      const up = (e) => pts.delete(e.pointerId);
      view.addEventListener("pointerup", up);
      view.addEventListener("pointercancel", up);
      view.addEventListener("wheel", (e) => {
        e.preventDefault();
        z = Math.min(4, Math.max(1, z * Math.exp(-e.deltaY * 0.0015))); zr.value = z; paint();
      }, { passive: false });
      zr.addEventListener("input", () => { z = +zr.value; paint(); });

      sheet.querySelector("#crop-use").addEventListener("click", () => {
        const s = base * z, half = V / 2 / s;
        const cx = iw / 2 - x / s, cy = ih / 2 - y / s;
        const c = document.createElement("canvas");
        c.width = c.height = OUT;
        const g = c.getContext("2d");
        g.imageSmoothingQuality = "high";
        g.drawImage(img, cx - half, cy - half, half * 2, half * 2, 0, 0, OUT, OUT);
        used = true;
        haptic([10, 30, 12]);
        closeSheet();
        done(c.toDataURL("image/jpeg", 0.86));
      });
    },
  });
}
