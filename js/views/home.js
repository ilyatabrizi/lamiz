// Home. The reel full-bleed on a phone, framed beside the headline on a big screen —
// never with words laid over it. Under it, a sheet that rises over the film: the
// greeting in their own words, three ways in, the club card, their four bakery
// photographs (in a new order on every visit), the season, the espresso bar, what is
// new, and the story of a thesis that became 41 cafés.

import { BUSINESS } from "../config.js";
import { ITEMS, PHOTOS, branchById, byId } from "../data.js";
import { LOCKUP } from "../brand.js";
import { icon } from "../icons.js";
import { esc, priceHTML, shuffle } from "../util.js";
import { greeting, status } from "../hours.js";
import { profile, myBranch, subscribe } from "../store.js";
import * as presence from "../presence.js";
import * as geo from "../geo.js";
import { addHTML, itemImg, statusHTML, isNew, avatarHTML } from "../ui.js";
import { clubCardHTML } from "../club.js";
import { onLeave } from "../lifecycle.js";

export const tileHTML = (it) => `
  <div class="tile" data-item="${it.id}" role="button" tabindex="0" aria-label="${esc(it.en)}">
    <div class="tile-img">${itemImg(it)}${isNew(it) ? `<span class="tag tag--new">New</span>` : ""}${addHTML(it)}</div>
    <div class="tile-n">${esc(it.en)}</div>
    <div class="tile-fa fa" lang="fa">${esc(it.fa)}</div>
    <div class="tile-p">${it.sizes.length > 1 ? `<span class="from">from </span>` : ""}${priceHTML(it.price)}</div>
  </div>`;

const ESPRESSO_BAR = ["latte", "cappuccino", "persian-latte", "caramel-macchiato", "mocha", "cortado", "espresso", "americano"];

function quickHTML() {
  const b = myBranch();
  const near = geo.nearest();
  const room = presence.list(b.id);
  const mine = presence.me();
  const n = room.length;
  const spot = near?.b || b;
  const st = status(spot.hours);
  return `
    <a class="qcard qcard--order" href="#/menu">
      <span class="qcard-ico">${icon("cup")}</span>
      <span><span class="qcard-t">Order ahead</span><span class="qcard-d">Pick up at ${esc(b.en)}</span></span>
    </a>
    <a class="qcard" href="#/checkin" id="q-ci">
      ${n ? `<span class="faces">${room.slice(-3).map((p) => avatarHTML({ name: p.name, hue: p.hue, photo: p.photo, size: 26 })).join("")}</span>` : ""}
      <span class="qcard-ico">${icon("checkin")}</span>
      <span><span class="qcard-t">${mine ? "You're in" : "Check in"}</span>
        <span class="qcard-d">${mine ? `at ${esc(branchById(mine.branch)?.en || b.en)}` : n ? `${n} at ${esc(b.en)} now` : st.open || !b.hours ? "Be the first in" : `${esc(b.en)} is closed`}</span></span>
    </a>
    <a class="qcard qcard--wide" href="#/branch/${spot.id}">
      <span class="qcard-ico">${icon(near ? "locate" : "pin")}</span>
      <span class="qcard-body"><span class="qcard-t">${near ? "Nearest Lamiz" : "Your Lamiz"}: ${esc(spot.en)}</span>
        <span class="qcard-d">${statusHTML(spot)}${near?.d != null ? ` · ${geo.distText(near.d)}` : ""}</span></span>
    </a>`;
}

