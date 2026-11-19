const $=id=>document.getElementById(id);
const stream=$('stream'), input=$('input'), sendBtn=$('send'), engine=$('engine');
const pick=$('pick'), fileEl=$('file'), thumb=$('thumb'), pmsg=$('pmsg');
const drop=$('drop'), pbar=$('pbar'), empty=$('empty');
const exportBtn=$('export'), resetBtn=$('reset');
let history=[], lastResumeText='', demoProfile={}, offlineMode=false, chatPersona='zhitu', interviewState=null, lastProfile={};

/* 后端/本地两条链路的档案合并，用于导出与复制 */
function currentProfile(){
  const p=Object.assign({}, lastProfile, demoProfile);
  const sk=p.skills;
  p.skills = Array.isArray(sk) ? sk : String(sk||'').split(/[、,，\s]+/).filter(Boolean);
  p.target = p.target || p.target_job || '';
  return p;
}

/* 客户端环境：微信 / QQ / 普通浏览器 */
const UA=navigator.userAgent||'';
const IN_WECHAT=/MicroMessenger/i.test(UA);
const IN_QQ=/QQ/i.test(UA) && !IN_WECHAT;
const IS_MOBILE=/Android|iPhone|iPad|Mobile|HarmonyOS/i.test(UA);

/* 移动端空间优化：工具栏单行横滑 + 面板改底部浮层 */
document.head.insertAdjacentHTML('beforeend', `<style id="sheet-ui">
  .cfg{position:fixed!important;left:0;right:0;bottom:0;max-width:620px;margin:0 auto;z-index:41;
       max-height:70vh;overflow-y:auto;background:#fff;border:1px solid var(--border);
       border-radius:16px 16px 0 0;box-shadow:0 -8px 28px rgba(3,105,161,.22);
       padding:14px 14px calc(14px + env(safe-area-inset-bottom))}
  .cfg[hidden]{display:none!important}
  .sheet-backdrop{position:fixed;inset:0;background:rgba(8,40,60,.34);z-index:40;display:none}
  .cfg .panel-x{position:absolute;top:8px;right:8px;width:32px;height:32px;border:1px solid var(--border);
       background:#fff;border-radius:8px;font-size:18px;line-height:1;color:var(--ink-2);cursor:pointer;z-index:3}
  .toolbar .sel{height:34px;border:1px solid var(--border);border-radius:8px;background:var(--surface-2);
       font-family:inherit;font-size:12px;color:var(--ink-2);padding:0 6px;flex:0 0 auto}
  .toolbar .ghost.demo{border-color:var(--accent);color:#0d7c3c;background:#eafaf0}
  .mic-on{background:#fff1f2!important;border-color:#f7a3ab!important;color:#b91c1c!important}
  @media (max-width:820px){
    .toolbar{flex-wrap:nowrap!important;overflow-x:auto;overflow-y:hidden;gap:6px;padding-bottom:4px;
             -webkit-overflow-scrolling:touch}
    .toolbar::-webkit-scrollbar{display:none}
    .toolbar .ghost,.toolbar .sel{flex:0 0 auto}
    .hint{display:none}
    .composer{padding:8px 12px calc(8px + env(safe-area-inset-bottom))}
  }
</style>`);

/* 离线缓存（不依赖 index.html） */
(function pwa(){
  const l=document.createElement('link'); l.rel='manifest'; l.href='manifest.json'; document.head.appendChild(l);
  if('serviceWorker' in navigator && /^https?:/.test(location.protocol)){
    navigator.serviceWorker.register('sw.js',{updateViaCache:'none'}).catch(()=>{});
  }
})();

const SLOTS=[['name','姓名'],['edu','学历'],['skills','技能'],['projects','项目'],
             ['certs','证书'],['target_job','岗位']];

function renderProfile(p){
  if(!p) return;
  const filled=SLOTS.filter(([k])=>p[k]);
  pbar.innerHTML = filled.length
    ? '<span class="lead">档案</span>'+filled.map(([k,l])=>
        `<span class="slot">${l}·${String(p[k]).slice(0,16)}</span>`).join('')
    : '<span class="lead">档案</span><span>还没填 —— 先说一句学历、技能和目标岗位</span>';
}

