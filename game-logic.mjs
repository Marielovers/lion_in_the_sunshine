/** Browser-independent rules. Spreadsheet: 규칙(5).xlsx. */
export const MAX_SLEEP = 100;
export const MAX_WAKE = 100;
export const MAX_HAPPY = 300;
export const HAPPY_PER_ACTION = 1;
// Only hand touches on these Live2D body zones earn happy.
// Change individual values here, or use HAPPY_PER_ACTION to scale all of them.
export const HAPPY_BY_TOUCH_ZONE = Object.freeze({
  head: 1,
  shoulder: 1,
  handLeft: 1, handRight: 1,
  footLeft: 1, footRight: 1,
  thighLeft: 1, thighRight: 1,
  belly: 1,
});
export function happyGainForInteraction(mode,zone){
  return mode==='hand' && Object.hasOwn(HAPPY_BY_TOUCH_ZONE,zone)
    ? HAPPY_PER_ACTION * HAPPY_BY_TOUCH_ZONE[zone]
    : 0;
}
export const IDLE_RECOVERY_DELAY_MS = 0;
export const IDLE_RECOVERY_PER_SECOND = 8;
export function idleRecoveryDelta(nowMs, lastInteractionMs, lastTickMs, interacting=false) {
  if (interacting || ![nowMs,lastInteractionMs,lastTickMs].every(Number.isFinite)) return 0;
  return Math.max(0,nowMs-Math.max(lastTickMs,lastInteractionMs+IDLE_RECOVERY_DELAY_MS))*IDLE_RECOVERY_PER_SECOND/1000;
}
export const INITIAL = Object.freeze({
  sleep:100,wake:0,happy:0,sleepLocked:false,ending:false,cheekHits:0,faceHits:0,headHits:0,bellyHits:0,
  frontLeftHits:0,frontRightHits:0,gameOver:false,
});
export const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
export const isGameOver=(sleep,wake)=>sleep<=0 && wake<50;
/** When wake meets the no-game-over threshold, the happy ending has a question mark. */
export const happyEndingMessage=(wake)=>Number(wake)>=50?'리온은 꿀잠을 잤습니다?':'리온은 꿀잠을 잤습니다';
export const CLOTHING_DEFAULTS=Object.freeze({
  removehat:0,removecoat:0,removesock:0,removeriborn:0,
  removeshirtbotton:0,removeshirt:0,pantsbotton:0,pants:0,
});
export const FIXED_PARAMETERS=Object.freeze([
  ...Object.keys(CLOTHING_DEFAULTS),
  'cheekcolor','headcolor','bellycolor','leftbreastcolor','rightbreastcolor','blood','ojum','angry',
]);
export const ANIMATED_PARAMETERS=Object.freeze([
  'touchbolX','touchbolY','touchheadX','touchheadY',
  'touchsholderX','touchsholderY','touchhandleftX','touchhandleftY',
  'touchhandrightX','touchhandrightY','touchfeetleftX','touchfeetleftY',
  'touchfeetrightX','touchfeetrightY','touchthighleftX','touchthighleftY',
  'touchthighrightX','touchthighrightY','touchbellyX','touchbellyY',
  'touchbreastX','touchbreastY','touchpussyX','touchpussyY','leftarm','rightarm','leftleg','rightleg',
]);
export const ZONES=Object.freeze({
  HitArea_touchbol:'cheek',HitArea_touchface:'face',HitArea_touchhaed:'head',HitArea_touchangry:'angryTouch',
  HitArea_touchhandleft:'handLeft',HitArea_touchhandright:'handRight',
  HitArea_touchfeetleft:'footLeft',HitArea_touchfeetright:'footRight',
  HitArea_sholder:'shoulder',HitArea_touchbelly:'belly',
  HitArea_touchthighleft:'thighLeft',HitArea_touchthighright:'thighRight',
  HitArea_movearmleft:'armLeft',HitArea_movearmright:'armRight',
  HitArea_movelegleft:'legLeft',HitArea_movelegright:'legRight',
  HitArea_removehat:'hat',HitArea_coatL:'coatLeft',HitArea_coatR:'coatRight',
  HitArea_removeriborn:'ribbon',HitArea_removeshirtleft:'shirtLeft',
  HitArea_removeshirtright:'shirtRight',HitArea_removepantsbotton:'pantsButton',
  HitArea_removepants:'pants',HitArea_touchbreastleft:'frontLeft',
  HitArea_touchbreastright:'frontRight',
});
export const FIST_ZONES=Object.freeze(['cheek','face','head','belly','frontLeft','frontRight']);
/** Resolve overlapping Live2D mesh hit results by the spreadsheet's prerequisites.
 * Clothing is in the foreground while present, then body zones become clickable.
 */
