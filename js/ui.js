// The chrome every view borrows: toasts, the − n + control, the one-tap add, the
// bottom sheet (and the sheets the app opens most: an item, a branch picker), lazy
// images, reveal-on-scroll, avatars, the segmented control, the action sheet.

import { $, $$, esc, priceHTML, price, money, initials, hueOf, fold } from "./util.js";
import { haptic, replay, reduced } from "./motion.js";
import { icon } from "./icons.js";
import { byId, BRANCHES, CATEGORIES } from "./data.js";
import { addLine, myBranch, setMyBranch, sizeOf, defaultSize, beansFor, inBag } from "./store.js";
import { MARK } from "./brand.js";
import * as presence from "./presence.js";
import * as geo from "./geo.js";
import { status } from "./hours.js";
import { CLUB } from "./config.js";

/* ------------------------------------------------------------------ toast */
export function toast(message, { ms = 2200, ico = "" } = {}) {
  const root = $("#toast-root");
  if (!root) return;
  [...root.children].slice(0, -1).forEach((n) => n.remove());
  const node = document.createElement("div");
  node.className = "toast";
  node.setAttribute("role", "status");
  node.innerHTML = `${ico ? icon(ico) : `<span class="toast-dot"></span>`}<span></span>`;
  node.lastElementChild.textContent = message;
  root.append(node);
  setTimeout(() => {
    node.classList.add("out");
    node.addEventListener("animationend", () => node.remove(), { once: true });
    setTimeout(() => node.remove(), 500);
  }, ms);
}

/* -------------------------------------------------------------------- qty */
export const qtyHTML = (n, label = "") => `
  <span class="qty" role="group" aria-label="${esc(label || "Quantity")}">
    <button type="button" data-dec aria-label="One fewer">${icon("minus")}</button>
    <output aria-live="polite">${n}</output>
    <button type="button" data-inc aria-label="One more">${icon("plus")}</button>
  </span>`;

/** Wire a − n + control. onChange gets the new quantity. */
export function qty(node, { value, min = 0, max = 9, onChange }) {
  const out = node.querySelector("output");
  const set = (n) => {
    value = Math.min(max, Math.max(min, n));
    out.textContent = value;
    onChange(value);
  };
  node.querySelector("[data-dec]").addEventListener("click", () => { haptic(6); set(value - 1); });
  node.querySelector("[data-inc]").addEventListener("click", () => { haptic(6); set(value + 1); });
  return { set: (n) => { value = n; out.textContent = n; } };
}

/* ------------------------------------------------------------ menu pieces */
export const catName = (id) => CATEGORIES.find((c) => c.id === id)?.en || id;
const NEW_DAYS = 120;
export const isNew = (item, now = Date.now()) => !!item.added && now - Date.parse(item.added) < NEW_DAYS * 86400000;
const CAT_ICON = { hot: "cup", brew: "cup", tea: "leaf", cold: "iced", season: "sparkle", matcha: "leaf", health: "leaf",
                   bakery: "cake", toast: "cake", croissant: "cake", popsicle: "iced", extras: "drop" };

/** The item's own photograph, or — for toppings, which have none — its category glyph. */
export function itemImg(item, { size = 384, eager = false } = {}) {
  if (item.img) return `<img class="fade" src="${item.img}" alt="" width="${size}" height="${size}" ${eager ? "" : 'loading="lazy"'} decoding="async">`;
  return `<span class="noimg" aria-hidden="true">${icon(CAT_ICON[item.cat] || "cup")}</span>`;
}

export const addHTML = (item, cls = "") => `
  <button class="add ${cls}" type="button" data-add="${item.id}" aria-label="Add ${esc(item.en)} to the bag">
    <span class="add-plus">${icon("plus")}</span><span class="add-check">${icon("check")}</span>
  </button>`;

