(function(){
  "use strict";

  var D = VOLBY_DATA;
  // units[i] = [nazev, okres, kraj, mandaty, pocobyv, kodzastup, cobvodu, parts]
  // parties[i] = [unit_idx, nazevcelk, zkratka]
  // candidates[i] = [party_idx, porcislo, jmeno_idx, prijmeni_idx, titulpred_idx, titulza_idx, vek, povolani_idx, bydliste_idx, platnost]

  function normCz(s){
    if(!s) return "";
    return s.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase();
  }

  // ---- precompute normalized search strings ----
  var unitNorm = D.units.map(function(u){ return normCz(u[0]); });
  var partyNorm = D.parties.map(function(p){ return normCz(p[2] + " " + p[1]); });
  var jmenoNorm = D.jmena.map(normCz);
  var prijmeniNorm = D.prijmeni.map(normCz);
  var povolaniNorm = D.povolani.map(normCz);

  document.getElementById("loadStatus").textContent =
    D.candidates.length.toLocaleString("cs-CZ") + " kandidátů načteno";

  // ---- stats strip ----
  document.getElementById("statsStrip").innerHTML =
    "<div><b>" + D.units.length.toLocaleString("cs-CZ") + "</b><br>volebních obvodů</div>" +
    "<div><b>" + D.parties.length.toLocaleString("cs-CZ") + "</b><br>kandidujících uskupení</div>" +
    "<div><b>" + D.candidates.length.toLocaleString("cs-CZ") + "</b><br>kandidátů celkem</div>";

  // ---- state ----
  var state = {
    obecIdx: null,
    strana: "",
    jmeno: "",
    povolani: "",
    vekMin: null,
    vekMax: null,
    platniOnly: false,
    focusPartyIdx: null
  };

  var els = {
    obecInput: document.getElementById("obecInput"),
    obecResults: document.getElementById("obecResults"),
    obecSelected: document.getElementById("obecSelected"),
    stranaInput: document.getElementById("stranaInput"),
    jmenoInput: document.getElementById("jmenoInput"),
    povolaniInput: document.getElementById("povolaniInput"),
    vekMin: document.getElementById("vekMin"),
    vekMax: document.getElementById("vekMax"),
    platniOnly: document.getElementById("platniOnly"),
    results: document.getElementById("results"),
    clearBtn: document.getElementById("clearBtn")
  };

  function debounce(fn, ms){
    var t;
    return function(){
      var args = arguments, ctx = this;
      clearTimeout(t);
      t = setTimeout(function(){ fn.apply(ctx, args); }, ms);
    };
  }

  // ---- obec autocomplete ----
  els.obecInput.addEventListener("input", debounce(function(){
    var q = normCz(els.obecInput.value.trim());
    if(q.length < 2){ els.obecResults.style.display = "none"; els.obecResults.innerHTML=""; return; }
    var scored = [];
    for(var i=0;i<D.units.length;i++){
      var pos = unitNorm[i].indexOf(q);
      if(pos === -1) continue;
      var rank = unitNorm[i] === q ? 0 : (pos === 0 ? 1 : 2);
      scored.push([rank, unitNorm[i].length, i]);
    }
    scored.sort(function(a,b){
      return a[0]-b[0] || a[1]-b[1] || D.units[a[2]][0].localeCompare(D.units[b[2]][0], "cs");
    });
    var matches = scored.slice(0, 40).map(function(s){ return s[2]; });
    if(matches.length === 0){
      els.obecResults.innerHTML = '<div style="color:var(--ink-soft);cursor:default;">Nic nenalezeno</div>';
      els.obecResults.style.display = "block";
      return;
    }
    els.obecResults.innerHTML = matches.map(function(i){
      var u = D.units[i];
      var okresName = D.okresy[u[1]] || "";
      return '<div data-idx="'+i+'">'+ escapeHtml(u[0]) +
        '<div class="okres">'+ escapeHtml(okresName) + (u[7] && u[7].length ? " · vč. " + escapeHtml(u[7].slice(0,3).join(", ")) : "") +'</div></div>';
    }).join("");
    els.obecResults.style.display = "block";
  }, 120));

  els.obecResults.addEventListener("click", function(e){
    var row = e.target.closest("[data-idx]");
    if(!row) return;
    selectObec(parseInt(row.getAttribute("data-idx"),10));
  });

  document.addEventListener("click", function(e){
    if(!els.obecResults.contains(e.target) && e.target !== els.obecInput){
      els.obecResults.style.display = "none";
    }
  });

  function selectObec(idx){
    state.obecIdx = idx;
    var u = D.units[idx];
    els.obecInput.value = "";
    els.obecResults.style.display = "none";
    els.obecSelected.innerHTML = '<div class="chip-selected"><span>'+escapeHtml(u[0])+'</span><button type="button" id="obecClearBtn" title="Zrušit výběr obce">×</button></div>';
    document.getElementById("obecClearBtn").addEventListener("click", function(){
      state.obecIdx = null;
      els.obecSelected.innerHTML = "";
      render();
    });
    render();
  }

  // ---- other filters ----
  els.stranaInput.addEventListener("input", debounce(function(){
    state.strana = normCz(els.stranaInput.value.trim());
    render();
  }, 150));
  els.jmenoInput.addEventListener("input", debounce(function(){
    state.jmeno = normCz(els.jmenoInput.value.trim());
    render();
  }, 150));
  els.povolaniInput.addEventListener("input", debounce(function(){
    state.povolani = normCz(els.povolaniInput.value.trim());
    render();
  }, 150));
  els.vekMin.addEventListener("input", debounce(function(){
    state.vekMin = els.vekMin.value ? parseInt(els.vekMin.value,10) : null;
    render();
  }, 150));
  els.vekMax.addEventListener("input", debounce(function(){
    state.vekMax = els.vekMax.value ? parseInt(els.vekMax.value,10) : null;
    render();
  }, 150));
  els.platniOnly.addEventListener("change", function(){
    state.platniOnly = els.platniOnly.checked;
    render();
  });

  els.clearBtn.addEventListener("click", function(){
    state = {obecIdx:null, strana:"", jmeno:"", povolani:"", vekMin:null, vekMax:null, platniOnly:false, focusPartyIdx:null};
    els.obecInput.value = ""; els.stranaInput.value=""; els.jmenoInput.value="";
    els.povolaniInput.value=""; els.vekMin.value=""; els.vekMax.value=""; els.platniOnly.checked=false;
    els.obecSelected.innerHTML = "";
    render();
  });

  function escapeHtml(s){
    return String(s == null ? "" : s).replace(/[&<>"']/g, function(c){
      return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];
    });
  }

  function candName(c){
    var jm = D.jmena[c[2]] || "";
    var pj = D.prijmeni[c[3]] || "";
    var tp = c[4] >= 0 ? D.tituly[c[4]] : "";
    var tz = c[5] >= 0 ? D.tituly[c[5]] : "";
    var full = (tp ? tp + " " : "") + jm + " " + pj.toUpperCase() + (tz ? ", " + tz : "");
    return full.trim();
  }

  function candMatchesFilters(c){
    if(state.jmeno){
      var jn = jmenoNorm[c[2]] || "";
      var pn = prijmeniNorm[c[3]] || "";
      if(jn.indexOf(state.jmeno) === -1 && pn.indexOf(state.jmeno) === -1) return false;
    }
    if(state.povolani){
      var pv = c[7] >= 0 ? povolaniNorm[c[7]] : "";
      if(pv.indexOf(state.povolani) === -1) return false;
    }
    if(state.vekMin != null && c[6] < state.vekMin) return false;
    if(state.vekMax != null && c[6] > state.vekMax) return false;
    if(state.platniOnly && c[9] !== 1) return false;
    return true;
  }

  function partyMatchesStrana(pIdx){
    if(!state.strana) return true;
    return partyNorm[pIdx].indexOf(state.strana) !== -1;
  }

  // ---- rendering ----
  function render(){
    if(state.obecIdx != null){
      renderObecView(state.obecIdx);
    } else if(state.jmeno || state.strana || state.povolani || state.vekMin != null || state.vekMax != null){
      renderGlobalSearch();
    } else {
      renderEmptyState();
    }
  }

  function renderEmptyState(){
    els.results.innerHTML =
      '<div class="empty-state">' +
      '<h2>Kde začít</h2>' +
      '<p>Vyberte obec vlevo pro zobrazení celé kandidátky, nebo rovnou hledejte podle strany, jména či příjmení napříč celou republikou.</p>' +
      '<ul>' +
      '<li>Zadejte název obce a vyberte ji ze seznamu — uvidíte všechna kandidující uskupení a jejich kandidáty v pořadí na hlasovacím lístku.</li>' +
      '<li>Hledejte podle strany i bez výběru obce — např. „Piráti“ nebo „Nezávislí“.</li>' +
      '<li>Hledejte konkrétní osobu podle jména nebo příjmení.</li>' +
      '<li>Filtry lze kombinovat — např. obec + strana, nebo jméno + minimální věk.</li>' +
      '</ul>' +
      '</div>';
  }

  function renderObecView(idx){
    var u = D.units[idx];
    var okresName = D.okresy[u[1]] || "";
    var krajName = D.kraje[u[2]] || "";
    var partyIdxs = D.unitParties[idx];

    var html = '<div class="unit-card">';
    html += '<div class="unit-header"><div class="name">'+escapeHtml(u[0])+'</div>';
    html += '<div class="meta">'+escapeHtml(okresName)+' · '+escapeHtml(krajName)+
      ' · '+u[3]+' mandátů'+(u[4] ? ' · '+u[4].toLocaleString("cs-CZ")+' obyvatel' : '')+'</div>';
    if(u[7] && u[7].length){
      html += '<div class="parts">Zahrnuje místní části: '+escapeHtml(u[7].join(", "))+'</div>';
    }
    html += '</div>';

    var shown = 0;
    for(var i=0;i<partyIdxs.length;i++){
      var pIdx = partyIdxs[i];
      if(!partyMatchesStrana(pIdx)) continue;
      var p = D.parties[pIdx];
      var candIdxs = D.partyCandidates[pIdx].filter(function(ci){ return candMatchesFilters(D.candidates[ci]); });
      if(candIdxs.length === 0) continue;
      shown++;
      html += '<div class="party-block'+(state.focusPartyIdx===pIdx?' flash':'')+'" data-party="'+pIdx+'">';
      html += '<div class="party-title"><span>'+escapeHtml(p[2] || p[1])+'</span>';
      if(p[1] && p[1] !== p[2]) html += '<span class="full">'+escapeHtml(p[1])+'</span>';
      html += '</div>';
      candIdxs.forEach(function(ci){
        var c = D.candidates[ci];
        var bydl = c[8] >= 0 ? D.bydliste[c[8]] : "";
        var pov = c[7] >= 0 ? D.povolani[c[7]] : "";
        html += '<div class="cand-row">';
        html += '<div class="num">'+c[1]+'.</div>';
        html += '<div class="box"></div>';
        html += '<div class="who"><b>'+escapeHtml(candName(c))+'</b>';
        if(c[9] !== 1) html += '<span class="cancelled">kandidatura zrušena</span>';
        html += '<div class="sub">'+escapeHtml(pov)+(pov && bydl ? " · " : "")+escapeHtml(bydl)+'</div></div>';
        html += '<div class="right">'+(c[6] ? c[6]+' let' : '')+'</div>';
        html += '</div>';
      });
      html += '</div>';
    }
    if(shown === 0){
      html += '<div class="party-block"><i>Žádné uskupení ani kandidát neodpovídá zadaným filtrům.</i></div>';
    }
    html += '</div>';
    els.results.innerHTML = html;
    state.focusPartyIdx = null;

    if(state.focusPartyIdx){
      var el = els.results.querySelector('[data-party="'+state.focusPartyIdx+'"]');
      if(el) el.scrollIntoView({behavior:"smooth", block:"center"});
    }
  }

  var GLOBAL_LIMIT = 250;

  function renderGlobalSearch(){
    var matches = [];
    var total = 0;
    for(var ci=0; ci<D.candidates.length; ci++){
      var c = D.candidates[ci];
      if(!candMatchesFilters(c)) continue;
      if(state.strana && !partyMatchesStrana(c[0])) continue;
      total++;
      if(matches.length < GLOBAL_LIMIT) matches.push(ci);
    }

    var html = '<div class="more-note">Nalezeno '+total.toLocaleString("cs-CZ")+' kandidátů'+
      (total > GLOBAL_LIMIT ? ' — zobrazeno prvních '+GLOBAL_LIMIT+'. Zpřesněte hledání (např. přidejte obec) pro úplný výpis.' : '.') +
      '</div>';

    if(total === 0){
      html += '<div class="empty-state"><p>Žádný kandidát neodpovídá zadaným kritériím.</p></div>';
    } else {
      matches.forEach(function(ci){
        var c = D.candidates[ci];
        var p = D.parties[c[0]];
        var u = D.units[p[0]];
        var pov = c[7] >= 0 ? D.povolani[c[7]] : "";
        var bydl = c[8] >= 0 ? D.bydliste[c[8]] : "";
        html += '<div class="global-row">';
        html += '<div><div class="who"><b>'+escapeHtml(candName(c))+'</b>'+
          (c[6] ? ', '+c[6]+' let' : '')+
          (c[9] !== 1 ? '<span class="cancelled" style="margin-left:6px;">kandidatura zrušena</span>' : '') +
          '</div>';
        html += '<div class="meta">'+escapeHtml(pov)+(pov?' · ':'')+escapeHtml(bydl)+'<br>'+
          escapeHtml(p[2] || p[1])+' · '+escapeHtml(u[0])+' ('+escapeHtml(D.okresy[u[1]]||"")+')</div></div>';
        html += '<button class="goto" data-unit="'+p[0]+'" data-party="'+c[0]+'">Celá kandidátka</button>';
        html += '</div>';
      });
    }
    els.results.innerHTML = html;

    els.results.querySelectorAll(".goto").forEach(function(btn){
      btn.addEventListener("click", function(){
        var unitIdx = parseInt(btn.getAttribute("data-unit"),10);
        var partyIdx = parseInt(btn.getAttribute("data-party"),10);
        state.focusPartyIdx = partyIdx;
        selectObec(unitIdx);
        setTimeout(function(){
          var el = els.results.querySelector('[data-party="'+partyIdx+'"]');
          if(el){ el.classList.add("flash"); el.scrollIntoView({behavior:"smooth", block:"center"}); }
        }, 30);
      });
    });
  }

  render();
})();
