/* The two things the wizard borrows from the host book's page when it runs inside
   it, rebuilt for the standalone page: the theme toggle, and the popover a skill
   check's roll is shown in (window.CPR_POP). Runs before wizard.js. */

/* ---------- theme ---------- */
(function(){
  var root = document.documentElement, KEY = "cpr-theme";
  var btns = Array.prototype.slice.call(document.querySelectorAll(".themer button"));
  function paint(v){
    if(v === "auto") root.removeAttribute("data-theme");
    else root.setAttribute("data-theme", v);
    btns.forEach(function(b){ b.setAttribute("aria-pressed", String(b.dataset.th === v)); });
  }
  function saved(){ var v = null; try{ v = localStorage.getItem(KEY); }catch(e){} return v || "auto"; }
  paint(saved());
  btns.forEach(function(b){
    b.addEventListener("click", function(){
      paint(b.dataset.th);
      try{ localStorage.setItem(KEY, b.dataset.th); }catch(e){}
    });
  });
})();

/* ---------- popover ---------- */
(function(){
  var box = document.createElement("div");
  box.id = "gloss"; box.hidden = true; box.setAttribute("role", "dialog");
  document.body.appendChild(box);
  var current = null;
  function place(el){
    var r = el.getBoundingClientRect(), bw = box.offsetWidth, bh = box.offsetHeight, pad = 8;
    var left = Math.min(Math.max(pad, r.left), window.innerWidth - bw - pad);
    var top = r.bottom + 6;
    if(top + bh > window.innerHeight - pad) top = Math.max(pad, r.top - bh - 6);
    box.style.left = left + "px"; box.style.top = top + "px";
  }
  function close(){ box.hidden = true; current = null; }
  window.CPR_POP = function(anchor, html){
    box.innerHTML = html;
    current = anchor;
    box.hidden = false;
    place(anchor);
  };
  window.CPR_POP_CLOSE = close;
  document.addEventListener("click", function(e){
    if(e.target.closest && e.target.closest('[data-cg="roll"],[data-cg="lifedice"]')) return;
    if(!e.target.closest || !e.target.closest("#gloss")) close();
  });
  document.addEventListener("keydown", function(e){ if(e.key === "Escape") close(); });
  window.addEventListener("resize", close);
})();

/* ---------- language of the frame ----------
   The wizard owns the language (it dispatches "cpr-lang"); the page around it — the
   top bar, the theme buttons, the footer, the tab title — is written in English (the
   language of the payload) and carries the Russian in data-ru. */
(function(){
  var baseTitle = document.title;
  function apply(l){
    var nodes = document.querySelectorAll("[data-ru]");
    for(var i=0;i<nodes.length;i++){
      var n = nodes[i];
      if(n.__base === undefined) n.__base = n.innerHTML;
      n.innerHTML = l === "ru" ? n.getAttribute("data-ru") : n.__base;
    }
    var lab = document.querySelectorAll("[data-ru-label]");
    for(var j=0;j<lab.length;j++){
      if(lab[j].__base === undefined) lab[j].__base = lab[j].getAttribute("aria-label");
      lab[j].setAttribute("aria-label", l === "ru" ? lab[j].getAttribute("data-ru-label") : lab[j].__base);
    }
    document.title = l === "ru" ? (document.documentElement.getAttribute("data-title-ru") || baseTitle) : baseTitle;
  }
  document.addEventListener("cpr-lang", function(e){ apply(e.detail); });
})();
