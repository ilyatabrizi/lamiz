#!/usr/bin/env python3
"""Walk every screen and photograph it — phone, phone in the dark, and desktop.

    python3 serve.py &
    python3 scripts/visual.py [base-url]

Shots land in scripts/shots/ (gitignored) and are assembled into contact sheets so a
whole pass can be looked at at once. Drives the system Chrome through Playwright.
"""
import pathlib
import sys

from PIL import Image, ImageDraw

BASE = (sys.argv[1] if len(sys.argv) > 1 else "http://localhost:8191/").rstrip("/") + "/"
ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "scripts" / "shots"
PHONE = {"width": 390, "height": 844}
DESK = {"width": 1440, "height": 940}


def sheet(name, files, cols=5, width=300):
    ims = []
    for f in files:
        p = OUT / f
        if not p.exists():
            continue
        im = Image.open(p).convert("RGB")
        im.thumbnail((width, 4000), Image.LANCZOS)
        ims.append((f[:-4], im))
    if not ims:
        return
    rows = (len(ims) + cols - 1) // cols
    heights = [max(i.height for _, i in ims[r * cols:(r + 1) * cols]) + 18 for r in range(rows)]
    canvas = Image.new("RGB", (cols * width, sum(heights)), (26, 26, 28))
    d = ImageDraw.Draw(canvas)
    y = 0
    for r in range(rows):
        for c, (label, im) in enumerate(ims[r * cols:(r + 1) * cols]):
            canvas.paste(im, (c * width, y + 18))
            d.text((c * width + 4, y + 4), label, fill=(255, 255, 255))
        y += heights[r]
    path = OUT / f"sheet-{name}.jpg"
    canvas.save(path, quality=84)
    print(f"  {path.relative_to(ROOT)}  {canvas.size[0]}x{canvas.size[1]}")


def main():
    from playwright.sync_api import sync_playwright
    OUT.mkdir(parents=True, exist_ok=True)
    made = {"phone": [], "dark": [], "desk": []}

    def shot(page, group, name, full=False):
        f = f"{group}-{name}.png"
        page.screenshot(path=str(OUT / f), full_page=full)
        made[group].append(f)

    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", headless=True)

        def session(group, viewport, dark=False, mobile=True):
            ctx = browser.new_context(viewport=viewport, device_scale_factor=2 if mobile else 1,
                                      is_mobile=mobile, has_touch=mobile,
                                      user_agent=("Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 "
                                                  "(KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1") if mobile else None)
            page = ctx.new_page()
            if dark:
                page.add_init_script("try{localStorage.setItem('lamiz.v1.theme','dark')}catch(e){}")
            page.goto(BASE + "?nosw#/", wait_until="load")
            page.wait_for_selector("#boot", state="detached", timeout=12000)
            page.wait_for_timeout(900)
            return ctx, page

        # ---------------------------------------------------------- phone
        for group, dark in (("phone", False), ("dark", True)):
            ctx, page = session(group, PHONE, dark=dark)
            shot(page, group, "home-hero")
            page.mouse.wheel(0, 760); page.wait_for_timeout(700); shot(page, group, "home-quick")
            page.mouse.wheel(0, 900); page.wait_for_timeout(700); shot(page, group, "home-bakery")
            page.mouse.wheel(0, 1500); page.wait_for_timeout(800); shot(page, group, "home-story")

            page.evaluate("location.hash = '#/menu'"); page.wait_for_timeout(900); shot(page, group, "menu")
            page.locator(".mitem").nth(4).click(); page.wait_for_timeout(800); shot(page, group, "item-sheet")
            page.locator(".sheet-close").click(); page.wait_for_timeout(500)
            page.locator("[data-add]").nth(1).click(); page.wait_for_timeout(300)
            page.locator("[data-add]").nth(6).click(); page.wait_for_timeout(700); shot(page, group, "menu-added")

            page.evaluate("location.hash = '#/bag'"); page.wait_for_timeout(900); shot(page, group, "bag", full=True)
            enabled = page.locator("[data-reward]:not([disabled])")
            if enabled.count():
                enabled.first.check(); page.wait_for_timeout(700)
            shot(page, group, "bag-reward", full=True)
            page.locator("#place").click(); page.wait_for_timeout(1100); shot(page, group, "order", full=True)

            page.evaluate("location.hash = '#/checkin'"); page.wait_for_timeout(900); shot(page, group, "checkin")
            page.locator("#marquee").click(); page.wait_for_timeout(1600); shot(page, group, "checkin-in", full=True)

            page.evaluate("location.hash = '#/branches'"); page.wait_for_timeout(900); shot(page, group, "branches")
            page.evaluate("location.hash = '#/branch/tajrish-monin'"); page.wait_for_timeout(1100); shot(page, group, "branch", full=True)
            page.evaluate("location.hash = '#/profile'"); page.wait_for_timeout(900); shot(page, group, "profile", full=True)
            page.locator("#show-card").click(); page.wait_for_timeout(800); shot(page, group, "member-card")
            page.locator(".sheet-close").click(); page.wait_for_timeout(400)
            page.evaluate("location.hash = '#/profile/edit'"); page.wait_for_timeout(900); shot(page, group, "profile-edit")
            ctx.close()

        # -------------------------------------------------------- desktop
        ctx, page = session("desk", DESK, mobile=False)
        shot(page, "desk", "home")
        page.mouse.wheel(0, 1100); page.wait_for_timeout(800); shot(page, "desk", "home-mid")
        page.evaluate("location.hash = '#/menu'"); page.wait_for_timeout(900); shot(page, "desk", "menu")
        page.evaluate("location.hash = '#/checkin'"); page.wait_for_timeout(900); shot(page, "desk", "checkin")
        page.evaluate("location.hash = '#/branches'"); page.wait_for_timeout(900); shot(page, "desk", "branches")
        page.evaluate("location.hash = '#/profile'"); page.wait_for_timeout(900); shot(page, "desk", "profile")
        ctx.close()
        browser.close()

    for g, files in made.items():
        sheet(g, files, cols=5 if g != "desk" else 3, width=300 if g != "desk" else 520)
    print(f"{sum(len(v) for v in made.values())} shots in {OUT.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
