// State that outlives a page load: the bag, the person on this device, the orders
// sent, the Lamiz Club account. All of it stays in this browser — there is no account
// server yet; the shape is what a server would hold.

import { STORAGE, CLUB, ORDER } from "./config.js";
import { uid, rng, hash32, hueOf, dotted } from "./util.js";
import { byId, BRANCHES, ITEMS, branchById } from "./data.js";

const KEY = {
  bag: STORAGE + "bag",
  applied: STORAGE + "applied",
  profile: STORAGE + "profile",
  orders: STORAGE + "orders",
  member: STORAGE + "member",
  prefs: STORAGE + "prefs",
  photo: STORAGE + "photo",
};

const read = (key, fallback) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : structuredClone(fallback);
  } catch { return structuredClone(fallback); }
};
const write = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode, or full */ }
};

// appear: what others see in a check-in room — "first" name, "initials", or "hidden".
const PROFILE0 = { first: "", last: "", phone: "", email: "", bday: null, hue: null, appear: "first", usual: "" };
const PREFS0 = { branch: "tajrish-monin", when: "now", note: "", sample: false, seeded: false };

const state = {
  bag: read(KEY.bag, []),
  applied: read(KEY.applied, []),
  profile: { ...PROFILE0, ...read(KEY.profile, PROFILE0) },
  photo: (() => { try { return localStorage.getItem(KEY.photo) || ""; } catch { return ""; } })(),
  orders: read(KEY.orders, []),
  member: read(KEY.member, null),
  prefs: { ...PREFS0, ...read(KEY.prefs, PREFS0) },
};

const listeners = new Set();
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((fn) => fn(state));

/* ------------------------------------------------------------------ sizes */
export const sizeOf = (item, k) => item.sizes.find((s) => s.k === k) || item.sizes[0];
export const defaultSize = (item) => item.sizes[0].k;
export const sizeLabel = (item, k) => (item.sizes.length > 1 ? sizeOf(item, k).en : "");

/* -------------------------------------------------------------------- bag */
// A line is an item in one size. Its price is read from the menu each time, never
// stored, so a line can never disagree with the card.
const live = () => state.bag.filter((l) => byId(l.itemId));
export const bag = () => live();
export const unitOf = (l) => sizeOf(byId(l.itemId), l.size).price;
export const bagCount = () => live().reduce((n, l) => n + l.qty, 0);
export const bagTotal = () => live().reduce((n, l) => n + unitOf(l) * l.qty, 0);
export const inBag = (itemId) => live().filter((l) => l.itemId === itemId).reduce((n, l) => n + l.qty, 0);

const saveBag = () => { write(KEY.bag, state.bag); emit(); };

export function addLine(itemId, size, qty = 1) {
  const item = byId(itemId);
  if (!item) return null;
  const k = sizeOf(item, size || defaultSize(item)).k;
  const found = state.bag.find((l) => l.itemId === itemId && l.size === k);
  if (found) found.qty = Math.min(ORDER.maxPerLine, found.qty + qty);
  else state.bag.push({ id: uid(), itemId, size: k, qty: Math.min(ORDER.maxPerLine, qty) });
  saveBag();
  return found || state.bag[state.bag.length - 1];
}

export function setQty(lineId, qty) {
  const line = state.bag.find((l) => l.id === lineId);
  if (!line) return;
  if (qty <= 0) state.bag = state.bag.filter((l) => l.id !== lineId);
  else line.qty = Math.min(ORDER.maxPerLine, qty);
  saveBag();
}

/** Change a line's size; if the bag already has that size, the two lines become one. */
export function setSize(lineId, size) {
  const line = state.bag.find((l) => l.id === lineId);
  if (!line || line.size === size) return;
  const twin = state.bag.find((l) => l.id !== lineId && l.itemId === line.itemId && l.size === size);
  if (twin) { twin.qty = Math.min(ORDER.maxPerLine, twin.qty + line.qty); state.bag = state.bag.filter((l) => l !== line); }
  else line.size = size;
  saveBag();
}

