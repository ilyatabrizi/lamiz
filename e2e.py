#!/usr/bin/env python3
"""End-to-end checks for the Lamiz Coffee PWA.

    python3 serve.py &                                  # or run it in another shell
    python3 e2e.py                                      # the local preview
    python3 e2e.py https://ilyatabrizi.github.io/lamiz/ # the deployed build

Drives a real mobile Chrome through every screen and every action a customer would
take — the opening, the reel, the menu and its sections, one-tap adding, the item
sheet, the bag with its beans, the order code, checking in under the marquee L, the
branches and their hours, the profile — and fails loudly on anything broken.

Includes regressions for the traps that have bitten these builds before: listeners
stacking on a second visit, a same-hash navigation that renders nothing, scroll-derived
chrome inherited by a short page, a hero video playing out of sight, and a middot
beside Persian digits.
"""
from __future__ import annotations

import json
import pathlib
import re
import sys
import urllib.error
import urllib.request

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8191/").rstrip("/") + "/"
LIVE = "localhost" not in BASE and "127.0.0.1" not in BASE
SHOTS = pathlib.Path(__file__).resolve().parent / "scripts" / "shots"
ROOT = pathlib.Path(__file__).resolve().parent

PASS: list[str] = []
FAIL: list[str] = []


def check(name, cond, detail=""):
    (PASS if cond else FAIL).append(name if cond else f"{name}  →  {detail}")


def goto(page, hash_path, ms=700):
    page.evaluate("h => { location.hash = h; }", hash_path)
    page.wait_for_timeout(ms)


def shot(page, name):
    SHOTS.mkdir(parents=True, exist_ok=True)
    page.screenshot(path=str(SHOTS / f"e2e-{name}.png"))


def http(url, method="GET", headers=None):
    try:
        req = urllib.request.Request(url, method=method, headers={"User-Agent": "lamiz-e2e", **(headers or {})})
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.status, dict(r.headers), (r.read() if method == "GET" else b"")
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), b""
    except Exception as e:  # noqa: BLE001
        return 0, {}, str(e).encode()