function pushRow(html, cls){
  if(empty) empty.remove();
  const wrap=document.createElement('div'); wrap.className='row-in '+cls;
  wrap.innerHTML=html;
  stream.appendChild(wrap); stream.scrollTop=stream.scrollHeight;
  return wrap;
}
function bubble(text,cls){
  const wrap=pushRow('', '');
  const d=document.createElement('div');
  d.className='msg '+cls; d.textContent=text;
  wrap.appendChild(d); stream.scrollTop=stream.scrollHeight;
  return d;
}
function trace(steps){
  if(!steps||!steps.length) return;
  const wrap=pushRow('', '');
  const t=document.createElement('div'); t.className='trace';
  t.innerHTML=steps.map((s,i)=>`<span class="t">步骤${i+1} <b>${s.action}</b></span>`).join('');
  wrap.appendChild(t); stream.scrollTop=stream.scrollHeight;
}

function setMode(offline){
  if(offlineMode===offline) return;
  offlineMode=offline;
  engine.textContent = offline ? '离线模式 · 本地引擎' : engine.textContent;
  if(offline){
    bubble('当前是离线模式：没连上后端 server.py，按钮用内置岗位库与同一套规则计算，结果依然是真的，只是不调大模型。', 'bot');
  }
}

function demoReply(q){
  const r = window.CareerDemo ? window.CareerDemo.answer(q, demoProfile) : {text:'离线引擎未加载', action:'none'};
  demoProfile = window.CareerDemo ? window.CareerDemo.merge(demoProfile, q) : demoProfile;
  return r;
}

function renderLocalProfile(){
  if(!window.CareerDemo) return;
  renderProfile({
    name: demoProfile.name||'', edu: demoProfile.edu||'',
    skills:(demoProfile.skills||[]).join('、'), projects: demoProfile.projects||'',
    certs: demoProfile.certs||'', target_job: demoProfile.target||''
  });
}

function setBusy(busy, text){
  sendBtn.disabled=busy; stream.setAttribute('aria-busy', busy?'true':'false');
  if(text!==undefined) pmsg.textContent=text;
}

async function ask(q){
  if(!q.trim()) return;
  if(interviewState && !interviewState.done) return handleInterview(q);
  const wants=/匹配|岗位|投|差什么|面试|简历/.test(q);
  let payload=q;
  if(lastResumeText && wants && !/简历原文/.test(q)) payload=q+'\n\n简历原文：\n'+lastResumeText;
  bubble(q,'user');
  input.value=''; input.style.height='48px';
  setBusy(true,'分析中…');
  const typing=bubble('分析中…','bot plain'); typing.id='typing';
  try{
    if(offlineMode && CareerLLM.ready()){
      const t=$('typing'); if(t) t.remove();
      const result = await CareerLLM.chatAs(payload, demoProfile, chatPersona, (step)=>{ trace([{action:step.action}]); });
      demoProfile = CareerDemo.merge(demoProfile, payload);
      trace(result.steps.map(s=>({action:s.action})));
      bubble(result.answer,'bot'); renderLocalProfile();
      history.push({role:'user',content:payload},{role:'assistant',content:result.answer});
      return;
    }
    const res=await fetch('/api/chat',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({question:payload,history:history.slice(-2)})});
    const d=await res.json();
    const t=$('typing'); if(t) t.remove();
    if(d.error){ bubble('出错了：'+d.error,'bot'); }
    else{
      trace(d.steps); bubble(d.answer,'bot'); renderProfile(d.profile); lastProfile=d.profile||{};
      if(d.engine) engine.textContent=d.engine;
      history.push({role:'user',content:payload},{role:'assistant',content:d.answer});
    }
  }catch(e){
    const t=$('typing'); if(t) t.remove();
    setMode(true);
    const r = demoReply(q);
    trace([{action:r.action}]); bubble(r.text,'bot'); renderLocalProfile();
  }finally{ setBusy(false, offlineMode?'离线模式 · 本地引擎':'PNG / JPG · 本地 OCR'); stream.scrollTop=stream.scrollHeight; }
}

