import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {
  INITIAL, MAX_HAPPY, MAX_SLEEP, HAPPY_PER_ACTION, HAPPY_BY_TOUCH_ZONE,
  happyGainForInteraction, applyChange, applyActionChange, lockSleepAt100,
  gestureEffect, CLOTHING_DEFAULTS,
} from '../game-logic.mjs';

const allowed=['head','shoulder','handLeft','handRight','footLeft','footRight','thighLeft','thighRight','belly'];
const disallowed=['cheek','face','angryTouch','frontLeft','frontRight','hat','coatLeft','coatRight',
  'ribbon','socks','shirtLeft','shirtRight','shirtButton','pantsButton','pants','armLeft','armRight','legLeft','legRight'];

test('happy starts at zero, maximum is 100, default per-touch multiplier is one',()=>{
  assert.equal(INITIAL.happy,0); assert.equal(MAX_HAPPY,100);
  assert.equal(HAPPY_PER_ACTION,1);
  assert.deepEqual(Object.keys(HAPPY_BY_TOUCH_ZONE).sort(),allowed.slice().sort());
});

test('only designated areas with hand mode earn happy',()=>{
  for(const zone of allowed){
    assert.equal(happyGainForInteraction('hand',zone),1,`hand ${zone}`);
    assert.equal(applyActionChange(INITIAL,{}, {mode:'hand',zone}).happy,1,zone);
    assert.equal(happyGainForInteraction('fist',zone),0,`fist ${zone}`);
    assert.equal(applyActionChange(INITIAL,{sleep:-1},{mode:'fist',zone}).happy,0,zone);
  }
  for(const zone of disallowed){
    assert.equal(happyGainForInteraction('hand',zone),0,`other hand ${zone}`);
    assert.equal(applyActionChange({...INITIAL,sleepLocked:true},{sleep:-1},{mode:'hand',zone}).happy,0,zone);
  }
});

test('belly/thigh hand touches earn happy despite waking up',()=>{
  for(const zone of ['belly','thighLeft','thighRight']){
    const rule=gestureEffect(zone,8,0,CLOTHING_DEFAULTS);
    assert.ok(rule.wake>0);
    const next=applyActionChange(INITIAL,rule,{mode:'hand',zone});
    assert.equal(next.happy,1);assert.ok(next.wake>0);
    const capped=applyActionChange({...INITIAL,wake:100},rule,{mode:'hand',zone});
    assert.equal(capped.happy,1);assert.equal(capped.wake,100);
  }
});

test('a fist hit, garment release, button press, and angry touch do not earn happy',()=>{
  assert.equal(applyActionChange({...INITIAL,sleepLocked:true},{sleep:-100,wake:0,hit:'head'},{mode:'fist',zone:'head'}).happy,0);
  assert.equal(applyActionChange(INITIAL,{sleep:-1}).happy,0);
  assert.equal(applyActionChange(INITIAL,{happy:20},{mode:'hand',zone:'hat'}).happy,0);
  assert.equal(applyActionChange(INITIAL,{happy:20}).happy,0);
  assert.equal(applyActionChange(INITIAL,{sleep:0,wake:0},{mode:'hand',zone:'angryTouch'}).happy,0);
});

test('passive sleep recovery does not increase happy',()=>{
  const next=applyChange({...INITIAL,sleep:25,happy:13},{sleep:8});
  assert.equal(next.happy,13);
});

test('100 happy triggers ending and takes priority over game over',()=>{
  const next=applyActionChange({...INITIAL,sleep:1,happy:99},{sleep:-100,wake:0},{mode:'hand',zone:'head'});
  assert.equal(next.happy,100); assert.equal(next.ending,true); assert.equal(next.gameOver,false);
});

test('happy clamps at 100 and winning blocks further actions',()=>{
  const next=applyChange({...INITIAL,happy:99},{happy:200});
  assert.equal(next.happy,100);assert.equal(next.ending,true);
  assert.deepEqual(applyActionChange(next,{sleep:-1},{mode:'hand',zone:'head'}),
    {...next,changedSleep:0,changedWake:0,changedHappy:0});
});

test('5521 fixes sleep at 100; punch still does not earn happy',()=>{
  const fixed=lockSleepAt100({...INITIAL,sleep:8});
  assert.equal(fixed.sleep,100);assert.equal(fixed.sleepLocked,true);
  const damaged=applyActionChange(fixed,{sleep:-100,wake:0,hit:'head'},{mode:'fist',zone:'head'});
  assert.equal(damaged.sleep,MAX_SLEEP);assert.equal(damaged.happy,0);
  assert.equal(INITIAL.sleepLocked,false);
});

test('Zzz happy HUD and hand pointer callsites are wired',()=>{
  const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
  const game=readFileSync(new URL('../game.js',import.meta.url),'utf8');
  for(const id of ['sleepLockButton','happyValue','happyEnding','endingRestartButton'])assert.ok(html.includes(`id="${id}"`));
  assert.match(html,/Zzz 0\/100/);
  assert.match(html,/리온은 꿀잠을 잤습니다/);
  assert.match(game,/happyValue\.textContent=`Zzz /);
  assert.match(game,/happyGainForInteraction\(mode,zone\)/);
  assert.match(game,/changeStats\(\{\},pt\.x,pt\.y,\{mode,zone\}\)/);
  assert.match(game,/changeStats\(rule,pt\.x,pt\.y,\{mode:pointer\.mode,zone:pointer\.zone\}\)/);
  assert.match(game,/applyActionChange\(state,change,context\)/);
  assert.doesNotMatch(game,/changeStats\(\{happy:1\}/);
});
