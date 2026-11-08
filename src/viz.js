/* PakkBevis SVG drawing (DOM code, no libraries). Uses textContent / attributes only. */
(function (root) {
  'use strict';
  var NS = 'http://www.w3.org/2000/svg';
  var uid = 0;

  function el(tag, attrs, parent) {
    var e = document.createElementNS(NS, tag);
    for (var k in attrs) e.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(e);
    return e;
  }
  function text(parent, x, y, size, str, fill) {
    var t = el('text', { x: x, y: y, 'font-size': size, 'text-anchor': 'middle', 'dominant-baseline': 'central', fill: fill || '#111', 'font-weight': '700' }, parent);
    t.textContent = str;
    return t;
  }
  function f1(v) { return String(Math.round(v * 10) / 10); }

  var V = {};
  V.colorOf = function (id) {
    var n = parseInt(String(id).replace(/\D/g, ''), 10) || 0;
    return 'hsl(' + ((n * 47) % 360) + ',62%,66%)';
  };
  V.label = function (id) { return String(id).replace(/^SKU/, ''); };

  V.topView = function (box, placements, layerZ, ariaLabel) {
    var id = 'hatch' + (++uid), pad = 2;
    var s = el('svg', { viewBox: (-pad) + ' ' + (-pad) + ' ' + (box.L + 2 * pad) + ' ' + (box.W + 2 * pad), role: 'img', 'aria-label': ariaLabel, class: 'viz' });
    var defs = el('defs', {}, s);
    var pat = el('pattern', { id: id, width: 3, height: 3, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
    el('rect', { width: 3, height: 3, fill: '#fff' }, pat);
    el('line', { x1: 0, y1: 0, x2: 0, y2: 3, stroke: '#c5ccd6', 'stroke-width': 0.8 }, pat);
    el('rect', { x: 0, y: 0, width: box.L, height: box.W, fill: 'url(#' + id + ')', stroke: '#334', 'stroke-width': 0.8 }, s);
    placements.forEach(function (p) {
      if (p.z > layerZ + 1e-9) return;
      var cur = Math.abs(p.z - layerZ) < 1e-9;
      var g = el('g', { opacity: cur ? 1 : 0.35 }, s);
      var r = el('rect', { x: p.x, y: p.y, width: p.w, height: p.d, fill: V.colorOf(p.itemId), stroke: '#111', 'stroke-width': 0.6 }, g);
      if (p.fragile) { r.setAttribute('stroke-dasharray', '2 1.2'); r.setAttribute('stroke-width', 1); }
      if (cur) text(g, p.x + p.w / 2, p.y + p.d / 2, Math.max(2.5, Math.min(6, Math.min(p.w, p.d) * 0.45)), V.label(p.itemId));
    });
    return s;
  };

  V.iso = function (box, placements, ariaLabel) {
    var c = 0.866, sn = 0.5;
    function px(x, y) { return (x - y) * c; }
    function py(x, y, z) { return (x + y) * sn - z; }
    var minX = -box.W * c - 2, maxX = box.L * c + 2, minY = -box.H - 2, maxY = (box.L + box.W) * sn + 2;
    var s = el('svg', { viewBox: minX + ' ' + minY + ' ' + (maxX - minX) + ' ' + (maxY - minY), role: 'img', 'aria-label': ariaLabel, class: 'viz' });
    function poly(pts, fill, stroke, dash, parent) {
      var p = el('polygon', { points: pts.map(function (q) { return f1(q[0]) + ',' + f1(q[1]); }).join(' '), fill: fill, stroke: stroke, 'stroke-width': 0.5 }, parent || s);
      if (dash) p.setAttribute('stroke-dasharray', '2 1.2');
      return p;
    }
    poly([[px(0, 0), py(0, 0, 0)], [px(box.L, 0), py(box.L, 0, 0)], [px(box.L, box.W), py(box.L, box.W, 0)], [px(0, box.W), py(0, box.W, 0)]], '#eef1f5', '#334');
    var list = placements.slice().sort(function (a, b) {
      return (a.x + a.w / 2 + a.y + a.d / 2 + a.z + a.h / 2) - (b.x + b.w / 2 + b.y + b.d / 2 + b.z + b.h / 2);
    });
    list.forEach(function (p) {
      var col = V.colorOf(p.itemId), x0 = p.x, y0 = p.y, z0 = p.z, x1 = p.x + p.w, y1 = p.y + p.d, z1 = p.z + p.h, dash = p.fragile;
      var g = el('g', {}, s);
      poly([[px(x0, y1), py(x0, y1, z0)], [px(x1, y1), py(x1, y1, z0)], [px(x1, y1), py(x1, y1, z1)], [px(x0, y1), py(x0, y1, z1)]], col, '#111', dash, g).setAttribute('filter', 'brightness(0.85)');
      poly([[px(x1, y0), py(x1, y0, z0)], [px(x1, y1), py(x1, y1, z0)], [px(x1, y1), py(x1, y1, z1)], [px(x1, y0), py(x1, y0, z1)]], col, '#111', dash, g).setAttribute('filter', 'brightness(0.7)');
      poly([[px(x0, y0), py(x0, y0, z1)], [px(x1, y0), py(x1, y0, z1)], [px(x1, y1), py(x1, y1, z1)], [px(x0, y1), py(x0, y1, z1)]], col, '#111', dash, g);
      text(g, px((x0 + x1) / 2, (y0 + y1) / 2), py((x0 + x1) / 2, (y0 + y1) / 2, z1), Math.max(2.5, Math.min(5, Math.min(p.w, p.d) * 0.4)), V.label(p.itemId));
    });
    return s;
  };

  /* horizontal bar chart: rows [{label, before, after}] values 0..100 */
  V.bars = function (rows, labels, ariaLabel) {
    var rowH = 26, left = 52, W = 320, H = rows.length * rowH + 22;
    var s = el('svg', { viewBox: '0 0 ' + W + ' ' + H, role: 'img', 'aria-label': ariaLabel, class: 'chart' });
    rows.forEach(function (r, i) {
      var y = i * rowH + 4, bw = W - left - 36;
      var t = el('text', { x: 0, y: y + 12, 'font-size': 11, fill: 'currentColor' }, s); t.textContent = r.label;
      if (r.before !== null) {
        el('rect', { x: left, y: y, width: Math.max(0.5, bw * r.before / 100), height: 10, fill: '#b8c0cc' }, s);
        var tb = el('text', { x: left + bw * r.before / 100 + 3, y: y + 9, 'font-size': 9, fill: 'currentColor' }, s); tb.textContent = f1(r.before) + '%';
      }
      if (r.after !== null) {
        el('rect', { x: left, y: y + 11, width: Math.max(0.5, bw * r.after / 100), height: 10, fill: '#0b6e4f' }, s);
        var ta = el('text', { x: left + bw * r.after / 100 + 3, y: y + 20, 'font-size': 9, fill: 'currentColor' }, s); ta.textContent = f1(r.after) + '%';
      }
    });
    var ly = rows.length * rowH + 8;
    el('rect', { x: left, y: ly, width: 9, height: 9, fill: '#b8c0cc' }, s);
    var l1 = el('text', { x: left + 13, y: ly + 8, 'font-size': 10, fill: 'currentColor' }, s); l1.textContent = labels.before;
    el('rect', { x: left + 110, y: ly, width: 9, height: 9, fill: '#0b6e4f' }, s);
    var l2 = el('text', { x: left + 123, y: ly + 8, 'font-size': 10, fill: 'currentColor' }, s); l2.textContent = labels.after;
    return s;
  };

  root.PBViz = V;
})(window);
