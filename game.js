import { createLive2D, OFFICIAL_CUBISM_CORE_URL } from 'live2d-web';
import { axisDirection, garmentDirection } from './controls.config.mjs';
import {
  INITIAL, MAX_SLEEP, MAX_WAKE, MAX_HAPPY, CLOTHING_DEFAULTS, FIXED_PARAMETERS, ANIMATED_PARAMETERS,
  clamp, applyChange, applyActionChange, happyGainForInteraction, happyEndingMessage, lockSleepAt100, zoneFor, dragEffect, punchEffect,
  garmentProgress, parameterForGarment, gestureEffect, idleRecoveryDelta, dragValueForParameter,
} from './game-logic.mjs';

// Cubism Core 6.0.x (SDK 5.3 R5) is required for this model's moc3 v6.
// `npm install` downloads from Live2D's official host to this local path.
const assetUrl = path => `${import.meta.env.BASE_URL}assets/${path}`;
const LOCAL_CORE = assetUrl('vendor/live2dcubismcore.min.js');
async function selectCoreUrl(){
  try {
    const [stamp, response]=await Promise.all([
      fetch(assetUrl('vendor/core-version.txt'),{cache:'no-store'}),
      fetch(LOCAL_CORE,{method:'HEAD',cache:'no-store'}),
    ]);
    const ct = response.headers.get('content-type') || '';
    if (stamp.ok && (await stamp.text()).trim()==='06' &&
        response.ok && /javascript|ecmascript|octet-stream/i.test(ct)) return LOCAL_CORE;
  } catch { /* automatic install may be blocked; official host is fallback */ }
  return OFFICIAL_CUBISM_CORE_URL;
}
const $ = id => document.getElementById(id);
const board=$('gameBoard'), modelHost=$('liveCanvas'), particles=$('particles');
const sleepTrack=$('sleepTrack'), sleepFill=$('sleepFill'), sleepValue=$('sleepValue');
const happyValue=$('happyValue'), lockButton=$('sleepLockButton');
let state={...INITIAL};
let clothes={...CLOTHING_DEFAULTS};
let model=null, ready=false, playing=false;
let currentPointer=null, mode='hand', soundEnabled=true, gameOverTimer=null;
// 5512 is a two-stage cheat: activate once, then use the eye button.
let cheatEnabled=false, eyesForcedOpen=false;
let gameOverSequenceId=0;
let lastVoiceAt=-Infinity;
let lastInteractionAt=performance.now(), lastRecoveryTickAt=lastInteractionAt;
const gaugeElement=document.querySelector('.sleep-gauge');
function markInteraction(){
  lastInteractionAt=performance.now();
  lastRecoveryTickAt=lastInteractionAt;
  gaugeElement.classList.remove('recovering');
}
function tickIdleRecovery(){
  const now=performance.now();
  const delta=idleRecoveryDelta(now,lastInteractionAt,lastRecoveryTickAt,!!currentPointer);
  lastRecoveryTickAt=now;
  const recovering=ready && playing && !currentPointer && !state.gameOver && !state.ending && !state.sleepLocked && state.sleep<MAX_SLEEP && delta>0;
  gaugeElement.classList.toggle('recovering',recovering);
  if (!recovering) return;
  state=applyChange(state,{sleep:delta});
  updateHUD();
}
// Browser timers compensate for tab throttling by measuring real elapsed time.
setInterval(tickIdleRecovery,50);
const parameters=Object.create(null);
const parameterRanges=new Map();
const screenPlacement={x:0.50,y:-0.05,scale:0.6};
const DRAG_INTERVAL=95, VOICE_INTERVAL=500;
const motionMap={cheek:'cheek',face:'face',head:'head',belly:'belly',frontLeft:'frontLeft',frontRight:'frontRight'};
const sfxMap={cheek:'cheekhit',face:'facehit',head:'bellyhit',belly:'bellyhit',frontLeft:'breasthitleft',frontRight:'breasthitright'};
const labels={
  hat:'모자', coatLeft:'코트',coatRight:'코트', ribbon:'리본',socks:'양말',
  shirtLeft:'셔츠',shirtRight:'셔츠',pants:'바지',
};

