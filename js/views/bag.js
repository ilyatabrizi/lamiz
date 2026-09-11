// The bag. Each line in its size, changeable here; where to pick it up and when; a note
// for the barista; the Lamiz Club — beans to spend on a reward, and the beans this
// order will earn; then one button. The order ends at a pickup code, paid at the
// counter — the preview takes no payment.

import { CLUB, ORDER } from "../config.js";
import { icon } from "../icons.js";
import { esc, money, price, priceHTML } from "../util.js";
import { quote, setQty, setSize, myBranch, prefs, setPrefs, setNote, toggleReward, placeOrder, subscribe, orders, addLine, ladder } from "../store.js";
import { byId } from "../data.js";
import { itemImg, qtyHTML, qty, segHTML, wireSeg, branchSheet, statusHTML, emptyHTML, toast } from "../ui.js";
import { status, opensIn } from "../hours.js";
import { tierChip, beansText } from "../club.js";
import { go, refresh } from "../router.js";
import { onLeave } from "../lifecycle.js";
import { haptic } from "../motion.js";

export default function bagView() {
  const q = quote();
  const last = orders()[0];

  if (!q.lines.length) {
    const again = last ? last.lines.filter((l) => byId(l.itemId)) : [];
    return {
      cls: "pad-top",
      html: `<div class="wrap">
        <div class="lt-wrap"><h1 class="lt">Bag</h1></div>
        ${emptyHTML("Your bag is empty", "Everything on the Lamiz menu can be ordered ahead and picked up at any branch.", `<a class="btn" href="#/menu">See the menu</a>`)}
        ${again.length ? `
          <div class="list-h eyebrow">Your last order</div>
          <ul class="list">
            ${again.slice(0, 4).map((l) => `<li><div class="row"><span class="row-thumb">${itemImg(byId(l.itemId), { size: 88 })}</span><span class="row-t"><span class="row-n">${esc(l.name)}</span><span class="row-d">${esc(l.size || "")}${l.size ? ", " : ""}${price(l.unit)}</span></span></div></li>`).join("")}
          </ul>
          <div style="margin:12px var(--g) 0"><button class="btn btn--quiet btn--block" type="button" id="again">${icon("refresh")}Add these again</button></div>` : ""}
      </div>`,
      mount(screen) {
        screen.querySelector("#again")?.addEventListener("click", () => {
          again.forEach((l) => { const it = byId(l.itemId); const s = it.sizes.find((x) => x.en === l.size) || it.sizes[0]; addLine(it.id, s.k, l.qty); });
          haptic([10, 26, 12]);
          toast("Your last order is back in the bag", { ico: "bag" });
        });
        onLeave(subscribe(() => refresh()));
      },
    };
  }

  const b = myBranch();
  const st = status(b.hours);
  const closed = !st.open && !st.unknown;
  const wait = closed ? opensIn(b.hours) : null;
  const { tier } = ladder();
  const p = prefs();

  const lines = q.lines.map((x) => `
    <div class="bline" data-line="${x.line.id}">
      <div class="bline-img">${itemImg(x.item, { size: 128 })}</div>
      <div>
        <div class="bline-n">${esc(x.item.en)}</div>
        <div class="bline-fa fa" lang="fa">${esc(x.item.fa)}</div>
        ${x.item.sizes.length > 1 ? `
          <div class="bline-sizes" role="group" aria-label="Size">
            ${x.item.sizes.map((s) => `<button type="button" data-size="${s.k}" aria-pressed="${s.k === x.size.k}">${esc(s.en)}</button>`).join("")}
          </div>` : ""}
        <div class="bline-foot">
          ${qtyHTML(x.qty, `Quantity of ${x.item.en}`)}
          <div class="bline-sum"><span class="money">${money(x.total)}</span><small class="cur">T</small>${x.free ? `<span class="bline-free">${x.free} on us, with beans</span>` : ""}</div>
        </div>
      </div>
    </div>`).join("");

  const rewards = q.offers.map(({ reward: r, on, ok, why }) => `
    <label class="reward ${on ? "on" : ""} ${ok ? "" : "off"}">
      <span class="reward-ico">${icon(r.ico)}</span>
      <span class="reward-t"><b>${esc(r.en)}</b><span>${on ? "Applied to this order" : why || esc(r.sub)}</span></span>
      <span class="reward-c">${icon("bean")}${money(r.cost)}</span>
      <span class="switch"><input type="checkbox" data-reward="${r.id}" ${on ? "checked" : ""} ${ok ? "" : "disabled"} aria-label="${esc(r.en)} for ${money(r.cost)} beans"><span></span></span>
    </label>`).join("");

  const html = `
    <div class="wrap">
      <div class="lt-wrap"><h1 class="lt">Bag</h1><p class="lt-sub">${q.lines.reduce((n, x) => n + x.qty, 0)} ${q.lines.reduce((n, x) => n + x.qty, 0) === 1 ? "item" : "items"}, ready to send to the counter.</p></div>
      <div class="bag-lines" id="bag-lines">${lines}</div>

      <div class="list-h eyebrow">Pick up at</div>
      <ul class="list">
        <li><button class="row row--tap" type="button" id="pick-branch">
          <span class="row-thumb"><img class="fade" src="${b.cover}" alt="" width="44" height="44" decoding="async"></span>
          <span class="row-t"><span class="row-n">Lamiz ${esc(b.en)}</span><span class="row-d">${statusHTML(b)}</span></span>
          <span class="row-v">Change${icon("chevron")}</span>
        </button></li>
      </ul>
      ${closed ? `<p class="near" style="margin-top:10px">${icon("clock")}<span>Closed now. Order ahead and it will be ready when they open — ${esc(st.detail)}.</span></p>`
        : `<div class="whenseg">${segHTML("when", [{ v: "now", label: `In ${ORDER.readyMinutes} min` }, { v: "15", label: "In 15 min" }, { v: "30", label: "In 30 min" }], p.when || "now")}</div>`}

      <div class="list-h eyebrow">Note for the barista</div>
      <div class="field" style="margin:0 var(--g)"><textarea id="note" maxlength="140" rows="2" placeholder="Oat milk if there is any, extra hot…" aria-label="Note for the barista">${esc(p.note || "")}</textarea></div>

      <div class="sec-h" style="margin-top:28px;margin-bottom:10px">
        <div><h2 class="sec-t">${CLUB.name}</h2><p class="sec-s">${beansText(q.balance)} to spend ${tierChip(tier)}</p></div>
      </div>
      <div class="rewards" id="rewards">${rewards}</div>

      <div class="sum" id="sum">
        <div class="sum-row"><span>Subtotal</span><span>${priceHTML(q.subtotal)}</span></div>
        ${q.discount ? `<div class="sum-row sum-row--beans"><span>Paid with ${beansText(q.spend)}</span><span>−${money(q.discount)} T</span></div>` : ""}
        <div class="sum-row sum-row--total"><span>Total</span><span>${priceHTML(q.total)}</span></div>
        <div class="sum-earn">${icon("bean")}<span>This order earns <b>${beansText(q.earn)}</b>${tier.rate > 1 ? ` — ${tier.rate}× as ${esc(tier.en)}` : ""}.</span></div>
      </div>

      <div class="checkout"><button class="btn" type="button" id="place"><span>${closed ? "Order for opening" : "Place order"}</span><span class="money">${price(q.total)}</span></button></div>
      <p class="paynote">${icon("info")}<span>${ORDER.pay} This preview takes no payment.</span></p>
    </div>`;

  function mount(screen) {
    screen.querySelectorAll(".bline").forEach((el) => {
      const id = el.dataset.line;
      const line = q.lines.find((x) => x.line.id === id);
      qty(el.querySelector(".qty"), { value: line.qty, min: 0, max: ORDER.maxPerLine, onChange: (v) => setQty(id, v) });
      el.querySelectorAll("[data-size]").forEach((btn) => btn.addEventListener("click", () => { haptic(6); setSize(id, btn.dataset.size); }));
    });
    screen.querySelector("#pick-branch").addEventListener("click", () => branchSheet({ title: "Pick up at", sub: "Your order goes straight to this counter." }));
    const seg = screen.querySelector('[data-seg="when"]');
    if (seg) wireSeg(seg, (v) => setPrefs({ when: v }));
    screen.querySelector("#note").addEventListener("input", (e) => setNote(e.target.value));
    screen.querySelectorAll("[data-reward]").forEach((inp) => inp.addEventListener("change", () => { haptic(8); toggleReward(inp.dataset.reward); }));
    screen.querySelector("#place").addEventListener("click", (e) => {
      const btn = e.currentTarget;
      btn.disabled = true;
      haptic([12, 40, 18]);
      const order = placeOrder({ branchId: b.id, note: screen.querySelector("#note").value, readyIn: closed ? wait + 5 : null });
      if (order) go(`#/order/${order.id}`);
    });
    onLeave(subscribe(() => refresh()));
  }

  return { html, mount, cls: "pad-top" };
}
