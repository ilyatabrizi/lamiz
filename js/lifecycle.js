// What a screen leaves behind when it goes: timers, store subscriptions, observers.
// A view registers each with onLeave(); the router calls leave() before every render —
// a refresh included — so nothing from the last screen keeps running against nodes
// that are no longer in the document, and nothing stacks on a second visit.

let pending = [];

export const onLeave = (fn) => { pending.push(fn); return fn; };

export function leave() {
  const run = pending;
  pending = [];
  run.forEach((fn) => { try { fn(); } catch { /* a cleanup must never break the next screen */ } });
}

/** setInterval that stops when the screen goes. */
export const every = (ms, fn) => { const id = setInterval(fn, ms); onLeave(() => clearInterval(id)); return id; };
