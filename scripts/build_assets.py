#!/usr/bin/env python3
"""Turn Lamiz's own material into the files the app ships.

Sources (never committed — the client's originals, and what lamizcoffee.com serves):
  scripts/src/logo.png                  their transparent logo, as supplied
  scripts/src/photo-*.png               the four bakery photos, as supplied
  scripts/src/reel-trimmed-noaudio.mp4  the bakery reel, cut at 21.8 s (before its black
                                        end card) with avconvert, audio removed by
                                        scripts/strip_audio.py
  scripts/src/dl/                       downloads from lamizcoffee.com, cached

Outputs (committed):
  js/brand.js + assets/brand/*.svg      the L, the Persian line and LAMIZ COFFEE, traced
  assets/icons/*.png, assets/og.jpg     PWA icons and the link-preview card
  assets/items/<name>.webp              menu photographs, exactly as their site serves them
  assets/branches/<slug>-cover.webp     each branch's own cover (its featured image)
  assets/branches/<slug>-<n>.webp       up to four interior photographs per branch
  assets/photos/bakery-<name>.webp      the four supplied photographs
  assets/video/hero.mp4 + poster.webp   the reel and its first frame
  scripts/cache/assets.json             what exists, read by build_data.py

    python3 scripts/build_assets.py                 # everything
    python3 scripts/build_assets.py dl logo items   # just those steps
"""
import concurrent.futures as cf
import io
import json
import pathlib
import re
import shutil
import subprocess
import sys
import urllib.parse
import urllib.request

import numpy as np
from PIL import Image, ImageDraw, ImageFilter

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "scripts" / "src"
DL = SRC / "dl"
CACHE = ROOT / "scripts" / "cache"
UA = "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36"

INK = (14, 14, 16)
PAPER = (246, 244, 241)
SKIP_TABS = {7}          # "منو خاموشی" — the power-cut menu: situational, duplicates other tabs at other prices


def load(name):
    return json.loads((CACHE / name).read_text(encoding="utf-8"))


def fetch(url, dest):
    """Download once. Paths on their server carry zero-width spaces, so quote them."""
    if dest.exists() and dest.stat().st_size > 0:
        return dest
    parts = urllib.parse.urlsplit(url)
    safe = urllib.parse.urlunsplit(parts._replace(path=urllib.parse.quote(parts.path, safe="/%")))
    dest.parent.mkdir(parents=True, exist_ok=True)
    last = None
    for _ in range(3):
        try:
            with urllib.request.urlopen(urllib.request.Request(safe, headers={"User-Agent": UA}), timeout=60) as r:
                data = r.read()
            dest.write_bytes(data)
            return dest
        except Exception as e:  # noqa: BLE001 — retried, then reported
            last = e
    raise RuntimeError(f"{url}: {last}")


def slugify(s):
    s = urllib.parse.unquote(s)
    s = re.sub(r"[​-‏]", "", s)
    s = re.sub(r"[^A-Za-z0-9]+", "-", s).strip("-").lower()
    return s