class VoiceChannel {
  constructor(){
    this.audio=new Audio();this.audio.preload='auto';this.audio.volume=.88;
    this.running=false;this.pending=null;this.exclusiveCancel=null;
    this.audio.addEventListener('ended',()=>this.advance());
    this.audio.addEventListener('error',()=>this.advance());
  }
  /** Interrupt normal speech and wait for one full voice before opening the overlay. */
  playExclusive(name){
    this.stop();
    if(!soundEnabled || !name)return Promise.resolve(false);
    return new Promise(resolve=>{
      const audio=this.audio;
      let done=false;
      let timerId;
      const onEnd=()=>finish(true);
      const onError=()=>finish(false);
      const cancel=()=>finish(false);
      const finish=success=>{
        if(done)return;
        done=true;
        clearTimeout(timerId);
        audio.removeEventListener('ended',onEnd);
        audio.removeEventListener('error',onError);
        if(this.exclusiveCancel===cancel)this.exclusiveCancel=null;
        this.running=false;this.pending=null;
        if(!success)audio.pause();
        resolve(success);
      };
      this.exclusiveCancel=cancel;
      audio.addEventListener('ended',onEnd);
      audio.addEventListener('error',onError);
      // A missing game-over WAV / autoplay failure should not freeze the game.
      timerId=setTimeout(()=>finish(false),15000);
      const attempt=this.playNow(name);
      attempt?.catch?.(()=>finish(false));
    });
  }
  play(name){
    if(!soundEnabled || !name)return;
    if(this.running){this.pending=name;return;}
    this.playNow(name);
  }
  playNow(name){
    this.running=true;
    this.audio.src=assetUrl('voice/'+name+'.wav');
    try{this.audio.currentTime=0;}catch{}
    const attempt=this.audio.play();
    attempt.catch(()=>this.advance());
    return attempt;
  }
  advance(){
    this.running=false;
    const next=this.pending;this.pending=null;
    if(next&&soundEnabled)this.playNow(next);
  }
  stop(){
    this.exclusiveCancel?.();
    this.pending=null;this.running=false;this.audio.pause();this.audio.removeAttribute('src');this.audio.load();
  }
}
const voice=new VoiceChannel();
const pick = array=>array[Math.floor(Math.random()*array.length)];
function playSfx(name){
  if(!soundEnabled||!name)return;
  const node=new Audio(assetUrl('sfx/'+name+'.wav'));node.volume=.66;
  node.play().catch(()=>{});
  node.addEventListener('ended',()=>node.removeAttribute('src'),{once:true});
}
function dragVoice(){
  const now=performance.now();if(now-lastVoiceAt<VOICE_INTERVAL)return;
  lastVoiceAt=now;voice.play(pick(['Voice_Lion_Hmm2','Voice_Lion_Hmm3']));
}
function hitVoice(){voice.play(pick(['Voice_Lion_Hit1','Voice_Lion_Hit2','Voice_Lion_Hit3','Voice_Lion_Hit4']));}
function clickChime(){
  if(!soundEnabled)return;
  try{
    const ctx=window.__audioCtx ||= new (window.AudioContext||window.webkitAudioContext)();
    const osc=ctx.createOscillator(),gain=ctx.createGain();
    osc.type='sine';osc.frequency.setValueAtTime(860,ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1080,ctx.currentTime+.07);
    gain.gain.setValueAtTime(.09,ctx.currentTime);gain.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+.13);
    osc.connect(gain);gain.connect(ctx.destination);osc.start();osc.stop(ctx.currentTime+.14);
  }catch{}
}

