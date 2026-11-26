const DURATION=216, DEFAULT_FOV=57;
const stops=[
  [0,3,'隧道晨昏','TUNNEL PORTAL'],
  [1,10,'金色稻原','HARVEST BASIN'],
  [2,56,'湖岸薄暮','LAKESIDE DUSK'],
  [3,109.4,'出洞的光','INTO THE LIGHT'],
  [4,124,'白桦林间','BIRCH GROVE'],
  [5,168,'旭岳初冠雪','FIRST SNOW'],
  [6,207.5,'分水岭隧道','DIVIDE TUNNEL']
];
const byId=id=>document.getElementById(id);
const leftPad=n=>String(n).padStart(2,'0');
const stamp=t=>leftPad(Math.floor(t/60))+':'+leftPad(Math.floor(t%60));
const state={t:13.6,playing:true,yaw:0,pitch:0,fov:DEFAULT_FOV,targetYaw:0,targetPitch:0,targetFov:DEFAULT_FOV,motion:true};
const stage=byId('stage'),canvas=byId('view'),pointers=new Map();
let lastInput=performance.now(),last=0,lastUI=-1,activeStop=-1,scrubbing=false,renderer=null,audioTrack=null;
let immersive=false,pausedForVisibility=false,lastUIActivity=performance.now(),lastHint=-10000;
function icon(el,name){
  const seal=name==='seal';el.width=el.height=seal?128:72;let c=el.getContext('2d');const size=el.width;
  c.scale(size/24,size/24);c.clearRect(0,0,24,24);c.strokeStyle=c.fillStyle=getComputedStyle(el).color;c.lineWidth=1.5;c.lineCap='round';c.lineJoin='round';
  const l=(...p)=>{c.beginPath();c.moveTo(p[0],p[1]);for(let i=2;i<p.length;i+=2)c.lineTo(p[i],p[i+1]);c.stroke();};
  const circle=(x,y,r,fill=false)=>{c.beginPath();c.arc(x,y,r,0,TAU);fill?c.fill():c.stroke();};
  if(name==='seal'){
    c.lineWidth=.65;circle(12,12,10.7);circle(12,12,9.45);l(4.3,14.8,7.5,11.9,9.5,13.4,12.3,9.1,15.8,13.7,17,12.6,19.7,14.8);
    l(5.2,16,18.8,16);l(7.1,17.3,16.9,17.3);l(9.25,18.8,14.75,18.8);
    c.lineWidth=.55;l(6.65,9.4,8.5,7.5,10,8.05);circle(6.65,9.4,.42,true);circle(8.5,7.5,.52,true);circle(10,8.05,.32,true);
    circle(15.95,8.5,1.45);l(12.6,5.35,12.6,6.45);l(12.05,5.9,13.15,5.9);
  }else if(name==='sun'){l(2,17,22,17);l(5,20,19,20);c.beginPath();c.arc(12,16,5,Math.PI,TAU);c.stroke();l(12,3,12,6);l(4,7,6,9);l(20,7,18,9);l(2,12,4,13);l(22,12,20,13);}
  else if(name==='book'){l(4,3,17,3,20,5,20,21,6,21,4,19,4,3);l(7,3,7,20);l(10,8,16,8);l(10,11,15,11);}
  else if(name==='full'){l(3,9,3,4,9,4);l(15,4,21,4,21,9);l(21,15,21,20,15,20);l(9,20,3,20,3,15);}
  else if(name==='restore'){l(4,9,9,9,9,4);l(15,4,15,9,20,9);l(20,15,15,15,15,20);l(9,20,9,15,4,15);}
  else if(name==='pause'){c.fillRect(6.8,4.9,3.4,14.2);c.fillRect(14,4.9,3.4,14.2);}
  else if(name==='play'){c.beginPath();c.moveTo(7,3.5);c.lineTo(20,12);c.lineTo(7,20.5);c.closePath();c.fill();}
  else if(name==='mute'||name==='volume'){l(3,9,7,9,12,5,12,19,7,15,3,15,3,9);if(name==='mute'){l(16,9,21,15);l(21,9,16,15);}
    else{c.beginPath();c.arc(12,12,5.4,-.72,.72);c.stroke();c.beginPath();c.arc(12,12,9,-.69,.69);c.stroke();}}
  else if(name==='drag'){l(8,13,8,5);c.beginPath();c.arc(9.5,5,1.5,Math.PI,TAU);c.stroke();l(11,5,11,11,12.5,9.5,17,10,19,12,18,18,15,21,10,21,5,15,5,13,8,15);}
  else if(name==='x'){l(5,5,19,19);l(19,5,5,19);}
}
document.querySelectorAll('[data-icon]').forEach(e=>icon(e,e.dataset.icon));
const uiClock=byId('clock'),playBtn=byId('play'),soundBtn=byId('sound'),drawer=byId('journal'),routeBtn=byId('route');
function setDrawer(open){drawer.hidden=!open;routeBtn.setAttribute('aria-expanded',String(open));if(open)lastInput=performance.now();}
function jump(t){state.t=clamp(t,0,DURATION-.005);lastUI=-1;drawUI();lastInput=performance.now();}
function setPlay(flag){state.playing=flag;playBtn.setAttribute('aria-label',flag?'暂停':'继续播放');playBtn.title=(flag?'暂停':'继续播放')+' · 空格';icon(playBtn.firstElementChild,flag?'pause':'play');}
function recenter(){state.targetYaw=0;state.yaw=Math.atan2(Math.sin(state.yaw),Math.cos(state.yaw));state.targetPitch=0;state.targetFov=DEFAULT_FOV;}
function drawUI(){
  let i=0;for(let n=1;n<stops.length;n++)if(state.t>=stops[n][1])i=n;
  if(i!==activeStop){const [id,t,cn,en]=stops[i];byId('chapterNo').textContent=leftPad(id);
    byId('chapterName').textContent=cn;byId('chapterEn').textContent=en;
    document.querySelectorAll('.stop').forEach((b,j)=>b.setAttribute('aria-current',String(j===i)));activeStop=i;}
  uiClock.textContent=stamp(state.t);if(!scrubbing)byId('seek').value=state.t;
  byId('seek').setAttribute('aria-valuetext',stamp(state.t)+'，'+stops[i][2]);
  byId('timeLine').style.setProperty('--progress',(100*state.t/DURATION)+'%');
}
for(const [id,t,cn,en] of stops){
  const b=document.createElement('button');b.className='stop';b.innerHTML='<i></i><strong>'+cn+'</strong><span class="panelTime">'+stamp(t)+'</span>';
  b.addEventListener('click',()=>{jump(t);recenter();setDrawer(false);routeBtn.focus();});byId('stops').append(b);
  if(id>1){const tick=document.createElement('i');tick.style.left=(t/DURATION*100)+'%';byId('ticks').append(tick);}
}
routeBtn.onclick=()=>setDrawer(drawer.hidden);byId('close').onclick=()=>{setDrawer(false);routeBtn.focus();};playBtn.onclick=()=>setPlay(!state.playing);
const seek=byId('seek');seek.oninput=()=>jump(+seek.value);seek.onpointerdown=()=>{scrubbing=true;};window.addEventListener('pointerup',()=>{scrubbing=false;});
function setImm(flag){immersive=flag;document.documentElement.classList.toggle('imm',flag);byId('restore').tabIndex=flag?0:-1;if(!flag)byId('full').focus();lastUIActivity=performance.now();}
async function full(){if(immersive){setImm(false);if(document.fullscreenElement)try{await document.exitFullscreen();}catch{}}
  else{setDrawer(false);setImm(true);if(document.documentElement.requestFullscreen)try{await document.documentElement.requestFullscreen();}catch{}}}
