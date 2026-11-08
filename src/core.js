/* PakkBevis core: pure functions only, NO DOM access.
 * Sections: DATA, ENGINE, VERIFIER, COST, RECOMMEND, SPLIT, LEARNING, IMPORT, QUEUE
 */
(function (root) {
  'use strict';
  var PB = {};
  var EPS = 1e-9;

  // ===================================================================== DATA
  PB.ASSUMPTIONS = {
    fragilePad: 1.0,      // cm added on every axis of a fragile item
    fillerRate: 0.12,     // NOK per litre of empty space
    outerAdd: 1.0,        // cm added to inner dims per axis -> outer dims
    volDivisor: 5000,     // volumetric kg = outer cm3 / 5000
    maxKg: 25,            // above this: unsupported
    brackets: [[1, 49], [2, 59], [5, 79], [10, 119], [15, 159], [25, 219]],
    maxUnitsPerOrder: 30,
    maxQtyPerLine: 20,
    maxParcels: 4,
    baselineBox: 'B5'
  };

  PB.ITEMS = [
    { id: 'SKU01', no: 'T-skjorte brettet', en: 'Folded T-shirt', L: 28, W: 22, H: 3, kg: 0.20, fragile: false, ean: '7000000000011', dimsKnown: true },
    { id: 'SKU02', no: 'Genser', en: 'Sweater', L: 32, W: 26, H: 6, kg: 0.45, fragile: false, ean: '7000000000028', dimsKnown: true },
    { id: 'SKU03', no: 'Joggesko (eske)', en: 'Running shoes (box)', L: 33, W: 22, H: 12, kg: 0.90, fragile: false, ean: '7000000000035', dimsKnown: true },
    { id: 'SKU04', no: 'Vannflaske', en: 'Water bottle', L: 26, W: 8, H: 8, kg: 0.35, fragile: false, ean: '7000000000042', dimsKnown: true },
    { id: 'SKU05', no: 'Krus (keramikk)', en: 'Ceramic mug', L: 12, W: 12, H: 11, kg: 0.40, fragile: true, ean: '7000000000059', dimsKnown: true },
    { id: 'SKU06', no: 'Bok', en: 'Book', L: 24, W: 17, H: 3, kg: 0.50, fragile: false, ean: '7000000000066', dimsKnown: true },
    { id: 'SKU07', no: 'Lysestake glass', en: 'Glass candlestick', L: 10, W: 10, H: 20, kg: 0.60, fragile: true, ean: '7000000000073', dimsKnown: true },
    { id: 'SKU08', no: 'Hodetelefoner', en: 'Headphones', L: 20, W: 18, H: 8, kg: 0.30, fragile: true, ean: '7000000000080', dimsKnown: true },
    { id: 'SKU09', no: 'Ladekabel', en: 'Charging cable', L: 15, W: 10, H: 3, kg: 0.08, fragile: false, ean: '7000000000097', dimsKnown: true },
    { id: 'SKU10', no: 'Kaffepose', en: 'Coffee bag', L: 18, W: 10, H: 6, kg: 0.25, fragile: false, ean: '7000000000103', dimsKnown: true },
    { id: 'SKU11', no: 'Yogamatte rullet', en: 'Rolled yoga mat', L: 62, W: 12, H: 12, kg: 1.20, fragile: false, ean: '7000000000110', dimsKnown: true },
    { id: 'SKU12', no: 'Notatbok-sett', en: 'Notebook set', L: 21, W: 15, H: 5, kg: 0.45, fragile: false, ean: '7000000000127', dimsKnown: true },
    { id: 'SKU13', no: 'Hudkrem', en: 'Skin cream', L: 6, W: 6, H: 14, kg: 0.20, fragile: false, ean: '7000000000134', dimsKnown: true },
    { id: 'SKU14', no: 'Smarthøyttaler', en: 'Smart speaker', L: 22, W: 12, H: 12, kg: 0.95, fragile: true, ean: '7000000000141', dimsKnown: true },
    { id: 'SKU15', no: 'Skjerf (ukjent mål)', en: 'Scarf (unknown size)', L: null, W: null, H: null, kg: 0.18, fragile: false, ean: '7000000000158', dimsKnown: false }
  ];

  PB.BOXES = [
    { id: 'B1', name: 'Liten', L: 20, W: 15, H: 10, own: 0.08, maxLoad: 2, cost: 6 },
    { id: 'B2', name: 'Flat', L: 35, W: 25, H: 8, own: 0.12, maxLoad: 3, cost: 8 },
    { id: 'B3', name: 'Medium', L: 30, W: 22, H: 15, own: 0.15, maxLoad: 5, cost: 10 },
    { id: 'B4', name: 'Stor', L: 40, W: 30, H: 20, own: 0.25, maxLoad: 10, cost: 14 },
    { id: 'B5', name: 'Ekstra stor', L: 55, W: 40, H: 30, own: 0.45, maxLoad: 15, cost: 22 },
    { id: 'B6', name: 'Lang', L: 70, W: 20, H: 20, own: 0.30, maxLoad: 8, cost: 16 }
  ];

  // O1004 quantities were adjusted? see README/report; engine decides actual parcel count.
  PB.ORDERS = [
    { id: 'O1001', lines: [{ sku: 'SKU01', qty: 2 }, { sku: 'SKU09', qty: 1 }] },
    { id: 'O1002', lines: [{ sku: 'SKU03', qty: 1 }, { sku: 'SKU04', qty: 1 }, { sku: 'SKU06', qty: 1 }] },
    { id: 'O1003', lines: [{ sku: 'SKU05', qty: 2 }, { sku: 'SKU07', qty: 1 }, { sku: 'SKU08', qty: 1 }, { sku: 'SKU02', qty: 1 }] },
    { id: 'O1004', lines: [{ sku: 'SKU11', qty: 2 }, { sku: 'SKU03', qty: 3 }, { sku: 'SKU14', qty: 2 }, { sku: 'SKU12', qty: 4 }] },
    { id: 'O1005', lines: [{ sku: 'SKU13', qty: 1 }, { sku: 'SKU10', qty: 1 }] },
    { id: 'O1006', lines: [{ sku: 'SKU15', qty: 1 }, { sku: 'SKU01', qty: 1 }] }
  ];

  PB.getOrder = function (id) {
    for (var i = 0; i < PB.ORDERS.length; i++) if (PB.ORDERS[i].id === id) return PB.ORDERS[i];
    return null;
  };

  /* Resolve an item. opts.dims[id] = {L,W,H,estimated,provisional} overrides/confirms dims.
   * opts.extraItems[id] = full item object (used by tests). */
  PB.getItem = function (id, opts) {
    var base = null, i;
    if (opts && opts.extraItems && opts.extraItems[id]) base = opts.extraItems[id];
    else for (i = 0; i < PB.ITEMS.length; i++) if (PB.ITEMS[i].id === id) { base = PB.ITEMS[i]; break; }
    if (!base) return null;
    var item = { id: base.id, no: base.no, en: base.en, L: base.L, W: base.W, H: base.H, kg: base.kg,
      fragile: !!base.fragile, ean: base.ean, dimsKnown: !!base.dimsKnown, provisional: false, estimated: false };
    var ov = opts && opts.dims && opts.dims[id];
    if (ov && ov.L > 0 && ov.W > 0 && ov.H > 0) {
      item.L = ov.L; item.W = ov.W; item.H = ov.H; item.dimsKnown = true;
      item.provisional = !!ov.provisional; item.estimated = !!ov.estimated;
    }
    return item;
  };

  PB.findItemByCode = function (code) {
    var c = String(code == null ? '' : code).trim().toUpperCase();
    if (!c) return null;
    for (var i = 0; i < PB.ITEMS.length; i++) {
      if (PB.ITEMS[i].id.toUpperCase() === c || PB.ITEMS[i].ean === c) return PB.ITEMS[i];
    }
    return null;
  };

  PB.mulberry32 = function (a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };

  // merge duplicate lines, drop non-positive qty; keeps first-seen order
  function normLines(lines) {
    var out = [], idx = {};
    (lines || []).forEach(function (l) {
      if (!l || !(l.qty > 0)) return;
      if (idx[l.sku] === undefined) { idx[l.sku] = out.length; out.push({ sku: l.sku, qty: l.qty }); }
      else out[idx[l.sku]].qty += l.qty;
    });
    return out;
  }
  PB.normLines = normLines;

  // ================================================================== ENGINE
  function buildUnits(lines, opts) {
    var units = [], counters = {}, margin = (opts && opts.margin) > 0 ? opts.margin : 0;
    normLines(lines).forEach(function (l) {
      var item = PB.getItem(l.sku, opts);
      if (!item) throw new Error('unknown item ' + l.sku);
      for (var q = 0; q < l.qty; q++) {
        counters[l.sku] = (counters[l.sku] || 0);
        var d = [item.L + margin, item.W + margin, item.H + margin];
        if (item.fragile) d = d.map(function (v) { return v + PB.ASSUMPTIONS.fragilePad; });
        units.push({ itemId: l.sku, index: counters[l.sku]++, dims: d, weight: item.kg, fragile: item.fragile,
          vol: d[0] * d[1] * d[2], rawVol: item.L * item.W * item.H });
      }
    });
    return units;
  }

  function rotations(d) {
    var p = [[d[0], d[1], d[2]], [d[0], d[2], d[1]], [d[1], d[0], d[2]], [d[1], d[2], d[0]], [d[2], d[0], d[1]], [d[2], d[1], d[0]]];
    var seen = {}, out = [];
    p.forEach(function (r) { var k = r.join(','); if (!seen[k]) { seen[k] = 1; out.push(r); } });
    return out;
  }

  function fitsEmpty(box, dims) {
    return rotations(dims).some(function (r) { return r[0] <= box.L + EPS && r[1] <= box.W + EPS && r[2] <= box.H + EPS; });
  }

  function overlapDepth(a1, a2, b1, b2) { return Math.min(a2, b2) - Math.max(a1, b1); }

  function validAt(box, placed, x, y, z, r, fragile) {
    if (x + r[0] > box.L + EPS || y + r[1] > box.W + EPS || z + r[2] > box.H + EPS) return false;
    for (var i = 0; i < placed.length; i++) {
      var p = placed[i];
      var ox = overlapDepth(x, x + r[0], p.x, p.x + p.w);
      var oy = overlapDepth(y, y + r[1], p.y, p.y + p.d);
      if (ox <= EPS || oy <= EPS) continue;       // no footprint overlap -> no vertical or any overlap
      var oz = overlapDepth(z, z + r[2], p.z, p.z + p.h);
      if (oz > EPS) return false;                 // volumes intersect
      // fragile rule, both directions, footprints overlap here
      if (!fragile && p.fragile && z >= p.z + p.h - EPS) return false;   // non-fragile on/above fragile
      if (fragile && !p.fragile && p.z >= z + r[2] - EPS) return false;  // fragile placed under non-fragile
    }
    return true;
  }

  function tryStrategy(box, order) {
    var placed = [], cands = [[0, 0, 0]];
    for (var u = 0; u < order.length; u++) {
      var unit = order[u], rots = rotations(unit.dims), done = false;
      cands.sort(function (a, b) { return (a[2] - b[2]) || (a[1] - b[1]) || (a[0] - b[0]); });
      for (var c = 0; c < cands.length && !done; c++) {
        var cd = cands[c];
        for (var r = 0; r < rots.length; r++) {
          var rot = rots[r];
          if (validAt(box, placed, cd[0], cd[1], cd[2], rot, unit.fragile)) {
            var pl = { itemId: unit.itemId, index: unit.index, x: cd[0], y: cd[1], z: cd[2], w: rot[0], d: rot[1], h: rot[2],
              fragile: unit.fragile, weight: unit.weight,
              rotated: !(rot[0] === unit.dims[0] && rot[1] === unit.dims[1] && rot[2] === unit.dims[2]) };
            placed.push(pl);
            cands.splice(c, 1);
            var add = [[pl.x + pl.w, pl.y, pl.z], [pl.x, pl.y + pl.d, pl.z], [pl.x, pl.y, pl.z + pl.h]];
            add.forEach(function (n) {
              if (n[0] >= box.L - EPS || n[1] >= box.W - EPS || n[2] >= box.H - EPS) return;
              for (var k = 0; k < cands.length; k++) if (cands[k][0] === n[0] && cands[k][1] === n[1] && cands[k][2] === n[2]) return;
              cands.push(n);
            });
            done = true; break;
          }
        }
      }
      if (!done) return null;
    }
    return placed;
  }

  var STRATEGIES = [
    { name: 'volume', key: function (u) { return u.vol; } },
    { name: 'longest', key: function (u) { return Math.max(u.dims[0], u.dims[1], u.dims[2]); } },
    { name: 'weight', key: function (u) { return u.weight; } }
  ];

  PB.packInBox = function (box, orderLines, opts) {
    opts = opts || {};
    var units = buildUnits(orderLines, opts), i;
    for (i = 0; i < units.length; i++) {
      if (!fitsEmpty(box, units[i].dims)) return { ok: false, reason: 'item_too_large', placements: [], strategy: null };
    }
    var w = 0; units.forEach(function (u) { w += u.weight; });
    if (w > box.maxLoad + EPS) return { ok: false, reason: 'too_heavy', placements: [], strategy: null };
    var vol = 0; units.forEach(function (u) { vol += u.vol; });
    if (vol > box.L * box.W * box.H + EPS) return { ok: false, reason: 'does_not_fit', placements: [], strategy: null };
    for (var s = 0; s < STRATEGIES.length; s++) {
      var st = STRATEGIES[s];
      var order = units.slice().sort(function (a, b) {
        var d = st.key(b) - st.key(a);
        if (d !== 0) return d;
        if (a.itemId !== b.itemId) return a.itemId < b.itemId ? -1 : 1;
        return a.index - b.index;
      });
      var res = tryStrategy(box, order);
      if (res) return { ok: true, reason: null, placements: res, strategy: st.name };
    }
    // Extended deterministic search (only reached when the three base strategies fail).
    function cmpId(a, b) { return a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : a.index - b.index; }
    var extra = [
      ['solid-first', function (a, b) { return (a.fragile - b.fragile) || (b.vol - a.vol) || cmpId(a, b); }],
      ['fragile-first', function (a, b) { return (b.fragile - a.fragile) || (b.vol - a.vol) || cmpId(a, b); }],
      ['footprint', function (a, b) {
        function fp(u) { return u.vol / Math.min(u.dims[0], u.dims[1], u.dims[2]); }
        return (fp(b) - fp(a)) || cmpId(a, b);
      }],
      ['solid-weight', function (a, b) { return (a.fragile - b.fragile) || (b.weight - a.weight) || cmpId(a, b); }]
    ];
    for (var e = 0; e < extra.length; e++) {
      var r2 = tryStrategy(box, units.slice().sort(extra[e][1]));
      if (r2) return { ok: true, reason: null, placements: r2, strategy: extra[e][0] };
    }
    var restarts = opts.restarts === undefined ? 40 : opts.restarts;
    for (var k = 0; k < restarts; k++) {            // seeded shuffles: deterministic
      var rnd = PB.mulberry32(1000 + k), arr = units.slice(), j, t;
      for (j = arr.length - 1; j > 0; j--) { var m = Math.floor(rnd() * (j + 1)); t = arr[j]; arr[j] = arr[m]; arr[m] = t; }
      if (k % 2) arr = arr.map(function (u, i) { return { u: u, i: i }; })
        .sort(function (a, b) { return (a.u.fragile - b.u.fragile) || (a.i - b.i); }).map(function (x) { return x.u; });
      var r3 = tryStrategy(box, arr);
      if (r3) return { ok: true, reason: null, placements: r3, strategy: 'search' };
    }
    return { ok: false, reason: 'does_not_fit', placements: [], strategy: null };
  };

  // ================================================================ VERIFIER
  /* Written independently: shares no helper with the engine. Re-derives expected
   * item set, padded dims, weights and fragility from the ORIGINAL order lines. */
  PB.verifyPacking = function (box, placements, orderLines, opts) {
    var failures = [];
    var o = opts || {};
    var tol = 1e-7;
    var mg = (o.margin && o.margin > 0) ? o.margin : 0;
    var pad = PB.ASSUMPTIONS.fragilePad;

    // expected multiset and per-item data, derived from scratch
    var expect = {}, data = {}, order, li, q, found;
    for (li = 0; li < (orderLines || []).length; li++) {
      var ln = orderLines[li];
      if (!ln || !(ln.qty > 0)) continue;
      expect[ln.sku] = (expect[ln.sku] || 0) + ln.qty;
      if (!data[ln.sku]) {
        found = null;
        if (o.extraItems && o.extraItems[ln.sku]) found = o.extraItems[ln.sku];
        else for (q = 0; q < PB.ITEMS.length; q++) if (PB.ITEMS[q].id === ln.sku) found = PB.ITEMS[q];
        if (!found) { failures.push('unknown_item:' + ln.sku); continue; }
        var dm = [found.L, found.W, found.H];
        if (o.dims && o.dims[ln.sku] && o.dims[ln.sku].L > 0) dm = [o.dims[ln.sku].L, o.dims[ln.sku].W, o.dims[ln.sku].H];
        var fr = !!found.fragile;
        data[ln.sku] = { dims: dm.map(function (v) { return v + mg + (fr ? pad : 0); }), kg: found.kg, fragile: fr };
      }
    }
    var P = placements || [], i, j;

    // a) bounds
    for (i = 0; i < P.length; i++) {
      var a = P[i];
      if (a.x < -tol || a.y < -tol || a.z < -tol || a.x + a.w > box.L + tol || a.y + a.d > box.W + tol || a.z + a.h > box.H + tol) {
        failures.push('out_of_bounds:' + a.itemId + '#' + a.index);
      }
    }
    // b) pairwise overlap
    for (i = 0; i < P.length; i++) {
      for (j = i + 1; j < P.length; j++) {
        var A = P[i], B = P[j];
        var dx = Math.min(A.x + A.w, B.x + B.w) - Math.max(A.x, B.x);
        var dy = Math.min(A.y + A.d, B.y + B.d) - Math.max(A.y, B.y);
        var dz = Math.min(A.z + A.h, B.z + B.h) - Math.max(A.z, B.z);
        if (dx > tol && dy > tol && dz > tol) failures.push('overlap:' + A.itemId + '#' + A.index + '/' + B.itemId + '#' + B.index);
      }
    }
    // c) multiset
    var got = {};
    P.forEach(function (p) { got[p.itemId] = (got[p.itemId] || 0) + 1; });
    Object.keys(expect).forEach(function (k) {
      var diff = (got[k] || 0) - expect[k];
      if (diff < 0) failures.push('missing:' + k + 'x' + (-diff));
      if (diff > 0) failures.push('extra:' + k + 'x' + diff);
    });
    Object.keys(got).forEach(function (k) { if (!(k in expect)) failures.push('extra:' + k + 'x' + got[k]); });
    // d) dims are a permutation of padded dims
    P.forEach(function (p) {
      var dd = data[p.itemId];
      if (!dd) return;
      var e = dd.dims.slice().sort(function (m, n) { return m - n; });
      var g = [p.w, p.d, p.h].sort(function (m, n) { return m - n; });
      if (Math.abs(e[0] - g[0]) > tol || Math.abs(e[1] - g[1]) > tol || Math.abs(e[2] - g[2]) > tol) {
        failures.push('dims_mismatch:' + p.itemId + '#' + p.index);
      }
    });
    // e) weight
    var tw = 0;
    P.forEach(function (p) { if (data[p.itemId]) tw += data[p.itemId].kg; });
    if (tw > box.maxLoad + tol) failures.push('overweight:' + tw);
    // f) fragile support
    for (i = 0; i < P.length; i++) {
      for (j = 0; j < P.length; j++) {
        if (i === j) continue;
        var top = P[i], low = P[j];
        if (!data[top.itemId] || !data[low.itemId]) continue;
        if (data[top.itemId].fragile || !data[low.itemId].fragile) continue;
        var ox = Math.min(top.x + top.w, low.x + low.w) - Math.max(top.x, low.x);
        var oy = Math.min(top.y + top.d, low.y + low.d) - Math.max(top.y, low.y);
        if (ox > tol && oy > tol && Math.abs(top.z - (low.z + low.h)) < tol) {
          failures.push('on_fragile:' + top.itemId + '#' + top.index + '>' + low.itemId + '#' + low.index);
        }
      }
    }
    function clean(prefixes) { return !failures.some(function (f) { return prefixes.some(function (p) { return f.indexOf(p) === 0; }); }); }
    return { pass: failures.length === 0, failures: failures, checks: {
      bounds: clean(['out_of_bounds']), overlap: clean(['overlap']), items: clean(['missing', 'extra', 'unknown_item']),
      orientation: clean(['dims_mismatch']), weight: clean(['overweight']), fragile: clean(['on_fragile']) } };
  };

  // =================================================================== COST
  PB.freightFor = function (kg) {
    var b = PB.ASSUMPTIONS.brackets;
    for (var i = 0; i < b.length; i++) if (kg <= b[i][0]) return b[i][1];
    return null; // unsupported
  };
  PB.outerDims = function (box) { var a = PB.ASSUMPTIONS.outerAdd; return [box.L + a, box.W + a, box.H + a]; };
  PB.volumetricKg = function (box) {
    var o = PB.outerDims(box);
    return (o[0] * o[1] * o[2]) / PB.ASSUMPTIONS.volDivisor;
  };
  PB.chargeableKg = function (box, itemKg) { return Math.max(itemKg + box.own, PB.volumetricKg(box)); };
  PB.innerVolume = function (box) { return box.L * box.W * box.H; };

  PB.metrics = function (box, orderLines, opts) {
    var vol = 0, kg = 0;
    normLines(orderLines).forEach(function (l) {
      var it = PB.getItem(l.sku, opts);
      vol += it.L * it.W * it.H * l.qty;   // UNPADDED, no margin
      kg += it.kg * l.qty;
    });
    var inner = PB.innerVolume(box);
    var empty = inner - vol;
    var litres = empty / 1000;
    var fillerCost = litres * PB.ASSUMPTIONS.fillerRate;
    var actual = kg + box.own;
    var vkg = PB.volumetricKg(box);
    var charge = Math.max(actual, vkg);
    var freight = PB.freightFor(charge);
    return { itemVol: vol, innerVol: inner, airPct: (empty / inner) * 100, fillerLitres: litres, fillerCost: fillerCost,
      itemKg: kg, actualKg: actual, volKg: vkg, chargeableKg: charge, freightNOK: freight,
      boxCost: box.cost, totalCost: freight === null ? null : box.cost + fillerCost + freight };
  };

  // ============================================================== RECOMMEND
  function allBoxes(opts) { return PB.BOXES.concat((opts && opts.extraBoxes) || []); }

  function evalBox(box, lines, opts) {
    var pk = PB.packInBox(box, lines, opts);
    if (!pk.ok) return { box: box, ok: false, reason: pk.reason };
    var vf = PB.verifyPacking(box, pk.placements, lines, opts);
    if (!vf.pass) return { box: box, ok: false, reason: 'verify_failed', failures: vf.failures };
    var m = PB.metrics(box, lines, opts);
    if (m.freightNOK === null) return { box: box, ok: false, reason: 'unsupported_weight', metrics: m };
    return { box: box, ok: true, placements: pk.placements, strategy: pk.strategy, metrics: m, verify: vf };
  }

  PB.recommend = function (orderLines, opts) {
    opts = opts || {};
    var lines = normLines(orderLines);
    var res = { state: null, lines: lines, missing: [], provisional: [], tooLarge: [], recommended: null, smallest: null,
      reasonCode: null, baseline: null, savingsNOK: null, savingsPct: null, airBefore: null, airAfter: null,
      rejected: [], margin: opts.margin > 0 ? opts.margin : 0 };
    var li, item;
    for (li = 0; li < lines.length; li++) {
      item = PB.getItem(lines[li].sku, opts);
      if (!item) { res.state = 'RED_CANNOT_PACK'; res.tooLarge.push(lines[li].sku); return res; }
      if (!item.dimsKnown) res.missing.push(item.id);
      else if (item.provisional) res.provisional.push(item.id);
    }
    if (res.missing.length) { res.state = 'AMBER_MISSING_DIMS'; return res; }

    var boxes = allBoxes(opts);
    var units = buildUnits(lines, opts);
    var bad = {};
    units.forEach(function (u) {
      var any = boxes.some(function (b) { return fitsEmpty(b, u.dims); });
      if (!any) bad[u.itemId] = true;
    });
    res.tooLarge = Object.keys(bad);
    if (res.tooLarge.length) { res.state = 'RED_CANNOT_PACK'; return res; }

    var evals = boxes.map(function (b) { return evalBox(b, lines, opts); });
    var passing = evals.filter(function (e) { return e.ok; });
    if (!passing.length) {
      res.state = 'NEEDS_SPLIT';
      res.rejected = evals.map(function (e) { return { boxId: e.box.id, reason: e.reason }; });
      return res;
    }
    var best = null, smallest = null;
    passing.forEach(function (e) {
      var vol = PB.innerVolume(e.box);
      if (!best || e.metrics.totalCost < best.metrics.totalCost - EPS ||
          (Math.abs(e.metrics.totalCost - best.metrics.totalCost) <= EPS && vol < PB.innerVolume(best.box))) best = e;
      if (!smallest || vol < PB.innerVolume(smallest.box)) smallest = e;
    });
    res.recommended = best;
    res.smallest = smallest;
    if (smallest.box.id !== best.box.id) {
      res.reasonCode = smallest.metrics.freightNOK > best.metrics.freightNOK ? 'cheaper_freight_bracket' : 'lower_total_cost';
    }
    var base = null;
    passing.forEach(function (e) { if (e.box.id === PB.ASSUMPTIONS.baselineBox) base = e; });
    if (base) {
      res.baseline = base;
      res.savingsNOK = base.metrics.totalCost - best.metrics.totalCost;
      res.savingsPct = (res.savingsNOK / base.metrics.totalCost) * 100;
      res.airBefore = base.metrics.airPct;
    }
    res.airAfter = best.metrics.airPct;
    evals.forEach(function (e) {
      if (e === best) return;
      res.rejected.push({ boxId: e.box.id, reason: e.ok ? 'more_expensive' : e.reason });
    });
    var unconfirmed = res.provisional.length > 0;
    res.state = unconfirmed ? 'AMBER_PROVISIONAL' : 'GREEN_VERIFIED';
    return res;
  };

  // ================================================================== SPLIT
  function lite(opts) { var o = {}, k; for (k in opts) o[k] = opts[k]; o.restarts = 6; return o; }
  function withUnit(lines, id) {
    var out = lines.map(function (l) { return { sku: l.sku, qty: l.qty }; }), f = false;
    out.forEach(function (l) { if (l.sku === id) { l.qty++; f = true; } });
    if (!f) out.push({ sku: id, qty: 1 });
    return out;
  }
  function parcelCost(lines, opts) {
    var boxes = allBoxes(opts), best = null;
    for (var i = 0; i < boxes.length; i++) {
      var e = evalBox(boxes[i], lines, opts);
      if (e.ok && (best === null || e.metrics.totalCost < best)) best = e.metrics.totalCost;
    }
    return best;   // null = infeasible
  }
  // strategy A: first-fit decreasing. strategy B: put each unit where it adds the least cost.
  function buildParcels(units, opts, byCost) {
    var parcels = [], costs = [];
    for (var u = 0; u < units.length; u++) {
      var pick = -1, pickCost = null, bestDelta = null, id = units[u].itemId;
      for (var p = 0; p < parcels.length; p++) {
        var cand = withUnit(parcels[p], id), c = parcelCost(cand, opts);
        if (c === null) continue;
        if (!byCost) { pick = p; pickCost = c; break; }
        var d = c - costs[p];
        if (bestDelta === null || d < bestDelta - EPS) { bestDelta = d; pick = p; pickCost = c; }
      }
      if (pick >= 0) {
        var np = withUnit(parcels[pick], id);
        if (byCost && parcels.length < PB.ASSUMPTIONS.maxParcels) {
          var sc = parcelCost([{ sku: id, qty: 1 }], opts);
          if (sc !== null && sc < bestDelta - EPS) pick = -1;   // a new parcel is cheaper than adding
        }
        if (pick >= 0) { parcels[pick] = np; costs[pick] = pickCost; continue; }
      }
      var single = [{ sku: id, qty: 1 }], sc2 = parcelCost(single, opts);
      if (parcels.length >= PB.ASSUMPTIONS.maxParcels || sc2 === null) return null;
      parcels.push(single); costs.push(sc2);
    }
    return parcels;
  }

  PB.splitOrder = function (orderLines, opts) {
    opts = opts || {};
    var fail = { state: 'RED_CANNOT_PACK', parcels: [], parcelCount: 0, totalCost: null, messageKey: 'cannot_pack' };
    var units = buildUnits(orderLines, opts).sort(function (a, b) {
      if (b.rawVol !== a.rawVol) return b.rawVol - a.rawVol;
      if (a.itemId !== b.itemId) return a.itemId < b.itemId ? -1 : 1;
      return a.index - b.index;
    });
    var lo = lite(opts), best = null;
    [false, true].forEach(function (byCost) {
      var parcels = buildParcels(units, lo, byCost);
      if (!parcels) return;
      var out = [], total = 0;
      for (var k = 0; k < parcels.length; k++) {
        var rec = PB.recommend(parcels[k], opts);
        if (!rec.recommended) return;
        out.push({ lines: parcels[k], rec: rec });
        total += rec.recommended.metrics.totalCost;
      }
      if (!best || total < best.totalCost - EPS || (Math.abs(total - best.totalCost) <= EPS && out.length < best.parcelCount)) {
        best = { state: 'NEEDS_SPLIT', parcels: out, parcelCount: out.length, totalCost: total, messageKey: null };
      }
    });
    if (!best) return fail;
    best.provisional = best.parcels.some(function (p) { return p.rec.state !== 'GREEN_VERIFIED'; });
    return best;
  };

  /* Top level: recommend, and split when no single box works. */
  PB.solve = function (orderLines, opts) {
    var rec = PB.recommend(orderLines, opts);
    if (rec.state !== 'NEEDS_SPLIT') return { state: rec.state, rec: rec, split: null };
    var sp = PB.splitOrder(orderLines, opts);
    return { state: sp.state, rec: rec, split: sp };
  };

  // ============================================================== LEARNING
  PB.comboKey = function (lines) {
    return normLines(lines).map(function (l) { return l.sku + ':' + l.qty; }).sort().join(',');
  };
  PB.MAX_REJECTS = 3;
  PB.marginFor = function (rejects, lines) {
    var n = (rejects && rejects[PB.comboKey(lines)]) || 0;
    return Math.min(PB.MAX_REJECTS, n) * 1.0;
  };
  PB.addReject = function (rejects, lines) {
    var out = {}, k;
    for (k in (rejects || {})) out[k] = rejects[k];
    var key = PB.comboKey(lines);
    out[key] = Math.min(PB.MAX_REJECTS, (out[key] || 0) + 1);
    return out;
  };

  // ======================================================== MISSING DIMENSIONS
  PB.validateDims = function (l, w, h) {
    var v = [l, w, h].map(function (x) { return (typeof x === 'string' && x.trim() === '') ? NaN : Number(x); });
    for (var i = 0; i < 3; i++) if (!isFinite(v[i]) || !(v[i] > 0) || !(v[i] < 200)) return { ok: false, code: 'bad_dims' };
    return { ok: true, L: v[0], W: v[1], H: v[2] };
  };
  PB.TNP = { start: [30, 20, 5], step: 2, maxTries: 3 };
  PB.tnpDims = function (tries) { return { L: PB.TNP.start[0], W: PB.TNP.start[1], H: PB.TNP.start[2] + PB.TNP.step * tries }; };

  // =================================================================== IMPORT
  PB.fromHolioOrder = function (json) {
    var errors = [];
    function err(code, detail, msg) { errors.push({ code: code, detail: detail === undefined ? '' : String(detail), message: msg }); }
    var data = json;
    if (typeof json === 'string') {
      try { data = JSON.parse(json); } catch (e) { err('not_json', '', 'Input is not valid JSON'); return { ok: false, orderId: null, lines: [], errors: errors }; }
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      err('not_object', '', 'Order must be a JSON object');
      return { ok: false, orderId: null, lines: [], errors: errors };
    }
    var orderId = null;
    if ((typeof data.orderId === 'string' && data.orderId.trim()) || typeof data.orderId === 'number') orderId = String(data.orderId).trim();
    else err('bad_order_id', '', 'orderId is missing or invalid');
    if (!Array.isArray(data.lines) || data.lines.length === 0) {
      err('no_lines', '', 'lines must be a non-empty array');
      return { ok: false, orderId: orderId, lines: [], errors: errors };
    }
    var lines = [], total = 0;
    data.lines.forEach(function (ln, i) {
      var pos = i + 1;
      if (!ln || typeof ln !== 'object' || Array.isArray(ln)) { err('line_not_object', pos, 'Line ' + pos + ' is not an object'); return; }
      var q = ln.qty;
      if (typeof q !== 'number' || !isFinite(q) || Math.floor(q) !== q || q < 1 || q > PB.ASSUMPTIONS.maxQtyPerLine) {
        err('bad_qty', pos, 'Line ' + pos + ': qty must be an integer 1-' + PB.ASSUMPTIONS.maxQtyPerLine); return;
      }
      var item = null;
      if (ln.sku !== undefined && ln.sku !== null && ln.sku !== '') item = PB.findItemByCode(ln.sku);
      if (!item && ln.ean !== undefined && ln.ean !== null && ln.ean !== '') item = PB.findItemByCode(ln.ean);
      if (!item) {
        var code = (ln.sku !== undefined && ln.sku !== null && ln.sku !== '') ? ln.sku : ln.ean;
        err(code === undefined ? 'missing_code' : 'unknown_item', code === undefined ? pos : code, 'Line ' + pos + ': unknown or missing sku/ean');
        return;
      }
      total += q;
      lines.push({ sku: item.id, qty: q });
    });
    if (total > PB.ASSUMPTIONS.maxUnitsPerOrder) err('too_many_units', total, 'Max ' + PB.ASSUMPTIONS.maxUnitsPerOrder + ' units per order');
    return { ok: errors.length === 0 && lines.length > 0, orderId: orderId, lines: normLines(lines), errors: errors };
  };

  // ==================================================================== QUEUE
  PB.QUEUE_MAX = 20;
  PB.queueAdd = function (queue, order) {
    return [order].concat(queue || []).slice(0, PB.QUEUE_MAX);
  };
  PB.randomOrder = function (rng, seq) {
    var known = PB.ITEMS.filter(function (i) { return i.dimsKnown; });
    var n = 1 + Math.floor(rng() * 4), lines = [], used = {};
    for (var i = 0; i < n; i++) {
      var it = known[Math.floor(rng() * known.length)];
      if (used[it.id]) continue;
      used[it.id] = 1;
      lines.push({ sku: it.id, qty: 1 + Math.floor(rng() * 2) });
    }
    return { id: 'H-' + (1000 + seq), lines: lines };
  };

  // ============================================================== PACK STEPS
  /* Ordered by z then weight desc. Dims shown are the real item dims in placed orientation. */
  PB.packSteps = function (placements, opts) {
    var margin = (opts && opts.margin) > 0 ? opts.margin : 0;
    var zs = [];
    placements.forEach(function (p) { if (zs.indexOf(p.z) < 0) zs.push(p.z); });
    zs.sort(function (a, b) { return a - b; });
    return placements.slice().sort(function (a, b) {
      return (a.z - b.z) || (b.weight - a.weight) || (a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0) || (a.index - b.index);
    }).map(function (p, i) {
      var pad = margin + (p.fragile ? PB.ASSUMPTIONS.fragilePad : 0);
      return { n: i + 1, itemId: p.itemId, index: p.index, fragile: p.fragile, x: p.x, y: p.y, z: p.z,
        dims: [p.w - pad, p.d - pad, p.h - pad], layer: zs.indexOf(p.z) + 1, rotated: p.rotated };
    });
  };
  PB.layerZs = function (placements) {
    var zs = [];
    placements.forEach(function (p) { if (zs.indexOf(p.z) < 0) zs.push(p.z); });
    return zs.sort(function (a, b) { return a - b; });
  };

  // ============================================================== MISSING BOX
  PB.candidateBoxes = function () {
    var vals = [15, 20, 25, 30, 35, 40, 45, 50, 60], out = [];
    for (var a = 0; a < vals.length; a++) for (var b = 0; b <= a; b++) for (var c = 0; c <= b; c++) {
      var L = vals[a], W = vals[b], H = vals[c];
      if (H > 30) continue;
      out.push({ id: 'N' + L + 'x' + W + 'x' + H, name: L + 'x' + W + 'x' + H, L: L, W: W, H: H, own: 0.2, maxLoad: 10,
        cost: 4 + 0.0004 * L * W * H, candidate: true });
    }
    return out;
  };

  /* base: [{lines, opts, total, litres}] for fully-known orders. Re-runs recommend() with the
   * candidate box added; counts an order only if the candidate is chosen and cheaper. */
  PB.evalCandidate = function (cand, base) {
    var sav = 0, lit = 0, n = 0;
    base.forEach(function (b) {
      var o = {}, k;
      for (k in b.opts) o[k] = b.opts[k];
      o.extraBoxes = [cand];
      var r = PB.recommend(b.lines, o);
      if (r.recommended && r.recommended.box.id === cand.id && r.recommended.metrics.totalCost < b.total - 1e-9) {
        sav += b.total - r.recommended.metrics.totalCost;
        lit += b.litres - r.recommended.metrics.fillerLitres;
        n++;
      }
    });
    return { savings: sav, litres: lit, n: n };
  };
  /* Portfolio headline: savings vs the B5 baseline across solve() results (single-box orders only). */
  PB.headline = function (solves) {
    var nok = 0, litres = 0, base = 0, n = 0;
    solves.forEach(function (s) {
      var r = s && s.rec;
      if (!r || !r.recommended || !r.baseline || s.state === 'NEEDS_SPLIT' || r.state === 'AMBER_PROVISIONAL') return;
      nok += r.savingsNOK; litres += r.baseline.metrics.fillerLitres - r.recommended.metrics.fillerLitres;
      base += r.baseline.metrics.totalCost; n++;
    });
    return { nok: nok, litres: litres, n: n, pct: base > 0 ? nok / base * 100 : 0 };
  };
  /* total NOK and filler litres of a solve() result */
  PB.solveTotals = function (s) {
    if (s.split && s.state === 'NEEDS_SPLIT') {
      var l = 0; s.split.parcels.forEach(function (p) { l += p.rec.recommended.metrics.fillerLitres; });
      return { total: s.split.totalCost, litres: l };
    }
    if (s.rec && s.rec.recommended) return { total: s.rec.recommended.metrics.totalCost, litres: s.rec.recommended.metrics.fillerLitres };
    return null;
  };

  if (typeof module !== 'undefined' && module.exports) module.exports = PB;
  else root.PB = PB;
})(typeof window !== 'undefined' ? window : globalThis);
