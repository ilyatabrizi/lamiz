// The order, once sent: four digits the counter can read back, the same as a QR code,
// a ring that runs down to "ready", and the beans it earned.

import { icon } from "../icons.js";
import { esc, money, price, priceHTML, dateTime, pad2 } from "../util.js";
import { orderById, ladder } from "../store.js";
import { branchById } from "../data.js";
import { qrSVG } from "../qr.js";
import { emptyHTML, statusHTML, directionsSheet } from "../ui.js";
import { beansText, tierChip } from "../club.js";
import { every } from "../lifecycle.js";

const R = 58, C = 2 * Math.PI * R;

export default function orderView({ id }) {
  const o = orderById(id);
  if (!o) {
    return { cls: "pad-top", html: emptyHTML("Order not found", "It may have been placed on another phone.", `<a class="btn" href="#/menu">See the menu</a>`) };
  }
  const b = branchById(o.branch) || { en: "Lamiz", hours: null, address: "" };
  const L = ladder();
  const html = `
    <div class="wrap">
      <div class="order-top">
        <div class="order-ok">${icon("check")}</div>
        <h1 class="order-h lt" data-title="Order ${o.code}">${o.sample ? "A past order" : "Order sent"}</h1>
        <p class="order-s">${o.sample ? `From the sample account, ${dateTime(o.at)}.` : `Lamiz ${esc(b.en)} has it. Show this code at the counter.`}</p>
      </div>

      <div class="ticket">
        <div>
          <div class="ticket-l">Pickup code</div>
          <div class="ticket-code" id="code">${o.code}</div>
          <div class="small" style="margin-top:8px">Lamiz ${esc(b.en)}</div>
        </div>
        <div class="ticket-qr" aria-label="Order ${o.code} as a QR code">${qrSVG(`LAMIZ:ORDER:${o.code}:${o.branch}`, { quiet: 1, fg: "#111113", bg: "#ffffff", label: `Order ${o.code}` })}</div>
      </div>

      <div class="ring" aria-live="polite">
        <svg viewBox="0 0 132 132" aria-hidden="true"><circle class="ring-bg" cx="66" cy="66" r="${R}"/><circle class="ring-fg" id="ring" cx="66" cy="66" r="${R}" stroke-dasharray="${C.toFixed(1)}" stroke-dashoffset="${C.toFixed(1)}"/></svg>
        <div class="ring-t"><div><b id="ring-t">--:--</b><span id="ring-s">until ready</span></div></div>
      </div>
      <div class="steps"><span class="step on" id="s1">Sent</span><span class="step" id="s2">Being made</span><span class="step" id="s3">Ready</span></div>

      <div class="list-h eyebrow">Pick up at</div>
      <ul class="list">
        <li><a class="row row--tap" href="#/branch/${o.branch}">
          <span class="row-ico row-ico--ink">${icon("pin")}</span>
          <span class="row-t"><span class="row-n">Lamiz ${esc(b.en)}</span><span class="row-d">${b.hours !== undefined ? statusHTML(b) : ""}</span></span>
          <span class="row-v">${icon("chevron")}</span></a></li>
        ${b.address ? `<li><button class="row row--tap" type="button" id="dir"><span class="row-ico">${icon("directions")}</span><span class="row-t"><span class="row-n">Directions</span><span class="row-d fa" lang="fa" style="text-align:left">${esc(b.address)}</span></span></button></li>` : ""}
      </ul>

      <div class="list-h eyebrow">In the order</div>
      <ul class="list">
        ${o.lines.map((l) => `<li><div class="row"><span class="row-t"><span class="row-n">${l.qty > 1 ? `${l.qty} × ` : ""}${esc(l.name)}</span><span class="row-d">${esc(l.size || "")}${l.free ? `${l.size ? ", " : ""}${l.free} on us` : ""}</span></span><span class="row-v">${price(l.unit * l.qty)}</span></div></li>`).join("")}
      </ul>
      <div class="sum">
        <div class="sum-row"><span>Subtotal</span><span>${priceHTML(o.subtotal)}</span></div>
        ${o.discount ? `<div class="sum-row sum-row--beans"><span>Paid with ${beansText(o.spend)}</span><span>−${money(o.discount)} T</span></div>` : ""}
        <div class="sum-row sum-row--total"><span>Total, at the counter</span><span>${priceHTML(o.total)}</span></div>
        <div class="sum-earn">${icon("bean")}<span><b>+${beansText(o.earn)}</b> for this order. You're ${L.tier.en}${L.next ? `, ${money(L.toNext)} from ${esc(L.next.en)}` : ""}.</span></div>
      </div>
      ${o.note ? `<p class="note">Your note: “${esc(o.note)}”</p>` : ""}
      <div class="btnrow" style="margin:18px var(--g) 0"><a class="btn btn--quiet" href="#/menu">Back to the menu</a><a class="btn btn--ink" href="#/profile">${icon("bean")}Your club</a></div>
    </div>`;

  function mount(screen) {
    const ring = screen.querySelector("#ring");
    const t = screen.querySelector("#ring-t");
    const s = screen.querySelector("#ring-s");
    const s2 = screen.querySelector("#s2"), s3 = screen.querySelector("#s3");
    const span = Math.max(60000, o.readyAt - o.at);
    const tick = () => {
      const now = Date.now();
      const left = o.sample ? 0 : Math.max(0, o.readyAt - now);
      const done = Math.min(1, 1 - left / span);
      ring.style.strokeDashoffset = (C * (1 - done)).toFixed(1);
      if (left <= 0) { t.textContent = "Ready"; s.textContent = o.sample ? "collected" : "at the counter"; }
      else if (left > 90 * 60000) {
        // ordered for opening: a clock time reads better than a five-hour countdown
        t.textContent = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Tehran", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(o.readyAt));
        s.textContent = "when they open";
      } else {
        const m = Math.floor(left / 60000), sec = Math.floor((left % 60000) / 1000);
        t.textContent = m >= 60 ? `${Math.floor(m / 60)}h ${pad2(m % 60)}m` : `${pad2(m)}:${pad2(sec)}`;
        s.textContent = "until ready";
      }
      s2.classList.toggle("on", o.sample || now - o.at > 30000);
      s3.classList.toggle("on", left <= 0);
    };
    tick();
    every(1000, tick);
    screen.querySelector("#dir")?.addEventListener("click", () => directionsSheet(b));
  }

  return { html, mount, cls: "pad-top" };
}
