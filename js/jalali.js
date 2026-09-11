// The Iranian calendar, for birthdays. KAI's loyalty programme promises a
// birthday gift, and in Iran a birthday is a Jalali date — so the picker speaks
// that calendar and the value kept is the one the customer chose.
//
// Borkowski's algorithm, ported from Alpha's Code Concept build, where it was
// checked against ICU's Persian calendar over every day from 1901 to 2050. `~~`
// truncates toward zero, which the algorithm needs; Math.floor would be wrong
// for the negative cases. j2d is the standard inverse (jalaali-js).

const div = (a, b) => ~~(a / b);
const mod = (a, b) => a - ~~(a / b) * b;

const BREAKS = [-61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210,
                1635, 2060, 2097, 2192, 2262, 2324, 2394, 2456, 3178];

function jalCal(jy) {
  const bl = BREAKS.length, gy = jy + 621;
  let leapJ = -14, jp = BREAKS[0], jm, jump = 0, n, i;
  if (jy < jp || jy >= BREAKS[bl - 1]) return null;
  for (i = 1; i < bl; i += 1) {
    jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }
  n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) leapJ += 1;
  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;
  if (jump - n < 6) n = n - jump + div(jump + 4, 33) * 33;
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) leap = 4;
  return { leap, gy, march };
}

function g2d(gy, gm, gd) {
  const d = div((gy + div(gm - 8, 6) + 100100) * 1461, 4)
          + div(153 * mod(gm + 9, 12) + 2, 5)
          + gd - 34840408;
  return d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
}

function d2g(jdn) {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function d2j(jdn) {
  let jy = d2g(jdn).gy - 621;
  const r = jalCal(jy);
  let k = jdn - g2d(r.gy, 3, r.march);
  if (k >= 0) {
    if (k <= 185) return { jy, jm: 1 + div(k, 31), jd: mod(k, 31) + 1 };
    k -= 186;
  } else {
    // Previous Jalali year. The leap flag comes from r — the year we started
    // from — never from the decremented jy.
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }
  return { jy, jm: 7 + div(k, 30), jd: mod(k, 30) + 1 };
}

function j2d(jy, jm, jd) {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

export const MONTHS = ["Farvardin", "Ordibehesht", "Khordad", "Tir", "Mordad", "Shahrivar",
                       "Mehr", "Aban", "Azar", "Dey", "Bahman", "Esfand"];
export const MONTHS_FA = ["فروردین", "اردیبهشت", "خرداد", "تیر", "مرداد", "شهریور",
                          "مهر", "آبان", "آذر", "دی", "بهمن", "اسفند"];

export const isLeap = (jy) => { const r = jalCal(jy); return !!r && r.leap === 0; };
export const monthLength = (jy, jm) => (jm <= 6 ? 31 : jm <= 11 ? 30 : isLeap(jy) ? 30 : 29);

/** A local calendar date → { jy, jm, jd }. */
export const toJalali = (date = new Date()) =>
  d2j(g2d(date.getFullYear(), date.getMonth() + 1, date.getDate()));

/** { jy, jm, jd } → a local Date at midnight. */
export function toGregorian(jy, jm, jd) {
  const { gy, gm, gd } = d2g(j2d(jy, jm, jd));
  return new Date(gy, gm - 1, gd);
}

/**
 * The next time a Jalali day-and-month comes round, from today.
 * A 30 Esfand birthday falls on 29 Esfand in the years that have no 30th.
 * → { date, days, jy, jm, jd } — days is 0 on the day itself.
 */
export function nextOccurrence(jm, jd, now = new Date()) {
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const t = toJalali(today);
  for (const jy of [t.jy, t.jy + 1]) {
    const d = Math.min(jd, monthLength(jy, jm));
    const date = toGregorian(jy, jm, d);
    const days = Math.round((date - today) / 86400000);
    if (days >= 0) return { date, days, jy, jm, jd: d };
  }
  return null;
}

// exposed for the verification sweep
export const _internals = { d2j, j2d, g2d, d2g };
