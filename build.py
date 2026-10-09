# -*- coding: utf-8 -*-
"""Build generator.html — the character generator as one offline page.

    python build.py

Inputs, all in this repository:
  src/base.css, src/page.css      the theme and the page frame
  src/wizard.css, src/wizard.js   the wizard itself (also embedded in a private book page)
  src/standalone.js               theme toggle + roll popover, which the host page
                                  provides when the wizard is embedded in a book
  data/body.html, data/payload.json
                                  the wizard's markup and data, EXPORTED — never edit
                                  them by hand (see CLAUDE.md)

Deterministic: the same inputs give the same bytes. Standard library only.
"""
import datetime, io, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "generator.html")
TITLE = "Character Generator"      # the page is English; the Russian rides in data-ru
SUBTITLE = "for Cyberpunk RED"
TITLE_RU = "Генератор персонажа — для Cyberpunk RED"


def read(rel):
    return io.open(os.path.join(HERE, rel), encoding="utf-8").read()


def body_markup():
    body = read("data/body.html")
    # Embedded in a book, every id of a chapter is namespaced «c00-…», and the
    # wizard's print rules select on that (section[id$="-master"]); keep the shape.
    body = re.sub(r'id="([^"]+)"', r'id="c00-\1"', body)
    # The masthead (both languages) already has the descriptive subtitle under its h1, as big
    # as RTG's Homebrew Content Policy allows; «unofficial» lives in the footer's disclaimer.
    if body.count('<p class="for">') != 1:
        sys.exit("build: the body's masthead has no subtitle line")
    return body


def ru(text):
    """The Russian of a piece of the frame, as an attribute: standalone.js swaps it in
    when the wizard changes language and puts the original (English) back."""
    return ' data-ru="%s"' % text.replace("&", "&amp;").replace('"', "&quot;")


def legal(sources):
    keys = " · ".join("<b>%s</b> — %s" % (esc(t), esc(n)) for t, n in sorted(sources.items()))
    return """<footer class="legal">
<p>%(title)s is unofficial content provided under the Homebrew Content Policy of
R. Talsorian Games and is not approved or endorsed by RTG.</p>
<p%(ru2)s>Cyberpunk is a trademark of CD PROJEKT S.A.; Cyberpunk RED and its rules
belong to R. Talsorian Games. The full text of the rules is in the books; a chip like
<b>CRB 146</b> is a page. Russian terms mostly follow the fan translations; thanks to their authors:
<b>rustablerpg.ru</b> and <b>vk.com/cyberpunk_red_rus</b>, the VK group
<b>Cyberpunk RED на русском языке</b>, <b>@kr45n1y</b> (<b>t.me/redcyberpunk</b>) and
<b>LieSnPeace</b> (<b>t.me/cyberpunk_red_rus</b>).</p>
<p%(ru3)s>Sources: %(keys)s.</p>
</footer>""" % {"title": TITLE, "keys": keys,
                "ru2": ru("Cyberpunk — товарный знак CD PROJEKT S.A.; Cyberpunk RED и его правила — "
                          "R. Talsorian Games. Полный текст правил — в книгах; чип вроде "
                          "<b>КБ 146</b> — страница. Термины — в основном по фанатским переводам, спасибо их авторам: "
                          "<b>rustablerpg.ru</b> и <b>vk.com/cyberpunk_red_rus</b>, группе VK "
                          "<b>«Cyberpunk RED на русском языке»</b>, <b>@kr45n1y</b> "
                          "(<b>t.me/redcyberpunk</b>) и <b>LieSnPeace</b> (<b>t.me/cyberpunk_red_rus</b>)."),
                "ru3": ru("Источники: %s." % keys)}


def esc(t):
    return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


# The files the page is made of. Their newest change is the page's date.
INPUTS = ("src/base.css", "src/wizard.css", "src/page.css", "src/standalone.js",
          "src/wizard.js", "data/body.html", "data/payload.json", "build.py")


def last_updated():
    """Newest mtime among the inputs — the reference's rule (its _build_book.py):
    not today's date, so a rebuild that changes nothing does not move it, or
    «обновлено» would stop meaning anything."""
    newest = max(os.path.getmtime(os.path.join(HERE, f)) for f in INPUTS)
    d = datetime.date.fromtimestamp(newest)
    return "%02d.%02d.%d" % (d.day, d.month, d.year)


def render():
    """The page as text — build() writes it, the export's checks compare it."""
    payload = json.loads(read("data/payload.json"))
    style = "\n".join(read("src/" + f) for f in ("base.css", "wizard.css", "page.css"))
    script = "\n".join(read("src/" + f) for f in ("standalone.js", "wizard.js"))
    page = """<!doctype html>
<html lang="en" data-title-ru="%(title_ru)s">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>%(title)s — %(subtitle)s</title>
<style>
%(style)s
</style>
</head>
<body>
<main>
<div class="topbar">
  <span class="brand"%(ru_brand)s>Fan tool · free · works offline · updated %(updated)s</span>
  <div class="themer" role="group" aria-label="Theme" data-ru-label="Оформление"><button type="button" data-th="light"%(ru_day)s>Day</button><button type="button" data-th="dark"%(ru_night)s>Night</button><button type="button" data-th="cyber-night"%(ru_cyber)s>Cyber</button><button type="button" data-th="auto"%(ru_auto)s>Auto</button></div>
</div>
%(body)s
%(legal)s
</main>
<script>
%(script)s
</script>
</body>
</html>
""" % {"title": TITLE, "subtitle": SUBTITLE, "style": style, "body": body_markup(),
       "legal": legal(payload["sources"]), "script": script, "updated": last_updated(),
       "title_ru": TITLE_RU,
       "ru_brand": ru("Фанатский инструмент · бесплатно · работает офлайн · обновлено %s" % last_updated()),
       "ru_day": ru("День"), "ru_night": ru("Ночь"), "ru_cyber": ru("Кибер"),
       "ru_auto": ru("Авто")}
    bad = [c for c in page if ord(c) < 0x20 and c not in "\n\t"]
    if bad:
        sys.exit("control characters in the page: %r" % bad[:5])
    return page


def build():
    page = render()
    io.open(OUT, "w", encoding="utf-8", newline="\n").write(page)
    print("built %s (%d bytes)" % (OUT, len(page.encode("utf-8"))))


if __name__ == "__main__":
    build()