export function zoneFor(areas=[],mode='hand',clothes=CLOTHING_DEFAULTS) {
  const hit=(z)=>Object.entries(ZONES).some(([id,zone])=>zone===z && areas.includes(id));
  if(mode==='fist'){
    // When meshes overlap, smaller face targets are preferred over head/body.
    for(const z of ['cheek','face','head','frontLeft','frontRight','belly']){
      if (!hit(z))continue;
      if(z==='belly' && clothes.removecoat<1)continue;
      if((z==='frontLeft'||z==='frontRight') && clothes.removeshirt<1)continue;
      return z;
    }
    return null;
  }
  if(clothes.removehat<1 && hit('hat'))return 'hat';
  if(clothes.removecoat<1){
    if(hit('coatLeft'))return 'coatLeft';
    if(hit('coatRight'))return 'coatRight';
  }
  if(clothes.removecoat>=1){
    if(clothes.removeriborn<1 && hit('ribbon'))return 'ribbon';
    if(clothes.removeriborn>=1 && clothes.removeshirtbotton<3 && hit('shirtLeft'))return 'shirtButton';
    if(clothes.pantsbotton<1 && hit('pantsButton'))return 'pantsButton';
  }
  if(clothes.pantsbotton>=1 && clothes.pants<1 && hit('pants'))return 'pants';
  if(clothes.removeshirtbotton>=3 && clothes.pants>=1 && clothes.removeshirt<1){
    if(hit('shirtLeft'))return 'shirtLeft';
    if(hit('shirtRight'))return 'shirtRight';
  }
  if(clothes.removecoat>=1 && clothes.removesock<1 && (hit('thighLeft')||hit('thighRight'))){
    return 'socks';
  }
  for(const z of ['cheek','head','handLeft','handRight','footLeft','footRight'])if(hit(z))return z;
  if(clothes.removecoat>=1){
    for(const z of ['shoulder','belly','frontLeft','frontRight','armLeft','armRight'])if(hit(z))return z;
  }
  if(clothes.pants>=1 && hit('angryTouch'))return 'angryTouch';
  for(const [side,leg] of [['thighLeft','legLeft'],['thighRight','legRight']]){
    if(hit(side)){
      if(clothes.removesock>=1)return side;
      if(clothes.pants>=1)return leg;
      if(clothes.removecoat>=1 && clothes.removesock<1)return 'socks';
    }
    if(clothes.pants>=1 && hit(leg))return leg;
  }
  return null;
}
export const DRAG_RULES=Object.freeze({
  cheek:{sleep:-1,wake:0},head:{sleep:-1,wake:0},
  handLeft:{sleep:-1,wake:0},handRight:{sleep:-1,wake:0},
  footLeft:{sleep:-1,wake:0},footRight:{sleep:-1,wake:0},
  shoulder:{sleep:-1,wake:0},belly:{sleep:-1,wake:1},
  frontLeft:{sleep:-5,wake:1},frontRight:{sleep:-5,wake:1},angryTouch:{sleep:-3,wake:3},
  thighLeft:{sleep:-1,wake:1},thighRight:{sleep:-1,wake:1},
  armLeft:{sleep:-2,wake:0},armRight:{sleep:-2,wake:0},
  legLeft:{sleep:-2,wake:0},legRight:{sleep:-2,wake:0},
  hat:{sleep:-1,wake:0},coatLeft:{sleep:-1,wake:0},coatRight:{sleep:-1,wake:0},
  ribbon:{sleep:-1,wake:0},shirtLeft:{sleep:-2,wake:0},shirtRight:{sleep:-2,wake:0},
  pants:{sleep:-2,wake:0},socks:{sleep:-1,wake:0},
});
export const dragEffect=z=>DRAG_RULES[z]||{sleep:0,wake:0};
export function punchEffect(zone){
  if(!FIST_ZONES.includes(zone))return null;
  return {sleep:-100,wake:0,hit:zone};
}
/** Apply raw stat changes. Passive sleep recovery MUST NOT earn happy. */
export function applyChange(state,{sleep=0,wake=0,happy=0,hit=null}={}){
  if(state.gameOver||state.ending)return {...state,changedSleep:0,changedWake:0,changedHappy:0};
  const s=state.sleepLocked?MAX_SLEEP:clamp(state.sleep+sleep,0,MAX_SLEEP);
  const w=clamp(state.wake+wake,0,MAX_WAKE);
  const h=state.sleepLocked?0:clamp((state.happy||0)+happy,0,MAX_HAPPY);
  const ending=h>=MAX_HAPPY;
  const next={...state,sleep:s,wake:w,happy:h,
    changedSleep:s-state.sleep,changedWake:w-state.wake,changedHappy:h-(state.happy||0),
    ending,gameOver:!ending&&isGameOver(s,w)};
  if(hit)next[hit+'Hits']=(state[hit+'Hits']||0)+1;
  return next;
}
/** Only an explicitly identified hand touch on an allowed zone earns happy.
 * This does NOT depend on wake: belly/thigh touches can increase both stats.
 * Clothing, punches, taps on other zones, and passive recovery earn zero.
 * No context is treated as a non-touch action (e.g. UI button or clothing).
 */
