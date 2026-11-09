import test from 'node:test';
import assert from 'node:assert/strict';
import {INITIAL, MAX_SLEEP, applyChange, isGameOver,zoneFor,dragEffect,punchEffect,garmentProgress,parameterForGarment,CLOTHING_DEFAULTS,combinedDragEffect,gestureEffect,idleRecoveryDelta,IDLE_RECOVERY_DELAY_MS,IDLE_RECOVERY_PER_SECOND,dragValueForParameter} from '../game-logic.mjs';
const p=(v={})=>({...CLOTHING_DEFAULTS,...v});
test('maximum sleep is 100 and start is 100',()=>{ assert.equal(MAX_SLEEP,100);assert.equal(INITIAL.sleep,100); });
test('sleep 0, wake 49 -> game over',()=>assert.equal(isGameOver(0,49),true));
test('sleep 0, wake 50 -> continue',()=>assert.equal(isGameOver(0,50),false));
test('sleep zero and wake 100 stay playable',()=>assert.equal(applyChange({...INITIAL,sleep:1,wake:90},{sleep:-100}).gameOver,false));
test('fist costs 100 sleep in one hit',()=>{const s=applyChange({...INITIAL},punchEffect('face'));assert.equal(s.sleep,0);assert.equal(s.faceHits,1);});
test('sleep and wake clamp',()=>{const s=applyChange({...INITIAL,sleep:1,wake:99},{sleep:-100,wake:10});assert.equal(s.sleep,0);assert.equal(s.wake,100);assert.equal(s.gameOver,false);});
test('cheek and face hitarea are recognized',()=>{assert.equal(zoneFor(['HitArea_touchbol']),'cheek');assert.equal(zoneFor(['HitArea_touchface'],'fist'),'face');});
test('fist cannot touch ordinary hand zones',()=>assert.equal(zoneFor(['HitArea_touchhandleft'],'fist'),null));
test('belly requires removed coat',()=>{assert.equal(zoneFor(['HitArea_touchbelly'],'fist',p()),null);assert.equal(zoneFor(['HitArea_touchbelly'],'fist',p({removecoat:1})),'belly');});
test('coat comes before ribbon and shirt',()=>{assert.equal(zoneFor(['HitArea_coatR']),'coatRight');assert.equal(zoneFor(['HitArea_removeriborn']),null);assert.equal(zoneFor(['HitArea_removeriborn'],'hand',p({removecoat:1})),'ribbon');});
test('shirt buttons need ribbon and coat',()=>{const a=['HitArea_removeshirtleft'];assert.equal(zoneFor(a,'hand',p({removecoat:1})),null);assert.equal(zoneFor(a,'hand',p({removecoat:1,removeriborn:1})),'shirtButton');assert.equal(zoneFor(a,'hand',p({removecoat:1,removeriborn:1,removeshirtbotton:3,pants:1})),'shirtLeft');});
test('pants button and pants progression',()=>{assert.equal(zoneFor(['HitArea_removepantsbotton'],'hand',p({removecoat:1})),'pantsButton');assert.equal(zoneFor(['HitArea_removepants'],'hand',p({pantsbotton:1})),'pants');});
test('sock removal precedes thigh petting, leg move needs pants',()=>{const a=['HitArea_touchthighleft'];assert.equal(zoneFor(a,'hand',p({removecoat:1})),'socks');assert.equal(zoneFor(a,'hand',p({removecoat:1,removesock:1})),'thighLeft');assert.equal(zoneFor(a,'hand',p({pants:1})),'legLeft');});
test('garment direction and fixed progress',()=>{assert.equal(garmentProgress('coatLeft',-50,0,250),1);assert.equal(garmentProgress('coatLeft',50,0,250),0);assert.equal(garmentProgress('hat',0,30,250),.75);assert.equal(parameterForGarment('ribbon'),'removeriborn');});
test('each drag effect changes sleep/wake from spreadsheet',()=>{assert.deepEqual(dragEffect('belly'),{sleep:-1,wake:1});assert.deepEqual(dragEffect('frontLeft'),{sleep:-5,wake:1});assert.deepEqual(dragEffect('socks'),{sleep:-1,wake:0});});
test('new angry hitarea unlocks when pants prerequisite met',()=>{
 assert.equal(zoneFor(['HitArea_touchangry'],'hand',p()),null);
 assert.equal(zoneFor(['HitArea_touchangry'],'hand',p({pants:2})),'angryTouch');
 assert.deepEqual(gestureEffect('angryTouch',10,10,p({pants:2})),{sleep:-6,wake:6});
});

