// The folded screen animation is drawn from the Figma layers onto a live texture.
let foldAnimationTexture=null;
const ruleScreens = Object.fromEntries([1,2,3].map(rule=>[rule,Object.fromEntries(['inner','bent','outer'].map(kind=>[kind,`./assets/rule${rule}-${kind}.png`]))]));
let selectedRule=1, screenBrightness=1, ruleTransition=false, playbackActive=false;
const ruleButtons=document.querySelectorAll('[data-rule]');
const host=document.querySelector('#duo-demo');
host.innerHTML=`<div class="mockup-stage"><div class="device-scene"></div><button type="button" class="mockup-replay" hidden><img src="assets/replay.svg" alt=""><span>重新播放</span></button><div class="mockup-controls" role="group" aria-label="样机开合"><button type="button" data-open="1" aria-pressed="true"><span><img src="assets/unfold.svg" alt=""></span>展开</button><button type="button" data-open="0.65" aria-pressed="false"><span><img src="assets/bend.svg" alt=""></span>弯折</button><button type="button" data-open="0" aria-pressed="false"><span><img src="assets/fold.svg" alt=""></span>折叠</button></div><label class="fold-slider" hidden>拖动体验开合<input type="range" min="0" max="100" value="100" aria-label="展开程度"><output>完全展开</output></label><span class="mockup-status" role="status"></span></div>`;
const slider=host.querySelector('input[type=range]'),output=host.querySelector('output');
const stage=host.querySelector('.device-scene');stage.innerHTML='<p class="scene-status" role="status">正在载入 3D 样机…</p>';
stage.dataset.productViewerId='duo-demo';stage.dataset.rtScenesPath='./vendor/apple-duo';stage.dataset.rtScenes='{}';stage.dataset.rtStates='{}';stage.dataset.rtAnalytics='{}';stage.dataset.ptBig='[]';stage.dataset.ptSmol='[]';stage.dataset.matchingAngles='[]';stage.classList.add('product-viewer-canvas');
slider.classList.add('control-detent-slider--thumb');slider.dataset.sliderAria=JSON.stringify({'0':'已折叠','1':'完全展开','default':'部分展开'});let scene,lotus,progress=1,rotationPivot,rotation=0,clarity=0,runId=0,layoutBlend=0,mode=1,screenMix=0,departingBent=false,bentBrightnessStart=1;
function sizeStage(){const small=host.clientWidth<760;stage.style.height=small?'440px':'880px';stage.style.top=small?'-20px':'-72px';}
function render(value){progress=Math.max(0,Math.min(1,value));const scale=host.clientWidth<760?1:1-(180/880)*Math.sin(Math.PI*progress)*layoutBlend;stage.style.transform=`translateX(${(-rotation/.55)*5}%) scale(${scale})`;slider.value=String(Math.round(progress*100));output.value=progress===1?'完全展开':progress===0?'已折叠':`展开 ${Math.round(progress*100)}%`;slider.setAttribute('aria-valuetext',output.value);host.querySelectorAll('[data-open]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.open)===progress)));if(!scene)return;const low=progress<=1/3?0:1/3,high=progress<=1/3?1/3:1;const a=progress<=1/3?'PT_SliderClosed':'PT_SliderLanding',b=progress<=1/3?'PT_SliderLanding':'PT_SliderOpen';scene.ptActivation.targetValue=1;scene.setPtVariantWeights([{label:a,weight:(high-progress)/(high-low)},{label:b,weight:(progress-low)/(high-low)}]);lotus.Lotus.tryRequestAnimationFrame();}
function rotate(value){rotation=value;if(rotationPivot){rotationPivot.rotation.y=value;lotus.Lotus.tryRequestAnimationFrame();}}
function setMix(value){screenMix=Math.max(0,Math.min(1,value));updateInnerComposite()}
function setClarity(value){clarity=value;if(scene)lotus.Lotus.tryRequestAnimationFrame();}
function tween(from,to,duration,update,id){return new Promise(resolve=>{const start=performance.now();function step(now){if(id!==runId){resolve(false);return}const t=Math.min(1,(now-start)/duration),e=t*t*(3-2*t);update(from+(to-from)*e);if(t<1)requestAnimationFrame(step);else resolve(true)}requestAnimationFrame(step)})}
// Each direction owns its shader state and can be interrupted without a stale callback.
async function openToBent(id){departingBent=false;setClarity(0);const from=progress,startLayout=layoutBlend;if(!await tween(0,1,1100,t=>{layoutBlend=startLayout+(1-startLayout)*t;render(from+(.65-from)*t)},id))return false;await new Promise(resolve=>setTimeout(resolve,1000));if(id!==runId)return false;const startRotation=rotation,startClarity=clarity,startMix=screenMix;bentBrightnessStart=screenController?.insideMesh?.material?.uniforms?.brightness?.value??1;return tween(0,1,900,t=>{rotate(startRotation+(-.55-startRotation)*t);render(progress);setClarity(startClarity+(1-startClarity)*t);setMix(startMix+(1-startMix)*t)},id)}
async function bentToOpen(id,target){departingBent=true;setClarity(1);const from=progress,startRotation=rotation,startLayout=layoutBlend,startMix=screenMix;const done=await tween(0,1,1100,t=>{layoutBlend=startLayout*(1-t);rotate(startRotation*(1-t));render(from+(target-from)*t);if(target===1)setMix(startMix*(1-t))},id);if(!done)return false;if(target!==0)departingBent=false;return true}
async function choose(target){
  if(ruleTransition||playbackActive||!scene)return;
  host.querySelector('.mockup-replay').hidden=true;
  if(foldAnimationTexture&&mode===0){screenController.outsideMesh.material.emissiveMapTarget=screens.outer;foldAnimationTexture.dispose();foldAnimationTexture=null;}
  if(mode===0&&departingBent){setMix(0);setClarity(0);departingBent=false;}
  const id=++runId;setControlsLocked(true);
  host.querySelectorAll('[data-open]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.open)===target)));
  try{
    const wasBent=mode===.65||layoutBlend>0||rotation!==0;mode=target;let done;
    if(target===.65)done=await openToBent(id);
    else if(wasBent)done=await bentToOpen(id,target);
    else{departingBent=false;setClarity(0);const from=progress;done=await tween(0,1,1100,t=>render(from+(target-from)*t),id)}
    if(done&&id===runId){
      host.querySelectorAll('[data-open]').forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.open)===target)));
      if(target===0&&selectedRule===1)await playRuleOneFoldAnimation({delay:2000});
    }
  }finally{if(!playbackActive&&!ruleTransition)setControlsLocked(false)}
}
host.querySelectorAll('[data-open]').forEach(b=>b.addEventListener('click',()=>choose(Number(b.dataset.open))));
async function init(){try{const req=window.duoRequire;const singleton=req('ApY4q/z+mDxRKgUHvbiF').ProductViewerWebGLSingleton;let Scene;singleton.loadScene=C=>{Scene=C};await req('pz0qtX7E9h5JJTfW5E1X').default.prototype.onViewerTriggerLoad.call({});lotus=window.Lotus;class DemoScene extends Scene{introHintSetup(){} }scene=await lotus.instance().loadScene({src:'./vendor/apple-duo/scenes/iPhoneDuo_ROW_L_avif.lsd',element:stage,SceneClass:DemoScene,assetsPath:'./vendor/apple-duo'});const model=scene.getComponentByName('JcvKFcEkqQvxADI').element;rotationPivot=new lotus.THREE.Group();model.parent.add(rotationPivot);rotationPivot.add(model);stage.querySelector('.scene-status')?.remove();render(progress);for(const kind of ['inner','bent','outer'])await setMockupScreen(kind,ruleScreens[selectedRule][kind]);setControlsLocked(false);}catch(e){console.error(e);stage.querySelector('.scene-status').textContent='3D 样机加载失败：'+e.message;}}
init();
// Custom screens retain the original Wipe shader on the original screen meshes.
const generations={inner:0,bent:0,outer:0};
const customTextures={};let screenController;const screens={};let blendTarget,blendScene,blendCamera,blendMaterial;
// Images are uploaded only when changed. Their crossfade is rendered on the GPU.
function updateInnerComposite(){if(!lotus||!screens.inner||!screenController?.insideMesh)return;const THREE=lotus.THREE;if(!blendTarget){blendTarget=lotus.instance().scene.renderer.createRenderTarget(2670,1878,{samples:0});blendTarget.depthBuffer=false;blendScene=new THREE.Scene();blendCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);blendMaterial=new THREE.ShaderMaterial({uniforms:{first:{value:null},second:{value:null},amount:{value:0}},vertexShader:'varying vec2 texUv; void main(){texUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}',fragmentShader:'uniform sampler2D first;uniform sampler2D second;uniform float amount;varying vec2 texUv;void main(){gl_FragColor=mix(texture2D(first,vec2(texUv.x,1.0-texUv.y)),texture2D(second,vec2(texUv.x,1.0-texUv.y)),amount);}',depthTest:false,depthWrite:false});blendScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),blendMaterial));}
blendMaterial.uniforms.first.value=screens.inner;blendMaterial.uniforms.second.value=screens.bent||screens.inner;blendMaterial.uniforms.amount.value=screens.bent?screenMix:0;const renderer=lotus.instance().scene.renderer;const previous=renderer.getRenderTarget();renderer.setRenderTarget(blendTarget);renderer.render(blendScene,blendCamera);renderer.setRenderTarget(previous);screenController.insideMesh.material.emissiveMapTarget=blendTarget.texture;lotus.Lotus.tryRequestAnimationFrame();}

