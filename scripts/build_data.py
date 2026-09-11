#!/usr/bin/env python3
"""Build js/data.js from what lamizcoffee.com publishes.

Inputs (scripts/cache/, scraped 2026-09-12 and committed so a rebuild never re-scrapes):
  menu_tabs.json        the 13 tabs of lamizcoffee.com/lamiz-coffee-menu — the Tehran menu,
                        parsed item by item: Persian name, their English name, every size
                        with its price and calories, the contents line, the photograph
  rest_menu.json        /wp-json/wp/v2/lamiz-menu — publish dates (for "New")
  branches_raw.json     the 41 branch pages: name, address, hours, phone, their map link
  branches_geo.json     each map link followed to the place's own coordinates
  rest_branches.json    /wp-json/wp/v2/branches — when each branch was added
  assets.json           what scripts/build_assets.py produced

Nothing here is invented. What the preview decides for itself (the club, the order
flow) lives in js/config.js and says so.

    python3 scripts/build_data.py
"""
import json
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent.parent
CACHE = ROOT / "scripts" / "cache"
load = lambda n: json.loads((CACHE / n).read_text(encoding="utf-8"))

FA_DIGITS = str.maketrans("۰۱۲۳۴۵۶۷۸۹٠١٢٣٤٥٦٧٨٩", "01234567890123456789")

# ------------------------------------------------------------------ the menu
# Their tab order, their Persian labels. Tab 7 ("منو خاموشی", the power-cut menu) is
# left out: it repeats cold drinks from other tabs at other prices, for outages only.
TABS = [
    (0, "hot", "Hot drinks", "نوشیدنی گرم"),
    (1, "cold", "Cold drinks", "نوشیدنی سرد"),
    (2, "season", "Seasonal", "پروموشن فصلی"),
    (3, "matcha", "Matcha", "ماچا"),
    (4, "health", "Health menu", "منو سلامت"),
    (5, "brew", "Brew bar", "قهوه دمی"),
    (6, "tea", "Tea & herbal", "چای و دمنوش"),
    (8, "bakery", "Cakes & pastry", "کیک‌ها"),
    (9, "toast", "Toast bar", "تست‌بار"),
    (10, "croissant", "Croissant sandwiches", "ساندویچ کراسان"),
    (11, "popsicle", "Popsicles", "پاپسیکل"),
    (12, "extras", "Toppings", "تاپینگ‌ها"),
]
SIZE = {"تک‌شات": ("single", "Single", "تک‌شات"), "جفت‌شات": ("double", "Double", "جفت‌شات"),
        "کوچک": ("s", "Small", "کوچک"), "متوسط": ("m", "Medium", "متوسط"), "بزرگ": ("l", "Large", "بزرگ")}
SMALL_WORDS = {"and", "with", "of", "de", "au", "du"}
# Their English names, title-cased. These few read wrong once cased, or carry "Lamiz"
# where every other English name leaves it off (the Persian keeps it).
EN_FIX = {
    36595: "Bulletproof Coffee (Butter)", 36596: "Vegan Bulletproof Coffee (Coconut Oil)",
    58204: "Fruit Chillo with Ice Cream", 61850: "San Sebastian Cheesecake", 67717: "Tiramisu",
    63914: "Persian Ice Cream", 63916: "Matcha Ice Cream", 63918: "Masala Ice Cream", 63920: "Chocolate Ice Cream",
    63139: "Avocado Croissant with Balsamic", 51825: "Peanut Butter and Jam Croissant", 51851: "Cheese and Jam Croissant",
    52491: "Almond Milk, Small", 52493: "Almond Milk, Medium", 52499: "Almond Milk, Large",
}


def clean(s):
    s = re.sub(r"[​‎‏﻿]", "", s)      # zero-width spaces and marks; ZWNJ stays
    return re.sub(r"\s+", " ", s).strip()


