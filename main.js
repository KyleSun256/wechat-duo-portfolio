const roles=[['当前任务','用户此刻正在直接操作或聚焦关注的任务。','◎'],['关联任务','与当前任务有信息或操作关系，需要参考或配合的任务。','⌁'],['暂存任务','用户主动离开，但希望之后恢复的任务。','▯'],['持续任务','用户暂时不需要直接操作，但仍在进行的任务。','↗'],['待处理任务','因通知或新需求出现，用户尚未决定何时处理的任务。','↪'],['已结束任务','用户已完成、关闭或放弃的任务。','P']];
const relations=[
['中断与恢复','正在进行的任务A因任务B暂时离开，回到原任务时从离开的位置继续。',[0,2,4],'收到消息时，原来的当前任务转为暂存，新消息从待处理转为当前；处理后再恢复原任务。'],
['交替参考','为完成一项任务，需查看另一项内容并在两者之间来回切换以获取信息。',[0,1],'在文章与聊天之间切换时，当前与关联角色随操作焦点交换，双方保留上下文。'],
['并行协作','两项任务共同服务于同一个目标，用户需要持续关注或操作双方。',[0,1],'聊天与小程序共同服务于同一目标；当前任务获得操作焦点，关联任务同时可见、可操作。'],
['内容接力','用户将一项任务中的内容带入另一项任务中。',[0,1],'把文章内容带入聊天：来源与目的地建立关联，当前任务随操作转移；来源是否暂存由后续意图决定。'],
['任务管理','用户暂存了多项尚未完成的任务，需要安排后续处理顺序。',[0,2,4,5],'从暂存或待处理任务中选择一项作为当前任务，也可以明确结束不再需要的任务。'],
['后台持续','一项任务在不直接操作时继续进行，用户同时处理另一项前台任务。',[0,3],'前台处理当前任务，支持后台运行的内容作为持续任务；持续不等于已经结束。']];
const $=s=>document.querySelector(s), scroller=$('.role-scroll'), diagram=$('.diagram'), svg=$('.connections');
$('.roles').innerHTML=roles.map(([name,description,icon],i)=>`<article class="role" data-role="${i}"><img class="role-icon" src="assets/role-${i}.svg" alt=""><div><h3>${name}</h3><p>${description}</p></div></article>`).join('');
const priorities=['P0 核心基础场景','P0 机会场景','P0 机会场景','P1 补充场景','P0 支撑能力','P2 边界场景'];
$('.relations').innerHTML=relations.map(([name,description],i)=>`<div class="relation-column"><button class="relation" type="button" data-relation="${i}" aria-pressed="false"><strong>${name}</strong><span>${description}</span></button><span class="priority priority-${i}">${priorities[i]}</span></div>`).join('');
let selected=0,frame=0;
function draw(){frame=0;const base=diagram.getBoundingClientRect(),clip=scroller.getBoundingClientRect(),button=document.querySelector(`[data-relation="${selected}"]`).getBoundingClientRect();svg.setAttribute('viewBox',`0 0 ${base.width} ${base.height}`);svg.replaceChildren();for(const index of relations[selected][2]){const card=document.querySelector(`[data-role="${index}"]`).getBoundingClientRect();const x=card.left+card.width/2;const sx=x-base.left,sy=card.bottom-base.top,ex=button.left+button.width/2-base.left,ey=button.top-base.top;const path=document.createElementNS('http://www.w3.org/2000/svg','path');const mid=sy+40;path.setAttribute('d',`M ${sx} ${sy} V ${mid} H ${ex} V ${ey}`);svg.append(path);}}
function schedule(){if(!frame)frame=requestAnimationFrame(draw)}
function select(index){selected=index;document.querySelectorAll('.relation').forEach((el,i)=>el.setAttribute('aria-pressed',String(i===index)));document.querySelectorAll('.role').forEach((el,i)=>el.classList.toggle('active',relations[index][2].includes(i)));schedule()}
$('.relations').addEventListener('click',event=>{const button=event.target.closest('button');if(button)select(Number(button.dataset.relation))});
scroller.addEventListener('scroll',schedule,{passive:true});$('.relation-row').addEventListener('scroll',schedule,{passive:true});new ResizeObserver(schedule).observe(diagram);window.addEventListener('resize',schedule);document.fonts.ready.then(schedule);select(0);
const floatingFrame=document.querySelector('.floating-frame');
if(floatingFrame){const updateScale=()=>floatingFrame.style.setProperty('--floating-scale',floatingFrame.clientWidth/792);new ResizeObserver(updateScale).observe(floatingFrame);updateScale();}

// The diagram and device illustration describe the same retention state.
const splitControls=document.querySelector('.split-controls');
if(splitControls){
  const diagram=document.querySelector('#split-diagram');
  const device=document.querySelector('#split-device');
  const labels={keep:'保留',free:'不保留',unavailable:'不可保留'};
  splitControls.addEventListener('click',event=>{
    const button=event.target.closest('button[data-split-state]');
    if(!button||!splitControls.contains(button)) return;
    const state=button.dataset.splitState;
    for(const item of splitControls.querySelectorAll('button')) item.setAttribute('aria-pressed',String(item===button));
    diagram.src=`assets/split-diagram-${state}.png`;
    diagram.alt=`${labels[state]}状态的起始面板和尾侧面板示意`;
    device.src=`assets/split-screen-${state}.png`;
    device.alt=`${labels[state]}状态的内屏多任务示意`;
  });
}

// Scale the original design uniformly inside each responsive illustration frame.
const collabStages=document.querySelectorAll('.collab-stage');
if(collabStages.length){
  const updateCollabScale=stage=>stage.style.setProperty('--collab-stage-scale',stage.clientWidth/792);
  const collabResize=new ResizeObserver(entries=>entries.forEach(entry=>updateCollabScale(entry.target)));
  collabStages.forEach(stage=>{updateCollabScale(stage);collabResize.observe(stage)});
}

const rulesStages=document.querySelectorAll('.rules-stage');
if(rulesStages.length){
  const resizeRules=stage=>stage.style.setProperty('--rules-scale',stage.clientWidth/793);
  const rulesResize=new ResizeObserver(entries=>entries.forEach(entry=>resizeRules(entry.target)));
  rulesStages.forEach(stage=>{resizeRules(stage);rulesResize.observe(stage)});
}

// Each illustration finishes its current cycle before pausing off-screen.
const loopingFrames=document.querySelectorAll('.animation-awaiting-visibility');
if('IntersectionObserver' in window){
  const visibility=new WeakMap();
  const observer=new IntersectionObserver(entries=>{
    for(const entry of entries){
      const visible=entry.isIntersecting&&entry.intersectionRatio>0;
      visibility.set(entry.target,visible);
      if(visible) entry.target.classList.remove('animation-awaiting-visibility');
    }
  });
  loopingFrames.forEach(frame=>{
    visibility.set(frame,false);
    frame.addEventListener('animationiteration',event=>{
      if(!visibility.get(frame)&&event.target.closest('.floating-frame, .collab-stage, .rules-stage')===frame){
        frame.classList.add('animation-awaiting-visibility');
      }
    });
    observer.observe(frame);
  });
}else{
  loopingFrames.forEach(frame=>frame.classList.remove('animation-awaiting-visibility'));
}