export default function home() {
  const p = profile();
  const photos = shuffle(PHOTOS);                          // "random images": a new order every visit
  const season = ITEMS.filter((i) => i.cat === "season");
  const bar = ESPRESSO_BAR.map(byId).filter(Boolean);
  const fresh = ITEMS.filter((i) => isNew(i) && i.cat !== "season" && i.img).slice(0, 10);
  const tajrish = branchById("tajrish-monin");
  const hi = `${greeting()}${p.first ? `, ${esc(p.first)}` : ""}`;

  const html = `
    <section class="hero" data-over aria-label="Inside the Lamiz bakery">
      <div class="hero-frame" aria-hidden="true"></div>
      <div class="hero-side">
        <div class="hs-logo">${LOCKUP}</div>
        <h1 class="hs-t">We are Lamiz Coffee, and we <em>love</em> what we do.</h1>
        <p class="hs-fa fa" lang="fa">${BUSINESS.taglineFa}</p>
        <div class="btnrow"><a class="btn" href="#/menu">Order ahead</a><a class="btn btn--glass" href="#/checkin">Check in</a></div>
      </div>
      <div class="hero-media" id="hero-media">
        <img class="hero-poster" src="assets/video/poster.webp" alt="" width="720" height="1280" fetchpriority="high">
        <video class="hero-video" id="hero-video" muted playsinline loop preload="auto" poster="assets/video/poster.webp" disableremoteplayback>
          <source src="assets/video/hero.mp4" type="video/mp4">
        </video>
        <button class="glassbtn hero-ctl" id="hero-ctl" type="button" aria-label="Pause the film">${icon("pause")}</button>
      </div>
    </section>

    <div class="home-sheet"><div class="wrap">
      <div class="intro">
        <p class="intro-hi">${hi}</p>
        <h2 class="intro-t">We are Lamiz Coffee, and we <em>love</em> what we do.</h2>
        <p class="intro-fa fa" lang="fa">${BUSINESS.taglineFa}</p>
      </div>

      <div class="quick" id="quick">${quickHTML()}</div>
      <div id="home-club">${clubCardHTML({ id: "home-club-card" })}</div>

      <section class="sec">
        <div class="sec-h"><div><h2 class="sec-t">From the Lamiz bakery</h2><p class="sec-s">Freshly baked cakes and pastries.</p></div>
          <a class="sec-link" href="#/menu?cat=bakery">Cakes${icon("chevron")}</a></div>
        <div class="rail" id="bakery">
          ${photos.map((ph, i) => `
            <a class="photo" href="#/menu?cat=bakery" data-photo="${ph.key}" aria-label="Lamiz cakes and pastries, photograph ${i + 1} of ${photos.length}">
              <img class="fade" src="${ph.src}" alt="" width="${ph.w}" height="${ph.h}" ${i ? 'loading="lazy"' : ""} decoding="async">
            </a>`).join("")}
        </div>
      </section>

      ${season.length ? `
      <section class="sec">
        <div class="sec-h"><div><h2 class="sec-t">This season</h2><p class="sec-s">Lamiz's summer promotion, at every branch.</p></div>
          <a class="sec-link" href="#/menu?cat=season">All${icon("chevron")}</a></div>
        <div class="tiles">${season.map(tileHTML).join("")}</div>
      </section>` : ""}

      <section class="sec">
        <div class="sec-h"><div><h2 class="sec-t">The espresso bar</h2><p class="sec-s">Single or double, small to large.</p></div>
          <a class="sec-link" href="#/menu?cat=hot">Hot drinks${icon("chevron")}</a></div>
        <div class="tiles">${bar.map(tileHTML).join("")}</div>
      </section>

      ${fresh.length ? `
      <section class="sec">
        <div class="sec-h"><div><h2 class="sec-t">New at Lamiz</h2><p class="sec-s">Added to the menu in the last few months.</p></div></div>
        <div class="tiles">${fresh.map(tileHTML).join("")}</div>
      </section>` : ""}

      <section class="story rv">
        <div class="story-img"><img class="fade" src="${tajrish.cover}" alt="The first Lamiz, on Tajrish Square" loading="lazy" decoding="async"></div>
        <div class="story-body">
          <div class="eyebrow">Since ${BUSINESS.since}</div>
          <h2 class="story-t">It began as a thesis about coffee in a country of tea.</h2>
          <p class="story-p">Lamiz's founder wrote his MBA thesis at Royal Roads University, with Sharif University, on building a coffee culture in Iran. A year later the first Lamiz opened on Tajrish Square.</p>
          <p class="story-p">The beans are bought green, straight from farms around the world, and roasted in Lamiz's own factory — ${BUSINESS.greenToCup.charAt(0).toLowerCase() + BUSINESS.greenToCup.slice(1)}</p>
          <div class="numbers">
            <div class="num"><b>${BUSINESS.branches}</b><span>branches across Iran</span></div>
            <div class="num"><b>${BUSINESS.snappfood}</b><span>more on Snappfood</span></div>
            <div class="num"><b>${BUSINESS.baristas}+</b><span>baristas in the family</span></div>
            <div class="num"><b>${BUSINESS.since}</b><span>the year it began, in Tajrish</span></div>
          </div>
        </div>
      </section>

      <a class="ig rv" href="${BUSINESS.instagramUrl}" target="_blank" rel="noopener">
        <span class="ig-ico">${icon("instagram")}</span>
        <span class="ig-t"><b>@${BUSINESS.instagram}</b><span>New drinks and cakes, first on Instagram</span></span>
        ${icon("arrowUpRight")}
      </a>

      <div class="alpha"><img class="al-b" src="assets/brand/alpha-black.png" alt="" width="52" height="26"><img class="al-w" src="assets/brand/alpha-white.png" alt="" width="52" height="26"><span class="alpha-t">Powered by<b>Alpha Agency</b></span></div>
    </div></div>`;

  function mount(screen) {
    wireVideo(screen);
    const quick = screen.querySelector("#quick");
    const club = screen.querySelector("#home-club");
    const repaint = () => { quick.innerHTML = quickHTML(); club.innerHTML = clubCardHTML({ id: "home-club-card" }); };
    onLeave(presence.subscribe(() => { quick.innerHTML = quickHTML(); }));
    onLeave(subscribe(repaint));
    onLeave(geo.subscribe(() => { quick.innerHTML = quickHTML(); }));
  }

  return { html, mount, cls: "home" };
}