# ---------------------------------------------------------------- downloads
# A branch page sometimes shows another branch's photographs (Babolsar carries a
# Mehrshahr interior, Ahvaz a Kish one) and many reuse a neighbour's map. The cover
# is taken from the branch's own featured image; interiors must carry a token of
# the branch's own name in the file name.
INTERIOR = {
    "4rahvaliasr": ["4rah"], "ahvaz": ["ahvaz-inside"], "ajudaniyeh": ["ajudaniyeh-"], "argentina": ["argentina-inside"],
    "babolsar": ["babolsar-inside"], "bagh-ferdows": ["inside-branches-bagh-ferdos"], "enghelab": ["inside-branches-enghelab"],
    "fakharmoghadam": ["fakharmoghadam"], "farmanieh": ["inside-branches-farmaneh"], "fatemi": ["inside-branches-fatemi"],
    "ferdows-boulevard": ["blvd-ferdows-inside"], "gisha": ["inside-branche-gisha"], "golestan": ["golestan-inside"],
    "haft-hoz": ["haft-hoz-inside"], "heravi": ["inside-branche-heravi"], "iranmal": ["inside-branches-iranmal"],
    "isfahan": ["inside-branche-esfahan"], "izadshahr": ["izadshahr-branches-inside"], "jam": ["inside-branche-jam"],
    "jordan-atefi-sharghi": ["jordan-atefi-sharghi-"], "jordan": ["inside-branche-jordan"], "karaj": ["inside-branches-karaj"],
    "kish-telecabin": ["kish-telecabin-one", "kish-telecabin-tow"], "kish": ["inside-branches-kish"],
    "lavasan": ["lavasan0", "lavasan-0"], "mehr-o-mah": ["inside-branches-qom"], "mehrshahr": ["mehrshahr-inside"],
    "mirdamad": ["inside-branches-mirdamad"], "modireat-bridge": ["modireat-bridge-inside"], "motahari": ["inside-branches-motahari"],
    "motel-ghoo": ["/motel-ghoo."], "pasdaran": ["inside-branches-pasdaran"], "paydarfard": ["inside-branches-paydar-fard"],
    "pol-romi": ["inside-branches-pol-romi"], "royan": ["royan-branches-inside"], "saadatabad": ["inside-branches-saadatabad"],
    "shahrak-e-gharb": ["inside-branches-shahrak"], "shiraz": ["shiraz-inside"], "tajrish-monin": ["inside-branches-tajrish"],
    "vanak": ["vanak-branches-inside"], "yousef-abad": ["yosef-abad-cover-inside"],
}
ORDINAL = {"one": 1, "tow": 2, "two": 2, "there": 3, "three": 3, "four": 4, "five": 5, "six": 6, "sex": 6, "seven": 7, "eight": 8}


def interior_rank(url):
    name = url.rsplit("/", 1)[-1].lower()
    for w, n in ORDINAL.items():
        if re.search(rf"[-_]{w}(?:[-_.]|$)", name):
            return n
    m = re.findall(r"(\d+)", name.split(".")[0])
    return int(m[-1]) if m else 0


def plan():
    """Everything to download: menu photographs, branch covers, branch interiors."""
    tabs = load("menu_tabs.json")
    items = sorted({it["img"] for i, t in enumerate(tabs) if i not in SKIP_TABS for it in t["items"] if it["img"]})
    media = {m["id"]: m["source_url"] for m in load("rest_branch_media.json")}
    rest = {r["slug"]: r for r in load("rest_branches.json")}
    raw = {r["slug"]: r for r in load("branches_raw.json")}
    covers, interiors = {}, {}
    for slug, r in raw.items():
        cover = media[rest[slug]["featured_media"]]
        covers[slug] = cover
        toks = INTERIOR[slug]
        pics = [u for u in r["imgs"] if u != cover and "/map-" not in u.lower()
                and any(t in u.lower() for t in toks)]
        interiors[slug] = sorted(pics, key=interior_rank)      # every candidate; the first four that exist ship
    return items, covers, interiors


def local(u, kind):
    return DL / kind / u.split("/uploads/")[1].replace("/", "_")


def dl():
    """Menu photographs and covers must all arrive. An interior their page links to can be
    missing on their own server (Ajudaniyeh-five.webp answers 404) — it is skipped, and
    the branch takes its next interior instead."""
    items, covers, interiors = plan()
    must = [(u, local(u, "items")) for u in items] + [(u, local(u, "branches")) for u in covers.values()]
    may = [(u, local(u, "branches")) for us in interiors.values() for u in us]

    def attempt(job):
        try:
            fetch(*job)
            return None
        except RuntimeError as e:
            return str(e)

    with cf.ThreadPoolExecutor(6) as ex:
        list(ex.map(lambda j: fetch(*j), must))
        missing = [m for m in ex.map(attempt, may) if m]
    print(f"  dl: {len(items)} menu photos, {len(covers)} covers, {len(may) - len(missing)}/{len(may)} interiors")
    for m in missing:
        print(f"     skipped (their server): {m}")


# ----------------------------------------------------------------- the logo
def logo_bands():
    """Their logo is three lines stacked: the L, قهوه لمیز, LAMIZ COFFEE."""
    im = Image.open(SRC / "logo.png").convert("RGBA")
    a = np.asarray(im)[..., 3].astype(float) / 255.0
    rows = np.where(a.max(axis=1) > 0.5)[0]
    bands, start, prev = [], rows[0], rows[0]
    for r in rows[1:]:
        if r - prev > 12:
            bands.append((int(start), int(prev)))
            start = r
        prev = r
    bands.append((int(start), int(prev)))
    assert len(bands) == 3, f"expected three lines in the logo, found {bands}"
    return im, a, bands


