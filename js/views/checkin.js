// Check in. One tap when you sit down: the disc fills, your hour starts, and you join
// the room below. Which Lamiz you are in is chosen above; how you appear to everyone
// else is set in Profile. "Check out" leaves early — otherwise the hour lets go by
// itself, so no list can go stale in a way that embarrasses anybody.

import { CHECKIN } from "../config.js";
import { branchById } from "../data.js";
import { icon } from "../icons.js";
import { esc, ago, ordinal, clamp } from "../util.js";
import { myBranch, setMyBranch, shownName, myHue, photo, profile, subscribe } from "../store.js";
import * as presence from "../presence.js";
import * as geo from "../geo.js";
import { status } from "../hours.js";
import { avatarHTML, branchSheet, statusHTML, toast } from "../ui.js";
import { haptic, replay } from "../motion.js";
import { onLeave, every } from "../lifecycle.js";
import { refresh } from "../router.js";

const minsLeft = (until, now = Date.now()) => Math.max(0, Math.ceil((until - now) / 60000));
const clock = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const hm = (t) => clock.format(new Date(t));
const herePhrase = (n, en) => (n === 0 ? `Nobody's in at ${en} yet` : n === 1 ? "1 person is here" : `${n} people are here`);

const personHTML = (p, me, fresh) => {
  const isMe = p.id === me;
  const name = isMe ? "You" : p.name || "Someone";
  const w = presence.waved(p.id);
  return `
    <li class="person${isMe ? " person--me" : ""}${fresh ? " arrive" : ""}" data-person="${esc(p.id)}">
      ${isMe ? avatarHTML({ name: shownName() || "You", photo: photo(), hue: myHue(), size: 42, me: true })
             : avatarHTML({ name: p.name || "?", hue: p.hue, photo: p.photo, size: 42 })}
      <span class="person-t">
        <span class="person-n">${esc(name)}${isMe ? `<span class="you">You</span>` : ""}</span>
        <span class="person-d">${isMe ? `Checked in ${ago(p.at)}` : `Arrived ${ago(p.at)}`}</span>
      </span>
      ${isMe ? "" : `<button class="wave${w ? " done" : ""}" type="button" data-wave="${esc(p.id)}" data-name="${esc(p.name || "them")}"${w ? " disabled" : ""}>${icon("hand")}<span>${w ? "Waved" : "Wave"}</span></button>`}
    </li>`;
};