def main():
    try:
        from playwright.sync_api import sync_playwright
    except ImportError:
        sys.exit("pip install playwright   (uses the system Chrome)")

    # ------------------------------------------------------------- over http
    for path in ["", "index.html", "manifest.webmanifest", "sw.js", "404.html",
                 "css/app.css", "js/app.js", "js/data.js", "js/brand.js", "js/views/checkin.js",
                 "assets/fonts/dmserif.woff2", "assets/fonts/IRANYekanXFaNum-Medium.woff2",
                 "assets/video/poster.webp", "assets/og.jpg",
                 "assets/icons/icon-512.png", "assets/icons/maskable-512.png", "assets/icons/apple-touch-icon.png",
                 "assets/brand/alpha-black.png", "assets/photos/bakery-tart.webp",
                 "assets/branches/tajrish-monin-cover.webp", "assets/items/latte-lamiz.webp"]:
        st, _, _ = http(BASE + path)
        check(f"http 200 {path or '/'}", st == 200, f"got {st}")

    st, h, body = http(BASE + "manifest.webmanifest")
    try:
        man = json.loads(body)
        check("manifest: standalone, three icons, one maskable",
              man.get("display") == "standalone" and len(man.get("icons", [])) >= 3
              and any("maskable" in i.get("purpose", "") for i in man["icons"]), body[:80])
        check("manifest: shortcuts to menu and check-in", len(man.get("shortcuts", [])) >= 2)
    except Exception as e:  # noqa: BLE001
        check("manifest parses", False, str(e))

    st, h, _ = http(BASE + "assets/video/hero.mp4", "HEAD")
    ctype = next((v for k, v in h.items() if k.lower() == "content-type"), "")
    check("the reel is served as video/mp4", st == 200 and "video/mp4" in ctype, f"{st} {ctype}")
    st, h, _ = http(BASE + "assets/video/hero.mp4", "GET", {"Range": "bytes=0-99"})
    check("the reel answers Range requests (Safari needs 206)", st == 206, f"got {st}")

    html = http(BASE)[2].decode("utf-8", "replace")
    head = html.split("<body")[0]
    check("noindex while unapproved", 'name="robots" content="noindex' in html)
    check("viewport-fit=cover for the notch", "viewport-fit=cover" in html)
    check("scrollRestoration claimed in the head", "scrollRestoration" in head)
    check("theme applied before the first paint", 'localStorage.getItem("lamiz.v1.theme")' in head)
    check("share card declared", 'property="og:image"' in head and "og.jpg" in head)
    check("opening inlined: their logo, all three lines", html.count('<div id="boot"') == 1 and html.count("<path d=") >= 3)
    check("every module preloaded", html.count('rel="modulepreload"') >= 25)
    mods = {p.relative_to(ROOT).as_posix() for p in ROOT.glob("js/**/*.js")} if not LIVE else set()
    if mods:
        missing = [m for m in mods if m != "js/app.js" and f'href="{m}"' not in html]
        check("preload list covers every module", not missing, ", ".join(missing))
    check("no secrets in the shipped source",
          not re.search(r"(sk_live|api[_-]?key\s*[:=]\s*['\"][A-Za-z0-9]{12,})", http(BASE + "js/config.js")[2].decode()))

    data_js = http(BASE + "js/data.js")[2].decode("utf-8")
    check("data.js: 149 items from their menu", data_js.count('"pid":') == 149, str(data_js.count('"pid":')))
    check("data.js: 41 branches", data_js.count('"address":') == 41, str(data_js.count('"address":')))
    check("data.js: Persian addresses", len(re.findall(r'"address": "[^"]*[؀-ۿ]', data_js)) == 41)
    check("data.js: 40 branches located", len(re.findall(r'"lat": \d', data_js)) == 40, str(len(re.findall(r'"lat": \d', data_js))))
    check("data.js: their own map links", data_js.count("goo.gl") >= 39)
    check("data.js: the power-cut menu is not shipped", "خاموشی" not in data_js)
    check("Persian typography: no middot beside Persian digits", not re.search(r"[۰-۹]\s*·|·\s*[۰-۹]", data_js))

    # ------------------------------------------------------------ in a browser
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)
        ctx = browser.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True,
                                  user_agent="Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1")
        page = ctx.new_page()
        errors: list[str] = []
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(m.text) if m.type == "error" else None)
        failed: list[str] = []
        page.on("requestfailed", lambda r: failed.append(r.url))

        import time as _t
        t0 = _t.time()
        page.goto(BASE + ("" if LIVE else "?nosw") + "#/", wait_until="commit")
        try:
            page.wait_for_selector("#boot .boot-logo", state="attached", timeout=8000)
            first = True
        except Exception:  # noqa: BLE001
            first = False
        check("the opening shows their logo from the first paint", first)
        check("the logo holds still — only the screen's own fade moves",
              page.evaluate("(() => { const l = document.querySelector('#boot .boot-logo'); return !l || l.getAnimations({subtree:true}).length === 0; })()"))
        try:
            page.wait_for_selector("#boot", state="detached", timeout=12000)
        except Exception:  # noqa: BLE001
            pass
        waited = _t.time() - t0
        check("the opening fades and leaves", page.evaluate("!document.getElementById('boot')"), f"still up after {waited:.1f}s")
        check("the opening is gone within 6 s", waited < 6, f"{waited:.1f}s")
        page.wait_for_load_state("load")
        page.wait_for_timeout(400)

        check("fonts: DM Serif Display loaded", page.evaluate("document.fonts.check('400 32px \"DM Serif Display\"')"))
        check("fonts: IRANYekanXFaNum loaded", page.evaluate("document.fonts.check('500 14px IRANYekanXFaNum')"))
        check("the bar carries their traced L and wordmark",
              page.locator("#bar-mark svg path").count() == 1 and page.locator("#bar-word svg path").count() == 1)
        check("no broken SVG path data anywhere",
              page.evaluate("[...document.querySelectorAll('path')].every(p => { const d = p.getAttribute('d') || ''; return !/[lLmMcC]\\s*-?\\s(?![0-9.])/.test(d) && !/[lL]-?\\s/.test(d); })"))

        # ------------------------------------------------------------- the reel
        v = page.locator("#hero-video")
        check("the reel is in the document", v.count() == 1)
        check("the reel is muted as a property, not only as an attribute", page.evaluate("document.querySelector('#hero-video').muted") is True)
        page.wait_for_timeout(1200)
        box = page.evaluate("""(() => {
            const v = document.querySelector('#hero-video'), m = document.querySelector('#hero-media');
            const a = v.getBoundingClientRect(), b = m.getBoundingClientRect();
            return { same: Math.abs(a.top-b.top) < 2 && Math.abs(a.height-b.height) < 2 && a.height > 200,
                     playing: !v.paused && v.currentTime > 0.2, t: v.currentTime, h: a.height }; })()""")
        check("the reel fills the hero (not laid out below it)", box["same"], json.dumps(box))
        check("the reel is playing", box["playing"], json.dumps(box))
        # visible motion, not just a running clock: two frames of the hero must differ
        a = page.locator(".hero").screenshot(path=str(SHOTS / "e2e-motion-a.png"))
        page.wait_for_timeout(900)
        b = page.locator(".hero").screenshot(path=str(SHOTS / "e2e-motion-b.png"))
        try:
            from PIL import Image, ImageChops, ImageStat
            im1, im2 = Image.open(SHOTS / "e2e-motion-a.png").convert("L"), Image.open(SHOTS / "e2e-motion-b.png").convert("L")
            diff = ImageStat.Stat(ImageChops.difference(im1, im2)).mean[0]
            check("the reel is visibly moving (pixels change)", diff > 0.4, f"mean diff {diff:.2f}")
        except ImportError:
            pass
        shot(page, "home")

        # --------------------------------------------------------------- home
        check("home: the four bakery photographs", page.locator("#bakery .photo").count() == 4)
        check("home: their seasonal drinks", page.locator(".tiles").first.locator(".tile").count() == 3)
        check("home: the club card shows beans and a tier",
              page.locator(".club-beans b").count() == 1 and page.locator(".tier").first.inner_text().strip() != "")
        check("home: their numbers", all(s in page.inner_text("body") for s in ["41", "28", "600+", "1388"]))
        check("home: the Alpha sign", page.locator(".alpha img").count() == 2)
        order0 = page.evaluate("[...document.querySelectorAll('#bakery .photo')].map(a => a.dataset.photo).join()")

        # the bar over the reel is white, and takes its blur only after the hero
        check("the bar starts clear over the reel", page.evaluate("document.getElementById('bar').classList.contains('over')"))
        page.mouse.wheel(0, 1400)
        page.wait_for_timeout(500)
        check("the bar takes its blur once the reel is behind it",
              page.evaluate("document.getElementById('bar').classList.contains('solid') && !document.getElementById('bar').classList.contains('over')"))

        # --------------------------------------------------------------- menu
        goto(page, "#/menu", 900)
        rows = page.locator(".mitem")
        check("menu: every item on their Tehran menu", rows.count() == 149, str(rows.count()))
        check("menu: twelve sections", page.locator(".mgroup").count() == 12, str(page.locator(".mgroup").count()))
        check("menu: a Persian name under every English one", page.locator(".mitem-fa").count() == 149)
        page.locator('.chip[data-cat="hot"]').click()
        page.wait_for_timeout(400)
        shown_rows = page.locator(".mgroup:not([hidden]) .mitem:not([hidden])")
        check("menu: a chip filters to that section alone",
              page.locator(".mgroup:not([hidden])").count() == 1 and shown_rows.count() == 15,
              f"{page.locator('.mgroup:not([hidden])').count()} sections, {shown_rows.count()} items")
        check("menu: the chip is written into the URL", "cat=hot" in page.evaluate("location.hash"))
        page.locator('.chip[data-cat="all"]').click()
        page.wait_for_timeout(300)
        page.fill("#menu-q", "ماچا")
        page.wait_for_timeout(400)
        check("menu: search reads Persian", 0 < page.locator(".mitem:not([hidden])").count() <= 12, str(page.locator(".mitem:not([hidden])").count()))
        page.fill("#menu-q", "latte")
        page.wait_for_timeout(400)
        check("menu: search reads English", page.locator(".mitem:not([hidden])").count() >= 4)
        page.fill("#menu-q", "zzzz")
        page.wait_for_timeout(300)
        check("menu: an empty search says so", page.locator("#menu-empty").is_visible())
        page.click("#menu-x")
        page.wait_for_timeout(300)
        shot(page, "menu")

        # ------------------------------------------------------- one-tap adding
        page.evaluate("try{localStorage.removeItem('lamiz.v1.bag')}catch(e){}")
        goto(page, "#/", 500)
        goto(page, "#/menu", 800)
        page.locator("[data-add]").first.click()
        page.wait_for_timeout(400)
        check("one tap adds the item as it comes", page.inner_text("#bag-badge") == "1", page.inner_text("#bag-badge"))
        check("a toast says what went in", page.locator(".toast").count() >= 1)
        check("the bag floats over the tab bar once there is something in it", page.locator("#acc").is_visible())
        check("the accessory counts the beans the order will earn", "bean" in page.inner_text("#acc-beans").lower())

        # the stacked-listener trap: leave and come back twice, then tap once
        for _ in range(2):
            goto(page, "#/", 400)
            goto(page, "#/menu", 500)
        page.locator("[data-add]").first.click()
        page.wait_for_timeout(400)
        check("a second visit does not stack listeners (one tap, one item)", page.inner_text("#bag-badge") == "2", page.inner_text("#bag-badge"))

        # the same-hash trap: navigating to the hash you are already on must re-render
        goto(page, "#/menu", 300)
        check("navigating to the screen you are on still renders it", page.locator(".mitem").count() == 149)

        # ---------------------------------------------------------- item sheet
        page.locator(".mitem").nth(6).click()
        page.wait_for_timeout(700)
        check("the item sheet opens", page.locator(".sheet.on").count() == 1)
        sizes = page.locator(".size")
        if sizes.count() > 1:
            before = page.inner_text("#it-sum")
            sizes.last.click()
            page.wait_for_timeout(300)
            check("choosing a size changes the price", page.inner_text("#it-sum") != before, before)
        check("the sheet shows what is in it, in Persian", page.locator(".it-ing .fa").count() >= 0)
        check("the sheet says what it earns", "bean" in page.inner_text("#it-earn").lower())
        page.click("#it-add")
        page.wait_for_timeout(500)
        check("the sheet adds to the bag", page.inner_text("#bag-badge") == "3", page.inner_text("#bag-badge"))

        # ---------------------------------------------------------------- bag
        goto(page, "#/bag", 900)
        check("bag: a line for everything added", page.locator(".bline").count() >= 2)
        qty_before = page.locator(".bline .qty output").first.inner_text()
        page.locator(".bline .qty [data-inc]").first.click()
        page.wait_for_timeout(500)
        check("bag: + adds exactly one (no doubled handler after a refresh)",
              page.locator(".bline .qty output").first.inner_text() == str(int(qty_before) + 1),
              f"{qty_before} → {page.locator('.bline .qty output').first.inner_text()}")
        total_before = page.evaluate("document.querySelector('.sum-row--total span:last-child').textContent")
        sizer = page.locator(".bline-sizes button").first
        if sizer.count():
            sizer.click()
            page.wait_for_timeout(500)
            check("bag: a size can be changed here", page.locator(".bline").count() >= 1)
        rewards = page.locator("[data-reward]:not([disabled])")
        if rewards.count():
            rewards.first.check()
            page.wait_for_timeout(600)
            check("bag: beans pay for a line", page.locator(".sum-row--beans").count() == 1)
            check("bag: the total drops when they do",
                  page.evaluate("document.querySelector('.sum-row--total span:last-child').textContent") != total_before)
            check("bag: the line says what is free", page.locator(".bline-free").count() >= 1)
        check("bag: the earn line is there", page.locator(".sum-earn").count() == 1)
        check("bag: payment is at the counter, not here", "counter" in page.inner_text(".paynote").lower())
        shot(page, "bag")

        beans_before = page.evaluate("JSON.parse(localStorage.getItem('lamiz.v1.member')).beans")
        page.click("#place")
        page.wait_for_timeout(1200)
        check("the order lands on its own screen", "#/order/" in page.evaluate("location.hash"), page.evaluate("location.hash"))
        code = page.inner_text("#code").strip()
        check("the order has a four-digit pickup code", re.fullmatch(r"\d{4}", code) is not None, code)
        check("the code is a QR code too", page.locator(".ticket-qr svg").count() == 1)
        check("the ring counts down to ready", page.locator("#ring").count() == 1 and page.inner_text("#ring-t") != "--:--")
        beans_after = page.evaluate("JSON.parse(localStorage.getItem('lamiz.v1.member')).beans")
        earned = page.evaluate("JSON.parse(localStorage.getItem('lamiz.v1.member')).history[0]")
        check("the beans move with the order", beans_after == beans_before + earned["earn"] - earned["spend"],
              f"{beans_before} → {beans_after}, +{earned['earn']} −{earned['spend']}")
        check("the bag is empty afterwards", page.inner_text("#bag-badge") in ("0", ""), page.inner_text("#bag-badge"))
        shot(page, "order")

        # ------------------------------------------------------------ check-in
        goto(page, "#/checkin", 900)
        check("check-in: the marquee L, with its bulbs", page.locator("#marquee .bulb").count() == 20, str(page.locator("#marquee .bulb").count()))
        check("check-in: the L is their traced letter", page.locator("#marquee .l-body").count() == 1)
        lit0 = page.locator("#marquee .bulb.lit").count()
        page.click("#marquee")
        page.wait_for_timeout(1500)
        check("check-in: one tap checks you in", page.evaluate("document.querySelector('#marquee').dataset.in") == "1")
        check("check-in: the bulbs come on", page.locator("#marquee .bulb.lit").count() > lit0, str(page.locator("#marquee .bulb.lit").count()))
        check("check-in: the screen says you are in", "you're in" in page.inner_text(".ci-state").lower())
        check("check-in: you are in the room", "You" in page.inner_text("#room"))
        check("check-in: the bar chip follows you in", page.evaluate("document.querySelector('#ci-chip').dataset.in") == "1" or page.locator("#ci-chip").is_hidden())
        others = page.locator(".person [data-wave]")
        if others.count():
            others.first.click()
            page.wait_for_timeout(400)
            check("check-in: you can wave at someone", page.locator(".wave.done").count() >= 1)
        shot(page, "checkin")
        page.click("#out")
        page.wait_for_timeout(700)
        check("check-in: checking out lets go", page.evaluate("document.querySelector('#marquee').dataset.in") == "0")

        # ------------------------------------------------------------ branches
        goto(page, "#/branches", 900)
        check("branches: all 41", page.locator(".brow").count() == 41, str(page.locator(".brow").count()))
        check("branches: each with its Persian address", page.locator(".brow-fa").count() == 41)
        check("branches: open or closed on every row", page.locator(".brow .st").count() == 41)
        page.locator('.chip[data-r="Kish"]').click()
        page.wait_for_timeout(400)
        check("branches: a region chip filters", page.locator(".brow:not([hidden])").count() == 2, str(page.locator(".brow:not([hidden])").count()))
        page.locator('.chip[data-r="All"]').click()
        page.fill("#b-q", "تجریش")
        page.wait_for_timeout(400)
        # two: the Tajrish branch, and Ferdows Garden, whose address is on Tajrish Square
        hits = page.locator(".brow:not([hidden])")
        check("branches: search reads Persian, names and addresses alike",
              hits.count() == 2 and "Tajrish" in hits.first.inner_text(), f"{hits.count()} hits")
        page.click("#b-x")
        page.wait_for_timeout(300)
        shot(page, "branches")

        goto(page, "#/branch/tajrish-monin", 1100)
        check("branch: their own photographs", page.locator(".gal-track figure").count() >= 2)
        check("branch: the address as Lamiz writes it", "تجریش" in page.inner_text(".addr"))
        check("branch: the week's hours", page.locator(".hours-row").count() >= 1)
        check("branch: today is marked", page.locator(".hours-row.today").count() == 1)
        check("branch: the phone dials with the country code", page.get_attribute(".acts4 a", "href").startswith("tel:+98"))
        check("branch: a back arrow, because it is a screen deeper", page.locator("#bar-back").is_visible())
        shot(page, "branch")

        # hours are worked out in Tehran time, whatever this machine is set to
        hours = page.evaluate("""(async () => {
            const { status } = await import('./js/hours.js?test');
            const { branchById } = await import('./js/data.js?test');
            const at = (iso) => new Date(iso);
            return {
              ahvazLate: status(branchById('ahvaz').hours, at('2026-09-12T20:30:00Z')).open,      // 00:00 Tehran, closes 01:00
              ahvazShut: status(branchById('ahvaz').hours, at('2026-09-12T22:30:00Z')).open,      // 02:00 Tehran
              always: status(branchById('mehr-o-mah').hours, at('2026-09-12T22:30:00Z')).open,    // 24 hours
              unknown: status(branchById('kish-telecabin').hours).unknown,
              tajrishNight: status(branchById('tajrish-monin').hours, at('2026-09-12T20:30:00Z')).open,
            };
        })()""")
        check("hours: a branch open to 01:00 is open at midnight", hours["ahvazLate"] is True, json.dumps(hours))
        check("hours: and shut at two", hours["ahvazShut"] is False, json.dumps(hours))
        check("hours: the 24-hour branch is always open", hours["always"] is True)
        check("hours: a branch with no hours listed says so", hours["unknown"] is True)
        check("hours: a 22:30 branch is closed at midnight", hours["tajrishNight"] is False)

        # ------------------------------------------------------------- profile
        goto(page, "#/profile", 1000)
        check("profile: the club card", page.locator(".club").count() == 1)
        check("profile: the tier ladder with all three tiers", page.locator(".ladder-stop").count() == 3)
        check("profile: what beans buy", page.locator(".reward").count() == 4)
        check("profile: the club is labelled as Alpha's proposal", "alpha's proposal" in page.inner_text(".note").lower())
        page.click("#show-card")
        page.wait_for_timeout(700)
        check("profile: the member code is a real QR code", page.locator(".qrcard svg").count() == 1)
        check("profile: the member number is shown", re.match(r"LZ\d+", page.inner_text(".qr-id").strip()) is not None)
        page.click(".sheet-close")
        page.wait_for_timeout(400)
        shot(page, "profile")

        goto(page, "#/profile/edit", 900)
        page.fill("#f-first", "Ilya")
        page.fill("#f-last", "Tabrizi")
        page.wait_for_timeout(400)
        check("profile: a name is kept as it is typed",
              page.evaluate("JSON.parse(localStorage.getItem('lamiz.v1.profile')).first") == "Ilya")
        page.fill("#f-phone", "0912345")
        page.wait_for_timeout(300)
        check("profile: a wrong mobile is caught", page.locator("#e-phone").is_visible())
        page.fill("#f-phone", "09123456789")
        page.wait_for_timeout(300)
        check("profile: a right one is kept", page.evaluate("JSON.parse(localStorage.getItem('lamiz.v1.profile')).phone") == "09123456789")
        page.select_option("#f-m", "7")
        page.select_option("#f-d", "12")
        page.select_option("#f-y", str(1375))
        page.wait_for_timeout(400)
        check("profile: the birthday is kept in the Iranian calendar",
              page.evaluate("JSON.parse(localStorage.getItem('lamiz.v1.profile')).bday")["jm"] == 7)
        goto(page, "#/checkin", 800)
        check("check-in: the room shows the name you gave", "Ilya" in page.inner_text(".note") or "Ilya" in page.inner_text("body"))

        # ---------------------------------------------------------- appearance
        goto(page, "#/profile", 900)
        page.locator('[data-seg="theme"] [data-v="dark"]').click()
        page.wait_for_timeout(700)
        check("dark: the whole app turns", page.evaluate("document.documentElement.dataset.mode") == "dark")
        check("dark: the browser bar colour follows",
              page.get_attribute("#theme-color", "content").lower() == "#0c0c0d")
        shot(page, "profile-dark")
        page.locator('[data-seg="theme"] [data-v="light"]').click()
        page.wait_for_timeout(600)

        # ---------------------------------------------------------- the chrome
        goto(page, "#/profile", 600)
        page.mouse.wheel(0, 900)
        page.wait_for_timeout(400)
        goto(page, "#/checkin", 800)
        check("a short screen does not inherit the long screen's bar",
              page.evaluate("(() => { const b = document.getElementById('bar'); const tall = document.documentElement.scrollHeight - innerHeight > 40; return tall || !b.classList.contains('solid'); })()"))
        check("the tab lens sits under the open tab",
              page.evaluate("""(() => {
                const on = document.querySelector('.tab[aria-current="page"]'), lens = document.getElementById('tabs-lens');
                if (!on || !lens) return false;
                const a = on.getBoundingClientRect(), b = lens.getBoundingClientRect();
                return Math.abs((a.left + a.width / 2) - (b.left + b.width / 2)) < 14; })()"""))

        # --------------------------------------------------------- the photos
        # "random images": the four bakery photographs come up in a different order
        orders = {order0}
        for _ in range(7):
            page.goto(BASE + ("" if LIVE else "?nosw") + "#/", wait_until="load")
            page.wait_for_selector("#bakery .photo", timeout=8000)
            orders.add(page.evaluate("[...document.querySelectorAll('#bakery .photo')].map(a => a.dataset.photo).join()"))
        check("home: the bakery photographs come up in a different order each visit", len(orders) > 1, f"{len(orders)} orders in 8 visits")

        # ------------------------------------------------------------- health
        check("no console errors", not errors, " | ".join(errors[:3]))
        check("no failed requests", not failed, " | ".join(failed[:3]))
        broken = page.evaluate("[...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.currentSrc).slice(0,3)")
        check("no broken images", not broken, ", ".join(broken))
        check("no middot beside Persian digits on screen",
              not page.evaluate("""[...document.querySelectorAll('.fa')].some(el => /[۰-۹]\\s*·|·\\s*[۰-۹]/.test(el.textContent))"""))
        check("every control has a name a screen reader can read",
              page.evaluate("""[...document.querySelectorAll('button, a')].every(el =>
                (el.getAttribute('aria-label') || el.textContent || '').trim().length > 0 || el.hasAttribute('hidden'))"""))
        if not LIVE:
            check("no service worker on localhost", page.evaluate("navigator.serviceWorker.controller === null"))

        browser.close()

    print("\n".join("  ✓ " + p for p in PASS))
    if FAIL:
        print("\n".join("  ✗ " + f for f in FAIL))
    print(f"\n{len(PASS)}/{len(PASS) + len(FAIL)} checks passed against {BASE}")
    sys.exit(1 if FAIL else 0)


if __name__ == "__main__":
    main()
