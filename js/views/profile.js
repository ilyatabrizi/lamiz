// Profile. Who you are to Lamiz: the club card and its code, how far to the next
// tier, what the beans buy, what you've ordered, your details, how you look to other
// people in a room, the app itself — and a way to wipe this phone clean.

import { BUSINESS, CLUB } from "../config.js";
import { branchById } from "../data.js";
import { icon } from "../icons.js";
import { esc, money, dateShort, dateTime, phoneText, telHref } from "../util.js";
import { MONTHS } from "../jalali.js";
import { profile, setProfile, fullName, photo, myHue, member, ladder, balance, orders, isSample, clearSample, seedSample,
         forgetEverything, subscribe, myBranch, REWARDS, TIERS, shownName, bagCount, toggleReward, applied } from "../store.js";
import * as presence from "../presence.js";
import { avatarHTML, segHTML, wireSeg, openSheet, confirmSheet, toast, branchSheet } from "../ui.js";
import { clubCardHTML, memberSheet, tierChip, beansText } from "../club.js";
import { pref, setPref } from "../theme.js";
import { isStandalone, isIOS, canPrompt, promptInstall } from "../install.js";
import { refresh, go } from "../router.js";
import { onLeave } from "../lifecycle.js";
import { toJalali } from "../jalali.js";

const bdayText = (b) => (b ? `${b.jd} ${MONTHS[b.jm - 1]} ${b.jy}` : "Add it for a birthday drink");