async function handleImage(file){
  if(!file||!file.type.startsWith('image/')) return;
  const alive=await ensureBackend();
  if(!alive){
    bubble('连不上后端服务，图片 OCR 不可用。\n请确认 python server.py 正在运行；也可以把简历文字直接粘给我。','bot');
    return;
  }
  thumb.src=URL.createObjectURL(file); thumb.style.display='block';
  pmsg.textContent='识别中…';
  const dataUrl=await new Promise(res=>{const fr=new FileReader(); fr.onload=()=>res(fr.result); fr.readAsDataURL(file);});
  bubble('【简历图片】'+(file.name||'screenshot'),'user');
  drop.classList.remove('show'); setBusy(true, '识别中…');
  try{
    const r=await fetch('/api/resume/image',{method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify({image_base64:dataUrl})});
    const d=await r.json();
    if(!d.ok){
      pmsg.textContent='识别失败';
      bubble('没能识别这张图：'+(d.reason||'未知原因')+'\n\n可以直接把简历文字粘贴给我。','bot');
      return;
    }
    pmsg.textContent='识别完成'; lastResumeText=d.text; renderProfile(d.profile);
    bubble('识别到的文字（可复制修正后再问）：\n'+d.text.slice(0,600),'ocr');
    trace(d.steps); bubble(d.answer,'bot');
  }catch(e){
    pmsg.textContent='请求失败';
    bubble('连不上本地服务，请确认 python server.py 正在运行。','bot');
  }finally{ setBusy(false,'PNG / JPG · 本地 OCR'); stream.scrollTop=stream.scrollHeight; }
}

pick.onclick=()=>fileEl.click();
fileEl.onchange=e=>{ if(e.target.files[0]) handleImage(e.target.files[0]); fileEl.value=''; };
sendBtn.onclick=()=>ask(input.value);
input.addEventListener('keydown',e=>{ if(e.key==='Enter'&&!e.shiftKey){e.preventDefault(); ask(input.value);} });
input.addEventListener('input',()=>{ input.style.height='48px'; input.style.height=Math.min(input.scrollHeight,150)+'px'; });
document.querySelectorAll('.chip').forEach(c=> c.onclick=()=>{
  // 带 demo-random 标记的按钮：点击时随机生成一份样例身份，而不是写死同一句
  if(c.dataset.random && window.CareerDemo){
    c.dataset.q = CareerDemo.randomIntro().sentence;
  }
  input.value=c.dataset.q; input.focus();
  document.querySelectorAll('.chip').forEach(x=>x.removeAttribute('aria-pressed'));
  c.setAttribute('aria-pressed','true');
});

function downloadBlob(content, filename, mime){
  const a=document.createElement('a');
  a.href=URL.createObjectURL(new Blob([content],{type:mime}));
  a.download=filename; a.click();
  setTimeout(()=>URL.revokeObjectURL(a.href), 3000);
}