export function clearBag() {
  state.bag = []; state.applied = [];
  write(KEY.bag, state.bag); write(KEY.applied, state.applied); emit();
}

/* ----------------------------------------------------------------- club */
export const TIERS = CLUB.tiers;
export const REWARDS = CLUB.rewards;

function freshMember(now = Date.now()) {
  return {
    id: "LZ" + String(hash32(uid())).slice(0, 7).padStart(7, "0"),
    beans: CLUB.welcome, joined: now,
    history: [{ type: "welcome", at: now, earn: CLUB.welcome, spend: 0 }],
  };
}
export function member() {
  if (!state.member) { state.member = freshMember(); write(KEY.member, state.member); }
  return state.member;
}
export const balance = () => member().beans;

/** Beans collected (not spent) in the club's window — what a tier is earned by. */
export function earnedInWindow(now = Date.now()) {
  const from = now - CLUB.windowDays * 86400000;
  return member().history.filter((h) => h.at >= from).reduce((n, h) => n + (h.earn || 0), 0);
}
export const tierOf = (earned) => TIERS.reduce((t, x) => (earned >= x.min ? x : t), TIERS[0]);
export function ladder(earned = earnedInWindow()) {
  const tier = tierOf(earned);
  const next = TIERS.find((t) => t.min > earned) || null;
  const pct = next ? Math.min(100, Math.round(((earned - tier.min) / (next.min - tier.min)) * 100)) : 100;
  return { tier, next, pct, earned, toNext: next ? next.min - earned : 0 };
}
export const beansFor = (toman, tier = ladder().tier) => Math.floor(toman * CLUB.perToman * tier.rate);

/** The cheapest reward still out of reach, and how far. */
export function nextReward(bal = balance()) {
  const up = REWARDS.filter((r) => r.cost > bal).sort((a, b) => a.cost - b.cost)[0];
  return up ? { reward: up, need: up.cost - bal } : null;
}

export const applied = () => state.applied;
export function toggleReward(id) {
  if (state.applied.includes(id)) state.applied = state.applied.filter((x) => x !== id);
  else state.applied = [...state.applied, id];
  write(KEY.applied, state.applied); emit();
}

/**
 * What the order will do, before it is placed — the bag shows this live.
 * Each applied reward frees the most expensive matching unit not already free, as
 * long as the balance covers it; one that no longer fits simply drops out.
 */
export function quote() {
  const lines = live().map((l) => {
    const item = byId(l.itemId);
    const size = sizeOf(item, l.size);
    return { line: l, item, size, unit: size.price, qty: l.qty, total: size.price * l.qty, free: 0 };
  });
  const units = [];
  lines.forEach((x, li) => { for (let i = 0; i < x.qty; i++) units.push({ li, unit: x.unit, cats: [x.item.cat, ...x.item.also] }); });
  units.sort((a, b) => b.unit - a.unit);
  const used = new Set();
  const bal = balance();
  let spend = 0;
  const out = [];
  for (const id of state.applied) {
    const r = REWARDS.find((x) => x.id === id);
    if (!r || spend + r.cost > bal) continue;
    const idx = units.findIndex((u, i) => !used.has(i) && u.cats.some((c) => r.cats.includes(c)));
    if (idx < 0) continue;
    used.add(idx);
    spend += r.cost;
    lines[units[idx].li].free += 1;
    out.push({ reward: r, item: lines[units[idx].li].item, value: units[idx].unit });
  }
  const subtotal = lines.reduce((n, x) => n + x.total, 0);
  const discount = out.reduce((n, a) => n + a.value, 0);
  const total = subtotal - discount;
  const { tier } = ladder();
  // what else could be applied, and why not
  const offers = REWARDS.map((r) => {
    const on = out.some((a) => a.reward.id === r.id);
    const fits = units.some((u, i) => !used.has(i) && u.cats.some((c) => r.cats.includes(c)));
    const afford = bal - spend >= r.cost;
    return { reward: r, on, ok: on || (fits && afford), why: on ? "" : !fits ? "Nothing in the bag it covers" : !afford ? `${(r.cost - (bal - spend)).toLocaleString("en-US")} more beans` : "" };
  });
  return { lines, subtotal, discount, total, spend, earn: beansFor(total, tier), tier, applied: out, offers, balance: bal };
}