test('sleep recovery starts immediately on mouse release and is faster',()=>{
  assert.equal(IDLE_RECOVERY_DELAY_MS,0);
  assert.ok(IDLE_RECOVERY_PER_SECOND>=5);
  assert.equal(idleRecoveryDelta(1100,1000,1000),0.1*IDLE_RECOVERY_PER_SECOND);
  assert.equal(idleRecoveryDelta(1250,1000,1100),0.15*IDLE_RECOVERY_PER_SECOND);
});
test('recovery pauses while held and immediately resumes after release',()=>{
  assert.equal(idleRecoveryDelta(5000,2000,4900,true),0);
  assert.equal(idleRecoveryDelta(5100,5000,5000),.1*IDLE_RECOVERY_PER_SECOND);
});
test('recovery tick only counts the newest interval',()=>{
  assert.equal(idleRecoveryDelta(6100,0,6000),0.1*IDLE_RECOVERY_PER_SECOND);
});
test('recovery remains bounded by 100 and does not reset a game over',()=>{
  const healed=applyChange({...INITIAL,sleep:99.9},{sleep:100});
  assert.equal(healed.sleep,100);
  const knockedOut=applyChange({...INITIAL,sleep:0,wake:0,gameOver:true},{sleep:20});
  assert.equal(knockedOut.sleep,0);
  assert.equal(knockedOut.gameOver,true);
});
test('recovery from sleep zero is possible when wake >= 50',()=>{
  const healed=applyChange({...INITIAL,sleep:0,wake:50},{sleep:idleRecoveryDelta(6000,0,5000)});
  assert.equal(healed.sleep,IDLE_RECOVERY_PER_SECOND);
  assert.equal(healed.gameOver,false);
});

