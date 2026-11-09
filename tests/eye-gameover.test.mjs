import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {happyEndingMessage, isGameOver, lockSleepAt100, applyChange} from '../game-logic.mjs';
const game=readFileSync(new URL('../game.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
test('sleep zero with wake >= 50 is not a game over, and never auto-opens eyes',()=>{
  assert.equal(isGameOver(0,50),false);
  assert.equal(isGameOver(0,49),true);
  assert.match(game,/const open=state\.gameOver \|\| \(cheatEnabled && eyesForcedOpen\);/);
  assert.doesNotMatch(game,/eye:state\.sleep<=0/);
});
test('5512 first activates cheat and shows eye icon; later clicks toggle eyes',()=>{
  assert.match(html,/>5512<\/button>/);
  const handler=game.match(/lockButton\.addEventListener\('click',\(\)=>\{([\s\S]*?)\n\}\);/)?.[1] || '';
  assert.ok(handler.includes('if(!cheatEnabled){'));
  assert.ok(handler.indexOf('state=lockSleepAt100(state)') < handler.indexOf('}else{'));
  assert.ok(handler.indexOf('eyesForcedOpen=!eyesForcedOpen') > handler.indexOf('}else{'));
  assert.match(game,/lockButton\.innerHTML=eyesForcedOpen\?EYE_OPEN_ICON:EYE_CLOSED_ICON;/);
  assert.match(game,/cheatEnabled=false;eyesForcedOpen=false;/);
});
test('wake >= 50 changes the happy ending to a question',()=>{
  assert.equal(happyEndingMessage(49),'리온은 꿀잠을 잤습니다');
  assert.equal(happyEndingMessage(50),'리온은 꿀잠을 잤습니다?');
  assert.match(game,/happyEndTitle'\)\.textContent=happyEndingMessage\(state\.wake\)/);
});
test('open eyes, await isolated game-over voice, then show the overlay',()=>{
  const body=game.match(/async function stopIfGameOver\(\)\{([\s\S]*?)\n\}/)?.[1] || '';
  assert.ok(body.indexOf('voice.stop()')>=0);
  assert.ok(body.indexOf("await voice.playExclusive('Voice_Lion_GameOver')")>body.indexOf('voice.stop()'));
  assert.ok(body.indexOf("$('gameOver').classList.remove('hidden')")>body.indexOf("await voice.playExclusive('Voice_Lion_GameOver')"));
});

test('cheat activation holds sleep at 100 and Zzz at zero',()=>{
  const on=lockSleepAt100({sleep:17,happy:42,wake:54,gameOver:false,ending:false});
  assert.equal(on.sleep,100);assert.equal(on.happy,0);assert.equal(on.sleepLocked,true);
  const after=applyChange(on,{sleep:-100,happy:25,wake:3});
  assert.equal(after.sleep,100);assert.equal(after.happy,0);assert.equal(after.wake,57);
});
