// Check in. Their Tajrish branch hangs a light-up L on its brick wall; here that L is
// the button. Tap it and the bulbs come on, top of the stem to the end of the foot —
// you're in for an hour, and the bulbs go out one by one as the hour runs down (one
// per three minutes). Below it, everyone else who is in: first names (or initials, or
// nothing — each person chooses), when they arrived, and a wave.

import { CHECKIN } from "../config.js";
import { BULBS, BULB_R, MARK_VIEWBOX, MARK_PATH } from "../brand.js";
import { branchById } from "../data.js";
import { icon } from "../icons.js";
import { esc, ago, ordinal } from "../util.js";
import { myBranch, setMyBranch, shownName, myHue, photo, profile, subscribe } from "../store.js";
import * as presence from "../presence.js";
import * as geo from "../geo.js";
import { status } from "../hours.js";
import { avatarHTML, branchSheet, statusHTML, toast } from "../ui.js";
import { haptic, reduced } from "../motion.js";
import { onLeave, every } from "../lifecycle.js";
import { refresh } from "../router.js";

const [, , VW, VH] = MARK_VIEWBOX.split(" ").map(Number);
const per = (CHECKIN.holdMinutes / BULBS.length) * 60000;           // ms each bulb stands for
const litFor = (mine) => (mine ? Math.max(1, Math.min(BULBS.length, Math.ceil((mine.until - Date.now()) / per))) : 0);

const marqueeSVG = () => `
  <svg viewBox="${MARK_VIEWBOX}" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="bulbGlow" cx="42%" cy="38%" r="62%">
        <stop offset="0" stop-color="#FFFCEF"/><stop offset=".42" stop-color="#FFD98A"/><stop offset="1" stop-color="#FF8A2A"/>
      </radialGradient>
      <filter id="glow" x="-200%" y="-200%" width="500%" height="500%" color-interpolation-filters="sRGB">
        <feGaussianBlur in="SourceGraphic" stdDeviation="${(BULB_R * .9).toFixed(1)}" result="b"/>
        <feColorMatrix in="b" type="matrix" values="1 0 0 0 0  0 .72 0 0 0  0 0 .3 0 0  0 0 0 1.4 0" result="warm"/>
        <feMerge><feMergeNode in="warm"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <g class="l-wrap">
      <path class="l-body" fill-rule="evenodd" d="${MARK_PATH}"/>
      ${BULBS.map(([x, y], i) => `<circle class="bulb" style="--i:${i}" cx="${x}" cy="${y}" r="${BULB_R}"/>`).join("")}
    </g>
  </svg>`;

function roomHTML(b, mine) {
  const room = presence.list(b.id);
  const me = presence.myId();
  const st = status(b.hours);
  if (!room.length) {
    return `<div class="room-empty">${st.open || st.unknown ? `No one has checked in at Lamiz ${esc(b.en)} in the last hour. Be the first.` : `Lamiz ${esc(b.en)} is closed — ${esc(st.detail)}.`}</div>`;
  }
  return room.slice().reverse().map((p) => {
    const isMe = p.id === me;
    const name = isMe ? "You" : p.name || "Someone";
    const face = isMe ? avatarHTML({ name: shownName() || "You", photo: photo(), hue: myHue(), size: 40, me: true })
      : avatarHTML({ name: p.name || "?", hue: p.hue, photo: p.photo, size: 40 });
    const w = presence.waved(p.id);
    return `
      <div class="person${p._new ? " new" : ""}" data-person="${p.id}">
        ${face}
        <div class="person-t"><b>${esc(name)}</b><span>${isMe ? `Checked in ${ago(p.at)}` : `Arrived ${ago(p.at)}`}</span></div>
        ${isMe ? "" : `<button class="wave ${w ? "done" : ""}" type="button" data-wave="${p.id}" data-name="${esc(p.name || "them")}" ${w ? "disabled" : ""}>${icon("hand")}<span>${w ? "Waved" : "Wave"}</span></button>`}
      </div>`;
  }).join("");
}

