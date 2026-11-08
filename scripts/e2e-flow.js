'use strict';
var path = require('path'), chromium = require('playwright').chromium;
(async function () {
  var b = await chromium.launch(), pg = await (await b.newContext({ viewport: { width: 390, height: 800 } })).newPage(), logs = [], bad = 0;
  pg.on('console', function (m) { if (/error|warning/.test(m.type())) logs.push(m.text()); });
  pg.on('pageerror', function (e) { logs.push(e.message); });
  function ok(c, m) { console.log((c ? '  ok   ' : '  FAIL ') + m); if (!c) bad++; }
  await pg.goto('file://' + path.join(__dirname, '..', 'index.html'));
  await pg.waitForSelector('#orderSel');
  // queue: 3 orders, open first, Passet moves to the next
  await pg.click('summary:has-text("Live-kø")');
  for (var i = 0; i < 3; i++) await pg.click('text=Ny ordre');
  await pg.click('.queue button.qi >> nth=0');
  var first = await pg.evaluate(function () { return window.__pb.S.qOrder.id; });
  var box = await pg.locator('.actionbar').boundingBox();
  ok(box && box.y + box.height <= 800 + 1, 'Passet/Passet ikke bar is on screen without scrolling');
  await pg.click('.actionbar >> text=Passet');
  var st = await pg.evaluate(function () { return { id: window.__pb.S.qOrder && window.__pb.S.qOrder.id, n: window.__pb.S.queue.length }; });
  ok(st.n === 2 && st.id && st.id !== first, 'one tap on Passet removed ' + first + ' and opened ' + st.id);
  // Enter saves dims
  await pg.selectOption('#orderSel', 'O1006');
  ok(await pg.evaluate(function () { return document.activeElement.id === 'dimL'; }), 'first dimension field auto-focused');
  await pg.keyboard.type('10'); await pg.keyboard.press('Tab'); await pg.keyboard.type('10'); await pg.keyboard.press('Tab'); await pg.keyboard.type('3'); await pg.keyboard.press('Enter');
  ok(/Maskinkontrollert ✓/.test(await pg.innerText('main')), 'typing 10 Tab 10 Tab 3 Enter -> verified (no mouse)');
  ok(await pg.evaluate(function () { return document.querySelector('details.more') && !document.querySelector('details.more').open; }), 'extras folded by default');
  ok(logs.length === 0, 'no console errors ' + logs.join('|'));
  await b.close(); process.exit(bad ? 1 : 0);
})();
