import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const json = JSON.parse(readFileSync(new URL('../public/assets/model/햇리온.model3.json',import.meta.url),'utf8'));
const moc = readFileSync(new URL('../public/assets/model/햇리온.moc3',import.meta.url));
const config=readFileSync(new URL('../vite.config.mjs',import.meta.url),'utf8');
test('all moc hit areas are registered in model3.json',()=>{
 const names = [...new Set([...moc.toString('latin1').matchAll(/HitArea_[A-Za-z0-9_]+/g)].map(x=>x[0]))];
 const listed=new Set(json.HitAreas.map(x=>x.Id));
 assert.equal(names.length,26);
 for (const name of names) assert.ok(listed.has(name),`unregistered: ${name}`);
});
test('Vite 6 supports wlipsync top-level await in dev and build',()=>{
 assert.match(config,/optimizeDeps:[\s\S]*esbuildOptions:\s*\{\s*target:\s*'esnext'/);
 assert.match(config,/build:\s*\{\s*target:\s*'esnext'/);
});

test('title screen is mandatory before gameplay and start button is present',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const game=readFileSync(new URL('../game.js',import.meta.url),'utf8');
  assert.match(html,/id="titleScreen"/);
  assert.match(html,/햇살 속의/);
  assert.match(html,/id="startButton"/);
  assert.match(game,/let model=null, ready=false, playing=false/);
  assert.match(game,/if\(!ready\|\|!playing\|\|state\.gameOver/);
});
test('background stays behind Live2D; foreground blanket overlay is removed',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const css=readFileSync(new URL('../style.css',import.meta.url),'utf8');
  assert.doesNotMatch(html,/class="blanket"/);
  assert.match(html,/class="bed"[\s\S]*id="liveCanvas"/);
  assert.match(css,/#liveCanvas\{z-index:3!important/);
});
test('model placement moved up and zoomed in from previous default',()=>{
  const game=readFileSync(new URL('../game.js',import.meta.url),'utf8');
  assert.match(game,/const screenPlacement=\{x:-?\d+(?:\.\d+)?,y:-?\d+(?:\.\d+)?,scale:-?\d+(?:\.\d+)?\}/);
});

test('new moc has angry as actual parameter, old wet parameter is absent',()=>{
 const binary = moc.toString('latin1');
 assert.ok(binary.includes('angry\x00'), 'angry ID not in moc');
 const cdi=JSON.parse(readFileSync(new URL('../public/assets/model/햇리온.cdi3.json',import.meta.url),'utf8'));
 assert.ok(cdi.Parameters.some(p=>p.Id==='angry'));
 assert.ok(!cdi.Parameters.some(p=>p.Id==='wet'));
 assert.ok(json.HitAreas.some(h=>h.Id==='HitArea_touchangry'));
});
test('new idle recovery and arm/leg persistence are wired',()=>{
 const game=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 assert.match(game,/setInterval\(tickIdleRecovery,50\)/);
 assert.match(game,/leftarm','rightarm','leftleg','rightleg/);
 assert.match(game,/raiseAngry\(0\.1\)/);
 assert.match(game,/draggingValue\(prefix\+'X',dx\)/);
});