/** One tap. The item goes in as it comes (its first size); the button ticks; a toast says so. */
export function addItem(itemId, btn, size, n = 1) {
  const item = byId(itemId);
  if (!item) return;
  haptic([10, 26, 12]);
  const line = addLine(itemId, size || defaultSize(item), n);
  if (btn) { replay(btn, "done"); setTimeout(() => btn.classList.remove("done"), 900); }
  const s = item.sizes.length > 1 ? ` · ${sizeOf(item, line.size).en}` : "";
  toast(`${item.en}${s} in the bag`, { ico: "bag" });
  document.dispatchEvent(new CustomEvent("bag:added", { detail: { itemId } }));
}

/** One listener for the whole app, on the document — views come and go. */
export function wireAdds() {
  if (wireAdds.done) return;
  wireAdds.done = true;
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-add]");
    if (btn) { e.preventDefault(); e.stopPropagation(); addItem(btn.dataset.add, btn); return; }
    const open = e.target.closest("[data-item]");
    if (open && !e.target.closest("a[href]")) { e.preventDefault(); itemSheet(open.dataset.item); }
  });
}

/* ------------------------------------------------------------------ sheet */
let openNow = null;

export function closeSheet() {
  if (!openNow) return;
  const { scrim, sheet, onClose, onKey } = openNow;
  openNow = null;
  document.removeEventListener("keydown", onKey);
  sheet.classList.remove("on");
  scrim.classList.remove("on");
  document.documentElement.classList.remove("sheet-open");
  setTimeout(() => { scrim.remove(); sheet.remove(); onClose?.(); }, reduced() ? 0 : 420);
}
export const sheetOpen = () => !!openNow;

/**
 * A bottom sheet with a grabber, a scrim, swipe-down to close and Escape.
 * body/foot are HTML; mount(sheet) runs once it is in the document.
 */
export function openSheet({ title = "", sub = "", body = "", foot = "", mount, onClose, label, cls = "" } = {}) {
  closeSheet();
  const root = $("#sheet-root");
  const scrim = document.createElement("div");
  scrim.className = "scrim";
  const sheet = document.createElement("section");
  sheet.className = "sheet" + (cls ? " " + cls : "");
  sheet.setAttribute("role", "dialog");
  sheet.setAttribute("aria-modal", "true");
  sheet.setAttribute("aria-label", label || title || "Sheet");
  sheet.innerHTML = `
    <div class="sheet-grab"><i></i></div>
    <button class="sheet-close glassbtn" type="button" aria-label="Close">${icon("close")}</button>
    <div class="sheet-body">
      ${title ? `<h2 class="sheet-title">${title}</h2>` : ""}
      ${sub ? `<p class="sheet-sub">${sub}</p>` : ""}
      ${body}
    </div>
    ${foot ? `<div class="sheet-foot">${foot}</div>` : ""}`;
  root.append(scrim, sheet);
  document.documentElement.classList.add("sheet-open");
  const onKey = (e) => { if (e.key === "Escape") closeSheet(); };
  document.addEventListener("keydown", onKey);
  openNow = { scrim, sheet, onClose, onKey };
  requestAnimationFrame(() => requestAnimationFrame(() => { scrim.classList.add("on"); sheet.classList.add("on"); }));

  scrim.addEventListener("click", closeSheet);
  sheet.querySelector(".sheet-close").addEventListener("click", closeSheet);

  // swipe down on the grabber (or the body when it is scrolled to the top)
  let y0 = null, dy = 0;
  const grab = sheet.querySelector(".sheet-grab");
  const bodyEl = sheet.querySelector(".sheet-body");
  const start = (e) => { y0 = e.touches[0].clientY; dy = 0; sheet.classList.add("drag"); };
  const move = (e) => {
    if (y0 == null) return;
    dy = Math.max(0, e.touches[0].clientY - y0);
    sheet.style.transform = `translateY(${dy}px)`;
  };
  const end = () => {
    sheet.classList.remove("drag");
    sheet.style.transform = "";
    if (dy > 90) closeSheet();
    y0 = null;
  };
  grab.addEventListener("touchstart", start, { passive: true });
  grab.addEventListener("touchmove", move, { passive: true });
  grab.addEventListener("touchend", end);
  bodyEl.addEventListener("touchstart", (e) => { if (bodyEl.scrollTop <= 0) start(e); }, { passive: true });
  bodyEl.addEventListener("touchmove", (e) => { if (y0 != null && bodyEl.scrollTop <= 0) move(e); }, { passive: true });
  bodyEl.addEventListener("touchend", () => { if (y0 != null) end(); });

  mount?.(sheet);
  wireImages(sheet);
  return { sheet, close: closeSheet };
}

