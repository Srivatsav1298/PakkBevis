/* PakkBevis tests: runnable in Node and in the browser Selvtest tab. */
(function (root) {
  'use strict';

  function run(PB, I18N, opts) {
    opts = opts || {};
    var heavy = opts.heavy !== false;
    var results = [];
    function now() { return (typeof performance !== 'undefined' && performance.now) ? performance.now() : Date.now(); }
    function ok(c, msg) { if (!c) throw new Error(msg || 'assertion failed'); }
    function eq(a, b, msg) { if (a !== b) throw new Error((msg || 'not equal') + ': got ' + a + ', expected ' + b); }
    function near(a, b, tol, msg) { if (Math.abs(a - b) > tol) throw new Error((msg || 'not near') + ': got ' + a + ', expected ' + b); }
    function has(list, prefix) { return list.some(function (f) { return f.indexOf(prefix) === 0; }); }
    function def(id, name, fn, onlyHeavy) {
      if (onlyHeavy && !heavy) return;
      var t0 = now(), pass = true, msg = '';
      try { fn(); } catch (e) { pass = false; msg = e && e.message ? e.message : String(e); }
      results.push({ id: id, name: name, pass: pass, msg: msg, ms: now() - t0 });
    }

    var B4 = PB.BOXES[3], B5 = PB.BOXES[4], B6 = PB.BOXES[5];
    var BIG = { BIG: { id: 'BIG', no: 'Stor', en: 'Huge', L: 100, W: 10, H: 10, kg: 1, fragile: false, ean: '1', dimsKnown: true } };
    var LONG = { LONG: { id: 'LONG', no: 'Lang', en: 'Long', L: 10, W: 10, H: 60, kg: 0.5, fragile: false, ean: '2', dimsKnown: true } };
    var DIMS15 = { SKU15: { L: 10, W: 10, H: 3 } };
    function lines(o) { return PB.getOrder(o).lines; }
    function pl(id, i, x, y, z, w, d, h, f) { return { itemId: id, index: i, x: x, y: y, z: z, w: w, d: d, h: h, fragile: !!f, weight: 0 }; }

    def('T1', 'item larger than every box -> RED_CANNOT_PACK', function () {
      var r = PB.recommend([{ sku: 'BIG', qty: 1 }], { extraItems: BIG });
      eq(r.state, 'RED_CANNOT_PACK'); eq(r.recommended, null);
      var s = PB.solve([{ sku: 'BIG', qty: 1 }], { extraItems: BIG });
      eq(s.state, 'RED_CANNOT_PACK');
    });
    def('T2', 'verifier fails on two items at same point', function () {
      var v = PB.verifyPacking(B4, [pl('SKU01', 0, 0, 0, 0, 28, 22, 3), pl('SKU01', 1, 0, 0, 0, 28, 22, 3)], [{ sku: 'SKU01', qty: 2 }]);
      ok(!v.pass && has(v.failures, 'overlap'), JSON.stringify(v));
    });
    def('T3', 'verifier fails on out-of-bounds placement', function () {
      var v = PB.verifyPacking(B4, [pl('SKU01', 0, 20, 0, 0, 28, 22, 3)], [{ sku: 'SKU01', qty: 1 }]);
      ok(!v.pass && has(v.failures, 'out_of_bounds'), JSON.stringify(v));
    });
    def('T4', 'verifier fails when weight > maxLoad', function () {
      var box = { id: 'X', L: 100, W: 100, H: 100, own: 0.1, maxLoad: 1, cost: 1 };
      var v = PB.verifyPacking(box, [pl('SKU03', 0, 0, 0, 0, 33, 22, 12), pl('SKU03', 1, 40, 0, 0, 33, 22, 12)], [{ sku: 'SKU03', qty: 2 }]);
      ok(!v.pass && has(v.failures, 'overweight'), JSON.stringify(v));
    });
    def('T5', 'verifier fails when non-fragile rests on fragile', function () {
      var v = PB.verifyPacking(B4, [pl('SKU05', 0, 0, 0, 0, 13, 13, 12, true), pl('SKU01', 0, 0, 0, 12, 28, 22, 3)],
        [{ sku: 'SKU05', qty: 1 }, { sku: 'SKU01', qty: 1 }]);
      ok(!v.pass && has(v.failures, 'on_fragile'), JSON.stringify(v));
    });
    def('T6', 'verifier fails when item missing or extra', function () {
      var miss = PB.verifyPacking(B4, [pl('SKU01', 0, 0, 0, 0, 28, 22, 3)], [{ sku: 'SKU01', qty: 2 }]);
      ok(!miss.pass && has(miss.failures, 'missing'), JSON.stringify(miss));
      var extra = PB.verifyPacking(B4, [pl('SKU01', 0, 0, 0, 0, 28, 22, 3), pl('SKU09', 0, 0, 0, 5, 15, 10, 3)], [{ sku: 'SKU01', qty: 1 }]);
      ok(!extra.pass && has(extra.failures, 'extra'), JSON.stringify(extra));
    });
    def('T7', 'all demo orders: every recommended/parcel box passes verifier', function () {
      var o = { dims: DIMS15 };
      PB.ORDERS.forEach(function (ord) {
        var s = PB.solve(ord.lines, o);
        if (s.split && s.state === 'NEEDS_SPLIT') {
          ok(s.split.parcels.length >= 1, ord.id + ' no parcels');
          s.split.parcels.forEach(function (p) {
            var v = PB.verifyPacking(p.rec.recommended.box, p.rec.recommended.placements, p.lines, o);
            ok(v.pass, ord.id + ' parcel ' + JSON.stringify(v));
          });
        } else {
          ok(s.rec.recommended, ord.id + ' no box, state ' + s.state);
          var v2 = PB.verifyPacking(s.rec.recommended.box, s.rec.recommended.placements, ord.lines, o);
          ok(v2.pass, ord.id + ' ' + JSON.stringify(v2));
        }
      });
    });
    def('T8', 'O1001 recommends box smaller than B5 and saves money', function () {
      var r = PB.recommend(lines('O1001'));
      eq(r.state, 'GREEN_VERIFIED');
      ok(PB.innerVolume(r.recommended.box) < PB.innerVolume(B5), 'not smaller: ' + r.recommended.box.id);
      ok(r.savingsNOK > 0, 'no savings ' + r.savingsNOK);
    });
    def('T9', 'O1004 -> NEEDS_SPLIT into >=2 verified parcels', function () {
      var s = PB.solve(lines('O1004'));
      eq(s.state, 'NEEDS_SPLIT'); ok(s.split.parcelCount >= 2, 'parcels ' + s.split.parcelCount);
      ok(s.split.parcelCount <= PB.ASSUMPTIONS.maxParcels, 'too many parcels');
      s.split.parcels.forEach(function (p) {
        ok(PB.verifyPacking(p.rec.recommended.box, p.rec.recommended.placements, p.lines).pass, 'parcel fails verify');
      });
    });
    def('T10', 'O1006 AMBER_MISSING_DIMS; after 10x10x3 -> GREEN_VERIFIED', function () {
      var a = PB.recommend(lines('O1006'));
      eq(a.state, 'AMBER_MISSING_DIMS'); eq(a.missing[0], 'SKU15'); eq(a.recommended, null);
      var b = PB.recommend(lines('O1006'), { dims: DIMS15 });
      eq(b.state, 'GREEN_VERIFIED');
      var c = PB.recommend(lines('O1006'), { dims: { SKU15: { L: 30, W: 20, H: 5, provisional: true } } });
      eq(c.state, 'AMBER_PROVISIONAL');
    });
    def('T11', 'long item fits B6 only via rotation', function () {
      var ln = [{ sku: 'LONG', qty: 1 }], o = { extraItems: LONG };
      var p = PB.packInBox(B6, ln, o);
      ok(p.ok, 'B6 should fit'); ok(p.placements[0].rotated, 'not rotated'); eq(p.placements[0].w, 60);
      ok(PB.verifyPacking(B6, p.placements, ln, o).pass, 'verifier');
      ok(!PB.packInBox(B5, ln, o).ok, 'B5 should not fit');
      eq(PB.recommend(ln, o).recommended.box.id, 'B6');
    });
    def('T12', 'chargeable weight 41x31x21 = 26691/5000', function () {
      near(PB.volumetricKg(B4), 5.3382, 1e-9);
      near(PB.chargeableKg(B4, 0.75), 5.3382, 1e-9);   // 0.75 + 0.25 own = 1 kg actual
    });
    def('T13', 'every I18N key exists in NO/EN and none empty', function () {
      var langs = ['NO', 'EN'], keys = Object.keys(I18N.NO);
      ok(keys.length > 0, 'no keys');
      langs.forEach(function (l) {
        ok(I18N[l], 'missing lang ' + l);
        keys.forEach(function (k) {
          ok(typeof I18N[l][k] === 'string' && I18N[l][k].trim() !== '', 'empty/missing ' + l + '.' + k);
        });
        Object.keys(I18N[l]).forEach(function (k) { ok(k in I18N.NO, 'extra key ' + l + '.' + k); });
      });
    });
    def('T14', 'fuzz: 300 orders, mulberry32(42), zero violations', function () {
      var rng = PB.mulberry32(42), known = PB.ITEMS.filter(function (i) { return i.dimsKnown; }), viol = [];
      var t0 = now(), counts = { single: 0, split: 0, red: 0 };
      for (var n = 0; n < 300; n++) {
        var cnt = 1 + Math.floor(rng() * 8), ls = [];
        for (var i = 0; i < cnt; i++) ls.push({ sku: known[Math.floor(rng() * known.length)].id, qty: 1 + Math.floor(rng() * 3) });
        var s = PB.solve(ls);
        if (s.rec.recommended && s.state !== 'NEEDS_SPLIT') {
          counts.single++;
          if (!PB.verifyPacking(s.rec.recommended.box, s.rec.recommended.placements, PB.normLines(ls)).pass) viol.push('order ' + n + ' single');
        } else if (s.state === 'NEEDS_SPLIT') {
          counts.split++;
          s.split.parcels.forEach(function (p) {
            if (!PB.verifyPacking(p.rec.recommended.box, p.rec.recommended.placements, p.lines).pass) viol.push('order ' + n + ' parcel');
          });
          var tot = 0; s.split.parcels.forEach(function (p) { p.lines.forEach(function (l) { tot += l.qty; }); });
          var want = 0; PB.normLines(ls).forEach(function (l) { want += l.qty; });
          if (tot !== want) viol.push('order ' + n + ' unit count ' + tot + '/' + want);
        } else if (s.state === 'RED_CANNOT_PACK') counts.red++;
        else viol.push('order ' + n + ' bad state ' + s.state);
      }
      var dt = now() - t0;
      if (typeof console !== 'undefined' && opts.log) opts.log('fuzz ' + JSON.stringify(counts) + ' in ' + Math.round(dt) + ' ms');
      ok(viol.length === 0, viol.slice(0, 3).join('; '));
      ok(dt < 20000, 'fuzz took ' + Math.round(dt) + ' ms');
    }, true);
    def('T15', 'freight bracket edges', function () {
      eq(PB.freightFor(1.0), 49); eq(PB.freightFor(1.0001), 59); eq(PB.freightFor(25), 219); eq(PB.freightFor(25.01), null);
      eq(PB.freightFor(2), 59); eq(PB.freightFor(2.0001), 79); eq(PB.freightFor(5), 79); eq(PB.freightFor(10), 119); eq(PB.freightFor(15), 159);
    });
    def('T16', 'learning: a rejected fit raises margin, still verified', function () {
      var ls = lines('O1002'), r0 = PB.recommend(ls);
      eq(PB.marginFor({}, ls), 0);
      var rej = PB.addReject({}, ls);
      eq(PB.marginFor(rej, ls), 1);
      var o = { margin: PB.marginFor(rej, ls) };
      var r1 = PB.recommend(ls, o);
      eq(r1.state, 'GREEN_VERIFIED'); eq(r1.margin, 1);
      ok(PB.verifyPacking(r1.recommended.box, r1.recommended.placements, ls, o).pass, 'verify with margin');
      ok(r1.recommended.metrics.totalCost >= r0.recommended.metrics.totalCost - 1e-9, 'margin should not reduce cost');
      var rej2 = PB.addReject(PB.addReject(PB.addReject(rej, ls), ls), ls);
      eq(PB.marginFor(rej2, ls), 3);   // capped at 3
      eq(PB.comboKey([{ sku: 'SKU04', qty: 1 }, { sku: 'SKU03', qty: 1 }]), 'SKU03:1,SKU04:1');
    });
    def('T17', 'determinism', function () {
      PB.ORDERS.forEach(function (o) {
        eq(JSON.stringify(PB.solve(o.lines, { dims: DIMS15 })), JSON.stringify(PB.solve(o.lines, { dims: DIMS15 })), o.id);
      });
    });
    def('T18', 'fromHolioOrder validation', function () {
      var a = PB.fromHolioOrder({ orderId: 'H-1', lines: [{ sku: 'SKU03', qty: 1 }] });
      ok(a.ok && a.lines[0].sku === 'SKU03', 'by sku');
      var b = PB.fromHolioOrder(JSON.stringify({ orderId: 'H-2', lines: [{ ean: '7000000000042', qty: 2 }] }));
      ok(b.ok && b.lines[0].sku === 'SKU04' && b.lines[0].qty === 2, 'by ean');
      var bad = [
        { orderId: 'X', lines: [{ sku: 'NOPE', qty: 1 }] },
        { orderId: 'X', lines: [{ sku: 'SKU01', qty: 0 }] },
        { orderId: 'X', lines: [{ sku: 'SKU01', qty: -2 }] },
        { orderId: 'X', lines: [{ sku: 'SKU01', qty: 1.5 }] },
        { orderId: 'X' },
        { orderId: 'X', lines: [] },
        { orderId: 'X', lines: [null] },
        '{not json', null, 42, [], undefined
      ];
      bad.forEach(function (x, i) {
        var r;
        try { r = PB.fromHolioOrder(x); } catch (e) { throw new Error('threw on bad input ' + i); }
        ok(r.ok === false && r.errors.length > 0 && r.errors[0].code && r.errors[0].message, 'bad input ' + i + ' not rejected');
      });
    });
    def('T19', 'performance: recommend() 30 units < 100 ms', function () {
      var ls = [{ sku: 'SKU01', qty: 6 }, { sku: 'SKU09', qty: 6 }, { sku: 'SKU13', qty: 6 }, { sku: 'SKU10', qty: 6 }, { sku: 'SKU12', qty: 6 }];
      PB.recommend(ls);                                  // warm up
      var t0 = now(); var r = PB.recommend(ls); var dt = now() - t0;
      ok(r.state, 'no state');
      ok(dt < 100, 'recommend took ' + dt.toFixed(1) + ' ms');
      var worst = 0;
      PB.ORDERS.forEach(function (o) { var t = now(); PB.solve(o.lines, { dims: DIMS15 }); worst = Math.max(worst, now() - t); });
      ok(worst < 1000, 'solve took ' + worst.toFixed(1) + ' ms');
    });
    def('T20', 'live queue keeps newest 20', function () {
      var q = [];
      for (var i = 1; i <= 25; i++) q = PB.queueAdd(q, { id: 'H-' + i, lines: [] });
      eq(q.length, 20); eq(q[0].id, 'H-25'); eq(q[19].id, 'H-6');
    });

    def('T21', 'stronger search: O1003 now fits B4 and saves vs B5', function () {
      var r = PB.recommend(lines('O1003'));
      eq(r.state, 'GREEN_VERIFIED'); eq(r.recommended.box.id, 'B4'); ok(r.savingsNOK > 0, 'savings ' + r.savingsNOK);
      ok(PB.verifyPacking(r.recommended.box, r.recommended.placements, lines('O1003')).pass, 'verifier');
    });
    def('T22', 'verifier reports six named checks', function () {
      var r = PB.recommend(lines('O1003')), v = PB.verifyPacking(r.recommended.box, r.recommended.placements, lines('O1003'));
      ['bounds', 'overlap', 'items', 'orientation', 'weight', 'fragile'].forEach(function (k) { eq(v.checks[k], true, 'check ' + k); });
      var bad = PB.verifyPacking(B4, [pl('SKU01', 0, 0, 0, 0, 28, 22, 3), pl('SKU01', 1, 0, 0, 0, 28, 22, 3)], [{ sku: 'SKU01', qty: 2 }]);
      eq(bad.checks.overlap, false); eq(bad.checks.bounds, true);
    });
    def('T23', 'split is never worse than first-fit and headline saves money', function () {
      var s = PB.splitOrder(lines('O1004'));
      eq(s.state, 'NEEDS_SPLIT'); ok(s.parcelCount <= 4, 'parcels');
      ok(s.totalCost <= 458.85, 'split cost ' + s.totalCost);
      var h = PB.headline(PB.ORDERS.map(function (o) { return PB.solve(o.lines, { dims: DIMS15 }); }));
      ok(h.nok > 0 && h.litres > 0 && h.n >= 4, 'headline ' + JSON.stringify(h));
    });

    return results;
  }

  var T = { run: run };
  if (typeof module !== 'undefined' && module.exports) module.exports = T;
  else root.PBTests = T;
})(typeof window !== 'undefined' ? window : globalThis);
