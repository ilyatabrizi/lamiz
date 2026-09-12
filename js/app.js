// Wiring. Routes, the chrome, and the handful of things that must stay in step with
// state whichever screen is up: the bag badge and accessory, the check-in chip, the
// tab lens, the bar over photographs.

import { CLUB } from "./config.js";
import { MARK, WORD } from "./brand.js";
import { initTheme } from "./theme.js";
import { $, money, price } from "./util.js";
import { icon } from "./icons.js";
import { route, startRouter, path } from "./router.js";
import { bagCount, subscribe, prefs, seedSample, myBranch, photo, quote } from "./store.js";
import * as presence from "./presence.js";
import { runBoot } from "./boot.js";
import { initTabs, paintTabs, expandTabs, setTabFace, tabIcons } from "./tabs.js";
import { wireAdds, wireImages, observeReveals, closeSheet } from "./ui.js";
import { replay } from "./motion.js";

import home from "./views/home.js";
import menu from "./views/menu.js";
import bagView from "./views/bag.js";
import orderView from "./views/order.js";
import checkin from "./views/checkin.js";
import branches from "./views/branches.js";
import branch from "./views/branch.js";
import profileView from "./views/profile.js";
import profileEdit from "./views/profile-edit.js";

/* ----------------------------------------------------------------- routes */
route("/", home);
route("/menu", menu);
route("/item/:id", ({ id }, q) => menu({ focus: id }, q));
route("/bag", bagView);
route("/order/:id", orderView);
route("/checkin", checkin);
route("/branches", branches);
route("/branch/:id", branch);
route("/profile", profileView);
route("/profile/edit", profileEdit);

/* ------------------------------------------------------------- the chrome */
const bar = $("#bar");
const barTitle = $("#bar-title");
const back = $("#bar-back");
const homeLink = $(".bar-home");
const chip = $("#ci-chip");
const nav = $("#tabs");
const bagbtn = $("#bagbtn");
const badge = $("#bag-badge");
const acc = $("#acc");

$("#bar-mark").innerHTML = MARK;
$("#bar-word").innerHTML = WORD;
back.innerHTML = icon("chevronL");
$("#bag-ico").innerHTML = icon("bag");
$("#acc-chev").innerHTML = icon("chevron");

initTabs();

const rootOf = (p) => "/" + (p.split("/")[1] || "");
const TAB_FOR = { "/": "home", "/menu": "menu", "/item": "menu", "/checkin": "checkin", "/branches": "branches", "/branch": "branches", "/profile": "profile" };
const TITLES = { "/menu": "Menu", "/item": "Menu", "/bag": "Bag", "/order": "Your order", "/checkin": "Check in", "/branches": "Branches", "/profile": "Profile", "/profile/edit": "Edit profile" };
// screens one level down get a back button instead of the logo
const pushed = (p) => ["/order", "/branch"].includes(rootOf(p)) || p === "/profile/edit";

/* ---------------------------------------------------------------- the bag */
let lastCount = bagCount();
function paintBag() {
  const n = bagCount();
  badge.textContent = n > 9 ? "9+" : n;
  badge.classList.toggle("on", n > 0);
  if (n > lastCount) replay(badge, "bump");
  lastCount = n;
  bagbtn.setAttribute("aria-label", n ? `Bag, ${n} ${n === 1 ? "item" : "items"}` : "Bag, empty");
  const p = rootOf(path() || "/");
  const show = n > 0 && p !== "/bag" && p !== "/order" && path() !== "/profile/edit";
  if (show) {
    const q = quote();
    $("#acc-n").textContent = n;
    $("#acc-sum").textContent = price(q.total);
    $("#acc-beans").innerHTML = `${icon("bean")}+${money(q.earn)} ${q.earn === 1 ? CLUB.unit : CLUB.units}`;
  }
  acc.hidden = !show;
  document.documentElement.classList.toggle("has-acc", show);
}
subscribe(paintBag);