function setMode(next){
  if(currentPointer)finishPointer();
  markInteraction();
  mode=next==='fist'?'fist':'hand';
  for(const m of ['hand','fist']){
    const button=$(m+'Button');
    button.classList.toggle('active',mode===m);
    button.setAttribute('aria-pressed',String(mode===m));
  }
}
$('handButton').addEventListener('click',()=>setMode('hand'));
$('fistButton').addEventListener('click',()=>setMode('fist'));
$('soundToggle').addEventListener('click',()=>{
  markInteraction();
  soundEnabled=!soundEnabled;
  $('soundToggle').textContent=soundEnabled?'♫':'♪';
  $('soundToggle').classList.toggle('muted',!soundEnabled);
  $('soundToggle').setAttribute('aria-label',soundEnabled?'소리 끄기':'소리 켜기');
  if(!soundEnabled)voice.stop();
});
$('restartButton').addEventListener('click',resetGame);
$('endingRestartButton').addEventListener('click',resetGame);
lockButton.addEventListener('click',()=>{
  if(!playing || state.gameOver || state.ending)return;
  if(!cheatEnabled){
    // First click: activate the cheat (sleep=100, Zzz=0) WITHOUT opening the eyes.
    cheatEnabled=true;
    eyesForcedOpen=false;
    state=lockSleepAt100(state);
  }else{
    // Subsequent clicks: open / close the eyes, without changing the cheat state.
    eyesForcedOpen=!eyesForcedOpen;
  }
  markInteraction();updateHUD();
});
$('startButton').addEventListener('click',()=>{
  if(!ready||playing)return;
  playing=true;markInteraction();updateHUD();
  $('titleScreen').classList.add('hidden');

});
$('retryButton').addEventListener('click',()=>window.location.reload());

// Keep the normal game HUD clean. Debug messages go to the console only.
function toast(message){
  if(new URLSearchParams(location.search).has('debug'))console.info('[game]',message);
}
function effect(x,y,type='hand'){
  const div=document.createElement('div');div.className='ripple'+(type==='fist'?' fist':'');
  div.style.left=x+'px';div.style.top=y+'px';particles.appendChild(div);
  div.addEventListener('animationend',()=>div.remove(),{once:true});
}
function heart(x,y,color='pink',amount=1){
  for(let i=0;i<Math.min(3,amount);i++){
    const div=document.createElement('div');div.className='heart'+(color==='black'?' black':'');
    div.textContent='♥';div.style.left=(x+(Math.random()-.5)*18)+'px';
    div.style.top=(y+(Math.random()-.5)*18)+'px';
    div.style.setProperty('--drift',Math.round((Math.random()-.5)*42)+'px');
    div.style.animationDelay=(i*.07)+'s';particles.appendChild(div);
    div.addEventListener('animationend',()=>div.remove(),{once:true});
  }
}
// Eye symbols communicate the current eye state after 5512 has unlocked cheats.
const EYE_OPEN_ICON='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_CLOSED_ICON='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M3 3l18 18M10.6 5.1A11.4 11.4 0 0 1 12 5c6.5 0 10 7 10 7a15.6 15.6 0 0 1-3.5 4.2M6.4 6.4C3.6 8.1 2 12 2 12s3.5 7 10 7a10.7 10.7 0 0 0 3.8-.7"/></svg>';
function updateHUD(){
  sleepFill.style.height=(state.sleep/MAX_SLEEP*100)+'%';
  happyValue.textContent=`Zzz ${Math.floor(state.happy||0)}/${MAX_HAPPY}`;
  if(cheatEnabled){
    lockButton.innerHTML=eyesForcedOpen?EYE_OPEN_ICON:EYE_CLOSED_ICON;
  }else{
    lockButton.textContent='5512';
  }
  const actionLabel=!cheatEnabled?'치트모드 활성화':eyesForcedOpen?'눈 감기':'눈 뜨기';
  lockButton.title=actionLabel;
  lockButton.setAttribute('aria-label',actionLabel);
  lockButton.classList.toggle('active',cheatEnabled);
  lockButton.setAttribute('aria-pressed',String(cheatEnabled && eyesForcedOpen));
  lockButton.disabled=!playing || state.gameOver || state.ending;
  sleepValue.textContent=String(Math.round(state.sleep))+'/'+MAX_SLEEP;
  sleepTrack.setAttribute('aria-valuenow',String(state.sleep));
  sleepFill.classList.toggle('kept-awake',state.sleep===0 && state.wake>=50);
  if($('debugStatus'))$('debugStatus').textContent=`sleep=${state.sleep} / wake=${state.wake} / happy=${state.happy} / sleepLock=${state.sleepLocked} / `+
    Object.entries(clothes).map(([k,v])=>k+':'+Math.round(v*100)/100).join('  ');
}
function stopIfHappyEnding(){
  if(!state.ending)return;
  gameOverSequenceId++;
  clearTimeout(gameOverTimer);
  if(currentPointer)finishPointer();
  $('happyEndTitle').textContent=happyEndingMessage(state.wake);
  $('gameOver').classList.add('hidden');
  $('happyEnding').classList.remove('hidden');
}
async function stopIfGameOver(){
  if(!state.gameOver)return;
  if(currentPointer)finishPointer();
  clearTimeout(gameOverTimer);
  const sequence=++gameOverSequenceId;
  $('gameOver').classList.add('hidden');
  // 1) state.gameOver makes the model's eye parameter 1 immediately.
  // Let the player actually see open eyes before playback begins.
  voice.stop();
  await new Promise(resolve=>setTimeout(resolve,250));
  if(!state.gameOver || sequence!==gameOverSequenceId)return;
  // 2) Play the game-over voice alone, through its final frame.
  // Place Voice_Lion_GameOver.wav in assets/voice or public/assets/voice.
  await voice.playExclusive('Voice_Lion_GameOver');
  if(!state.gameOver || sequence!==gameOverSequenceId)return;
  // 3) Only after voice playback (or fallback on missing WAV), show overlay.
  $('gameOver').classList.remove('hidden');
}
function changeStats(change,x,y,context={}){
  if(state.gameOver || state.ending)return;
  const previous=state.gameOver;
  const previousEnding=state.ending;
  state=applyActionChange(state,change,context);updateHUD();
  if(state.changedSleep<0)heart(x,y,'pink',state.changedSleep<=-50?3:1);
  if(state.changedWake<0)heart(x+10,y+7,'black',2);
  if(state.ending&&!previousEnding)stopIfHappyEnding();
  else if(state.gameOver&&!previous)stopIfGameOver();
}
function setParameter(name,value){
  const spec=parameterRanges.get(name);
  parameters[name]=spec?clamp(value,spec.minimum,spec.maximum):value;
}
function draggingValue(name,pixels){
  // Distance to reach the current model's extrema scales with the touch surface.
  // This makes a short mobile drag feel like the same fraction of a desktop drag.
  const travel=clamp(board.clientWidth*.20,50,145);
  return dragValueForParameter(pixels*axisDirection(name),parameterRanges.get(name),travel);
}
function raiseAngry(amount){
  const spec=parameterRanges.get('angry');
  const limit=spec?.maximum??1;
  setParameter('angry',clamp((parameters.angry||0)+amount,0,limit));
}
function getClothes(){return clothes;}
function setClothes(name,value){
  const limit=name==='removeshirtbotton'?3:(name==='pantsbotton'?1:2);
  clothes[name]=clamp(value,0,limit);
  setParameter(name,clothes[name]);updateHUD();
}
function resetGame(){
  gameOverSequenceId++;clearTimeout(gameOverTimer);if(currentPointer)finishPointer();voice.stop();cheatEnabled=false;eyesForcedOpen=false;
  state={...INITIAL};clothes={...CLOTHING_DEFAULTS};lastVoiceAt=-Infinity;
  markInteraction();
  for(const key of Object.keys(parameters))delete parameters[key];
  for(const key of FIXED_PARAMETERS)setParameter(key,0);
  for(const key of ANIMATED_PARAMETERS)setParameter(key,0);
  $('gameOver').classList.add('hidden');$('happyEnding').classList.add('hidden');particles.replaceChildren();updateHUD();

}

