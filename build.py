#!/usr/bin/env python3
"""Stamp the build. Run before every deploy.

1. Inline the opening screen into index.html — their logo, still: the L over قهوه لمیز
   over LAMIZ COFFEE, traced from the PNG they supplied (js/brand.js) — so it paints
   with the first byte instead of waiting for the modules.
2. Announce every module up front. ES imports are otherwise discovered one level at a
   time — app.js, then the views, then what they import — which from Tehran to GitHub
   Pages is most of the wait before anything appears.
3. Content-hash the shell into the service-worker version and the stylesheet / module
   query strings, so a returning visitor never runs half of one build and half of another.

    python3 build.py
"""
import hashlib
import pathlib
import re

ROOT = pathlib.Path(__file__).resolve().parent
BOOT_RE = re.compile(r"<!-- boot:start -->.*?<!-- boot:end -->", re.S)
PRELOAD_RE = re.compile(r"<!-- preload:start -->.*?<!-- preload:end -->", re.S)


def boot_block():
    brand = (ROOT / "js/brand.js").read_text(encoding="utf-8")
    grab = lambda name: re.search(rf'{name} = "([^"]+)"', brand).group(1)
    vb, mark, fa, word = grab("LOCKUP_VIEWBOX"), grab("MARK_PATH"), grab("FA_PATH"), grab("WORD_PATH")
    return f"""<!-- boot:start -->
<div id="boot" aria-hidden="true">
  <div class="boot-logo">
    <svg viewBox="{vb}" fill="currentColor" fill-rule="evenodd" focusable="false"><path d="{mark}"/><path d="{fa}"/><path d="{word}"/></svg>
  </div>
</div>
<!-- boot:end -->"""


def preload_block():
    mods = sorted(p.relative_to(ROOT).as_posix() for p in ROOT.glob("js/**/*.js") if p.name != "app.js")
    links = "\n".join(f'<link rel="modulepreload" href="{m}">' for m in mods)
    return f"<!-- preload:start -->\n{links}\n<!-- preload:end -->"


idx = ROOT / "index.html"
html = idx.read_text(encoding="utf-8")
html = BOOT_RE.sub(lambda _: boot_block(), html)
if "<!-- preload:start -->" not in html:
    html = html.replace('<script type="module" src="js/app.js', '<!-- preload:start -->\n<!-- preload:end -->\n<script type="module" src="js/app.js', 1)
html = PRELOAD_RE.sub(lambda _: preload_block(), html)
idx.write_text(html, encoding="utf-8")

files = sorted([*ROOT.glob("js/**/*.js"), ROOT / "css/app.css", ROOT / "index.html", ROOT / "manifest.webmanifest"])
h = hashlib.sha1()
for f in files:
    h.update(re.sub(rb"\?v=[0-9a-f]+", b"", f.read_bytes()))
stamp = h.hexdigest()[:10]

sw = ROOT / "sw.js"
sw.write_text(re.sub(r'const VERSION = "lamiz-[^"]+";', f'const VERSION = "lamiz-{stamp}";', sw.read_text(encoding="utf-8")), encoding="utf-8")
html = idx.read_text(encoding="utf-8")
html = re.sub(r"css/app\.css(\?v=[0-9a-f]+)?", f"css/app.css?v={stamp}", html)
html = re.sub(r"js/app\.js(\?v=[0-9a-f]+)?", f"js/app.js?v={stamp}", html)
idx.write_text(html, encoding="utf-8")
print(f"build {stamp}: logo inlined, {len(list(ROOT.glob('js/**/*.js'))) - 1} modules preloaded, sw + query strings stamped ({len(files)} files hashed)")