export default function checkin() {
  const mine = presence.me();
  // if you are checked in somewhere, that is the branch this screen is about
  const b = (mine && branchById(mine.branch)) || myBranch();
  const at = geo.atBranch(geo.known(), CHECKIN.nearMeters);

  const html = `
    <div class="wrap">
      <div class="lt-wrap">
        <h1 class="lt">Check in</h1>
        <p class="lt-sub">One tap when you sit down. It lasts an hour, then lets go by itself.</p>
      </div>

      <button class="ci-branch" type="button" id="ci-branch"${mine ? " disabled" : ""} aria-label="Branch: Lamiz ${esc(b.en)}${mine ? "" : ", change"}">
        <span class="ci-branch-img"><img class="fade" src="${b.cover}" alt="" width="52" height="52" decoding="async"></span>
        <span class="ci-branch-t"><b>Lamiz ${esc(b.en)}</b><span>${statusHTML(b)}</span></span>
        ${mine ? "" : `<span class="ci-branch-c">Change</span>`}
      </button>
      ${!mine && at && at.id !== b.id ? `<div class="near">${icon("locate")}<span>Looks like you're at Lamiz ${esc(at.en)}.</span><button type="button" id="use-near">Use it</button></div>` : ""}
      ${!mine && !geo.known() && geo.supported() ? `<div style="margin:6px var(--g) 0"><button class="linkbtn" type="button" id="find-me">${icon("locate")}<span>Find the Lamiz I'm in</span></button></div>` : ""}

      <section class="ci-stage" id="stage" data-in="${mine ? 1 : 0}">
        <button class="disc" id="disc" type="button">
          <span class="disc-waves" aria-hidden="true"><i></i><i></i><i></i></span>
          <svg class="disc-ring" viewBox="0 0 200 200" aria-hidden="true">
            <circle class="disc-track" cx="100" cy="100" r="94"/>
            <circle class="disc-fill" id="disc-fill" cx="100" cy="100" r="94" pathLength="1000"/>
          </svg>
          <span class="disc-face"><span class="disc-ico" id="disc-ico"></span><span class="disc-l" id="disc-l"></span></span>
        </button>
        <h2 class="ci-title" id="ci-title"></h2>
        <p class="ci-sub" id="ci-sub"></p>
        <div class="ci-acts" id="ci-acts" hidden>
          <button class="btn btn--quiet" type="button" id="extend">${icon("clock")}Another hour</button>
          <button class="btn btn--line" type="button" id="out">Check out</button>
        </div>
      </section>

      <section class="room">
        <div class="room-h"><h2 class="room-t">Here now</h2><span class="room-live" id="room-live"><i></i><span></span></span></div>
        <ul class="room-list" id="room"></ul>
        <p class="note" style="margin-left:4px;margin-right:4px" id="ci-foot"></p>
      </section>
    </div>`;

  function mount(screen) {
    const $ = (s) => screen.querySelector(s);
    const stage = $("#stage"), disc = $("#disc"), fill = $("#disc-fill");
    const ico = $("#disc-ico"), lab = $("#disc-l"), title = $("#ci-title"), sub = $("#ci-sub");
    const acts = $("#ci-acts"), roomEl = $("#room"), live = $("#room-live span"), foot = $("#ci-foot");
    let seen = null, wasIn = null;

    function paint() {
      const now = Date.now();
      const me = presence.me();
      const inHere = !!(me && me.branch === b.id);
      const people = presence.list(b.id, now);
      const others = people.filter((p) => p.id !== presence.myId()).length;

      if (inHere !== wasIn) { ico.innerHTML = icon(inHere ? "check" : "checkin"); wasIn = inHere; }
      stage.dataset.in = inHere ? "1" : "0";
      acts.hidden = !inHere;

      if (inHere) {
        const left = minsLeft(me.until, now);
        const visits = presence.visitsThisMonth();
        lab.textContent = `${left} min left`;
        fill.style.strokeDashoffset = String(1000 - Math.round(clamp(left / CHECKIN.holdMinutes, 0, 1) * 1000));
        title.textContent = `You're in at ${b.en}`;
        sub.textContent = `Until ${hm(me.until)}. ${others ? `${others} other${others === 1 ? "" : "s"} here` : "The first one here"}${visits > 1 ? `, your ${ordinal(visits)} visit this month` : ""}.`;
        disc.setAttribute("aria-label", `Checked in at Lamiz ${b.en}, ${left} minutes left`);
      } else {
        const st = status(b.hours);
        lab.textContent = "Tap to check in";
        fill.style.strokeDashoffset = "1000";
        title.textContent = herePhrase(others, b.en);
        sub.textContent = others ? "Check in to join them."
          : st.open || st.unknown ? "Be the first — tap when you sit down."
          : `Lamiz ${b.en} is closed, ${st.detail}.`;
        disc.setAttribute("aria-label", `Check in at Lamiz ${b.en}`);
      }

      live.textContent = `${people.length} ${people.length === 1 ? "person" : "people"}`;
      roomEl.innerHTML = people.length
        ? people.slice().reverse().map((p) => personHTML(p, presence.myId(), !!seen && !seen.has(p.id))).join("")
        : `<li class="room-empty">When people check in at ${esc(b.en)}, they show up here.</li>`;
      seen = new Set(people.map((p) => p.id));
      foot.innerHTML = `${profile().appear === "hidden" ? "You're hidden from the room." : `The room sees you as <b>${esc(shownName() || "your first name, once you add it")}</b>.`} `
        + `<a href="#/profile">Change it in Profile</a>. Rooms show the last hour only, and the other guests are a demo room until Lamiz's own is connected.`;
    }

    disc.addEventListener("click", () => {
      if (presence.me()) { replay(stage, "nudge"); haptic(6); return; }
      const p = profile();
      presence.checkIn({ branchId: b.id, name: shownName(p), hue: myHue(), photo: p.appear === "hidden" ? "" : photo() });
      haptic([14, 50, 22]);
      replay(stage, "burst");
      $("#ci-branch").disabled = true;
      $("#ci-branch .ci-branch-c")?.remove();
      toast(`You're in at Lamiz ${b.en}`, { ico: "checkin" });
      paint();
    });
    acts.querySelector("#extend").addEventListener("click", () => {
      const m = presence.extend();
      if (m) { haptic(8); toast(`Held until ${hm(m.until)}`, { ico: "clock" }); }
    });
    acts.querySelector("#out").addEventListener("click", () => {
      presence.checkOut(); haptic(10); toast(`Checked out of ${b.en}`); refresh();
    });
    roomEl.addEventListener("click", (e) => {
      const w = e.target.closest("[data-wave]");
      if (!w) return;
      haptic(8);
      presence.wave(w.dataset.wave);
      toast(`You waved at ${w.dataset.name}`, { ico: "hand" });
    });
    $("#ci-branch").addEventListener("click", () => {
      if (presence.me()) return;
      branchSheet({ title: "Where are you?", sub: "People checked in at each branch right now.", withCounts: true, onPick: () => refresh() });
    });
    $("#use-near")?.addEventListener("click", () => { setMyBranch(at.id); refresh(); });
    $("#find-me")?.addEventListener("click", async (e) => {
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

    paint();
    onLeave(presence.subscribe(paint));
    onLeave(subscribe(paint));
    every(20000, paint);
  }

  return { html, mount, cls: "pad-top" };
}