/* ------------------------------------------------------------- item sheet */
export function itemSheet(itemId) {
  const item = byId(itemId);
  if (!item) return;
  let n = 1;
  let k = defaultSize(item);
  const sizes = item.sizes.length > 1 ? `
    <div class="sizes" role="radiogroup" aria-label="Size">
      ${item.sizes.map((s) => `
        <button class="size" type="button" role="radio" aria-checked="${s.k === k}" data-k="${s.k}">
          <span class="size-n">${esc(s.en)}</span>
          <span class="size-p">${priceHTML(s.price)}</span>
          ${s.kcal != null ? `<span class="size-k">${s.kcal} kcal</span>` : ""}
        </button>`).join("")}
    </div>` : (item.sizes[0].kcal != null ? `<p class="it-kcal">${item.sizes[0].kcal} kcal</p>` : "");
  const body = `
    <div class="it-hero ${item.img ? "" : "it-hero--none"}">${itemImg(item, { eager: true })}</div>
    <div class="it-head">
      <div class="it-tags">
        ${isNew(item) ? `<span class="tag tag--new">New</span>` : ""}
        ${item.cat === "season" ? `<span class="tag tag--new">This season</span>` : ""}
        <span class="tag">${esc(catName(item.cat))}</span>
      </div>
      <h2 class="it-name">${esc(item.en)}</h2>
      <div class="it-fa fa" lang="fa" dir="rtl">${esc(item.fa)}</div>
      ${item.sizes.length === 1 ? `<div class="it-price">${priceHTML(item.price)}</div>` : ""}
    </div>
    ${sizes}
    ${item.ing ? `
    <div class="it-ing">
      <div class="eyebrow">What's in it</div>
      <p class="fa" lang="fa" dir="rtl">${esc(item.ing)}</p>
    </div>` : ""}
    <p class="it-earn">${icon("bean")}<span id="it-earn"></span></p>`;
  const foot = `
    <div class="it-foot">
      ${qtyHTML(1)}
      <button class="btn btn--wide" type="button" id="it-add"><span>Add to bag</span><span class="btn-sum money" id="it-sum"></span></button>
    </div>`;
  openSheet({
    body, foot, label: item.en, cls: "sheet--item",
    mount(sheet) {
      const sum = sheet.querySelector("#it-sum");
      const earn = sheet.querySelector("#it-earn");
      const paint = () => {
        const p = sizeOf(item, k).price * n;
        sum.textContent = price(p);
        const b = beansFor(p);
        earn.textContent = `${money(b)} ${b === 1 ? CLUB.unit : CLUB.units} with ${CLUB.name}`;
      };
      sheet.querySelectorAll(".size").forEach((b) => b.addEventListener("click", () => {
        k = b.dataset.k;
        haptic(6);
        sheet.querySelectorAll(".size").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
        paint();
      }));
      qty(sheet.querySelector(".qty"), { value: 1, min: 1, max: 9, onChange: (v) => { n = v; paint(); } });
      sheet.querySelector("#it-add").addEventListener("click", () => { addItem(item.id, null, k, n); closeSheet(); });
      paint();
    },
  });
}

/* ------------------------------------------------------------ branches */
export function statusHTML(b, now = new Date()) {
  const s = status(b.hours, now);
  const cls = s.unknown ? "st--none" : s.open ? (s.soon ? "st--soon" : "st--open") : "st--closed";
  return `<span class="st ${cls}"><i></i>${esc(s.label)}</span>${s.detail ? ` <span class="st-d">${esc(s.detail)}</span>` : ""}`;
}

