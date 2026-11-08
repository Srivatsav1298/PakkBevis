'use strict';
// Inlines CSS + JS into one self-contained index.html
var fs = require('fs'), path = require('path');
function rd(f) { return fs.readFileSync(path.join(__dirname, f), 'utf8'); }
var html = rd('src/index.template.html');
var parts = { CSS: 'src/style.css', I18N: 'src/i18n.js', CORE: 'src/core.js', TESTS: 'src/tests.js', VIZ: 'src/viz.js', UI: 'src/ui.js' };
Object.keys(parts).forEach(function (k) {
  var src = rd(parts[k]);
  if (/<\/script/i.test(src)) throw new Error(parts[k] + ' contains </script');
  html = html.split('/*__' + k + '__*/').join(function () { return src; }.call ? src : src);
});
fs.writeFileSync(path.join(__dirname, 'index.html'), html);
console.log('index.html written, ' + html.length + ' bytes');