def contours(a, y0, y1, tol=0.42):
    """Sub-pixel outlines at the 50% alpha edge — straight where the letter is straight,
    so the L keeps its hairline serifs instead of being rounded off."""
    from skimage import measure
    pad = 3
    ys = max(0, y0 - pad)
    crop = np.pad(a[ys:y1 + pad + 1, :], pad)
    out = []
    for c in measure.find_contours(crop, 0.5):
        if len(c) < 6:
            continue
        poly = measure.approximate_polygon(c, tolerance=tol)
        pts = [(float(col - pad), float(row - pad + ys)) for row, col in poly]
        area = 0.5 * abs(sum(x0 * y1_ - x1 * y0_ for (x0, y0_), (x1, y1_) in zip(pts, pts[1:] + pts[:1])))
        if area >= 3:
            out.append(pts)
    return out


def _n(v):
    """One decimal, as short as SVG allows: 10.0 -> 10, 0.5 -> .5, -0.0 -> 0.
    Never by stripping characters — that is how "10.0" becomes "1" and "-0.0" a bare
    minus sign, which is not a number and voids the whole path."""
    s = f"{v:.1f}"
    if s.endswith(".0"):
        s = s[:-2]
    if s in ("-0", "-"):
        return "0"
    if s.startswith("0."):
        return s[1:]
    if s.startswith("-0."):
        return "-" + s[2:]
    return s


def path_d(rings):
    parts = []
    for ring in rings:
        pts = ring[:-1] if ring[0] == ring[-1] else ring
        if len(pts) < 3:
            continue
        s = f"M{_n(pts[0][0])} {_n(pts[0][1])}"
        prev = pts[0]
        for x, y in pts[1:]:
            dx, dy = _n(x - prev[0]), _n(y - prev[1])
            if dx == "0" and dy == "0":
                continue
            s += f"l{dx} {dy}"
            # walk the ROUNDED path, so a thousand small roundings cannot drift the outline
            prev = (prev[0] + float(dx), prev[1] + float(dy))
        parts.append(s + "z")
    return "".join(parts)


def bbox(rings, m=0.0):
    xs = [x for r in rings for x, _ in r]
    ys = [y for r in rings for _, y in r]
    x0, y0, x1, y1 = min(xs) - m, min(ys) - m, max(xs) + m, max(ys) + m
    return f"{x0:.1f} {y0:.1f} {x1 - x0:.1f} {y1 - y0:.1f}"


def raster(rings, shape):
    """Even-odd fill of the traced outlines, to compare against the source alpha.
    find_contours works in pixel-centre coordinates, and so does skimage.draw.polygon —
    PIL's polygon() fills its own outline too and would fatten every stroke by a pixel."""
    from skimage.draw import polygon
    mask = np.zeros(shape, dtype=bool)
    for ring in rings:
        rr, cc = polygon([y for _, y in ring], [x for x, _ in ring], shape)
        layer = np.zeros(shape, dtype=bool)
        layer[rr, cc] = True
        mask ^= layer
    return mask


def bulbs(a, band, count=20):
    """The marquee L. Their Tajrish branch hangs a light-up L; the check-in button is
    their L with bulbs set along the centre of its stem and foot, measured off the mask."""
    y0, y1 = band
    m = a[y0:y1 + 1] > 0.5
    xs = np.where(m.any(axis=0))[0]
    left, right = int(xs.min()), int(xs.max())
    h = m.shape[0]
    row = m[int(h * .45)]
    run = np.where(row)[0]
    sl, sr = int(run.min()), int(run.max())                    # the stem at mid-height
    sx = (sl + sr) / 2
    col = m[:, int(sr + (right - sr) * .45)]
    run = np.where(col)[0]
    ft, fb = int(run.min()), int(run.max())                    # the foot, clear of the stem
    fy = (ft + fb) / 2
    top = np.where(m[:, int(sx)])[0].min()
    stem_len = fy - (top + (sr - sl) * .55)
    foot_end = right - (fb - ft) * 1.1
    foot_len = foot_end - sx
    step = (stem_len + foot_len) / (count - 1)
    pts = []
    for i in range(count):
        d = i * step
        if d <= stem_len:
            pts.append((sx + left * 0, top + (sr - sl) * .55 + d))
        else:
            pts.append((sx + (d - stem_len), fy))
    r = min(sr - sl, fb - ft) * .19
    return [(round(x + 0.0, 1), round(y + y0, 1)) for x, y in pts], round(r, 1)


