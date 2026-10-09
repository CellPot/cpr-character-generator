# Character Generator for Cyberpunk RED

**Build a Cyberpunk RED character in a few minutes — right in your browser. No sign-up, no
install, works offline.**

**[▶ Open online](https://cellpot.github.io/cpr-character-generator/)** · [Русская версия](README.ru.md)

Prefer to keep it? Download `generator.html` (the download button on its file page) and open it
in any browser. It is a single file and needs no internet.

---

## What it does

A wizard takes you through the Core Rulebook's character creation, one step at a time:

**Role → STATs → Skills → Lifepath → Gear → Style → Character sheet**

- **All three creation methods** from the book: #1 Street Rat, #2 Edgerunner and
  #3 Complete Package.
- **Rolls for you or lets you decide.** Roll a single Lifepath row, roll everything at once, or
  enter values by hand.
- **Does the arithmetic.** HP, Seriously Wounded threshold, Death Save, Humanity (with the
  cyberware you start with), the Role ability at rank 4, starting money.
- **Gear from a catalogue** of the Core Rulebook and the supplements, with prices and the page
  where each item is described.
- **Points you to the book.** Every rule carries a page chip such as `CRB 144` (Core
  Rulebook) or `BC 9` (Black Chrome), so a disputed ruling is one lookup away.
- **English and Russian**, switchable on the page; it picks your browser's language at first
  launch. Four looks: Day, Night, Cyber and Auto.
- **Private.** Your character lives in your browser and is never sent anywhere.

## Take your character with you

| Button | You get | Good for |
|---|---|---|
| **Print / PDF** | the printed sheet | handing it to your GM, or the table |
| **Download .md** | a Markdown note (tables, skills sorted by roll) | a notes vault such as Obsidian |
| **Save .json** / **Load .json** | your choices and rolls | finishing later, or moving to another device |

A few details worth knowing:

- In the print dialog pick the browser's **Save as PDF**. The Windows "Microsoft Print to PDF"
  printer turns pages into pictures, so the text of such a file cannot be selected or searched.
- The `.md` file is named after your character, so don't drop it over an existing note with the
  same name.
- A `.json` file holds your *choices*, not the finished sheet. After the generator is updated, a
  loaded character is recalculated from the new data.
- Loaded files are checked: anything extra is dropped, and a damaged file is refused without
  touching your current character.

## Not a replacement for the book

This is a tool, not a rulebook. It holds mechanics, tables and short summaries in our own
words, and always tells you which page of the book has the full rule. If you enjoy the game,
buy the official books.

## Build it yourself

```
python build.py        # → generator.html; Python 3 standard library only
```

`generator.html` is the finished page; it is kept in the repository so you can download it
and use it as is. `build.py` rebuilds it from `src/`, `data/` and `texts/`.

`data/` (STAT templates, skill sets, tables, the gear catalogue) is exported from a separate
private project, where it is extracted and checked against the books, so it is not edited by
hand here and `build.py` does not regenerate it. `texts/summaries.json` holds our own short
wording that replaces the book's text.

## Credits

The Russian terms mostly follow the fan translations of the Cyberpunk RED books. Many thanks
to the people who made them:

| Translator | Books |
|---|---|
| **rustablerpg.ru** and the VK group [vk.com/cyberpunk_red_rus](https://vk.com/cyberpunk_red_rus) | Core Rulebook, Black Chrome, Danger Gal Dossier, Exotics of 2045 |
| the VK group **Cyberpunk RED на русском языке** | Interface RED (Ultimate), Cargo Containers & Cube Hotels, The 12 Days of Gunmas, All About Drones |
| **@kr45n1y** · [t.me/redcyberpunk](https://t.me/redcyberpunk) | Hot Pursuit, Cyberfists of Fury, Going Metal, Did Someone Say Murder?, No Place Like Home, All About Agents, Your New Best Friend, Going Quiet, Toggle's Temple, Solo of Fortune 2045, the Night Markets catalogue |
| **LieSnPeace** · [t.me/cyberpunk_red_rus](https://t.me/cyberpunk_red_rus) | Breaking Your Stuff |

## Contributing

Issues are welcome; pull requests are not accepted.

## Legal

Character Generator is unofficial content provided under the Homebrew Content Policy of
R. Talsorian Games and is not approved or endorsed by RTG.

Cyberpunk is a registered trademark of CD PROJEKT S.A. Cyberpunk RED, its rules and game
materials belong to R. Talsorian Games. This project is free and non-commercial. No book text
is copied here: the Lifepath and other random tables, names and numbers are what
[RTG's policy](https://rtalsoriangames.com/homebrew-content-policy/) expressly allows
generators to use, and the descriptions of skills, gear and abilities are written anew.

**Licenses.** The code (`src/`, `build.py`) is under the [MIT license](LICENSE), which does not
extend to game material. The Play font (© 2011 Jonas Hecksher, Playtypes, e-types AS), embedded
in `src/base.css` for headings, is under the SIL Open Font License 1.1; its text and copyright
are in [`LICENSES/Play-OFL.txt`](LICENSES/Play-OFL.txt).