function coords(ev){
  const box=board.getBoundingClientRect();
  return {x:(ev.clientX-box.left)/box.width*board.clientWidth,
    y:(ev.clientY-box.top)/box.height*board.clientHeight};
}
function areasAt(x,y){
  if(!model)return [];
  const rect=board.getBoundingClientRect();
  try{return model.hitTest(rect.left+x,rect.top+y)||[];}
  catch(error){console.warn('HitArea 오류:',error);return [];}
}
function updateDragParameters(zone,dx,dy){
  const prefixes={cheek:'touchbol',head:'touchhead',
    handLeft:'touchhandleft',handRight:'touchhandright',footLeft:'touchfeetleft',footRight:'touchfeetright',
    shoulder:'touchsholder',belly:'touchbelly',thighLeft:'touchthighleft',thighRight:'touchthighright',
    frontLeft:'touchbreast',frontRight:'touchbreast',angryTouch:'touchpussy'};
  if(prefixes[zone]){
    const prefix=prefixes[zone];
    setParameter(prefix+'X',draggingValue(prefix+'X',dx));setParameter(prefix+'Y',draggingValue(prefix+'Y',dy));
  }
  if(zone==='armLeft')setParameter('leftarm',draggingValue('leftarm',dy));
  if(zone==='armRight')setParameter('rightarm',draggingValue('rightarm',dy));
  if(zone==='legLeft'||zone==='thighLeft'){
    if(clothes.pants>=1)setParameter('leftleg',draggingValue('leftleg',dy));
  }
  if(zone==='legRight'||zone==='thighRight'){
    if(clothes.pants>=1)setParameter('rightleg',draggingValue('rightleg',dy));
  }
}
function finishPointer(){
  if(!currentPointer)return;
  const pointer=currentPointer;
  const clothesKey=parameterForGarment(pointer.zone);
  if(clothesKey){
    const progress=clothes[clothesKey]||0;
    const complete=pointer.progress>=1 || progress>=1;
    setClothes(clothesKey,complete?2:0);
    if(complete)toast((labels[pointer.zone]||'의상')+' 장난 성공! ✦');
  }
  // Finishing a clothing drag doesn't award happy.
  currentPointer=null;
  markInteraction();
}
function onPointerDown(ev){
  if(!ready||!playing||state.gameOver||state.ending||ev.button>0||ev.target.closest('button'))return;
  const pt=coords(ev);const found=areasAt(pt.x,pt.y);
  const zone=zoneFor(found,mode,clothes);
  if($('debugHits'))$('debugHits').textContent='HitArea: '+(found.join(', ')||'(없음)')+'\n선택: '+(zone||'(없음)');
  if(!zone)return;
  markInteraction();
  ev.preventDefault();
  try{board.setPointerCapture(ev.pointerId);}catch{}
  effect(pt.x,pt.y,mode);
  currentPointer={id:ev.pointerId,zone,areas:found,mode,x:pt.x,y:pt.y,lastX:pt.x,lastY:pt.y,
    progress:0,dragStarted:false,lastActivity:-Infinity,prevX:pt.x,prevY:pt.y};
  // One hand tap earns happy on the permitted touch zones, even without dragging.
  if(happyGainForInteraction(mode,zone)>0){
    changeStats({},pt.x,pt.y,{mode,zone});
    if(state.ending)return;
  }
  if(mode==='hand'&&zone==='angryTouch'){
    raiseAngry(0.1);
  }
  if(mode==='fist'){
    const rule=punchEffect(zone,state.wake);
    if(!rule)return;
    // Excel rule: fist decreases sleep by 100; it does not decrease wake.
    playSfx(sfxMap[zone]);hitVoice();
    if(model&&motionMap[zone]){
      try{
        const prom=model.motion(motionMap[zone],0,{priority:'force'});
        prom?.catch?.(error=>console.warn('모션 재생 실패:',error));
      }catch(error){console.warn('모션 재생 실패:',error);}
    }
    changeStats(rule,pt.x,pt.y);
    const colorKey={cheek:'cheekcolor',head:'headcolor',belly:'bellycolor',frontLeft:'leftbreastcolor',frontRight:'rightbreastcolor'}[zone];
    if(colorKey)setParameter(colorKey,clamp((state[zone+'Hits']||0)*.1,0,1));
    if(zone==='face'&&state.faceHits>=10)setParameter('blood',1);
    if(zone==='belly'&&state.bellyHits>=10)setParameter('ojum',1);
    return;
  }
  if(zone==='shirtButton'){
    setClothes('removeshirtbotton',Math.min(3,clothes.removeshirtbotton+1));
    clickChime();changeStats({sleep:-1},pt.x,pt.y);
    toast('셔츠 단추 '+clothes.removeshirtbotton+'/3');
  }else if(zone==='pantsButton'){
    setClothes('pantsbotton',1);clickChime();changeStats({sleep:-1},pt.x,pt.y);
    toast('바지 단추 풀림');
  }
}
function onPointerMove(ev){
  if(!currentPointer||currentPointer.id!==ev.pointerId||!ready||!playing||state.gameOver||state.ending||currentPointer.mode!=='hand')return;
  const pointer=currentPointer,pt=coords(ev);
  if(['shirtButton','pantsButton'].includes(pointer.zone))return;
  const dx=pt.x-pointer.x,dy=pt.y-pointer.y;
  const segmentDistance=Math.hypot(pt.x-pointer.prevX,pt.y-pointer.prevY);
  pointer.prevX=pt.x;pointer.prevY=pt.y;
  // Same thigh mesh drives socks (drag down) and, after pants are removed,
  // the leg joint (drag upward). Don't make socks a prerequisite for moving a leg.
  if(pointer.zone==='socks' && clothes.pants>=1 && dy<-8 && Math.abs(dy)>=Math.abs(dx)*.7){
    pointer.zone=pointer.areas.includes('HitArea_touchthighleft')?'legLeft':'legRight';
  }
  if(Math.hypot(dx,dy)<6&&!pointer.dragStarted)return;
  pointer.dragStarted=true;markInteraction();ev.preventDefault();
  const garment=parameterForGarment(pointer.zone);
  let progressGain=0;
  if(garment){
    const progress=garmentProgress(pointer.zone,dx,dy,Math.min(board.clientWidth,board.clientHeight),garmentDirection(pointer.zone));
    progressGain=progress-pointer.progress;
    pointer.progress=progress;
    setClothes(garment,progress);
  }else if(!['shirtButton','pantsButton'].includes(pointer.zone)){
    updateDragParameters(pointer.zone,dx,dy);
    if(pointer.zone==='angryTouch'){
      raiseAngry(Math.min(0.012,segmentDistance/700));
    }
  }
  const now=performance.now();
  if(Math.hypot(pt.x-pointer.lastX,pt.y-pointer.lastY)>=7 && now-pointer.lastActivity>=DRAG_INTERVAL){
    effect(pt.x,pt.y);
    const rule=gestureEffect(pointer.zone,pt.x-pointer.lastX,pt.y-pointer.lastY,clothes,progressGain);
    if(rule.sleep || rule.wake)changeStats(rule,pt.x,pt.y,{mode:pointer.mode,zone:pointer.zone});
    if(state.ending || state.gameOver)return;
    dragVoice();pointer.lastX=pt.x;pointer.lastY=pt.y;pointer.lastActivity=now;
  }
}
function onPointerUp(ev){
  if(!currentPointer||currentPointer.id!==ev.pointerId)return;
  finishPointer();
  try{if(board.hasPointerCapture(ev.pointerId))board.releasePointerCapture(ev.pointerId);}catch{}
}
board.addEventListener('pointerdown',onPointerDown);
board.addEventListener('pointermove',onPointerMove);
board.addEventListener('pointerup',onPointerUp);
board.addEventListener('pointercancel',onPointerUp);
board.addEventListener('lostpointercapture',finishPointer);

