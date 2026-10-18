// node tests/fixlib.test.js — matching, merge-import and suggestions of the fixing library
const assert=require('assert');
const L=require('../js/fixlib.js');
L.reset([{pattern:'990224',type:'clamp',boreMin:21,boreMax:24},{pattern:'U1049*_9655??',type:'clamp',boreMin:24.5,boreMax:25.5}]);
assert.strictEqual(L.match('U104904_990224').pattern,'990224','substring match');
assert.strictEqual(L.match('u104904_990224<2>').pattern,'990224','case-insensitive, suffix ok');
assert.strictEqual(L.match('U104904_965561').pattern,'U1049*_9655??','wildcard over whole name');
assert.strictEqual(L.match('U104904_965561_X'),null,'wildcard is anchored');
assert.strictEqual(L.match('U107338_PIPING-2_PRACTICE_1'),null,'pipe is not a fixing');
assert.strictEqual(L.match(null,'label 990224').pattern,'990224','any of the names');
assert.strictEqual(L.suggest('U104904_990224'),'990224');
assert.strictEqual(L.suggest('BRACKET_A'),'BRACKET_A');
const r=L.fromJSON(JSON.stringify({entries:[{pattern:'990224',type:'clip',boreMin:20,boreMax:23},{pattern:'22402156',type:'clip',boreMin:12,boreMax:13}]}));
assert.deepStrictEqual(r,{added:1,replaced:1});
assert.strictEqual(L.match('X_990224').type,'clip','import replaced by pattern');
assert.strictEqual(L.all().length,3);
const back=JSON.parse(L.toJSON());assert.strictEqual(back.kind,'fixing-library');assert.ok(back.entries.every(e=>!('id'in e)));
assert.throws(()=>L.fromJSON('{"x":1}'));
console.log('fixlib: all tests passed');