def title(s):
    s = re.sub(r"\s*/\s*", " / ", clean(s))
    out = []
    for i, w in enumerate(s.split(" ")):
        lw = w.lower()
        if i and lw in SMALL_WORDS:
            out.append(lw)
        elif re.fullmatch(r"v\d+", lw):
            out.append(lw.upper())
        else:
            out.append("-".join(p[:1].upper() + p[1:].lower() for p in w.split("-")))
    return " ".join(out)


def slug(s):
    return re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")


def parse_item(it):
    f = [clean(x) for x in it["fields"]]
    fa, en = f[0], f[1]
    sizes, ing = [], ""
    for x in f[2:]:
        if x.startswith("محتویات"):
            ing = clean(x.split(":", 1)[1]) if ":" in x else ""
            continue
        m = re.fullmatch(r"(\d+)\s*کالری", x.translate(FA_DIGITS))
        if m and sizes:
            sizes[-1]["kcal"] = int(m.group(1))
            continue
        m = re.fullmatch(r"(?:(.+?)\s*:\s*)?([\d,٬]+)", x.translate(FA_DIGITS))
        if m:
            label = clean(m.group(1) or "")
            price = int(re.sub(r"\D", "", m.group(2)))
            key, en_l, fa_l = SIZE.get(label, ("one", "", ""))
            # Two teas list a second "medium" price with no label to tell them apart.
            # The first is shown; the README says so.
            if any(s["k"] == key for s in sizes):
                continue
            sizes.append({"k": key, "en": en_l, "fa": fa_l, "price": price, "kcal": None})
            continue
        raise SystemExit(f"unparsed field {x!r} on {fa}")
    return fa, en, sizes, ing


def menu(assets):
    tabs = load("menu_tabs.json")
    rest = {r["id"]: r for r in load("rest_menu.json")}
    seen, items, cats = {}, [], []
    for idx, cid, cen, cfa in TABS:
        tab = tabs[idx]
        ids = []
        for it in tab["items"]:
            pid = it["pid"]
            if pid in seen:                      # already listed under an earlier tab
                seen[pid]["also"].append(cid)
                ids.append(seen[pid]["id"])
                continue
            fa, en_raw, sizes, ing = parse_item(it)
            en = EN_FIX.get(pid) or title(en_raw)
            iid = slug(en)
            while any(x["id"] == iid for x in items):
                iid += "-2"
            rec = {
                "id": iid, "pid": pid, "cat": cid, "also": [], "en": en, "fa": fa,
                "img": assets["items"].get(it["img"]) if it["img"] else None,
                "sizes": sizes, "price": min(s["price"] for s in sizes), "ing": ing,
                "added": rest.get(pid, {}).get("date", "")[:10],
            }
            seen[pid] = rec
            items.append(rec)
            ids.append(iid)
        cats.append({"id": cid, "en": cen, "fa": cfa, "count": len(ids)})
    return cats, items


