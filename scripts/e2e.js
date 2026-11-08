'use strict';
// Browser verification of index.html via file:// (Playwright, headless Chromium)
var path = require('path');
var chromium = require('playwright').chromium;
var I18N = require('../src/i18n.js');
var URL = 'file://' + path.join(__dirname, '..', 'index.html');
var fails = [], oks = 0;
function ok(c, m) { if (c) { oks++; console.log('  ok   ' + m); } else { fails.push(m); console.log('  FAIL ' + m); } }

(async function () {
  var browser = await chromium.launch();
  async function open(w, h, blockStorage) {
    var ctx = await browser.newContext({ viewport: { width: w, height: h } });
    var page = await ctx.newPage();
    page._logs = [];
    page.on('console', function (m) { if (m.type() === 'error' || m.type() === 'warning') page._logs.push(m.type() + ': ' + m.text()); });
    page.on('pageerror', function (e) { page._logs.push('pageerror: ' + e.message); });
    page.on('requestfailed', function (r) { page._logs.push('requestfailed: ' + r.url()); });
    if (blockStorage) await page.addInitScript(function () {
      Object.defineProperty(window, 'localStorage', { get: function () { throw new Error('blocked'); } });
    });
    await page.goto(URL);
    await page.waitForSelector('#orderSel');
    return page;
  }
  var langs = ['NO', 'EN'];
  async function reset(pg) {
    await pg.evaluate(function () { document.querySelectorAll('details').forEach(function (d) { if (/Antakelser|Assumptions/.test(d.textContent.slice(0, 20))) d.open = true; }); });
    await pg.click('text=Nullstill læring');
  }

  console.log('== 360px phone');
  var p = await open(360, 740);
  ok(await p.evaluate(function () { return document.documentElement.scrollWidth <= window.innerWidth; }), 'no horizontal overflow (pack tab)');
  var ids = ['O1001', 'O1002', 'O1003', 'O1004', 'O1005', 'O1006'];
  for (var i = 0; i < ids.length; i++) {
    var t0 = Date.now();
    await p.selectOption('#orderSel', ids[i]);
    var txt = await p.innerText('main');
    var ms = Date.now() - t0;
    var expectState = ids[i] === 'O1006' ? /Mål mangler for: Skjerf/ : (ids[i] === 'O1004' ? /Må deles/ : /Maskinkontrollert ✓/);
    ok(expectState.test(txt), ids[i] + ' renders expected state (' + ms + ' ms)');
    ok(await p.evaluate(function () { return document.documentElement.scrollWidth <= window.innerWidth; }), ids[i] + ' no horizontal overflow');
  }
  // touch targets >= 48px
  var small = await p.evaluate(function () {
    return Array.prototype.filter.call(document.querySelectorAll('button,select,input,textarea'), function (e) {
      var r = e.getBoundingClientRect(); return r.width > 0 && r.height < 47.5;
    }).length;
  });
  ok(small === 0, 'all controls >= 48px high (small: ' + small + ')');

  console.log('== missing dims (O1006)');
  await p.selectOption('#orderSel', 'O1006');
  await p.fill('#dimL', '0'); await p.fill('#dimW', '10'); await p.fill('#dimH', '3');
  await p.click('text=Lagre mål');
  ok(/Mål må være tall/.test(await p.innerText('main')), 'invalid dims rejected');
  await p.fill('#dimL', '10'); await p.fill('#dimW', '10'); await p.fill('#dimH', '3');
  await p.click('text=Lagre mål');
  ok(/Maskinkontrollert ✓/.test(await p.innerText('main')), 'after entering 10x10x3 -> verified');
  ok((await p.evaluate(function () { return window.localStorage.getItem('pakkbevis_dims'); })).indexOf('SKU15') > 0, 'dims saved to localStorage');
  await reset(p);
  await p.selectOption('#orderSel', 'O1006');
  ok(/Mål mangler for/.test(await p.innerText('main')), 'reset clears dims');
  await p.click('text=Start prøv-og-trykk');
  ok(/Forsøk 1 av 3: foreløpig mål 30×20×5/.test(await p.innerText('main')), 'try-and-press try 1');
  ok(/Foreløpig – mål mangler/.test(await p.innerText('main')), 'provisional amber, never green');
  ok(!/Maskinkontrollert ✓/.test(await p.innerText('main')), 'not green while provisional');
  await p.click('main >> text=Passet ikke');
  ok(/Forsøk 2 av 3: foreløpig mål 30×20×7/.test(await p.innerText('main')), 'H += 2 on reject');
  await p.click('main >> text=Passet ikke');
  await p.click('main >> text=Passet ikke');
  ok(/skriv inn mål manuelt/.test(await p.innerText('main')), 'after 3 tries manual entry required');
  await p.click('text=Start prøv-og-trykk');
  await p.click('main >> button:has-text("Passet"):not(:has-text("ikke"))');
  var txt6 = await p.innerText('main');
  ok(/Maskinkontrollert ✓/.test(txt6) && await p.evaluate(function () { return window.__pb.S.dims.SKU15 && window.__pb.S.dims.SKU15.estimated === true; }), 'Passet -> saved as estimert, green after confirmation');
  await reset(p);

  console.log('== learning (Passet ikke)');
  await p.selectOption('#orderSel', 'O1002');
  var before = await p.innerText('main');
  var t1 = Date.now();
  await p.click('text=Passet ikke');
  var lat = Date.now() - t1;
  var after = await p.innerText('main');
  ok(/Lært: denne kombinasjonen får 1,0 cm ekstra margin/.test(after), 'learn message (1,0 cm) shown');
  ok(/Maskinkontrollert ✓/.test(after), 'still verified after margin');
  ok(/Ekstra margin: 1,0 cm/.test(after), 'result shows margin');
  ok(lat < 300, 'Passet ikke interaction ' + lat + ' ms < 300');
  var stored = await p.evaluate(function () { return window.localStorage.getItem('pakkbevis_rejects'); });
  ok(/SKU03:1,SKU04:1,SKU06:1/.test(stored) && /:1/.test(stored), 'reject stored: ' + stored);
  await reset(p);

  console.log('== learning (For stor = pack tighter)');
  await p.selectOption('#orderSel', 'O1001');
  ok(/B3 Medium/.test(await p.innerText('main')), 'O1001 starts on B3 Medium');
  await p.click('.actionbar >> text=For stor');
  var tt = await p.innerText('main');
  ok(/Lært: denne kombinasjonen pakkes 1,0 cm tettere/.test(tt) && /Ny anbefaling: B2 Flat \(var B3 Medium\)/.test(tt), 'too big -> tighter and smaller box B2: ' + tt.slice(0, 0));
  ok(/Maskinkontrollert ✓/.test(tt) && /Tettere pakking: 1,0 cm/.test(tt), 'still verified, result shows tighter packing');
  await p.click('.actionbar >> text=Passet ikke');
  var tb = await p.innerText('main');
  ok(/Margin er tilbake til 0 cm/.test(tb) && /B3 Medium/.test(tb), 'did not fit undoes the tighter step (back to B3)');
  await p.click('.actionbar >> text=For stor'); await p.click('.actionbar >> text=For stor'); await p.click('.actionbar >> text=For stor');
  ok(/Kan ikke pakkes tettere enn 2,0 cm/.test(await p.innerText('main')), 'tighter floor at 2 cm');
  await reset(p);

  console.log('== O1004 split');
  await p.selectOption('#orderSel', 'O1004');
  var t4 = await p.innerText('main');
  ok(/3 pakker – totalt/.test(t4) && /Pakke 1/.test(t4) && /Pakke 3/.test(t4), 'split shows 3 parcel cards');

  console.log('== live queue, import, scanner');
  await p.click('summary:has-text("Live-kø")');
  await p.click('text=Ny ordre');
  ok(/\(1\)/.test(await p.innerText('summary:has-text("Live-kø")')), 'Ny ordre adds an order');
  await p.click('.queue button.qi >> nth=0');
  ok(await p.evaluate(function () { return /H-1001/.test(document.querySelector('#orderSel').selectedOptions[0].textContent); }), 'tapping order opens it');
  await p.click('text=Auto-ankomst: av');
  ok(/Auto-ankomst: på/.test(await p.innerText('main')), 'auto toggle on');
  await p.waitForTimeout(6500);
  ok(await p.evaluate(function () { return window.__pb.S.queue.length >= 2; }), 'auto-arrival added an order after 6 s');
  await p.click('text=Auto-ankomst: på');
  var n1 = await p.evaluate(function () { return window.__pb.S.queue.length; });
  await p.waitForTimeout(6500);
  ok(await p.evaluate(function (n) { return window.__pb.S.queue.length === n && window.__pb.S.timer === null; }, n1), 'timer cleaned up when off');
  await p.click('text=Importer ordre (JSON)');
  await p.fill('#importTa', '{"orderId":"H-77","lines":[{"sku":"SKU03","qty":1},{"ean":"7000000000042","qty":2}]}');
  await p.click('text=Valider og legg til');
  ok(/H-77/.test(await p.innerText('.queue')), 'valid JSON import added');
  await p.click('text=Importer ordre (JSON)');
  await p.fill('#importTa', '{"orderId":"H-78","lines":[{"sku":"NOPE","qty":1},{"sku":"SKU01","qty":0}]}');
  await p.click('text=Valider og legg til');
  var et = await p.innerText('.queue');
  ok(/Ukjent SKU\/EAN: NOPE/.test(et) && /antall må være et heltall/.test(et), 'invalid import shows clear errors');
  await p.fill('#importTa', '{broken');
  await p.click('text=Valider og legg til');
  ok(/Ugyldig JSON/.test(await p.innerText('.queue')), 'malformed JSON handled');
  await p.fill('#scan', '7000000000035'); await p.press('#scan', 'Enter');
  ok(/Lagt til: Joggesko/.test(await p.innerText('main')), 'scanner adds by EAN');
  ok(await p.inputValue('#scan') === '', 'scanner field cleared');
  await p.fill('#scan', 'sku09'); await p.press('#scan', 'Enter');
  await p.fill('#scan', '123'); await p.press('#scan', 'Enter');
  ok(/Ukjent kode: 123/.test(await p.innerText('main')), 'scanner unknown code error');
  ok(/2× |1× Joggesko/.test(await p.innerText('main')) && /Ladekabel/.test(await p.innerText('main')), 'scanned items in custom order');
  ok(await p.evaluate(function () { return document.activeElement.id === 'scan'; }), 'scanner keeps focus');
  for (var q = 0; q < 24; q++) await p.evaluate(function () { /* add via button */ document.querySelectorAll('.queue button').forEach(function (b) { if (b.textContent === 'Ny ordre') b.click(); }); });
  ok(await p.evaluate(function () { return window.__pb.S.queue.length === 20; }), 'queue capped at 20');

  console.log('== manager tab');
  await p.click('role=tab[name="Leder"]');
  await p.waitForFunction(function () { return /Foreslått ny eske|Ingen ny eske/.test(document.body.innerText); }, null, { timeout: 8000 });
  var mt = await p.innerText('main');
  ok(/O1001/.test(mt) && /O1006/.test(mt) && /Totalt/.test(mt), 'manager table with totals');
  console.log('     ' + (mt.match(/(Foreslått ny eske[^\n]*|Ingen ny eske[^\n]*)/) || [''])[0]);
  var fms = await p.evaluate(function () { return window.__pbFinderMs; });
  ok(fms < 3000, 'missing-box finder finished in ' + fms + ' ms (< 3000)');
  ok(await p.evaluate(function () { return document.querySelector('svg.chart') !== null; }), 'SVG bar chart present');
  ok(await p.evaluate(function () { return document.documentElement.scrollWidth <= window.innerWidth; }), 'manager tab no horizontal overflow at 360px');

  console.log('== self-test tab');
  await p.click('role=tab[name="Selvtest"]');
  ok(/Selvtest: 23\/23 bestått/.test(await p.innerText('#stSummary')), 'on load: 23/23 (fuzz deferred)');
  await p.click('text=Kjør alle inkl. fuzz (T14)');
  await p.waitForFunction(function () { return /24\/24/.test(document.querySelector('#stSummary').textContent); }, null, { timeout: 30000 });
  ok(true, 'after fuzz button: ' + (await p.innerText('#stSummary')));
  ok(await p.evaluate(function () { return document.documentElement.scrollWidth <= window.innerWidth; }), 'selftest no horizontal overflow');

  console.log('== language toggle changes ALL visible text');
  for (var tabName of [['Pakking', 'pack'], ['Leder', 'leader'], ['Selvtest', 'selftest']]) {
    for (var li = 0; li < langs.length; li++) {
      var L = langs[li];
      await p.click('role=tab >> nth=' + ['pack', 'leader', 'selftest'].indexOf(tabName[1]));
      await p.click('button.lang:text-is("' + L + '")');
      var body = await p.evaluate(function () { return document.body.innerText; });
      ok(await p.evaluate(function () { return document.documentElement.scrollWidth <= window.innerWidth; }), tabName[1] + '/' + L + ' no overflow');
      if (L !== 'NO') {
        var leaks = [];
        Object.keys(I18N.NO).forEach(function (k) {
          var no = I18N.NO[k];
          if (no !== I18N[L][k] && no.indexOf('{') < 0 && no.length > 6 && body.indexOf(no) >= 0 && I18N[L][k].indexOf(no) < 0) leaks.push(k);
        });
        ok(leaks.length === 0, tabName[1] + '/' + L + ' no Norwegian strings leaked ' + leaks.join(','));
      }
    }
  }
  await p.click('button.lang:text-is("NO")');
  console.log('== console on phone page');
  ok(p._logs.length === 0, 'zero console errors/warnings (' + p._logs.join(' | ') + ')');
  await p.screenshot({ path: path.join(__dirname, 'shot-phone.png'), fullPage: false });
  await p.context().close();

  console.log('== desktop 1280px');
  var d = await open(1280, 900);
  await d.selectOption('#orderSel', 'O1003');
  var dt = await d.innerText('main');
  ok(/Maskinkontrollert ✓/.test(dt) && /Skjør – ikke legg noe tungt oppå/.test(dt) && /Fyll .* L tomrom med papir/.test(dt), 'O1003 shows fragile warning + filler step');
  ok(await d.evaluate(function () { return document.querySelectorAll('svg.viz').length >= 2; }), 'top-down and isometric SVGs rendered');
  await d.click('main .layers button >> nth=1').catch(function () { });
  await d.screenshot({ path: path.join(__dirname, 'shot-desktop.png'), fullPage: true });
  ok(d._logs.length === 0, 'desktop zero console errors (' + d._logs.join(' | ') + ')');
  await d.context().close();

  console.log('== localStorage blocked (file:// safety)');
  var b = await open(390, 800, true);
  await b.selectOption('#orderSel', 'O1006');
  await b.fill('#dimL', '10'); await b.fill('#dimW', '10'); await b.fill('#dimH', '3');
  await b.click('text=Lagre mål');
  ok(/Maskinkontrollert ✓/.test(await b.innerText('main')), 'works with blocked localStorage (memory fallback)');
  await b.click('button.lang:text-is("EN")');
  ok(/Right box. Proven./.test(await b.innerText('header')), 'language switch works with blocked storage');
  ok(b._logs.length === 0, 'zero console errors with blocked storage (' + b._logs.join(' | ') + ')');
  await b.context().close();

  await browser.close();
  console.log('\n' + oks + ' checks ok, ' + fails.length + ' failed');
  if (fails.length) { console.log(fails.join('\n')); process.exit(1); }
})().catch(function (e) { console.error(e); process.exit(2); });