document.addEventListener('fullscreenchange',()=>{if(!document.fullscreenElement&&immersive)setImm(false);});byId('restore').tabIndex=-1;byId('full').onclick=full;byId('restore').onclick=full;
function inputActivity(){lastInput=lastUIActivity=performance.now();}
function grip(ev){
  if(ev.target.closest('aside,button')||ev.button!==0)return;
  if(!drawer.hidden)setDrawer(false);
  inputActivity();stage.focus({preventScroll:true});stage.setPointerCapture(ev.pointerId);
  pointers.set(ev.pointerId,[ev.clientX,ev.clientY]);stage.classList.add('dragging');
}
function move(ev){
  lastUIActivity=performance.now();const old=pointers.get(ev.pointerId);if(!old)return;
  const next=[ev.clientX,ev.clientY];const gain=(state.fov*DEG/stage.clientHeight)*.93;let mult=1;
  if(pointers.size>1){
    const other=[...pointers].find(([id])=>id!==ev.pointerId)[1];
    const before=Math.hypot(other[0]-old[0],other[1]-old[1]),after=Math.hypot(other[0]-next[0],other[1]-next[1]);
    if(after>4&&before>4)state.targetFov=clamp(state.targetFov*before/after,28,82);mult=.5;
  }
  state.targetYaw-=gain*(next[0]-old[0])*mult;state.targetPitch=clamp(state.targetPitch+gain*(next[1]-old[1])*mult,-1.54,1.54);pointers.set(ev.pointerId,next);inputActivity();
}
function release(ev){if(pointers.delete(ev.pointerId)){inputActivity();if(!pointers.size)stage.classList.remove('dragging');}}
stage.addEventListener('pointerdown',grip);stage.addEventListener('pointermove',move);stage.addEventListener('pointerup',release);stage.addEventListener('pointercancel',release);stage.addEventListener('lostpointercapture',release);
stage.addEventListener('wheel',e=>{if(e.target.closest('aside'))return;e.preventDefault();inputActivity();const dy=e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?stage.clientHeight:1);state.targetFov=clamp(state.targetFov*Math.exp(clamp(dy*.00105,-.4,.4)),28,82);},{passive:false});
if(matchMedia('(pointer:coarse)').matches)byId('hint').textContent='单指环顾车厢 · 双指捏合变焦';
document.addEventListener('keydown',e=>{
  if(e.target.tagName==='INPUT')return;
  if(e.code==='Space'&&e.target.tagName==='BUTTON')return;
  if(e.key==='Escape'){if(!drawer.hidden){setDrawer(false);routeBtn.focus();}else if(immersive)full();return;}
  if(e.altKey||e.ctrlKey||e.metaKey)return;
  switch(e.key.toLowerCase()){
    case ' ':setPlay(!state.playing);break;case 'f':full();break;case 'm':toggleSound();break;
    case 'home':recenter();break;case 'arrowleft':state.targetYaw-=.14;break;case 'arrowright':state.targetYaw+=.14;break;
    case 'arrowup':state.targetPitch=clamp(state.targetPitch+.09,-1.54,1.54);break;case 'arrowdown':state.targetPitch=clamp(state.targetPitch-.09,-1.54,1.54);break;
    case '+':case '=':state.targetFov=clamp(state.targetFov-4,28,82);break;case '-':state.targetFov=clamp(state.targetFov+4,28,82);break; default:return;}
  e.preventDefault();inputActivity();
});
function makeRailSound(){
  const ac=new (window.AudioContext||window.webkitAudioContext)(),gain=ac.createGain(),low=ac.createBiquadFilter(),bp=ac.createBiquadFilter(),body=ac.createGain(),wheels=ac.createGain();
  low.type='lowpass';low.frequency.value=750;bp.type='bandpass';bp.frequency.value=1240;bp.Q.value=1.1;gain.gain.value=0;body.gain.value=.56;wheels.gain.value=.034;
  const buf=ac.createBuffer(1,ac.sampleRate*4,ac.sampleRate),s=buf.getChannelData(0);let old=0;
  for(let i=0;i<s.length;i++){old=(old+.13*(Math.random()*2-1))/1.027;s[i]=old*.70+(Math.random()*2-1)*.10;}
  const src=ac.createBufferSource();src.buffer=buf;src.loop=true;src.connect(low);src.connect(bp);low.connect(body);bp.connect(wheels);body.connect(gain);wheels.connect(gain);gain.connect(ac.destination);src.start();
  return {ac,gain,low,wheels,on:false,lastJoint:-1};
}
async function toggleSound(){try{
  if(!audioTrack)audioTrack=makeRailSound();if(audioTrack.ac.state==='suspended')await audioTrack.ac.resume();audioTrack.on=!audioTrack.on;
  const on=audioTrack.on,x=on?'关闭列车声':'开启列车声';soundBtn.setAttribute('aria-pressed',String(on));soundBtn.setAttribute('aria-label',x);soundBtn.title=x;icon(soundBtn.firstElementChild,on?'volume':'mute');
}catch{soundBtn.title='此浏览器未能启动音频';}}
soundBtn.onclick=toggleSound;
function mixRail(t){
  if(!audioTrack)return;const {ac,gain,low,wheels,on}=audioTrack;const n=ac.currentTime,cover=boreCover(t*14),audible=on&&state.playing&&!document.hidden;
  gain.gain.setTargetAtTime(audible?.38:0,n,.15);low.frequency.setTargetAtTime(420+210*cover+38*Math.sin(t*2.9),n,.3);
  const joint=Math.floor(t*1.77);
  if(joint!==audioTrack.lastJoint&&audible){wheels.gain.cancelScheduledValues(n);wheels.gain.setValueAtTime(.04,n);for(const d of [0,.132]){wheels.gain.setValueAtTime(.165+cover*.06,n+d);wheels.gain.exponentialRampToValueAtTime(.025,n+d+.075);}}
  audioTrack.lastJoint=joint;
}
document.addEventListener('visibilitychange',()=>{last=0;pausedForVisibility=document.hidden;mixRail(state.t);});
function animate(now){
  requestAnimationFrame(animate);if(document.hidden||pausedForVisibility){last=0;return;}
  const dt=last?Math.min(1.5,(now-last)/1000):0;last=now;if(state.playing&&!scrubbing)state.t=(state.t+dt)%DURATION;
  const returning=!pointers.size&&drawer.hidden&&now-lastInput>5500;
  if(returning)recenter();
  const k=1-Math.exp(-dt*(returning?1.65:17));state.yaw+=(state.targetYaw-state.yaw)*k;state.pitch+=(state.targetPitch-state.pitch)*k;state.fov+=(state.targetFov-state.fov)*k;
  const opacity=Math.max(smooth(213.2,214.7,state.t),1-smooth(1.15,2.38,state.t));byId('blackout').style.opacity=opacity>.001?String(opacity):'0';
  if(now-lastUI>100||lastUI<0){drawUI();mixRail(state.t);lastUI=now;byId('legend').classList.toggle('dim',now-lastHint>6500||!drawer.hidden||pointers.size>0);byId('restore').classList.toggle('fade',now-lastUIActivity>2600);}
  if(renderer&&opacity<.999){
    renderer.draw(state,stage.clientWidth,stage.clientHeight,now);
    if(renderer instanceof JourneyRenderer&&dt>0&&renderer.frame>12&&!scrubbing){
      renderer.metric=renderer.metric*.94+Math.min(250,dt*1000)*.06;
      if(renderer.frame%45===0&&renderer.metric>42&&renderer.quality>.62)renderer.quality=Math.max(.62,renderer.quality-.12);
    }
  }
}
async function start(){
  const picture=byId('panorama'),cabin=byId('cabin');
  await Promise.all([picture,cabin].map(img=>img.complete&&img.naturalWidth?Promise.resolve():img.decode()));
  const gl=canvas.getContext('webgl',{alpha:false,antialias:true,powerPreference:'high-performance',preserveDrawingBuffer:false})||canvas.getContext('experimental-webgl');
  try{if(!gl)throw Error('WebGL unavailable');renderer=new JourneyRenderer(canvas,gl,picture);canvas.setAttribute('data-renderer','webgl');}
  catch(error){console.warn('Software renderer:',error.message);const other=byId('fallback');other.hidden=false;canvas.style.display='none';renderer=new SoftwareJourney(other,picture);other.setAttribute('data-renderer','software');}
  canvas.addEventListener('webglcontextlost',e=>{e.preventDefault();if(renderer instanceof JourneyRenderer){const other=byId('fallback');other.hidden=false;canvas.style.display='none';renderer=new SoftwareJourney(other,picture);}});
  renderer.draw(state,stage.clientWidth,stage.clientHeight,performance.now());byId('loading').hidden=true;lastInput=lastHint=performance.now();drawUI();requestAnimationFrame(animate);
}
start().catch(e=>{byId('loading').textContent='画面加载失败，请重新打开文件。';console.error(e);});