exportBtn.onclick=async()=>{
  const pNow=currentProfile();
  if(!pNow.name && !pNow.skills.length){
    bubble('先说一句学历、技能和目标岗位，我才能出简历。\n比如：我大专，会 PS 剪映，想投新媒体运营。','bot');
    return;
  }
  const sel=document.getElementById('tplSel');
  const kind=sel ? sel.value : 'simple';
  if(window.ResumeTPL){
    exportBtn.disabled=true; pmsg.textContent='生成中…';
    const t=ResumeTPL.build(pNow, kind);
    downloadBlob(t.html, t.filename, 'application/msword');
    pmsg.textContent='已生成 '+t.filename+(IN_WECHAT?'（微信拦下载就用「复制简历」）':'');
    bubble('已按「'+(ResumeTPL.KINDS[kind]||{}).name+'」导出：'+t.filename+'\n想换版式，在工具栏左侧的模板下拉里切一下再点导出。','bot');
    exportBtn.disabled=false;
    return;
  }
  exportBtn.disabled=true; pmsg.textContent='生成中…';
  try{
    const r=await fetch('/api/export/resume',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'});
    const d=await r.json();
    if(!d.ok){ pmsg.textContent=''; bubble('导出失败：'+(d.error||'未知原因'),'bot'); return; }
    const bytes=Uint8Array.from(atob(d.base64),c=>c.charCodeAt(0));
    const a=document.createElement('a');
    a.href=URL.createObjectURL(new Blob([bytes],{type:d.mime})); a.download=d.filename; a.click();
    pmsg.textContent='已下载 '+d.filename+(IN_WECHAT?'（微信可能拦截，可点「复制简历」）':'');
  }catch(e){
    setMode(true);
    if(window.CareerDemo){
      const html=window.CareerDemo.doc(currentProfile());
      downloadBlob(html,'简历.doc','application/msword');
      pmsg.textContent='已下载 简历.doc（离线导出）'+(IN_WECHAT?'：微信拦下载就用「复制简历」':'');
    } else {
      pmsg.textContent=''; bubble('导出失败，请确认 python server.py 在运行。','bot');
    }
  }
  finally{ exportBtn.disabled=false; }
};

resetBtn.onclick=async()=>{
  try{ await fetch('/api/reset',{method:'POST'}); }catch(e){}
  history=[]; lastResumeText=''; demoProfile={}; renderProfile({});
  bubble('档案已清空，重新说一遍你的情况就行。','bot');
};

['dragenter','dragover'].forEach(ev=>document.addEventListener(ev,e=>{e.preventDefault();drop.classList.add('show');}));
['dragleave','drop'].forEach(ev=>document.addEventListener(ev,e=>{e.preventDefault();drop.classList.remove('show');}));
document.addEventListener('drop',e=>{ const f=e.dataTransfer.files&&e.dataTransfer.files[0]; if(f) handleImage(f); });
document.addEventListener('paste',e=>{
  const item=[...(e.clipboardData?.items||[])].find(i=>i.type.startsWith('image/'));
  if(item) handleImage(item.getAsFile());
});

CareerLLM.load();
document.getElementById('cfgBase').value = CareerLLM.cfg.base;
document.getElementById('cfgModel').value = CareerLLM.cfg.model;
document.getElementById('cfgKey').value = CareerLLM.cfg.key ? '••••••••' : '';

/* 面板 = 底部浮层：不占对话区，点遮罩或 × 关闭 */
let sheetBackdrop=null;
function ensureBackdrop(){
  if(sheetBackdrop) return sheetBackdrop;
  sheetBackdrop=document.createElement('div');
  sheetBackdrop.className='sheet-backdrop';
  sheetBackdrop.onclick=()=>closeSheets();
  document.body.appendChild(sheetBackdrop);
  return sheetBackdrop;
}
function closeSheets(){
  document.querySelectorAll('.cfg').forEach(b=>{ b.hidden=true; });
  if(sheetBackdrop) sheetBackdrop.style.display='none';
  const t=document.getElementById('typing'); if(t) t.remove();
}
function openSheet(box){
  closeSheets();
  if(!box) return;
  box.hidden=false;
  ensureBackdrop().style.display='block';
  const first=box.querySelector('select,input'); if(first) first.focus();
}
function decoratePanel(box, label){
  if(!box || box.dataset.decorated) return;
  box.dataset.decorated='1';
  const b=document.createElement('button');
  b.type='button';
  b.setAttribute('aria-label','关闭'+label+'面板');
  b.className='panel-x';
  b.textContent='×';
  b.onclick=()=>closeSheets();
  box.appendChild(b);
}
decoratePanel(document.getElementById('cfg'),'连接大模型');
decoratePanel(document.getElementById('mock'),'模拟面试');

document.getElementById('cfgBtn').onclick = () => {
  const box = document.getElementById('cfg');
  box.hidden ? openSheet(box) : closeSheets();
  if(!box.hidden) document.getElementById('cfgBase').focus();
};

document.getElementById('cfgSave').onclick = async () => {
  const base = document.getElementById('cfgBase').value.trim();
  const model = document.getElementById('cfgModel').value.trim();
  const rawKey = document.getElementById('cfgKey').value.trim();
  const key = rawKey.startsWith('•') ? CareerLLM.cfg.key : rawKey;
  const msg = document.getElementById('cfgMsg');
  msg.className = ''; msg.textContent = '测试中…';
  Object.assign(CareerLLM.cfg, { base, model, key });
  CareerLLM.save();
  try{
    const r = await fetch(base.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST',
      headers: {'Content-Type': 'application/json', Authorization: 'Bearer ' + key},
      body: JSON.stringify({model, messages: [{role: 'user', content: '回复 ok'}], max_tokens: 8}),
    });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    msg.className = 'ok';
    msg.textContent = '连接成功，可以真对话了';
    engine.textContent = '浏览器直连大模型 · ' + model;
    offlineMode = true;
  }catch(e){
    msg.className = 'err';
    msg.textContent = '连接失败：' + (String(e.message).includes('Failed to fetch')
      ? '被跨域拦截，请改用后端模式（python server.py）' : e.message);
  }
};

async function backendAlive(){
  try{ const r=await fetch('/api/health'); return r.ok; }catch(e){ return false; }
}
async function refreshMode(){
  const alive=await backendAlive();
  if(alive){ offlineMode=false; engine.textContent='本地后端引擎'; return true; }
  setMode(true); return false;
}
refreshMode();
// 图片上传前再探一次后端：连得上就走 OCR，连不上才退离线提示
async function ensureBackend(){
  if(offlineMode) await refreshMode();
  return !offlineMode;
}