export function applyActionChange(state,change={}, {mode,zone}={}){
  return applyChange(state,{...change,happy:happyGainForInteraction(mode,zone)});
}
/** First 5512 click activates cheat mode: both sleep and Zzz remain fixed. */
export function lockSleepAt100(state){
  if(state.gameOver||state.ending)return state;
  return {...state,sleep:MAX_SLEEP,sleepLocked:true,happy:0,
    changedSleep:MAX_SLEEP-state.sleep,changedHappy:-(state.happy||0)};
}
export function garmentProgress(zone,dx,dy,boardSize,direction=1){
  const threshold=Math.max(1,boardSize*.16);
  // Reverse the direction without changing the spreadsheet's threshold.
  const sign=direction===-1?-1:1;
  dx*=sign;dy*=sign;
  switch(zone){
    case 'hat':case 'ribbon':case 'socks':case 'pants':return clamp(dy/threshold,0,1);
    case 'coatLeft':case 'shirtLeft':return clamp(-dx/threshold,0,1);
    case 'coatRight':case 'shirtRight':return clamp(dx/threshold,0,1);
    default:return 0;
  }
}
export function parameterForGarment(zone){
  return {hat:'removehat',ribbon:'removeriborn',socks:'removesock',coatLeft:'removecoat',coatRight:'removecoat',shirtLeft:'removeshirt',shirtRight:'removeshirt',pants:'pants'}[zone]||null;
}
/** Thigh X/Y and leg-lift are separate spreadsheet rules when both unlocked. */
export function combinedDragEffect(zone,clothes=CLOTHING_DEFAULTS,dx=0,dy=0){
  const base=dragEffect(zone);
  if((zone==='thighLeft'||zone==='thighRight') && clothes.pants>=1 && Math.abs(dy)>=Math.max(4,Math.abs(dx)*.65)){
    return {sleep:base.sleep-2,wake:base.wake};
  }
  return base;
}

// Spreadsheet lists X/Y as separate rules. A diagonal drag changes both
// parameters and therefore applies both stat changes, while an axis-only drag
// applies the matching one. Costume and joint drags are one-parameter rules.
const TWO_AXIS_ZONES=new Set(['cheek','head','shoulder','handLeft','handRight',
  'footLeft','footRight','belly','frontLeft','frontRight','thighLeft','thighRight','angryTouch']);
const VERTICAL_JOINT_ZONES=new Set(['armLeft','armRight','legLeft','legRight']);
export function gestureEffect(zone,stepX,stepY,clothes=CLOTHING_DEFAULTS,progressGain=1){
  const base=dragEffect(zone);
  if(!base.sleep && !base.wake)return base;
  const horizontal=Math.abs(stepX)>=3,vertical=Math.abs(stepY)>=3;
  if(TWO_AXIS_ZONES.has(zone)){
    const axes=Number(horizontal)+Number(vertical);
    const lift=(zone==='thighLeft'||zone==='thighRight') && clothes.pants>=1 && vertical;
    return {sleep:base.sleep*axes-(lift?2:0),wake:base.wake*axes};
  }
  if(VERTICAL_JOINT_ZONES.has(zone) && !vertical)return {sleep:0,wake:0};
  if(parameterForGarment(zone) && progressGain<=0)return {sleep:0,wake:0};
  return base;
}

/** Map mouse travel to the loaded model's own min/max range.
 * Signed drag traverses from the default value toward its reachable bound.
 * If a range is asymmetric, each direction uses its own available span. */
export function dragValueForParameter(deltaPx,meta,pixelsToLimit=90){
  const minimum=Number(meta?.minimum),maximum=Number(meta?.maximum),def=Number(meta?.defaultValue);
  if(!Number.isFinite(minimum)||!Number.isFinite(maximum)||maximum<=minimum)return clamp(deltaPx/pixelsToLimit,-1,1);
  const origin=Number.isFinite(def)?clamp(def,minimum,maximum):clamp(0,minimum,maximum);
  const span=deltaPx>=0 ? maximum-origin : origin-minimum;
  return clamp(origin+clamp(deltaPx/pixelsToLimit,-1,1)*span,minimum,maximum);
}