export default function checkin() {
  const mine = presence.me();
  // if you are checked in somewhere, that is the branch this screen is about
  const b = (mine && branchById(mine.branch)) || myBranch();
  const st = status(b.hours);
  // A closed branch still takes a check-in — people sit down before the shutters go up
  // and the hour runs out on its own. The room stays empty of demo faces while it is
  // closed, so the app never invents a crowd at three in the morning.
  const at = geo.atBranch(geo.known(), CHECKIN.nearMeters);
  const n = presence.list(b.id).length;

  const html = `
    <div class="wrap">
      <div class="lt-wrap"><h1 class="lt">Check in</h1><p class="lt-sub">One tap. It lasts an hour, then it lets go.</p></div>

      <button class="ci-branch" type="button" id="ci-branch" ${mine ? "disabled" : ""} aria-label="Branch: Lamiz ${esc(b.en)}${mine ? "" : ", change"}">
        <span class="ci-branch-img"><img class="fade" src="${b.cover}" alt="" width="52" height="52" decoding="async"></span>
        <span class="ci-branch-t"><b>Lamiz ${esc(b.en)}</b><span>${statusHTML(b)}</span></span>
        ${mine ? "" : `<span class="ci-branch-c">Change</span>`}
      </button>
      ${!mine && at && at.id !== b.id ? `<div class="near">${icon("locate")}<span>Looks like you're at Lamiz ${esc(at.en)}.</span><button type="button" id="use-near">Use it</button></div>` : ""}
      ${!mine && !geo.known() && geo.supported() ? `<div style="margin:6px var(--g) 0"><button class="linkbtn" type="button" id="find-me">${icon("locate")}<span>Find the Lamiz I'm in</span></button></div>` : ""}

      <button class="marquee" id="marquee" type="button" data-in="${mine ? 1 : 0}" style="--ar:${(VW / VH).toFixed(4)}"
        aria-label="${mine ? `Checked in at Lamiz ${esc(b.en)}` : `Check in at Lamiz ${esc(b.en)}`}">
        ${marqueeSVG()}
      </button>

      <div class="ci-state" id="ci-state"></div>
      <div class="ci-actions" id="ci-actions"></div>

      <section class="room">
        <div class="room-h"><h2 class="room-t">Here now</h2><span class="room-live" id="room-live"><i></i><span>${n} ${n === 1 ? "person" : "people"}</span></span></div>
        <div class="room-list" id="room">${roomHTML(b, mine)}</div>
        <p class="note" style="margin-left:4px;margin-right:4px">Others see you as <b>${esc(shownName() || "your first name, once you add it")}</b>. Change that in <a href="#/profile">Profile</a>. Rooms show check-ins from the last hour only.</p>
      </section>
    </div>`;

  function mount(screen) {
    const mq = screen.querySelector("#marquee");
    const bulbs = [...mq.querySelectorAll(".bulb")];
    const stateEl = screen.querySelector("#ci-state");
    const acts = screen.querySelector("#ci-actions");
    const roomEl = screen.querySelector("#room");
    const live = screen.querySelector("#room-live span");
    let lighting = false;

    const setLit = (k) => bulbs.forEach((el, i) => el.classList.toggle("lit", i < k));

    function paintState() {
      const me = presence.me();
      if (me && me.branch === b.id) {
        const left = Math.max(0, Math.ceil((me.until - Date.now()) / 60000));
        const v = presence.visitsThisMonth();
        stateEl.innerHTML = `<b>You're in at ${esc(b.en)}</b><span>${left} min left${v > 1 ? `. Your ${ordinal(v)} visit this month` : ""}.</span>`;
        acts.innerHTML = `<button class="btn btn--quiet" type="button" id="extend">${icon("clock")}Another hour</button><button class="btn btn--line" type="button" id="out">Check out</button>`;
        acts.querySelector("#extend").addEventListener("click", () => { haptic(8); presence.extend(); toast("Another hour, on the house", { ico: "clock" }); });
        acts.querySelector("#out").addEventListener("click", () => { haptic(8); presence.checkOut(); toast(`Checked out of ${b.en}`); refresh(); });
        if (!lighting) setLit(litFor(me));
      } else {
        const people = presence.list(b.id).length;
        const now = status(b.hours);
        const line = people ? `${people} ${people === 1 ? "person is" : "people are"} at Lamiz ${esc(b.en)} right now.`
          : now.open || now.unknown ? `Nobody's in at ${esc(b.en)} yet.`
          : `Lamiz ${esc(b.en)} is closed — ${esc(now.detail)}.`;
        stateEl.innerHTML = `<b>Tap the L to check in</b><span>${line}</span>`;
        acts.innerHTML = "";
        setLit(0);
      }
    }
    function paintRoom() {
      const rows = presence.list(b.id);
      live.textContent = `${rows.length} ${rows.length === 1 ? "person" : "people"}`;
      roomEl.innerHTML = roomHTML(b, presence.me());
    }

    mq.addEventListener("click", () => {
      if (presence.me() || lighting) return;
      lighting = true;
      const p = profile();
      presence.checkIn({ branchId: b.id, name: shownName(p), hue: myHue(), photo: p.appear === "hidden" ? "" : photo() });
      haptic([14, 40, 20]);
      mq.dataset.in = "1";
      mq.setAttribute("aria-disabled", "true");
      mq.setAttribute("aria-label", `Checked in at Lamiz ${b.en}`);
      screen.querySelector("#ci-branch").disabled = true;
      screen.querySelector("#ci-branch .ci-branch-c")?.remove();
      // the bulbs come on in order, as a marquee sign's do
      const step = reduced() ? 0 : 42;
      bulbs.forEach((el, i) => setTimeout(() => el.classList.add("lit"), i * step));
      setTimeout(() => { lighting = false; paintState(); }, bulbs.length * step + 60);
      paintState();
      paintRoom();
      const mine = roomEl.querySelector(`[data-person="${presence.myId()}"]`);
      mine?.classList.add("new");
      toast(`You're in at Lamiz ${b.en}`, { ico: "checkin" });
    });

    roomEl.addEventListener("click", (e) => {
      const w = e.target.closest("[data-wave]");
      if (!w) return;
      haptic(8);
      presence.wave(w.dataset.wave);
      toast(`You waved at ${w.dataset.name}`, { ico: "hand" });
    });

    screen.querySelector("#ci-branch").addEventListener("click", () => {
      if (presence.me()) return;
      branchSheet({ title: "Where are you?", sub: "People checked in at each branch right now.", withCounts: true, onPick: () => refresh() });
    });
    screen.querySelector("#use-near")?.addEventListener("click", () => { setMyBranch(at.id); refresh(); });
    screen.querySelector("#find-me")?.addEventListener("click", async (e) => {
      const btn = e.currentTarget;
      btn.querySelector("span").textContent = "Finding you…";
      try {
        const pos = await geo.locate();
        const here = geo.atBranch(pos, CHECKIN.nearMeters);
        const n0 = geo.nearest(pos);
        if (here) { setMyBranch(here.id); toast(`You're at Lamiz ${here.en}`, { ico: "locate" }); }
        else if (n0) { setMyBranch(n0.b.id); toast(`Nearest is Lamiz ${n0.b.en}, ${geo.distText(n0.d)} away`, { ico: "locate" }); }
        refresh();
      } catch (err) { btn.querySelector("span").textContent = err.message; }
    });

    paintState();
    onLeave(presence.subscribe(() => { paintRoom(); if (!lighting) paintState(); }));
    onLeave(subscribe(() => paintRoom()));
    every(20000, () => { paintRoom(); if (!lighting) paintState(); });
  }

  return { html, mount, cls: "pad-top" };
}