fetch('/api/profile').then(r=>r.json()).then(d=>{renderProfile(d.profile);}).catch(()=>{});

/* ------------------------ 模拟面试 ------------------------ */
const mockBtn=$('mockBtn'), mockBox=$('mock'), mockRole=$('mockRole'), mockPersona=$('mockPersona');
const mockStart=$('mockStart'), mockStop=$('mockStop'), mockMsg=$('mockMsg');

function updateInterviewBar(){
  if(!interviewState){ renderProfile({}); return; }
  const name=(Persona.PERSONAS[interviewState.persona]||{}).name||'面试官';
  pbar.innerHTML='<span class="lead">面试</span>'+
    `<span class="slot">岗位·${interviewState.role}</span>`+
    `<span class="slot">面试官·${name}</span>`+
    `<span class="slot">进度·${Math.min(interviewState.idx+1,interviewState.total)}/${interviewState.total}</span>`;
}

function startInterview(){
  const role=mockRole.value, persona=mockPersona.value;
  interviewState=Persona.interview(role, persona);
  chatPersona=persona;
  const name=Persona.PERSONAS[persona].name;
  mockMsg.textContent='面试进行中：'+role+' · '+name;
  mockStop.hidden=false; mockStart.textContent='重新开始';
  input.placeholder='像真实面试一样回答，控制在 90 秒内…';
  bubble('【模拟面试开始】岗位：'+role+'｜面试官：'+name+'\n'+Persona.PERSONAS[persona].voice,'bot');
  bubble('【'+name+'】'+Persona.currentQuestion(interviewState),'bot');
  updateInterviewBar();
  closeSheets();                             /* 开始后收起浮层，对话区全空出来 */
  stream.scrollTop=stream.scrollHeight;
  input.focus();
}

let probeEnabled=true;

function probeFor(answer, personaId){
  const a=String(answer||'').trim();
  if(a.length<40) return '再具体一点：这件事里你亲手做了哪几步动作？';
  if(!/\d/.test(a)) return '给个具体数字：量级、周期，或者结果指标是多少？';
  if(/我们|团队|组里/.test(a)) return '你说的“我们”里，哪一步是你亲手做的？其余是谁做的？';
  if(personaId==='hr_hard') return '这个结果能复现吗？凭什么说是你带来的？';
  return null;
}

async function handleInterview(q){
  const st=interviewState;
  if(st && st.probeQ){                       /* 正在答追问：点评完直接抛回主问题 */
    bubble(q,'user'); input.value=''; input.style.height='48px';
    const parts=window.CareerDemo?CareerDemo.evaluateParts(st.probeQ,q):{score:60,text:'',flags:[]};
    if(parts.text) bubble('【追问点评】'+String(parts.text).replace(/^【STAR 点评】/,''),'bot');
    const name=(Persona.PERSONAS[st.persona]||{}).name||'面试官';
    const nextQ=st.pending; st.probeQ=null; st.pending=null;
    bubble('【'+name+'】'+nextQ,'bot');
    updateInterviewBar(); stream.scrollTop=stream.scrollHeight;
    return;
  }
  bubble(q,'user'); input.value=''; input.style.height='48px';
  setBusy(true,'面试官思考中…');
  const typing=bubble('…','bot plain'); typing.id='typing';
  try{
    const res=await CareerLLM.interviewTurn(interviewState, q, demoProfile, interviewState.persona);
    const t=$('typing'); if(t) t.remove();
    if(res.feedback) bubble('【点评】'+String(res.feedback).replace(/^【STAR 点评】/,''),'bot');
    if(res.done){
      bubble(res.report,'bot'); mockMsg.textContent='报告已出，可以再来一次';
      interviewState=null; mockStop.hidden=true; mockStart.textContent='再来一次';
      input.placeholder='比如：我会 PS 和剪映，做过公众号，大专，想投新媒体运营…';
      renderProfile({});
    } else {
      const name=(Persona.PERSONAS[interviewState.persona]||{}).name||'面试官';
      const probe = (probeEnabled && !interviewState.probeCount) ? probeFor(q, interviewState.persona) : null;
      if(probe && res.next){
        interviewState.probeCount=1; interviewState.pending=res.next; interviewState.probeQ=probe;
        bubble('【'+name+'（追问）】'+probe,'bot');
      } else if(res.next){
        interviewState.probeCount=0;
        bubble('【'+name+'】'+res.next,'bot');
      }
      updateInterviewBar();
    }
  }catch(e){
    const t=$('typing'); if(t) t.remove();
    bubble('面试中断：'+(e.message||'未知错误')+'\n（可在「连接大模型」里检查 Key，或直接用本地模式继续）','bot');
  }finally{ setBusy(false, interviewState?'面试进行中':'PNG / JPG · 本地 OCR'); stream.scrollTop=stream.scrollHeight; }
}