/** Pick a branch. onPick(branch) runs after the choice is saved. */
export function branchSheet({ title = "Choose a Lamiz", sub = "", onPick, withCounts = false, save = true } = {}) {
  const cur = myBranch().id;
  const counts = withCounts ? presence.counts() : null;
  const rowsHTML = (q = "") => {
    const f = fold(q);
    return geo.byDistance().filter(({ b }) => !f || fold(`${b.en} ${b.fa} ${b.city} ${b.address}`).includes(f)).map(({ b, d }) => `
      <li><button class="row row--tap" type="button" data-pick="${b.id}">
        <span class="row-thumb"><img class="fade" src="${b.cover}" alt="" width="44" height="44" loading="lazy" decoding="async"></span>
        <span class="row-t"><span class="row-n">${esc(b.en)} ${b.id === cur ? `<span class="row-cur">${icon("check")}</span>` : ""}</span>
          <span class="row-d">${statusHTML(b)}${d != null ? ` <span class="row-dist">${geo.distText(d)}</span>` : ` <span class="row-dist">${esc(b.city)}</span>`}</span></span>
        ${counts ? `<span class="row-v"><span class="here ${counts[b.id] ? "on" : ""}">${icon("people")}${counts[b.id]}</span></span>` : `<span class="row-v">${icon("chevron")}</span>`}
      </button></li>`).join("") || `<li class="row-empty">No Lamiz matches “${esc(q)}”.</li>`;
  };
  openSheet({
    title, sub, cls: "sheet--tall",
    body: `
      <div class="search search--sheet">${icon("search")}<input type="search" placeholder="Search 41 branches" aria-label="Search branches" autocomplete="off" enterkeyhint="search"></div>
      ${geo.supported() ? `<button class="linkbtn" type="button" data-locate>${icon("locate")}<span>${geo.known() ? "Sorted by distance from you" : "Sort by distance from me"}</span></button>` : ""}
      <ul class="list list--flat" data-rows>${rowsHTML()}</ul>`,
    mount(sheet) {
      const ul = sheet.querySelector("[data-rows]");
      const input = sheet.querySelector("input");
      const wire = () => {
        ul.querySelectorAll("[data-pick]").forEach((btn) => btn.addEventListener("click", () => {
          haptic(8);
          const b = BRANCHES.find((x) => x.id === btn.dataset.pick);
          if (save) setMyBranch(b.id);
          closeSheet();
          onPick?.(b);
        }));
        wireImages(ul);
      };
      input.addEventListener("input", () => { ul.innerHTML = rowsHTML(input.value); wire(); });
      sheet.querySelector("[data-locate]")?.addEventListener("click", async (e) => {
        const btn = e.currentTarget;
        btn.querySelector("span").textContent = "Finding you…";
        try { await geo.locate(); btn.querySelector("span").textContent = "Sorted by distance from you"; ul.innerHTML = rowsHTML(input.value); wire(); }
        catch (err) { btn.querySelector("span").textContent = err.message; }
      });
      wire();
    },
  });
}

/* ----------------------------------------------------------------- images */
/** Fade images in once they have pixels; one that fails retries once, then keeps its tile. */
export function wireImages(root = document) {
  $$("img.fade", root).forEach((im) => {
    if (im.dataset.wired) return;
    im.dataset.wired = "1";
    const ready = () => im.classList.add("ready");
    if (im.complete && im.naturalWidth) { ready(); return; }
    im.addEventListener("load", ready, { once: true });
    im.addEventListener("error", () => {
      if (!im.dataset.retry) { im.dataset.retry = "1"; setTimeout(() => { im.src = im.src.split("?")[0] + "?r=1"; }, 800); }
    });
  });
}

let revealObs = null;
export function observeReveals(root = document) {
  revealObs?.disconnect();
  const items = $$(".rv", root);
  if (!("IntersectionObserver" in window) || reduced()) { items.forEach((el) => el.classList.add("in")); return; }
  revealObs = new IntersectionObserver((entries) => {
    entries.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); revealObs.unobserve(e.target); } });
  }, { rootMargin: "0px 0px -6% 0px", threshold: 0.04 });
  items.forEach((el) => revealObs.observe(el));
}

export const emptyHTML = (title, sub, action = "") => `
  <div class="empty"><span class="empty-mark">${MARK}</span>
    <p class="empty-t">${title}</p><p class="empty-s">${sub}</p>${action}</div>`;

