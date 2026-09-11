// Branches — all 41, with their own addresses, hours and phone numbers. Grouped by
// region, or, once the phone has shared where it is, nearest first. Open or closed is
// worked out in Tehran time; the headcount is the check-in room.

import { BUSINESS } from "../config.js";
import { BRANCHES, REGIONS } from "../data.js";
import { icon } from "../icons.js";
import { esc, fold } from "../util.js";
import * as presence from "../presence.js";
import * as geo from "../geo.js";
import { statusHTML, toast } from "../ui.js";
import { onLeave } from "../lifecycle.js";
import { query, refresh } from "../router.js";

const NEW_DAYS = 120;
export const isNewBranch = (b, now = Date.now()) => now - Date.parse(b.added) < NEW_DAYS * 86400000;

const rowHTML = (b, d, counts) => `
  <a class="brow" href="#/branch/${b.id}" data-b="${b.id}" data-s="${esc(fold(`${b.en} ${b.fa} ${b.city} ${b.address} ${b.region}`))}" data-r="${esc(b.region)}">
    <span class="brow-img"><img class="fade" src="${b.cover}" alt="" width="64" height="64" loading="lazy" decoding="async"></span>
    <span class="brow-t">
      <span class="brow-n">${esc(b.en)}${isNewBranch(b) ? ` <span class="tag tag--new">New</span>` : ""}</span>
      <span class="brow-fa fa" lang="fa">${esc(b.address)}</span>
      <span class="brow-m">${statusHTML(b)}${d != null ? `<span>${geo.distText(d)}</span>` : `<span>${esc(b.city)}</span>`}<span class="here ${counts[b.id] ? "on" : ""}" title="Checked in now">${icon("people")}${counts[b.id]}</span></span>
    </span>
  </a>`;

export default function branches() {
  const q0 = query();
  let region = REGIONS.includes(q0.r) ? q0.r : "All";
  const counts = presence.counts();
  const pos = geo.known();
  const near = geo.nearest(pos);

  const listHTML = () => {
    const pos2 = geo.known();
    if (pos2) {
      return `<div class="blist">${geo.byDistance(pos2).map(({ b, d }) => rowHTML(b, d, counts)).join("")}</div>`;
    }
    return REGIONS.map((r) => {
      const list = BRANCHES.filter((b) => b.region === r);
      return `<div class="region" data-region="${esc(r)}"><div class="region-h"><b>${esc(r)}</b><span>${list.length} ${list.length === 1 ? "branch" : "branches"}</span></div>
        <div class="blist">${list.map((b) => rowHTML(b, null, counts)).join("")}</div></div>`;
    }).join("");
  };

  const html = `
    <div class="wrap">
      <div class="lt-wrap"><h1 class="lt">Branches</h1><p class="lt-sub">${BUSINESS.branches} across Iran, and ${BUSINESS.snappfood} more on Snappfood. <span class="fa" lang="fa">شعبه‌های قهوه لمیز</span></p></div>
      <label class="search">${icon("search")}<input type="search" id="b-q" placeholder="Search — Vanak, تجریش, Kish…" aria-label="Search branches" autocomplete="off" enterkeyhint="search"><button class="search-x" type="button" id="b-x" aria-label="Clear search" hidden>${icon("close")}</button></label>
      <div class="chips" id="b-chips" style="margin-top:12px" role="toolbar" aria-label="Regions">
        ${geo.supported() ? `<button class="chip" type="button" id="near-me" aria-pressed="${!!pos}">${icon("locate")}<span>${pos ? "Near me" : "Near me"}</span></button>` : ""}
        <button class="chip" type="button" data-r="All" aria-pressed="${region === "All"}">All <small>${BRANCHES.length}</small></button>
        ${REGIONS.map((r) => `<button class="chip" type="button" data-r="${esc(r)}" aria-pressed="${region === r}">${esc(r)} <small>${BRANCHES.filter((b) => b.region === r).length}</small></button>`).join("")}
      </div>
      ${near && near.d != null ? `
        <a class="bnear" href="#/branch/${near.b.id}" id="bnear">
          <div class="bnear-img"><img class="fade" src="${near.b.photos[0]?.src || near.b.cover}" alt="" loading="lazy" decoding="async"><span class="tag tag--ink">Nearest to you</span></div>
          <div class="bnear-body"><div class="bnear-t">Lamiz ${esc(near.b.en)}</div>
            <div class="bnear-d">${statusHTML(near.b)}<span>${geo.distText(near.d)} away</span><span class="here ${counts[near.b.id] ? "on" : ""}">${icon("people")}${counts[near.b.id]} here now</span></div></div>
        </a>` : ""}
      <div id="b-list">${listHTML()}</div>
      <p class="menu-empty" id="b-empty" hidden></p>
      <p class="note">Addresses, hours and phone numbers are Lamiz's own, from <a href="https://lamizcoffee.com/branches/" target="_blank" rel="noopener">lamizcoffee.com/branches</a>. Open and closed are worked out in Tehran time; public holidays follow Friday hours. <a href="${BUSINESS.snappfoodUrl}" target="_blank" rel="noopener">Order on Snappfood</a>.</p>
    </div>`;

  function mount(screen) {
    const input = screen.querySelector("#b-q");
    const clear = screen.querySelector("#b-x");
    const chips = screen.querySelector("#b-chips");
    const empty = screen.querySelector("#b-empty");

    function apply() {
      const f = fold(input.value);
      clear.hidden = !input.value;
      let shown = 0;
      screen.querySelectorAll(".brow").forEach((r) => {
        const hit = (!f || r.dataset.s.includes(f)) && (f || region === "All" || r.dataset.r === region);
        r.hidden = !hit;
        if (hit) shown++;
      });
      screen.querySelectorAll(".region").forEach((g) => { g.hidden = !g.querySelector(".brow:not([hidden])"); });
      empty.hidden = shown > 0;
      if (!shown) empty.textContent = `No Lamiz matches “${input.value.trim()}”.`;
      const nb = screen.querySelector("#bnear");
      if (nb) nb.hidden = !!f || region !== "All";
    }
    chips.addEventListener("click", async (e) => {
      const c = e.target.closest(".chip");
      if (!c) return;
      if (c.id === "near-me") {
        c.querySelector("span").textContent = "Finding you…";
        try { await geo.locate(); c.setAttribute("aria-pressed", "true"); refresh(); }
        catch (err) { toast(err.message, { ico: "locate" }); c.querySelector("span").textContent = "Near me"; }
        return;
      }
      region = c.dataset.r;
      chips.querySelectorAll("[data-r]").forEach((x) => x.setAttribute("aria-pressed", String(x.dataset.r === region)));
      const url = region === "All" ? "#/branches" : `#/branches?r=${encodeURIComponent(region)}`;
      history.replaceState(history.state, "", url);
      apply();
    });
    input.addEventListener("input", apply);
    clear.addEventListener("click", () => { input.value = ""; apply(); input.focus(); });
    onLeave(presence.subscribe(() => {
      const c = presence.counts();
      screen.querySelectorAll(".brow").forEach((r) => {
        const h = r.querySelector(".here");
        const n = c[r.dataset.b] || 0;
        h.classList.toggle("on", n > 0);
        h.lastChild.textContent = n;
      });
    }));
    apply();
  }

  return { html, mount, cls: "pad-top" };
}
