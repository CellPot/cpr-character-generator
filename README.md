# Character Generator — for Cyberpunk RED

*Русская версия: [README.ru.md](README.ru.md)*

A step-by-step character creation wizard for Cyberpunk RED, built on the rules of the
Core Rulebook. One HTML page, no sign-up.

**[Open online](https://cellpot.github.io/cpr-character-generator/)**, or download
`generator.html` and open it in a browser — it works offline. The interface and the data come in
English and Russian; the page follows your browser's language the first time and has a
language switch.

- All three methods of the book: **#1 Street Rat**, **#2 Edgerunner**, **#3 Complete Package**.
- Role → STATs → skills → Lifepath (cultural and Role) → gear → finished sheet:
  HP, Seriously Wounded threshold, Death Save, Humanity with starting cyberware, the Role
  ability at rank 4, money.
- Gear picked from a catalogue: names, prices and the source (Core Rulebook and supplements).
- Output: print / PDF, a Markdown note and a save file (below). While you work, the character
  is kept in your browser and goes nowhere.

**It is not a replacement for the book.** It holds mechanics, tables and short summaries in
our own words; next to every rule there is the page of the Core Rulebook (a chip like
"CRB 144") or of the supplement ("BC 9") where it is set out in full.

## What you get out of it

A sheet can leave the page in three ways, each for a different job:

- **Print / PDF** — hand it to your GM or print it. In the print dialog choose
  "Save as PDF": the virtual printer "Microsoft Print to PDF" saves pages as pictures, so
  the text of such a file cannot be selected or searched.
- **Download .md** — a Markdown note (tables, skills sorted by roll) for a vault such as
  Obsidian. The file is named after the character: don't drop it over a note you already wrote
  under the same name.
- **Save .json / Load .json** — to continue later or to move a character to another device.
  Only this generator reads that file. It holds your choices and rolls, not the finished
  sheet, so after the generator is updated a loaded character is recalculated from the new data.

A loaded file is checked: anything extra is dropped, and a damaged file is not opened and
leaves the current character as it was. There is no "copy as text" button — the .md does that.

## Legal

Character Generator is unofficial content provided under the Homebrew Content Policy of
R. Talsorian Games and is not approved or endorsed by RTG.

Cyberpunk is a registered trademark of CD PROJEKT S.A. Cyberpunk RED, its rules and game
materials belong to R. Talsorian Games. This project is free and non-commercial. No book text
is copied here: the Lifepath and other random tables, names and numbers are what
[RTG's policy](https://rtalsoriangames.com/homebrew-content-policy/) expressly allows
generators to use; the descriptions of skills, gear and abilities are written anew.

The code (`src/`, `build.py`) is under the MIT license, see `LICENSE`. The license does not
extend to game material.

The Play font (© 2011 Jonas Hecksher, Playtypes, e-types AS), embedded in `src/base.css` for
headings, is under the SIL Open Font License 1.1 — text and copyright in
`LICENSES/Play-OFL.txt`.

## Credits

The Russian terms mostly follow the fan translations of the Cyberpunk RED books. Many thanks to
their authors:

- **rustablerpg.ru** and the VK group **vk.com/cyberpunk_red_rus** — the Core Rulebook,
  Black Chrome, Danger Gal Dossier, Exotics of 2045;
- the VK group **«Cyberpunk RED на русском языке»** — Interface RED (Ultimate), Cargo
  Containers & Cube Hotels, The 12 Days of Gunmas, All About Drones;
- **@kr45n1y** ([t.me/redcyberpunk](https://t.me/redcyberpunk)) — Hot Pursuit, Cyberfists of
  Fury, Going Metal, Did Someone Say Murder?, No Place Like Home, All About Agents, Your New
  Best Friend, Going Quiet, Toggle's Temple, Solo of Fortune 2045 and the Night Markets
  catalogue;
- **LieSnPeace** ([t.me/cyberpunk_red_rus](https://t.me/cyberpunk_red_rus)) — Breaking
  Your Stuff.

## Contributing

Contributions: issues welcome, PRs are not accepted.

## Build

```
python build.py        # → generator.html; Python 3 standard library only
```

`data/` — the wizard's data (STAT templates, skill sets, tables, the catalogue) — is
**exported** from a separate working project where it is extracted and checked against the
books; it is not edited by hand. `texts/summaries.json` holds our own short wording that
replaces the book's text.
