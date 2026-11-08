/* PakkBevis UI: DOM code, calls only PB. All visible text comes from I18N (t()). */
(function () {
  'use strict';
  var PB = window.PB, I18N = window.I18N, V = window.PBViz, T = window.PBTests;
  var LANGS = ['NO', 'EN'];

  // ---------------------------------------------------------------- storage (R8)
  var mem = {};
  function sGet(k) {
    try { var v = window.localStorage.getItem(k); if (v !== null) return v; } catch (e) { /* blocked */ }
    return mem[k] === undefined ? null : mem[k];
  }
  function sSet(k, v) {
    mem[k] = v;
    try { window.localStorage.setItem(k, v); } catch (e) { /* blocked: memory fallback */ }
  }
  function jGet(k, dflt) { try { var v = JSON.parse(sGet(k)); return v && typeof v === 'object' ? v : dflt; } catch (e) { return dflt; } }

  // ----------------------------------------------------------------------- state
  var S = {
    lang: LANGS.indexOf(sGet('pakkbevis_lang')) >= 0 ? sGet('pakkbevis_lang') : 'NO',
    tab: 'pack', sel: 'O1001', custom: [], qOrder: null, pickSku: 'SKU01', pickQty: '1',
    queue: [], seq: 0, rng: PB.mulberry32(2026), auto: false, timer: null, qOpen: false, focusId: null, importOpen: false, importText: '', importErr: null, fresh: null,
    dims: jGet('pakkbevis_dims', {}), rejects: jGet('pakkbevis_rejects', {}),
    tnp: null, tnpManual: false, dimIn: { L: '', W: '', H: '' }, dimErr: false,
    layer: {}, ticks: {}, okKey: null, learnMsg: null, scanVal: '', scanMsg: null, scanTimer: null,
    mgr: { status: 'idle', best: null, progress: 0 }, mgrCache: {},
    st: { results: null, fuzz: false, running: false }
  };

  function coarse() { try { return window.matchMedia('(pointer:coarse)').matches; } catch (e) { return false; } }

  function t(key, p) {
    var s = (I18N[S.lang] && I18N[S.lang][key]);
    if (s === undefined) s = I18N.NO[key] !== undefined ? I18N.NO[key] : key;
    if (p) for (var k in p) s = s.split('{' + k + '}').join(String(p[k]));
    return s;
  }
  function f(x, d) {
    var s = (Math.round(x * Math.pow(10, d === undefined ? 1 : d)) / Math.pow(10, d === undefined ? 1 : d)).toFixed(d === undefined ? 1 : d);
    return S.lang === 'EN' ? s : s.replace('.', ',');
  }
  function itemName(id) {
    var it = PB.getItem(id, {});
    return it ? (S.lang === 'NO' ? it.no : it.en) : id;
  }
  function boxLabel(b) { var k = 'box.' + b.id; return b.id + ' ' + (I18N[S.lang][k] || b.name); }
  function boxSize(b) { return b.L + '×' + b.W + '×' + b.H; }

  // -------------------------------------------------------------------------- DOM
  function h(tag, a, kids) {
    var e = document.createElement(tag), k;
    a = a || {};
    for (k in a) {
      if (k === 'text') e.textContent = a[k];
      else if (k === 'class') e.className = a[k];
      else if (k.indexOf('on') === 0 || k === 'value' || k === 'checked' || k === 'disabled' || k === 'open') e[k] = a[k];
      else e.setAttribute(k, a[k]);
    }
    (kids || []).forEach(function (c) { if (c === null || c === undefined || c === false) return; e.appendChild(typeof c === 'string' ? document.createTextNode(c) : c); });
    return e;
  }
  function btn(key, cls, on, extra) {
    var a = { type: 'button', text: t(key), onclick: on };
    if (cls) a['class'] = cls;
    if (extra) for (var k in extra) a[k] = extra[k];
    return h('button', a);
  }
  function badge(state) {
    var c = state === 'GREEN_VERIFIED' ? 'green' : (state === 'RED_CANNOT_PACK' ? 'red' : 'amber');
    return h('span', { 'class': 'badge ' + c, text: t('state.' + state) });
  }
  function stateColor(state) { return state === 'GREEN_VERIFIED' ? 'green' : (state === 'RED_CANNOT_PACK' ? 'red' : 'amber'); }

  // ------------------------------------------------------------------ compute
  function curOrder() {
    if (S.sel === 'CUSTOM') return { id: 'CUSTOM', title: t('order.custom'), lines: S.custom };
    if (S.sel === 'Q' && S.qOrder) return { id: S.qOrder.id, title: S.qOrder.id, lines: S.qOrder.lines };
    var o = PB.getOrder(S.sel) || PB.ORDERS[0];
    return { id: o.id, title: o.id + ' – ' + t('order.' + o.id), lines: o.lines };
  }
  function dimsMap(lines) {
    var d = {}, k;
    for (k in S.dims) d[k] = { L: S.dims[k].L, W: S.dims[k].W, H: S.dims[k].H, estimated: !!S.dims[k].estimated, provisional: false };
    if (S.tnp) { var p = PB.tnpDims(S.tnp.tries); d[S.tnp.sku] = { L: p.L, W: p.W, H: p.H, provisional: true, estimated: true }; }
    return d;
  }
  function optsFor(lines) { return { dims: dimsMap(lines), margin: PB.marginFor(S.rejects, lines) }; }
  function unitsOf(lines) { var n = 0; lines.forEach(function (l) { n += l.qty; }); return n; }
  function persistDims() { sSet('pakkbevis_dims', JSON.stringify(S.dims)); }
  function persistRejects() { sSet('pakkbevis_rejects', JSON.stringify(S.rejects)); }

  // --------------------------------------------------------------------- render
  var root = null;
  function render() {
    var ae = document.activeElement, fid = ae && ae.id ? ae.id : null, ss = null, se = null;
    try { if (ae && ae.selectionStart !== undefined) { ss = ae.selectionStart; se = ae.selectionEnd; } } catch (e) { /* non-text input */ }
    var hgt = root.offsetHeight;
    root.style.minHeight = hgt + 'px';
    root.replaceChildren.apply(root, build());
    root.style.minHeight = '';
    if (!fid && S.focusId) fid = S.focusId;
    S.focusId = null;
    if (fid) {
      var n = document.getElementById(fid);
      if (n) { n.focus(); try { if (ss !== null && n.setSelectionRange) n.setSelectionRange(ss, se); } catch (e2) { /* ignore */ } }
    }
    document.documentElement.lang = S.lang === 'EN' ? 'en' : 'nb';
  }

  function build() {
    var out = [];
    out.push(h('header', { 'class': 'top' }, [
      h('div', {}, [h('h1', { text: 'PakkBevis' }), h('p', { 'class': 'tag', text: t('app.tagline') })]),
      h('div', { 'class': 'langs', role: 'group', 'aria-label': t('lang.label') }, LANGS.map(function (l) {
        return h('button', { type: 'button', 'class': 'lang', text: l, 'aria-pressed': String(S.lang === l), onclick: function () { S.lang = l; sSet('pakkbevis_lang', l); render(); } });
      }))
    ]));
    out.push(h('nav', { 'class': 'tabs', role: 'tablist' }, ['pack', 'leader', 'selftest'].map(function (k) {
      return h('button', { type: 'button', 'class': 'tab', role: 'tab', text: t('tab.' + k), 'aria-selected': String(S.tab === k),
        onclick: function () { S.tab = k; if (k === 'pack' && !coarse()) S.focusId = 'scan'; render(); if (k === 'leader' && S.mgr.status === 'idle') runFinder(); } });
    })));
    out.push(h('main', { 'class': 'view-' + S.tab }, S.tab === 'pack' ? viewPack() : S.tab === 'leader' ? viewLeader() : viewSelftest()));
    out.push(assumptions());
    out.push(h('footer', {}, [h('p', { text: t('footer.testdata') })]));
    return out;
  }

  function assumptions() {
    var keys = ['as.fragile', 'as.filler', 'as.outer', 'as.charge', 'as.freight', 'as.total', 'as.base', 'as.units'];
    return h('details', { 'class': 'card' }, [
      h('summary', {}, [t('as.title'), h('span', { 'class': 'tag-test', text: t('as.badge') })]),
      h('ul', { 'class': 'clean' }, keys.map(function (k) { return h('li', { text: t(k) }); })),
      btn('learn.reset', 'danger', resetLearning)
    ]);
  }

  // ------------------------------------------------------------------ worker view
  function viewPack() {
    var op = orderPanel(), body = [], o = curOrder();
    if (!o.lines.length) body.push(h('div', { 'class': 'card' }, [h('p', { text: t('order.empty') })]));
    else {
      var opts = optsFor(o.lines), s2 = PB.solve(o.lines, opts), rec = s2.rec;
      if (rec.state === 'AMBER_MISSING_DIMS') body.push(missingCards(rec));
      else {
        if (S.tnp) body.push(tnpCard());
        if (s2.state === 'RED_CANNOT_PACK') {
          body.push(h('div', { 'class': 'card red' }, [h('div', { 'class': 'head' }, [badge('RED_CANNOT_PACK')]), h('p', { text: t('split.cannot') })]));
        } else if (s2.state === 'NEEDS_SPLIT') {
          body.push(h('div', { 'class': 'card amber' }, [
            h('div', { 'class': 'head' }, [h('h2', { text: t('split.title') }), badge('NEEDS_SPLIT')]),
            h('p', { 'class': 'boxname', text: t('split.summary', { n: s2.split.parcelCount, t: f(s2.split.totalCost) }) })
          ]));
          s2.split.parcels.forEach(function (p, i) {
            body.push(resultCard(p.rec, p.lines, opts, o.id + '-p' + i, t('split.parcel', { n: i + 1 }) + ' · ' + p.lines.map(function (l) { return l.qty + '× ' + itemName(l.sku); }).join(', ')));
          });
          body.push(actionBar(o.lines));
        } else {
          body.push(resultCard(rec, o.lines, opts, o.id, t('result.title')));
          if (!S.tnp) body.push(actionBar(o.lines));
        }
      }
    }
    return [op.top].concat(body, [op.lines, queuePanel()]);
  }

  function orderPanel() {
    var o = curOrder(), sel = h('select', { id: 'orderSel', onchange: function () {
      S.sel = this.value; S.tnp = null; S.tnpManual = false; S.learnMsg = null; S.okKey = null; render();
    } });
    PB.ORDERS.forEach(function (d) { sel.appendChild(h('option', { value: d.id, text: d.id + ' – ' + t('order.' + d.id) })); });
    sel.appendChild(h('option', { value: 'CUSTOM', text: t('order.custom') }));
    if (S.qOrder) sel.appendChild(h('option', { value: 'Q', text: S.qOrder.id + ' (' + t('order.queued') + ')' }));
    sel.value = S.sel;
    var lines = h('ul', { 'class': 'clean' }, o.lines.map(function (l, i) {
      var it = PB.getItem(l.sku, { dims: dimsMap(o.lines) });
      var row = [h('span', { text: l.qty + '× ' + itemName(l.sku) + ' ' }),
        it.dimsKnown ? h('span', { 'class': 'small', text: '(' + f(it.L) + '×' + f(it.W) + '×' + f(it.H) + ' ' + t('unit.cm') + (it.estimated ? ', ' + t('dims.estimated') : '') + ')' }) : h('strong', { 'class': 'save', text: t('item.unknown') }),
        it.fragile ? h('strong', { 'class': 'warn', text: t('item.fragile') }) : null];
      if (S.sel === 'CUSTOM') row.push(h('button', { type: 'button', text: t('custom.remove'), onclick: function () { S.custom.splice(i, 1); render(); } }));
      return h('li', {}, row);
    }));
    var inner = [lines];
    if (S.sel === 'CUSTOM') inner.push(customBuilder());
    return {
      top: h('div', { 'class': 'card topcard' }, [h('div', { 'class': 'row toprow' }, [
        h('div', {}, [h('label', { 'for': 'orderSel', text: t('order.label') }), sel]), scanner()])]),
      lines: h('details', { 'class': 'card', open: S.sel === 'CUSTOM' }, [
        h('summary', { text: t('order.lines') + ' (' + t('order.units', { n: unitsOf(o.lines) }) + ')' })].concat(inner))
    };
  }

  function customBuilder() {
    var pick = h('select', { id: 'pickSku', onchange: function () { S.pickSku = this.value; } });
    PB.ITEMS.forEach(function (it) { pick.appendChild(h('option', { value: it.id, text: it.id + ' ' + itemName(it.id) })); });
    pick.value = S.pickSku;
    var qty = h('input', { id: 'pickQty', type: 'number', min: 1, max: 20, step: 1, value: S.pickQty, oninput: function () { S.pickQty = this.value; } });
    var msg = S.scanMsg && S.scanMsg.custom ? h('p', { 'class': 'msg err', role: 'alert', text: t('custom.max') }) : null;
    return h('div', {}, [h('div', { 'class': 'row' }, [
      h('div', {}, [h('label', { 'for': 'pickSku', text: t('custom.pick') }), pick]),
      h('div', {}, [h('label', { 'for': 'pickQty', text: t('custom.qty') }), qty]),
      btn('custom.add', 'primary', function () {
        var q = parseInt(S.pickQty, 10);
        if (!(q >= 1 && q <= 20)) q = 1;
        if (!addCustom(S.pickSku, q)) S.scanMsg = { custom: true };
        else S.scanMsg = null;
        render();
      }),
      btn('custom.clear', 'danger', function () { S.custom = []; S.scanMsg = null; render(); })
    ]), msg]);
  }
  function addCustom(sku, q) {
    if (unitsOf(S.custom) + q > PB.ASSUMPTIONS.maxUnitsPerOrder) return false;
    var f1 = S.custom.filter(function (l) { return l.sku === sku; })[0];
    if (f1) { if (f1.qty + q > PB.ASSUMPTIONS.maxQtyPerLine) return false; f1.qty += q; } else S.custom.push({ sku: sku, qty: q });
    return true;
  }

  function scanner() {
    var inp = h('input', { id: 'scan', type: 'text', inputmode: 'numeric', autocomplete: 'off', autocapitalize: 'characters', spellcheck: false,
      value: S.scanVal, 'aria-describedby': 'scanHint',
      oninput: function () { S.scanVal = this.value; },
      onkeydown: function (ev) {
        if (ev.key !== 'Enter') return;
        ev.preventDefault();
        var code = this.value, item = PB.findItemByCode(code);
        S.scanVal = '';
        if (!item) S.scanMsg = { err: true, text: t('scan.unknown', { code: String(code).trim() || '?' }) };
        else if (!addCustom(item.id, 1)) S.scanMsg = { err: true, text: t('scan.full') };
        else { S.sel = 'CUSTOM'; S.tnp = null; S.scanMsg = { err: false, text: t('scan.ok', { item: itemName(item.id) }) }; }
        clearTimeout(S.scanTimer);
        var mine = S.scanMsg;
        S.scanTimer = setTimeout(function () { if (S.scanMsg === mine) { S.scanMsg = null; render(); } }, 3000);
        render();
      } });
    var m = S.scanMsg && S.scanMsg.text ? h('p', { 'class': 'msg ' + (S.scanMsg.err ? 'err' : 'ok'), role: 'status', text: S.scanMsg.text }) : null;
    return h('div', {}, [h('label', { 'for': 'scan', text: t('scan.label') }), inp,
      h('p', { id: 'scanHint', 'class': 'small', text: t('scan.hint') }), m]);
  }

  // --------------------------------------------------------------- live queue
  function timeNow() { var d = new Date(), p = function (n) { return (n < 10 ? '0' : '') + n; }; return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds()); }
  function pushOrder(id, lines) {
    S.queue = PB.queueAdd(S.queue, { id: id, lines: lines, ts: timeNow() });
    S.fresh = id;
  }
  function setAuto(on) {
    S.auto = on;
    if (S.timer) { clearInterval(S.timer); S.timer = null; }
    if (on) S.timer = setInterval(function () { var o = PB.randomOrder(S.rng, ++S.seq); pushOrder(o.id, o.lines); render(); }, 6000);
  }
  function queuePanel() {
    var list = S.queue.length ? h('ul', { 'class': 'clean queue' }, S.queue.map(function (q) {
      return h('li', {}, [h('button', { type: 'button', 'class': 'qi' + (q.id === S.fresh ? ' fresh' : ''),
        text: t('q.item', { id: q.id, t: q.ts, n: unitsOf(q.lines) }),
        onclick: function () { S.sel = 'Q'; S.qOrder = q; S.tnp = null; S.tnpManual = false; S.learnMsg = null; S.okKey = null; render(); } })]);
    })) : h('p', { text: t('q.empty') });
    var imp = null;
    if (S.importOpen) {
      var ta = h('textarea', { id: 'importTa', spellcheck: false, value: S.importText, oninput: function () { S.importText = this.value; } });
      imp = h('div', {}, [h('label', { 'for': 'importTa', text: t('q.json') }), ta,
        h('div', { 'class': 'row', style: 'margin-top:8px' }, [btn('q.add', 'primary', function () {
          var r = PB.fromHolioOrder(S.importText);
          if (r.ok) { pushOrder(r.orderId, r.lines); S.importErr = null; S.importText = ''; S.importOpen = false; S.importMsg = t('q.added', { id: r.orderId }); }
          else S.importErr = r.errors;
          render();
        })]),
        S.importErr ? h('ul', { 'class': 'msg err', role: 'alert' }, S.importErr.map(function (e) { return h('li', { text: t('err.' + e.code, { d: e.detail }) }); })) : null]);
    }
    return h('details', { 'class': 'card queue', open: S.qOpen, ontoggle: function () { S.qOpen = this.open; } }, [
      h('summary', { text: t('q.title') + ' (' + S.queue.length + ')' }),
      h('p', { 'class': 'small', text: t('q.note') }),
      h('div', { 'class': 'row' }, [
        btn('q.new', 'primary', function () { S.importMsg = null; var o = PB.randomOrder(S.rng, ++S.seq); pushOrder(o.id, o.lines); render(); }),
        btn(S.auto ? 'q.autoOn' : 'q.autoOff', '', function () { setAuto(!S.auto); render(); }, { 'aria-pressed': String(S.auto) }),
        btn('q.import', '', function () { S.importOpen = !S.importOpen; S.importErr = null; render(); }, { 'aria-expanded': String(S.importOpen) })
      ]),
      S.importMsg ? h('p', { 'class': 'msg ok', role: 'status', text: S.importMsg }) : null,
      imp, h('p', { 'class': 'small', text: t('q.count', { n: S.queue.length }) }), list]);
  }

  // ---------------------------------------------------------- missing dimensions
  function missingCards(rec) {
    var out = [];
    rec.missing.forEach(function (id) {
      var kids = [h('div', { 'class': 'head' }, [h('h2', { text: t('dims.missing', { item: itemName(id) }) }), badge('AMBER_MISSING_DIMS')])];
      if (S.tnpManual) kids.push(h('p', { 'class': 'msg err', role: 'alert', text: t('dims.tnpManual') }));
      kids.push(h('h3', { text: t('dims.enter') }));
      function save() {
        var v = PB.validateDims(S.dimIn.L, S.dimIn.W, S.dimIn.H);
        if (!v.ok) { S.dimErr = true; render(); return; }
        S.dims[id] = { L: v.L, W: v.W, H: v.H, estimated: false }; persistDims();
        S.dimErr = false; S.tnpManual = false; S.dimIn = { L: '', W: '', H: '' }; render();
      }
      var ae = document.activeElement;
      if (!(ae && ae.id && ae.id.indexOf('dim') === 0)) S.focusId = 'dimL';
      var row = ['L', 'W', 'H'].map(function (a) {
        return h('div', {}, [h('label', { 'for': 'dim' + a, text: t('dims.' + a) }),
          h('input', { id: 'dim' + a, type: 'number', min: 0, step: 'any', inputmode: 'decimal', value: S.dimIn[a], oninput: function () { S.dimIn[a] = this.value; },
          onkeydown: function (ev) { if (ev.key === 'Enter') { ev.preventDefault(); S.dimIn[a] = this.value; save(); } } })]);
      });
      row.push(btn('dims.save', 'primary', save));
      kids.push(h('div', { 'class': 'row dims-row' }, row));
      if (S.dimErr) kids.push(h('p', { 'class': 'msg err', role: 'alert', text: t('dims.invalid') }));
      kids.push(h('h3', { text: t('dims.tnp'), style: 'margin-top:12px' }));
      kids.push(btn('dims.tnpStart', '', function () { S.tnp = { sku: id, tries: 0 }; S.tnpManual = false; render(); }));
      out.push(h('div', { 'class': 'card amber' }, kids));
    });
    return h('div', {}, out);
  }
  function tnpCard() {
    var p = PB.tnpDims(S.tnp.tries);
    return h('div', { 'class': 'card amber' }, [
      h('div', { 'class': 'head' }, [h('h2', { text: t('dims.tnp') }), badge('AMBER_PROVISIONAL')]),
      h('p', { text: t('dims.tnpTry', { n: S.tnp.tries + 1, dims: p.L + '×' + p.W + '×' + p.H }) }),
      h('div', { 'class': 'row' }, [
        btn('btn.fit', 'primary', function () {
          S.dims[S.tnp.sku] = { L: p.L, W: p.W, H: p.H, estimated: true }; persistDims(); S.tnp = null; render();
        }),
        btn('btn.nofit', 'danger', function () {
          S.tnp.tries++;
          if (S.tnp.tries >= PB.TNP.maxTries) { S.tnp = null; S.tnpManual = true; }
          render();
        }),
        btn('dims.cancel', '', function () { S.tnp = null; render(); })
      ])
    ]);
  }

  // ---------------------------------------------------------------- result card
  function resultCard(rec, lines, opts, key, title) {
    var r = rec.recommended, m = r.metrics, box = r.box;
    var big = [['result.total', f(m.totalCost) + ' NOK', ''], ['result.chargeable', f(m.chargeableKg) + ' ' + t('unit.kg'), ''], ['result.air', f(m.airPct) + ' %', '']];
    var small = [['result.freight', f(m.freightNOK, 0) + ' NOK'], ['result.filler', f(m.fillerLitres) + ' ' + t('unit.l')]];
    var kids = [h('div', { 'class': 'head' }, [h('h2', { text: title }), badge(rec.state)]),
      h('div', { 'class': 'boxname hero', text: boxLabel(box) }),
      h('p', { 'class': 'boxsize', text: boxSize(box) + ' ' + t('unit.cm') })];
    if (rec.state === 'GREEN_VERIFIED') kids.push(h('p', { 'class': 'packer ' + (S.okKey === key ? 'done' : 'wait'), role: 'status',
      text: S.okKey === key ? t('packer.done') : t('packer.wait') }));
    if (rec.savingsNOK !== null && rec.savingsNOK > 0) kids.push(h('div', { 'class': 'savebar' }, [
      h('strong', { text: t('result.savings') + ': ' + f(rec.savingsNOK) + ' NOK (' + f(rec.savingsPct) + ' %)' }),
      h('span', { text: t('result.airBeforeAfter') + ': ' + f(rec.airBefore) + ' % → ' + f(rec.airAfter) + ' %' })]));
    kids.push(h('dl', { 'class': 'm big' }, big.map(function (d) { return h('div', {}, [h('dt', { text: t(d[0]) }), h('dd', { text: d[1] })]); })));
    kids.push(h('p', { 'class': 'small', text: small.map(function (d) { return t(d[0]) + ' ' + d[1]; }).join(' · ') }));
    if (rec.savingsNOK === null) kids.push(h('p', { 'class': 'small', text: t('result.noBaseline') }));
    if (rec.margin > 0) kids.push(h('p', { 'class': 'msg', text: t('result.margin', { n: f(rec.margin) }) }));
    if (rec.state === 'AMBER_PROVISIONAL' && !S.tnp) kids.push(h('p', { 'class': 'msg err', text: t('dims.provisional') }));
    kids.push(h('div', { 'class': 'result-grid' }, [
      h('div', { 'class': 'result-main' }, [stepsBlock(r, rec, opts, key)]),
      h('div', { 'class': 'result-side' }, [
        proofBlock(r),
        vizBlock(r, key),
        h('details', { 'class': 'more' }, [h('summary', { text: t('why.title') }),
          h('p', { 'class': 'small', text: t('viz.iso') }), V.iso(r.box, r.placements, t('viz.aria')), whyBlock(rec)])])
    ]));
    return h('div', { 'class': 'card ' + stateColor(rec.state) }, kids);
  }

  function proofBlock(r) {
    var order = ['bounds', 'overlap', 'items', 'orientation', 'weight', 'fragile'], c = r.verify.checks;
    return h('div', {}, [h('h3', { text: t('proof.title') }),
      h('ul', { 'class': 'chips proof' }, order.map(function (k) { return h('li', { text: (c[k] ? '✓ ' : '✗ ') + t('proof.' + k) }); }))]);
  }

  function vizBlock(r, key) {
    var zs = PB.layerZs(r.placements), idx = Math.min(S.layer[key] || 0, zs.length - 1);
    var tabs = h('div', { 'class': 'layers', role: 'group', 'aria-label': t('viz.top') }, zs.map(function (z, i) {
      return h('button', { type: 'button', text: t('viz.layer', { n: i + 1 }), 'aria-pressed': String(i === idx), onclick: function () { S.layer[key] = i; render(); } });
    }));
    var ids = []; r.placements.forEach(function (p) { if (ids.indexOf(p.itemId) < 0) ids.push(p.itemId); });
    var legend = h('ul', { 'class': 'chips' }, ids.map(function (id) {
      var li = h('li', { text: V.label(id) + ' ' + itemName(id) }); li.style.borderLeft = '10px solid ' + V.colorOf(id); return li;
    }));
    return h('div', {}, [h('h3', { text: t('viz.title') }), tabs,
      h('p', { 'class': 'small', text: t('viz.top') + ' – ' + t('viz.layer', { n: idx + 1 }) }),
      V.topView(r.box, r.placements, zs[idx], t('viz.aria')),
      legend, h('p', { 'class': 'legend', text: t('viz.legendFragile') + ' · ' + t('viz.legendEmpty') })]);
  }

  function stepsBlock(r, rec, opts, key) {
    var steps = PB.packSteps(r.placements, { margin: rec.margin });
    var lis = [];
    steps.forEach(function (st) {
      var d = f(st.dims[0]) + '×' + f(st.dims[1]) + '×' + f(st.dims[2]) + (st.rotated ? ', ' + t('steps.rotated') : '');
      var tk = key + ':' + st.n;
      var txt = h('span', {}, [t('steps.item', { n: st.n, item: itemName(st.itemId), dims: d, pos: t('steps.pos', { x: f(st.x), y: f(st.y), z: st.layer }) })]);
      if (st.fragile) txt.appendChild(h('span', { 'class': 'warn', text: '⚠ ' + t('steps.fragile') }));
      var cb = h('input', { type: 'checkbox', checked: !!S.ticks[tk], 'aria-label': t('steps.tick') + ' ' + st.n,
        onchange: function () { S.ticks[tk] = this.checked; this.parentNode.classList.toggle('done', this.checked); } });
      lis.push(h('li', {}, [h('label', { 'class': 'step' + (S.ticks[tk] ? ' done' : '') }, [cb, txt])]));
    });
    if (r.metrics.fillerLitres > 0) lis.push(h('li', {}, [h('span', { 'class': 'step fill', text: t('steps.filler', { l: f(r.metrics.fillerLitres) }) })]));
    return h('div', {}, [h('h3', { text: t('steps.title') }), h('ol', { 'class': 'steps' }, lis)]);
  }

  function whyBlock(rec) {
    var r = rec.recommended, m = r.metrics, base = rec.baseline;
    var text = base ? t('why.text', { box: boxLabel(r.box), size: boxSize(r.box), total: f(m.totalCost), base: f(base.metrics.totalCost), airBefore: f(rec.airBefore), airAfter: f(rec.airAfter) })
      : t('why.textNoBase', { box: boxLabel(r.box), size: boxSize(r.box), total: f(m.totalCost), airAfter: f(rec.airAfter) });
    var kids = [h('p', { text: text })];
    if (rec.reasonCode === 'cheaper_freight_bracket') kids.push(h('p', { text: t('why.smallest', { box: boxLabel(rec.smallest.box), f1: f(rec.smallest.metrics.freightNOK, 0), f2: f(m.freightNOK, 0) }) }));
    kids.push(h('p', { 'class': 'small', text: t('why.verified') }));
    kids.push(h('h3', { text: t('why.rejected') }));
    kids.push(h('ul', { 'class': 'chips' }, rec.rejected.map(function (x) {
      return h('li', { text: x.boxId + ': ' + t('reason.' + x.reason) });
    })));
    return h('div', {}, kids);
  }

  function resetLearning() {
    S.rejects = {}; S.dims = {}; persistRejects(); persistDims(); S.tnp = null; S.tnpManual = false;
    S.learnMsg = { ok: true, text: t('learn.resetDone') }; S.mgrCache = {}; S.mgr = { status: 'idle', best: null, progress: 0 };
    render();
  }
  /* "Passet" = one tap: confirm and, for a queued order, remove it and open the next one. */
  function confirmFit() {
    S.learnMsg = { ok: true, text: t('learn.confirmed') };
    S.okKey = curOrder().id;
    if (S.sel === 'Q' && S.qOrder) {
      var i = -1;
      S.queue.forEach(function (q, k) { if (q.id === S.qOrder.id) i = k; });
      if (i >= 0) S.queue.splice(i, 1);
      var next = S.queue[i] || S.queue[i - 1] || null;
      if (next) S.qOrder = next; else { S.qOrder = null; S.sel = 'O1001'; }
    }
    render();
    window.scrollTo(0, 0);
  }
  function actionBar(lines) {
    var margin = PB.marginFor(S.rejects, lines);
    var kids = [h('div', { 'class': 'row' }, [
      btn('btn.fit', 'primary', confirmFit),
      btn('btn.nofit', 'danger', function () {
        S.rejects = PB.addReject(S.rejects, lines); persistRejects(); S.okKey = null;
        S.learnMsg = { ok: false }; render();
      })
    ])];
    var lm = S.learnMsg;
    if (lm) kids.push(h('p', { 'class': 'msg ok', role: 'status', text: lm.ok ? lm.text : t('learn.applied', { n: f(PB.marginFor(S.rejects, lines)) }) }));
    else if (margin > 0) kids.push(h('p', { 'class': 'msg ok', text: t('learn.applied', { n: f(margin) }) }));
    return h('div', { 'class': 'actionbar' }, kids);
  }

  // ------------------------------------------------------------------ manager view
  function managerRows() {
    return PB.ORDERS.map(function (o) {
      var opts = optsFor(o.lines), s = PB.solve(o.lines, opts), row = { id: o.id, s: s, lines: o.lines, opts: opts };
      if (s.state === 'AMBER_MISSING_DIMS') { row.status = 'AMBER_MISSING_DIMS'; return row; }
      if (s.state === 'RED_CANNOT_PACK') { row.status = 'RED_CANNOT_PACK'; return row; }
      var ps = s.state === 'NEEDS_SPLIT' ? s.split.parcels.map(function (p) { return p.rec; }) : [s.rec];
      var inner = 0, item = 0, kg = 0, fr = 0, tot = 0;
      ps.forEach(function (r) { var m = r.recommended.metrics; inner += m.innerVol; item += m.itemVol; kg += m.chargeableKg; fr += m.freightNOK; tot += m.totalCost; });
      row.box = ps.map(function (r) { return r.recommended.box.id; }).join('+');
      row.air = (inner - item) / inner * 100; row.kg = kg; row.fr = fr; row.tot = tot;
      row.sav = s.state === 'NEEDS_SPLIT' ? null : s.rec.savingsNOK;
      row.before = s.state === 'NEEDS_SPLIT' ? null : s.rec.airBefore;
      row.status = s.state === 'NEEDS_SPLIT' ? (s.split.provisional ? 'AMBER_PROVISIONAL' : 'GREEN_VERIFIED') : s.rec.state;
      row.split = s.state === 'NEEDS_SPLIT';
      return row;
    });
  }

  function viewLeader() {
    var rows = managerRows(), tk = 0, tf = 0, tt = 0, ts = 0;
    var body = rows.map(function (r) {
      var dash = '–';
      if (r.box === undefined) {
        return h('tr', {}, [h('td', { text: r.id }), h('td', { text: dash }), h('td', { text: dash }), h('td', { text: dash }), h('td', { text: dash }), h('td', { text: dash }), h('td', { text: dash }), h('td', {}, [badge(r.status)])]);
      }
      tk += r.kg; tf += r.fr; tt += r.tot; if (r.sav !== null) ts += r.sav;
      return h('tr', {}, [h('td', { text: r.id }), h('td', { text: r.split ? t('result.parcels', { n: r.s.split.parcelCount }) + ' (' + r.box + ')' : r.box }),
        h('td', { text: f(r.air) }), h('td', { text: f(r.kg) }), h('td', { text: f(r.fr, 0) }), h('td', { text: f(r.tot) }),
        h('td', { text: r.sav === null ? dash : f(r.sav), 'class': r.sav > 0 ? 'save' : '' }), h('td', {}, [badge(r.status)])]);
    });
    var heads = ['col.order', 'col.box', 'col.air', 'col.kg', 'col.freight', 'col.total', 'col.savings', 'col.status'];
    var table = h('div', { 'class': 'tablewrap' }, [h('table', {}, [
      h('thead', {}, [h('tr', {}, heads.map(function (k) { return h('th', { scope: 'col', text: t(k) }); }))]),
      h('tbody', {}, body),
      h('tfoot', {}, [h('tr', {}, [h('td', { text: t('mgr.totals') }), h('td', { text: '' }), h('td', { text: '' }), h('td', { text: f(tk) }), h('td', { text: f(tf, 0) }), h('td', { text: f(tt) }), h('td', { text: f(ts) }), h('td', { text: '' })])])
    ])]);
    var chartRows = rows.filter(function (r) { return r.box !== undefined; }).map(function (r) { return { label: r.id, before: r.before === undefined ? null : r.before, after: r.air }; });
    var hl = PB.headline(rows.map(function (r) { return r.s; }));
    return [hl.n ? h('div', { 'class': 'card green mgr-head' }, [h('p', { 'class': 'boxname save', role: 'status',
        text: t('mgr.headline', { nok: f(hl.nok), l: f(hl.litres), n: hl.n }) })]) : null,
      h('div', { 'class': 'card mgr-table' }, [h('h2', { text: t('mgr.title') }), table]),
      h('div', { 'class': 'card mgr-chart' }, [h('h2', { text: t('mgr.chart') }), V.bars(chartRows, { before: t('chart.before'), after: t('chart.after') }, t('mgr.chart'))]),
      finderCard()];
  }

  function finderCard() {
    var m = S.mgr, kids = [h('h2', { text: t('mgr.finder') }), h('p', { 'class': 'small', text: t('mgr.finderHelp') })];
    if (m.status === 'running') kids.push(h('p', { 'class': 'msg', role: 'status', text: t('mgr.calc') + ' ' + Math.round(m.progress * 100) + ' %' }));
    else if (m.status === 'done') {
      if (m.best) kids.push(h('p', { 'class': 'msg ok', role: 'status', text: t('mgr.suggest', { dims: m.best.cand.L + '×' + m.best.cand.W + '×' + m.best.cand.H, nok: f(m.best.savings), l: f(m.best.litres), n: m.best.n }) }));
      else kids.push(h('p', { 'class': 'msg', role: 'status', text: t('mgr.none') }));
    }
    kids.push(btn('mgr.run', 'primary', function () { runFinder(); }, m.status === 'running' ? { disabled: true } : null));
    kids.push(h('p', { 'class': 'small', text: t('mgr.skipped') }));
    return h('div', { 'class': 'card mgr-finder' }, kids);
  }

  function runFinder() {
    var rows = managerRows(), base = [], sig = JSON.stringify([S.dims, S.rejects]);
    rows.forEach(function (r) {
      var tt = PB.solveTotals(r.s);
      if (r.s.state !== 'AMBER_MISSING_DIMS' && tt && r.s.rec.state !== 'AMBER_PROVISIONAL') base.push({ id: r.id, lines: r.lines, opts: r.opts, total: tt.total, litres: tt.litres });
    });
    var cands = PB.candidateBoxes(), i = 0, best = null, t0 = Date.now(), chunk = 10;
    S.mgr = { status: 'running', best: null, progress: 0 };
    render();
    (function step() {
      var end = Math.min(cands.length, i + chunk);
      for (; i < end; i++) {
        var c = cands[i], tot = { savings: 0, litres: 0, n: 0 };
        base.forEach(function (b) {
          var key = sig + '|' + b.id + '|' + c.id, hit = S.mgrCache[key];
          if (!hit) {
            var r = PB.evalCandidate(c, [b]);
            hit = S.mgrCache[key] = r;
          }
          tot.savings += hit.savings; tot.litres += hit.litres; tot.n += hit.n;
        });
        if (tot.savings > 1e-9 && (!best || tot.savings > best.savings + 1e-9 || (Math.abs(tot.savings - best.savings) <= 1e-9 && c.L * c.W * c.H < best.cand.L * best.cand.W * best.cand.H))) {
          best = { cand: c, savings: tot.savings, litres: tot.litres, n: tot.n };
        }
      }
      if (i < cands.length) { S.mgr.progress = i / cands.length; if (S.tab === 'leader') render(); setTimeout(step, 0); }
      else {
        S.mgr = { status: 'done', best: best, progress: 1 };
        window.__pbFinderMs = Date.now() - t0;
        if (S.tab === 'leader') render();
      }
    })();
  }

  // ----------------------------------------------------------------- self-test
  function runTests(heavy) {
    S.st.running = true; render();
    setTimeout(function () {
      S.st.results = T.run(PB, I18N, { heavy: heavy }); S.st.fuzz = heavy; S.st.running = false; render();
    }, 30);
  }
  function viewSelftest() {
    var res = S.st.results || [], pass = res.filter(function (r) { return r.pass; }).length;
    var allOk = res.length > 0 && pass === res.length;
    var kids = [h('h2', { text: t('st.title') }),
      h('p', { id: 'stSummary', 'class': 'msg ' + (allOk ? 'ok' : 'err'), role: 'status', text: t('st.summary', { p: pass, t: res.length }) }),
      S.st.fuzz ? null : h('p', { 'class': 'small', text: t('st.fuzzPending') }),
      h('div', { 'class': 'row' }, [
        btn('st.run', '', function () { runTests(S.st.fuzz); }, S.st.running ? { disabled: true } : null),
        btn('st.runFuzz', 'primary', function () { runTests(true); }, S.st.running ? { disabled: true } : null)]),
      S.st.running ? h('p', { 'class': 'msg', text: t('st.running') }) : null,
      h('ul', { 'class': 'clean', id: 'stList' }, res.map(function (r) {
        return h('li', {}, [h('span', { 'class': r.pass ? 'st-ok' : 'st-fail', text: (r.pass ? t('st.pass') : t('st.fail')) + ' ' }),
          h('span', { text: r.id + ' ' + r.name + ' (' + Math.round(r.ms) + ' ms)' }), r.pass ? null : h('div', { 'class': 'small', text: r.msg })]);
      }))];
    return [h('div', { 'class': 'card' }, kids)];
  }

  // ------------------------------------------------------------------- start
  function init() {
    root = document.getElementById('app');
    S.st.results = T.run(PB, I18N, { heavy: false });
    window.__pb = { S: S, render: render };
    if (!coarse()) S.focusId = 'scan';
    render();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