/* ------------------------------------------------- your face on the Profile tab */
let shownPhoto = null;
function paintYou() {
  const ph = photo();
  if (ph === shownPhoto) return;
  shownPhoto = ph;
  setTabFace("profile", ph ? `<span class="tab-av"><img src="${ph}" alt=""></span>` : tabIcons("profile"));
}
subscribe(paintYou);
paintYou();

/* ----------------------------------------------------------- the check-in */
function paintChip() {
  const p = rootOf(path() || "/");
  chip.hidden = p === "/checkin" || p === "/bag" || p === "/order" || path() === "/profile/edit";
  const mine = presence.me();
  const label = $("#ci-chip-label");
  if (!mine) {
    const b = myBranch();
    const n = presence.counts()[b.id] || 0;
    chip.dataset.in = "0";
    chip.dataset.live = n ? "1" : "0";
    label.textContent = n ? `${n} at ${b.en.replace(/ \(.*\)$/, "")}` : "Check in";
    chip.setAttribute("aria-label", n ? `${n} people at Lamiz ${b.en} — check in` : "Check in");
    return;
  }
  const left = Math.max(0, Math.ceil((mine.until - Date.now()) / 60000));
  chip.dataset.in = "1";
  label.textContent = `You're in · ${left} min`;
  chip.setAttribute("aria-label", `Checked in, ${left} minutes left`);
}
chip.addEventListener("click", () => { location.hash = "#/checkin"; });
presence.subscribe(paintChip);
subscribe(paintChip);
setInterval(paintChip, 30000);

/* --------------------------------------------------------- scroll and title */
// Recomputed on every render as well as on scroll: replacing the DOM fires no scroll
// event, and a short page must not inherit the bar the long one earned.
let lt = null, over = null, ticking = false;
function chrome() {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => {
    ticking = false;
    const scrollable = document.documentElement.scrollHeight - innerHeight > 40;
    const barBottom = bar.getBoundingClientRect().bottom;
    const isOver = !!over && over.getBoundingClientRect().bottom > barBottom + 8;
    bar.classList.toggle("over", isOver);
    bar.classList.toggle("solid", !isOver && scrollable && scrollY > 8);
    const titled = !!lt && lt.getBoundingClientRect().bottom < barBottom - 4;
    bar.classList.toggle("titled", titled);
  });
}
addEventListener("scroll", chrome, { passive: true });
addEventListener("resize", chrome);

/* ------------------------------------------------------------ after render */
document.addEventListener("view:rendered", (e) => {
  const p = e.detail.path;
  const screen = e.detail.screen;
  closeSheet();
  paintTabs(TAB_FOR[rootOf(p)] ?? null);
  expandTabs();                                  // going anywhere opens a folded bar
  bagbtn.setAttribute("aria-current", rootOf(p) === "/bag" ? "page" : "false");
  paintBag();
  paintChip();
  lt = screen.querySelector(".lt, .bd-t");
  over = screen.querySelector("[data-over]");
  barTitle.textContent = screen.querySelector("[data-title]")?.dataset.title || TITLES[p] || TITLES[rootOf(p)] || "";
  const sub = pushed(p);
  back.hidden = !sub;
  homeLink.hidden = sub;
  bar.classList.remove("solid", "titled");
  observeReveals(screen);
  wireImages(screen);
  chrome();
  const label = barTitle.textContent;
  document.title = label ? `${label} · Lamiz Coffee` : "Lamiz Coffee";
});
back.addEventListener("click", () => (history.length > 1 ? history.back() : (location.hash = "#/")));

/* -------------------------------------------------------------------- go */
initTheme();
wireAdds();
if (!prefs().seeded) seedSample();
runBoot(startRouter());

if ("serviceWorker" in navigator && !["localhost", "127.0.0.1"].includes(location.hostname) && !location.search.includes("nosw")) {
  addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
}