/* ------------------------------------------------------------------ the reel */
// Muted as a property before play() — the attribute alone is not enough on a video
// created by innerHTML. Retried on metadata, on canplay, on the first touch and on
// coming back to the tab; paused while it is off screen; a play button if it is refused.
function wireVideo(screen) {
  const media = screen.querySelector("#hero-media");
  const v = screen.querySelector("#hero-video");
  const ctl = screen.querySelector("#hero-ctl");
  if (!v) return;
  v.muted = true; v.defaultMuted = true; v.playsInline = true;
  v.setAttribute("muted", ""); v.setAttribute("playsinline", ""); v.setAttribute("webkit-playsinline", "");
  let userPaused = false;

  const setCtl = (playing) => {
    ctl.innerHTML = icon(playing ? "pause" : "play");
    ctl.setAttribute("aria-label", playing ? "Pause the film" : "Play the film");
  };
  function showPlay() {
    if (userPaused || !v.paused || media.querySelector(".hero-play")) return;
    const b = document.createElement("button");
    b.className = "hero-play"; b.type = "button"; b.setAttribute("aria-label", "Play the film");
    b.innerHTML = icon("play");
    b.addEventListener("click", () => { v.muted = true; v.play().catch(() => {}); });
    media.append(b);
  }
  const tryPlay = () => {
    if (userPaused || !v.isConnected) return;
    v.muted = true;
    const p = v.play();
    if (p && p.catch) p.catch(() => showPlay());
  };
  v.addEventListener("playing", () => { media.classList.add("playing"); setCtl(true); media.querySelector(".hero-play")?.remove(); });
  v.addEventListener("pause", () => setCtl(false));
  v.addEventListener("loadedmetadata", tryPlay, { once: true });
  v.addEventListener("canplay", tryPlay, { once: true });
  const gesture = () => tryPlay();
  const EV = ["pointerdown", "touchstart", "keydown"];
  EV.forEach((ev) => addEventListener(ev, gesture, { once: true, passive: true }));
  const vis = () => { if (document.visibilityState === "visible") tryPlay(); };
  document.addEventListener("visibilitychange", vis);
  ctl.addEventListener("click", () => {
    if (v.paused) { userPaused = false; tryPlay(); }
    else { userPaused = true; v.pause(); }
  });
  // off screen it pauses — battery and data — and picks up again on the way back
  const io = "IntersectionObserver" in window ? new IntersectionObserver(([e]) => {
    if (e.isIntersecting) tryPlay(); else if (!v.paused) v.pause();
  }, { threshold: .12 }) : null;
  io?.observe(media);
  const late = setTimeout(() => { if (v.paused && !userPaused) showPlay(); }, 3000);
  onLeave(() => {
    clearTimeout(late); io?.disconnect();
    document.removeEventListener("visibilitychange", vis);
    EV.forEach((ev) => removeEventListener(ev, gesture));
    v.pause();
    v.querySelectorAll("source").forEach((s) => s.remove());
    v.load();
  });
  tryPlay();
}