/* ------------------------------------------------------------------ prefs */
export const prefs = () => state.prefs;
export function setPrefs(patch) {
  state.prefs = { ...state.prefs, ...patch };
  write(KEY.prefs, state.prefs); emit();
}
/** The note to the barista, saved as it is typed — without a re-render, which would
 *  take the caret out of the field on every letter. */
export function setNote(text) {
  state.prefs.note = String(text || "").slice(0, 140);
  write(KEY.prefs, state.prefs);
}
export const myBranch = () => branchById(state.prefs.branch) || BRANCHES[0];
export const setMyBranch = (id) => { if (branchById(id)) setPrefs({ branch: id }); };

/* ---------------------------------------------------------------- profile */
export const profile = () => state.profile;
export function setProfile(patch) {
  state.profile = { ...state.profile, ...patch };
  write(KEY.profile, state.profile); emit();
}
export const fullName = (p = state.profile) => `${p.first || ""} ${p.last || ""}`.trim();
/** The name a check-in room shows for you, per the privacy setting. */
export const shownName = (p = state.profile) =>
  p.appear === "hidden" ? "" : p.appear === "initials" ? dotted(fullName(p)) : (p.first || fullName(p));
export const myHue = () => state.profile.hue ?? hueOf(fullName() || "you");

/** The profile photo: a small square JPEG data URL, kept on its own key. */
export const photo = () => state.photo;
export function setPhoto(url) {
  try { if (url) localStorage.setItem(KEY.photo, url); else localStorage.removeItem(KEY.photo); }
  catch { return false; }
  state.photo = url || ""; emit();
  return true;
}

/* ----------------------------------------------------------------- orders */
export const orders = () => state.orders;
export const orderById = (id) => state.orders.find((o) => o.id === id);

/** Four digits the counter can read back. Unique among the orders remembered. */
function orderCode() {
  const taken = new Set(state.orders.map((o) => o.code));
  let code;
  do { code = String(Math.floor(1000 + Math.random() * 9000)); } while (taken.has(code));
  return code;
}

/** readyIn (minutes) overrides `when` — the bag passes it when the branch is closed
 *  and the order is to be ready at opening. */
export function placeOrder({ branchId, when = state.prefs.when, note = state.prefs.note, readyIn = null } = {}) {
  const q = quote();
  if (!q.lines.length) return null;
  const at = Date.now();
  const delay = readyIn ?? (when === "15" ? 15 : when === "30" ? 30 : ORDER.readyMinutes);
  const order = {
    id: uid(), code: orderCode(), at, branch: branchId || myBranch().id, when,
    readyAt: at + delay * 60000,
    lines: q.lines.map((x) => ({ itemId: x.item.id, name: x.item.en, fa: x.item.fa, size: sizeLabel(x.item, x.size.k), unit: x.unit, qty: x.qty, free: x.free })),
    note: (note || "").trim().slice(0, 140),
    subtotal: q.subtotal, discount: q.discount, total: q.total,
    earn: q.earn, spend: q.spend, rewards: q.applied.map((a) => a.reward.id), tier: q.tier.id, status: "sent",
  };
  state.orders.unshift(order);
  state.orders = state.orders.slice(0, ORDER.keep);
  write(KEY.orders, state.orders);

  const m = member();
  m.beans = m.beans - q.spend + q.earn;
  m.history.unshift({ type: "order", at, orderId: order.id, code: order.code, earn: q.earn, spend: q.spend, total: q.total, branch: order.branch });
  m.history = m.history.slice(0, 80);
  write(KEY.member, m);
  state.prefs.note = "";
  write(KEY.prefs, state.prefs);
  clearBag();                                 // emits for everything
  return order;
}

/* ----------------------------------------------------------------- sample */
// A regular's last four months, so the tier, the beans and the history can be judged
// on a fresh phone. Labelled as a sample wherever it shows; one tap clears it.
export const isSample = () => !!state.prefs.sample;