export default function profileView() {
  const p = profile();
  const m = member();
  const L = ladder();
  const bal = balance();
  const name = fullName();
  const since = toJalali(new Date(m.joined));
  const hist = m.history.slice(0, 8);
  const recent = orders().slice(0, 5);

  const html = `
    <div class="wrap">
      <div class="lt-wrap" style="padding-top:4px"><h1 class="lt">Profile</h1></div>
      <div class="me" style="margin-top:14px">
        ${avatarHTML({ name: name || "", photo: photo(), hue: myHue(), size: 64 })}
        <div class="me-t"><b>${esc(name || "Welcome to Lamiz")}</b><span>${CLUB.name} member since ${MONTHS[since.jm - 1]} ${since.jy}${isSample() ? ` <span class="tag tag--sample">Sample</span>` : ""}</span></div>
        <a class="glassbtn" href="#/profile/edit" aria-label="Edit your profile">${icon("edit")}</a>
      </div>

      <div id="p-club">${clubCardHTML({ href: "#/profile", id: "profile-club-card" })}</div>
      <div style="margin:10px var(--g) 0"><button class="btn btn--ink btn--block" type="button" id="show-card">${icon("qr")}Show my card at the counter</button></div>

      <section class="sec">
        <div class="sec-h"><div><h2 class="sec-t">Your tier</h2><p class="sec-s">${beansText(L.earned)} collected in the last 12 months.</p></div>${tierChip(L.tier)}</div>
        <div class="ladder">
          <div class="ladder-bar"><i style="width:${Math.min(100, (L.earned / TIERS[TIERS.length - 1].min) * 100).toFixed(1)}%"></i></div>
          <div class="ladder-stops">${TIERS.map((t) => `<div class="ladder-stop ${t.id === L.tier.id ? "on" : ""}"><b>${esc(t.en)}</b>${t.min ? `${money(t.min)} beans` : "From the first order"}</div>`).join("")}</div>
          <ul class="perks">${L.tier.perks.map((x) => `<li>${icon("check")}<span>${esc(x)}</span></li>`).join("")}</ul>
          ${L.next ? `<p class="small" style="margin-top:12px">${money(L.toNext)} more beans this year and you're <b>${esc(L.next.en)}</b>: ${esc(L.next.perks[0].toLowerCase())}.</p>` : ""}
        </div>
      </section>

      <section class="sec">
        <div class="sec-h"><div><h2 class="sec-t">What beans buy</h2><p class="sec-s">Spend them in the bag, on anything they cover.</p></div></div>
        <div class="rewards">
          ${REWARDS.map((r) => `
            <div class="reward ${bal >= r.cost ? "" : "off"} ${applied().includes(r.id) ? "on" : ""}">
              <span class="reward-ico">${icon(r.ico)}</span>
              <span class="reward-t"><b>${esc(r.en)}</b><span>${bal >= r.cost ? esc(r.sub) : `${money(r.cost - bal)} more beans`}</span></span>
              <span class="reward-c">${icon("bean")}${money(r.cost)}</span>
              ${bal >= r.cost ? `<button class="btn btn--sm ${applied().includes(r.id) ? "btn--ink" : "btn--quiet"}" type="button" data-use="${r.id}">${applied().includes(r.id) ? "In bag" : "Use"}</button>` : ""}
            </div>`).join("")}
        </div>
        <p class="note">${CLUB.name} is Alpha's proposal for this preview: one bean for every ${money(1 / CLUB.perToman)} T, ${CLUB.welcome} to begin with. Lamiz sets the real numbers.</p>
      </section>

      ${hist.length ? `
      <div class="list-h eyebrow">Beans, lately</div>
      <ul class="list">
        ${hist.map((h) => `<li><div class="row">
          <span class="row-ico ${h.type === "welcome" ? "row-ico--or" : ""}">${icon(h.type === "welcome" ? "gift" : "bag")}</span>
          <span class="row-t"><span class="row-n">${h.type === "welcome" ? "Welcome to the club" : `Order ${esc(h.code)}${h.branch ? `, ${esc(branchById(h.branch)?.en || "")}` : ""}`}</span><span class="row-d">${dateShort(h.at)}${h.total ? `, ${money(h.total)} T` : ""}</span></span>
          <span class="row-v"><span class="hist-amt plus">+${money(h.earn || 0)}</span>${h.spend ? `<span class="hist-amt">−${money(h.spend)}</span>` : ""}</span>
        </div></li>`).join("")}
      </ul>` : ""}

      ${recent.length ? `
      <div class="list-h eyebrow">Orders</div>
      <ul class="list">
        ${recent.map((o) => `<li><a class="row row--tap" href="#/order/${o.id}"><span class="row-ico">${icon("ticket")}</span>
          <span class="row-t"><span class="row-n">${esc(o.lines.map((l) => l.name).slice(0, 2).join(", "))}${o.lines.length > 2 ? ` +${o.lines.length - 2}` : ""}</span><span class="row-d">${dateTime(o.at)}, ${esc(branchById(o.branch)?.en || "")}</span></span>
          <span class="row-v">${money(o.total)} T${icon("chevron")}</span></a></li>`).join("")}
      </ul>` : ""}

      <div class="list-h eyebrow">Your details</div>
      <ul class="list">
        <li><a class="row row--tap" href="#/profile/edit"><span class="row-ico">${icon("idcard")}</span><span class="row-t"><span class="row-n">${esc(name || "Add your name")}</span><span class="row-d">${p.phone ? esc(p.phone) : "Name, photo, phone, birthday"}</span></span><span class="row-v">${icon("chevron")}</span></a></li>
        <li><a class="row row--tap" href="#/profile/edit"><span class="row-ico">${icon("gift")}</span><span class="row-t"><span class="row-n">Birthday</span><span class="row-d">${esc(bdayText(p.bday))}</span></span><span class="row-v">${icon("chevron")}</span></a></li>
        <li><button class="row row--tap" type="button" id="usual"><span class="row-ico">${icon("pin")}</span><span class="row-t"><span class="row-n">Your Lamiz</span><span class="row-d">${esc(myBranch().en)}, for pickup and check-in</span></span><span class="row-v">Change${icon("chevron")}</span></button></li>
      </ul>

      <div class="list-h eyebrow">In a check-in room, others see</div>
      <div style="margin:0 var(--g)">${segHTML("appear", [{ v: "first", label: "First name" }, { v: "initials", label: "Initials" }, { v: "hidden", label: "Nothing" }], p.appear)}</div>
      <p class="note" style="margin-top:8px">Right now: <b>${esc(shownName() || (p.appear === "hidden" ? "Someone" : "your name, once you add it"))}</b>.</p>

      <div class="list-h eyebrow">Appearance</div>
      <div style="margin:0 var(--g)">${segHTML("theme", [{ v: "system", label: "System", ico: "auto" }, { v: "light", label: "Light", ico: "sun" }, { v: "dark", label: "Dark", ico: "moon" }], pref())}</div>

      <div class="list-h eyebrow">Lamiz</div>
      <ul class="list">
        ${isStandalone() ? "" : `<li><button class="row row--tap" type="button" id="install"><span class="row-ico row-ico--ink">${icon("download")}</span><span class="row-t"><span class="row-n">Add Lamiz to your home screen</span><span class="row-d">Opens full screen, like an app</span></span><span class="row-v">${icon("chevron")}</span></button></li>`}
        <li><button class="row row--tap" type="button" id="about"><span class="row-ico">${icon("info")}</span><span class="row-t"><span class="row-n">About Lamiz</span><span class="row-d">Since ${BUSINESS.since}, from green coffee to the cup</span></span><span class="row-v">${icon("chevron")}</span></button></li>
        <li><a class="row row--tap" href="${telHref(BUSINESS.phone)}"><span class="row-ico">${icon("phone")}</span><span class="row-t"><span class="row-n">Head office</span><span class="row-d">${phoneText(BUSINESS.phone)}, ${esc(BUSINESS.officeHours)}</span></span><span class="row-v">${icon("chevron")}</span></a></li>
        <li><a class="row row--tap" href="mailto:${BUSINESS.email}"><span class="row-ico">${icon("mail")}</span><span class="row-t"><span class="row-n">${BUSINESS.email}</span><span class="row-d">Suggestions and feedback</span></span><span class="row-v">${icon("chevron")}</span></a></li>
        <li><a class="row row--tap" href="${BUSINESS.instagramUrl}" target="_blank" rel="noopener"><span class="row-ico">${icon("instagram")}</span><span class="row-t"><span class="row-n">@${BUSINESS.instagram}</span><span class="row-d">Instagram</span></span><span class="row-v">${icon("arrowUpRight")}</span></a></li>
        <li><a class="row row--tap" href="${BUSINESS.siteUrl}" target="_blank" rel="noopener"><span class="row-ico">${icon("globe")}</span><span class="row-t"><span class="row-n">${BUSINESS.site}</span><span class="row-d">Beans, capsules and Monin syrups to take home</span></span><span class="row-v">${icon("arrowUpRight")}</span></a></li>
      </ul>

      <div class="list-h eyebrow">This phone</div>
      <ul class="list">
        ${isSample() ? `<li><button class="row row--tap" type="button" id="clear-sample"><span class="row-ico row-ico--or">${icon("sparkle")}</span><span class="row-t"><span class="row-n">Clear the sample account</span><span class="row-d">A made-up regular, so the club can be seen working</span></span></button></li>`
          : `<li><button class="row row--tap" type="button" id="load-sample"><span class="row-ico">${icon("sparkle")}</span><span class="row-t"><span class="row-n">Load a sample account</span><span class="row-d">Four months of orders, to see the club at work</span></span></button></li>`}
        <li><button class="row row--tap" type="button" id="forget"><span class="row-ico">${icon("trash")}</span><span class="row-t"><span class="row-n" style="color:var(--red)">Forget everything on this phone</span><span class="row-d">Bag, orders, beans, profile, check-ins</span></span></button></li>
      </ul>

      <div class="alpha"><img class="al-b" src="assets/brand/alpha-black.png" alt="" width="52" height="26"><img class="al-w" src="assets/brand/alpha-white.png" alt="" width="52" height="26"><span class="alpha-t">Powered by<b>Alpha Agency</b></span></div>
    </div>`;

  function mount(screen) {
    screen.querySelector("#show-card").addEventListener("click", memberSheet);
    screen.querySelector("#profile-club-card")?.addEventListener("click", (e) => { e.preventDefault(); memberSheet(); });
    screen.querySelectorAll("[data-use]").forEach((btn) => btn.addEventListener("click", () => {
      const id = btn.dataset.use;
      if (!applied().includes(id)) toggleReward(id);
      if (!bagCount()) { toast("Add something it covers, and it applies itself", { ico: "bean" }); go("#/menu"); }
      else go("#/bag");
    }));
    screen.querySelector("#usual").addEventListener("click", () => branchSheet({ title: "Your Lamiz", sub: "Where you pick up and check in, unless you choose otherwise." }));
    wireSeg(screen.querySelector('[data-seg="appear"]'), (v) => {
      setProfile({ appear: v });
      presence.rename(shownName(), myHue(), v === "hidden" ? "" : photo());
    });
    wireSeg(screen.querySelector('[data-seg="theme"]'), (v, e) => setPref(v, { x: e.clientX, y: e.clientY }));
    screen.querySelector("#install")?.addEventListener("click", async () => {
      if (canPrompt()) { const r = await promptInstall(); if (r === "accepted") toast("Lamiz is on your home screen"); return; }
      openSheet({
        title: "Add to home screen",
        sub: isIOS() ? "In Safari, two taps:" : "In your browser's menu:",
        body: `<ol class="install-steps">${isIOS()
          ? `<li><b>1</b><span>Tap <b>Share</b> ${icon("share", ' style="width:18px;height:18px;display:inline;vertical-align:-3px"')} at the bottom of Safari.</span></li><li><b>2</b><span>Choose <b>Add to Home Screen</b>.</span></li>`
          : `<li><b>1</b><span>Open the browser menu <b>⋮</b>.</span></li><li><b>2</b><span>Choose <b>Install app</b> or <b>Add to Home screen</b>.</span></li>`}</ol>`,
      });
    });
    screen.querySelector("#about").addEventListener("click", () => openSheet({
      title: "About Lamiz",
      body: `<div class="about">
        <p>Lamiz began with a university thesis. Its founder, studying for an MBA at Royal Roads University, wrote it with Sharif University on building a coffee culture in a tea-drinking Iran. A year later, in ${BUSINESS.since}, the first Lamiz opened on Tajrish Square.</p>
        <p>The beans are bought green from farms around the world, sampled by Lamiz's own research team, and roasted in its own factory to a recipe for each bean — ${BUSINESS.greenToCup.charAt(0).toLowerCase() + BUSINESS.greenToCup.slice(1)}</p>
        <p>Today there are ${BUSINESS.branches} branches and ${BUSINESS.snappfood} more on Snappfood, with more than ${BUSINESS.baristas} baristas. Every one is run by Lamiz itself — there are no franchises. Lamiz is also Iran's exclusive agent for Monin syrups.</p>
        <span class="fa" lang="fa">${BUSINESS.taglineFa}.</span>
        <p class="tiny" style="margin-top:14px">From lamizcoffee.com/about-us.</p></div>`,
    }));
    screen.querySelector("#clear-sample")?.addEventListener("click", () => confirmSheet({ title: "Clear the sample account?", sub: "Its orders and beans go. Your bag and profile stay.", yes: "Clear sample", onYes: () => { clearSample(); toast("Sample cleared — you start with 50 beans"); refresh(); } }));
    screen.querySelector("#load-sample")?.addEventListener("click", () => { seedSample(); toast("Sample account loaded", { ico: "sparkle" }); refresh(); });
    screen.querySelector("#forget").addEventListener("click", () => confirmSheet({
      title: "Forget everything?", sub: "The bag, orders, beans, your profile and check-ins leave this phone. This can't be undone.", yes: "Forget everything",
      onYes: () => { presence.checkOut(); presence.forgetVisits(); forgetEverything(); toast("This phone is clean"); go("#/"); },
    }));
    onLeave(subscribe(() => { screen.querySelector("#p-club").innerHTML = clubCardHTML({ href: "#/profile", id: "profile-club-card" }); screen.querySelector("#profile-club-card")?.addEventListener("click", (e) => { e.preventDefault(); memberSheet(); }); }));
  }

  return { html, mount, cls: "pad-top" };
}
