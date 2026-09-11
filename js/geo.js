// Where the phone is — only when the person asks. The permission prompt always comes
// from a tap ("Near me", "Find my branch"), never on load. The last fix is kept for
// half an hour so the next screen does not ask again.

import { STORAGE } from "./config.js";
import { BRANCHES } from "./data.js";

const KEY = STORAGE + "geo";
const FRESH = 30 * 60000;
const listeners = new Set();
export const subscribe = (fn) => { listeners.add(fn); return () => listeners.delete(fn); };

let last = (() => {
  try { const v = JSON.parse(localStorage.getItem(KEY) || "null"); return v && Date.now() - v.at < FRESH ? v : null; }
  catch { return null; }
})();

/** The last known position, if it is recent. */
export const known = () => (last && Date.now() - last.at < FRESH ? last : null);

export const supported = () => "geolocation" in navigator;

/** Ask for the position. Resolves {lat, lng, acc} or rejects with a readable message. */
export function locate({ timeout = 10000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!supported()) return reject(new Error("This browser cannot share a location."));
    navigator.geolocation.getCurrentPosition((p) => {
      last = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, at: Date.now() };
      try { localStorage.setItem(KEY, JSON.stringify(last)); } catch {}
      listeners.forEach((fn) => fn(last));
      resolve(last);
    }, (e) => {
      reject(new Error(e.code === 1 ? "Location is turned off for this site." : "Could not find you just now."));
    }, { enableHighAccuracy: true, timeout, maximumAge: 60000 });
  });
}

/** Great-circle distance in km. */
export function km(a, b) {
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export const distText = (d) => d == null ? "" : d < 1 ? `${Math.max(10, Math.round(d * 100) * 10)} m` : d < 10 ? `${d.toFixed(1)} km` : `${Math.round(d)} km`;

/** Branches with a distance from `pos`, nearest first; branches without a map pin last. */
export function byDistance(pos = known()) {
  if (!pos) return BRANCHES.map((b) => ({ b, d: null }));
  return BRANCHES.map((b) => ({ b, d: b.lat == null ? null : km(pos, b) }))
    .sort((x, y) => (x.d ?? 1e9) - (y.d ?? 1e9));
}

export const nearest = (pos = known()) => (pos ? byDistance(pos)[0] : null);

/** The branch the phone is standing in, if any. */
export function atBranch(pos = known(), meters = 250) {
  const n = nearest(pos);
  return n && n.d != null && n.d * 1000 <= Math.max(meters, (pos.acc || 0) * .6) ? n.b : null;
}

/** Directions: their own Google Maps link first, Apple Maps on Apple devices, the
 *  platform chooser (Neshan, Balad, anything installed) on Android. */
export function mapLinks(b) {
  const out = [];
  if (b.maps) out.push({ id: "google", label: "Google Maps", href: b.maps });
  else out.push({ id: "google", label: "Google Maps", href: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent("قهوه لمیز " + b.address)}` });
  if (b.lat != null) {
    out.push({ id: "apple", label: "Apple Maps", href: `https://maps.apple.com/?ll=${b.lat},${b.lng}&q=${encodeURIComponent("Lamiz Coffee " + b.en)}` });
    out.push({ id: "geo", label: "Other map apps", href: `geo:${b.lat},${b.lng}?q=${b.lat},${b.lng}(${encodeURIComponent("Lamiz " + b.en)})` });
  }
  return out;
}