# -------------------------------------------------------------- the branches
# English names follow their own URL slugs and Google place names; regions group the
# branch pages by the city in each address.
BR = {
    "tajrish-monin": ("Tajrish", "Tehran", "Tehran"), "royan": ("Royan", "North", "Royan"),
    "mirdamad": ("Mirdamad", "Tehran", "Tehran"), "4rahvaliasr": ("Valiasr Crossroads", "Tehran", "Tehran"),
    "fatemi": ("Fatemi", "Tehran", "Tehran"), "mehr-o-mah": ("Mehr-o-Mah", "Qom road", "Qom–Tehran highway"),
    "vanak": ("Vanak", "Tehran", "Tehran"), "pasdaran": ("Pasdaran", "Tehran", "Tehran"),
    "farmanieh": ("Farmanieh", "Tehran", "Tehran"), "bagh-ferdows": ("Ferdows Garden", "Tehran", "Tehran"),
    "isfahan": ("Isfahan", "Isfahan", "Isfahan"), "jordan": ("Jordan (Golkhaneh)", "Tehran", "Tehran"),
    "saadatabad": ("Saadat Abad", "Tehran", "Tehran"), "paydarfard": ("Paydarfard", "Tehran", "Tehran"),
    "shahrak-e-gharb": ("Shahrak-e Gharb (Mahestan)", "Tehran", "Tehran"), "pol-romi": ("Pol-e Rumi", "Tehran", "Tehran"),
    "kish": ("Kish (Mica Mall)", "Kish", "Kish"), "motahari": ("Motahari", "Tehran", "Tehran"),
    "motel-ghoo": ("Motel Ghoo", "North", "Salmanshahr"), "lavasan": ("Lavasan", "Tehran", "Lavasan"),
    "izadshahr": ("Izadshahr", "North", "Izadshahr"), "karaj": ("Karaj (Azimieh)", "Karaj", "Karaj"),
    "yousef-abad": ("Yousef Abad", "Tehran", "Tehran"), "enghelab": ("Enghelab", "Tehran", "Tehran"),
    "iranmal": ("Iran Mall", "Tehran", "Tehran"), "heravi": ("Heravi", "Tehran", "Tehran"),
    "fakharmoghadam": ("Fakhar Moghadam", "Tehran", "Tehran"), "gisha": ("Gisha", "Tehran", "Tehran"),
    "modireat-bridge": ("Modiriat Bridge", "Tehran", "Tehran"), "jam": ("Jam", "Tehran", "Tehran"),
    "mehrshahr": ("Karaj (Mehrshahr)", "Karaj", "Karaj"), "babolsar": ("Babolsar", "North", "Babolsar"),
    "golestan": ("Shahrak-e Gharb (Golestan)", "Tehran", "Tehran"), "argentina": ("Argentina", "Tehran", "Tehran"),
    "kish-telecabin": ("Kish (Telecabin)", "Kish", "Kish"), "shiraz": ("Shiraz", "Shiraz", "Shiraz"),
    "ferdows-boulevard": ("Ferdows Boulevard", "Tehran", "Tehran"),
    "jordan-atefi-sharghi": ("Jordan (Atefi Sharghi)", "Tehran", "Tehran"),
    "haft-hoz": ("Haft Hoz", "Tehran", "Tehran"), "ajudaniyeh": ("Ajudaniyeh", "Tehran", "Tehran"),
    "ahvaz": ("Ahvaz", "Ahvaz", "Ahvaz"),
}
REGIONS = ["Tehran", "Karaj", "North", "Kish", "Isfahan", "Shiraz", "Qom road", "Ahvaz"]


def hhmm(s):
    h, m = s.split(":")
    return int(h) * 60 + int(m)


def parse_hours(line):
    """'روزهای عادی 07:00 الی 22:30 - پنج‌شنبه‌ها 07:00 الی 23:30 - روزهای تعطیل 08:00 الی 23:30'
    → minutes from midnight. A close earlier than the open runs past midnight."""
    if not line:
        return None
    t = line.translate(FA_DIGITS)
    if "24" in t and "ساعته" in t:
        return {"all": True}
    out = {}
    for label, key in (("عادی", "reg"), ("پنج", "thu"), ("تعطیل", "hol")):
        m = re.search(label + r"[^0-9]*?(\d{1,2}:\d{2})\s*(?:الی|-|تا)\s*(\d{1,2}:\d{2})", t)
        if m:
            out[key] = [hhmm(m.group(1)), hhmm(m.group(2))]
    if "reg" not in out:
        raise SystemExit(f"hours not understood: {line!r}")
    return out


def parse_phone(s):
    t = s.translate(FA_DIGITS)
    digits = re.sub(r"\D", " ", t).split()
    main = ""
    ext = None
    for d in digits:
        if len(d) >= 10 and not main:
            main = d
        elif len(d) >= 3 and len(main) == 3 and len(d) == 8:     # "021-88679082"
            main += d
        elif main and len(main) == 11 and len(d) <= 4:
            ext = d
        elif not main and len(d) == 3 and d.startswith("0"):
            main = d
    if len(main) != 11:
        raise SystemExit(f"phone not understood: {s!r}")
    return {"main": main, "ext": ext}


