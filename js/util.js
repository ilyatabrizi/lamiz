// Small shared helpers. No framework, no dependencies.

import { BUSINESS } from "./config.js";

export const $ = (sel, root = document) => root.querySelector(sel);
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Escape anything that came from a person before it goes near innerHTML. */
export const esc = (s) => String(s ?? "").replace(/[&<>"']/g,
  (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export const pad2 = (n) => String(n).padStart(2, "0");

/** 248800 → "248,800". Grouped, never rounded, Latin digits. */
export const money = (n) => Math.round(Number(n) || 0).toLocaleString("en-US");
export const price = (n) => `${money(n)} ${BUSINESS.currency}`;
/** Price with the unit as a small suffix, for tiles and rows. */
export const priceHTML = (n) => `<span class="money">${money(n)}</span><small class="cur">${BUSINESS.currency}</small>`;

export const uid = () => Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-4);

export const initials = (name) => {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "··";
  return (parts[0][0] + (parts[1] ? parts[1][0] : "")).toUpperCase();
};

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/** A stable colour (0–5) for a name — the same person keeps the same colour. */
export const hueOf = (s) => hash32(String(s || "?").trim().toLowerCase()) % 6;

/** "Ilya Tabrizi" → "I. T." */
export const dotted = (name) => String(name || "").trim().split(/\s+/).filter(Boolean)
  .slice(0, 2).map((w) => w[0].toUpperCase() + ".").join(" ");

export const ordinal = (n) => {
  const s = ["th", "st", "nd", "rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
};
export const plural = (n, one, many = one + "s") => `${money(n)} ${n === 1 ? one : many}`;

/* ------------------------------------------------------------------ phone */
/** "02126851876" → "021 2685 1876", with the extension after a comma. */
export const phoneText = ({ main, ext }) =>
  `${main.slice(0, 3)} ${main.slice(3, 7)} ${main.slice(7)}${ext ? `, ext. ${ext}` : ""}`;
/** A comma pauses, then dials the extension — every phone understands it. */
export const telHref = ({ main, ext }) => `tel:+98${main.slice(1)}${ext ? "," + ext : ""}`;

/* ------------------------------------------------------------------ clock */
export const hm = (d = new Date()) => `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
export const dateShort = (t) => { const d = new Date(t); return `${d.getDate()} ${MONTHS[d.getMonth()]}`; };
export const dateTime = (t) => `${dateShort(t)}, ${hm(new Date(t))}`;

/** "4 min ago", "just now" — for the room list. */
export function ago(t, now = Date.now()) {
  const m = Math.round((now - t) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  return `${Math.floor(m / 60)} h ago`;
}

/** mm:ss left on a deadline, floored at zero. */
export function countdown(until, now = Date.now()) {
  const s = Math.max(0, Math.round((until - now) / 1000));
  return `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
}

export const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Deterministic 32-bit hash for seeded demo content. */
export function hash32(str) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; }
  return h >>> 0;
}
/** Tiny seeded PRNG (mulberry32). */
export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A new array in random order (Fisher–Yates). Pass a seeded rng for a fixed order. */
export function shuffle(list, random = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Latin and Persian digits and letters folded together, for search. */
export const fold = (s) => String(s || "").toLowerCase()
  .replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)))
  .replace(/ي/g, "ی").replace(/ك/g, "ک").replace(/[‌​\s\-_/()،,.]+/g, " ").trim();
