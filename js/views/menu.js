// The menu — Lamiz's own Tehran menu, all twelve sections, as their site lists them.
// Chips filter (one section, or all of them); search reads English and Persian alike.
// A tap on the plus adds the item in its first size; a tap anywhere else on the row
// opens it — every size with its price and calories, and what's in it.

import { CATEGORIES, ITEMS } from "../data.js";
import { icon } from "../icons.js";
import { esc, money, priceHTML, fold } from "../util.js";
import { inBag, subscribe } from "../store.js";
import { addHTML, itemImg, isNew, itemSheet } from "../ui.js";
import { onLeave } from "../lifecycle.js";

const kcalText = (it) => {
  const k = it.sizes.map((s) => s.kcal).filter((x) => x != null);
  if (!k.length) return "";
  const lo = Math.min(...k), hi = Math.max(...k);
  return lo === hi ? `${lo} kcal` : `${lo}–${hi} kcal`;
};

const row = (it) => `
  <div class="mitem" data-item="${it.id}" data-s="${esc(fold(`${it.en} ${it.fa} ${it.ing}`))}" role="button" tabindex="0"
       aria-label="${esc(it.en)}, ${it.sizes.length > 1 ? "from " : ""}${money(it.price)} Toman">
    <div class="mitem-img ${it.img ? "" : "mitem-img--none"}">${itemImg(it, { size: 148 })}</div>
    <div class="mitem-t">
      <div class="mitem-n"><span>${esc(it.en)}</span>${isNew(it) ? `<span class="tag tag--new">New</span>` : ""}<span class="mcount" data-count="${it.id}" hidden></span></div>
      <div class="mitem-fa fa" lang="fa">${esc(it.fa)}</div>
      <div class="mitem-p">${it.sizes.length > 1 ? `<span class="from">from</span>` : ""}${priceHTML(it.price)}${kcalText(it) ? `<span class="kc">${kcalText(it)}</span>` : ""}</div>
    </div>
    ${addHTML(it)}
  </div>`;

export default function menu(params = {}, q = {}) {
  let cat = CATEGORIES.some((c) => c.id === q.cat) ? q.cat : "all";
  const groups = CATEGORIES.map((c) => ({ c, items: ITEMS.filter((i) => i.cat === c.id) })).filter((g) => g.items.length);

  const html = `
    <div class="wrap">
      <div class="lt-wrap">
        <h1 class="lt">Menu</h1>
        <p class="lt-sub">${ITEMS.length} things on the Tehran menu, as Lamiz lists them. <span class="fa" lang="fa">منو قهوه لمیز</span></p>
      </div>
      <div class="menu-sentinel" aria-hidden="true"></div>
      <div class="menu-top" id="menu-top">
        <label class="search" style="margin-top:0">${icon("search")}
          <input type="search" id="menu-q" placeholder="Search — latte, کیک, matcha…" aria-label="Search the menu" autocomplete="off" enterkeyhint="search">
          <button class="search-x" type="button" id="menu-x" aria-label="Clear search" hidden>${icon("close")}</button>
        </label>
        <div class="chips" id="menu-chips" role="toolbar" aria-label="Sections" style="margin-top:10px">
          <button class="chip" type="button" data-cat="all" aria-pressed="${cat === "all"}">All <small>${ITEMS.length}</small></button>
          ${groups.map(({ c, items }) => `<button class="chip" type="button" data-cat="${c.id}" aria-pressed="${cat === c.id}">${esc(c.en)} <small>${items.length}</small></button>`).join("")}
        </div>
      </div>
      <div class="mlists" id="mlists">
        ${groups.map(({ c, items }) => `
          <section class="mgroup" data-cat="${c.id}" aria-label="${esc(c.en)}">
            <div class="mgroup-h"><h2 class="mgroup-t">${esc(c.en)}</h2><span class="mgroup-fa fa" lang="fa">${esc(c.fa)}</span></div>
            <div class="mlist">${items.map(row).join("")}</div>
          </section>`).join("")}
      </div>
      <p class="menu-empty" id="menu-empty" hidden></p>
      <p class="note">Prices in Toman, from Lamiz's Tehran menu at <a href="https://lamizcoffee.com/lamiz-coffee-menu/" target="_blank" rel="noopener">lamizcoffee.com</a>. Lamiz publishes separate menus for Isfahan, Shiraz, Qom, Kish and the north.</p>
    </div>`;

  function mount(screen) {
    const input = screen.querySelector("#menu-q");
    const clear = screen.querySelector("#menu-x");
    const chips = screen.querySelector("#menu-chips");
    const empty = screen.querySelector("#menu-empty");
    const top = screen.querySelector("#menu-top");
    const rows = [...screen.querySelectorAll(".mitem")];
    const sections = [...screen.querySelectorAll(".mgroup")];

    function apply() {
      const f = fold(input.value);
      clear.hidden = !input.value;
      let shown = 0;
      rows.forEach((r) => {
        const hit = !f || r.dataset.s.includes(f);
        r.hidden = !hit;
      });
      sections.forEach((s) => {
        const any = s.querySelector(".mitem:not([hidden])");
        const inCat = f || cat === "all" || s.dataset.cat === cat;
        s.hidden = !(any && inCat);
        if (!s.hidden) shown += s.querySelectorAll(".mitem:not([hidden])").length;
      });
      empty.hidden = shown > 0;
      if (!shown) empty.textContent = `Nothing on the menu matches “${input.value.trim()}”.`;
    }
    function pick(next, { scroll = true } = {}) {
      cat = next;
      chips.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.cat === cat)));
      const url = `#/menu${cat === "all" ? "" : `?cat=${cat}`}`;
      if (location.hash !== url && location.hash.startsWith("#/menu")) history.replaceState(history.state, "", url);
      apply();
      if (scroll) {
        const y = screen.querySelector(".menu-sentinel").getBoundingClientRect().top + scrollY - 70;
        if (scrollY > y) scrollTo({ top: y, behavior: "instant" });
      }
      chips.querySelector(`[data-cat="${cat}"]`)?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
    }
    chips.addEventListener("click", (e) => {
      const c = e.target.closest(".chip");
      if (!c) return;
      if (input.value) { input.value = ""; }
      pick(c.dataset.cat);
    });
    input.addEventListener("input", () => {
      if (input.value && cat !== "all") { cat = "all"; chips.querySelectorAll(".chip").forEach((c) => c.setAttribute("aria-pressed", String(c.dataset.cat === "all"))); }
      apply();
    });
    clear.addEventListener("click", () => { input.value = ""; apply(); input.focus(); });
    screen.addEventListener("keydown", (e) => {
      if ((e.key === "Enter" || e.key === " ") && e.target.matches(".mitem")) { e.preventDefault(); itemSheet(e.target.dataset.item); }
    });

    // the chips stick under the bar; they take a soft edge once they do
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(([e]) => top.classList.toggle("stuck", !e.isIntersecting), { rootMargin: "-120px 0px 0px 0px" });
      io.observe(screen.querySelector(".menu-sentinel"));
      onLeave(() => io.disconnect());
    }

    // how many of each are in the bag
    const counts = () => screen.querySelectorAll("[data-count]").forEach((b) => {
      const n = inBag(b.dataset.count);
      b.hidden = !n;
      b.textContent = n;
    });
    counts();
    onLeave(subscribe(counts));

    pick(cat, { scroll: false });
    if (params.focus) setTimeout(() => itemSheet(params.focus), 60);
  }

  return { html, mount, cls: "pad-top" };
}