def branches(assets):
    raw = load("branches_raw.json")
    geo = load("branches_geo.json")
    added = {r["slug"]: r["date"][:10] for r in load("rest_branches.json")}
    order = [s for s in BR]                           # their branches page, top to bottom
    out = []
    for slug_ in order:
        r = next(x for x in raw if x["slug"] == slug_)
        seg = [clean(x) for x in r["seg"]]
        name_fa = clean(re.sub(r"^شعبه\s*", "", seg[0]))
        address = clean(re.sub(r"[\s\-–،,]*قهوه\s*لمیز\s*$", "", seg[1]))
        hours_line = next((x for x in seg[2:4] if re.search(r"\d{1,2}:\d{2}|ساعته", x.translate(FA_DIGITS))), "")
        phone_line = next(x for x in seg[2:5] if not re.search(r"\d{1,2}:\d{2}", x.translate(FA_DIGITS))
                          and len(re.sub(r"\D", "", x.translate(FA_DIGITS))) >= 10)
        en, region, city = BR[slug_]
        g = geo.get(slug_)
        a = assets["branches"][slug_]
        out.append({
            "id": slug_, "en": en, "fa": name_fa, "region": region, "city": city,
            "address": address, "hours": parse_hours(hours_line), "hoursFa": hours_line,
            "phone": parse_phone(phone_line), "maps": (r["maps"] or [None])[0],
            "lat": g["lat"] if g else None, "lng": g["lng"] if g else None,
            "cover": a["cover"], "photos": a["photos"], "added": added[slug_],
        })
    return out


def main():
    assets = load("assets.json")
    cats, items = menu(assets)
    brs = branches(assets)
    photos = assets["photos"]
    n_img = sum(1 for i in items if i["img"])
    head = ("// Generated by scripts/build_data.py from lamizcoffee.com — the Tehran menu page, its REST\n"
            "// endpoints and the 41 branch pages, scraped 2026-09-12. Do not edit by hand; rebuild.\n\n")
    body = [
        f"export const CATEGORIES = {json.dumps(cats, ensure_ascii=False, indent=1)};",
        f"export const ITEMS = {json.dumps(items, ensure_ascii=False, indent=1)};",
        f"export const BRANCHES = {json.dumps(brs, ensure_ascii=False, indent=1)};",
        f"export const REGIONS = {json.dumps(REGIONS)};",
        f"export const PHOTOS = {json.dumps(photos, ensure_ascii=False, indent=1)};",
        "const ITEM = Object.fromEntries(ITEMS.map((i) => [i.id, i]));",
        "const BRANCH = Object.fromEntries(BRANCHES.map((b) => [b.id, b]));",
        "export const byId = (id) => ITEM[id];",
        "export const branchById = (id) => BRANCH[id];",
        "",
    ]
    (ROOT / "js" / "data.js").write_text(head + "\n".join(body), encoding="utf-8")
    kb = (ROOT / "js" / "data.js").stat().st_size / 1024
    print(f"data.js: {len(cats)} categories, {len(items)} items ({n_img} with photographs), "
          f"{len(brs)} branches ({sum(1 for b in brs if b['lat'])} located), {kb:.0f} KB")
    for c in cats:
        print(f"   {c['id']:10s} {c['count']:3d}  {c['en']}")
    for b in brs:
        h = b["hours"]
        hs = "24h" if h and h.get("all") else ("none" if not h else " ".join(f"{k}{v[0] // 60:02d}:{v[0] % 60:02d}-{v[1] // 60:02d}:{v[1] % 60:02d}" for k, v in h.items()))
        print(f"   {b['id']:22s} {b['region']:9s} {b['phone']['main']} ext {b['phone']['ext'] or '-':4s} {hs}")


if __name__ == "__main__":
    main()