/* ---------------------------------------------------------------- avatars */
/** A face: the photo if there is one, else initials on the person's colour. */
export function avatarHTML({ name = "", photo = "", hue = null, size = 40, me = false, cls = "" } = {}) {
  const h = hue ?? hueOf(name || "?");
  const face = photo ? `<img src="${photo}" alt="" decoding="async">`
    : name ? `<b>${esc(initials(name))}</b>` : icon("profile");
  return `<span class="av av-${h}${me ? " av--me" : ""}${cls ? " " + cls : ""}" style="--s:${size}px" aria-hidden="true">${face}</span>`;
}

/* ------------------------------------------------------ segmented control */
export const segHTML = (name, options, value, cls = "") => `
  <div class="seg ${cls}" role="radiogroup" data-seg="${name}">
    <span class="seg-ink" aria-hidden="true"></span>
    ${options.map((o) => `<button type="button" role="radio" aria-checked="${o.v === value}" data-v="${o.v}">${o.ico ? icon(o.ico) : ""}<span>${esc(o.label)}</span></button>`).join("")}
  </div>`;

/** The pill slides to the chosen segment; onChange(value, event). */
export function wireSeg(seg, onChange) {
  const ink = seg.querySelector(".seg-ink");
  const place = (animate = true) => {
    const on = seg.querySelector('[aria-checked="true"]') || seg.querySelector("button");
    if (!on || !on.offsetWidth) return;
    if (!animate) ink.style.transition = "none";
    ink.style.width = `${on.offsetWidth}px`;
    ink.style.transform = `translateX(${on.offsetLeft - 2}px)`;
    if (!animate) { void ink.offsetWidth; ink.style.transition = ""; }
    seg.dataset.ready = "1";
  };
  seg.addEventListener("click", (e) => {
    const b = e.target.closest("button[data-v]");
    if (!b || b.getAttribute("aria-checked") === "true") return;
    seg.querySelectorAll("button[data-v]").forEach((x) => x.setAttribute("aria-checked", String(x === b)));
    haptic(6); place(); onChange(b.dataset.v, e);
  });
  place(false);
  if ("ResizeObserver" in window) new ResizeObserver(() => place(false)).observe(seg);
  return { place };
}

/* ------------------------------------------------------------ action sheet */
/** iOS-style choices. Each action runs inside the tap, so a file picker may open from it. */
export function actionSheet({ title = "", sub = "", actions = [] } = {}) {
  openSheet({
    title, sub, cls: "sheet--acts",
    body: `<div class="acts">${actions.map((a, i) => a.href
      ? `<a class="act" href="${a.href}" ${a.external ? 'target="_blank" rel="noopener"' : ""} data-i="${i}">${a.ico ? icon(a.ico) : ""}<span>${esc(a.label)}</span></a>`
      : `<button class="act${a.danger ? " act--danger" : ""}" type="button" data-i="${i}">${a.ico ? icon(a.ico) : ""}<span>${esc(a.label)}</span></button>`).join("")}</div>`,
    mount(sheet) {
      sheet.querySelectorAll(".act").forEach((b) => b.addEventListener("click", () => {
        const a = actions[+b.dataset.i];
        setTimeout(closeSheet, a.href ? 60 : 0);
        a.run?.();
      }));
    },
  });
}

/** The same question iOS asks before anything that cannot be undone. */
export function confirmSheet({ title, sub = "", yes = "Confirm", danger = true, onYes }) {
  actionSheet({ title, sub, actions: [{ label: yes, danger, run: onYes }] });
}

/* ---------------------------------------------------------- directions */
export function directionsSheet(b) {
  const links = geo.mapLinks(b).filter((l) => l.id !== "geo" || /android/i.test(navigator.userAgent))
    .filter((l) => l.id !== "apple" || /iphone|ipad|mac/i.test(navigator.userAgent) || true);
  actionSheet({
    title: `Lamiz ${b.en}`, sub: "Open directions in",
    actions: links.map((l) => ({ label: l.label, href: l.href, external: l.id !== "geo", ico: l.id === "google" ? "globe" : "directions" })),
  });
}

export { inBag };