function reactiveValues(){
  const pct=state.wake/MAX_WAKE;
  // sleep=0 by itself must NOT open the eyes when wake >= 50.
  // The 5512 cheat switches eye open/closed; actual GAME OVER overrides it.
  const open=state.gameOver || (cheatEnabled && eyesForcedOpen);
  return {eye:open?1:0, mouth:state.gameOver?1:0,
    blink:pct, brow:pct, shy:pct, smile:state.gameOver?0:-pct};
}
function registerModelDrivers(){
  if(!model)return;
  const meta=model.getModelInfo();
  const available=new Set((meta.parameters||[]).map(p=>p.id));
  parameterRanges.clear();
  for(const p of (meta.parameters||[])){
    if(Number.isFinite(p.minimum)&&Number.isFinite(p.maximum)){
      parameterRanges.set(p.id,p);
    }
  }
  const names=new Set([
    ...FIXED_PARAMETERS,
    ...ANIMATED_PARAMETERS,
    ...Object.keys(parameters),
    ...Object.keys(reactiveValues()),
  ]);
  for(const name of names){
    if(available.size && !available.has(name))continue;
    model.addParameterDriver(name,{
      getValue:()=>Object.prototype.hasOwnProperty.call(reactiveValues(),name)
        ? reactiveValues()[name]
        : Number(parameters[name]||0),
    });
  }
  console.info('Live2D 연결 파라미터 수',names.size,'Core6/Framework5');
}
function easeDragParams(){
  let last=performance.now();
  function next(time){
    const factor=Math.min(1,(time-last)/310);last=time;
    if(!currentPointer||currentPointer.mode!=='hand'){
      for(const [key,value] of Object.entries(parameters)){
        if(FIXED_PARAMETERS.includes(key)||['leftarm','rightarm','leftleg','rightleg'].includes(key))continue;
        parameters[key]=Math.abs(value)<.005?0:value*(1-factor*.35);
      }
    }
    window.requestAnimationFrame(next);
  }
  window.requestAnimationFrame(next);
}
function positionModel(){
  if(!model)return;
  // The runtime expresses offsets as fractions of the stage. This keeps
  // placement stable across desktop/mobile resizing without Pixi transforms.
  model.setFit({scale:screenPlacement.scale,
    offsetX:screenPlacement.x-.5,
    offsetY:screenPlacement.y-.5, units:'stage'});
  updateDebug();
}
// Refit the canvas when a phone rotates or the browser's viewport changes.
window.addEventListener('resize',()=>{if(model)requestAnimationFrame(positionModel);},{passive:true});
function updateDebug(){
  if($('debugReadout'))$('debugReadout').textContent=Object.entries(screenPlacement).map(([k,v])=>k+':'+v.toFixed(2)).join('  ');
}
function initDebug(){
  if(!new URLSearchParams(location.search).has('debug'))return;
  $('debugControls').classList.remove('hidden');
  for(const [id,key] of [['debugX','x'],['debugY','y'],['debugScale','scale']]){
    $(id).value=screenPlacement[key];
    $(id).addEventListener('input',ev=>{screenPlacement[key]=Number(ev.target.value);positionModel();});
  }
  $('debugCopy').addEventListener('click',()=>{
    const s=`const screenPlacement={x:${screenPlacement.x},y:${screenPlacement.y},scale:${screenPlacement.scale}};`;
    navigator.clipboard?.writeText(s);toast('모델 배치값 복사');
  });
}
function loaderError(error){
  console.error(error);
  $('loaderIcon').textContent='☁';$('loaderTitle').textContent='모델을 열지 못했어요';
  $('loaderText').textContent=(error?.message||'확인되지 않은 오류')+' · npm run setup:core 로 Core 6 설치를 재시도하거나 WebGL2와 인터넷 연결을 확인해 주세요.';
  $('retryButton').classList.remove('hidden');document.querySelector('.loading-line').classList.add('hidden');
}
async function start(){
  try {
    initDebug();updateHUD();
    $('loaderText').textContent='Cubism Core 6.0 / Live2D 모델을 준비하고 있습니다.';
    const coreUrl=await selectCoreUrl();
    if(coreUrl===OFFICIAL_CUBISM_CORE_URL){
      $('loaderText').textContent='로컬 Core가 없어 Live2D 공식 서버에서 자동으로 불러오는 중입니다.';
    }
    model=await createLive2D({
      container:modelHost,
      coreUrl,
      src:assetUrl('model/햇리온.model3.json'),
      fit:{scale:screenPlacement.scale, offsetX:screenPlacement.x-.5, offsetY:screenPlacement.y-.5, units:'stage'},
      idleMotion:false,
      followPointer:false,
      accessibility:{label:'Live2D 햇리온'},
    });
    const info=model.getModelInfo();
    for(const key of FIXED_PARAMETERS)setParameter(key,0);
    for(const key of ANIMATED_PARAMETERS)setParameter(key,0);
    registerModelDrivers();
    positionModel();easeDragParams();
    ready=true;markInteraction();$('startup').classList.add('hidden');
    $('startButton').disabled=false;
    $('startButton').textContent='시작';
    console.info('Live2D 모델 준비 완료',{info,coreUrl});
    window.addEventListener('pagehide',()=>model?.dispose(),{once:true});
  }catch(error){
    const details=[error?.code,error?.message,error?.details?.url,error?.details?.httpStatus].filter(Boolean).join(' / ');
    loaderError(new Error(details||String(error)));
  }
}
window.__haetlion={
  getState:()=>({...state,playing,cheatEnabled,eyesForcedOpen,clothes:{...clothes}}),getModel:()=>model,
  getHitAreas:()=>model?.getModelInfo?.().hitAreas||[],hitAreaAt:areasAt,
  getRegisteredAreas:async()=>{const data=await (await fetch(assetUrl('model/햇리온.model3.json'))).json();return data.HitAreas;},
  setMode,changeStats,resetGame,getPlacement:()=>({...screenPlacement}),
};
start();