def logo():
    im, a, bands = logo_bands()
    names = ["mark", "fa", "word"]
    traced = {n: contours(a, *b) for n, b in zip(names, bands)}
    allr = traced["mark"] + traced["fa"] + traced["word"]
    truth = a > 0.5
    got = raster(allr, a.shape)
    iou = (truth & got).sum() / (truth | got).sum()
    per = {n: ((truth[b[0]:b[1] + 1] & got[b[0]:b[1] + 1]).sum() / max(1, (truth[b[0]:b[1] + 1] | got[b[0]:b[1] + 1]).sum()))
           for n, b in zip(names, bands)}
    print("  logo IoU per line: " + ", ".join(f"{n} {v:.4f}" for n, v in per.items()))
    assert iou > 0.985, f"trace drifted from the logo: IoU {iou:.4f}"
    bulb_pts, bulb_r = bulbs(a, bands[0])
    vb = {n: bbox(r, 0.5) for n, r in traced.items()}
    vb["lockup"] = bbox(allr, 0.5)
    d = {n: path_d(r) for n, r in traced.items()}

    brand = ROOT / "assets" / "brand"
    brand.mkdir(parents=True, exist_ok=True)
    lock = (f'<g class="lk-mark"><path d="{d["mark"]}"/></g>'
            f'<g class="lk-fa"><path d="{d["fa"]}"/></g>'
            f'<g class="lk-word"><path d="{d["word"]}"/></g>')
    for n in names:
        (brand / f"{n}.svg").write_text(
            f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb[n]}" fill="#0E0E10" fill-rule="evenodd"><path d="{d[n]}"/></svg>\n')
    (brand / "logo.svg").write_text(
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="{vb["lockup"]}" fill="#0E0E10" fill-rule="evenodd" role="img" aria-label="Lamiz Coffee">{lock}</svg>\n')

    js = ["// Generated by scripts/build_assets.py — traced from the logo Lamiz supplied (their",
          "// transparent PNG), outline for outline. Never set in a font: the Persian line is their",
          "// drawing, not typesetting.",
          f'export const MARK_VIEWBOX = "{vb["mark"]}";',
          f'export const MARK_PATH = "{d["mark"]}";',
          f'export const FA_VIEWBOX = "{vb["fa"]}";',
          f'export const FA_PATH = "{d["fa"]}";',
          f'export const WORD_VIEWBOX = "{vb["word"]}";',
          f'export const WORD_PATH = "{d["word"]}";',
          f'export const LOCKUP_VIEWBOX = "{vb["lockup"]}";',
          "// The marquee: bulb centres along the L's stem (top to bottom) then its foot (left to right).",
          f"export const BULBS = {json.dumps(bulb_pts)};",
          f"export const BULB_R = {bulb_r};",
          'const svg = (vb, inner, label) => `<svg viewBox="${vb}" fill="currentColor" fill-rule="evenodd" ${label ? `role="img" aria-label="${label}"` : `aria-hidden="true"`} focusable="false">${inner}</svg>`;',
          'export const MARK = svg(MARK_VIEWBOX, `<path d="${MARK_PATH}"/>`);',
          'export const FA_LINE = svg(FA_VIEWBOX, `<path d="${FA_PATH}"/>`);',
          'export const WORD = svg(WORD_VIEWBOX, `<path d="${WORD_PATH}"/>`);',
          'export const LOCKUP = svg(LOCKUP_VIEWBOX, `<g class="lk-mark"><path d="${MARK_PATH}"/></g><g class="lk-fa"><path d="${FA_PATH}"/></g><g class="lk-word"><path d="${WORD_PATH}"/></g>`, "Lamiz Coffee");',
          ""]
    (ROOT / "js" / "brand.js").write_text("\n".join(js), encoding="utf-8")
    kb = (ROOT / "js" / "brand.js").stat().st_size / 1024
    print(f"  logo: bands {bands}, rings mark {len(traced['mark'])} fa {len(traced['fa'])} word {len(traced['word'])}, IoU {iou:.4f}, brand.js {kb:.1f} KB")
    icons(a, bands)


# ------------------------------------------------------------------ icons
def icons(a, bands):
    """Their own icon is the white L on black; the app keeps it."""
    out = ROOT / "assets" / "icons"
    out.mkdir(parents=True, exist_ok=True)
    y0, y1 = bands[0]
    mark = Image.fromarray((a[y0:y1 + 1] * 255).astype(np.uint8))
    mark = mark.crop(mark.getbbox())

    def tile(size, fill, name, bg=INK, ink=(255, 255, 255)):
        canvas = Image.new("RGB", (size, size), bg)
        s = size * fill / mark.height
        g = mark.resize((max(1, round(mark.width * s)), max(1, round(mark.height * s))), Image.LANCZOS)
        canvas.paste(Image.new("RGB", g.size, ink), ((size - g.width) // 2, (size - g.height) // 2), g)
        canvas.save(out / name, optimize=True)

    tile(512, .56, "icon-512.png")
    tile(192, .56, "icon-192.png")
    tile(512, .42, "maskable-512.png")       # the safe zone is the inner 80% circle
    tile(180, .56, "apple-touch-icon.png")
    tile(64, .62, "favicon.png")
    print("  icons: 512, 192, maskable, apple-touch, favicon")


# ------------------------------------------------------------------ items
def items():
    out = ROOT / "assets" / "items"
    out.mkdir(parents=True, exist_ok=True)
    urls, _, _ = plan()
    made = {}
    total = 0
    for u in urls:
        src = DL / "items" / u.split("/uploads/")[1].replace("/", "_")
        name = slugify(u.rsplit("/", 1)[-1].rsplit(".", 1)[0]) + ".webp"
        dest = out / name
        data = src.read_bytes()
        im = Image.open(io.BytesIO(data))
        # Their own file, untouched, wherever it is already light enough — a second
        # compression always costs something. The heavy ones (up to 148 KB for a 384 px
        # square) are re-encoded: 149 of these load over an Iranian mobile connection.
        if im.format == "WEBP" and max(im.size) <= 640 and len(data) <= 60_000:
            dest.write_bytes(data)
        else:
            im = im.convert("RGB")
            im.thumbnail((560, 560), Image.LANCZOS)
            im.save(dest, "WEBP", quality=78, method=6)
            if dest.stat().st_size >= len(data) and im.format == "WEBP":
                dest.write_bytes(data)                  # no gain: keep theirs
        made[u] = f"assets/items/{name}"
        total += dest.stat().st_size
    return_manifest("items", made)
    print(f"  items: {len(made)} photographs, {total / 1024:.0f} KB")


# --------------------------------------------------------------- branches
def branches():
    out = ROOT / "assets" / "branches"
    out.mkdir(parents=True, exist_ok=True)
    _, covers, interiors = plan()
    made, total = {}, 0
    for slug in sorted(covers):
        src = DL / "branches" / covers[slug].split("/uploads/")[1].replace("/", "_")
        im = Image.open(src).convert("RGB")
        side = min(im.size)
        im = im.crop(((im.width - side) // 2, (im.height - side) // 2, (im.width + side) // 2, (im.height + side) // 2))
        im = im.resize((520, 520), Image.LANCZOS) if side > 520 else im
        cover = out / f"{slug}-cover.webp"
        im.save(cover, "WEBP", quality=78, method=6)
        total += cover.stat().st_size
        pics = []
        present = [u for u in interiors[slug] if local(u, "branches").exists()][:4]
        for i, u in enumerate(present, 1):
            src = local(u, "branches")
            p = Image.open(src).convert("RGB")
            # interiors are 2:1 at 2000 px; 1200 is plenty for a phone at 3x
            if p.width > 1200:
                p = p.resize((1200, round(p.height * 1200 / p.width)), Image.LANCZOS)
            dest = out / f"{slug}-{i}.webp"
            p.save(dest, "WEBP", quality=72, method=6)
            total += dest.stat().st_size
            pics.append({"src": f"assets/branches/{slug}-{i}.webp", "w": p.width, "h": p.height})
        made[slug] = {"cover": f"assets/branches/{slug}-cover.webp", "photos": pics}
    return_manifest("branches", made)
    print(f"  branches: {len(made)} covers, {sum(len(v['photos']) for v in made.values())} interiors, {total / 1e6:.1f} MB")


# ----------------------------------------------------------------- photos
PHOTOS = {"16.07.37": "flatlay", "16.07.45": "tart", "16.08.03": "carrot", "16.08.13": "chocolate"}


def photos():
    out = ROOT / "assets" / "photos"
    out.mkdir(parents=True, exist_ok=True)
    made, total = [], 0
    for src in sorted(SRC.glob("photo-*.png")):
        key = src.stem.replace("photo-", "")
        slug = PHOTOS[key]
        im = Image.open(src).convert("RGB")
        dest = out / f"bakery-{slug}.webp"
        im.save(dest, "WEBP", quality=84, method=6)
        total += dest.stat().st_size
        made.append({"src": f"assets/photos/bakery-{slug}.webp", "w": im.width, "h": im.height, "key": slug})
    return_manifest("photos", made)
    print(f"  photos: {len(made)} frames at native size, {total / 1024:.0f} KB")


# ------------------------------------------------------------------ video
def video():
    out = ROOT / "assets" / "video"
    out.mkdir(parents=True, exist_ok=True)
    src = SRC / "reel-trimmed-noaudio.mp4"
    shutil.copyfile(src, out / "hero.mp4")
    frames = SRC / "frames"
    frames.mkdir(exist_ok=True)
    subprocess.run(["swift", str(ROOT / "scripts" / "frames.swift"), str(src), str(frames), "0"],
                   check=True, capture_output=True)
    im = Image.open(frames / "f00.00.png").convert("RGB")
    im.save(out / "poster.webp", "WEBP", quality=80, method=6)
    # a small, heavily blurred copy for the desktop hero's backdrop — decoded once, never scaled up sharp
    bg = im.resize((144, 256), Image.LANCZOS).filter(ImageFilter.GaussianBlur(10))
    bg.save(out / "poster-blur.webp", "WEBP", quality=70)
    mb = (out / "hero.mp4").stat().st_size / 1e6
    print(f"  video: {mb:.2f} MB, poster {(out / 'poster.webp').stat().st_size / 1024:.0f} KB")
    og(im)


def og(frame):
    """The link-preview card: their logo on black beside the reel's first frame."""
    W, H = 1200, 630
    card = Image.new("RGB", (W, H), INK)
    f = frame.copy()
    s = H / f.height
    f = f.resize((round(f.width * s), H), Image.LANCZOS)
    card.paste(f, (W - f.width, 0))
    im, a, bands = logo_bands()
    y0, y1 = bands[0][0], bands[2][1]
    lock = Image.fromarray((a[y0:y1 + 1] * 255).astype(np.uint8))
    lock = lock.crop(lock.getbbox())
    s = 380 / lock.height
    lock = lock.resize((round(lock.width * s), 380), Image.LANCZOS)
    x = (W - f.width - lock.width) // 2
    card.paste(Image.new("RGB", lock.size, (255, 255, 255)), (x, (H - 380) // 2), lock)
    card.save(ROOT / "assets" / "og.jpg", quality=86, optimize=True, progressive=True)
    print("  og: assets/og.jpg")


# --------------------------------------------------------------- manifest
def return_manifest(key, value):
    path = CACHE / "assets.json"
    m = json.loads(path.read_text(encoding="utf-8")) if path.exists() else {}
    m[key] = value
    path.write_text(json.dumps(m, ensure_ascii=False, indent=1), encoding="utf-8")


STEPS = {"dl": dl, "logo": logo, "items": items, "branches": branches, "photos": photos, "video": video}

if __name__ == "__main__":
    wanted = [a for a in sys.argv[1:] if a in STEPS] or list(STEPS)
    for step in wanted:
        STEPS[step]()
