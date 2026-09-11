// Line icons in the SF Symbols idiom: 24-unit grid, 1.8 stroke, round joins. The tab
// bar's selected state swaps each outline for its filled twin, as iOS does; filled
// icons cut their inner detail out with --knock, the colour of the glass lens.
// Drawn here rather than loaded, so they colour with the text and ship in one request.

const S = 'fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"';
const wrap = (body, extra = "") =>
  `<svg viewBox="0 0 24 24" width="24" height="24" ${S} aria-hidden="true" focusable="false"${extra}>${body}</svg>`;
const K = 'style="stroke:var(--knock)"';
const F = 'fill="currentColor" stroke="none"';

const ICONS = {
  home: `<path d="M4 10.6 12 4l8 6.6V19a1.6 1.6 0 0 1-1.6 1.6H15v-5.8H9v5.8H5.6A1.6 1.6 0 0 1 4 19z"/>`,
  homeFill: `<path ${F} fill-rule="evenodd" d="M12 3a1.3 1.3 0 0 0-.8.3L3.6 9.6a1.6 1.6 0 0 0-.6 1.2v8.3A2.4 2.4 0 0 0 5.4 21.5H9.1v-5.6a1 1 0 0 1 1-1h3.8a1 1 0 0 1 1 1v5.6h3.7a2.4 2.4 0 0 0 2.4-2.4v-8.3a1.6 1.6 0 0 0-.6-1.2l-7.6-6.3A1.3 1.3 0 0 0 12 3z"/>`,
  menu: `<path d="M5 9h11a3 3 0 0 1 0 6h-.4"/><path d="M5 9v5a5 5 0 0 0 5 5h1a5 5 0 0 0 5-5V9"/><path d="M8 4.5c0 1-1 1.2-1 2.2M11 4.5c0 1-1 1.2-1 2.2"/>`,
  menuFill: `<path ${F} d="M4.1 8.1h12.8V14a5.9 5.9 0 0 1-5.9 5.9h-1A5.9 5.9 0 0 1 4.1 14z"/><path d="M16.6 9.4h.4a2.8 2.8 0 0 1 0 5.6h-.6"/><path d="M8 4.2c0 1-1 1.3-1 2.2M11 4.2c0 1-1 1.3-1 2.2"/>`,
  checkin: `<path d="M12 21s-6.5-5.4-6.5-11a6.5 6.5 0 0 1 13 0c0 5.6-6.5 11-6.5 11z"/><path d="m9.4 10 1.9 1.9 3.5-3.8"/>`,
  checkinFill: `<path ${F} d="M12 2.6a7.4 7.4 0 0 0-7.4 7.4c0 6 6.4 11.4 6.9 11.8a.8.8 0 0 0 1 0c.5-.4 6.9-5.8 6.9-11.8A7.4 7.4 0 0 0 12 2.6z"/><path d="m9.3 10 2 2 3.6-3.9" ${K} stroke-width="2"/>`,
  branches: `<path d="M9 4.8 3.8 6.7v12.6L9 17.4l6 1.9 5.2-1.9V4.8L15 6.7z"/><path d="M9 4.8v12.6M15 6.7v12.6"/>`,
  branchesFill: `<path ${F} d="M8.3 4.2 3.7 5.9a1 1 0 0 0-.6.9v12.3a.8.8 0 0 0 1.1.8l4.1-1.5zM9.9 4.1v13.3l4.2 1.3V5.4zM15.7 5.5v13.3l4.6-1.7a1 1 0 0 0 .6-.9V3.9a.8.8 0 0 0-1.1-.8z"/>`,
  profile: `<circle cx="12" cy="8.5" r="4"/><path d="M4.5 20.5c.6-3.8 3.6-6 7.5-6s6.9 2.2 7.5 6"/>`,
  profileFill: `<circle ${F} cx="12" cy="8.3" r="4.6"/><path ${F} d="M3.7 20.2c.7-4.3 4-6.9 8.3-6.9s7.6 2.6 8.3 6.9a1 1 0 0 1-1 1.2H4.7a1 1 0 0 1-1-1.2z"/>`,
  bag: `<path d="M5.5 8.5h13l-.9 11a1.5 1.5 0 0 1-1.5 1.4H7.9a1.5 1.5 0 0 1-1.5-1.4z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>`,
  bagFill: `<path ${F} d="M4.7 7.7h14.6l-1 11.9a2.3 2.3 0 0 1-2.3 2.1H8a2.3 2.3 0 0 1-2.3-2.1z"/><path d="M9 8.5V7a3 3 0 0 1 6 0v1.5"/>`,
  plus: `<path d="M12 5v14M5 12h14"/>`,
  minus: `<path d="M5 12h14"/>`,
  check: `<path d="m5 12.5 4.5 4.5L19 7.5"/>`,
  close: `<path d="M6 6l12 12M18 6 6 18"/>`,
  chevron: `<path d="m9 5 7 7-7 7"/>`,
  chevronL: `<path d="m15 5-7 7 7 7"/>`,
  chevronD: `<path d="m5 9 7 7 7-7"/>`,
  arrowUpRight: `<path d="M7 17 17 7M8 7h9v9"/>`,
  arrowRight: `<path d="M4.5 12h15M13.5 6l6 6-6 6"/>`,
  search: `<circle cx="11" cy="11" r="6.5"/><path d="m16 16 4.5 4.5"/>`,
  phone: `<path d="M6.5 3.5h3l1.8 4.5-2.2 1.6a11 11 0 0 0 5.3 5.3l1.6-2.2 4.5 1.8v3a2 2 0 0 1-2.2 2A15.5 15.5 0 0 1 4.5 5.7a2 2 0 0 1 2-2.2z"/>`,
  pin: `<path d="M12 21s-6.5-5.4-6.5-11a6.5 6.5 0 0 1 13 0c0 5.6-6.5 11-6.5 11z"/><circle cx="12" cy="10" r="2.3"/>`,
  locate: `<path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2" fill="currentColor"/>`,
  directions: `<path d="m3.5 11.5 17-8-8 17-1.8-7.2z"/>`,
  instagram: `<rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="3.8"/><circle cx="17.2" cy="6.8" r=".9" fill="currentColor" stroke="none"/>`,
  linkedin: `<rect x="3.5" y="3.5" width="17" height="17" rx="3.5"/><path d="M8 10.5v6M8 7.6v.1M11.5 16.5v-6M11.5 13c0-1.6 1-2.6 2.4-2.6s2.1 1 2.1 2.6v3.5"/>`,
  globe: `<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c2.6 2.7 2.6 14.3 0 17M12 3.5c-2.6 2.7-2.6 14.3 0 17"/>`,
  clock: `<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>`,
  sparkle: `<path d="M12 3.5c.6 4.4 2.1 7.9 8.5 8.5-6.4.6-7.9 4.1-8.5 8.5-.6-4.4-2.1-7.9-8.5-8.5 6.4-.6 7.9-4.1 8.5-8.5z"/>`,
  info: `<circle cx="12" cy="12" r="8.5"/><path d="M12 11v5M12 8v.2"/>`,
  trash: `<path d="M5 7h14M9.5 7V4.5h5V7M7 7l.8 12.5h8.4L17 7"/>`,
  qr: `<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 14h2M14 18h2M18 18h2v2h-2M16 16v2"/>`,
  gift: `<rect x="4" y="9.5" width="16" height="11" rx="1.5"/><path d="M4 13.5h16M12 9.5v11"/><path d="M12 9.5c-2.4 0-4.7-1.2-4.7-3a1.9 1.9 0 0 1 3.5-1c.9 1.2 1.2 2.7 1.2 4zM12 9.5c2.4 0 4.7-1.2 4.7-3a1.9 1.9 0 0 0-3.5-1c-.9 1.2-1.2 2.7-1.2 4z"/>`,
  download: `<path d="M12 4v11M7.5 10.5 12 15l4.5-4.5M5 19.5h14"/>`,
  share: `<path d="M12 3.5v11M8 7.5l4-4 4 4M5 12v6.5A1.5 1.5 0 0 0 6.5 20h11a1.5 1.5 0 0 0 1.5-1.5V12"/>`,
  refresh: `<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v4.5h-4.5"/>`,
  people: `<circle cx="9" cy="8.5" r="3.3"/><path d="M3 19.5c.5-3.3 2.9-5.2 6-5.2s5.5 1.9 6 5.2"/><path d="M15.5 5.6a3.3 3.3 0 0 1 0 5.8M17.6 14.6c2 .7 3.2 2.3 3.4 4.9"/>`,
  sound: `<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="M15.5 9.5a3.5 3.5 0 0 1 0 5M18 7a7 7 0 0 1 0 10"/>`,
  mute: `<path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z"/><path d="m16 10 4 4M20 10l-4 4"/>`,
  play: `<path d="M8 5.5v13l10-6.5z" fill="currentColor" stroke="none"/>`,
  pause: `<path d="M8 5.5v13M16 5.5v13" stroke-width="3"/>`,
  edit: `<path d="m14.5 5.5 4 4L8 20H4v-4z"/><path d="m12.5 7.5 4 4"/>`,
  note: `<path d="M6 4.5h9l3 3v12H6z"/><path d="M15 4.5v3h3M9 12h6M9 15.5h4"/>`,
  sun: `<circle cx="12" cy="12" r="4"/><path d="M12 2.8v2M12 19.2v2M4.6 4.6 6 6M18 18l1.4 1.4M2.8 12h2M19.2 12h2M4.6 19.4 6 18M18 6l1.4-1.4"/>`,
  moon: `<path d="M19.5 14.6A8 8 0 0 1 9.4 4.5a8 8 0 1 0 10.1 10.1z"/>`,
  auto: `<circle cx="12" cy="12" r="8.5"/><path d="M12 3.5a8.5 8.5 0 0 1 0 17z" fill="currentColor" stroke="none"/>`,
  camera: `<path d="M4 8.5A1.5 1.5 0 0 1 5.5 7h2.2l1.4-2h5.8l1.4 2h2.2A1.5 1.5 0 0 1 20 8.5v9a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 17.5z"/><circle cx="12" cy="12.8" r="3.4"/>`,
  image: `<rect x="3.5" y="5" width="17" height="14" rx="2.5"/><circle cx="9" cy="10" r="1.6"/><path d="m4 17 5-4.5 3.5 3 3-2.5 4.5 4"/>`,
  hand: `<path d="M8 12.5V6.6a1.35 1.35 0 0 1 2.7 0v4.9M10.7 11V5.2a1.35 1.35 0 0 1 2.7 0V11M13.4 11.2V6.4a1.35 1.35 0 0 1 2.7 0v5.3M16.1 11.7V9a1.35 1.35 0 0 1 2.7 0v4.6c0 4.2-2.8 7-6.6 7-2.5 0-4.2-1.1-5.6-3.2L4.3 13.6a1.4 1.4 0 0 1 2.2-1.7L8 13.6"/>`,
  cake: `<path d="M4.5 20.5h15M5.5 20.5v-6a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v6"/><path d="M5.5 15.8c1.2 1 2.4 1 3.6 0s2.4-1 3.6 0 2.4 1 3.6 0 1.6-.6 2.2-.4"/><path d="M12 12.5v-3M12 6.9c-.8-.6-.8-1.6 0-2.9.8 1.3.8 2.3 0 2.9z"/>`,
  cup: `<path d="M5 9h11a3 3 0 0 1 0 6h-.4"/><path d="M5 9v5a5 5 0 0 0 5 5h1a5 5 0 0 0 5-5V9"/><path d="M8 4.5c0 1-1 1.2-1 2.2M11 4.5c0 1-1 1.2-1 2.2"/>`,
  iced: `<path d="M6.5 7.5h11l-1.3 12.2a1.5 1.5 0 0 1-1.5 1.3H9.3a1.5 1.5 0 0 1-1.5-1.3z"/><path d="M13 7.5 15.5 3M9.5 12.5l2 1.5M12.5 15l1.6-1"/>`,
  leaf: `<path d="M5 19c0-8 5-13 14-13-1 9-5 13-13 13z"/><path d="M5 19c3-4 6-7 10-9"/>`,
  drop: `<path d="M12 3.5s-6 6.4-6 10.5a6 6 0 0 0 12 0c0-4.1-6-10.5-6-10.5z"/>`,
  bean: `<ellipse cx="12" cy="12" rx="6" ry="8.2" transform="rotate(35 12 12)"/><path d="M8.3 17.2c2.9-1.4 3-4.8 3.7-5.2.8-.5 1-3.8 3.7-5.2"/>`,
  mail: `<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="m4.5 7 7.5 6 7.5-6"/>`,
  eye: `<path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z"/><circle cx="12" cy="12" r="3"/>`,
  idcard: `<rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><circle cx="9" cy="11" r="2.2"/><path d="M5.8 16c.5-1.5 1.7-2.3 3.2-2.3s2.7.8 3.2 2.3M14.5 10h3.5M14.5 13h2.5"/>`,
  copy: `<rect x="8.5" y="8.5" width="11" height="11" rx="2.5"/><path d="M15.5 8.5V6A1.5 1.5 0 0 0 14 4.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/>`,
  bike: `<circle cx="6" cy="16.5" r="3.5"/><circle cx="18" cy="16.5" r="3.5"/><path d="M6 16.5 9.5 9h5l3.5 7.5M9.5 9 8 6H5.5M14.5 9l-2.5 7.5"/>`,
  building: `<path d="M3.5 20.5h17"/><path d="M5 20.5V9.5h14v11"/><path d="M4 9.5 6 4.5h12l2 5"/><path d="M9.5 20.5v-6h5v6"/>`,
  fire: `<path d="M12 3.5c1 3.2 4.5 4.4 4.5 8.7a4.5 4.5 0 0 1-9 0c0-1.6.6-2.6 1.3-3.4.2 1.1.8 1.9 1.7 2.2C10 8.4 10.2 5.6 12 3.5z"/>`,
  bulb: `<path d="M9 17.5h6M10 20.5h4M12 3.5a5.5 5.5 0 0 0-3.2 10c.8.6 1.2 1.5 1.2 2.5v1.5h4V16c0-1 .4-1.9 1.2-2.5A5.5 5.5 0 0 0 12 3.5z"/>`,
  ticket: `<path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h13A1.5 1.5 0 0 1 20 7.5V10a2 2 0 0 0 0 4v2.5a1.5 1.5 0 0 1-1.5 1.5h-13A1.5 1.5 0 0 1 4 16.5V14a2 2 0 0 0 0-4z"/><path d="M14.5 6v12" stroke-dasharray="1.5 2"/>`,
};

export const icon = (name, extra = "") => wrap(ICONS[name] || ICONS.info, extra);
export const has = (name) => name in ICONS;
