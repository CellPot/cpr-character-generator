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
import io, json, os, re, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, "generator.html")
TITLE = "Генератор персонажа"
SUBTITLE = "для Cyberpunk RED"


def read(rel):
    return io.open(os.path.join(HERE, rel), encoding="utf-8").read()


def body_markup():
    body = read("data/body.html")
    # Embedded in a book, every id of a chapter is namespaced «c00-…», and the
    # wizard's print rules select on that (section[id$="-master"]); keep the shape.
    return re.sub(r'id="([^"]+)"', r'id="c00-\1"', body)


def legal(sources):
    keys = " · ".join("<b>%s</b> — %s" % (esc(t), esc(n)) for t, n in sorted(sources.items()))
    return """<footer class="legal">
<p>%(title)s is unofficial content provided under the Homebrew Content Policy of
R. Talsorian Games and is not approved or endorsed by RTG.</p>
<p>Неофициальный бесплатный фанатский инструмент. Cyberpunk — зарегистрированный
товарный знак CD PROJEKT S.A.; Cyberpunk RED, его правила и игровые материалы —
R. Talsorian Games. Здесь — только механика, названия и краткий пересказ своими словами: полный
текст правил — в книгах, страницы указаны рядом с каждым правилом.</p>
<p>Русские термины — по переводу проекта <b>rustablerpg.ru</b> для группы
<b>vk.com/cyberpunk_red_rus</b>.</p>
<p>Обозначения источников: %(keys)s.</p>
<p>Персонаж хранится только в этом браузере; страница ничего не отправляет и работает
без интернета.</p>
</footer>""" % {"title": TITLE, "keys": keys}


def esc(t):
    return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def render():
    """The page as text — build() writes it, the export's checks compare it."""
    payload = json.loads(read("data/payload.json"))
    style = "\n".join(read("src/" + f) for f in ("base.css", "wizard.css", "page.css"))
    script = "\n".join(read("src/" + f) for f in ("standalone.js", "wizard.js"))
    page = """<!doctype html>
<html lang="ru">
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
  <span class="brand">Неофициальный фанатский инструмент<small>%(subtitle)s · бесплатно, без регистрации, работает офлайн</small></span>
  <div class="themer" role="group" aria-label="Оформление"><button type="button" data-th="light">День</button><button type="button" data-th="dark">Ночь</button><button type="button" data-th="cyber-night">Кибер</button><button type="button" data-th="auto">Авто</button></div>
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
       "legal": legal(payload["sources"]), "script": script}
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
