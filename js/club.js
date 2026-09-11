// The Lamiz Club card — on Home and in Profile — and the member code the counter scans.
// The club is Alpha's proposal (see config.js); the card says so by being a card, not
// by pretending to be a bank.

import { CLUB } from "./config.js";
import { MARK } from "./brand.js";
import { esc, money } from "./util.js";
import { ladder, balance, nextReward, isSample, member, fullName } from "./store.js";
import { qrSVG } from "./qr.js";
import { openSheet } from "./ui.js";

export const tierChip = (t) => `<span class="tier tier--${t.id}">${esc(t.en)}</span>`;
export const beansText = (n) => `${money(n)} ${n === 1 ? CLUB.unit : CLUB.units}`;

export function clubCardHTML({ href = "#/profile", id = "club" } = {}) {
  const L = ladder();
  const bal = balance();
  const nr = nextReward(bal);
  return `
    <a class="club" href="${href}" id="${id}" aria-label="${CLUB.name}: ${beansText(bal)}, ${L.tier.en} tier">
      <span class="club-mark" aria-hidden="true">${MARK}</span>
      <div class="club-top"><span class="club-name">${MARK}<span>${CLUB.name}</span></span>${tierChip(L.tier)}</div>
      <div class="club-beans"><b data-beans="${bal}">${money(bal)}</b><span>${bal === 1 ? CLUB.unit : CLUB.units}</span>${isSample() ? `<span class="tag tag--sample">Sample</span>` : ""}</div>
      <div class="meter" aria-hidden="true"><i style="width:${L.pct}%"></i></div>
      <div class="club-next">
        <span>${L.next ? `<b>${money(L.toNext)}</b> to ${esc(L.next.en)}` : "The top tier"}</span>
        <span>${nr ? `Next reward in <b>${money(nr.need)}</b>` : "Every reward is yours"}</span>
      </div>
    </a>`;
}

/** The member code, full screen enough to scan. */
export function memberSheet() {
  const m = member();
  const name = fullName();
  openSheet({
    title: "Your Lamiz Club card",
    sub: "Show this at the counter. The barista scans it and your beans arrive with the receipt.",
    body: `
      <div class="qrcard" aria-label="Member code ${m.id}">${qrSVG(`LAMIZ:MEMBER:${m.id}`, { quiet: 1, fg: "#111113", bg: "#ffffff", label: "Member code" })}</div>
      <div class="qr-id">${esc(m.id)}</div>
      ${name ? `<p class="small" style="text-align:center;margin-top:6px">${esc(name)}</p>` : ""}`,
  });
}
