// Offline shell.
//
// Everything the app is made of — the HTML, the CSS, every module, the manifest —
// goes to the network first, with `cache: "reload"` so the request reaches the origin
// rather than the browser's own HTTP cache (GitHub Pages sends max-age=600 on pages,
// and a worker's plain fetch() would honour it, serving a ten-minute-old shell). A
// redeploy changes the shell and the code together, and half a build is worse than an
// old one.
//
// Fonts, the photographs and the icons change name when they change at all, so they
// are cache-first. The reel is left alone: it streams with Range requests.
//
// clients.claim() runs only when this worker REPLACES an older one. On a cold install
// the page keeps the network it started with — claiming mid-flight hands the new
// worker every in-flight image request, and they fail.

const VERSION = "lamiz-02ff5b799f";
const DEV = ["localhost", "127.0.0.1"].includes(location.hostname);
const MARKER = "./__installed__";

const SHELL = [
  "./", "./index.html", "./manifest.webmanifest", "./css/app.css",
  "./js/app.js", "./js/boot.js", "./js/brand.js", "./js/club.js", "./js/config.js", "./js/data.js",
  "./js/geo.js", "./js/hours.js", "./js/icons.js", "./js/install.js", "./js/jalali.js", "./js/lifecycle.js",
  "./js/motion.js", "./js/photo.js", "./js/presence.js", "./js/qr.js", "./js/router.js", "./js/store.js",
  "./js/tabs.js", "./js/theme.js", "./js/ui.js", "./js/util.js",
  "./js/views/home.js", "./js/views/menu.js", "./js/views/bag.js", "./js/views/order.js",
  "./js/views/checkin.js", "./js/views/branches.js", "./js/views/branch.js",
  "./js/views/profile.js", "./js/views/profile-edit.js",
];
const ASSETS = [
  "./assets/fonts/dmserif.woff2",
  "./assets/fonts/IRANYekanXFaNum-Regular.woff2", "./assets/fonts/IRANYekanXFaNum-Medium.woff2",
  "./assets/fonts/IRANYekanXFaNum-DemiBold.woff2", "./assets/fonts/IRANYekanXFaNum-Bold.woff2",
  "./assets/video/poster.webp", "./assets/video/poster-blur.webp",
  "./assets/icons/icon-192.png", "./assets/icons/apple-touch-icon.png",
  "./assets/brand/alpha-black.png", "./assets/brand/alpha-white.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil((async () => {
    const had = (await caches.keys()).some((k) => k.startsWith("lamiz-") && k !== VERSION);
    const cache = await caches.open(VERSION);
    await Promise.allSettled([...SHELL, ...ASSETS].map((url) => cache.add(url)));
    // record whether this is an update or a first install, in the cache itself —
    // install and activate need not share a worker instance
    await cache.put(MARKER, new Response(had ? "update" : "cold"));
    self.skipWaiting();
  })());
});

self.addEventListener("activate", (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)));
    const cache = await caches.open(VERSION);
    const marker = await cache.match(MARKER);
    if (marker && (await marker.text()) === "update") await self.clients.claim();
  })());
});

self.addEventListener("fetch", (e) => {
  const { request } = e;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (url.origin !== location.origin) return;
  if (url.pathname.endsWith("/__installed__")) return;
  // the reel streams with Range requests; leave it to the browser
  if (/\.mp4$/.test(url.pathname)) return;

  if (request.mode === "navigate" || DEV || /\.(?:html|css|js|webmanifest)$/.test(url.pathname)) {
    e.respondWith((async () => {
      try {
        const res = await fetch(new Request(request, { cache: "reload" }));
        if (res.ok) (await caches.open(VERSION)).put(request, res.clone());
        return res;
      } catch {
        return (await caches.match(request))
          || (request.mode === "navigate" ? await caches.match("./index.html") : null)
          || Response.error();
      }
    })());
    return;
  }

  e.respondWith((async () => {
    const hit = await caches.match(request);
    if (hit) return hit;
    try {
      const res = await fetch(request);
      if (res.ok) (await caches.open(VERSION)).put(request, res.clone());
      return res;
    } catch { return Response.error(); }
  })());
});
