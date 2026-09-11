// Opening hours, in Tehran's own time whatever the phone's clock says.
//
// lamizcoffee.com gives each branch "روزهای عادی" (regular days), sometimes
// "پنج‌شنبه‌ها" (Thursdays) and "روزهای تعطیل" (holidays — Friday, the Iranian
// weekend, is the one this app can know). Minutes from midnight; a close at or before
// the open runs past midnight (Ahvaz 08:00–01:00), so the day before can still be open.

const TZ = "Asia/Tehran";
const fmt = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** { wd: 0 = Sunday … 6 = Saturday, min: minutes since midnight } in Tehran. */
export function tehranNow(d = new Date()) {
  const p = Object.fromEntries(fmt.formatToParts(d).map((x) => [x.type, x.value]));
  return { wd: DAYS.indexOf(p.weekday), min: (+p.hour % 24) * 60 + +p.minute };
}

const t = (m) => { m = ((m % 1440) + 1440) % 1440; return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`; };
const span = ([o, c]) => [o, c <= o ? c + 1440 : c];
/** Which of the branch's windows applies on a weekday. */
const windowFor = (h, wd) => span(wd === 5 ? (h.hol || h.reg) : wd === 4 ? (h.thu || h.reg) : h.reg);

/**
 * Where a branch stands right now.
 * → { open, unknown, always, label, detail, soon }
 */
export function status(hours, now = new Date()) {
  if (!hours) return { unknown: true, open: false, label: "Hours not listed", detail: "" };
  if (hours.all) return { always: true, open: true, label: "Open 24 hours", detail: "" };
  const { wd, min } = tehranNow(now);
  const today = windowFor(hours, wd);
  const yday = windowFor(hours, (wd + 6) % 7);
  // still inside yesterday's late window?
  if (yday[1] > 1440 && min < yday[1] - 1440) {
    const left = yday[1] - 1440 - min;
    return { open: true, soon: left <= 30, label: "Open", detail: `until ${t(yday[1])}` };
  }
  if (min >= today[0] && min < today[1]) {
    const left = today[1] - min;
    return { open: true, soon: left <= 30, label: left <= 30 ? "Closing soon" : "Open", detail: `until ${t(today[1])}` };
  }
  if (min < today[0]) return { open: false, label: "Closed", detail: `opens ${t(today[0])}` };
  const next = windowFor(hours, (wd + 1) % 7);
  return { open: false, label: "Closed", detail: `opens ${t(next[0])} tomorrow` };
}

/** Minutes until the branch next opens — 0 when it is open, null when unknown. */
export function opensIn(hours, now = new Date()) {
  if (!hours) return null;
  if (hours.all || status(hours, now).open) return 0;
  const { wd, min } = tehranNow(now);
  const today = windowFor(hours, wd);
  if (min < today[0]) return today[0] - min;
  return 1440 - min + windowFor(hours, (wd + 1) % 7)[0];
}

/** The week, in lines a person reads: [[days, "07:00 – 22:30"], …] */
export function lines(hours) {
  if (!hours) return [];
  if (hours.all) return [["Every day", "Open 24 hours"]];
  const r = (w) => `${t(w[0])} – ${t(w[1])}`;
  const same = (a, b) => a && b && a[0] === b[0] && a[1] === b[1];
  const out = [];
  const thu = hours.thu && !same(hours.thu, hours.reg);
  if (same(hours.reg, hours.hol) && !thu) return [["Every day", r(hours.reg)]];
  out.push([thu ? "Saturday – Wednesday" : "Saturday – Thursday", r(hours.reg)]);
  if (thu) out.push(["Thursday", r(hours.thu)]);
  if (hours.hol) out.push(["Friday & holidays", r(hours.hol)]);
  return out;
}

/** Which line applies today — highlighted in the list. */
export function todayIndex(hours, now = new Date()) {
  if (!hours || hours.all) return 0;
  const { wd } = tehranNow(now);
  const thu = hours.thu && !(hours.thu[0] === hours.reg[0] && hours.thu[1] === hours.reg[1]);
  const sameAll = hours.hol && hours.hol[0] === hours.reg[0] && hours.hol[1] === hours.reg[1] && !thu;
  if (sameAll) return 0;
  if (wd === 5) return thu ? 2 : 1;
  if (wd === 4 && thu) return 1;
  return 0;
}

/** "Good morning" by the clock in Tehran. */
export function greeting(now = new Date()) {
  const h = Math.floor(tehranNow(now).min / 60);
  return h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
}