mockBtn.onclick=()=>{
  const box=mockBox;
  box.hidden ? openSheet(box) : closeSheets();
  if(!box.hidden){ mockRole.focus(); stream.scrollTop=stream.scrollHeight; }
};
mockStart.onclick=()=>{ startInterview(); };
mockStop.onclick=()=>{
  if(!interviewState) return;
  if(interviewState.log.length) bubble(Persona.report(interviewState),'bot');
  else bubble('还没答题，先答一题再出报告。','bot');
  mockMsg.textContent='报告已出';
  interviewState=null; mockStop.hidden=true; mockStart.textContent='再来一次';
  renderProfile({});
};

/* ------------------------ 跨客户端适配 ------------------------ */
function envTip(){
  const bar=$('wcBar'), txt=$('wcText');
  if(!bar||!txt) return;
  if(IN_WECHAT){
    txt.innerHTML='<b>微信里</b>能聊能面试，但 Word 下载会被拦。点右上角「…」→ 在浏览器打开，或用下面的「复制简历」把内容粘到 WPS / 备忘录。';
    bar.hidden=false;
  } else if(IN_QQ){
    txt.innerHTML='<b>QQ 里</b>能正常对话；下载简历如失败，点右上角「在浏览器打开」，或用「复制简历」。';
    bar.hidden=false;
  }
}

async function copyText(text){
  try{
    if(navigator.clipboard && !IN_WECHAT){ await navigator.clipboard.writeText(text); return true; }
  }catch(e){}
  try{
    const ta=document.createElement('textarea');
    ta.value=text; ta.style.position='fixed'; ta.style.top='-9999px';
    document.body.appendChild(ta); ta.focus(); ta.select();
    const ok=document.execCommand('copy'); document.body.removeChild(ta);
    return ok;
  }catch(e){ return false; }
}

function resumeText(){
  if(lastResumeText) return lastResumeText;
  const p=currentProfile();
  if(window.CareerDemo && (p.name || p.skills.length)) return window.CareerDemo.resume(p);
  return '';
}

const copyBtn=$('copyBtn');
copyBtn.onclick=async()=>{
  const text=resumeText();
  if(!text){ bubble('还没有简历内容，先说一句学历、技能和目标岗位。','bot'); return; }
  const ok=await copyText(text);
  pmsg.textContent= ok ? '已复制，粘贴到 WPS/备忘录即可' : '复制失败，长按对话里的简历文字手动复制';
  if(!ok) bubble(text,'ocr');
  else bubble('简历文本已复制到剪贴板（'+text.length+' 字）。','bot');
};

/* ------------------------ 工具栏增强：模板 / 一键演示 / 语音 ------------------------ */
const toolbar=document.querySelector('.toolbar');
const sleep=ms=>new Promise(r=>setTimeout(r,ms));

function addTplSel(){
  if(!toolbar || !window.ResumeTPL || document.getElementById('tplSel')) return;
  const sel=document.createElement('select');
  sel.id='tplSel'; sel.className='sel'; sel.setAttribute('aria-label','简历模板');
  Object.keys(ResumeTPL.KINDS).forEach(k=>{
    const o=document.createElement('option'); o.value=k; o.textContent=ResumeTPL.KINDS[k].name; sel.appendChild(o);
  });
  toolbar.insertBefore(sel, toolbar.firstChild);
}
(function loadTPL(){
  if(window.ResumeTPL) return addTplSel();
  const s=document.createElement('script'); s.src='tpl.js'; s.onload=addTplSel; s.onerror=()=>{};
  document.head.appendChild(s);
})();

let demoRunning=false;
const demoBtn=document.createElement('button');
demoBtn.className='ghost demo';
demoBtn.innerHTML='<svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z"/></svg>一键演示 30 秒';
demoBtn.setAttribute('aria-label','一键跑完整演示');
demoBtn.onclick=()=>runDemo();
if(toolbar) toolbar.appendChild(demoBtn);