// Regression tests for the spreadsheet's mutually dependent costume/action rules.
test('coat unlocked interactions include arm, shoulder, torso and hand chest gestures',()=>{
 for(const [id,z] of [['HitArea_movearmleft','armLeft'],['HitArea_movearmright','armRight'],
   ['HitArea_sholder','shoulder'],['HitArea_touchbelly','belly'],
   ['HitArea_touchbreastleft','frontLeft'],['HitArea_touchbreastright','frontRight']]){
   assert.equal(zoneFor([id],'hand',p()),null,`${z} must be gated`);
   assert.equal(zoneFor([id],'hand',p({removecoat:1})),z,`${z} unlocked`);
 }
});
test('fist on left/right torso requires shirt removed; hand mode only requires coat',()=>{
 for(const [id,z] of [['HitArea_touchbreastleft','frontLeft'],['HitArea_touchbreastright','frontRight']]){
  assert.equal(zoneFor([id],'fist',p({removecoat:1})),null);
  assert.equal(zoneFor([id],'fist',p({removeshirt:1})),z);
  assert.equal(zoneFor([id],'hand',p({removecoat:1})),z);
 }
});
test('both thigh directions and both leg movements unlock with proper clothing',()=>{
 assert.equal(zoneFor(['HitArea_touchthighleft'],'hand',p()),null);
 assert.equal(zoneFor(['HitArea_touchthighleft'],'hand',p({removesock:1})),'thighLeft');
 assert.equal(zoneFor(['HitArea_touchthighright'],'hand',p({removesock:1})),'thighRight');
 assert.equal(zoneFor(['HitArea_movelegleft'],'hand',p({pants:1})),'legLeft');
 assert.equal(zoneFor(['HitArea_movelegright'],'hand',p({pants:1})),'legRight');
 assert.equal(zoneFor(['HitArea_touchthighright'],'hand',p({pants:1})),'legRight');
});
test('leg and thigh effect can apply together after both prerequisites',()=>{
 assert.deepEqual(combinedDragEffect('thighRight',p({pants:1,removesock:1}),0,30),{sleep:-3,wake:1});
 assert.deepEqual(combinedDragEffect('thighRight',p({pants:1,removesock:1}),30,0),{sleep:-1,wake:1});
 assert.deepEqual(combinedDragEffect('thighLeft',p(),0,30),{sleep:-1,wake:1});
});
test('both shirt sides require exactly three buttons and removed trousers',()=>{
 const ok=p({removecoat:1,removeriborn:1,removeshirtbotton:3,pants:1});
 for(const [id,z] of [['HitArea_removeshirtleft','shirtLeft'],['HitArea_removeshirtright','shirtRight']]){
   assert.equal(zoneFor([id],'hand',ok),z);
   assert.equal(zoneFor([id],'hand',p({...ok,pants:0})),null);
 }
});
test('hand/feet/head/cheek are available with clothing present',()=>{
 for(const [id,z] of [['HitArea_touchhandleft','handLeft'],['HitArea_touchhandright','handRight'],
   ['HitArea_touchfeetleft','footLeft'],['HitArea_touchfeetright','footRight'],
   ['HitArea_touchhaed','head'],['HitArea_touchbol','cheek']]){
   assert.equal(zoneFor([id]),z);
   assert.deepEqual(dragEffect(z),{sleep:-1,wake:0});
 }
});
test('sheet rule effects for all arm, leg, belly, chest and thigh gestures',()=>{
 for(const z of ['armLeft','armRight','legLeft','legRight'])assert.deepEqual(dragEffect(z),{sleep:-2,wake:0});
 for(const z of ['thighLeft','thighRight'])assert.deepEqual(dragEffect(z),{sleep:-1,wake:1});
 for(const z of ['frontLeft','frontRight'])assert.deepEqual(dragEffect(z),{sleep:-5,wake:1});
});

test('spreadsheet treats x and y drag effects separately',()=>{
 assert.deepEqual(gestureEffect('belly',9,0,p()),{sleep:-1,wake:1});
 assert.deepEqual(gestureEffect('belly',0,9,p()),{sleep:-1,wake:1});
 assert.deepEqual(gestureEffect('belly',9,9,p()),{sleep:-2,wake:2});
 assert.deepEqual(gestureEffect('frontRight',9,9,p()),{sleep:-10,wake:2});
});
test('joint drag needs vertical movement; garment drag needs forward progress',()=>{
 assert.deepEqual(gestureEffect('armLeft',20,0,p()),{sleep:0,wake:0});
 assert.deepEqual(gestureEffect('armLeft',0,-20,p()),{sleep:-2,wake:0});
 assert.deepEqual(gestureEffect('hat',0,-9,p(),0),{sleep:0,wake:0});
 assert.deepEqual(gestureEffect('hat',0,9,p(),0.25),{sleep:-1,wake:0});
});
test('thigh with lifted leg applies both rules on vertical drag',()=>{
 assert.deepEqual(gestureEffect('thighLeft',0,9,p({removesock:1,pants:1})),{sleep:-3,wake:1});
 assert.deepEqual(gestureEffect('thighLeft',9,9,p({removesock:1,pants:1})),{sleep:-4,wake:2});
});

test('drag uses each real parameter min, max and default independently',()=>{
  assert.equal(dragValueForParameter(90,{minimum:-30,maximum:30,defaultValue:0}),30);
  assert.equal(dragValueForParameter(-90,{minimum:-30,maximum:30,defaultValue:0}),-30);
  assert.equal(dragValueForParameter(45,{minimum:-30,maximum:30,defaultValue:0}),15);
  assert.equal(dragValueForParameter(90,{minimum:0,maximum:1,defaultValue:0}),1);
  assert.equal(dragValueForParameter(90,{minimum:-5,maximum:15,defaultValue:5}),15);
  assert.equal(dragValueForParameter(-90,{minimum:-5,maximum:15,defaultValue:5}),-5);
});
