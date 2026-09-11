# Lamiz Coffee — PWA preview

A working preview of what Lamiz Coffee's app could be: order ahead from their own
menu, check in at any of their 41 branches and see who else is there, and collect
beans in a loyalty club. Built by [Alpha Agency](https://alphaa.agency) for Lamiz
Coffee — **not commissioned by them, and not sent to them yet.**

- **Live:** https://ilyatabrizi.github.io/lamiz/
- **Local:** `python3 serve.py` → http://localhost:8191
- **Checks:** `python3 e2e.py` (140 checks) or `python3 e2e.py https://ilyatabrizi.github.io/lamiz/`
- **Screens:** `python3 scripts/visual.py` — every screen, in light, dark and desktop

No framework, no build step for the app itself: hash routing, ES modules, one
stylesheet. Everything a customer does is kept in their own browser.

## What is Lamiz's, and what is ours

**Theirs**, taken from lamizcoffee.com on 12 September 2026 and not altered:

| | |
|---|---|
| Menu | **149 items** across their twelve sections — Persian and English names, every size with its price in Toman and its calories, the contents line, and their own photograph (116 of them) |
| Branches | **41**, with the address, hours and phone number each branch page lists, their own Google Maps links, their cover and interior photographs |
| Words | "We are Lamiz Coffee, and we love what we do", "from green coffee to the cup in your hand", the founding story, 41 branches / 28 on Snappfood / 600+ baristas / since 1388 |
| Logo | The transparent PNG Lamiz supplied, traced outline for outline — the L, قهوه لمیز and LAMIZ COFFEE (IoU 0.995 against the original) |
| Colour | `#FF6E1F`, out of their own site's stylesheet |
| Film | The bakery reel supplied for this build, cut at 21.8 s before its black end card, audio removed |

**Ours, and labelled as a proposal wherever it shows:**

- **Lamiz Club** — beans, tiers and rewards (`js/config.js`). One bean per 10,000 T,
  50 to welcome; Green → Roast (600 beans in a year, 1.25×) → Black (1,800, 1.5×);
  rewards at 60 / 250 / 300 / 450 beans. Lamiz publishes no loyalty scheme; every
  number here is Alpha's suggestion.
- **Ordering** — an order ends at a four-digit pickup code, paid at the counter. No
  payment is taken anywhere.
- **Check-in rooms** — the people already in a room are generated from the clock (see
  below), so the feature can be judged on one phone.
- **The sample account** — four months of a regular's orders, seeded on first run and
  cleared with one tap in Profile.

Two teas on their menu list a second "medium" price with nothing to tell the two
apart; the preview shows the first. Their power-cut menu (منو خاموشی) is left out: it
repeats cold drinks at other prices, for outages only. Two interior photographs their
Ajudaniyeh page links to are missing from their own server and are skipped.

## The screens

**Home** — the reel, full-bleed on a phone and framed beside the headline on a
desktop, never with words over it. Then the greeting, three ways in, the club card,
their four bakery photographs **in a different order on every visit**, the season,
the espresso bar, what is new, and the story.

**Menu** — their twelve sections. Chips filter; search reads English and Persian.
A tap on the plus adds the item in its first size; a tap on the row opens it, with
every size, its price, its calories and what is in it.

**Bag** — sizes changeable here, the branch to pick up from, when, a note for the
barista, beans to spend, beans to earn. If the branch is shut, the order is placed
for opening time instead of being refused.

**Check in** — their Tajrish branch hangs a light-up L on its brick wall, so that L
is the button. One tap lights the bulbs and holds your place for an hour; the bulbs
go out one at a time as the hour runs down, one per three minutes. Below it, everyone
else in the room, when they arrived, and a wave. You appear as your first name, your
initials or not at all — your choice, in Profile.

**Branches** — all 41, grouped by region or sorted by distance once you share where
you are, open or closed worked out in Tehran time. Each branch has its own screen:
photographs, the four things a place card should do, the address as Lamiz writes it,
and the week's hours with today marked.

**Profile** — the club card and the code the counter scans, the tier ladder, what
beans buy, the history, your details (with a birthday in the Iranian calendar), how
you appear in a room, light or dark, and a way to wipe this phone clean.

## Check-in, for real

`js/presence.js` keeps rooms on the device and fills them from a clock-derived roster
— same branch, same ten minutes, same faces, and nobody at all while a branch is
closed. Set `CHECKIN.endpoint` in `js/config.js` and the same calls go to a shared
service instead, with no change to any view. The contract:

```
GET  <endpoint>?branch=<id>          → [{ id, name, hue, at, until }]
POST <endpoint>  { branch, id, name, hue, until }
DELETE <endpoint>?id=<id>
```

No key belongs in this repository; a real deployment puts it in the server's config.

## Rebuilding

```bash
python3 scripts/build_assets.py      # traces the logo, downloads and sizes their photographs, cuts the reel
python3 scripts/build_data.py        # scripts/cache/*.json → js/data.js
python3 build.py                     # inlines the opening logo, preloads the modules, stamps the build
```

The scrape is cached in `scripts/cache/` and committed, so a rebuild never goes back
to their site. Client originals live in `scripts/src/` and are not committed.

## Open items

- **Language.** English with Persian throughout, as with KAI. Their own site is
  Persian-first; if Lamiz would rather have it that way round, the strings are in one
  place and the layout would need a day for RTL.
- Prices are their **Tehran** menu. Lamiz publishes separate menus for Isfahan,
  Shiraz, Qom, Kish and the north.
- The club's numbers, the pickup flow and the check-in rooms all need Lamiz's word
  before any of this is more than a preview.
- `noindex` is on every page while this is unapproved.