async function runDemo(){
  if(demoRunning) return;
  demoRunning=true; demoBtn.disabled=true; demoBtn.textContent='演示中…'; probeEnabled=false;
  closeSheets();
  bubble('【一键演示】我按顺序跑一遍：建档 → 生成简历 → 匹配 → 推荐 → 压力面 → 导出。你什么都不用点。','bot');
  try{
    resetBtn.onclick(); await sleep(600);
    // 随机生成一份演示身份（姓名/学校/专业/技能/项目/岗位每次不同）
    const intro = window.CareerDemo ? CareerDemo.randomIntro() : {
      profile: { name: "李明", school: "某某学院", major: "数字媒体技术", edu: "大专",
        skills: ["PS", "剪映", "3ds Max"], project: "校园文创设计项目", target: "新媒体运营" },
      sentence: "我叫李明，某某学院 数字媒体技术 大专，会 PS、剪映、3ds Max，做过校园文创设计项目，想投新媒体运营"
    };
    const p = intro.profile;
    await ask(intro.sentence);
    await sleep(1100);
    await ask('帮我生成一份简历'); await sleep(1400);
    await ask('我投'+p.target+'匹配度多少，还差什么'); await sleep(1400);
    await ask('我适合投什么岗位'); await sleep(1400);
    mockRole.value=p.target; mockPersona.value='hr_hard';
    startInterview(); await sleep(1200);
    const canned=[
      '我是'+p.name+'，'+p.major+'专业，会用'+p.skills.slice(0,2).join('和')+'，做过'+p.project+'的主视觉，还剪了一条宣传短片，播放量1.2万。',
      p.project+'我负责选题、分镜、剪辑三步，拍摄是同学配合，我一个人剪了3条，最好一条播放1.2万、涨粉300。',
      '先看选题的完播率，再看封面点击率，最后看发布时段；我把发布时间从晚上9点改到12点，播放涨了40%。',
      '前两周拆解5条同类爆款，定3个选题方向，每天发1条，第7天按数据取舍，目标30天5000粉，先做到1000粉验证。',
      '我最不适合的是镜头前表达，所以先把脚本和剪辑做扎实，用内容补表达。',
    ];
    for(const a of canned){ await handleInterview(a); await sleep(1100); }
    await sleep(500);
    exportBtn.onclick(); await sleep(700);
    pmsg.textContent='演示结束，可以自己接着试';
  }catch(e){
    bubble('演示中断：'+(e.message||e),'bot');
  }finally{
    demoRunning=false; demoBtn.disabled=false; probeEnabled=true;
    demoBtn.innerHTML='<svg viewBox="0 0 24 24"><path d="M8 5l11 7-11 7z"/></svg>一键演示 30 秒';
  }
}

/* 语音答题：浏览器自带识别；不支持时给出明确回退 */
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
const micBtn=document.createElement('button');
micBtn.className='ghost';
micBtn.innerHTML='<svg viewBox="0 0 24 24"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0014 0M12 18v3"/></svg>语音说';
micBtn.setAttribute('aria-label','语音输入');
let rec=null;
micBtn.onclick=()=>{
  if(!SR){
    bubble('这个浏览器不支持语音识别（微信内置浏览器一般不支持）。\n可以用输入法自带的麦克风键，或换 Chrome / Safari / 夸克 打开。','bot');
    return;
  }
  if(rec){ rec.stop(); rec=null; micBtn.classList.remove('mic-on'); return; }
  try{
    rec=new SR(); rec.lang='zh-CN'; rec.interimResults=false; rec.maxAlternatives=1;
    rec.onresult=e=>{
      const t=e.results[0][0].transcript;
      input.value=(input.value?input.value+' ':'')+t;
      input.focus();
      bubble('（语音）'+t,'user');
      ask(t);
    };
    rec.onerror=e=>bubble('语音识别失败：'+(e.error||'未知')+'，用键盘输入吧。','bot');
    rec.onend=()=>{ rec=null; micBtn.classList.remove('mic-on'); };
    micBtn.classList.add('mic-on'); rec.start();
  }catch(e){ bubble('语音启动失败，用键盘输入吧。','bot'); }
};
if(toolbar) toolbar.insertBefore(micBtn, demoBtn);

envTip();
