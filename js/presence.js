// Who is at which Lamiz right now.
//
// Checking in is one tap and asks for nothing. It holds for an hour and then retires
// itself, so no list can go stale in a way that embarrasses anybody. Storage is this
// device by default; set CHECKIN.endpoint in config.js and the same calls go to a
// shared room instead, with no change to any view.
//
// The demo roster is derived from the clock in Tehran — same branch, same ten
// minutes, same faces — so a single phone shows a believable room, two people looking
// at the same screen see the same thing, and a branch that is closed is empty.

import { CHECKIN, STORAGE } from "./config.js";
import { BRANCHES, branchById } from "./data.js";
import { uid, rng, hash32, hueOf } from "./util.js";
import { status, tehranNow } from "./hours.js";

const KEY = STORAGE + "room";
const VISITS = STORAGE + "visits";
const WAVES = STORAGE + "waves";
const ME = STORAGE + "meid";
const HOLD = CHECKIN.holdMinutes * 60000;

const listeners = new Set();
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };
const emit = () => listeners.forEach((fn) => fn());

const channel = "BroadcastChannel" in self ? new BroadcastChannel("lamiz-room") : null;
if (channel) channel.onmessage = () => emit();
addEventListener("storage", (e) => { if (e.key === KEY) emit(); });

const readAll = () => { try { return JSON.parse(localStorage.getItem(KEY) || "[]"); } catch { return []; } };
const writeAll = (rows) => {
  try { localStorage.setItem(KEY, JSON.stringify(rows)); } catch {}
  channel?.postMessage("x");
  emit();
};

export function myId() {
  let id = null;
  try { id = localStorage.getItem(ME); } catch {}
  if (!id) { id = uid(); try { localStorage.setItem(ME, id); } catch {} }
  return id;
}

/* ------------------------------------------------------------------- demo */
const NAMES = ["Sara", "Nima", "Elnaz", "Amir", "Ladan", "Kaveh", "Aylin", "Reza", "Mahsa", "Sina",
               "Roya", "Arman", "Niloofar", "Babak", "Parisa", "Hamed", "Yasna", "Kian", "Donya", "Sam",
               "Tara", "Pouya", "Negin", "Ali", "Shirin", "Farhad", "Melika", "Dara", "Setareh", "Omid"];
// How full a Lamiz is through the day, 0..1, by the hour in Tehran.
const CURVE = [.12, .06, .03, 0, 0, 0, .1, .35, .55, .6, .55, .6, .7, .6, .5, .55, .7, .85, .95, 1, .95, .8, .55, .3];

function capacity(id) {
  const b = branchById(id);
  if (!b) return 0;
  const base = 5 + (hash32("cap|" + id) % 5);                       // 5..9
  return b.city === "Tehran" ? base + 1 : base;
}

function demoRoster(branchId, now = Date.now()) {
  if (!CHECKIN.demo) return [];
  const b = branchById(branchId);
  if (!b || !status(b.hours, new Date(now)).open) return [];
  const { min } = tehranNow(new Date(now));
  const hour = Math.floor(min / 60);
  const bucket = Math.floor((min % 60) / 10);
  const day = Math.floor((now + 12600000) / 86400000);            // days since epoch, Tehran (UTC+3:30)
  const r = rng(hash32(`${branchId}|${day}|${hour}|${bucket}`));
  const n = Math.max(0, Math.round(CURVE[hour] * capacity(branchId) + (r() - .5) * 2.4));
  const used = new Set();
  const rows = [];
  for (let i = 0; i < n && used.size < NAMES.length; i++) {
    let name;
    do { name = NAMES[Math.floor(r() * NAMES.length)]; } while (used.has(name));
    used.add(name);
    const at = now - Math.floor(r() * 52 + 1) * 60000 - Math.floor(r() * 60) * 1000;
    rows.push({ id: `demo-${branchId}-${name}`, name, hue: hueOf(name), at, until: at + HOLD, branch: branchId, demo: true });
  }
  return rows;
}

/* ------------------------------------------------------------------- room */
const live = (rows, now) => rows.filter((p) => p.until > now);

/** Everyone at a branch whose hour has not run out, earliest arrival first. */
export function list(branchId, now = Date.now()) {
  const mine = live(readAll(), now).filter((p) => p.branch === branchId);
  return [...demoRoster(branchId, now), ...mine].sort((a, b) => a.at - b.at);
}

/** { branchId: headcount } for every branch. */
export function counts(now = Date.now()) {
  const out = {};
  for (const b of BRANCHES) out[b.id] = list(b.id, now).length;
  return out;
}

export const me = () => live(readAll(), Date.now()).find((p) => p.id === myId()) || null;
export const isIn = () => !!me();

export function checkIn({ branchId, name, hue, photo } = {}) {
  const now = Date.now();
  const rows = live(readAll(), now).filter((p) => p.id !== myId());
  const entry = { id: myId(), name: name || "", hue: hue ?? null, photo: photo || "", at: now, until: now + HOLD, branch: branchId };
  rows.push(entry);
  writeAll(rows);
  logVisit(branchId, now);
  return entry;
}

/** Keep the name and face others see in step with the profile while checked in. */
export function rename(name, hue, photo) {
  const rows = readAll();
  const mine = rows.find((p) => p.id === myId());
  if (!mine) return;
  mine.name = name || ""; mine.hue = hue ?? null; mine.photo = photo || "";
  writeAll(rows);
}

export function extend() {
  const rows = readAll();
  const mine = rows.find((p) => p.id === myId());
  if (!mine) return null;
  mine.until = Date.now() + CHECKIN.extendMinutes * 60000;
  writeAll(rows);
  return mine;
}

export function checkOut() { writeAll(readAll().filter((p) => p.id !== myId())); }

/* ---------------------------------------------------------------- visits */
const readVisits = () => { try { return JSON.parse(localStorage.getItem(VISITS) || "[]"); } catch { return []; } };
function logVisit(branch, at) {
  const v = readVisits(); v.push({ branch, at });
  try { localStorage.setItem(VISITS, JSON.stringify(v.slice(-120))); } catch {}
}
export function visitsThisMonth(now = new Date()) {
  return readVisits().filter((x) => { const d = new Date(x.at); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); }).length;
}
export const forgetVisits = () => { try { localStorage.removeItem(VISITS); localStorage.removeItem(WAVES); } catch {} };

/* ----------------------------------------------------------------- waves */
// A wave is the smallest hello: it says you noticed, and nothing else. Kept for the
// hour, per person, so the button can say "Waved".
const readWaves = () => { try { return JSON.parse(localStorage.getItem(WAVES) || "{}"); } catch { return {}; } };
export const waved = (personId, now = Date.now()) => (readWaves()[personId] || 0) > now - HOLD;
export function wave(personId) {
  const w = readWaves(); w[personId] = Date.now();
  try { localStorage.setItem(WAVES, JSON.stringify(w)); } catch {}
  emit();
}

// Retire anyone whose hour is up, and let the demo roster roll over, on a timer.
setInterval(() => {
  const now = Date.now();
  const rows = readAll();
  if (rows.some((p) => p.until <= now)) writeAll(rows.filter((p) => p.until > now));
  else emit();
}, 30000);
