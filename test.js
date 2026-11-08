'use strict';
var PB = require('./src/core.js');
var I18N = require('./src/i18n.js');
var T = require('./src/tests.js');

var results = T.run(PB, I18N, { heavy: true, log: console.log });
var failed = 0;
results.forEach(function (r) {
  if (!r.pass) failed++;
  console.log((r.pass ? 'PASS ' : 'FAIL ') + r.id + ' ' + r.name + ' (' + r.ms.toFixed(1) + ' ms)' + (r.pass ? '' : '\n     -> ' + r.msg));
});
console.log('\n' + (results.length - failed) + '/' + results.length + ' passed');
process.exit(failed ? 1 : 0);