export function seedSample() {
  const now = Date.now();
  const m = freshMember(now - 118 * 86400000);
  const r = rng(hash32("lamiz-sample-v1"));
  const pool = ITEMS.filter((i) => ["hot", "cold", "matcha", "bakery", "croissant", "brew"].includes(i.cat) && i.img);
  const tehran = BRANCHES.filter((b) => b.region === "Tehran");
  const n = 15;
  const history = [...m.history];
  let beans = m.beans;
  const orders = [];
  for (let k = n; k >= 1; k--) {
    const at = now - Math.round(((k - .4 * r()) / n) * 112 * 86400000) - Math.floor(r() * 9) * 3600000;
    const count = 1 + Math.floor(r() * 2.6);
    const lines = [];
    for (let i = 0; i < count; i++) {
      const it = pool[Math.floor(r() * pool.length)];
      if (lines.find((l) => l.itemId === it.id)) continue;
      const s = it.sizes[Math.floor(r() * it.sizes.length)];
      lines.push({ itemId: it.id, name: it.en, fa: it.fa, size: it.sizes.length > 1 ? s.en : "", unit: s.price, qty: 1, free: 0 });
    }
    const subtotal = lines.reduce((s, l) => s + l.unit * l.qty, 0);
    // halfway through, a hot drink paid for in beans
    let spend = 0, discount = 0, rewards = [];
    if (k === 7) {
      const hot = ITEMS.find((i) => i.id === "latte");
      if (hot) {
        lines.push({ itemId: hot.id, name: hot.en, fa: hot.fa, size: "Medium", unit: hot.sizes[1].price, qty: 1, free: 1 });
        spend = REWARDS.find((x) => x.id === "hot").cost; discount = hot.sizes[1].price; rewards = ["hot"];
      }
    }
    const sub2 = lines.reduce((s, l) => s + l.unit * l.qty, 0);
    const total = sub2 - discount;
    const earnedSoFar = history.filter((h) => h.at >= now - CLUB.windowDays * 86400000).reduce((s, h) => s + (h.earn || 0), 0);
    const tier = tierOf(earnedSoFar);
    const earn = Math.floor(total * CLUB.perToman * tier.rate);
    beans = beans + earn - spend;
    const branch = tehran[Math.floor(r() * tehran.length)].id;
    const order = { id: uid(), code: String(1000 + Math.floor(r() * 9000)), at, branch, when: "now", readyAt: at + 8 * 60000, lines,
                    note: "", subtotal: sub2, discount, total, earn, spend, rewards, tier: tier.id, status: "done", sample: true };
    orders.push(order);
    history.unshift({ type: "order", at, orderId: order.id, code: order.code, earn, spend, total, branch, sample: true });
    void subtotal;
  }
  m.beans = beans;
  m.history = history.sort((a, b) => b.at - a.at);
  state.member = m;
  state.orders = [...orders, ...state.orders.filter((o) => !o.sample)].sort((a, b) => b.at - a.at).slice(0, ORDER.keep);
  state.prefs.sample = true; state.prefs.seeded = true;
  write(KEY.member, m); write(KEY.orders, state.orders); write(KEY.prefs, state.prefs);
  emit();
  return m;
}

export function clearSample() {
  state.orders = state.orders.filter((o) => !o.sample);
  state.member = freshMember();
  state.applied = [];
  state.prefs.sample = false; state.prefs.seeded = true;
  write(KEY.member, state.member); write(KEY.orders, state.orders); write(KEY.prefs, state.prefs); write(KEY.applied, state.applied);
  emit();
}

export function forgetEverything() {
  Object.values(KEY).forEach((k) => { try { localStorage.removeItem(k); } catch {} });
  state.bag = []; state.applied = []; state.profile = { ...PROFILE0 }; state.photo = ""; state.orders = []; state.member = null;
  state.prefs = { ...PREFS0, seeded: true };
  write(KEY.prefs, state.prefs);
  emit();
}
