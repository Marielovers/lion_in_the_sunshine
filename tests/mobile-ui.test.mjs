import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {DRAG_AXIS_DIRECTION, GARMENT_DRAG_DIRECTION, axisDirection, garmentDirection} from '../controls.config.mjs';
import {garmentProgress} from '../game-logic.mjs';
const read = name=>readFileSync(new URL('../'+name, import.meta.url));

test('new bed is exactly the portrait source image',()=>{
  const image=read('assets/bed.png');
  assert.equal(image.toString('ascii',1,4),'PNG');
  assert.equal(image.readUInt32BE(16),797);
  assert.equal(image.readUInt32BE(20),1254);
});
test('all touch axes are separately editable and default to existing directions',()=>{
  for(const part of ['bol','head','sholder','handleft','handright','feetleft','feetright','thighleft','thighright','belly','breast','pussy']){
    for(const axis of ['X','Y']) assert.ok([1,-1].includes(DRAG_AXIS_DIRECTION[`touch${part}${axis}`]));
  }
  for(const limb of ['leftarm','rightarm','leftleg','rightleg']) assert.equal(axisDirection(limb),DRAG_AXIS_DIRECTION[limb]);
  assert.equal(axisDirection('anyUnknownParam'),1);
});
test('garment reversal swaps upward and downward pull without altering threshold',()=>{
  assert.equal(garmentProgress('hat',0,70,300,1),1);
  assert.equal(garmentProgress('hat',0,70,300,-1),0);
  assert.equal(garmentProgress('hat',0,-70,300,-1),1);
  assert.equal(garmentDirection('hat'),GARMENT_DRAG_DIRECTION.hat);
  assert.ok(Object.keys(GARMENT_DRAG_DIRECTION).length>=8);
});
test('responsive mobile board uses portrait aspect and large tap targets',()=>{
  const html=read('index.html').toString();
  const css=read('style.css').toString();
  const game=read('game.js').toString();
  const pkg=JSON.parse(read('package.json'));
  assert.match(css,/aspect-ratio:797\/1254/);
  assert.match(css,/touch-action:none/);
  assert.match(css,/min-width:48px;min-height:48px/);
  assert.match(css,/@media\(max-width:700px\)/);
  assert.match(html,/id="handButton"/);
  assert.match(html,/id="fistButton"/);
  assert.match(html,/id="sleepTrack"/);
  assert.doesNotMatch(html,/class="hint"|class="bottom-note"|class="site-header"/);
  assert.match(game,/axisDirection\(name\)/);
  assert.match(game,/garmentDirection\(pointer.zone\)/);
  assert.match(pkg.scripts['dev:mobile'],/--host 0\.0\.0\.0/);
});
