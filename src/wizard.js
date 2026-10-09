/* ==== Character Generator (JS) ======================================
   The wizard's behaviour lives here, not in the markup, for two reasons. The host
   page rewrites every literal id=" in a markup fragment, which would silently rename
   ids inside JS; and its checks read main.textContent to catch escaped-markup leaks,
   where an inline <script> full of "<td>" reads as one. The markup carries only the
   page plus one JSON island of generated data. No-ops when the wizard's markup is
   absent. ==== */
(function(){
"use strict";
var root = document.querySelector('[data-cg="app"]');
if(!root) return;
var D = JSON.parse(document.querySelector(".cg-data").textContent);
var KEY = "cpr-character";
var S = null;

/* `method` is "streetrat" or "edge" — the corebook's Method #1 and #2. They differ in
   two steps only, so they share one wizard and one saved character; `srolls` (ten
   d10, one per STAT) and `levels` (the point-buy allocation) are the state that
   belongs to #2 alone and is cleared when the method changes. */
/* `abil`, `rpath` and `sub` are the Role's own payload and belong to the Role that
   is selected: the points a Solo spread over his four Combat Awareness slots, the
   Nomad's four "vehicle or upgrade" decisions, the answers to the Role's
   own Lifepath, and the Exec's subordinate. All three are cleared with
   the Role, for the same reason S.gear is — see the click handler. */
/* Method #3 "Complete Package" adds four keys, all of them cleared whenever the method
   changes away from "calc" (and #1/#2's own srolls/levels are cleared moving the
   other way) — see the method-switch click handler.
     statBudget which D.statPools preset is chosen — a name, not an index, so a
                 reordered table doesn't silently repoint at the wrong pool.
     statAlloc {STAT: points}, the point-buy allocation. All-or-nothing like #2's
                 dice: S.stats is written only once every STAT is present and the
                 whole pool is spent — see recalcStats3().
     skills3 {skill: level}, the free-pick point-buy over ALL 66 skills rather
                 than a Role's 20. "Language" and "Local Expert" still need a
                 specialisation — reuses S.picks by skill name, the same field
                 #1/#2's Role packages already write "pick 1" specialisations
                 into, so no new state is needed for that half of it.
     buy/style arrays of {name, price, cyber, hl} — the freeform gear and Style
                 purchases (page 104–105). Two lists, not one, because unspent
                 Gear becomes starting cash and unspent Style is lost — they
                 must never be able to cover each other.
     buyBudget/ the two pools' SIZE, overridable — the book states 2,550/800 as
     styleBudget flat numbers, not a GM-assigned tier table like the STAT pool, but a
                 GM is free to hand out a different figure, so both are editable
                 numbers rather than baked-in constants. `null` means "use the
                 book's own number" (D.calcCash.main/style) — see gearBudget().
     start/ #1/#2's own freeform purchases against their flat 500eb (printed
     startBudget 98) — same row shape and budget-edit control as buy/style, just
                 one list instead of two. Belongs to the method pair, not to
                 either method alone, so it survives a #1<->#2 switch and is
                 cleared only when crossing the calc boundary — see the
                 method-switch click handler. */
function blank(){ return {method:"streetrat",role:null,stats:null,roll:null,srolls:[],
                          levels:{},picks:{},life:{},gear:{},cyber:{},
                          abil:{},rpath:{},sub:{},
                          statBudget:"",statAlloc:{},skills3:{},buy:[],style:[],
                          buyBudget:null,styleBudget:null,
                          sponsor:{active:false,kind:"",hook:""},
                          start:[],startBudget:null,
                          homebrew:[],
                          lang:"",harm:"",dice:{},notes:{},name:""}; }
/* A saved character is data written by an OLDER version of this wizard, and it
   used to be trusted whole — whatever came out of JSON.parse became S. Anything
   that did not have exactly today's shape then threw inside the first paint, and
   because that happens before the wizard renders anything, the chapter came up as
   a blank pane with no controls, no message and no way back: localStorage had to
   be cleared by hand. `{}`, `null`, a bare string and a save missing `life` all
   did it. The per-key backfills that used to sit next to paintAll() only covered
   the keys somebody had remembered to add.
   So the stored object is merged onto a blank one key by key, and a key is taken
   only if it is the type blank() declares for it. That subsumes every past and
   future migration: a key this version does not know is dropped, one an older save
   lacks keeps its default. */
var TYPE = {method:"string", role:"string", stats:"object", roll:"number",
            srolls:"array", levels:"object", picks:"object",
            life:"object", gear:"object", cyber:"object",
            abil:"object", rpath:"object", sub:"object",
            statBudget:"string", statAlloc:"object", skills3:"object",
            buy:"array", style:"array", buyBudget:"number", styleBudget:"number",
            sponsor:"object", start:"array", startBudget:"number",
            lang:"string", harm:"string", homebrew:"array",
            dice:"object", notes:"object", name:"string"};
var HB_MAX = 20;
/* Quotes and angle brackets are stripped because the name is written into
   attributes (the roll button's data-key). */
function hbWhat(s){ return String(s || "").replace(/\s+/g, " ").trim().slice(0, 200); }
function hbName(s){ return String(s).replace(/["<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 40); }
function load(){
  var got = null;
  try{ var raw = localStorage.getItem(KEY); if(raw) got = JSON.parse(raw); }catch(e){}
  return normalise(got);
}
/* The merge-and-validate half of load(), shared with the file import: a saved file
   is exactly as untrusted as localStorage. */
function normalise(got){
  var out = blank();
  if(!got || typeof got !== "object" || got instanceof Array) return out;
  for(var k in out){
    if(!out.hasOwnProperty(k)) continue;
    var v = got[k];
    if(v === null || v === undefined) continue;
    if(TYPE[k] === "array"){ if(v instanceof Array) out[k] = v; }
    else if(TYPE[k] === "object"){ if(typeof v === "object" && !(v instanceof Array)) out[k] = v; }
    else if(typeof v === TYPE[k]) out[k] = v;
  }
  /* An unknown method name would leave the wizard in neither mode. */
  if(!methodOf(out.method)) out.method = D.methods[0].key;
  /* Two values are checked for content as well as for type, because a wrong one
     survives as far as the sheet: a Role this build no longer has renders an empty
     step 5, and a STAT block missing a key prints HP as NaN. */
  if(out.role !== null){
    var known = false;
    for(var i=0;i<D.roles.length;i++) if(D.roles[i].name === out.role) known = true;
    if(!known){ out.role = null; out.stats = null; out.roll = null; out.picks = {};
                out.gear = {}; out.abil = {}; out.rpath = {}; out.sub = {}; }
  }
  if(out.stats){
    for(var s=0;s<D.stats.length;s++)
      if(typeof out.stats[D.stats[s]] !== "number"){ out.stats = null; out.roll = null; break; }
  }
  /* A statBudget naming a preset that no longer exists would leave the Method #3
     STAT step pointing at nothing — same class of check as the Role/stats ones
     above. Falls back to the book's own recommended rank rather than blanking it,
     since "which preset" has a sane default and "which Role" does not. */
  if(out.statBudget){
    var knownPool = false;
    for(var p=0;p<D.statPools.length;p++) if(D.statPools[p].name === out.statBudget) knownPool = true;
    if(!knownPool) out.statBudget = D.statPoolDefault;
  }
  /* A row missing `name`/`price` renders as a blank line with a NaN total; one
     whose `cyber` flag survived without a numeric `hl` would silently omit itself
     from the Humanity sum. Drop anything that doesn't have the shape the UI
     writes rather than trying to repair it in place. */
  /* `locked`/`src`/`chip`/`href` are the gear-catalogue picker's own fields
     (pickFromCatalog): a row picked from the book rather than typed carries
     where it came from and can't be hand-edited afterward. Same drop-if-wrong-
     shape rule as the four original fields — an old save without them just gets
     an ordinary, editable row. */
  function cleanRows(rows){
    var out2 = [];
    for(var i=0;i<rows.length;i++){
      var r = rows[i];
      if(!r || typeof r !== "object") continue;
      /* `tier` and `alt` are written by pickFromCatalog and printed on the row; they
         were not copied here, so the price-tier badge and the English name were lost on
         every reload and on every save→open of a file. Kept only when non-empty. */
      var extra = {};
      if(typeof r.tier === "string" && r.tier) extra.tier = r.tier.slice(0, 40);
      if(typeof r.alt === "string" && r.alt) extra.alt = r.alt.slice(0, 120);
      out2.push({name: typeof r.name === "string" ? r.name : "",
                 price: typeof r.price === "number" ? r.price : 0,
                 qty: (typeof r.qty === "number" && r.qty >= 1) ? Math.round(r.qty) : 1,
                 cyber: !!r.cyber,
                 hl: typeof r.hl === "number" ? r.hl : 0,
                 locked: !!r.locked,
                 src: typeof r.src === "string" ? r.src : "",
                 chip: typeof r.chip === "string" ? r.chip : "",
                 href: safeHref(r.href)});
      for(var xk in extra) out2[out2.length-1][xk] = extra[xk];
    }
    return out2;
  }
  /* An anchor of ours looks like "#c11-snaryazhenie"; a leading # with anything else
     after it is not one, and this value is written into an href, so it is dropped
     rather than repaired. A page citation ("CRB 171") is only ever printed as text. */
  function safeHref(h){
    if(typeof h !== "string") return "";
    if(h.charAt(0) === "#") return /^#[A-Za-z0-9_.:-]{1,60}$/.test(h) ? h : "";
    return h.slice(0, 40);
  }
  /* Homebrew skills are typed by the player, so every field is checked: a name that
     is not a short string, a STAT this build does not have, or a level outside the
     book's range drops the row rather than reaching the sheet. */
  var hb = [];
  for(var h0=0;h0<out.homebrew.length && hb.length<HB_MAX;h0++){
    var e0 = out.homebrew[h0];
    if(!e0 || typeof e0 !== "object" || typeof e0.name !== "string") continue;
    var n0 = hbName(e0.name);
    if(!n0 || D.stats.indexOf(e0.stat) < 0) continue;
    hb.push({name:n0, stat:e0.stat, x2:!!e0.x2, what:hbWhat(e0.what),
             level: (typeof e0.level === "number" && e0.level >= 0 && e0.level <= D.skillMax)
                    ? Math.round(e0.level) : 0});
  }
  out.homebrew = hb;
  out.buy = cleanRows(out.buy);
  out.style = cleanRows(out.style);
  out.start = cleanRows(out.start);
  /* A negative custom budget is not a number the UI can ever write (setGearBudget
     clamps at 0), so one in storage is either hand-edited or from an older/buggier
     build — either way, fall back to "use the book's own number" rather than let
     every derived total go negative from a save nobody could have produced. */
  if(typeof out.buyBudget === "number" && out.buyBudget < 0) out.buyBudget = null;
  if(typeof out.styleBudget === "number" && out.styleBudget < 0) out.styleBudget = null;
  if(typeof out.startBudget === "number" && out.startBudget < 0) out.startBudget = null;
  /* Same shape-before-content check as statBudget/role above: a kind or hook this
     build doesn't offer would otherwise sit selected-but-invisible in the <select>. */
  /* A stored roll is read for its `out` alone, and that is written into the page, so
     it must be a number — "<img …>" in a file's `out` was markup. The other fields are
     kept (a save must round-trip unchanged) but only if they are what rollExpr writes. */
  var dice = {}, fin = function(x){ return typeof x === "number" && isFinite(x); };
  for(var dk in out.dice){
    if(!out.dice.hasOwnProperty(dk)) continue;
    var de = out.dice[dk];
    if(!de || typeof de !== "object" || !fin(de.out)) continue;
    var roll = {};
    if(de.vals instanceof Array)
      roll.vals = de.vals.filter(fin).slice(0, 20);
    if(fin(de.sum)) roll.sum = de.sum;
    if(de.op === null || de.op === "+" || de.op === "-" || de.op === "/") roll.op = de.op;
    if(fin(de.arg)) roll.arg = de.arg;
    roll.out = de.out;
    dice[dk] = roll;
  }
  out.dice = dice;
  out.sponsor = { active: !!out.sponsor.active,
                   kind: (D.sponsor.kinds.indexOf(out.sponsor.kind) >= 0) ? out.sponsor.kind : "",
                   hook: (D.sponsor.hooks.indexOf(out.sponsor.hook) >= 0) ? out.sponsor.hook : "" };
  return out;
}
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){} }
function q(sel){ return root.querySelector('[data-cg="'+sel+'"]'); }
function d10(){ return Math.floor(Math.random()*10)+1; }
/* The Role lifepaths mix 1d10 and 1d6 tables — the die is a property of the table,
   printed in its own header, not something the shape of the table implies. */
function dN(n){ return Math.floor(Math.random()*n)+1; }

/* ------------------------------------------------------- the two creation methods
   #1 "Street Rat" reads a whole ROW of the Role's template off one 1d10;
   #2 "Edgerunner" rolls 1d10 per STAT and reads that STAT's COLUMN, then buys skill
   levels out of 86 points. Everything else — Role, Lifepath, gear — is
   shared, which is what lets one wizard carry both. */
function methodOf(key){
  for(var i=0;i<D.methods.length;i++) if(D.methods[i].key === key) return D.methods[i];
  return null;
}
function isEdge(){ return S.method === "edge"; }
function isCalc(){ return S.method === "calc"; }
/* A skill's level: printed by the book under #1, chosen by the player under #2.
   The default is the package level, because a Method #1 package costs exactly the
   86 points Method #2 hands out — so the point-buy opens on a legal spread rather
   than on a screen of minimums. Everything downstream reads levels through here. */
function lv(sk){
  if(!isEdge()) return sk.level;
  var v = (S.levels||{})[sk.skill];
  return (typeof v === "number") ? v : sk.level;
}
function costOf(sk){ return lv(sk) * (sk.x2 ? 2 : 1); }
function spent(){
  var r = role(), t = 0; if(!r) return 0;
  for(var i=0;i<r.skills.length;i++) t += costOf(r.skills[i]);
  return t + hbSpent();
}
/* The player's own skills (homebrew) draw on the same 86 points, but only under the
   two methods that spend points: #1 is a fixed package with nothing to pay with. */
function hbOn(){ return isEdge() || isCalc(); }
function hbCost(h){ return h.level * (h.x2 ? 2 : 1); }
function hbSpent(){
  var t = 0; if(!hbOn()) return 0;
  for(var i=0;i<S.homebrew.length;i++) t += hbCost(S.homebrew[i]);
  return t;
}
function hbLeft(){ return isCalc() ? skillsLeft3() : unspent(); }
/* Those with a level, in the shape the sheet and the exports read. */
function hbBought(){
  var out = [];
  if(!hbOn()) return out;
  for(var i=0;i<S.homebrew.length;i++) if(S.homebrew[i].level > 0) out.push(S.homebrew[i]);
  return out;
}
function unspent(){ return D.budget - spent(); }
/* "Role's set" is not a preset like the other two — it is the ABSENCE of an
   allocation, so it clears rather than writes. That keeps a character built before
   any preset was clicked identical to one that clicked "Role's set". */
function preset(kind){
  var r = role(); if(!r) return;
  if(kind === "role"){ S.levels = {}; return; }
  var out = {}, n = (kind === "min") ? D.skillMin : 4;
  for(var i=0;i<r.skills.length;i++) out[r.skills[i].skill] = n;
  S.levels = out;
}
/* Quotes are escaped as well: this is written into double-quoted attributes
   (value="…", href="…", data-skill="…") with strings that can come out of an imported
   file, and without them a quote closed the attribute and the rest of the string was
   markup — a saved character could carry an onmouseover/onfocus into the page. */
function esc(t){
  return String(t).replace(/&/g,"&amp;").replace(/</g,"&lt;")
                  .replace(/"/g,"&quot;").replace(/'/g,"&#39;");
}
/* The rank-4 facts arrive as the book's own cells with its <b> on the mechanics kept.
   That is right on screen and wrong in the .md export, which is plain text — so
   the tags come off, and the entities they were escaped as go back to being
   characters. */
function plainText(t){
  return String(t).replace(/<[^>]+>/g, "")
                  .replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
}
/* Which option of a multi-choice gear line is taken. The book prints
   "Heavy Melee Weapon or Flashbang" — one of them, chosen by the player —
   so the default is the first and the sheet offers the rest. */
/* Fields the player must still fill in. They are easy to miss — a "pick 1" sits
   there looking like a filled cell — so the count rides on the step-3 tab and the
   sheet says "not chosen" rather than printing "(pick 1)" as if it were an item. */
function pendingSkills(){
  var out = [];
  /* Method #3 buys from the full 66, not a Role's package, so it counts against
     D.skills/D.hints directly rather than r.skills — same two kinds of
     outstanding item as #2 (leftover points, unanswered "pick 1"), just read
     off a different list. */
  if(isCalc()){
    if(!role()) return out;
    if(skillsLeft3() > 0) out.push(skillsLeft3() + " нераспределённых очков");
    for(var name in D.hints){
      if(!D.hints.hasOwnProperty(name)) continue;
      var cps = copies3(name);
      for(var ci=0;ci<cps.length;ci++)
        if(skillLevel3(cps[ci]) > 0 && !(S.picks[cps[ci]] || "").trim()) out.push(name);
    }
    return out;
  }
  var r = role();
  if(!r) return out;
  /* Under Method #2 the points are the outstanding thing, and they have to be
     visible from step 4 and 5 — the budget bar only exists on step 3. Points left
     over are legal but always a mistake, so they are counted, not blocked. */
  if(isEdge() && unspent() > 0) out.push(unspent() + " нераспределённых очков");
  for(var i=0;i<r.skills.length;i++){
    var s = r.skills[i];
    if(s.pick === "" && !(S.picks[s.skill] || "").trim()) out.push(s.skill);
  }
  return out;
}
function pendingLife(){
  var out = [];
  if(langRow() && !S.lang) out.push("Язык культуры");
  for(var i=0;i<D.life.length;i++){
    var t = D.life[i];
    if(got(t) && !complete(t)) out.push(t.label);
    /* harmable(), not "the cell exists": outcome 7 of the Enemy table ("You just don't like each other") has no injured party, so harmable() renders no
       chooser for it — but this counted it anyway, and step 4 carried a "1" that
       nothing on the screen could ever satisfy. An outstanding count has to be
       reachable or it is worse than no count at all. */
    if(harmable(t) && !S.harm) out.push(t.harm[0]);
    /* An outcome with a die inside the sentence — "… (1d6/2) friends" —
       is not answered until that die is thrown. Left alone it read as if "(1d6/2)"
       WERE the answer: nothing said it was a control, nothing counted it, and the
       sheet printed the bare expression to a GM who then had to work out that the
       number of people coming for you had never been settled. Same failure as
       "Language (pick 1)" printing as though "pick 1" were the language. */
    for(var c=0;c<t.cols.length;c++){
      if(c === t.pickCol) continue;
      if(needsDice(t, c)) out.push(t.label + " — " + shortCol(t, c));
    }
  }
  return out;
}
function pending(){ return pendingSkills().concat(pendingLife()); }
/* The origin roll offers a list of languages and the book grants 4 levels in the
   one you pick ("Don't forget 4 language levels", printed 86). Without this the sheet
   was short a whole skill. */
function langTable(){
  for(var i=0;i<D.life.length;i++) if(D.life[i].pickCol !== null) return D.life[i];
  return null;
}
/* How many dice a table takes. The book decides this per table, not by shape —
   decided in the export — so a table is either one roll read across the
   whole row, or one roll per column. */
function dice(t){ return t.perColumn ? t.cols.length : 1; }
/* A column header carries the book's instruction to the player ("(pick)",
   "(pick one)"). That belongs in the wizard, where you are still choosing —
   not on a finished sheet, where it reads as part of the answer. */
/* Three lifepath outcomes hide a die inside the sentence — "… (1d6/2)
   friends", "(1d10/2)", "A whole gang (1d10+5)" — and they say how many people are
   coming for you, which is exactly the sort of thing a GM needs settled before the
   scene. The page' own roller only linkifies text present at load, and these
   cells are rendered later, so they are wired here.
   Division rounds UP: the corebook rounds up wherever it states a rule (armour
   halving, HP), and "a few friends" rounding to zero is not an outcome. */
var DICE_RE = /(\d*)d(100|10|6)\s*(?:([+\/-])\s*(\d+))?/g;
function diceKey(key, col){ return key + "|" + col; }
function rollExpr(count, faces, op, arg){
  var vals = [], sum = 0, i;
  for(i=0;i<count;i++){ var v = Math.floor(Math.random()*faces)+1; vals.push(v); sum += v; }
  var out = sum;
  if(op === "+") out = sum + arg;
  else if(op === "-") out = Math.max(0, sum - arg);
  else if(op === "/") out = Math.max(1, Math.ceil(sum / arg));
  return {vals:vals, sum:sum, op:op, arg:arg, out:out};
}
function diceHtml(text, key, col){
  var stored = S.dice || {};
  return esc(text).replace(DICE_RE, function(m, c, f, op, arg){
    var id = diceKey(key, col), got = stored[id];
    return '<button type="button" class="cgdice" data-cg="lifedice" data-key="'+key
         + '" data-col="'+col+'" data-c="'+(c||1)+'" data-f="'+f+'"'
         + (op ? ' data-op="'+op+'" data-arg="'+arg+'"' : "")
         + ' title="Бросить">'+m+(got ? " → <b>"+esc(got.out)+"</b>" : "")+"</button>";
  });
}

/* Is there a die in this cell that nobody has thrown yet? `DICE_RE` is /g and
   therefore stateful, so its lastIndex is reset before every test. */
function needsDice(t, col){
  var cell = cellOf(t, col);
  if(!cell) return false;
  DICE_RE.lastIndex = 0;
  return DICE_RE.test(cell) && !(S.dice||{})[diceKey(t.key, col)];
}
/* On the finished sheet the expression is spent: print "(1d6/2 → 2)" so the GM
   sees both what was rolled and what it came to, and the bare expression when it
   has not been rolled yet. */
function resolved(text, key, col){
  var got = (S.dice||{})[diceKey(key, col)];
  return esc(text).replace(DICE_RE, function(m){
    return got ? m+" → <b>"+esc(got.out)+"</b>" : m;
  });
}
function plain(text, key, col){
  var got = (S.dice||{})[diceKey(key, col)];
  return got ? text.replace(DICE_RE, function(m){ return m+" → "+got.out; }) : text;
}
/* An unrolled die is an unanswered question and the sheet has to say so — the bare
   "(1d6/2)" read as part of the outcome, and the person who most needs to know that
   the number of people coming for you was never settled is the GM holding the
   printout. The marker goes at the END of the line, not at the expression: inserted
   inline it split "… (1d6/2) friends" in half. */
function undone(t, col, html){
  if(!needsDice(t, col)) return "";
  return html ? ' <span class="cgtodoin">— не брошено</span>' : " — не брошено";
}
function colLabel(c){ return c.replace(/\s*\((?:выбери|выберите)[^)]*\)\s*$/i, ""); }
/* On the sheet a column is labelled by its short name; the book's question-form
   header belongs above a table you are still filling in. An empty short name
   means the column needs no label at all. */
function shortCol(t, i){ return (t.short && t.short[i]) || colLabel(t.cols[i]); }
/* "Abandoned or betrayed." + " — fell to you" leaves the full stop mid-sentence. */
function unstop(s){ return s.replace(/\.\s*$/, ""); }
/* How many columns actually reach the sheet. The language menu never does, so
   Origin shows one line and must not carry a column label in front of it —
   "Origin: From where: South Asia" names the same thing twice. */
function shownCols(t){ return t.cols.length - (t.pickCol === null ? 0 : 1); }
function harmable(t){
  var g = got(t);
  return t.harm && g && g[1] && g[1] !== t.harmSkip;
}
function tableOf(key){
  for(var i=0;i<D.life.length;i++) if(D.life[i].key === key) return D.life[i];
  return null;
}
function rollTable(t){
  for(var c=0;c<dice(t);c++) setDie(t, c, d10());
}
function got(t){
  var v = S.life[t.key];
  if(v === undefined || v === null) return null;
  if(typeof v === "number") v = [v];          // saved before per-column rolling
  return v.length ? v : null;
}
function cellOf(t, c){
  var g = got(t); if(!g) return null;
  var d = t.perColumn ? g[c] : g[0];
  return d ? t.rows[d-1][c] : null;
}
function complete(t){
  var g = got(t); if(!g) return false;
  for(var i=0;i<dice(t);i++) if(!g[i]) return false;
  return true;
}
function setDie(t, col, value){
  var g = (S.life[t.key] && typeof S.life[t.key] === "object")
        ? S.life[t.key].slice()
        : (typeof S.life[t.key] === "number" ? [S.life[t.key]] : []);
  while(g.length < dice(t)) g.push(0);
  if(t.perColumn) g[col] = value; else g[0] = value;
  S.life[t.key] = g;
}

function langRow(){
  var t = langTable(); if(!t) return null;
  var cell = cellOf(t, t.pickCol);
  return cell ? cell.split(/,\s*/) : null;
}
/* The culture language belongs to the ORIGIN ROW, not to the character. Re-rolling
   Origin left the old choice standing: a character from Southeast Asia
   kept "Chinese" on the sheet, the value line read as answered while the <select>
   under it had no matching option, and because S.lang was still truthy nothing was
   outstanding — no badge, no "not chosen", nothing to notice. Any change to the
   lifepath re-checks the choice against what the new row actually offers. */
function syncLang(){
  if(!S.lang) return;
  var opts = langRow();
  if(!opts || opts.indexOf(S.lang) < 0) S.lang = "";
}
/* Every write to S.life goes through here. "Clear" used to skip paintTabs(),
   so the outstanding count sat on the tab describing a lifepath that no longer
   existed. One exit keeps the five handlers honest. */
function lifeChanged(){ syncLang(); save(); paintLife(); paintSheet(); paintTabs(); }
function gearPick(i){ return (S.gear && S.gear[i]) || 0; }
/* A gear option is {text, short, note, href}, not a bare string — the gloss has to be resolved at
   generation time, not at runtime. */
function gearItem(item, i){ return item.options[gearPick(i)] || item.options[0]; }
function gearText(item, i){ return gearItem(item, i).text; }
/* Every pointer out of the wizard goes through ref(). Inside the host book a target
   is an in-page anchor ("#section-id") and becomes a link. The standalone generator
   ships without the book, so its data carries a page citation instead ("CRB 144")
   and the same sentence ends in that citation chip. Empty means nothing to point
   at. `text` is markup, already escaped by the caller. */
function ref(href, text){
  if(!href) return text;
  if(href.charAt(0) === "#") return '<a href="' + href + '">' + text + "</a>";
  return text + ' <span class="cgcite">' + esc(href) + "</span>";
}
function link(key, text){ return ref(D.links[key], text); }
/* A corebook page the wizard cites at runtime: the host book's "CRB 104" chip, or —
   on the standalone page, whose data says `pageCite` — the same chip ref() writes. */
function pageChip(n){
  return D.pageCite ? '<span class="cgcite">' + esc(D.pageCite + n) + "</span>"
                    : '<span class="p">СТР ' + n + "</span>";
}

/* "Athletics 2" tells a newcomer nothing. What answers the question is what the
   number can DO, and the book already has the vocabulary: the DV ladder. tier()
   returns the hardest difficulty a given STAT+Skill total clears on a d10 of 5 or
   better — six outcomes in ten, so "usually" is literally true and no threshold had
   to be invented. Crits only help, so this never overstates. */
function tier(total){
  var best = null;
  for(var i=0;i<D.dv.length;i++) if(D.dv[i].dv <= total + 5) best = D.dv[i];
  return best;
}
/* The chip must show its arithmetic. Naming the tier alone read as a claim that
   the number was already enough — "12" sitting next to "Professional" when
   that tier is DV 17 looks simply wrong, and the reader has no way to see that the
   missing 5 comes off the d10. So the DV and the roll it needs are printed under
   the name, always. It is also NOT a button: it was bordered and shaded, and the
   muted low tiers read as disabled controls. Weight and colour carry the ramp. */
/* Rolling the check where the check lives. The chapter already explains
   STAT + Skill + 1d10; letting the row do it is the difference between reading
   that and understanding it. The crit rule is the book's: a natural 10 rolls again and
   adds, a natural 1 rolls again and subtracts, and the second die never crits. */
var rolls = {};
function rollCheck(total){
  var d = d10(), extra = 0, kind = "";
  if(d === 10){ extra = d10(); kind = "крит"; }
  else if(d === 1){ extra = -d10(); kind = "провал"; }
  return {d:d, extra:extra, sum: total + d + extra, kind:kind};
}
function rollPop(btn, name, stat, level, total){
  var r = rollCheck(total), t = tier(total);
  var dice = "<span>"+r.d+"</span>";
  if(r.kind) dice += "<span>" + (r.extra<0 ? "−"+(-r.extra) : "+"+r.extra) + "</span>";
  var h = '<div class="g-t">'+esc(name)+"</div>"
        + '<div class="g-f">'+esc(stat)+" "+(total-level)+" + навык "+level+" + 1d10</div>"
        + '<div class="g-dice">'+dice+"</div>"
        + '<div class="g-sum">'+r.sum+" <small>результат</small></div>";
  if(r.kind === "крит")
    h += '<div class="g-crit">Натуральная 10 — критический успех: кубик брошен ещё раз и прибавлен.</div>';
  else if(r.kind === "провал")
    h += '<div class="g-crit">Натуральная 1 — критический провал: кубик брошен ещё раз и вычтен.</div>';
  if(t)
    h += '<div class="g-d">СЛ '+t.dv+" («"+esc(t.name)+"») — "
       + (r.sum >= t.dv ? "<b>успех</b>" : "не хватило " + (t.dv - r.sum)) + ".</div>";
  if(window.CPR_POP) window.CPR_POP(btn, h);
  return r;
}

function tierChip(total){
  var t = tier(total);
  if(!t) return '<span class="cgtier t0">ничего надёжно<span class="cgdv">даже СЛ 9 — '
              + "нужно " + (9 - total) + "+ на 1d10</span></span>";
  var idx = D.dv.indexOf(t), need = Math.max(1, t.dv - total);
  return '<span class="cgtier t'+(idx+1)+'" title="'+esc(t.what)+'">'
       + '<span class="cgtn">'+esc(t.name)+"</span>"
       + '<span class="cgdv">СЛ '+t.dv+" · нужно "+need+"+ на 1d10</span></span>";
}
function bar(v){
  return '<span class="cgbar"><i style="width:'+Math.min(100, v*10)+'%"></i></span>';
}

function role(){
  if(!S.role) return null;
  for(var i=0;i<D.roles.length;i++) if(D.roles[i].name===S.role) return D.roles[i];
  return null;
}

/* ---- starting cyberware, and what it costs -------------------------------------
   The corebook grants a fixed set of implants to both fast methods (printed 117,
   headed "For Street Rats (Templates) and Edgerunners"), prices the Humanity in, and
   says to subtract it from current Humanity and see what that does to EMP. So a character's EMP is NOT the number the template
   gave — it is that number minus the implants — and Humanity is not EMP × 10
   either. Two skills run off EMP (Social, Human Perception), so this moves their
   totals too.
   `S.stats` deliberately keeps the RAW template row: step 2 is the rolling step and
   its block has to be verbatim what the book's table prints. Everything downstream
   reads through eff(). */
/* Method #3 gets no fixed starting package (printed 104: cyberware is bought out of
   the same 2,550eb as everything else) — so its HL total is summed off whichever
   freeform Gear/Style rows the player flagged as Cyberware, rather than
   read off role().cyber. #1/#2 DO have a fixed package, but their own 500eb
   (printed 98) can also go on cyberware bought freeform on the same pane — that
   HL has to stack onto the package's, not vanish, or a row that says "7 HL" would
   sit on the gear pane while Humanity on the sheet never moved. The EMP delta
   uses the same relationship the generator already verified for the fixed
   packages (the data export: `emp = -ceil(hl/10)`), just computed at runtime. */
function calcCyberTotal(lists){
  var t = 0;
  for(var L=0;L<lists.length;L++){
    var rows = gearRows(lists[L]);
    for(var i=0;i<rows.length;i++)
      if(rows[i].cyber) t += (rows[i].hl || 0) * (rows[i].qty || 1);
  }
  return t;
}
function cyber(){
  if(isCalc()){
    var hl = calcCyberTotal(["buy", "style"]);
    return {hl: hl, emp: hl ? -Math.ceil(hl / 10) : 0};
  }
  var r = role(), base = (r && r.cyber) ? r.cyber : null;
  var extraHl = calcCyberTotal(["start"]);
  if(!base && !extraHl) return null;
  var hl = (base ? base.hl : 0) + extraHl;
  return {hl: hl, emp: hl ? -Math.ceil(hl / 10) : 0,
          items: base ? base.items : [], extraHl: extraHl};
}
function empDelta(){ var c = cyber(); return c ? c.emp : 0; }
function eff(code){
  if(!S.stats) return null;
  var v = S.stats[code];
  return code === "ЭМП" ? Math.max(0, v + empDelta()) : v;
}
function cyberPick(i){ return (S.cyber && S.cyber[i]) || 0; }
function cyberItem(item, i){ return item.options[cyberPick(i)] || item.options[0]; }

/* ---- derived numbers. The formulas are the book's, not restated anywhere else. ---- */
function derived(){
  if(!S.stats) return null;
  var body = S.stats["ТЕЛ"], will = S.stats["ВОЛЯ"];
  var hp = 10 + 5*Math.ceil((body+will)/2);
  var c = cyber(), hl = c ? c.hl : 0, base = S.stats["ЭМП"];
  return {hp:hp, serious:Math.ceil(hp/2), death:body,
          hum: base*10 - hl, humBase: base*10, hl: hl,
          emp: eff("ЭМП"), empBase: base};
}

/* ---- what the Role itself hands over, and what it still asks of the player -----
   Until this block existed the sheet said "Combat Awareness, rank 4" and stopped —
   true, and unusable. Rank 4 is not a label: it has already granted the Exec
   his flat and his first subordinate, it tells the Lawman exactly who answers a
   call, and for three Roles it is a POOL that nobody has spent yet. The Medtech was
   the worst of them: Surgery and Medical Tech are not among the book's 66
   at all — the book grants them through the ability alone — so his sheet carried
   no level for the two skills that make him a Medtech.
   Everything here is per-Role state (S.abil) and dies with the Role. */
function rank4(){ var r = role(); return (r && r.rank4) ? r.rank4 : null; }
function pool(){ var k = rank4(); return (k && k.pool) ? k.pool : null; }
function picks(){ var k = rank4(); return (k && k.picks) ? k.picks : null; }
/* The extra tab is driven by the data, not by the Role's name: the generator
   asserts that this Role's own rank table is what grants the subordinate. */
function subSpec(){ var k = rank4(); return (k && k.sub && D.subord) ? D.subord : null; }

function points(){ return (S.abil && S.abil.points) || {}; }
function ptsOf(name){ var v = points()[name]; return (typeof v === "number") ? v : 0; }
function ptsSpent(){
  var p = pool(), t = 0; if(!p) return 0;
  for(var i=0;i<p.opts.length;i++) t += ptsOf(p.opts[i].name);
  return t;
}
function ptsLeft(){ var p = pool(); return p ? p.budget - ptsSpent() : 0; }
function ptsCap(opt){
  var p = pool();
  var cap = p && p.caps ? p.caps[opt.name] : undefined;
  return (typeof cap === "number") ? cap : p.budget;
}
/* What N points in this ability actually DO. Two shapes, and the difference is the
   book's, not a styling choice: three of Solo's six abilities are bought in tiers
   ("2 points → −1 damage, 4 → −2"), the other three are "1 per step". A tier below the
   cheapest one buys nothing at all, and saying so is the point — otherwise a Solo
   with 1 point in Damage Deflection reads as though he had the ability. */
/* A fresh sheet opens with every pool option at 0, and the column then read
   "empty" six times down — which is true and answers nobody's question. What the
   reader is deciding is where to put the points, so an unspent row shows what the
   FIRST one buys. It is already in the data, and `.cgqual` (the quiet grey the
   sheet uses for qualifiers) keeps it a proposal rather than a fact. */
function ptsPreview(opt){
  var cost = (opt.tiers && opt.tiers.length) ? opt.tiers[0].cost : 1;
  var what = (opt.tiers && opt.tiers.length) ? opt.tiers[0].what : opt.what;
  return '<span class="cgqual">за ' + cost + " "
       + (cost === 1 ? "очко" : (cost < 5 ? "очка" : "очков")) + " — " + what + "</span>";
}
function ptsEffect(opt, n){
  if(!n) return "";
  if(opt.tiers && opt.tiers.length){
    var best = null;
    for(var i=0;i<opt.tiers.length;i++) if(opt.tiers[i].cost <= n) best = opt.tiers[i];
    return best ? best.what
                : "<i>меньше, чем нужно: первый уровень стоит "+opt.tiers[0].cost+"</i>";
  }
  return opt.what;
}
/* The Medtech's two skills, and the Fixer's second language: skills that exist
   only because of the Role ability, and therefore have to reach the skill table
   with everything else. Same shape as a package skill, plus `src` — the way into
   the chapter that grants it, since neither is in the book's list of 66. */
function abilSkills(){
  var p = pool(), out = [], r = role();
  if(p && p.skills){
    for(var i=0;i<p.skills.length;i++){
      var sp = p.skills[i], n = 0;
      for(var f=0;f<sp.from.length;f++) n += ptsOf(sp.from[f]);
      var level = Math.min(sp.max, n * sp.mul);
      out.push({skill: sp.skill, stat: sp.stat, level: level, what: sp.what,
                from: sp.from.join(" + "), href: r ? r.abilityHref : "",
                spec: "", zero: level === 0});
    }
  }
  var pk = picks();
  if(pk && pk.kind === "fixer"){
    var lang = (S.abil && S.abil.lang) || "", cul = (S.abil && S.abil.culture) || "";
    /* The culture is the half of this grant that matters at the table — the
       language is what you roll, the culture is what it gets you into — so the
       row names it instead of describing the rule in the abstract. */
    out.push({skill: pk.skill, stat: pk.stat, level: pk.level, spec: lang,
              what: cul ? ("«Свой чел»: " + cul + " — их язык и их коды.")
                        : "«Свой чел»: язык культуры, в которую Фиксер умеет вливаться.",
              from: "", href: r ? r.abilityHref : "", zero: false});
  }
  return out;
}

/* Nomad: four decisions, each "vehicle OR upgrade", and then which of the
   vehicles he actually has with him — the book lets him hold one at a time. */
function slots(){ return (S.abil && S.abil.slots) || {}; }
function slotOf(i){ return slots()[i] || ""; }
function slotTaken(){
  var pk = picks(), out = [];
  if(!pk || pk.kind !== "nomad") return out;
  for(var i=0;i<pk.slots;i++){
    var v = slotOf(i);
    if(v.indexOf("v:") === 0) out.push(v.slice(2));
  }
  return out;
}
function slotLabel(v){
  var pk = picks();
  if(!v || !pk) return "";
  if(v.indexOf("v:") === 0) return v.slice(2);
  for(var i=0;i<pk.upgrades.length;i++)
    if(pk.upgrades[i].name === v.slice(2)) return "Улучшение: " + pk.upgrades[i].name;
  return v.slice(2);
}

/* The sheet's rank-4 block. Three parts, and a Role has one or two of them:
   facts (already granted — nothing to decide), a pool of points, and the two
   Roles whose grant is a thing to pick rather than a number to spend.
   `keep`, not `esc`: these strings come out of the book's own cells through
   the export, which escapes everything and restores <b>/<i> only. */
/* The installation price per place (mall, clinic, hospital) — read off the book's own table
   rather than typed here, like every other number in this wizard. The price is
   an unbreakable pair: `eb` becomes a glossary <button> at load, so a price is two
   inline boxes and the browser will happily wrap between them. */
function installLine(){
  var list = (D.cash && D.cash.install) || [], out = [];
  for(var i=0;i<list.length;i++)
    out.push(list[i].where.toLowerCase() + " <span class=\"nb\">"
             + esc(list[i].eb) + "</span>");
  return out.join(", ");
}

function rank4Block(){
  var k = rank4(); if(!k) return "";
  var h = "";
  if(k.facts.length){
    h += '<div class="tw"><table class="mx cgfacts"><tbody>';
    for(var i=0;i<k.facts.length;i++)
      h += "<tr><th>"+esc(k.facts[i].k)+"</th><td>"+k.facts[i].v+"</td></tr>";
    h += "</tbody></table></div>";
  }
  if(k.note) h += '<p class="note">'+k.note+"</p>";
  h += poolBlock() + picksBlock();
  return h;
}

function poolBlock(){
  var p = pool(); if(!p) return "";
  var left = ptsLeft();
  var h = '<p class="cgpoolhead"><b>'+p.budget+"</b> "
        + (p.budget === 1 ? "очко" : (p.budget < 5 ? "очка" : "очков"))
        + " на ранге "+D.abilityRank
        + ' <span class="cgbleft'+(left ? " cgbon" : "")+'">осталось <b>'+left
        + "</b></span></p>";
  h += '<p class="cglegend">'+p.what+"</p>";
  h += '<div class="tw"><table class="mx cgpool"><thead><tr><th>Куда</th>'
     + '<th class="n">Очки</th><th>Что это даёт</th></tr></thead><tbody>';
  for(var i=0;i<p.opts.length;i++){
    var o = p.opts[i], n = ptsOf(o.name), cap = ptsCap(o);
    h += "<tr><th>"+esc(o.name)+"</th>"
       + '<td class="n"><span class="cgstep">'
       + '<button type="button" class="cgpm" data-cg="ptdown" data-opt="'+esc(o.name)+'"'
       + (n <= 0 ? " disabled" : "") + ' title="−1 очко">−</button>'
       + "<b>"+n+"</b>"
       + '<button type="button" class="cgpm" data-cg="ptup" data-opt="'+esc(o.name)+'"'
       + (left <= 0 || n >= cap ? " disabled" : "") + ' title="+1 очко">+</button>'
       + "</span></td><td>"+(ptsEffect(o, n) || ptsPreview(o))
       + "</td></tr>";
  }
  h += "</tbody></table></div>";
  return h;
}

function picksBlock(){
  var pk = picks(); if(!pk) return "";
  var h = "", i;
  if(pk.kind === "nomad"){
    h += '<p class="cglegend">'+pk.note+"</p>";
    h += '<ul class="cggear cgslots">';
    for(i=0;i<pk.slots;i++){
      h += '<li><select class="cgsel" data-cg="slot" data-slot="'+i+'">'
         + '<option value=""'+(slotOf(i) ? "" : " selected")+">— решение "+(i+1)+" —</option>";
      h += '<optgroup label="Транспорт в Автопарк">';
      for(var v=0;v<pk.vehicles.length;v++){
        var key = "v:"+pk.vehicles[v];
        h += '<option value="'+esc(key)+'"'+(slotOf(i)===key ? " selected" : "")+">"
           + esc(pk.vehicles[v])+"</option>";
      }
      h += "</optgroup>";
      var band = "";
      for(var u=0;u<pk.upgrades.length;u++){
        var up = pk.upgrades[u];
        if(up.group !== band){
          if(band) h += "</optgroup>";
          band = up.group;
          h += '<optgroup label="Улучшение — '+esc(band)+'">';
        }
        var ukey = "u:"+up.name;
        h += '<option value="'+esc(ukey)+'"'+(slotOf(i)===ukey ? " selected" : "")+">"
           + esc(up.name)+"</option>";
      }
      if(band) h += "</optgroup>";
      h += "</select></li>";
    }
    h += "</ul>";
    /* Which one he is actually driving. Offered only once something has been put
       in the Motor Pool — a chooser with no options is a dead control, and four
       upgrades and no vehicle is a legal spend. */
    var have = slotTaken();
    if(have.length){
      var drive = (S.abil && S.abil.drive) || "";
      h += '<p class="cgrow"><label>Транспорт Семьи на руках: '
         + '<select class="cgsel" data-cg="drive"><option value="">— не выбран —</option>';
      for(i=0;i<have.length;i++)
        h += '<option value="'+esc(have[i])+'"'+(drive===have[i] ? " selected" : "")+">"
           + esc(have[i])+"</option>";
      h += "</select></label></p>";
      h += '<p class="note">ПЗТ, число мест и боевая СКО каждой машины — '
         + link("transport", "в Перестрелке") + ".</p>";
    }
  }
  if(pk.kind === "fixer"){
    h += '<p class="cglegend">'+pk.note+"</p>";
    var cul = (S.abil && S.abil.culture) || "", lng = (S.abil && S.abil.lang) || "";
    h += '<p class="cgrow"><label>Культура: <input type="text" class="cgtext" '
       + 'data-cg="culture" value="'+esc(cul)+'" placeholder="чей район ты понимаешь"></label>'
       + ' <label>Язык: <input type="text" class="cgtext" data-cg="abillang" list="cg-abillang" '
       + 'value="'+esc(lng)+'" placeholder="и на чём там говорят"></label></p>';
    var list = (D.hints && D.hints["Язык"]) || [];
    if(list.length){
      h += '<datalist id="cg-abillang">';
      for(i=0;i<list.length;i++) h += '<option value="'+esc(list[i])+'">';
      h += "</datalist>";
    }
  }
  return h;
}

/* ---- the Role's own Lifepath ---------------------------------------------
   Printed 53–69, and the generator did not have it: everybody rolled the eleven
   tables every character rolls and nothing at all about the job. It is where a
   Solo gets his moral code, an Exec his boss and a Nomad his clan.
   Two things make it different from the common lifepath, and both are the book's:
   the tables are per-Role, and seven of them sit behind a FORK — "In a group — straight
   to step 5" — so a step can be one the character never answers. `pathShown()` is
   that gate, and an optional step whose fork has not been answered is not "empty",
   it does not exist. */
function pathSpec(){ var r = role(); return (r && r.path) ? r.path : null; }
function forkPick(n){
  var f = (S.rpath && S.rpath.fork) || {}, v = f[n];
  return (typeof v === "number") ? v : -1;
}
function pathRoll(n){ var q = (S.rpath && S.rpath.roll) || {}; return q[n] || 0; }
function pathShown(){
  var p = pathSpec(); if(!p) return [];
  var on = {}, out = [];
  for(var i=0;i<p.steps.length;i++){
    var st = p.steps[i];
    if(st.optional && !on[st.n]) continue;
    out.push(st);
    if(st.fork){
      var pick = forkPick(st.n);
      if(pick >= 0){
        var en = st.fork[pick].enable;
        for(var e=0;e<en.length;e++) on[en[e]] = true;
      }
    }
  }
  return out;
}
function pathStarted(){
  var shown = pathShown();
  for(var i=0;i<shown.length;i++)
    if(shown[i].fork ? forkPick(shown[i].n) >= 0 : pathRoll(shown[i].n)) return true;
  return false;
}
/* An unrolled table is not an outstanding field — the book says the whole path is
   "roll 1d10 OR pick", and empty rows break nothing, which is why the common
   lifepath does not count them either. An unanswered FORK is different: it hides
   the steps behind it, so nothing after it can be filled in. It is counted only
   once the player has actually started the path, or a fresh character would carry
   a badge for a screen he has not reached. */
function pendingPath(){
  var out = [], shown = pathShown();
  if(!pathStarted()) return out;
  for(var i=0;i<shown.length;i++)
    if(shown[i].fork && forkPick(shown[i].n) < 0)
      out.push("Ролевой путь: " + shown[i].q);
  return out;
}

function pendingAbil(){
  var out = [], p = pool(), pk = picks();
  if(p && ptsLeft() > 0) out.push(ptsLeft() + " нераспределённых очков");
  if(pk && pk.kind === "nomad"){
    for(var i=0;i<pk.slots;i++) if(!slotOf(i)) out.push("Автопарк: решение " + (i+1));
    if(slotTaken().length && !((S.abil && S.abil.drive) || ""))
      out.push("Какой транспорт с собой");
  }
  if(pk && pk.kind === "fixer"){
    if(!((S.abil && S.abil.culture) || "").trim()) out.push("Вторая культура");
    if(!((S.abil && S.abil.lang) || "").trim()) out.push("Её язык");
  }
  return out;
}

/* ---------------------------------------------------------------- step 1: Role */
function paintRoles(){
  var buttons = root.querySelectorAll('[data-cg="role"]');
  for(var i=0;i<buttons.length;i++)
    buttons[i].classList.toggle("on", buttons[i].getAttribute("data-role")===S.role);
}
root.addEventListener("click", function(ev){
  var card = ev.target.closest ? ev.target.closest('[data-cg="role"]') : null;
  if(!card) return;
  var name = card.getAttribute("data-role");
  /* S.gear goes with the rest. It is keyed by POSITION in the Role's gear list, so
     keeping it across a Role change re-applied the old index to a different item:
     choosing Solo's "Bulletproof Shield" over "Heavy Melee Weapon" (item 2, option 1)
     and then switching to Lawman silently handed him option 1 of *his* item 2 —
     "Standard Shotgun Ammo x100" instead of the rifle ammunition —
     a choice nobody made, on a line that looks answered. */
  /* S.srolls and S.levels index into THIS Role's template and skill list, so they
     go too — an Edgerunner who switches Role keeps neither his column rolls nor his
     point-buy, both of which described the Role he left. */
  /* S.abil, S.rpath and S.sub describe the Role too, and more literally than the
     rest: a Solo's four Combat Awareness points name abilities a Medtech does not
     have, a Nomad's Motor Pool means nothing to a Media, the Role path is a
     different set of tables per Role, and the subordinate exists for the Exec
     alone. Carried across, every one of them renders a complete, plausible and
     wrong block. */
  /* Method #3 is the exception: its STATs, skills and gear are a GM-assigned pool,
     a free pick from all 66 and a purchase respectively — none of them read
     anything off the Role, so none of them have to be thrown away when the Role
     changes. Only the rank-4 payload and its Lifepath are Role's own under
     every method, calc included. */
  if(S.role !== name){
    S.role = name;
    if(!isCalc()){ S.stats = null; S.roll = null; S.picks = {};
                   S.gear = {}; S.cyber = {}; S.srolls = []; S.levels = {}; }
    S.abil = {}; S.rpath = {}; S.sub = {};
  }
  paintRoles(); save(); paintAll(); go(2);
});

/* --------------------------------------------------------------- step 2: STATs */
function setStats(n){
  var r = role(); if(!r) return;
  S.roll = n;
  var row = r.tpl[n-1], out = {};
  for(var i=0;i<D.stats.length;i++) out[D.stats[i]] = row[i];
  S.stats = out; save(); paintAll();
}
/* ---- Method #2: one 1d10 per STAT, read down that STAT's column (printed 77).
   S.srolls holds the ten dice; S.stats is derived from them and is set ONLY when
   all ten are in. That is deliberate: ready() and every consumer downstream already
   treat S.stats as "the STATs exist", and a half-filled block would have to be
   special-cased in the sheet, the derived numbers and the skill totals alike. The
   partial progress is shown by step 2's own grid instead. */
function sroll(i){ var a = S.srolls || []; return a[i] || 0; }
function setSRoll(i, value){
  var a = (S.srolls || []).slice();
  while(a.length < D.stats.length) a.push(0);
  a[i] = value; S.srolls = a; recalcStats();
}
function recalcStats(){
  var r = role();
  if(!r){ S.stats = null; return; }
  var out = {};
  for(var i=0;i<D.stats.length;i++){
    var d = sroll(i);
    if(!d){ S.stats = null; return; }
    out[D.stats[i]] = r.tpl[d-1][i];
  }
  S.stats = out;
}
function rolledCount(){
  var n = 0;
  for(var i=0;i<D.stats.length;i++) if(sroll(i)) n++;
  return n;
}
/* ---- Method #3: a GM-assigned point pool spent across all ten STATs at once
   (printed 78). Unlike #2's per-STAT dice, there is no "unrolled" state to track —
   every STAT always has a value, starting at the floor of 2, so S.statAlloc is
   filled to D.statMin the first time the pane is painted rather than lazily
   defaulting inside every reader. The pool itself is the SUM of all ten final
   values, not points spent above the floor — that is what the book's own worked
   example spends (62 points, ten STATs, nothing left over). */
function statPool(){
  var name = S.statBudget || D.statPoolDefault;
  for(var i=0;i<D.statPools.length;i++) if(D.statPools[i].name === name) return D.statPools[i];
  return D.statPools[0];
}
function ensureStatAlloc(){
  if(!S.statAlloc) S.statAlloc = {};
  for(var i=0;i<D.stats.length;i++)
    if(typeof S.statAlloc[D.stats[i]] !== "number") S.statAlloc[D.stats[i]] = D.statMin;
}
function statSpent3(){
  ensureStatAlloc();
  var t = 0;
  for(var i=0;i<D.stats.length;i++) t += S.statAlloc[D.stats[i]];
  return t;
}
function statLeft3(){ return statPool().points - statSpent3(); }
function recalcStats3(){
  ensureStatAlloc();
  if(statSpent3() !== statPool().points){ S.stats = null; return; }
  var out = {};
  for(var i=0;i<D.stats.length;i++) out[D.stats[i]] = S.statAlloc[D.stats[i]];
  S.stats = out;
}
/* Changing the preset changes the target sum, so an allocation built against the
   old one is no longer meaningful — reset to the floor rather than leaving stray
   points nobody asked for. Same "reset, don't try to convert" rule as the
   method-switch handler uses for STATs and skills generally. */
function setStatPool(name){
  S.statBudget = name;
  S.statAlloc = {}; ensureStatAlloc();
  recalcStats3(); save(); paintAll();
}
function bumpStat3(code, delta){
  ensureStatAlloc();
  var next = S.statAlloc[code] + delta;
  if(next < D.statMin || next > D.statMax) return;
  if(delta > 0 && statLeft3() <= 0) return;
  S.statAlloc[code] = next;
  recalcStats3(); save(); paintAll();
  var sel = '[data-cg="' + (delta > 0 ? "statup" : "statdown") + '"][data-code="' + code + '"]';
  var again = root.querySelector(sel);
  if(again && !again.disabled) again.focus();
}
function paintStatPoolPick(){
  var box = q("statpoolpick"); if(!box) return;
  var cur = statPool(), h = "";
  for(var i=0;i<D.statPools.length;i++){
    var p = D.statPools[i];
    h += '<button type="button" class="cgbtn cgmini'+(p.name===cur.name?" on":"")+'" '
       + 'data-cg="statpool" data-name="'+esc(p.name)+'">'+esc(p.name)+' — '+p.points+'</button>';
  }
  box.innerHTML = h;
}
function paintStatBudget3(){
  var box = q("statbudget"); if(!box) return;
  ensureStatAlloc();
  var left = statLeft3(), pool = statPool();
  box.innerHTML = '<span class="cgbleft'+(left ? " cgbon" : "")+'">Осталось <b>'+left
    + "</b> из "+pool.points+"</span>";
}
function paintStatAlloc(){
  var box = q("statalloc"); if(!box) return;
  ensureStatAlloc();
  var left = statLeft3(), h = '<div class="tw"><table class="mx"><thead><tr><th>СТАТ</th>'
        + '<th class="n">Значение</th><th></th></tr></thead><tbody>';
  for(var i=0;i<D.stats.length;i++){
    var code = D.stats[i], v = S.statAlloc[code];
    h += "<tr><th>"+code+' <span class="cgspec">'+esc(D.statFull[code]||"")+"</span>"+statWhat(code)+"</th>"
       + '<td class="n">'+v+bar(v)+"</td>"
       + '<td><span class="cgstep">'
       + '<button type="button" class="cgpm" data-cg="statdown" data-code="'+code+'"'
       + (v <= D.statMin ? " disabled" : "") + ' title="−1">−</button>'
       + '<button type="button" class="cgpm" data-cg="statup" data-code="'+code+'"'
       + (v >= D.statMax || left <= 0 ? " disabled" : "") + ' title="+1">+</button>'
       + "</span></td></tr>";
  }
  box.innerHTML = h + "</tbody></table></div>";
}
/* What a STAT is for, as an .itsub line under its name. #2 and #3 each have a
   table where every STAT is set, and the step used to print the same ten numbers
   twice more under it — a bare summary row and a "What it is" table. The meaning now
   rides in the table where the number is decided, and only #1 (which has no such
   table — one die sets the whole row) keeps a table of its own for it. */
function statWhat(code){
  var nfo = D.statNotes[code];
  return nfo && nfo.what
    ? '<span class="itsub">'+esc(nfo.group ? nfo.group + " · " + nfo.what : nfo.what)+"</span>" : "";
}
function paintStatCalc(){
  if(!isCalc()) return;
  paintStatPoolPick(); paintStatBudget3(); paintStatAlloc();
}
root.addEventListener("click", function(ev){
  var t = ev.target;
  if(t.getAttribute && t.getAttribute("data-cg")==="statpool") setStatPool(t.getAttribute("data-name"));
  if(t.getAttribute && t.getAttribute("data-cg")==="statup") bumpStat3(t.getAttribute("data-code"), 1);
  if(t.getAttribute && t.getAttribute("data-cg")==="statdown") bumpStat3(t.getAttribute("data-code"), -1);
});
/* Method #2's own control: ten rows, one per STAT, each with its die, the value that
   die selects in that STAT's column, and a way to re-roll or pick it by hand. The
   book's "left to right" is the row order, and the STAT that has not been rolled
   yet is the one to look at, so the untouched rows stay visibly empty. */
function paintStatGrid(){
  var grid = q("statgrid"), prog = q("statprog"), r = role();
  if(!grid) return;
  if(!r){ grid.innerHTML = ""; if(prog) prog.textContent = ""; return; }
  if(prog) prog.textContent = rolledCount() + " из " + D.stats.length;
  var h = '<div class="tw"><table class="mx"><thead><tr><th>СТАТ</th>'
        + '<th class="n">1d10</th><th class="n">Значение</th><th></th></tr></thead><tbody>';
  for(var i=0;i<D.stats.length;i++){
    var d = sroll(i), code = D.stats[i];
    h += "<tr"+(d?"":' class="cgtodo1"')+"><th>"+code
       + ' <span class="cgspec">'+esc(D.statFull[code]||"")+"</span>"+statWhat(code)+"</th>"
       + '<td class="d">'+(d ? d : "—")+"</td>"
       + '<td class="n">'+(d ? "<b>"+r.tpl[d-1][i]+"</b>"+bar(r.tpl[d-1][i]) : "—")+"</td>"
       + '<td><button type="button" class="cgbtn cgmini" data-cg="rollstat1" data-i="'+i+'">1d10</button>'
       + ' <select class="cgsel cgselnarrow" data-cg="pickstat1" data-i="'+i+'">'
       + '<option value="">выбрать…</option>';
    for(var m=1;m<=10;m++)
      h += '<option value="'+m+'"'+(d===m?" selected":"")+">"+m+" → "+r.tpl[m-1][i]+"</option>";
    h += "</select></td></tr>";
  }
  grid.innerHTML = h + "</tbody></table></div>";
}
function paintStats(){
  var box = q("statbox"), tbl = q("stattable"), out = q("statroll"), r = role();
  paintStatGrid(); paintStatCalc();
  /* Method #3 reads no Role template at all — the "show the whole table" details
     exists only for #1/#2's row/column read, so it has nothing to show here and
     is hidden rather than left open on an empty table. */
  var moreBox = tbl && tbl.closest("details");
  if(moreBox) moreBox.hidden = isCalc();
  if(!box) return;
  if(!r){ box.innerHTML = '<p class="cghint">Сначала выбери Роль.</p>'; if(tbl) tbl.innerHTML=""; return; }
  if(out) out.textContent = S.roll ? ("выпало " + S.roll) : "";

  if(!S.stats){ box.innerHTML = '<p class="cghint">'
    + (isEdge() ? "Каждому СТАТу нужен свой бросок — брось все десять или по одному."
                : isCalc() ? "Раздели весь пул в таблице выше, пока «Осталось» не дойдёт до 0 — тогда здесь появятся СТАТы и производные."
                : "Брось кубик — или разверни таблицу и выбери строку.") + "</p>"; }
  else {
    var dv = derived(), h = "";
    /* the bar says "high or low" without inventing words for it — the book only
       puts STATs in roughly 1..8, so a scale is honest where a label is not.
       Only #1 needs this table: #2/#3 already show every STAT, its bar and what it
       is for in the table above, where it was set (see statWhat). */
    if(!isEdge() && !isCalc()){
      h += '<div class="tw"><table class="mx"><thead><tr><th>СТАТ</th><th class="n">У тебя</th>'
         + "<th>Группа</th><th>Что это</th></tr></thead><tbody>";
      for(var s2=0;s2<D.stats.length;s2++){
        var code = D.stats[s2], nfo = D.statNotes[code] || {group:"",what:""};
        h += "<tr><th>"+code+' <span class="cgspec">'+esc(D.statFull[code]||"")+"</span></th>"
           + '<td class="n"><b>'+S.stats[code]+"</b>"+bar(S.stats[code])+"</td>"
           + "<td>"+esc(nfo.group)+"</td><td>"+esc(nfo.what)+"</td></tr>";
      }
      h += "</tbody></table></div>";
    }
    h += '<p class="cglegend">Полоска — насколько число велико: обычные СТАТы идут от 1 до 8.</p>';
    h += '<div class="tw"><table class="mx"><thead><tr><th>Производное</th><th class="n">Значение</th><th>Откуда</th></tr></thead><tbody>';
    h += '<tr><th>Пункты Здоровья</th><td class="n">'+dv.hp+'</td><td>10 + 5 × (ТЕЛ + ВОЛЯ) ÷ 2, вверх</td></tr>';
    h += '<tr><th>Порог тяжёлого ранения</th><td class="n">'+dv.serious+'</td><td>половина ПЗ, вверх</td></tr>';
    h += '<tr><th>Спасбросок от смерти</th><td class="n">'+dv.death+'</td><td>равен ТЕЛ</td></tr>';
    /* The Role's starting implants are already paid for here, so the "source"
       column has to say so — "EMP × 10" beside a number that is not EMP × 10 is
       the kind of line a reader checks once and stops trusting. */
    /* Where the implants are listed differs by method: #1/#2's fixed package is
       printed on the Sheet, #3's are its own rows on the Gear step. Naming a
       step by number here was wrong for both — the strip renumbers itself. */
    h += '<tr><th>Человечность</th><td class="n">'+dv.hum+"</td><td>"
       + (dv.hl ? dv.empBase + " × 10 = " + dv.humBase + ", минус " + dv.hl
                  + (isCalc() ? " ПЧ за импланты, купленные на шаге «Снаряжение»"
                              : " ПЧ за стартовые импланты (список — на Листе)")
                : "ЭМП × 10")
       + "</td></tr>";
    if(dv.hl)
      h += '<tr><th>ЭМП после имплантов</th><td class="n">'+dv.emp+"</td><td>"
         + dv.hum + " ÷ 10 = " + dv.emp + " — каждый полный десяток Человечности это "
         + "единица ЭМП; проверки на ЭМП идут от этого числа</td></tr>";
    h += '</tbody></table></div>';
    box.innerHTML = h;
  }

  if(tbl){
    var t = '<div class="tw"><table class="mx"><thead><tr><th class="n">1d10</th>';
    for(var k=0;k<D.stats.length;k++) t += '<th class="n">'+D.stats[k]+'</th>';
    t += '<th></th></tr></thead><tbody>';
    /* The same table serves both methods, but "what is selected" means different
       things in it. Under #1 a whole row is taken, so the row highlights and each
       row offers "take". Under #2 one CELL per column is in force and the rest of
       that row is not — highlighting the row would state the opposite of the rule
       the step exists to teach — so the ten chosen cells are marked instead and
       there is nothing to take: selection lives in the per-STAT grid above. */
    for(var n=0;n<10;n++){
      t += (!isEdge() && S.roll===n+1 ? '<tr class="on">' : "<tr>") + '<td class="d">'+(n+1)+'</td>';
      for(var m=0;m<10;m++)
        t += '<td class="n'+(isEdge() && sroll(m)===n+1 ? " cgcell" : "")+'">'+r.tpl[n][m]+'</td>';
      t += "<td>"+(isEdge() ? ""
        : '<button type="button" class="cgbtn cgmini" data-cg="pickrow" data-row="'+(n+1)+'">взять</button>')
        + "</td></tr>";
    }
    tbl.innerHTML = t + "</tbody></table></div>";
  }
}
root.addEventListener("click", function(ev){
  var t = ev.target;
  if(t.getAttribute && t.getAttribute("data-cg")==="roll"){
    ev.preventDefault(); ev.stopPropagation();
    rolls[t.getAttribute("data-key")] = rollPop(t,
      t.getAttribute("data-key"), t.getAttribute("data-stat"),
      +t.getAttribute("data-level"), +t.getAttribute("data-total"));
  }
  if(t.getAttribute && t.getAttribute("data-cg")==="rollstats"){ setStats(d10()); }
  if(t.getAttribute && t.getAttribute("data-cg")==="pickrow"){ setStats(+t.getAttribute("data-row")); }
  if(t.getAttribute && t.getAttribute("data-cg")==="rollall10"){
    for(var i10=0;i10<D.stats.length;i10++) setSRoll(i10, d10());
    save(); paintAll();
  }
  if(t.getAttribute && t.getAttribute("data-cg")==="rollstat1"){
    setSRoll(+t.getAttribute("data-i"), d10()); save(); paintAll();
  }
  if(t.getAttribute && t.getAttribute("data-cg")==="clearstats"){
    S.srolls = []; S.stats = null; save(); paintAll();
  }
});
root.addEventListener("change", function(ev){
  var t = ev.target;
  if(t.getAttribute && t.getAttribute("data-cg")==="pickstat1"){
    setSRoll(+t.getAttribute("data-i"), t.value ? +t.value : 0);
    save(); paintAll();
  }
});

/* -------------------------------------------------------------- step 3: skills */
/* One column grid for every skill table (the Role's list, the 66, the player's own),
   so the three line up when stacked. Fixed layout: with the default auto layout each
   table sized its columns to its own contents and none matched. */
function skillCols(withCost){
  return '<colgroup>' + (withCost
    ? '<col style="width:38%"><col style="width:12%"><col style="width:9%"><col style="width:13%"><col style="width:10%"><col style="width:18%">'
    : '<col style="width:42%"><col style="width:12%"><col style="width:14%"><col style="width:10%"><col style="width:22%">')
    + '</colgroup>';
}
function paintSkills(){
  var box = q("skillbox"), r = role();
  if(!box) return;
  /* Method #3 buys from all 66 skills, not a Role's 20 — a different enough shape
     (search, category bands, a variable floor) that it gets its own render
     function and its own div (skillbox3) rather than a branch threaded through
     this one. */
  if(isCalc()){ box.innerHTML = ""; paintSkills3(); return; }
  /* Switching away from #3 live left its 66-skill table standing under this one —
     skills you could see and not buy. paintSkills3 is the only thing that fills it. */
  var box3 = q("skillbox3"); if(box3) box3.innerHTML = "";
  if(!r){ box.innerHTML = '<p class="cghint">Сначала выбери Роль.</p>'; return; }
  var h = '<p class="cglegend">Проверка — <b>СТАТ + Навык + 1d10</b> против сложности. '
        + 'Колонка <b>Обычно берёт</b> — самая трудная задача, которая этому навыку '
        + 'по силам <b>чаще, чем нет</b>. Число в ней меньше СЛ не случайно: разницу '
        + 'добирает кубик, поэтому там и написано, сколько нужно выбросить. '
        + 'Лестница сложностей целиком — ' + link("checks", "в Проверках и Навыках") + ".</p>";
  var edge = isEdge(), cols = edge ? 6 : 5;
  h += '<div class="tw"><table class="rf cgskilltbl">' + skillCols(edge) + '<thead><tr><th>Навык</th>'
        + '<th class="n">' + (edge ? "Уровень" : "Ур") + "</th>"
        + (edge ? '<th class="n">Очки</th>' : "")
        + '<th class="n">СТАТ</th><th class="n">Всего</th><th>Обычно берёт</th></tr></thead><tbody>';
  var group = null;
  for(var i=0;i<r.skills.length;i++){
    var s = r.skills[i];
    var kind = s.core ? "Основной" : "Профессиональный";
    if(kind !== group){
      group = kind;
      h += '<tr class="cathead"><th colspan="'+cols+'">'+kind+(s.core?" — есть у каждого":" — от Роли")+'</th></tr>';
    }
    var stat = eff(s.stat);
    var name = esc(s.skill) + (s.x2 ? ' <span class="x2">×2</span>' : "");
    if(s.pick !== null && s.pick !== undefined && s.pick === ""){
      var val = S.picks[s.skill] || "";
      var list = (D.hints[s.skill]||[]);
      name += ' <input type="text" class="cgpick" data-cg="pick" data-skill="'+esc(s.skill)+'"'
            + ' value="'+esc(val)+'" placeholder="выбери 1"'
            + (list.length ? ' list="cg-'+encodeURIComponent(s.skill)+'"' : "") + '>';
      if(list.length){
        name += '<datalist id="cg-'+encodeURIComponent(s.skill)+'">';
        for(var L=0;L<list.length;L++) name += '<option value="'+esc(list[L])+'">';
        name += "</datalist>";
      }
    } else if(s.pick){
      name += ' <span class="cgspec">(' + esc(s.pick) + ')</span>';
    }
    /* the book's own one-line "what it allows", under the name as an .itsub line
       rather than its own column — and it keeps the row one row */
    if(s.what) name += '<span class="itsub">'+esc(s.what)+"</span>";
    var level = lv(s), total = (stat===null) ? null : stat + level;
    /* "DEX" alone made the sum look like it came from nowhere: by this step the
       STATs are already rolled, so the column can show the number it contributes. */
    var statCell = esc(s.stat) + (stat===null ? "" : ' <span class="cgsv">'+stat+"</span>");
    /* Under Method #2 the level is a control, not a value. "+" is refused when the
       next level costs more than is left, so the budget can never be overspent —
       the rules have no notion of debt, and a counter that can go negative invites
       the reader to leave it there. */
    var lvCell;
    if(edge){
      var step = s.x2 ? 2 : 1;
      lvCell = '<span class="cgstep">'
        + '<button type="button" class="cgpm" data-cg="lvdown" data-skill="'+esc(s.skill)+'"'
        + (level <= D.skillMin ? " disabled" : "") + ' title="−1 уровень">−</button>'
        + '<b>'+level+"</b>"
        + '<button type="button" class="cgpm" data-cg="lvup" data-skill="'+esc(s.skill)+'"'
        + (level >= D.skillMax || unspent() < step ? " disabled" : "") + ' title="+1 уровень">+</button>'
        + "</span>";
    } else lvCell = String(level);
    h += "<tr><th>"+name+'</th><td class="n">'+lvCell+"</td>"
       + (edge ? '<td class="n">'+costOf(s)+"</td>" : "")
       + '<td class="n">'+statCell+"</td>"
       + '<td class="n">'
       + (total===null ? "—"
          : '<button type="button" class="cgsum" data-cg="roll" data-key="'+esc(s.skill)
            + '" data-stat="'+esc(s.stat)+'" data-level="'+level
            + '" data-total="'+total+'" title="Бросить проверку">'+total+"</button>")
       + "</td>"
       + "<td>"+(total===null?"—":tierChip(total))+"</td></tr>";
  }
  h += "</tbody></table></div>";
  h += '<p class="note"><span class="x2">×2</span> — '
     + (edge ? "навык стоит <b>два очка за уровень</b>, остальные по одному "
             + "(колонка «Очки» считает это за тебя). Ниже "+D.skillMin+" и выше "
             + D.skillMax+" правила не пускают."
             : "навык стоит вдвое дороже при прокачке; на старте это ни на что не "
             + "влияет. Уровни здесь трогать не нужно: набор Роли книга выдаёт целиком.")
     + "</p>";
  box.innerHTML = h;
  paintBudget();
}
/* The budget bar. It lives on step 3 because that is where the points are spent —
   the count of what is left ALSO rides on the step's tab, which is what makes it
   visible from steps 4 and 5. */
function paintBudget(){
  var box = q("budget"); if(!box) return;
  var r = role();
  if(!r){ box.innerHTML = ""; return; }
  var leftN = unspent();
  var tight = (leftN === 0 && isEdge())
    ? '<span class="cghint">Все 86 очков уже стоят в наборе Роли, поэтому «+» нигде не нажимается. '
      + 'Чтобы вложить в другой навык, сначала убери очки у другого («−») или нажми «всё в минимум».</span>' : "";
  box.innerHTML = '<span class="cgbleft'+(leftN ? " cgbon" : "")+'">Осталось <b>'+leftN
    + "</b> из "+D.budget+"</span>"
    + '<span class="cgbpre">'
    + '<button type="button" class="cgbtn cgmini" data-cg="preset" data-kind="role">набор Роли</button>'
    + '<button type="button" class="cgbtn cgmini" data-cg="preset" data-kind="four">по 4 в каждый</button>'
    + '<button type="button" class="cgbtn cgmini" data-cg="preset" data-kind="min">всё в минимум</button>'
    + "</span>" + tight;
}
/* A stepper repaints the table it lives in, so the button under the cursor is a new
   element and has lost focus. The mouse does not notice; the keyboard does, and
   spending 44 points one Tab at a time is exactly how this control gets used. So
   focus is put back on the equivalent button — unless the change disabled it, where
   moving on is the right behaviour anyway. */
function bump(skill, delta){
  var r = role(); if(!r) return;
  for(var i=0;i<r.skills.length;i++){
    var s = r.skills[i];
    if(s.skill !== skill) continue;
    var step = s.x2 ? 2 : 1, next = lv(s) + delta;
    if(next < D.skillMin || next > D.skillMax) return;
    if(delta > 0 && unspent() < step) return;
    if(!S.levels) S.levels = {};
    S.levels[skill] = next;
    save(); paintAll();
    var sel = '[data-cg="' + (delta > 0 ? "lvup" : "lvdown") + '"][data-skill="' + skill + '"]';
    var again = root.querySelector(sel);
    if(again && !again.disabled) again.focus();
    return;
  }
}
/* Own skills: a name, a STAT and ×2 or not, bought from the same points. */
function paintHomebrew(){
  var box = q("hbbox"); if(!box) return;
  if(!hbOn() || !role()){ box.innerHTML = ""; return; }
  var h = '<p class="cglegend"><b>Свои навыки.</b> Нужен навык, которого нет в списке выше '
        + '(хомбрю, настройка кампании)? Впиши название, выбери СТАТ и добавь — он тратит те же очки '
        + 'и попадёт на лист.</p>';
  if(S.homebrew.length){
    h += '<div class="tw"><table class="rf cgskilltbl">' + skillCols(true) + '<thead><tr><th>Свой навык</th><th class="n">Уровень</th>'
       + '<th class="n">Очки</th><th class="n">СТАТ</th><th class="n">Всего</th><th>Обычно берёт</th></tr></thead><tbody>';
    for(var i=0;i<S.homebrew.length;i++){
      var e = S.homebrew[i], step = e.x2 ? 2 : 1, sv = eff(e.stat), tot = (sv===null) ? null : sv + e.level;
      h += "<tr><th>"+esc(e.name)+(e.x2 ? ' <span class="x2">×2</span>' : "")
         + (e.what ? '<span class="itsub">'+esc(e.what)+"</span>" : "")
         + ' <button type="button" class="cgbtn cgmini" data-cg="hbrm" data-i="'+i+'" title="Убрать навык">✕</button></th>'
         + '<td class="n"><span class="cgstep">'
         + '<button type="button" class="cgpm" data-cg="hbdown" data-i="'+i+'"'
         + (e.level <= 0 ? " disabled" : "") + ' title="−1 уровень">−</button><b>'+e.level+"</b>"
         + '<button type="button" class="cgpm" data-cg="hbup" data-i="'+i+'"'
         + (e.level >= D.skillMax || hbLeft() < step ? " disabled" : "") + ' title="+1 уровень">+</button>'
         + '</span></td><td class="n">'+hbCost(e)+'</td><td class="n">'+esc(e.stat)
         + (sv===null ? "" : ' <span class="cgsv">'+sv+"</span>")+'</td><td class="n">'
         + (tot===null ? "—"
            : '<button type="button" class="cgsum" data-cg="roll" data-key="'+esc(e.name)
              + '" data-stat="'+esc(e.stat)+'" data-level="'+e.level+'" data-total="'+tot
              + '" title="Бросить проверку">'+tot+"</button>")
         + "</td><td>"+(tot===null ? "—" : tierChip(tot))+"</td></tr>";
    }
    h += "</tbody></table></div>";
  }
  if(S.homebrew.length < HB_MAX){
    h += '<p class="cgrow"><input type="text" class="cgpick" data-cg="hbname" maxlength="40" placeholder="Название навыка"> '
       + '<input type="text" class="cgpick" data-cg="hbwhat" maxlength="200" placeholder="Описание — что позволяет"> '
       + '<select data-cg="hbstat">';
    for(var s=0;s<D.stats.length;s++) h += '<option>'+esc(D.stats[s])+"</option>";
    h += '</select> <label><input type="checkbox" data-cg="hbx2"> ×2</label> '
       + '<button type="button" class="cgbtn" data-cg="hbadd">Добавить навык</button></p>';
  }
  box.innerHTML = h;
}
function hbBump(i, delta){
  var e = S.homebrew[i]; if(!e) return;
  var next = e.level + delta, step = e.x2 ? 2 : 1;
  if(next < 0 || next > D.skillMax) return;
  if(delta > 0 && hbLeft() < step) return;
  e.level = next;
  save(); paintAll();
  var again = root.querySelector('[data-cg="'+(delta > 0 ? "hbup" : "hbdown")+'"][data-i="'+i+'"]');
  if(again && !again.disabled) again.focus();
}
root.addEventListener("click", function(ev){
  var t = ev.target, a = t.getAttribute && t.getAttribute("data-cg");
  if(a === "hbup") hbBump(+t.getAttribute("data-i"), 1);
  if(a === "hbdown") hbBump(+t.getAttribute("data-i"), -1);
  if(a === "hbrm"){ S.homebrew.splice(+t.getAttribute("data-i"), 1); save(); paintAll(); }
  if(a === "hbadd"){
    var nameIn = q("hbname"), name = hbName(nameIn ? nameIn.value : "");
    if(!name || S.homebrew.length >= HB_MAX) return;
    S.homebrew.push({name:name, stat:q("hbstat").value, x2:q("hbx2").checked, level:0,
                      what:hbWhat(q("hbwhat") ? q("hbwhat").value : "")});
    save(); paintAll();
    var again = q("hbname"); if(again) again.focus();
  }
});
/* The Role's point pool, same stepper and the same focus rule as the skill
   point-buy above: the table is repainted, so the button under the cursor is a new
   element and the keyboard would otherwise be dropped back to the top of the page. */
function bumpPoint(name, delta){
  var p = pool(); if(!p) return;
  var found = null;
  for(var i=0;i<p.opts.length;i++) if(p.opts[i].name === name) found = p.opts[i];
  if(!found) return;
  var next = ptsOf(name) + delta;
  if(next < 0 || next > ptsCap(found)) return;
  if(delta > 0 && ptsLeft() <= 0) return;
  if(!S.abil) S.abil = {};
  if(!S.abil.points) S.abil.points = {};
  S.abil.points[name] = next;
  save(); paintAll();
  var sel = '[data-cg="' + (delta > 0 ? "ptup" : "ptdown") + '"][data-opt="' + name + '"]';
  var again = root.querySelector(sel);
  if(again && !again.disabled) again.focus();
}
root.addEventListener("click", function(ev){
  var t = ev.target, a = t.getAttribute && t.getAttribute("data-cg");
  if(a === "lvup") bump(t.getAttribute("data-skill"), 1);
  if(a === "lvdown") bump(t.getAttribute("data-skill"), -1);
  if(a === "ptup") bumpPoint(t.getAttribute("data-opt"), 1);
  if(a === "ptdown") bumpPoint(t.getAttribute("data-opt"), -1);
  if(a === "preset"){ preset(t.getAttribute("data-kind")); save(); paintAll(); }
});

/* ---- Method #3's skill step: 86 points over ALL 66 corebook skills (printed 90),
   not just a Role's 20 — same budget and ×2 rule as #2, but the floor is per-skill
   (2 for the 13 in D.baseSkills, 0 — i.e. not bought — for the rest) rather than a
   single SKILL_MIN applied to a fixed list. D.skills is canonical_skills()'s own
   dict (name -> {stat, cat, x2, what}), already in the book's category order —
   nothing new was mined for this. */
/* Skills with a specialisation (Language, Local Expert, Science, Play Instrument — the ones D.hints names) are bought separately for each one: you must pick a specific language each time you raise this skill
   (printed 135). So #3 lets a player hold several of them. The first copy is keyed
   by the plain name, as before, so older saves read unchanged; each further copy
   is "Language #2", "Language #3"…, keyed the same way in S.skills3 and S.picks. A further
   copy has no floor, stays on screen at 0 until removed with its own ✕, and
   everything that prices or prints a skill reads its base name through skillBase(). */
function skillBase(key){ var i = key.indexOf("#"); return i < 0 ? key : key.slice(0, i); }
function isExtra3(key){ return key.indexOf("#") >= 0; }
function multi3(name){ return D.hints.hasOwnProperty(name); }
function copies3(name){
  var out = [name];
  if(!multi3(name)) return out;
  var extra = [];
  for(var k in (S.skills3 || {}))
    if(S.skills3.hasOwnProperty(k) && isExtra3(k) && skillBase(k) === name) extra.push(k);
  extra.sort(function(a, b){ return (+a.split("#")[1]) - (+b.split("#")[1]); });
  return out.concat(extra);
}
/* Every bought copy of every skill, in the book's order — what the sheet prints. */
function boughtKeys3(){
  var out = [], names = Object.keys(D.skills);
  for(var i=0;i<names.length;i++){
    var c = copies3(names[i]);
    for(var j=0;j<c.length;j++) if(skillLevel3(c[j]) > 0) out.push(c[j]);
  }
  return out;
}
function addCopy3(name){
  if(!multi3(name)) return;
  var n = 2;
  while((S.skills3 || {}).hasOwnProperty(name + "#" + n)) n++;
  S.skills3[name + "#" + n] = 0;
  save(); paintAll();
}
function removeCopy3(key){
  if(!isExtra3(key)) return;
  delete S.skills3[key]; delete S.picks[key];
  save(); paintAll();
}
function skillMin3(name){ return D.baseSkills.indexOf(name) !== -1 ? D.skillMin : 0; }
function skillLevel3(name){
  var v = (S.skills3 || {})[name];
  return (typeof v === "number") ? v : 0;
}
function skillCost3(name){
  var info = D.skills[skillBase(name)];
  return skillLevel3(name) * ((info && info.x2) ? 2 : 1);
}
function skillsSpent3(){
  var t = 0;
  for(var name in (S.skills3 || {})) if(S.skills3.hasOwnProperty(name)) t += skillCost3(name);
  return t + hbSpent();
}
function skillsLeft3(){ return D.budget - skillsSpent3(); }
/* The 13 mandatory skills start at their floor the first time this step is
   painted, the same "legal spread from the start" idea as #1's package being a
   legal #2 point-buy — an empty screen of zeroes answers nobody's question. */
/* Two of the 13 come with their specialisation already fixed — every Role
   package prints "Language (Street slang)" and "Local Expert (Your home)". #3
   left both as "not chosen", a blank on every #3 sheet that #1/#2 never had. The
   default is read off the packages (all ten agree), not typed here, and only
   fills an EMPTY field — a player who typed something keeps it. */
function basePick(name){
  for(var i=0;i<D.roles.length;i++){
    var sk = D.roles[i].skills;
    for(var j=0;j<sk.length;j++)
      if(sk[j].core && sk[j].skill === name && sk[j].pick) return sk[j].pick;
  }
  return "";
}
function ensureSkills3(){
  if(!S.skills3) S.skills3 = {};
  for(var i=0;i<D.baseSkills.length;i++){
    var name = D.baseSkills[i];
    if(typeof S.skills3[name] !== "number") S.skills3[name] = D.skillMin;
    if(D.hints.hasOwnProperty(name) && !(S.picks[name] || "").trim()){
      var bp = basePick(name);
      if(bp) S.picks[name] = bp;
    }
  }
}
function bumpSkill3(name, delta){
  var info = D.skills[skillBase(name)]; if(!info) return;
  ensureSkills3();
  var step = info.x2 ? 2 : 1, next = skillLevel3(name) + delta;
  if(next < skillMin3(name) || next > D.skillMax) return;
  if(delta > 0 && skillsLeft3() < step) return;
  if(next === 0 && !isExtra3(name)) delete S.skills3[name]; else S.skills3[name] = next;
  save(); paintAll();
  var sel = '[data-cg="' + (delta > 0 ? "sk3up" : "sk3down") + '"][data-skill="' + name + '"]';
  var again = root.querySelector(sel);
  if(again && !again.disabled) again.focus();
}
function paintBudget3(){
  var box = q("budget3"); if(!box) return;
  var left = skillsLeft3();
  box.innerHTML = '<span class="cgbleft'+(left ? " cgbon" : "")+'">Осталось <b>'+left
    + "</b> из "+D.budget+"</span>";
}
var skillFilter3 = "";
function paintSkills3(){
  var box = q("skillbox3"); if(!box) return;
  if(!role()){ box.innerHTML = ""; return; }
  ensureSkills3();
  var names = Object.keys(D.skills), q3 = skillFilter3.trim().toLowerCase();
  var h = '<div class="tw"><table class="rf cgskilltbl">' + skillCols(true) + '<thead><tr><th>Навык</th>'
        + '<th class="n">Уровень</th><th class="n">Очки</th>'
        + '<th class="n">СТАТ</th><th class="n">Всего</th><th>Обычно берёт</th></tr></thead><tbody>';
  var group = null, shown = 0;
  for(var i=0;i<names.length;i++){
    var base = names[i], info = D.skills[base];
    if(q3 && base.toLowerCase().indexOf(q3) === -1) continue;
    shown++;
    if(info.cat !== group){
      group = info.cat;
      h += '<tr class="cathead"><th colspan="6">'+esc(group)+'</th></tr>';
    }
    var copies = copies3(base);
    for(var cp=0;cp<copies.length;cp++){
    var name = copies[cp], extra = isExtra3(name), last = (cp === copies.length-1);
    var level = skillLevel3(name), min3 = skillMin3(name);
    var nm = esc(base) + (info.x2 ? ' <span class="x2">×2</span>' : "");
    if(multi3(base)){
      var val = S.picks[name] || "", list = D.hints[base] || [];
      nm += ' <input type="text" class="cgpick" data-cg="pick" data-skill="'+esc(name)+'"'
          + ' value="'+esc(val)+'" placeholder="выбери"'
          + (list.length ? ' list="cg-'+encodeURIComponent(base)+'"' : "") + '>';
      if(list.length && cp === 0){
        nm += '<datalist id="cg-'+encodeURIComponent(base)+'">';
        for(var L=0;L<list.length;L++) nm += '<option value="'+esc(list[L])+'">';
        nm += "</datalist>";
      }
      if(extra)
        nm += ' <button type="button" class="cgbtn cgmini" data-cg="sk3rm" data-skill="'+esc(name)
            + '" title="Убрать эту специализацию">✕</button>';
    }
    if(info.what && !extra) nm += '<span class="itsub">'+esc(info.what)+"</span>";
    /* The way to a second language sits under the LAST copy, so it is always
       right under the list it extends. */
    if(multi3(base) && last)
      nm += '<span class="itsub"><button type="button" class="cglinkbtn" data-cg="sk3add" data-skill="'
          + esc(base)+'">+ ещё '+esc(base.toLowerCase())+' — другая специализация, свой уровень</button></span>';
    var step = info.x2 ? 2 : 1;
    var lvCell = '<span class="cgstep">'
      + '<button type="button" class="cgpm" data-cg="sk3down" data-skill="'+esc(name)+'"'
      + (level <= min3 ? " disabled" : "") + ' title="−1 уровень">−</button>'
      + '<b>'+level+"</b>"
      + '<button type="button" class="cgpm" data-cg="sk3up" data-skill="'+esc(name)+'"'
      + (level >= D.skillMax || skillsLeft3() < step ? " disabled" : "") + ' title="+1 уровень">+</button>'
      + "</span>";
    var stat = eff(info.stat), total = (stat===null) ? null : stat + level;
    var statCell = esc(info.stat) + (stat===null ? "" : ' <span class="cgsv">'+stat+"</span>");
    h += "<tr"+(level < min3 ? ' class="cgtodo1"' : "")+"><th>"+nm+'</th>'
       + '<td class="n">'+lvCell+"</td>"
       + '<td class="n">'+skillCost3(name)+"</td>"
       + '<td class="n">'+statCell+"</td>"
       + '<td class="n">'
       + (total===null ? "—"
          : '<button type="button" class="cgsum" data-cg="roll" data-key="'
            + esc(base + ((S.picks[name]||"").trim() ? " ("+S.picks[name].trim()+")" : ""))
            + '" data-stat="'+esc(info.stat)+'" data-level="'+level
            + '" data-total="'+total+'" title="Бросить проверку">'+total+"</button>")
       + "</td>"
       + "<td>"+(total===null?"—":tierChip(total))+"</td></tr>";
    }
  }
  h += "</tbody></table></div>";
  if(!shown) h = '<p class="cghint">Ничего не найдено — попробуй другое слово.</p>';
  box.innerHTML = h;
  paintBudget3();
}
root.addEventListener("click", function(ev){
  var t = ev.target, a = t.getAttribute && t.getAttribute("data-cg");
  if(a === "sk3up") bumpSkill3(t.getAttribute("data-skill"), 1);
  if(a === "sk3down") bumpSkill3(t.getAttribute("data-skill"), -1);
  if(a === "sk3add") addCopy3(t.getAttribute("data-skill"));
  if(a === "sk3rm") removeCopy3(t.getAttribute("data-skill"));
});
root.addEventListener("input", function(ev){
  if(ev.target.getAttribute && ev.target.getAttribute("data-cg") === "skillsearch"){
    skillFilter3 = ev.target.value; paintSkills3();
  }
});

/* ---- Freeform purchase lists, one shape shared by three budgets:
     "buy"/"style" Method #3's own purchases (page 104–105) — no fixed package
     "start" #1/#2's spendable 500eb (printed 98: Street Rats and Edgerunners also get 500eb to spend on other items or keep for later)
   Same row shape, different budgets and — this is the part worth keeping
   straight — different fates for what's left over: Gear's remainder
   becomes starting cash, Style's remainder is simply lost, "start"'s remainder
   just stays what it always was — spendable cash the player kept instead of
   spending. A row can still be typed freeform, same as always — but it can
   also be picked off `D.catalog` (~450 real, priced items pulled from the
   already-built corebook and DLC chapters, pulled from the export), which
   fills name/price/cyber/hl for you and locks them so the row can't drift
   from what it was actually priced as. Either way the row ends up with the
   same four fields, and every consumer below (gearSpent, cyber(), the sheet)
   reads only those — it never asks where a row came from. */
function gearRows(which){ return S[which] || []; }
/* The catalogue picker: `D.catalog` -> a Map from its composed label (what
   the <option> shows — see catalogLabel()) back to the item, built once and
   reused by every list's search input. A <datalist> is created here rather
   than in the markup on purpose: the host book namespaces every
   literal `id="..."` in its markup (`cNN-...`), and a
   JS-created element is invisible to that rewrite — the same reason the
   per-skill hint fields build their own <datalist> in JS (see paintSkills3).
   TWO lists, split by `item.kind` (see the export): Style (printed
   104–105) is its own budget for clothing, not a second Gear — a Style
   search must never suggest a rifle, and a Gear search must never
   suggest a pair of boots. `catalogListId()` routes the Style field to the
   clothing list and every other purchase list (Gear, At start) to the
   gear one. `CATALOG_BY_LABEL` itself stays a single merged map — labels are
   already asserted unique across the whole catalogue in
   the export — because an exact typed match still has to
   resolve regardless of which list suggested it; the `kind` re-check that
   guards against typing a cross-category label anyway lives in the
   `catalogpick` input handler below, not here. */
var CATALOG_BY_LABEL = null;
var CATALOG_DATALIST_GEAR = "cg18-catalog-datalist-gear";
var CATALOG_DATALIST_CLOTHING = "cg18-catalog-datalist-clothing";
function catalogListId(which){
  return which === "style" ? CATALOG_DATALIST_CLOTHING : CATALOG_DATALIST_GEAR;
}
function ensureDatalist(id){
  var dl = document.getElementById(id);
  if(!dl){
    dl = document.createElement("datalist");
    dl.id = id;
    document.body.appendChild(dl);
  }
  return dl;
}
function catalogIndex(){
  if(CATALOG_BY_LABEL) return CATALOG_BY_LABEL;
  CATALOG_BY_LABEL = {};
  var gearDl = ensureDatalist(CATALOG_DATALIST_GEAR),
      clothDl = ensureDatalist(CATALOG_DATALIST_CLOTHING);
  var gearH = "", clothH = "";
  var items = D.catalog || [];
  for(var i=0;i<items.length;i++){
    CATALOG_BY_LABEL[items[i].label] = items[i];
    var opt = '<option value="'+esc(items[i].label)+'">';
    if(items[i].kind === "clothing") clothH += opt; else gearH += opt;
  }
  gearDl.innerHTML = gearH;
  clothDl.innerHTML = clothH;
  return CATALOG_BY_LABEL;
}
/* Pushes a LOCKED row — name/price/cyber/hl all come from the catalogue item
   and the row renders as plain text, not inputs (see paintGearList): the
   player picked a real, priced thing off the book, and editing it afterward
   would let the row drift from what it actually costs. Removing it and
   picking again is the only way to change one. */
/* The book's English name for a catalogue row, as the same .itsub[lang=en] line the
   reference puts under every name — so the player can find it in an English book. */
function gearAlt(row){
  return row.alt ? '<span class="itsub" lang="en">'+esc(row.alt)+"</span>" : "";
}
function pickFromCatalog(which, item){
  if(!S[which]) S[which] = [];
  S[which].push({name: item.name, price: item.price, qty: 1, cyber: item.cyber, hl: item.hl,
                locked: true, src: item.src, chip: item.chip, tier: item.tier,
                href: item.href, alt: item.alt || ""});
  save(); paintAll();
}
/* A locked row's real page citation — "BC 108", "CRB 108", "CRB 171"…
   whatever catalog_from_*() put in `chip` (always a genuine citation now,). Always linked to the item's own
   source section, same as every other citation chip in the book. */
function gearChip(row){
  if(!row.chip) return "";
  return row.href.charAt(0) === "#" ? ' <a href="'+esc(row.href)+'" class="p">'+esc(row.chip)+"</a>"
                  : ' <span class="p">'+esc(row.chip)+"</span>";
}
/* The price-TIER word ("Premium", "Cheap"...), where the source has one —
   a SECOND, separate badge from the citation above: it answers a different
   question ("what does this price tier mean") and links to a different
   place, the price ladder in the book's cheat sheet (`D.links.price_categories`), not the
   item's own list. Keeping the two apart is the fix for a real bug: a tier
   word used to double as chip AND as the "go to source" link, and for weapon
   mods/ammo that link opened on the book's "Weapon Quality" table — not the
   item's own row — so a word that reads like a quality label also behaved
   like one, landing the reader somewhere that seemed to confirm it. */
function gearTier(row){
  if(!row.tier) return "";
  var href = D.links && D.links.price_categories;
  return href && href.charAt(0) === "#" ? ' <a href="'+esc(href)+'" class="p">'+esc(row.tier)+"</a>"
              : ' <span class="p">'+esc(row.tier)+"</span>";
}
function bookBudget(which){
  if(which === "buy") return D.calcCash.main;
  if(which === "style") return D.calcCash.style;
  return D.cash.start;
}
function budgetKey(which){
  return which === "buy" ? "buyBudget" : which === "style" ? "styleBudget" : "startBudget";
}
/* The book states these as flat numbers, not a tiered table like the STAT pool —
   but a GM is free to hand out a different figure, so every budget is editable
   rather than baked-in. `null` (the default, and what a fresh *Budget field
   starts as) means "use the book's own number". */
function gearBudget(which){
  var custom = S[budgetKey(which)];
  var base = (typeof custom === "number") ? custom : bookBudget(which);
  /* "Over the money limit?" (page 117): the +1,500eb is stated as usable only on
     cyberware, but nothing else here enforces what a row is "for" either — the
     Cyberware checkbox is the only such constraint anywhere in this pane, and
     it is advisory, not a lock. Adding the bonus to the Gear budget rather
     than tracking a separate ring-fenced pot keeps that consistent: the note
     text says what it's for, the number doesn't police it. Method #3 only. */
  if(which === "buy" && S.sponsor && S.sponsor.active) base += D.sponsor.bonus;
  return base;
}
function setGearBudget(which, value){
  var key = budgetKey(which);
  S[key] = (value === "" || value === null) ? null : Math.max(0, Math.round(+value) || 0);
  save(); paintAll();
}
function gearSpent(which){
  var rows = gearRows(which), t = 0;
  for(var i=0;i<rows.length;i++) t += (rows[i].price || 0) * (rows[i].qty || 1);
  return t;
}
function gearLeft(which){ return gearBudget(which) - gearSpent(which); }
/* Overspending is flagged, not blocked — same "count it, don't refuse it" choice
   as #2's leftover skill points, because a freeform price field has no catalogue
   to validate against and a hard block would just be guessing at the player's
   arithmetic. */
function pendingGear(){
  var out = [];
  if(isCalc()){
    if(gearLeft("buy") < 0) out.push("перерасход по Снаряжению");
    if(gearLeft("style") < 0) out.push("перерасход по Стилю");
    if(S.sponsor && S.sponsor.active){
      if(!S.sponsor.kind) out.push("работодатель не выбран");
      if(!S.sponsor.hook) out.push("на крючке — не выбрано");
    }
  } else if(gearLeft("start") < 0) out.push("перерасход доп. покупок");
  return out;
}
function paintGearList(which, boxId){
  var box = q(boxId); if(!box) return;
  catalogIndex();
  var rows = gearRows(which), left = gearLeft(which), budget = gearBudget(which),
      book = bookBudget(which);
  /* The budget itself, editable — the book states these as flat numbers, not a
     GM-assigned tier table like the STAT pool, but nothing stops a GM handing out
     a different figure, so it is a plain number field rather than a constant.
     Empty clears back to the book's own default. */
  var h = '<p class="cgrow"><label>Бюджет, eb <input type="number" class="cgnum" min="0" step="1" '
        + 'data-cg="cashbudget" data-list="'+which+'" value="'+budget+'"></label>'
        + (budget !== book
           ? '<button type="button" class="cgbtn cgmini" data-cg="cashreset" data-list="'+which
             + '">по умолчанию ('+book+')</button>' : "")
        + "</p>";
  /* The catalogue search box: type a real item's name and pick it off the
     <datalist> (catalogIndex()) to add a LOCKED row below — same budget, same
     total, just filled and fixed instead of typed. Free typing here that never
     resolves to a real option is simply left in the field; only an exact match
     on `input` (see the listener below) adds anything. Deliberately not `change`:
     clicking a <datalist> option only guarantees an `input` event, and `change`
     on a text field otherwise waits for blur — so a click added nothing until
     focus left the field. */
  /* The search is THE way to add a row — it fills price, HL and the page — and it
     used to be a small grey field while "+ Add row" under the table was a
     real button: the eye went to the button, and rows got typed by hand off the
     book's price list. So the search is the big, framed control, and manual entry
     is a quiet link under the table for what the catalogue does not have. */
  h += '<div class="cgcatbox"><label class="cgcat"><span class="cgcatlab">Найти в книге</span>'
     + '<input type="text" class="cgtext" '
     + 'data-cg="catalogpick" data-list="'+which+'" list="'+catalogListId(which)+'" '
     + 'placeholder="'+(which === "style" ? "куртка, ботинки, очки…"
                                            : "пистолет, патроны, броня, имплант…")+'" autocomplete="off"></label>'
     + '<span class="cgcathint">Начни печатать и выбери из списка — цена'
     + (which === "style" ? "" : ", ПЧ")
     + " и страница подставятся сами.</span></div>";
  /* table-layout:fixed + a <colgroup>, not the default auto layout: without it,
     toggling one row's Cyberware checkbox swaps the HL cell between "—" and a
     number input, and an auto-layout table re-measures every column's width off
     whatever is now the widest cell — the whole table visibly jumps sideways for
     an edit to one row. Fixed layout sizes columns once, from the colgroup, and
     never again. Holds just as well for a locked row swapping an <input> for
     plain text. */
  var tableAt = h.length;
  h += '<div class="tw"><table class="mx cggeartbl"><colgroup>'
     + '<col style="width:36%"><col style="width:9%"><col style="width:16%">'
     + '<col style="width:15%"><col style="width:14%"><col style="width:10%"></colgroup>'
     + '<thead><tr><th>Название</th><th class="n">Кол-во</th>'
     + '<th class="n">Цена, eb</th><th>Кибернетика</th><th class="n">ПЧ</th><th></th></tr></thead><tbody>';
  /* Quantity is a count of how many of this row you bought, not part of what the
     row IS — so it stays editable even on a locked catalogue row (only name/price/
     cyber/hl are frozen to the book's own number). It multiplies both the price
     and, when the row is Cyberware, the HL — see gearSpent()/calcCyberTotal().
     Adding one row and bumping this is the point: no more pasting the same rifle
     in three times to buy three of it. */
  for(var i=0;i<rows.length;i++){
    var row = rows[i], qty = row.qty || 1;
    var qtyCell = '<td class="n"><input type="number" class="cgnum" min="1" step="1" data-cg="gearqty" '
       + 'data-list="'+which+'" data-i="'+i+'" value="'+qty+'"></td>';
    if(row.locked){
      h += '<tr><td>'+esc(row.name)+gearChip(row)+gearTier(row)+gearAlt(row)+"</td>"
         + qtyCell
         + '<td class="n">'+(row.price||0)
         + (qty>1 ? '<span class="itsub">×'+qty+" = "+((row.price||0)*qty)+'eb</span>' : "")+"</td>"
         + '<td>'+(row.cyber?"да":"—")+"</td>"
         + '<td class="n">'+(row.cyber?(row.hl||0):"—")
         + (row.cyber && qty>1 ? '<span class="itsub">×'+qty+" = "+((row.hl||0)*qty)+"</span>" : "")+"</td>"
         + '<td><button type="button" class="cgbtn cgmini" data-cg="gearrm" data-list="'+which
         + '" data-i="'+i+'" title="Удалить строку">✕</button></td></tr>';
      continue;
    }
    h += '<tr><td><input type="text" class="cgtext" data-cg="gearname" data-list="'+which
       + '" data-i="'+i+'" value="'+esc(row.name)+'" placeholder="что купил"></td>'
       + qtyCell
       + '<td class="n"><input type="number" class="cgnum" min="0" step="1" data-cg="gearprice" '
       + 'data-list="'+which+'" data-i="'+i+'" value="'+(row.price||0)+'">'
       + (qty>1 ? '<span class="itsub">= '+((row.price||0)*qty)+'eb</span>' : "")+"</td>"
       + '<td><input type="checkbox" data-cg="gearcyber" data-list="'+which+'" data-i="'+i+'"'
       + (row.cyber?" checked":"")+'></td>'
       + '<td class="n">'+(row.cyber
          ? '<input type="number" class="cgnum" min="0" step="1" data-cg="gearhl" data-list="'
            +which+'" data-i="'+i+'" value="'+(row.hl||0)+'">'
            + (qty>1 ? '<span class="itsub">×'+qty+" = "+((row.hl||0)*qty)+"</span>" : "")
          : "—")+"</td>"
       + '<td><button type="button" class="cgbtn cgmini" data-cg="gearrm" data-list="'+which
       + '" data-i="'+i+'" title="Удалить строку">✕</button></td></tr>';
  }
  h += "</tbody></table></div>";
  /* An empty list printed a header row over nothing; it now says where rows
     come from. */
  if(!rows.length)
    h = h.slice(0, tableAt) + '<p class="cghint">Пока ничего не куплено — найди предмет в поле выше.</p>';
  h += '<p class="cgrow">'
     + (left < 0 ? "" : '<span class="cgbleft">Останется: <b>'+left+"</b>eb"
        + (which === "buy" ? " — идёт в стартовые деньги"
           : which === "style" ? " — сгорает, не переносится"
           : " — остаётся у тебя как деньги на старте")
        + "</span>")
     + '<span class="cgmanual">Нет в книге? <button type="button" class="cglinkbtn" data-cg="gearadd" data-list="'
     + which + '">Вписать вручную</button></span>'
     + "</p>";
  /* Its own full-width callout, not folded into the row above — see .cgover.
     The fate note above ("goes into starting cash"…) describes what happens
     to money left OVER, so it drops out entirely once there is none. */
  if(left < 0){
    var overWhat = which === "buy" ? "по Снаряжению"
                 : which === "style" ? "по Стилю" : "доп. покупок на старте";
    h += '<p class="cgover"><b>⚠ Перерасход '+overWhat+': '+(-left)+"eb</b> сверх бюджета в "
       + budget+"eb.</p>";
  }
  box.innerHTML = h;
}
/* #1/#2 never had a step for their own 500eb (page 98) — it sat as a note on the
   sheet's Money row, unactionable. Same pane as Method #3's own purchases, same
   row shape and budget-edit control, just one list instead of two and no
   Style/sponsor block: the pane is generic over "which list(s) does THIS method
   spend", not calc-specific any more, so it stays on the strip (PANES id 7) for
   every method. */
/* `startbuybox` is NOT wrapped in a `data-mth="…"` block the way the two 500eb
   blurb paragraphs above it are (there is no single `data-mth` value that means
   "either fast method" the way the visibility sync at the bottom of this file
   wants one), so nothing hides it automatically when the method is calc. Left
   unpainted here, it would keep whatever it last rendered — a real bug, not a
   hypothetical one: add a #1/#2 purchase, switch to Complete Package (S.start does
   get cleared by the method-switch handler), and the OLD row + budget field
   for a "500eb" pool that no longer exists stayed on screen, because nothing
   ever repainted the box empty. Each branch below explicitly empties the OTHER
   method's box for exactly this reason — `paintGearList` already no-ops safely
   if its own box is missing. */
/* What #1/#2 already have, above what they can buy — the same lists the sheet
   prints (kitGearList/kitCyberList), choosers included. */
function paintStartKit(){
  var box = q("startkit"); if(!box) return;
  var r = role();
  if(!r){ box.innerHTML = ""; return; }
  var h = '<div class="cgkit"><h4>Уже есть — стартовый набор Роли</h4>'
        + '<p class="cglegend">Это книга выдаёт бесплатно; ниже — только то, что '
        + "покупаешь сверх. Где предложен выбор, выбери здесь или на Листе — это одно и то же.</p>"
        + kitGearList(r);
  var cy = cyber();
  if(cy && cy.items && cy.items.length)
    h += '<h4>Импланты — уже установлены</h4>' + kitCyberList(cy);
  box.innerHTML = h + "</div><h4>Докупить сверх набора</h4>";
}
function paintGearPane(){
  if(isCalc()){
    paintSponsor();
    paintGearList("buy", "buybox");
    paintGearList("style", "stylebox");
    var sb = q("startbuybox"); if(sb) sb.innerHTML = "";
    var kb = q("startkit"); if(kb) kb.innerHTML = "";
  } else {
    paintStartKit();
    paintGearList("start", "startbuybox");
    var bb = q("buybox"), tb = q("stylebox");
    if(bb) bb.innerHTML = ""; if(tb) tb.innerHTML = "";
  }
}
/* "Over the money limit?" (page 117) — an optional +1,500eb for cyberware, sold
   for one of three employers holding one of seven hooks over the character. Both
   selects are disabled until the checkbox is on: an employer or a hook chosen
   before the deal itself is accepted would be a fact about a character who never
   took it. */
function paintSponsor(){
  var box = q("sponsorbox"); if(!box) return;
  var sp = S.sponsor || {active:false,kind:"",hook:""};
  var h = '<p class="cgrow"><label><input type="checkbox" data-cg="sponsoron"'
        + (sp.active?" checked":"")+'> Продался за +'+D.sponsor.bonus+'eb на кибернетику</label>';
  h += '<label>Кому: <select class="cgsel" data-cg="sponsorkind"'+(sp.active?"":" disabled")+'>'
     + '<option value="">не выбрано</option>';
  for(var i=0;i<D.sponsor.kinds.length;i++)
    h += '<option value="'+esc(D.sponsor.kinds[i])+'"'+(sp.kind===D.sponsor.kinds[i]?" selected":"")+'>'
       + esc(D.sponsor.kinds[i])+"</option>";
  h += '</select></label>';
  h += '<label>На крючке: <select class="cgsel" data-cg="sponsorhook"'+(sp.active?"":" disabled")+'>'
     + '<option value="">не выбрано</option>';
  for(var j=0;j<D.sponsor.hooks.length;j++)
    h += '<option value="'+esc(D.sponsor.hooks[j])+'"'+(sp.hook===D.sponsor.hooks[j]?" selected":"")+'>'
       + esc(D.sponsor.hooks[j])+"</option>";
  h += "</select></label></p>";
  box.innerHTML = h;
}
root.addEventListener("click", function(ev){
  if(ev.target.getAttribute && ev.target.getAttribute("data-cg") === "sponsoron"){
    if(!S.sponsor) S.sponsor = {active:false,kind:"",hook:""};
    S.sponsor.active = ev.target.checked;
    /* Turning the deal off drops who/what with it — a hook and an employer only
       mean something attached to a deal that was actually taken. */
    if(!S.sponsor.active){ S.sponsor.kind = ""; S.sponsor.hook = ""; }
    save(); paintAll();
  }
});
root.addEventListener("change", function(ev){
  var t = ev.target, a = t.getAttribute && t.getAttribute("data-cg");
  if(a === "sponsorkind"){ S.sponsor.kind = t.value; save(); paintAll(); }
  if(a === "sponsorhook"){ S.sponsor.hook = t.value; save(); paintAll(); }
});
/* The sheet's own rendering of one list — same rows, read-only, plus the total
   and the carry-over-vs-burns line the money step depends on. */
/* `fate` says what happens to what's left over — the one thing that genuinely
   differs between the three lists (Method #3's Gear carries into starting
   cash, its Style burns, #1/#2's own 500eb just stays what it always was). */
function gearSheetHtml(which, label, fate){
  var rows = gearRows(which), budget = gearBudget(which), spent = gearSpent(which),
      left = gearLeft(which);
  var h = "<h4>"+esc(label)+" — "+budget+"eb</h4>";
  if(!rows.length){ h += '<p class="cghint">Пока ничего не куплено.</p>'; }
  else {
    h += '<ul class="cggear">';
    for(var i=0;i<rows.length;i++){
      var row = rows[i], qty = row.qty || 1;
      h += "<li>"+esc(row.name || "без названия")+(qty>1 ? " ×"+qty : "")+gearAlt(row)
         + " — <b>"+((row.price||0)*qty)+"eb</b>"
         + (qty>1 ? ' <span class="itsub">'+(row.price||0)+"eb × "+qty+"</span>" : "")
         + (row.cyber ? ' <span class="x2">'+((row.hl||0)*qty)+" ПЧ</span>" : "")
         + (row.locked && row.chip ? gearChip(row) : "") + "</li>";
    }
    h += "</ul>";
  }
  h += left < 0
     ? '<p class="cgover">Потрачено '+spent+" из "+budget+"eb — <b>⚠ перерасход "
       +(-left)+"eb</b>.</p>"
     : '<p class="note">Потрачено <b>'+spent+"</b> из "+budget+"eb. Останется <b>"+left
       +"</b>eb"+fate+"</p>";
  return h;
}
function addGearRow(which){
  if(!S[which]) S[which] = [];
  S[which].push({name:"", price:0, qty:1, cyber:false, hl:0});
  save(); paintAll();
}
function removeGearRow(which, i){
  if(!S[which] || !S[which][i]) return;
  S[which].splice(i, 1);
  save(); paintAll();
}
function setGearField(which, i, field, value){
  if(!S[which] || !S[which][i]) return;
  S[which][i][field] = value;
  save();
}
root.addEventListener("click", function(ev){
  var t = ev.target, a = t.getAttribute && t.getAttribute("data-cg");
  if(a === "gearadd") addGearRow(t.getAttribute("data-list"));
  if(a === "gearrm") removeGearRow(t.getAttribute("data-list"), +t.getAttribute("data-i"));
  if(a === "cashreset") setGearBudget(t.getAttribute("data-list"), null);
});
root.addEventListener("change", function(ev){
  var t = ev.target;
  if(t.getAttribute && t.getAttribute("data-cg") === "cashbudget")
    setGearBudget(t.getAttribute("data-list"), t.value);
});
/* Name is plain text with nothing computed from it, so it updates state without a
   repaint — same choice as the free-text note fields. Price, HL and the
   Cyberware checkbox all feed a total shown elsewhere (the budget line here, the
   Humanity chain on the sheet), so those use `change` — fires once, on blur —
   and repaint everything rather than risk the totals going stale while a digit is
   half-typed. */
root.addEventListener("input", function(ev){
  var t = ev.target, a = t.getAttribute && t.getAttribute("data-cg");
  if(a === "gearname")
    setGearField(t.getAttribute("data-list"), +t.getAttribute("data-i"), "name", t.value);
  /* The catalogue search field: `input` fires both on every keystroke and the
     instant a <datalist> option is clicked (that click is not guaranteed to
     also fire `change`, and a text field's `change` otherwise waits for blur —
     which is why this used to need a second click, or a tab-away, to register).
     Resolve the typed text against the label index built by catalogIndex()
     and, on an exact match, add a locked row. Free text that never matches a
     real item is left as-is: mistyping isn't an error here, it just adds
     nothing — so this fires on every keystroke harmlessly. */
  if(a === "catalogpick"){
    // No value="" on this field in the template, so the next paintGearList()
    // repaint (inside pickFromCatalog's paintAll()) already renders it empty.
    var list = t.getAttribute("data-list");
    var picked = catalogIndex()[t.value];
    /* The <datalist> attached to this field already only suggests the right
       `kind` (see catalogListId()), but the field is still a plain text input
       — typing another list's label verbatim would otherwise resolve too.
       Re-check kind against which field this is before adding the row. */
    if(picked && (picked.kind === "clothing") === (list === "style"))
      pickFromCatalog(list, picked);
  }
});
root.addEventListener("change", function(ev){
  var t = ev.target, a = t.getAttribute && t.getAttribute("data-cg");
  if(a === "gearprice"){
    setGearField(t.getAttribute("data-list"), +t.getAttribute("data-i"), "price", +t.value || 0);
    paintAll();
  }
  if(a === "gearqty"){
    setGearField(t.getAttribute("data-list"), +t.getAttribute("data-i"), "qty",
                 Math.max(1, Math.round(+t.value) || 1));
    paintAll();
  }
  if(a === "gearhl"){
    setGearField(t.getAttribute("data-list"), +t.getAttribute("data-i"), "hl", +t.value || 0);
    paintAll();
  }
  if(a === "gearcyber"){
    setGearField(t.getAttribute("data-list"), +t.getAttribute("data-i"), "cyber", t.checked);
    paintAll();
  }
});

root.addEventListener("input", function(ev){
  var t = ev.target;
  if(t.getAttribute && t.getAttribute("data-cg")==="pick"){
    S.picks[t.getAttribute("data-skill")] = t.value; save(); paintSheet(); paintTabs();
  }
  if(t.getAttribute && t.getAttribute("data-cg")==="name"){ S.name = t.value; save(); paintSheet(); }
  /* The Fixer's second culture and its language, and the subordinate's name.
     Typed, not chosen: the book names no list of cultures, and inventing one here
     would be inventing rules — the same reason "Science (pick 1)" is free text. */
  if(t.getAttribute && t.getAttribute("data-cg")==="culture"){
    if(!S.abil) S.abil = {};
    S.abil.culture = t.value; save(); paintTabs();
  }
  if(t.getAttribute && t.getAttribute("data-cg")==="abillang"){
    if(!S.abil) S.abil = {};
    S.abil.lang = t.value; save(); paintTabs();
  }
  if(t.getAttribute && t.getAttribute("data-cg")==="subname"){
    if(!S.sub) S.sub = {};
    S.sub.name = t.value; save();
  }
  if(t.getAttribute && t.getAttribute("data-cg")==="subnote"){
    if(!S.sub) S.sub = {};
    S.sub.note = t.value;
    t.style.height = "auto";
    t.style.height = Math.max(46, t.scrollHeight + 2) + "px";
    /* `.empty` is what print uses to drop an unfilled box, and it is computed when
       the block is rendered — typing does not re-render it, so without this the
       class goes stale and print drops exactly the box that has content. */
    if(t.parentNode && t.parentNode.classList)
      t.parentNode.classList.toggle("empty", !t.value.trim());
    /* …and the block around it, or print keeps "Who he is" as a bare heading. */
    var swrap = t.closest && t.closest(".cgnotes");
    if(swrap) swrap.classList.toggle("empty", !t.value.trim());
    /* Saved on every keystroke, but NOT repainted: the description shows on the
       sheet, and rebuilding six tables per letter is work nobody asked for. The
       sheet catches up on `change` — the same rule the Fixer's two fields use,
       and the same reason: a repaint must never land on the field being typed in. */
    save();
  }
  if(t.getAttribute && t.getAttribute("data-cg")==="note"){
    S.notes[t.getAttribute("data-key")] = t.value;
    t.style.height = "auto";
    t.style.height = Math.max(46, t.scrollHeight + 2) + "px";
    /* .empty is what print uses to drop unfilled boxes, and it is computed when the
       block is rendered — typing does not re-render, so without this the class went
       stale and printing hid the field the moment someone filled it in. */
    if(t.parentNode && t.parentNode.classList)
      t.parentNode.classList.toggle("empty", !t.value.trim());
    /* The block around them carries the same class for the same reason: with every
       field empty, print would otherwise keep "About the character" as a bare heading. */
    var wrap = t.closest && t.closest(".cgnotes");
    if(wrap){
      var some = false, ks = Object.keys(S.notes);
      for(var nk=0;nk<ks.length;nk++) if((S.notes[ks[nk]]||"").trim()){ some = true; break; }
      wrap.classList.toggle("empty", !some);
    }
    var pr = t.parentNode && t.parentNode.querySelector('[data-cg="noteprint"]');
    if(pr) pr.textContent = t.value;
    save();
  }
});

/* ------------------------------------------------------------ step 4: lifepath */
function paintLife(){
  var box = q("lifebox"); if(!box) return;

  /* EVERY line in this step is the same three-track row: label | value | controls.
     It used to render per-column tables with their controls inline in the value
     cell while ordinary tables put theirs in the third track, so the buttons
     zig-zagged down the page at a different x on every row. A choice (language, who was hurt) is a row too, for the same reason. */
  function row(label, sub, value, controls, cls){
    return '<div class="cglife'+(cls ? " "+cls : "")+'">'
         + '<div class="cglabel">'+label
         + (sub ? '<span class="cgsublab">'+sub+"</span>" : "") + "</div>"
         + '<div class="cgval">'+value+"</div>"
         + '<div class="cgacts">'+controls+"</div></div>";
  }
  /* The die chip is styled like every dice roller in the book, which helps nobody
     who has not clicked one yet — and this is the first screen where clicking one
     is REQUIRED rather than a convenience. At most one of the three shows at a
     time (all three live in Enemy's "How he answers"), so spelling it out costs one
     line and removes the whole question. */
  function rollHint(t, col){
    return needsDice(t, col)
      ? ' <span class="cgrollme">← нажми на кубик: книга не говорит, сколько их — это решает бросок</span>'
      : "";
  }
  function picker(t, col, chosen){
    var h = '<button type="button" class="cgbtn cgmini" data-cg="rollone" data-key="'
          + t.key+'" data-col="'+col+'">1d10</button>'
          + '<select class="cgsel" data-cg="pickone" data-key="'+t.key+'" data-col="'+col+'">'
          + '<option value="">выбрать из таблицы…</option>';
    for(var m=1;m<=10;m++){
      var lab = t.rows[m-1][col];
      if(lab.length > 44) lab = lab.slice(0,42) + "…";
      h += '<option value="'+m+'"'+(chosen===m?" selected":"")+">"+m+" — "+esc(lab)+"</option>";
    }
    return h + "</select>";
  }

  var h = "";
  for(var i=0;i<D.life.length;i++){
    var t = D.life[i], g = got(t);

    if(!t.perColumn){
      var val;
      if(!g) val = '<span class="cghint">не брошено</span>';
      else {
        var parts = [];
        for(var c=0;c<t.cols.length;c++){
          if(c === t.pickCol) continue;   // a "pick one" column is its own row
          var cell = cellOf(t, c);
          parts.push((t.cols.length>1 && t.pickCol===null
                      ? '<span class="cgcol">'+esc(shortCol(t, c))+":</span> " : "")
                     + diceHtml(cell, t.key, c) + rollHint(t, c));
        }
        val = '<span class="cgd">'+g[0]+"</span> "+parts.join(' <span class="cgsep">·</span> ');
      }
      h += row(esc(t.label), "", val, picker(t, 0, g ? g[0] : 0));
    } else {
      for(var c2=0;c2<t.cols.length;c2++){
        var v = cellOf(t, c2);
        h += row(c2 === 0 ? esc(t.label) : "",
                 esc(shortCol(t, c2)),
                 v ? ('<span class="cgd">'+g[c2]+"</span> "+diceHtml(v, t.key, c2)+rollHint(t, c2))
                   : '<span class="cghint">не брошено</span>',
                 picker(t, c2, g ? g[c2] : 0),
                 c2 === 0 ? "first" : "cont");
      }
    }

    /* the language the origin grants, and "who was hurt" — both are choices
       the book asks for, so both are rows like everything else */
    if(t.pickCol !== null && cellOf(t, t.pickCol)){
      var opts = cellOf(t, t.pickCol).split(/,\s*/), sel =
        '<select class="cgsel" data-cg="lang"><option value="">выбрать…</option>';
      for(var o=0;o<opts.length;o++)
        sel += "<option"+(S.lang===opts[o]?" selected":"")+">"+esc(opts[o])+"</option>";
      sel += "</select>";
      h += row("", esc(t.pickLabel), S.lang
                 ? esc(S.lang)+' <span class="cgor">+4 уровня бесплатно</span>'
                 : '<span class="cgtodoin">не выбран</span>', sel, "cont");
    }
    if(harmable(t)){
      var hs = '<select class="cgsel" data-cg="harm"><option value="">выбрать…</option>';
      for(var o2=0;o2<t.harm[1].length;o2++)
        hs += "<option"+(S.harm===t.harm[1][o2]?" selected":"")+">"+esc(t.harm[1][o2])+"</option>";
      hs += "</select>";
      h += row("", esc(t.harm[0]), S.harm ? esc(S.harm)
                 : '<span class="cgtodoin">не выбрано</span>', hs, "cont");
    }
  }

  /* …and then the Role's own path, in the same three-track row. It is a separate
     block with its own heading, not more rows in the same list: these tables
     belong to the Role, they change completely when the Role does, and the book
     prints them as a chapter of their own after the common ones. */
  var rp = pathSpec();
  if(rp){
    var shown = pathShown();
    h += '<h4 class="cgpathh">Ролевой путь — ' + esc(role().name) + "</h4>";
    h += '<p class="cglegend">Своя таблица на каждую Роль: кто ты в профессии, где '
       + 'работаешь и кто за тобой охотится. <b>Развилка</b> — это выбор, а не '
       + 'бросок: пока на неё не ответишь, шаги за ней не появятся. '
       + ref(rp.href, "Полные таблицы") + ".</p>";
    for(var s=0;s<shown.length;s++){
      var st = shown[s], num = '<span class="cgstepn">'+st.n+"</span> ";
      if(st.fork){
        var pick = forkPick(st.n);
        var fs = '<select class="cgsel" data-cg="fork" data-step="'+st.n+'">'
               + '<option value="">выбрать…</option>';
        for(var f=0;f<st.fork.length;f++)
          fs += '<option value="'+f+'"'+(pick===f?" selected":"")+">"
              + esc(st.fork[f].label)+"</option>";
        fs += "</select>";
        h += row(num+esc(st.q), "развилка",
                 pick >= 0 ? esc(st.fork[pick].label)
                           : '<span class="cgtodoin">не выбрано</span>',
                 fs, "cont");
      } else {
        var got_ = pathRoll(st.n), max = +st.die.slice(2);
        var ps = '<button type="button" class="cgbtn cgmini" data-cg="rollpath" '
               + 'data-step="'+st.n+'" data-die="'+max+'">'+esc(st.die)+"</button>"
               + '<select class="cgsel" data-cg="pickpath" data-step="'+st.n+'">'
               + '<option value="">выбрать из таблицы…</option>';
        for(var m=1;m<=max;m++){
          var lab = st.rows[m-1];
          if(lab.length > 44) lab = lab.slice(0,42) + "…";
          ps += '<option value="'+m+'"'+(got_===m?" selected":"")+">"+m+" — "
              + esc(lab)+"</option>";
        }
        ps += "</select>";
        h += row(num+esc(st.q), "",
                 got_ ? '<span class="cgd">'+got_+"</span> "+esc(st.rows[got_-1])
                      : '<span class="cghint">не брошено</span>',
                 ps, "cont");
      }
    }
  }
  box.innerHTML = h;
}
root.addEventListener("click", function(ev){
  var t = ev.target;
  if(t.getAttribute && t.getAttribute("data-cg")==="lifedice"){
    ev.preventDefault(); ev.stopPropagation();
    var c = +t.getAttribute("data-c"), f = +t.getAttribute("data-f");
    var op = t.getAttribute("data-op"), arg = +t.getAttribute("data-arg");
    var res = rollExpr(c, f, op, arg);
    if(!S.dice) S.dice = {};
    S.dice[diceKey(t.getAttribute("data-key"), t.getAttribute("data-col"))] = res;
    save();
    var lbl = c + "d" + f + (op ? " " + op + " " + arg : "");
    var body = '<div class="g-t">'+lbl+"</div>"
             + '<div class="g-dice">'+res.vals.map(function(v){return "<span>"+v+"</span>";}).join("")+"</div>"
             + '<div class="g-sum">'+res.out+" <small>результат</small></div>";
    if(op === "/")
      body += '<div class="g-d">'+res.sum+" ÷ "+arg+" = "+(res.sum/arg)
            + ", округляя вверх — <b>"+res.out+"</b>. Меньше одного не бывает.</div>";
    else if(op)
      body += '<div class="g-d">'+res.sum+" "+op+" "+arg+" = <b>"+res.out+"</b>.</div>";
    /* CPR_POP anchors to `t`, so it has to run BEFORE the repaint detaches it.
       The repaint then goes through lifeChanged() like every other write to the
       lifepath — this was the one handler that painted the rows and the sheet but
       not the tabs, which nothing noticed while an unrolled die counted for
       nothing. The moment it became an outstanding field, the badge stopped
       clearing when you rolled. */
    if(window.CPR_POP) window.CPR_POP(t, body);
    lifeChanged();
  }
  if(t.getAttribute && t.getAttribute("data-cg")==="rollone"){
    setDie(tableOf(t.getAttribute("data-key")), +t.getAttribute("data-col"), d10());
    lifeChanged();
  }
  if(t.getAttribute && t.getAttribute("data-cg")==="rollall"){
    rollTable(tableOf(t.getAttribute("data-key")));
    lifeChanged();
  }
  if(t.getAttribute && t.getAttribute("data-cg")==="rollpath"){
    if(!S.rpath) S.rpath = {};
    if(!S.rpath.roll) S.rpath.roll = {};
    S.rpath.roll[t.getAttribute("data-step")] = dN(+t.getAttribute("data-die"));
    lifeChanged();
  }
  if(t.getAttribute && t.getAttribute("data-cg")==="rolllife"){
    for(var i=0;i<D.life.length;i++) rollTable(D.life[i]);
    /* "Roll everything" rolls the Role's path too — but only the steps that are
       REACHABLE right now. A fork is a choice, not a die: rolling behind an
       unanswered one would invent an answer to a question the player has not been
       asked, and the moment they answer it the roll would belong to a branch they
       did not take. */
    var sh = pathShown();
    if(!S.rpath) S.rpath = {};
    if(!S.rpath.roll) S.rpath.roll = {};
    for(var p2=0;p2<sh.length;p2++)
      if(!sh[p2].fork) S.rpath.roll[sh[p2].n] = dN(+sh[p2].die.slice(2));
    lifeChanged();
  }
  if(t.getAttribute && t.getAttribute("data-cg")==="clearlife"){
    /* Everything the Lifepath produced, not just the dice that produced it:
       the language, "who was hurt" and the resolved inline dice are all answers
       to rows that no longer exist. The Role's path is part of the same step and
       goes with it. */
    S.life = {}; S.lang = ""; S.harm = ""; S.dice = {}; S.rpath = {}; lifeChanged();
  }
});
root.addEventListener("change", function(ev){
  var t = ev.target;
  if(t.getAttribute && t.getAttribute("data-cg")==="lang"){
    /* paintLife() as well: the language and "who was hurt" are rows in the
       Lifepath like any other, so picking one has to repaint that row —
       without it the line kept saying "not chosen" until something else forced a
       repaint, and the choice looked like it had not registered. */
    S.lang = t.value; save(); paintLife(); paintSheet(); paintTabs();
  }
  if(t.getAttribute && t.getAttribute("data-cg")==="fork"){
    if(!S.rpath) S.rpath = {};
    if(!S.rpath.fork) S.rpath.fork = {};
    var fstep = t.getAttribute("data-step");
    S.rpath.fork[fstep] = t.value === "" ? -1 : +t.value;
    /* Re-answering a fork takes a whole branch off the path, and the rolls made
       inside it answered questions this character is no longer asked — "who your partner is" for a Netrunner who now works alone. They are dropped, the same
       invalidation rule as the gear index and the Motor Pool. */
    var live = {};
    var sh2 = pathShown();
    for(var i2=0;i2<sh2.length;i2++) live[sh2[i2].n] = true;
    for(var k2 in S.rpath.roll || {})
      if(S.rpath.roll.hasOwnProperty(k2) && !live[k2]) delete S.rpath.roll[k2];
    lifeChanged();
  }
  if(t.getAttribute && t.getAttribute("data-cg")==="pickpath"){
    if(!S.rpath) S.rpath = {};
    if(!S.rpath.roll) S.rpath.roll = {};
    var pstep = t.getAttribute("data-step");
    if(t.value) S.rpath.roll[pstep] = +t.value;
    else delete S.rpath.roll[pstep];
    lifeChanged();
  }
  if(t.getAttribute && t.getAttribute("data-cg")==="gear"){
    if(!S.gear) S.gear = {};
    S.gear[t.getAttribute("data-item")] = +t.value;
    save(); paintSheet(); paintGearPane();   // the kit is drawn on both
  }
  if(t.getAttribute && t.getAttribute("data-cg")==="cyber"){
    if(!S.cyber) S.cyber = {};
    S.cyber[t.getAttribute("data-item")] = +t.value;
    save(); paintSheet(); paintGearPane();
  }
  /* The Nomad's Motor Pool. `drive` names a vehicle by its own name rather than
     by slot index, because the slot it came from can be re-decided underneath it —
     and then it has to be dropped, the same invalidation rule as everything else
     here: a value that belonged to a choice somebody changed. */
  if(t.getAttribute && t.getAttribute("data-cg")==="slot"){
    if(!S.abil) S.abil = {};
    if(!S.abil.slots) S.abil.slots = {};
    S.abil.slots[t.getAttribute("data-slot")] = t.value;
    var have = slotTaken(), keep = false;
    for(var v=0;v<have.length;v++) if(have[v] === S.abil.drive) keep = true;
    if(!keep) S.abil.drive = "";
    save(); paintSheet(); paintTabs();
  }
  if(t.getAttribute && t.getAttribute("data-cg")==="drive"){
    if(!S.abil) S.abil = {};
    S.abil.drive = t.value;
    save(); paintSheet(); paintTabs();
  }
  /* The Fixer's language reaches the skill table, so the sheet has to be
     repainted for it — but on `change`, never on `input`: a repaint replaces the
     very field being typed into, which this project has been bitten by before.
     Leaving the box is what commits it; `input` only saves and re-counts. */
  if(t.getAttribute && (t.getAttribute("data-cg")==="culture"
                        || t.getAttribute("data-cg")==="abillang"
                        || t.getAttribute("data-cg")==="subname"
                        || t.getAttribute("data-cg")==="subnote")){
    paintSheet(); paintTabs();
  }
  if(t.getAttribute && t.getAttribute("data-cg")==="subtype"){
    if(!S.sub) S.sub = {};
    /* The type decides which 1d6 table gets rolled, so a roll made against the
       previous type is meaningless — it is not "the same roll on a new table", it
       is a row of STATs nobody rolled. */
    S.sub.type = t.value;
    S.sub.roll = 0;
    save(); paintSub(); paintSheet(); paintTabs();
  }
  if(t.getAttribute && t.getAttribute("data-cg")==="pickone"){
    var tab = tableOf(t.getAttribute("data-key")), col = +t.getAttribute("data-col");
    if(t.value) setDie(tab, col, +t.value);
    else if(tab.perColumn) setDie(tab, col, 0);
    else delete S.life[tab.key];
    lifeChanged();
  }
  if(t.getAttribute && t.getAttribute("data-cg")==="harm"){
    S.harm = t.value; save(); paintLife(); paintSheet(); paintTabs();
  }
});

/* ----------------------------------------------------------------- step 5: sheet */
/* The same sheet as a Markdown note, for a campaign folder: tables rather than
   aligned columns, skills ordered by their roll, and an empty block at the end for
   the GM's own notes. Portable on purpose — no wiki links, no image embeds. */
function mdCell(s){ return String(s == null ? "" : s).replace(/\|/g, "/").replace(/\s*\n\s*/g, " "); }
function mdTable(head, rows){
  var out = ["| "+head.join(" | ")+" |", "|"+head.map(function(){ return "---"; }).join("|")+"|"];
  for(var i=0;i<rows.length;i++) out.push("| "+rows[i].map(mdCell).join(" | ")+" |");
  return out;
}
function mdSkillRows(r){
  var rows = [], i;
  function add(name, stat, level){
    rows.push({name:name, lvl:level, stat:stat, roll: S.stats ? eff(stat)+level : null});
  }
  if(isCalc()){
    var keys = boughtKeys3();
    for(i=0;i<keys.length;i++){
      var nm = skillBase(keys[i]);
      if(multi3(nm)) nm += " ("+(S.picks[keys[i]]||"выбери")+")";
      add(nm, D.skills[skillBase(keys[i])].stat, skillLevel3(keys[i]));
    }
  } else {
    for(i=0;i<r.skills.length;i++){
      var sk = r.skills[i], n2 = sk.skill;
      if(sk.pick === "") n2 += " ("+(S.picks[sk.skill]||"выбери 1")+")";
      else if(sk.pick) n2 += " ("+sk.pick+")";
      add(n2, sk.stat, lv(sk));
    }
  }
  if(langRow()) add("Язык ("+(S.lang||"не выбран")+")", "ИНТ", 4);
  var hbm = hbBought();
  for(i=0;i<hbm.length;i++) add(hbm[i].name, hbm[i].stat, hbm[i].level);
  var ex = abilSkills();
  for(i=0;i<ex.length;i++) add(ex[i].skill+(ex[i].spec ? " ("+ex[i].spec+")" : ""), ex[i].stat, ex[i].level);
  rows.sort(function(a, b){ return (b.roll == null ? b.lvl : b.roll) - (a.roll == null ? a.lvl : a.roll); });
  return rows;
}
function mdGearRows(rows){
  return rows.map(function(row){
    var qty = row.qty || 1;
    return [(row.name||"без названия")+(qty>1 ? " ×"+qty : "")+(row.cyber ? " ["+((row.hl||0)*qty)+" ПЧ]" : ""),
            row.locked && row.chip ? row.chip : "", ((row.price||0)*qty)+"eb"];
  });
}
function sheetMarkdown(){
  var r = role(), dv = derived(), out = [];
  out.push("# "+(S.name || "Безымянный")+" — "+(r ? r.name : "?")+(r ? ", ранг "+D.abilityRank : ""));
  out.push("");
  if(dv){
    out.push("**ПЗ "+dv.hp+" | Тяж. ранение "+dv.serious+" | Спасбросок "+dv.death+" | Человечность "+dv.hum
             +(dv.hl ? " (ЭМП "+dv.empBase+" → "+dv.emp+", −"+dv.hl+" ПЧ за хром)" : "")+"**");
    out.push("");
    out = out.concat(mdTable(D.stats, [D.stats.map(function(s){ return eff(s); })]));
    out.push("");
  }
  if(!r) return out.join("\n")+"\n";
  out.push("## Ролевая способность");
  out.push("");
  out.push("**"+r.ability+", ранг "+D.abilityRank+"**");
  var k4 = rank4();
  if(k4){
    out.push("");
    for(var kf=0;kf<k4.facts.length;kf++) out.push("- "+k4.facts[kf].k+": "+plainText(k4.facts[kf].v));
    /* The Role's own decisions — the Nomad's vehicles, the Fixer's culture and
       language — are part of what the ability handed over, and the GM needs them. */
    var pk = picks();
    if(pk && pk.kind === "nomad"){
      var taken = [];
      for(var sl=0;sl<pk.slots;sl++) if(slotOf(sl)) taken.push(slotLabel(slotOf(sl)));
      if(taken.length) out.push("- Автопарк Семьи: "+taken.join(", "));
      if(S.abil && S.abil.drive) out.push("- С собой: "+S.abil.drive);
    }
    if(pk && pk.kind === "fixer" && S.abil && (S.abil.culture || S.abil.lang))
      out.push("- Свой чел: "+(S.abil.culture||"культура не выбрана")+" / "+(S.abil.lang||"язык не выбран"));
    var pl = pool();
    if(pl){
      var pr = [];
      for(var po=0;po<pl.opts.length;po++) if(ptsOf(pl.opts[po].name)) pr.push([pl.opts[po].name, ptsOf(pl.opts[po].name)]);
      if(pr.length){
        out.push("");
        out.push("Очки ("+pl.budget+", осталось "+ptsLeft()+"):");
        out.push("");
        out = out.concat(mdTable(["Способность","Очки"], pr));
      }
    }
  }
  out.push("");
  out.push("## Навыки");
  out.push("");
  out.push("Бросок = СТАТ + Уровень (+ 1d10). Отсортировано по броску.");
  out.push("");
  out = out.concat(mdTable(["Навык","Ур","СТАТ","Бросок"], mdSkillRows(r).map(function(s){
    return [s.name, s.lvl, s.stat+(S.stats ? " "+eff(s.stat) : ""), s.roll == null ? "" : s.roll];
  })));
  out.push("");
  out.push("## Снаряжение");
  out.push("");
  if(isCalc()){
    var lists = [["buy","Снаряжение"],["style","Стиль"]];
    for(var li=0;li<lists.length;li++){
      var rows = gearRows(lists[li][0]);
      out.push("**"+lists[li][1]+"** (потрачено "+gearSpent(lists[li][0])+" из "+gearBudget(lists[li][0])+"eb)");
      out.push("");
      if(rows.length){ out = out.concat(mdTable(["Предмет","Источник","Цена"], mdGearRows(rows))); out.push(""); }
    }
    if(S.sponsor && S.sponsor.active){
      out.push("Продан за +"+D.sponsor.bonus+"eb на кибернетику — "+(S.sponsor.kind||"работодатель не выбран")
               +", на крючке: "+(S.sponsor.hook||"не выбрано"));
      out.push("");
    }
  } else {
    out = out.concat(mdTable(["Предмет","Коротко"], r.gear.map(function(_, g){
      var gi = gearItem(r.gear[g], g);
      return [gi.text, gi.short || ""];
    })));
    out.push("");
    var sr = gearRows("start");
    if(sr.length){
      out.push("**Доп. покупки** (потрачено "+gearSpent("start")+" из "+gearBudget("start")+"eb)");
      out.push("");
      out = out.concat(mdTable(["Предмет","Источник","Цена"], mdGearRows(sr)));
      out.push("");
    }
  }
  var cyt = cyber();
  if(cyt && cyt.items && !isCalc()){
    out.push("## Кибернетика");
    out.push("");
    out = out.concat(mdTable(["Имплант","ПЧ"], cyt.items.map(function(it, i){
      return [cyberItem(it, i).text, it.hl];
    })));
    out.push("");
    out.push("Всего "+cyt.hl+" ПЧ.");
    out.push("");
  } else if(cyt && cyt.hl){
    out.push("Кибернетика: всего "+cyt.hl+" ПЧ (см. строки снаряжения и стиля).");
    out.push("");
  }
  out.push("**Деньги: "+Math.max(0, isCalc() ? gearLeft("buy") : gearLeft("start"))+"eb**"
           +(r.income ? " · между заказами 1d6 в неделю, "+r.income.low+"–"+r.income.high+"eb (колонка Ранг 1–4)" : ""));
  out.push("");
  var life = [];
  for(var L=0;L<D.life.length;L++){
    var t = D.life[L];
    if(!got(t)) continue;
    var parts = [];
    for(var c=0;c<t.cols.length;c++){
      if(c === t.pickCol) continue;
      var cell = cellOf(t, c);
      if(!cell) continue;
      var line = plain((t.harm && c === 1 && S.harm && harmable(t)) ? unstop(cell) : cell, t.key, c);
      if(t.harm && c === 1 && S.harm && harmable(t)) line += " — " + S.harm;
      line += undone(t, c, false);
      parts.push(shownCols(t) > 1 ? shortCol(t, c)+": "+line : line);
    }
    if(parts.length) life.push("- **"+t.label+":** "+parts.join("; "));
  }
  /* A sheet that silently omits a section reads as a finished one, so an unrolled
     path says so here exactly as it does on the rendered sheet. */
  var anyLife = false;
  for(var L2=0;L2<D.life.length;L2++) if(got(D.life[L2])){ anyLife = true; break; }
  if(!anyLife)
    life.push("- Жизненный путь **не заполнен** — ни одна таблица не брошена (в том числе Враг, Друг и Цель).");
  var shown = pathShown(), pathRows = 0;
  for(var sp=0;sp<shown.length;sp++){
    var st = shown[sp];
    if(st.fork){ if(forkPick(st.n) >= 0){ life.push("- "+st.q+" "+st.fork[forkPick(st.n)].label); pathRows++; } }
    else if(pathRoll(st.n)){ life.push("- "+st.q+" "+st.rows[pathRoll(st.n)-1]); pathRows++; }
  }
  if(shown.length && !pathRows) life.push("- Ролевой путь **не заполнен** — ни один шаг не брошен.");
  if(life.length){ out.push("## Жизненный путь"); out.push(""); out = out.concat(life); out.push(""); }
  var subT = subType(), subS = subStats();
  if(subT && subS){
    var sd = subDerived();
    out.push("## Подчинённый");
    out.push("");
    out.push("**"+((S.sub && S.sub.name) || "Без имени")+"** — "+subT.name+" (прикрытие: "+subT.cover+")");
    out.push("");
    out = out.concat(mdTable(subT.stats, [subT.stats.map(function(s){ return subS[s]; })]));
    out.push("");
    out.push("ПЗ "+sd.hp+" | Тяж. ранение "+sd.serious+" | Спасбросок "+sd.death+" | Лояльность "+D.subord.loyalty);
    out.push("");
    out.push("Навыки: "+subT.skills.map(function(s){ return s.skill+" "+s.level; }).join(", "));
    out.push("");
    out.push("Хром: "+subT.cyber+". Снаряжение: "+subT.gear+".");
    out.push("");
    if(((S.sub && S.sub.note) || "").trim()){ out.push("Кто он: "+S.sub.note.trim()); out.push(""); }
  }
  out.push("## Характер / GM-заметки");
  out.push("");
  var wrote = 0;
  for(var f=0;f<D.notes.length;f++){
    var val = (S.notes[D.notes[f].key]||"").trim();
    if(val){ out.push("**"+D.notes[f].label+":** "+val); out.push(""); wrote++; }
  }
  if(!wrote){ out.push("- Быт:"); out.push("- Крючок:"); out.push("- Для ГМа:"); out.push(""); }
  return out.join("\n");
}

/* Save to disk: Blob + a throwaway link. If the page is sandboxed and the browser
   refuses, the text goes to the clipboard path instead. */
function downloadFile(name, mime, text){
  try{
    var url = URL.createObjectURL(new Blob([text], {type: mime+";charset=utf-8"}));
    var a = document.createElement("a");
    a.href = url; a.download = name; a.style.display = "none";
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
    return true;
  }catch(e){ return false; }
}
function fileStem(){
  return ((S.name || "").replace(/[\\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim()) || "Безымянный";
}
var FORMAT = "cpr-character";
/* An export is the state plus a marker, so import can refuse a file that is not
   ours before touching anything. */
function exportJson(){
  var o = {}; o[FORMAT] = 1;
  for(var k in S) if(S.hasOwnProperty(k)) o[k] = S[k];
  return JSON.stringify(o, null, 1);
}
function importJson(text){
  var parsed;
  try{ parsed = JSON.parse(text); }catch(e){ return "Файл не разобрался: это не JSON."; }
  if(!parsed || typeof parsed !== "object" || parsed instanceof Array || parsed[FORMAT] !== 1)
    return "Это не сохранение персонажа из этого генератора.";
  var prev = S;
  S = normalise(parsed);
  try{
    save(); paintAll(); go(S.role ? (S.stats ? 5 : 2) : 1);
  }catch(e){
    /* normalise() checks the top level and a few nested lists; a value deeper down
       of the wrong type throws inside the paint. Put the old character back. */
    S = prev; save(); paintAll(); go(S.role ? (S.stats ? 5 : 2) : 1);
    return "Файл повреждён: персонаж из него не открывается. Текущий остался как был.";
  }
  return "";
}

/* The fixed starting kit of #1/#2 — gear and implants, each with its chooser
   where the book offers "one of". Drawn in TWO places by the same code: on the
   sheet, and at the top of the Gear step, where the 500eb is spent — without
   it there a player bought a second pistol not knowing the Role had handed him one. */
function kitGearList(r){
  var h = "<ul class=\"cggear\">";
  for(var g=0;g<r.gear.length;g++){
    var item = r.gear[g], chosen = gearItem(item, g);
    if(item.options.length > 1){
      h += '<li><select class="cgsel cggearsel" data-cg="gear" data-item="'+g+'">';
      for(var o=0;o<item.options.length;o++){
        var op = item.options[o];
        h += '<option value="'+o+'"'+(gearPick(g)===o?" selected":"")+">"+esc(op.text)
           + (op.short ? esc(" — " + op.short) : "") + "</option>";
      }
      h += '</select> <span class="cgor">выбери одно из '+item.options.length+"</span>";
    } else {
      h += "<li>"+esc(chosen.text);
    }
    h += '<span class="itsub">'+esc(chosen.note)
       + " " + ref(chosen.href, "подробнее") + "</span></li>";
  }
  h += "</ul>";
  return h;
}
function kitCyberList(cy){
  var h = "<ul class=\"cggear cgcyber\">";
  for(var ci=0;ci<cy.items.length;ci++){
    var cit = cy.items[ci], cch = cyberItem(cit, ci);
    if(cit.options.length > 1){
      /* "Sandevistan or Wolverine Claws" — the book: where a choice of two is offered,
         only one is taken. Both cost the same HL, so the choice
         moves no number; it is still the player's — and it is unmakeable without
         knowing what either does, which is why the gloss follows the selection. */
      h += '<li><select class="cgsel cggearsel" data-cg="cyber" data-item="'+ci+'">';
      for(var co=0;co<cit.options.length;co++)
        h += '<option value="'+co+'"'+(cyberPick(ci)===co?" selected":"")+">"
           + esc(cit.options[co].text)+"</option>";
      h += '</select> <span class="cgor">выбери одно из '+cit.options.length+"</span>";
    } else {
      h += "<li>"+esc(cch.text);
    }
    /* Each implant prints its OWN HL. Without it the total was a bare assertion —
       "Total 14 HL" with nothing on the page to add up to it — which is the same
       defect as a tier chip naming a difficulty without printing the DV: the
       reader cannot check it, so they stop trusting it. */
    h += ' <span class="x2">'+cit.hl+" ПЧ</span>";
    h += '<span class="itsub">'+esc(cch.note)
       + " " + ref(cch.href, "подробнее") + "</span></li>";
  }
  h += "</ul>";
  return h;
}

function paintSheet(){
  var box = q("sheet"); if(!box) return;
  var r = role(), dv = derived();
  if(!r){ box.innerHTML = '<p class="cghint">Лист появится, когда будет выбрана Роль.</p>'; return; }
  var h = '<div class="cghead"><span class="cgwho">'+esc(S.name||"Безымянный")+"</span>"
        + '<span class="cgrole">'+esc(r.name)+"</span></div>";

  if(dv){
    h += '<div class="tw"><table class="mx"><thead><tr>';
    for(var i=0;i<D.stats.length;i++) h += '<th class="n">'+D.stats[i]+"</th>";
    h += '</tr></thead><tbody><tr>';
    for(var j=0;j<D.stats.length;j++) h += '<td class="n">'+eff(D.stats[j])+"</td>";
    h += "</tr></tbody></table></div>";
    h += '<div class="cgderived"><span><b>ПЗ</b> '+dv.hp+"</span><span><b>Тяжёлое ранение</b> "
       + dv.serious+"</span><span><b>Спасбросок</b> "+dv.death+"</span><span><b>Человечность</b> "+dv.hum+"</span></div>";
    /* Two of these numbers are not what the template rolled, and a sheet that does
       not say so reads as an arithmetic error — "Humanity 40" under "EMP 6"
       looks simply wrong. The chapter's own rule: show the arithmetic. */
    /* "starting cyberware" is only the whole story for #1/#2 with nothing bought
       on top: #3 has no starting package, and extra chrome off the 500eb is in the
       same total. The breakdown sits under "Cyberware" for #1/#2 and in a note
       under Gear/Style for #3. */
    if(dv.hl){
      var cyx = cyber();
      h += '<p class="note">ЭМП <b>'+dv.empBase+" → "+dv.emp+"</b> и Человечность <b>"
         + dv.humBase+" → "+dv.hum+"</b> — это "
         + (isCalc() ? "купленные импланты"
                     : (cyx && cyx.extraHl ? "стартовые импланты и купленные сверх них"
                                           : "стартовые импланты"))
         + ": они стоят " + dv.hl + " ПЧ, и книга велит вычесть их сразу. Разбор — "
         + (isCalc() ? "под Снаряжением и Стилем ниже. "
                     : "в «Киберимплантах» ниже. " + link("chrome", "Стартовый хром по Ролям") + ". ")
         + "</p>";
    }
    h += '<p class="note">Откуда эти числа — ' + link("derived_stats", "Производные характеристики")
       + ". Что происходит, когда ПЗ кончаются — " + link("wounds", "Урон и раны")
       + " и " + link("trauma_team", "Trauma Team") + ".</p>";
  } else {
    h += '<p class="cghint">СТАТы ещё не брошены — шаг 2.</p>';
  }

  h += "<h4>Ролевая способность</h4><p><b>"+esc(r.ability)+"</b>, ранг "+D.abilityRank
     + ' — стартовый ранг для нового персонажа.</p>'
     + (r.abilityWhat ? '<p class="cgability">'+esc(r.abilityWhat)+"</p>" : "");
  h += rank4Block();
  h += '<p class="note">Ранги, очки и подробности — '
     + ref(r.abilityHref, esc(r.name)+" в Ролевых способностях") + ".</p>";

  h += "<h4>Навыки</h4>";
  /* A sheet is read by the GM, who did not watch it being built — so every table
     on it names its own columns. Without a thead these were four bare columns of
     numbers. */
  h += '<div class="tw"><table class="mx"><thead><tr><th>Навык</th><th class="n">Ур</th>'
     + '<th class="n">Бросок</th><th>Обычно берёт</th></tr></thead><tbody>';
  if(isCalc()){
    /* Only the bought ones: printing all 66 at mostly-zero on a finished sheet
       would bury the ones that matter under the ones that don't. */
    var names3 = boughtKeys3();
    for(var s3=0;s3<names3.length;s3++){
      var key3 = names3[s3], nm3 = skillBase(key3), info3 = D.skills[nm3];
      var label3 = esc(nm3) + (info3.x2 ? ' <span class="x2">×2</span>' : "");
      if(multi3(nm3))
        label3 += (S.picks[key3] || "").trim()
          ? ' <span class="cgspec">('+esc(S.picks[key3])+")</span>"
          : ' <span class="cgtodoin">не выбрано</span>';
      var lvl3 = skillLevel3(key3), sv3 = eff(info3.stat), tot3 = (sv3===null) ? null : sv3 + lvl3;
      h += "<tr><th>"+label3+'</th><td class="n">'+lvl3+'</td><td class="n">'
         + (tot3===null ? esc(info3.stat)
                        : esc(info3.stat)+" "+sv3+" + "+lvl3+" = <b>"+tot3+"</b>")
         + "</td><td>"+(tot3===null ? "" : tierChip(tot3))+"</td></tr>";
    }
  } else {
    for(var s=0;s<r.skills.length;s++){
      var sk = r.skills[s], nm = esc(sk.skill);
      if(sk.pick === "")
        nm += (S.picks[sk.skill] || "").trim()
            ? ' <span class="cgspec">('+esc(S.picks[sk.skill])+")</span>"
            : ' <span class="cgtodoin">не выбрано</span>';
      else if(sk.pick) nm += ' <span class="cgspec">('+esc(sk.pick)+")</span>";
      var shl = lv(sk), sv = eff(sk.stat), tot = (sv===null) ? null : sv + shl;
      h += "<tr><th>"+nm+'</th><td class="n">'+shl+'</td><td class="n">'
         + (tot===null ? esc(sk.stat)
                       : esc(sk.stat)+" "+sv+" + "+shl+" = <b>"+tot+"</b>")
         + "</td><td>"+(tot===null ? "" : tierChip(tot))+"</td></tr>";
    }
  }
  /* The language of the character's culture, 4 levels, granted by the Lifepath rather than by the Role package — the book tells you twice not to forget
     it, and it belongs on the sheet with the other skills, not in the lifepath. */
  if(langRow()){
    var lt = S.stats ? eff("ИНТ") + 4 : null;
    h += '<tr><th>Язык '+(S.lang ? '<span class="cgspec">('+esc(S.lang)+")</span>"
                                 : '<span class="cgtodoin">не выбран</span>')
       + '</th><td class="n">4</td><td class="n">'
       + (lt===null ? "ИНТ" : "ИНТ "+eff("ИНТ")+" + 4 = <b>"+lt+"</b>") + "</td><td>"
       + (lt===null ? "" : tierChip(lt)) + "</td></tr>";
  }
  /* Skills that exist only because of the Role ability. The Medtech's two are the
     reason this block had to be built at all: the corebook does not list Surgery
     or Medical Tech among the 66, so no package can contain them and
     nothing in the book defines them: the book reserves both for the Medtech, through
     those two specialties alone. A Medtech sheet without them is missing the Role. */
  var hbs = hbBought();
  for(var hi=0;hi<hbs.length;hi++){
    var hv = eff(hbs[hi].stat), ht = (hv===null) ? null : hv + hbs[hi].level;
    h += "<tr><th>"+esc(hbs[hi].name)+(hbs[hi].x2 ? ' <span class="x2">×2</span>' : "")
       + '<span class="itsub">'+esc(hbs[hi].what || "Свой навык.")+'</span></th><td class="n">'+hbs[hi].level+'</td><td class="n">'
       + (ht===null ? esc(hbs[hi].stat) : esc(hbs[hi].stat)+" "+hv+" + "+hbs[hi].level+" = <b>"+ht+"</b>")
       + "</td><td>"+(ht===null ? "" : tierChip(ht))+"</td></tr>";
  }
  var extra = abilSkills();
  for(var e=0;e<extra.length;e++){
    var ex = extra[e];
    /* The Fixer's language is "Language (Highway Speak)" once he has said which; until
       then it is an unanswered field and says so, exactly like "pick 1". */
    var enm = esc(ex.skill)
            + (ex.spec ? ' <span class="cgspec">('+esc(ex.spec)+")</span>"
                       : (ex.from ? "" : ' <span class="cgtodoin">не выбран</span>'))
            + '<span class="itsub">'+esc(ex.what)
            + (ex.from ? " Уровень — из очков: "+esc(ex.from)+"." : "")
            + " " + ref(ex.href, "подробнее") + "</span>";
    var ev = eff(ex.stat), et = (ev===null) ? null : ev + ex.level;
    h += "<tr><th>"+enm+'</th><td class="n">'
       + (ex.zero ? '<span class="cgtodoin">0</span>' : ex.level)+'</td><td class="n">'
       + (et===null ? esc(ex.stat) : esc(ex.stat)+" "+ev+" + "+ex.level+" = <b>"+et+"</b>")
       + "</td><td>"+(et===null || ex.zero ? "" : tierChip(et))+"</td></tr>";
  }
  h += "</tbody></table></div>";
  h += '<p class="note">Третья колонка — то, что прибавляется к 1d10: '
     + link("checks", "СТАТ + Навык + 1d10 против СЛ") + '. Что делает каждый навык — '
     + link("skills", "список всех 66") + ".</p>";

  /* "or" is a choice, so it is rendered as one. Once per destination, not per
     item: six links to Fight in a six-line list is wallpaper. */
  /* Every line names something the page never explained. The page' glossary and
     its page linker both run once at load, and this list is painted later, so
     "Heavy Melee Weapon" arrived as a bare string with no popover and no way in — and
     "Heavy Melee Weapon or Bulletproof Shield" asked a first-time player to choose
     between two things nothing on the screen defined. So each item carries its own
     one-line gloss and a link into the chapter that defines it, both resolved in
     the generator (see GEAR_INFO).
     The short form rides INSIDE the <option> as well: a chooser has to be
     decidable while it is still closed, and "3d6" against "10 HP" decides it. */
  if(isCalc()){
    /* Method #3 has no fixed package to print — it bought its own, on its own
       Gear pane, and the sheet just totals what ended up in the two lists. */
    if(S.sponsor && S.sponsor.active)
      h += '<p class="note"><b>Продан за +'+D.sponsor.bonus+'eb на кибернетику</b> — '
         + esc(S.sponsor.kind || "работодатель не выбран") + ", на крючке: "
         + esc(S.sponsor.hook || "не выбрано") + '. ' + pageChip(D.sponsor.page) + "</p>";
    h += gearSheetHtml("buy", "Снаряжение", " — идёт в стартовые деньги.");
    h += gearSheetHtml("style", "Стиль", " — сгорает.");
  } else {
  h += "<h4>Стартовое снаряжение</h4>" + kitGearList(r);
  /* Each line now links itself, so this note carries only what the per-item links
     do not: where to buy the rest, and the cyberware a starting character has.
     Repeating "Ranged · Melee · Armor" underneath seven "details"
     links pointing at those same three sections was wallpaper — a rule this page keeps.
     The per-item links deliberately break that rule's letter (three destinations,
     seven links): the destination repeats but the ITEM does not, and a beginner
     reading line six should not have to scroll back to line one to find the way in. */
  h += '<p class="note">Цены и всё остальное снаряжение — ' + link("prices", "Ночные Рынки") + ".</p>";
  }

  /* Starting cyberware. The book hands it over the same way it hands over the gear
     — predetermined, per Role, with the Humanity already costed — and the generator
     used to skip it entirely, which left every character short four implants and
     holding the wrong EMP and Humanity. Printed 117. Method #3 has no such fixed
     set — its HL comes off the freeform rows above, already summed by cyber(), so
     it gets only the chain note below, not a second implant list. */
  var cy = cyber();
  if(cy && isCalc() && cy.hl){
    h += '<p class="note"><b>ПЧ</b> от Кибернетики в Снаряжении и Стиле: <b>'+cy.hl+"</b>."
       + (dv ? " <b>Человечность</b>: ЭМП " + dv.empBase + " × 10 = " + dv.humBase
             + ", минус " + cy.hl + " = <b>" + dv.hum + "</b>."
             + " <b>ЭМП</b>: " + dv.hum + " ÷ 10 = <b>" + dv.emp
             + "</b> — каждый полный десяток Человечности это единица ЭМП."
           : "")
       + " Про Человечность и киберпсихоз — " + link("chrome", "Киберимпланты") + ".</p>";
  }
  if(cy && !isCalc()){
    /* Its own list class, not .cggear: the two lists look alike but their checks
       are different — a gear line carries a generated stats gloss, an implant line
       carries the catalogue's "what it gives". */
    h += "<h4>Киберимпланты</h4>" + kitCyberList(cy);
    /* …and the whole chain, one step per line, each starting from the number above
       it: the sum, then Humanity, then EMP. "Why exactly 26" has to be
       answerable without opening the book. */
    var sum = [];
    for(var cs=0;cs<cy.items.length;cs++) sum.push(cy.items[cs].hl);
    /* Extra cyberware bought off the 500eb (step "Gear") is not part of the
       fixed package's "installation already included" price, so it gets its own
       term in the sum rather than silently padding the package's own number —
       the reader has to be able to trace every HL back to a purchase. */
    if(cy.extraHl) sum.push(cy.extraHl + " (доп. покупки)");
    h += '<p class="note">'
       + (cy.extraHl
          ? "Установка стартовых имплантов уже включена в цену; за купленное сверх "
            + "них на доп. eb — отдельно: " + installLine() + ". "
          : "Установка уже включена в цену. ")
       + "<b>ПЧ</b>: " + sum.join(" + ") + " = <b>" + cy.hl + "</b>."
       + (dv ? " <b>Человечность</b>: ЭМП " + dv.empBase + " × 10 = " + dv.humBase
             + ", минус " + cy.hl + " = <b>" + dv.hum + "</b>."
             + " <b>ЭМП</b>: " + dv.hum + " ÷ 10 = <b>" + dv.emp
             + "</b> — каждый полный десяток Человечности это единица ЭМП."
           : "")
       + " Что делает каждый имплант — " + link("cyberware_catalogue", "каталог в Киберимплантах")
       + ", про Человечность и киберпсихоз — " + link("chrome", "там же") + ".</p>";
  }

  /* The subordinate has his own tab, but the printed sheet is what gets handed to
     a GM — so he appears here too, in the four lines that matter at the table.
     The full block, with his skills and kit, is on his own step. */
  var subT = subType(), subS = subStats();
  if(subSpec()){
    h += "<h4>Подчинённый</h4>";
    if(!subT || !subS){
      h += '<p class="cghint">Корпорат уже получил первого подчинённого на 3 ранге '
         + '— его осталось нанять на отдельной вкладке.</p>';
    } else {
      var sdv = subDerived(), line = [];
      for(var ss=0;ss<subT.stats.length;ss++)
        line.push(subT.stats[ss] + " " + subS[subT.stats[ss]]);
      h += '<div class="tw"><table class="mx cgfacts"><tbody>'
         + "<tr><th>Кто</th><td><b>"+esc((S.sub && S.sub.name) || "Без имени")
         + "</b> — "+esc(subT.name)+", прикрытие: "+esc(subT.cover)+"</td></tr>"
         + "<tr><th>СТАТы</th><td>"+esc(line.join(" · "))+"</td></tr>"
         + "<tr><th>ПЗ</th><td>"+sdv.hp+" · тяжёлое ранение "+sdv.serious
         + " · спасбросок "+sdv.death+" · Лояльность "+D.subord.loyalty+"</td></tr>"
         + "<tr><th>Снаряжение</th><td>"+esc(subT.gear)+"</td></tr>"
         /* The one line here nobody generated. It is dropped when empty rather
            than printed as a blank row — an unfilled optional field is not a
            fact about the character. */
         + (((S.sub && S.sub.note) || "").trim()
             ? "<tr><th>Кто он</th><td>"+esc(S.sub.note)+"</td></tr>" : "")
         + "</tbody></table></div>";
    }
  }

  /* Money, and the sheet had none of it. The corebook grants 500eb on top of the
     gear package, in bold, in the paragraph over that very table (printed 98) —
     so a character who wanted a knife, a jacket or a night in a cube hotel had
     nothing on the sheet saying what he could afford. The other half is income:
     between jobs everyone rolls 1d6 on their Role's table, and the COLUMN is
     picked by the rank of the Role ability, which for a starting character is
     always "Rank 1–4". Both numbers are per-Role facts a GM asks about in the
     first session. */
  if(D.cash && r.income){
    h += "<h4>Деньги</h4>";
    /* "500eb, can be spent right away" answers nothing on its own — on WHAT, and is
       that a lot? CP:RED prices in eight fixed steps, so the answer is exact and
       it comes out of the book's own ladder: 500eb is one item of a named category,
       and the category lists what is in it. Then the four places that sell
       something, because a price with no way in is the same dead end. */
    h += '<div class="tw"><table class="mx cgfacts"><tbody>'
       + "<tr><th>На старте</th><td>"
       + (isCalc()
          ? "<b>"+Math.max(0, gearLeft("buy"))+"eb</b> — то, что осталось от "
            + gearBudget("buy")+"eb на Снаряжение после покупок на шаге «Снаряжение» "
            + (gearBudget("buy") !== D.calcCash.main
               ? " (бюджет задан ГМом; по умолчанию книга даёт "+D.calcCash.main+"eb)" : "")
            + " (книга: «всё, что ты не потратил, остаётся у тебя»). Несожжённое из "
            + gearBudget("style")+"eb на Стиль"
            + (gearBudget("style") !== D.calcCash.style
               ? " (тоже задано ГМом; по умолчанию "+D.calcCash.style+"eb)" : "")
            + " сюда <b>не</b> идёт — оно «сгорает». "
            + pageChip(D.calcCash.mainPage) + " " + pageChip(D.calcCash.stylePage)
          : "<b>"+Math.max(0, gearLeft("start"))+"eb</b> из "+gearBudget("start")+"eb "
            + (gearBudget("start") !== D.cash.start
               ? "(бюджет задан ГМом; по умолчанию " : "(")
            + "книга даёт "+D.cash.start+"eb сверх снаряжения обоим быстрым методам). "
            /* The ladder comparison is a fact about the book's 500eb only: with a
               GM's own figure it named a category the money no longer matched. */
            + (gearBudget("start") === D.cash.start
               ? "По ценовой лестнице "+D.cash.start+"eb — это <b>ровно один</b> предмет "
                 + "категории «" + esc(D.cash.tier.name) + "» ("
                 + esc(D.cash.tier.like.replace(/\.$/, "")) + ") — или несколько дешевле, "
                 + "или можно потратить на шаге «Снаряжение» и оставить сдачу себе. "
               : "Потратить можно на шаге «Снаряжение», остаток остаётся у тебя. ")
            + pageChip(D.cash.page))
       + "</td></tr>"
       + "<tr><th>Куда потратить</th><td>"
       + link("price_categories", "ценовые категории") + " · "
       + link("prices", "Ночные Рынки") + " · "
       + link("gear", "общее снаряжение") + " · "
       + link("weapons", "оружие") + " и " + link("armor", "броня") + " · "
       + link("ammo", "боеприпасы и обвес") + " · "
       + link("cyberware_catalogue", "киберимпланты") + " · "
       + link("housing", "жильё") + ".</td></tr>"
       + "<tr><th>Про хром</th><td>"
       + (isCalc()
          ? "Полный пакет покупает импланты за те же eb, что и всё остальное "
            + "снаряжение — цена в строке уже должна включать установку, как и у "
            + "любой другой покупки на Ночных Рынках. "
          : "В цену стартовых имплантов установка уже включена, а вот за купленный "
            + "потом придётся заплатить отдельно: " + installLine() + ". ")
       + link("installation", "Где что ставят") + ".</td></tr>"
       + "<tr><th>Между заказами</th><td><b>1d6</b> в неделю по таблице своей Роли, "
       + "колонка <b>Ранг 1–4</b>: от <b>"+r.income.low+"eb</b> до <b>"
       + r.income.high+"eb</b>. " + link("income", "Таблица своей Роли") + ".</td></tr>"
       + "<tr><th>Расходы</th><td>Стиль жизни платится <b>каждый месяц</b>, и самый "
       + "дешёвый — «" + esc(D.cash.lifestyle.name) + "» за <b>"
       + D.cash.lifestyle.eb + "eb</b>; жильё сверх того. "
       + link("housing", "Образ жизни и жильё") + ".</td></tr>"
       + "</tbody></table></div>";
    /* The 500eb used to be a bare number in the row above with nowhere to spend
       it on the sheet itself — printed 98 explicitly allows spending it right
       away, not just banking it, so it gets the same itemised list Method #3's
       own purchases get, off the same "start" list painted on this pane. */
    if(!isCalc()) h += gearSheetHtml("start", "Доп. покупки", " — остаётся у тебя как деньги.");
  }

  var any = false;
  for(var L2=0;L2<D.life.length;L2++) if(got(D.life[L2])){ any = true; break; }
  if(any){
    h += "<h4>Жизненный путь</h4>";
    h += '<div class="tw"><table class="mx"><thead><tr><th>Что</th><th class="n">1d10</th>'
       + "<th>Выпало</th></tr></thead><tbody>";
    for(var L=0;L<D.life.length;L++){
      var t = D.life[L], g = got(t);
      if(!g) continue;
      var vals = [];
      for(var c=0;c<t.cols.length;c++){
        /* the "pick one" column is a menu of languages; the one actually
           chosen is a skill and is printed with the other skills */
        if(c === t.pickCol) continue;
        var cell = cellOf(t, c);
        if(!cell) continue;
        var line = resolved(
          (t.harm && c === 1 && S.harm && harmable(t)) ? unstop(cell) : cell, t.key, c);
        /* "who was hurt" is a qualifier on the outcome, not a fact of its own:
           as its own entry it read "Who was hurt: You were hurt — because of him". */
        if(t.harm && c === 1 && S.harm && harmable(t))
          line += ' <span class="cgqual">— '+esc(S.harm)+"</span>";
        line += undone(t, c, true);
        vals.push(shownCols(t) > 1
          ? '<span class="lpl"><span class="lpk">'+esc(shortCol(t, c))+"</span>"+line+"</span>"
          : '<span class="lpl">'+line+"</span>");
      }
      if(!vals.length) continue;
      h += "<tr><th>"+esc(t.label)+'</th><td class="d">'+g.join("/")+"</td><td>"
         + vals.join("")+"</td></tr>";
    }
    h += "</tbody></table></div>";
    h += '<p class="note">Полные таблицы — ' + link("lifepath", "Жизненный путь") + ".</p>";
  } else {
    /* An unrolled Lifepath used to vanish — no heading on the sheet, nothing
       in the .md, nothing in the print — so a GM was handed a sheet that
       looked finished and had no Enemy, no Friend and no Goal, with nothing saying
       they had never been rolled. The step IS optional ("Empty rows break nothing"), and that is precisely why its absence has to be stated instead of
       rendered as nothing: the same rule that makes "Language (pick 1)" print
       "not chosen" rather than printing the instruction as if it were the answer.
       The step-4 tab badge is deliberately NOT touched. That counter is for a
       half-finished answer, and "Clear" is a decision, not an oversight. */
    h += "<h4>Жизненный путь</h4>";
    h += '<p class="note"><span class="cgtodoin">Не заполнен</span> — ни одна '
       + "таблица не брошена. Для ГМа это самая нужная часть листа: <b>Враг</b>, "
       + "<b>Друг</b> и <b>Цель</b> — из них вырастают сцены. Заполняется на шаге "
       + "«Жизненный путь».</p>";
  }

  /* The Role's own path, on the sheet as its own table: it answers different
     questions from the common one — what he does for a living, who his clients
     are, who is hunting him — and a GM reads it for hooks, not for character. */
  var shownP = pathShown(), rowsP = [];
  for(var sp=0;sp<shownP.length;sp++){
    var stp = shownP[sp];
    if(stp.fork){
      if(forkPick(stp.n) >= 0)
        rowsP.push([stp.q, "", esc(stp.fork[forkPick(stp.n)].label)]);
    } else if(pathRoll(stp.n)) {
      rowsP.push([stp.q, pathRoll(stp.n), esc(stp.rows[pathRoll(stp.n)-1])]);
    }
  }
  if(rowsP.length){
    h += "<h4>Ролевой путь</h4>";
    h += '<div class="tw"><table class="mx"><thead><tr><th>Что</th>'
       + '<th class="n">Бросок</th><th>Выпало</th></tr></thead><tbody>';
    for(var rp2=0;rp2<rowsP.length;rp2++)
      h += "<tr><th>"+esc(rowsP[rp2][0])+'</th><td class="d">'
         + (rowsP[rp2][1] || "—")+"</td><td>"+rowsP[rp2][2]+"</td></tr>";
    h += "</tbody></table></div>";
    var rpl = pathSpec();
    if(rpl) h += '<p class="note">Полная таблица этой Роли — '
               + ref(rpl.href, "в Жизненном пути") + ".</p>";
  } else if(shownP.length){
    /* Same rule as the common path above: a Role that HAS a path and has answered
       none of it says so, rather than dropping the heading and reading as a Role
       that never had one. */
    h += "<h4>Ролевой путь</h4>";
    h += '<p class="note"><span class="cgtodoin">Не заполнен</span> — ни один шаг '
       + "не брошен: чем персонаж занят в профессии, где работает и кто за ним "
       + "охотится.</p>";
  }
  /* No read-only copy of "About the character" here: the fields themselves sit directly
     under this sheet and print with it, so echoing them was the same text twice. */
  box.innerHTML = h;
}

/* ---- the Exec's subordinate ------------------------------------------------
   Rank 3 of Teamwork grants one, so a rank-4 Exec has him already. He
   is not a line on the sheet: he has nine STATs, HP, a skill list and a kit, and
   the GM plays him. Two rules of his own, both from printed 154–155:
     * the TYPE is chosen by the player and the STATs are ROLLED;
     * his implants are already priced into his EMP, the opposite of the
       player's own starting chrome, which is why nothing here goes through eff().
   HP, wound threshold and death save are the same formulas the player uses. */
function subType(){
  var sp = subSpec(); if(!sp) return null;
  var key = (S.sub && S.sub.type) || "";
  for(var i=0;i<sp.types.length;i++) if(sp.types[i].name === key) return sp.types[i];
  return null;
}
function subRoll(){ return (S.sub && S.sub.roll) || 0; }
function subStats(){
  var t = subType(), n = subRoll();
  if(!t || !n) return null;
  var row = t.table[n-1], out = {};
  for(var i=0;i<t.stats.length;i++) out[t.stats[i]] = row[i];
  return out;
}
function subDerived(){
  var st = subStats(); if(!st) return null;
  var hp = 10 + 5*Math.ceil((st["ТЕЛ"] + st["ВОЛЯ"])/2);
  return {hp:hp, serious:Math.ceil(hp/2), death:st["ТЕЛ"]};
}
function pendingSub(){
  var sp = subSpec(), out = [];
  if(!sp) return out;
  if(!subType()) out.push("Кем он работает");
  else if(!subRoll()) out.push("Бросок на его СТАТы");
  return out;
}
function paintSub(){
  var box = q("subbox"); if(!box) return;
  var sp = subSpec();
  if(!sp){ box.innerHTML = ""; return; }
  var t = subType(), n = subRoll(), h = "";

  h += '<p class="cgrow"><label>Кем он работает: '
     + '<select class="cgsel" data-cg="subtype"><option value="">— выбери тип —</option>';
  for(var i=0;i<sp.types.length;i++)
    h += '<option value="'+esc(sp.types[i].name)+'"'
       + ((t && t.name===sp.types[i].name) ? " selected" : "") + ">"
       + esc(sp.types[i].name) + " — " + esc(sp.types[i].job) + "</option>";
  h += "</select></label></p>";

  if(!t){
    h += '<p class="cghint">Пять типов, и они отличаются не только СТАТами: у '
       + 'каждого свои навыки, хром и снаряжение от компании.</p>';
    box.innerHTML = h; return;
  }

  h += '<p class="cglegend"><b>Прикрытие:</b> '+esc(t.cover)
     + ". <b>Истинная работа:</b> "+esc(t.job)+"</p>";
  h += '<p class="cgrow"><label class="cgname">Имя <input type="text" data-cg="subname" '
     + 'value="'+esc((S.sub && S.sub.name) || "")+'" placeholder="как его зовут"></label>'
     + ' <button type="button" class="cgbtn cgprim" data-cg="rollsub">'
     + (n ? "Перебросить 1d6" : "Бросить 1d6") + "</button></p>";

  if(!n){
    h += '<p class="cghint">Тип выбран — осталось узнать, кого пришлёт отдел кадров.</p>';
  } else {
    var st = subStats(), dv = subDerived();
    h += '<p class="cgsubroll">Выпало <span class="cgd">'+n+"</span> — строка "+n
       + " таблицы «"+esc(t.name)+"».</p>";
    h += '<div class="tw"><table class="mx"><thead><tr>';
    for(var s=0;s<t.stats.length;s++) h += '<th class="n">'+t.stats[s]+"</th>";
    h += "</tr></thead><tbody><tr>";
    for(var s2=0;s2<t.stats.length;s2++) h += '<td class="n">'+st[t.stats[s2]]+"</td>";
    h += "</tr></tbody></table></div>";
    /* Nine STATs, no Luck: like every NPC in this reference, and the sheet says so
       rather than leaving a reader to wonder which column went missing. */
    h += '<div class="cgderived"><span><b>ПЗ</b> '+dv.hp+"</span>"
       + "<span><b>Тяжёлое ранение</b> "+dv.serious+"</span>"
       + "<span><b>Спасбросок</b> "+dv.death+"</span>"
       + '<span><b>Лояльность</b> '+sp.loyalty+"</span></div>";
    h += '<p class="note">У подчинённого <b>девять</b> СТАТов — Удача остаётся '
       + 'персонажам игроков. ЭМП за импланты снижать не нужно, книга это уже '
       + 'учла. ПЗ и порог считаются как у всех — ' + link("derived_stats", "формулы")
       + ".</p>";

    h += "<h4>Навыки</h4>";
    h += '<div class="tw"><table class="mx"><thead><tr><th>Навык</th>'
       + '<th class="n">Уровень</th></tr></thead><tbody>';
    for(var k=0;k<t.skills.length;k++)
      h += "<tr><th>"+esc(t.skills[k].skill)+'</th><td class="n">'
         + t.skills[k].level+"</td></tr>";
    h += "</tbody></table></div>";
    h += '<p class="note">Это уровни навыков, к ним прибавляется его СТАТ и 1d10. '
       + '<b>Повышать их нельзя</b> — политика компании. Список всех навыков — '
       + link("skills", "в Проверках и Навыках") + ".</p>";

    h += "<h4>Хром и снаряжение</h4>";
    h += '<div class="tw"><table class="mx cgfacts"><tbody>'
       + "<tr><th>Киберимпланты</th><td>"+esc(t.cyber)+"</td></tr>"
       + "<tr><th>Снаряжение</th><td>"+esc(t.gear)+"</td></tr>"
       + "</tbody></table></div>";
    h += '<p class="note">Из брони он носит <b>только Лёгкий бронекостюм</b>. '
       + "Что делает каждый имплант — " + link("cyberware_catalogue", "каталог")
       + ", оружие — " + link("weapons", "Перестрелка") + ".</p>";
  }
  /* Optional, and last, for the same reason "About the character" sits under the sheet:
     you write the person once the numbers are in front of you. The book hands the
     Exec a type and a row of STATs — everything that makes this one a person
     rather than a hire is the player's, and the GM is the one who will read it,
     so it prints with the sheet. It is offered only once a type is chosen: there
     is nothing to describe before that. */
  if(t){
    var snote = (S.sub && S.sub.note) || "";
    h += '<div class="cgnotes'+(snote.trim() ? "" : " empty")
       + '"><h4 class="cgnoteh">Кто он такой</h4>'
       + '<p class="cgnotehint">По желанию. Отдел кадров прислал СТАТы — характер, '
       + 'манеры и то, чего он на самом деле хочет, придумываешь ты. '
       + 'Печатается вместе с листом.</p>'
       + '<div class="cgnote'+(snote.trim() ? "" : " empty")+'">'
       + '<textarea rows="2" data-cg="subnote" placeholder="кто он, как себя ведёт, '
       + 'чего хочет — и почему он всё ещё работает на тебя">'+esc(snote)+"</textarea>"
       + "</div></div>";
  }
  box.innerHTML = h;
  grow();
}
root.addEventListener("click", function(ev){
  var t = ev.target;
  if(t.getAttribute && t.getAttribute("data-cg")==="rollsub"){
    if(!S.sub) S.sub = {};
    S.sub.roll = dN(6);
    save(); paintSub(); paintSheet(); paintTabs();
  }
});

/* The optional fields. Nothing here is required and nothing is generated — it is
   the only place on the sheet where the player writes rather than rolls, and it is
   what makes the printed sheet worth handing to a GM. */
function paintNotes(){
  var box = q("notebox"); if(!box) return;
  /* This used to be a hairline <summary> sitting above everything — prominent
     position, invisible styling. It now reads as a block with a heading, and it
     sits under the sheet: you write the person once the numbers are in front of
     you, and the sheet stays the first thing on the step. */
  /* Not a <details> any more. Collapsed, it was one hairline row competing with a
     screenful of tables and chips — nobody found it. It is part of the sheet, it
     prints with the sheet, so it is simply open. */
  /* Print drops every unfilled box (`.cgnote.empty`) and the hint with it — which
     left the heading alone on the page, a section title with nothing under it. An
     unfilled optional field is not a fact about the character, and neither is the
     heading over five of them, so the whole block is marked empty and dropped too.
     Recomputed on input below, for the same reason the per-field class is: typing
     does not re-render this block. */
  var anyNote = false;
  for(var n0=0;n0<D.notes.length;n0++)
    if((S.notes[D.notes[n0].key]||"").trim()){ anyNote = true; break; }
  var h = '<div class="cgnotes'+(anyNote ? "" : " empty")+'">'
        + '<h4 class="cgnoteh">О персонаже</h4>'
        + '<p class="cgnotehint">По желанию — но именно это ГМ прочитает про твоего '
        + "персонажа. Печатается вместе с листом.</p>";
  for(var i=0;i<D.notes.length;i++){
    var f = D.notes[i];
    var filled = (S.notes[f.key]||"").trim();
    /* A <textarea> prints the box you see and nothing more: a long Background is
       cut off at the box edge and cannot break across pages. So print gets a
       plain <div> with the same text, which wraps and breaks normally, and the
       textarea is hidden. Growing the box on input is still worth doing — it is
       what makes the field usable on screen — but it cannot be the print path. */
    h += '<div class="cgnote'+(filled ? "" : " empty")+'">'
       + '<span class="cgnotelab">'+esc(f.label)+"</span>"
       + '<textarea rows="2" data-cg="note" data-key="'+f.key+'" placeholder="'
       + esc(f.hint)+'">'+esc(S.notes[f.key]||"")+"</textarea>"
       + '<div class="cgnoteprint" data-cg="noteprint" data-key="'+f.key+'">'
       + esc(S.notes[f.key]||"")+"</div></div>";
  }
  box.innerHTML = h + "</div>";
  grow();
}
/* A <textarea> prints exactly the box you see, so anything scrolled out of view
   is simply missing from the PDF. Growing them to their content is what makes the
   fields printable at all. */
function grow(){
  /* The subordinate's description is the same kind of field and needs the same
     treatment — a box that does not grow is a box whose contents stop existing at
     its bottom edge. */
  var areas = root.querySelectorAll('[data-cg="note"],[data-cg="subnote"]');
  for(var i=0;i<areas.length;i++){
    areas[i].style.height = "auto";
    areas[i].style.height = Math.max(46, areas[i].scrollHeight + 2) + "px";
  }
}
function anyNote(){
  for(var k in S.notes) if(S.notes.hasOwnProperty(k) && (S.notes[k]||"").trim()) return true;
  return false;
}

/* -------------------------------------------------------------- method chooser
   It sits ABOVE the tab strip rather than inside a step, because it governs two of
   them — STATs and Skills — and a control that lives inside one of the steps it
   changes cannot be seen from the other. Above the tabs it also stays readable from
   steps 4 and 5, where the answer to "what am I building" is otherwise nowhere. */
/* Prose that differs between the methods lives in `_body_00.html` inside
   `[data-mth]` blocks, not in strings here — the generator holds the chapter's
   Russian, and a step's own explanation is chapter text. This only decides which
   block is on screen. `hidden` rather than a class, so a block that is off is off
   for the search index and for print as well as for the eye. */
function paintMode(){
  var blocks = root.querySelectorAll("[data-mth]");
  for(var i=0;i<blocks.length;i++)
    blocks[i].hidden = (blocks[i].getAttribute("data-mth") !== S.method);
}
function paintMethods(){
  var box = q("methods"); if(!box) return;
  var h = '<span class="cgmlab">Метод</span>';
  for(var i=0;i<D.methods.length;i++){
    var m = D.methods[i], on = (m.key === S.method);
    h += '<button type="button" class="cgm'+(on?" on":"")+'" data-cg="method" data-key="'+m.key+'"'
       + (on ? ' aria-current="true"' : "") + ' title="'+esc(m.what)+'">'
       + '<span class="cgmno">'+esc(m.no)+"</span>"
       + '<span class="cgmname">'+esc(m.name)+"</span>"
       + '<span class="cgmtag">'+esc(m.tag)+"</span></button>";
  }
  var cur = methodOf(S.method);
  box.innerHTML = h + (cur ? '<span class="cgmwhat">'+esc(cur.what)
                           + " " + pageChip(cur.page) + "</span>" : "");
}
root.addEventListener("click", function(ev){
  var b = ev.target.closest ? ev.target.closest('[data-cg="method"]') : null;
  if(!b) return;
  var key = b.getAttribute("data-key");
  if(key === S.method) return;
  /* The three methods produce STATs and skills by incompatible routes — a row read
     across, ten columns, or a spent point pool; a printed package, 86 points over
     20 skills, or 86 points over all 66 — so there is nothing to carry over and no
     way to convert one into another. Method #3 additionally has no fixed gear
     package at all, just the freeform Gear/Style purchases, so switching
     away from it loses those too, and switching INTO it starts them empty rather
     than inheriting #1/#2's fixed package. Everything that does NOT depend on the
     method survives: the Role, the whole Lifepath, the name and the
     free-text fields. The confirm names all three halves, because "start over"
     is the neighbouring button and this is not that. */
  var hasCalcState = Object.keys(S.statAlloc||{}).length || Object.keys(S.skills3||{}).length
                     || (S.buy||[]).length || (S.style||[]).length
                     || typeof S.buyBudget === "number" || typeof S.styleBudget === "number"
                     || (S.sponsor && S.sponsor.active);
  /* S.start/startBudget survive a #1<->#2 switch, but NOT a switch across the
     calc boundary — so they have to be checked here too, on their own, even
     though S.stats is often already null by the time this fires (a previous
     #1<->#2 switch already cleared it): without this, going edge -> calc could
     silently drop a logged 500eb purchase with no warning at all, because
     nothing else left standing at that point would trip the confirm. */
  var hasStartState = (S.start||[]).length || typeof S.startBudget === "number";
  if((S.stats || S.roll || rolledCount() || Object.keys(S.levels||{}).length || hasCalcState
      || (hasStartState && ((key === "calc") !== (S.method === "calc"))))
     && !window.confirm("Сменить метод на «" + methodOf(key).name + "»?\n\n"
        + "СТАТы придётся получить заново, а навыки и снаряжение вернутся к "
        + "исходным: методы получают их по-разному.\n\n"
        + "Роль, Жизненный путь, имя и записи о персонаже останутся.")) return;
  /* #1/#2's own 500eb (S.start/startBudget) is the ONE piece of gear state that
     is not calc-only — it belongs to the fast-method PAIR, not to either method
     alone, the same way Role and Lifepath do. So it survives a #1<->#2
     switch and is cleared only when the switch crosses the calc boundary in
     either direction — captured before S.method is overwritten below. */
  var wasCalc = (S.method === "calc"), willBeCalc = (key === "calc");
  S.method = key;
  S.stats = null; S.roll = null; S.srolls = []; S.levels = {};
  S.statBudget = ""; S.statAlloc = {}; S.skills3 = {}; S.homebrew = []; S.buy = []; S.style = [];
  S.buyBudget = null; S.styleBudget = null; S.sponsor = {active:false,kind:"",hook:""};
  if(wasCalc || willBeCalc){ S.start = []; S.startBudget = null; }
  save(); paintAll();
  /* Stay where you are unless the switch has made it invalid. Jumping to step 2
     unconditionally threw someone who had not even picked a Role — the very first
     thing anyone does here is read the two methods and click one — onto a screen
     whose only content is "Pick a Role first". Only steps 3–5 actually break,
     because they need the STATs the switch just cleared. */
  go(ready(cur) ? cur : (S.role ? 2 : 1));
});

/* ------------------------------------------------------------------ navigation
   The strip is NOT a fixed list any more: a Exec has a sixth step, because
   rank 3 of Teamwork hands him a subordinate and a subordinate is itself
   a character with STATs, skills and a kit — a line on the sheet cannot hold it.
   Two things follow, and both are the reason the pane id and the position on the
   strip are now different numbers:
     * a pane keeps its id for ever (the sheet is `data-pane="5"` whether it is
       shown fifth or sixth), so nothing in the markup, in `go()` or in a saved
       character has to be renumbered when the extra step appears;
     * the READER is shown the position, 1…N, so the numbers on screen are always
       contiguous.
   `steps()` is therefore the single source of order, and everything that walks the
   wizard — the tabs, "Next", "Back", ready() — reads it rather than a literal. */
var PANES = [
  {id:1, name:"Роль"},
  {id:2, name:"СТАТы"},
  {id:3, name:"Навыки"},
  {id:4, name:"Жизненный путь"},
  /* Every method has something to spend here now: Method #3 buys its whole kit
     (Gear + Style), #1/#2 have their own 500eb (printed 98) on top of the
     fixed package the sheet still prints. The pane itself never varies by
     method — paintGearPane() decides which list(s) to paint — so it is always
     on the strip, unlike Subordinate below. */
  {id:7, name:"Снаряжение"},
  {id:6, name:"Подчинённый", when:function(){ return !!subSpec(); }},
  {id:5, name:"Лист"}
];
function steps(){
  var out = [];
  for(var i=0;i<PANES.length;i++)
    if(!PANES[i].when || PANES[i].when()) out.push(PANES[i]);
  return out;
}
function stepAt(pos){ var s = steps(); return s[pos-1] || s[s.length-1]; }
function posOf(id){
  var s = steps();
  for(var i=0;i<s.length;i++) if(s[i].id === id) return i+1;
  return 0;
}
var cur = 1;
function go(n){
  /* A pane can vanish under you: switching away from Exec takes the
     subordinate step off the strip while you are standing on it. Falling back to
     the sheet rather than to a blank pane — the sheet is where that switch leaves
     the character anyway. */
  cur = posOf(n) ? n : 5;
  n = cur;
  var panes = root.querySelectorAll(".cgpane");
  for(var i=0;i<panes.length;i++)
    panes[i].classList.toggle("on", panes[i].getAttribute("data-pane")===String(n));
  paintTabs(); paintFeet();
  /* Park the WIZARD at a fixed spot, never the pane's own heading: the panes are
     wildly different heights, so scrolling to each one's top put the reader at a
     different place on screen every time and read as the page sliding away. The
     tab strip is the one element common to every step, so it lands at the same y
     on every move and the new step starts right under it. */
  if(scrolled){
    /* Park the SECTION heading, not the tab strip. Parking the tabs put "Character
       Wizard" just off the top of the screen on every move, so the reader lost
       the one label saying where they were. The h2 is equally common to all five
       steps and keeps both it and the tabs in view. */
    var anchor = root.closest("section");
    anchor = (anchor && anchor.querySelector("h2.sec")) || q("tabs");
    if(anchor) window.scrollTo({top: anchor.getBoundingClientRect().top + window.pageYOffset - 14});
  }
  scrolled = true;
}
var scrolled = false;
function ready(n){
  if(n<=1) return true;
  if(n===2) return !!S.role;
  return !!S.stats;
}
/* Why "Next" exists at all: the tab strip shows where you are, but nothing told
   you what to do next, and a wizard whose only navigation is its own breadcrumb
   reads as a form, not as a path. Each button names its destination, and a blocked
   one says what is missing instead of just being dead. */
var BLOCKED = {2:"Сначала выбери Роль", 3:"Сначала брось СТАТы",
               4:"Сначала брось СТАТы", 5:"Сначала брось СТАТы",
               6:"Сначала брось СТАТы", 7:"Сначала брось СТАТы"};
/* The outstanding-field count belongs to the step that OWNS the field: "pick 1"
   to Skills, the culture language to Lifepath, the Role's own points and its
   Role path to the step each is painted on. One shared total on every tab sent
   the reader to the wrong screen — the defect this split fixed the first time. */
function todoOf(id){
  if(id===3) return pendingSkills().length;
  if(id===4) return pendingLife().length + pendingPath().length;
  if(id===5) return pendingAbil().length;
  if(id===6) return pendingSub().length;
  if(id===7) return pendingGear().length;
  return 0;
}
function paintFeet(){
  var order = steps();
  /* A pane that is not on the strip has to lose its footer, not keep the one it
     had: after switching away from Exec the subordinate pane still held
     "Next: Sheet", a live button on a step that no longer exists. */
  var all = root.querySelectorAll(".cgfoot");
  for(var c=0;c<all.length;c++) all[c].innerHTML = "";
  for(var i=0;i<order.length;i++){
    var pane = root.querySelector('.cgpane[data-pane="'+order[i].id+'"]');
    var foot = pane && pane.querySelector(".cgfoot");
    if(!foot) continue;
    var h = "";
    if(i > 0)
      h += '<button type="button" class="cgbtn cgback" data-cg="tab" data-step="'+order[i-1].id+'">'
         + "← " + order[i-1].name + "</button>";
    if(i < order.length-1){
      var nxt = order[i+1], can = ready(nxt.id);
      h += '<button type="button" class="cgbtn cgprim cgnext" data-cg="tab" data-step="'+nxt.id+'"'
         + (can ? "" : " disabled") + ">Дальше: " + nxt.name + " →</button>";
      /* Method #3 does not roll its STATs, it spends a pool — "roll" sent the
         reader looking for a die that is not on the screen. */
      if(!can) h += '<span class="cghint">'
                  + (nxt.id >= 3 && isCalc() ? "Сначала распредели пул СТАТов" : BLOCKED[nxt.id])
                  + "</span>";
    } else {
      h += '<span class="cghint">Готово — лист выше можно распечатать.</span>';
    }
    foot.innerHTML = h;
  }
}

function paintTabs(){
  var nav = q("tabs"); if(!nav) return;
  var order = steps(), h = "";
  for(var i=0;i<order.length;i++){
    /* A count on a tab that cannot be opened yet is a demand nothing on screen can
       answer — #3 showed "Skills 3" before a single STAT existed. It appears once
       the step is reachable. */
    var id = order[i].id, ok = ready(id), todo = ok ? todoOf(id) : 0;
    h += '<button type="button" class="cgtab'+(id===cur?" on":"")+(ok?"":" off")
       + '" data-cg="tab" data-step="'+id+'"'+(ok?"":" disabled")+">"
       + '<span class="cgnum">'+(i+1)+"</span>"+order[i].name
       + (todo ? '<span class="cgtodo" title="осталось заполнить">'+todo+"</span>" : "")
       + "</button>";
  }
  nav.innerHTML = h;
}
root.addEventListener("click", function(ev){
  var t = ev.target.closest ? ev.target.closest('[data-cg="tab"]') : null;
  if(t && !t.disabled) go(+t.getAttribute("data-step"));
});

/* --------------------------------------------------------------------- actions */
root.addEventListener("click", function(ev){
  var t = ev.target, a = t.getAttribute && t.getAttribute("data-cg");
  if(a==="print"){
    /* The class is what narrows printing to the sheet, and it must survive for as
       long as the print dialog is open — a 1s timeout removed it underneath the
       preview, after which the same print produced the whole 251-page book.
       Keeping it costs nothing: every rule it drives lives inside @media print,
       so it is invisible on screen. afterprint clears it.
       The popover is position:fixed and would ride along onto the paper. */
    if(window.CPR_POP_CLOSE) window.CPR_POP_CLOSE();
    document.body.classList.add("cgprint");
    /* The browser proposes the page title as the PDF file name. */
    if(savedTitle === null) savedTitle = document.title;
    var fname = (S.name || "").replace(/[\\\/:*?"<>|]+/g, " ").replace(/\s+/g, " ").trim();
    document.title = fname || "Безымянный";
    window.print();
  }
  if(a==="reset"){
    if(!window.confirm("Стереть персонажа и начать заново?")) return;
    S = blank(); save(); paintAll(); go(1);
  }
  if(a==="savemd"){
    var md = sheetMarkdown();
    if(!downloadFile(fileStem()+".md", "text/markdown", md)) fallbackCopy(md, t);
  }
  if(a==="savejson"){
    var js = exportJson();
    if(!downloadFile(fileStem()+".json", "application/json", js)) fallbackCopy(js, t);
  }
  if(a==="loadjson"){
    var fi = q("importfile");
    if(fi){ fi.value = ""; fi.click(); }
  }
});
/* Import: read the chosen file, confirm over a character that is already there,
   and let normalise() decide what survives. */
root.addEventListener("change", function(ev){
  var t = ev.target;
  if(!t.getAttribute || t.getAttribute("data-cg") !== "importfile" || !t.files || !t.files[0]) return;
  var rd = new FileReader();
  rd.onload = function(){
    var started = !!(S.role || S.name);
    if(started && !window.confirm("Заменить текущего персонажа загруженным?")) return;
    var err = importJson(String(rd.result));
    if(err) window.alert(err);
  };
  rd.onerror = function(){ window.alert("Файл не прочитался."); };
  rd.readAsText(t.files[0]);
});
function fallbackCopy(text, btn){
  var ta = document.createElement("textarea"), ok = false;
  ta.value = text; ta.style.position="fixed"; ta.style.opacity="0";
  document.body.appendChild(ta); ta.select();
  try{ document.execCommand("copy"); btn.textContent = "Copied"; ok = true; }
  catch(e){ btn.textContent = "Failed — select it by hand"; }
  document.body.removeChild(ta);
  return ok;
}

function paintAll(){
  paintMethods(); paintMode();
  paintRoles(); paintStats(); paintSkills(); paintHomebrew(); paintLife(); paintNotes();
  paintGearPane(); paintSub(); paintSheet(); paintTabs(); paintFeet();
  var nameField = q("name");
  if(nameField && nameField.value !== S.name) nameField.value = S.name || "";
}

var savedTitle = null;
window.addEventListener("afterprint", function(){
  document.body.classList.remove("cgprint");
  if(savedTitle !== null){ document.title = savedTitle; savedTitle = null; }
});

/* No per-key backfills here any more — load() merges onto blank(), so a save
   written before gear choices, the free-text fields or the language existed comes
   back with those keys at their defaults, and one written by a future version
   loses only the keys this build does not know. */
S = load();
try{
  paintAll();
  go(S.role ? (S.stats ? 5 : 2) : 1);
}catch(e){
  /* A stored character that throws on the first paint left a wizard with no controls,
     and because it was stored it did so on every load, until localStorage was cleared
     by hand. The offender is kept under another key, not thrown away, and the page
     starts blank. */
  try{ localStorage.setItem(KEY + "-unreadable", JSON.stringify(S)); }catch(e2){}
  S = blank(); save(); paintAll(); go(1);
}
})();