export async function setMockupScreen(kind,url){if(!scene)throw new Error('请等待 3D 样机载入完成');if(!['inner','bent','outer'].includes(kind))throw new Error('Unknown screen');const generation=++generations[kind];const image=new Image();image.src=url;await image.decode();const canvas=document.createElement('canvas');[canvas.width,canvas.height]=kind!=='outer'?[2670,1878]:[1398,2034];const context=canvas.getContext('2d');context.fillStyle='#050505';context.fillRect(0,0,canvas.width,canvas.height);const scale=Math.min(canvas.width/image.naturalWidth,canvas.height/image.naturalHeight);const w=image.naturalWidth*scale,h=image.naturalHeight*scale;context.drawImage(image,(canvas.width-w)/2,(canvas.height-h)/2,w,h);if(generation!==generations[kind])return;const texture=new lotus.THREE.CanvasTexture(canvas);texture.colorSpace=lotus.THREE.SRGBColorSpace;texture.flipY=false;texture.repeat.y=-1;texture.offset.y=1;texture.anisotropy=Math.min(4,lotus.instance().scene.renderer.capabilities.getMaxAnisotropy());texture.needsUpdate=true;if(screens[kind])screens[kind].dispose();screens[kind]=texture;if(kind==='bent'){updateInnerComposite();return}screenController??=Array.from(scene.scripts).find(s=>s.script==='FadeThroughBlack');if(!screenController?.insideMesh)throw new Error('屏幕材质尚未准备完成');screenController.onLoop=()=>{};const material=(kind==='inner'?screenController.insideMesh:screenController.outsideMesh).material;if(kind==='inner'&&!material.userData.clarityWrapped){const original=material.onBeforeRender;material.onBeforeRender=function(...args){if(this.uniforms?.wipeAmount)this.uniforms.wipeAmount.value*=departingBent?0:1-clarity;if(this.uniforms?.transitionToCameraRest)this.uniforms.transitionToCameraRest.value=departingBent?1:clarity;if(this.uniforms?.brightness&&(clarity>0||departingBent))this.uniforms.brightness.value=departingBent?1:bentBrightnessStart+(1-bentBrightnessStart)*clarity;return original?.apply(this,args)};material.userData.clarityWrapped=true}material.emissiveMapTarget=texture;material.emissiveIntensity=screenBrightness;material.uniforms.enableFraming.value=true;if(material.uniforms.renderTargetScale)material.uniforms.renderTargetScale.value=1;customTextures[kind]=texture;if(kind==='inner')updateInnerComposite();lotus.Lotus.tryRequestAnimationFrame();}
// Invert the CSS cubic-bezier curve to reproduce Figma's interpolation.
function foldEase(value,x1,y1,x2,y2){
  const curve=(t,a,b)=>3*(1-t)*(1-t)*t*a+3*(1-t)*t*t*b+t*t*t;
  let low=0,high=1;for(let i=0;i<18;i++){const mid=(low+high)/2;if(curve(mid,x1,x2)<value)low=mid;else high=mid;}
  return curve((low+high)/2,y1,y2);
}
function foldProgress(t,start,end,ease){if(t<=start)return 0;if(t>=end)return 1;return foldEase((t-start)/(end-start),...ease)}
const foldImagesPromise=Promise.all(['100','99','98','103'].map(async id=>{const image=new Image();image.src=`assets/fold-${id}.png`;await image.decode();return image}));
async function playRuleOneFoldAnimation({delay=0}={}){
  if(playbackActive||selectedRule!==1||mode!==0)return;
  playbackActive=true;setControlsLocked(true);const replay=host.querySelector('.mockup-replay');replay.hidden=true;
  try{
    const [images]=await Promise.all([foldImagesPromise,new Promise(resolve=>setTimeout(resolve,delay))]);
    const [base,rail,article,nav]=images;
    const canvas=document.createElement('canvas');canvas.width=1398;canvas.height=2034;
    const ctx=canvas.getContext('2d');ctx.scale(3,3);
    const texture=new lotus.THREE.CanvasTexture(canvas);texture.colorSpace=lotus.THREE.SRGBColorSpace;texture.flipY=false;texture.repeat.y=-1;texture.offset.y=1;
    if(foldAnimationTexture)foldAnimationTexture.dispose();foldAnimationTexture=texture;
    screenController.outsideMesh.material.emissiveMapTarget=texture;
    const draw=t=>{
      const x=foldProgress(t,.29931,.54964,[0,0,0,1]);
      const close=foldProgress(t,.2992,.59914,[.525,0,0,1]);
      const control=foldProgress(t,.29925,.44676,[.42,0,0,1]);
      const railY=foldProgress(t,.52511,.69902,[0,0,0,1]);
      const navScale=foldProgress(t,.42761,.6401,[.5,0,.5,1]);
      const navY=foldProgress(t,.42761,.6401,[0,0,0,1]);
      ctx.clearRect(0,0,466,678);ctx.fillStyle='#fff';ctx.fillRect(0,0,466,678);
      ctx.drawImage(base,-398*(1-x),0,382,678);
      ctx.drawImage(rail,0,0,rail.width,342,382,-2,84,171);
      if(control<1){ctx.save();ctx.globalAlpha=1-control;const w=84-83*control,h=130-128.452*control;ctx.drawImage(rail,0,364,rail.width,260,382+41*control,182,w,h);ctx.restore()}
      ctx.drawImage(rail,0,628,rail.width,160,382,312-130*railY,84,80);
      if(close<1){ctx.save();ctx.globalAlpha=1-close;const x0=391.000641*close,y0=304*close,w=408+(52.956-408)*close,h=678+(88-678)*close;ctx.beginPath();ctx.roundRect(x0,y0,w,h,Math.min(94*close,w/2,h/2));ctx.clip();ctx.drawImage(article,x0,y0,w,h);ctx.restore()}
      const z=.07+.93*navScale,dy=236*(1-navY);ctx.save();ctx.translate(418,476.5+dy);ctx.scale(z,z);ctx.drawImage(nav,0,212,nav.width,806,-39,-201.5,78,403);ctx.restore();
      texture.needsUpdate=true;lotus.Lotus.tryRequestAnimationFrame();
    };
    const reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    await new Promise(resolve=>{let start;function frame(now){if(start===undefined)start=now;const t=reduced?1:Math.min(1,(now-start)/2000);draw(t);if(t<1)requestAnimationFrame(frame);else resolve()}requestAnimationFrame(frame)});
    replay.hidden=false;
  }catch(error){console.error(error);host.querySelector('.mockup-status').textContent='动画加载失败，请重试。';screenController.outsideMesh.material.emissiveMapTarget=screens.outer;}
  finally{playbackActive=false;setControlsLocked(false)}
}
host.querySelector('.mockup-replay').addEventListener('click',()=>playRuleOneFoldAnimation());
function setControlsLocked(locked){
  host.querySelectorAll('[data-open]').forEach(b=>b.disabled=locked);
  ruleButtons.forEach(b=>b.disabled=locked);
}
function setBrightness(value){
  screenBrightness=value;
  if(screenController){for(const mesh of [screenController.insideMesh,screenController.outsideMesh])if(mesh?.material)mesh.material.emissiveIntensity=value;}
  lotus?.Lotus.tryRequestAnimationFrame();
}
async function selectRule(rule){
  if(!scene||ruleTransition||playbackActive||selectedRule===rule)return;
  ruleTransition=true;setControlsLocked(true);host.querySelector('.mockup-replay').hidden=true;
  if(foldAnimationTexture&&mode===0){screenController.outsideMesh.material.emissiveMapTarget=screens.outer;foldAnimationTexture.dispose();foldAnimationTexture=null;}
  const id=++runId;
  try{
    await tween(screenBrightness,0,220,setBrightness,id);
    for(const kind of ['inner','bent','outer'])await setMockupScreen(kind,ruleScreens[rule][kind]);
    selectedRule=rule;ruleButtons.forEach(b=>b.setAttribute('aria-pressed',String(Number(b.dataset.rule)===rule)));
    await tween(0,1,220,setBrightness,id);
  }catch(error){console.error(error);host.querySelector('.mockup-status').textContent='画面加载失败，请重试。';setBrightness(1)}
  finally{ruleTransition=false;setControlsLocked(false)}
  if(selectedRule===1&&mode===0)await playRuleOneFoldAnimation({delay:2000});
}
ruleButtons.forEach(button=>button.addEventListener('click',()=>selectRule(Number(button.dataset.rule))));
setControlsLocked(true);
sizeStage();render(1);

window.addEventListener('resize',()=>{sizeStage();render(progress)});
