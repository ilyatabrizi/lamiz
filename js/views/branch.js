// One branch: its own photographs, its name in both languages, open or closed now, the
// four things people do from a place card (call, get there, check in, order here),
// who is in, the address as Lamiz writes it, and the week's hours.

import { BUSINESS } from "../config.js";
import { branchById } from "../data.js";
import { icon } from "../icons.js";
import { esc, phoneText, telHref } from "../util.js";
import { setMyBranch } from "../store.js";
import * as presence from "../presence.js";
import * as geo from "../geo.js";
import { lines, todayIndex } from "../hours.js";
import { statusHTML, avatarHTML, directionsSheet, emptyHTML, toast } from "../ui.js";
import { isNewBranch } from "./branches.js";
import { onLeave } from "../lifecycle.js";
import { go } from "../router.js";

export default function branch({ id }) {
  const b = branchById(id);
  if (!b) return { cls: "pad-top", html: emptyHTML("No such branch", "It may have moved or closed.", `<a class="btn" href="#/branches">All branches</a>`) };
  const pics = b.photos.length ? b.photos : [{ src: b.cover, w: 520, h: 520 }];
  const pos = geo.known();
  const d = pos && b.lat != null ? geo.km(pos, b) : null;
  const hours = lines(b.hours);
  const ti = todayIndex(b.hours);

  const roomHTML = () => {
    const room = presence.list(b.id);
    return room.length
      ? `<a class="row row--tap" href="#/checkin" id="b-room"><span class="faces">${room.slice(-4).map((p) => avatarHTML({ name: p.name, hue: p.hue, photo: p.photo, size: 30 })).join("")}</span>
          <span class="row-t"><span class="row-n">${room.length} ${room.length === 1 ? "person" : "people"} here now</span><span class="row-d">Checked in within the hour</span></span><span class="row-v">${icon("chevron")}</span></a>`
      : `<a class="row row--tap" href="#/checkin" id="b-room"><span class="row-ico">${icon("people")}</span><span class="row-t"><span class="row-n">No one checked in</span><span class="row-d">Be the first in the room</span></span><span class="row-v">${icon("chevron")}</span></a>`;
  };

  const html = `
    <section class="gal" data-over aria-label="Inside Lamiz ${esc(b.en)}">
      <div class="gal-track" id="gal">
        ${pics.map((p, i) => `<figure><img class="fade" src="${p.src}" alt="" width="${p.w}" height="${p.h}" ${i ? 'loading="lazy"' : ""} decoding="async"></figure>`).join("")}
      </div>
      ${pics.length > 1 ? `<div class="gal-dots" aria-hidden="true">${pics.map((_, i) => `<i class="${i ? "" : "on"}"></i>`).join("")}</div>` : ""}
    </section>
    <div class="bd-sheet"><div class="wrap">
      <div class="bd-head">
        <h1 class="bd-t" data-title="${esc(b.en)}">Lamiz ${esc(b.en)}</h1>
        <div class="bd-fa fa" lang="fa">قهوه لمیز، شعبه ${esc(b.fa)}</div>
        <div class="bd-st">${statusHTML(b)}<span class="small">${esc(b.city)}${d != null ? `, ${geo.distText(d)} away` : ""}</span>${isNewBranch(b) ? `<span class="tag tag--new">New</span>` : ""}</div>
      </div>

      <div class="acts4">
        <a class="act4" href="${telHref(b.phone)}">${icon("phone")}<span>Call</span></a>
        <button class="act4" type="button" id="b-dir">${icon("directions")}<span>Directions</span></button>
        <button class="act4" type="button" id="b-ci">${icon("checkin")}<span>Check in</span></button>
        <button class="act4" type="button" id="b-order">${icon("bag")}<span>Order here</span></button>
      </div>

      <ul class="list" style="margin-top:12px"><li id="b-room-li">${roomHTML()}</li></ul>

      <div class="list-h eyebrow">Address</div>
      <div class="addr">
        <p class="fa" lang="fa">${esc(b.address)}</p>
        <div class="addr-foot"><button class="linkbtn" type="button" id="b-copy">${icon("copy")}<span>Copy address</span></button><button class="linkbtn" type="button" id="b-dir2">${icon("directions")}<span>Open in maps</span></button></div>
      </div>

      <div class="list-h eyebrow">Hours, Tehran time</div>
      <div class="hours">
        ${hours.length ? hours.map(([days, t], i) => `<div class="hours-row ${i === ti ? "today" : ""}"><span>${esc(days)}</span><span>${esc(t)}</span></div>`).join("")
          : `<div class="hours-row"><span>Not listed on lamizcoffee.com</span><span></span></div>`}
        ${b.hoursFa ? `<div class="hours-fa fa" lang="fa">${esc(b.hoursFa)}</div>` : ""}
      </div>

      <div class="list-h eyebrow">Contact</div>
      <ul class="list">
        <li><a class="row row--tap" href="${telHref(b.phone)}"><span class="row-ico">${icon("phone")}</span><span class="row-t"><span class="row-n">${esc(phoneText(b.phone))}</span><span class="row-d">${b.phone.ext ? "Head office line, then the branch's extension" : "The branch"}</span></span><span class="row-v">${icon("chevron")}</span></a></li>
        <li><a class="row row--tap" href="${BUSINESS.instagramUrl}" target="_blank" rel="noopener"><span class="row-ico">${icon("instagram")}</span><span class="row-t"><span class="row-n">@${BUSINESS.instagram}</span><span class="row-d">Instagram</span></span><span class="row-v">${icon("arrowUpRight")}</span></a></li>
        <li><a class="row row--tap" href="https://lamizcoffee.com/branches/${b.id}/" target="_blank" rel="noopener"><span class="row-ico">${icon("globe")}</span><span class="row-t"><span class="row-n">This branch on lamizcoffee.com</span><span class="row-d">Where these details come from</span></span><span class="row-v">${icon("arrowUpRight")}</span></a></li>
      </ul>
    </div></div>`;

  function mount(screen) {
    const track = screen.querySelector("#gal");
    const dots = [...screen.querySelectorAll(".gal-dots i")];
    if (dots.length) {
      const onScroll = () => {
        const i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth));
        dots.forEach((dd, k) => dd.classList.toggle("on", k === i));
      };
      track.addEventListener("scroll", onScroll, { passive: true });
    }
    const dir = () => directionsSheet(b);
    screen.querySelector("#b-dir").addEventListener("click", dir);
    screen.querySelector("#b-dir2").addEventListener("click", dir);
    screen.querySelector("#b-ci").addEventListener("click", () => {
      if (presence.me() && presence.me().branch !== b.id) { toast("Check out of your current branch first"); go("#/checkin"); return; }
      setMyBranch(b.id); go("#/checkin");
    });
    screen.querySelector("#b-order").addEventListener("click", () => { setMyBranch(b.id); toast(`Pickup set to Lamiz ${b.en}`, { ico: "bag" }); go("#/menu"); });
    screen.querySelector("#b-copy").addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(`قهوه لمیز، شعبه ${b.fa} — ${b.address}`); toast("Address copied", { ico: "copy" }); }
      catch { toast("Copy isn't allowed here — press and hold the address instead"); }
    });
    const li = screen.querySelector("#b-room-li");
    onLeave(presence.subscribe(() => { li.innerHTML = roomHTML(); }));
  }

  return { html, mount, cls: "branch" };
}
