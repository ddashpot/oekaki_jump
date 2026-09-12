const API_URL = "https://api.openai.com/v1/images/edits";
const GIF_WORKER_URL = "https://cdn.jsdelivr.net/npm/gif.js.optimized@1.0.1/dist/gif.worker.js";

const DEFAULT_PROMPT = `添付した子どもの絵をもとに、キャラクターだけを完成イラストにしてください。

写真に写っている紙、布、机、影、文字、メモ、周囲の不要なものをすべて取り除き、キャラクターの絵の部分だけを抽出してください。

元の子どもの絵にある形、色、線、手描き感、独特なバランスや特徴をできるだけ残し、勝手に別のキャラクターデザインへ変更しないでください。

背景は完全に透明。キャラクター全体が切れないよう中央に配置し、周囲に十分な透明余白を残してください。

子どもの原画の魅力を残した、明るくかわいい児童向けの完成イラストにしてください。文字は出力しないでください。キャラクターは1体だけにしてください。`;

const DEFAULT_MOTIONS = [
  {id:"jump", name:"ジャンプ", emoji:"🐾", effect:"jump", prompt:"キャラクターが元気よく上へ跳び、着地で少し弾む。全身が切れないよう上下方向に十分な余白を残す。"},
  {id:"sway", name:"左右ゆれ", emoji:"↔️", effect:"sway", prompt:"キャラクターが左右へ楽しそうにゆらゆら揺れる。左右方向に余白を残す。"},
  {id:"float", name:"ふわふわ", emoji:"☁️", effect:"float", prompt:"キャラクターが空中でふんわり浮かぶように、やさしく上下する。"},
  {id:"rotate", name:"くるくる", emoji:"🌀", effect:"rotate", prompt:"キャラクターが中心を軸に小さくくるくる回る。回転しても全身が切れない余白を確保する。"},
  {id:"shake", name:"ぷるぷる", emoji:"〰️", effect:"shake", prompt:"キャラクターが小刻みにぷるぷる震える。かわいくコミカルな印象にする。"},
  {id:"squash", name:"伸び縮み", emoji:"↕️", effect:"squash", prompt:"キャラクターが弾むように縦横へ少し伸び縮みする。"}
];

const $ = id => document.getElementById(id);
const galleryInput = $("galleryInput");
const cameraFallback = $("cameraFallback");
const cameraBtn = $("cameraBtn");
const previewWrap = $("previewWrap");
const preview = $("preview");
const createBtn = $("create");
const apiState = $("apiState");
const promptState = $("promptState");
const goSettings = $("goSettings");
const errorBox = $("error");
const statusBox = $("status");
const statusTitle = $("statusTitle");
const statusText = $("statusText");
const resultsWrap = $("resultsWrap");
const pngResult = $("pngResult");
const gifResult = $("gifResult");
const pngDownload = $("pngDownload");
const gifDownload = $("gifDownload");
const motionStrength = $("motionStrength");
const motionSpeed = $("motionSpeed");

let chosenFile = null;
let previewUrl = null;
let pngUrl = null;
let gifUrl = null;
let cameraStream = null;
let facingMode = "environment";
let workerBlobUrl = null;
let motionProfiles = loadMotionProfiles();

function getSetting(key, fallback="") { return localStorage.getItem(key) ?? fallback; }
function getApiKey() {
  return localStorage.getItem("oekaki.rememberKey") === "1"
    ? (localStorage.getItem("oekaki.apiKey") || "")
    : (sessionStorage.getItem("oekaki.apiKey") || "");
}
function readJson(key){
  try { return JSON.parse(localStorage.getItem(key)); } catch { return null; }
}
function loadMotionProfiles(){
  const saved = readJson("oekaki.motionProfiles");
  if (!Array.isArray(saved) || !saved.length) return DEFAULT_MOTIONS.map(m => ({...m}));
  const cleaned = saved.filter(m => m && m.id && m.name && m.effect).map(m => ({
    id:String(m.id), name:String(m.name), emoji:String(m.emoji || "✨"), effect:String(m.effect), prompt:String(m.prompt || "")
  }));
  return cleaned.length ? cleaned : DEFAULT_MOTIONS.map(m => ({...m}));
}
function getVisibleMotionProfiles(){
  if (!$('posterStage')) return motionProfiles;
  // ポスター画面は6種類の固定スロット。追加した動きプロンプトは effect ごとの追加指示として統合する。
  return DEFAULT_MOTIONS.map(def => motionProfiles.find(m => m.effect === def.effect) || {...def});
}

function getActivePrompt(){
  const profiles = readJson("oekaki.promptProfiles");
  if (Array.isArray(profiles) && profiles.length) {
    const activeId = localStorage.getItem("oekaki.activePromptId");
    const active = profiles.find(p => p.id === activeId) || profiles[0];
    return {name:String(active.name || "生成プロンプト"), prompt:String(active.prompt || DEFAULT_PROMPT)};
  }
  return {name:"標準・原画を活かす", prompt:getSetting("oekaki.prompt", DEFAULT_PROMPT)};
}

function currentMotionIds(){
  return [...document.querySelectorAll("[data-motion]:checked")].map(x => x.dataset.motion);
}
function currentMotionConfigs(){
  const ids = new Set(currentMotionIds());
  if ($('posterStage')) {
    const visible = getVisibleMotionProfiles();
    const effects = new Set(visible.filter(m => ids.has(m.id)).map(m => m.effect));
    const configured = motionProfiles.filter(m => effects.has(m.effect));
    // その effect に保存済みプロンプトがない場合だけ、画面用の初期値を使う。
    effects.forEach(effect => {
      if (!configured.some(m => m.effect === effect)) {
        const fallback = DEFAULT_MOTIONS.find(m => m.effect === effect);
        if (fallback) configured.push({...fallback});
      }
    });
    return configured;
  }
  return motionProfiles.filter(m => ids.has(m.id));
}
function selectedEffects(motions){ return [...new Set(motions.map(m => m.effect))]; }

function motionVisual(m){
  const effect = m.effect || m.id;
  const cat = `<g stroke="#713720" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M25 23 21 10l11 7c7-5 18-5 25 0l12-7-4 14c4 5 5 11 3 17-4 11-16 17-28 15-15-2-23-12-21-24 1-4 3-7 6-9Z" fill="#fff9ef"/><path d="M34 31q4 4 8 0m10 0q4 4 8 0M46 34q-3 4-6 0m6 0q3 4 6 0" fill="none"/><path d="M65 39c10 2 14-4 13-10" fill="none"/></g><path d="M35 19c4-3 8-3 12-2m5 0c4-1 8 0 11 3" stroke="#f29a45" stroke-width="2.5" fill="none" stroke-linecap="round"/>`;
  if(effect === 'jump') return `<svg class="motion-art" viewBox="0 0 86 62" aria-hidden="true"><g transform="translate(3 5)">${cat}</g><path d="M9 31q-5 3-5 8m7-19-6-3m68 4 6 4m-7 7 7 8" fill="none" stroke="#ff923d" stroke-width="3.5" stroke-linecap="round"/></svg>`;
  if(effect === 'sway') return `<svg class="motion-art" viewBox="0 0 92 62" aria-hidden="true"><g transform="translate(6 5)">${cat}</g><path d="M8 25 2 31l6 6M84 25l6 6-6 6" fill="none" stroke="#2baee9" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  if(effect === 'float') return `<svg class="motion-art" viewBox="0 0 92 62" aria-hidden="true"><g fill="#66c8ff"><circle cx="37" cy="33" r="16"/><circle cx="52" cy="26" r="13"/><circle cx="64" cy="35" r="15"/><rect x="34" y="32" width="36" height="16" rx="8"/></g><path d="M43 37q4 5 8 0m9 0q4 5 8 0" stroke="#fff" stroke-width="3" fill="none" stroke-linecap="round"/><path d="m16 21 2 5 5 2-5 2-2 5-2-5-5-2 5-2Zm65 17 2 4 4 2-4 2-2 4-2-4-4-2 4-2Z" fill="#ffc333"/></svg>`;
  if(effect === 'rotate') return `<svg class="motion-art" viewBox="0 0 92 62" aria-hidden="true"><path d="M63 18c-14-11-36-5-41 10-5 15 9 29 23 24 10-4 12-15 5-21-6-5-15-1-15 6 0 6 7 8 11 4" fill="none" stroke="#985af0" stroke-width="8" stroke-linecap="round"/><path d="m63 11 13 4-8 10Z" fill="#985af0"/><path d="m23 14 2 4 4 2-4 2-2 4-2-4-4-2 4-2Z" fill="#b276ff"/></svg>`;
  if(effect === 'shake') return `<svg class="motion-art" viewBox="0 0 92 62" aria-hidden="true"><g transform="translate(7 6)">${cat}</g><path d="M10 18q-6 5 0 10t0 10m72-20q6 5 0 10t0 10" fill="none" stroke="#aa59e9" stroke-width="3" stroke-linecap="round"/></svg>`;
  if(effect === 'squash') return `<svg class="motion-art" viewBox="0 0 92 62" aria-hidden="true"><g transform="translate(7 6) scale(.9 1.03)">${cat}</g><path d="M10 13v37m0-37-5 7m5-7 5 7m-5 30-5-7m5 7 5-7m72-30v37m0-37-5 7m5-7 5 7m-5 30-5-7m5 7 5-7" fill="none" stroke="#8057e7" stroke-width="3" stroke-linecap="round"/></svg>`;
  return `<span class="motion-fallback">${m.emoji || '✨'}</span>`;
}

function renderMotions(){
  const list = $("motionList");
  const visibleProfiles = getVisibleMotionProfiles();
  const stored = readJson("oekaki.selectedMotionIds");
  const existingIds = new Set(visibleProfiles.map(m => m.id));
  let selected = Array.isArray(stored) ? stored.filter(id => existingIds.has(id)) : [];
  if (!selected.length && visibleProfiles.length) selected = [visibleProfiles.find(m=>m.effect === "jump")?.id || visibleProfiles[0].id];
  const selectedSet = new Set(selected);
  list.innerHTML = "";

  visibleProfiles.forEach(m => {
    const label = document.createElement("label");
    label.className = "motion-item";
    label.dataset.effect = m.effect || m.id;
    const input = document.createElement("input");
    input.type = "checkbox";
    input.dataset.motion = m.id;
    input.checked = selectedSet.has(m.id);
    const icon = document.createElement("span");
    icon.className = "motion-emoji";
    icon.innerHTML = motionVisual(m);
    const strong = document.createElement("strong");
    strong.textContent = m.name;
    const small = document.createElement("small");
    small.textContent = m.prompt || "動きプリセット";
    const check = document.createElement("span");
    check.className = "motion-check";
    check.textContent = "✓";
    label.append(input, icon, strong, small, check);
    list.appendChild(label);
    input.addEventListener("change", () => {
      localStorage.setItem("oekaki.selectedMotionIds", JSON.stringify(currentMotionIds()));
      updateReadyState();
    });
  });
}

function updateReadyState(){
  const hasKey = !!getApiKey().trim();
  const active = getActivePrompt();
  apiState.textContent = hasKey ? "API設定済み" : "APIキーが未設定です";
  apiState.style.color = hasKey ? "#19724a" : "#b63c50";
  promptState.textContent = `使用プロンプト：${active.name}`;
  goSettings.classList.toggle("hidden", hasKey);
  createBtn.disabled = !(hasKey && chosenFile && currentMotionIds().length);
}

function setFile(file){
  if (!file) return;
  chosenFile = file;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(file);
  preview.src = previewUrl;
  previewWrap.classList.remove("hidden");
  $("samplePreview")?.classList.add("hidden");
  clearError();
  updateReadyState();
}

galleryInput.addEventListener("change", () => setFile(galleryInput.files?.[0]));
cameraFallback.addEventListener("change", () => setFile(cameraFallback.files?.[0]));

$("clearImage").addEventListener("click", () => {
  chosenFile = null;
  previewWrap.classList.add("hidden");
  $("samplePreview")?.classList.remove("hidden");
  galleryInput.value = "";
  cameraFallback.value = "";
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  updateReadyState();
});

function labelFromRange(v){ v=Number(v); return v < 85 ? "ひかえめ" : v > 115 ? "大きめ" : "ふつう"; }
function speedLabel(v){ v=Number(v); return v < 90 ? "ゆっくり" : v > 115 ? "速め" : "ふつう"; }
function paintRange(input){
  const min=Number(input.min)||0,max=Number(input.max)||100,val=Number(input.value);
  const pct=((val-min)/(max-min))*100;
  input.style.setProperty("--pct", `${pct}%`);
}
motionStrength.addEventListener("input", () => { $("motionStrengthLabel").textContent = labelFromRange(motionStrength.value); paintRange(motionStrength); });
motionSpeed.addEventListener("input", () => { $("motionSpeedLabel").textContent = speedLabel(motionSpeed.value); paintRange(motionSpeed); });
paintRange(motionStrength); paintRange(motionSpeed);

function clearError(){ errorBox.classList.add("hidden"); errorBox.textContent = ""; }
function showError(msg){ errorBox.textContent = msg; errorBox.classList.remove("hidden"); }
function setStatus(title,text){ statusTitle.textContent=title; statusText.textContent=text; statusBox.classList.remove("hidden"); }
function hideStatus(){ statusBox.classList.add("hidden"); }

/* ---------- Camera ---------- */
async function stopCamera(){
  if (cameraStream) { cameraStream.getTracks().forEach(t => t.stop()); cameraStream = null; }
  $("cameraVideo").srcObject = null;
}
async function startCamera(){
  clearError();
  if (!navigator.mediaDevices?.getUserMedia) { cameraFallback.click(); return; }
  try {
    await stopCamera();
    $("cameraModal").classList.remove("hidden");
    $("cameraMessage").textContent = "カメラの使用を許可してください。";
    cameraStream = await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:facingMode},width:{ideal:1920},height:{ideal:1080}},audio:false});
    $("cameraVideo").srcObject = cameraStream;
    $("cameraMessage").textContent = "絵全体が入るように撮影してください。";
  } catch {
    await stopCamera();
    $("cameraModal").classList.add("hidden");
    cameraFallback.click();
  }
}
cameraBtn.addEventListener("click", startCamera);
$("cameraClose").addEventListener("click", async () => { await stopCamera(); $("cameraModal").classList.add("hidden"); });
$("switchCamera").addEventListener("click", async () => { facingMode = facingMode === "environment" ? "user" : "environment"; await startCamera(); });
$("takePhoto").addEventListener("click", async () => {
  const video = $("cameraVideo");
  if (!video.videoWidth) return;
  const canvas = $("cameraCanvas");
  canvas.width = video.videoWidth; canvas.height = video.videoHeight;
  canvas.getContext("2d").drawImage(video,0,0);
  canvas.toBlob(async blob => {
    if (!blob) return;
    setFile(new File([blob],"camera-photo.jpg",{type:"image/jpeg"}));
    await stopCamera();
    $("cameraModal").classList.add("hidden");
  },"image/jpeg",.92);
});

/* ---------- Image API ---------- */
async function normalizeImage(file){
  const bitmap = await createImageBitmap(file);
  const maxSide = 1536;
  const scale = Math.min(1,maxSide/Math.max(bitmap.width,bitmap.height));
  const w=Math.max(1,Math.round(bitmap.width*scale)), h=Math.max(1,Math.round(bitmap.height*scale));
  const canvas=document.createElement("canvas"); canvas.width=w; canvas.height=h;
  const ctx=canvas.getContext("2d",{alpha:false}); ctx.fillStyle="#fff"; ctx.fillRect(0,0,w,h); ctx.drawImage(bitmap,0,0,w,h); bitmap.close?.();
  const blob=await new Promise((resolve,reject)=>canvas.toBlob(b=>b?resolve(b):reject(new Error("画像変換に失敗しました。")),"image/png"));
  return new File([blob],"drawing.png",{type:"image/png"});
}
function base64ToBlob(base64,type="image/png"){
  const binary=atob(base64), arrays=[];
  for(let i=0;i<binary.length;i+=1024*1024){ const s=binary.slice(i,i+1024*1024),a=new Uint8Array(s.length); for(let j=0;j<s.length;j++)a[j]=s.charCodeAt(j); arrays.push(a); }
  return new Blob(arrays,{type});
}
function buildGenerationPrompt(motions){
  const active = getActivePrompt();
  const guidance = motions.filter(m => m.prompt.trim()).map(m => `・${m.name}: ${m.prompt.trim()}`).join("\n");
  if (!guidance) return active.prompt;
  return `${active.prompt}\n\n【GIFアニメーション向けの追加指示】\nこのイラストは生成後、次の動きをつけます。動いたときに全身が切れず、自然に見える余白・重心・構図にしてください。\n${guidance}`;
}
async function generateIllustration(motions){
  const key=getApiKey().trim();
  if(!key) throw new Error("APIキーが未設定です。設定画面で入力してください。");
  const normalized=await normalizeImage(chosenFile);
  const form=new FormData();
  form.append("model",getSetting("oekaki.model","gpt-image-2.5-sunburst"));
  form.append("image",normalized);
  form.append("prompt",buildGenerationPrompt(motions));
  form.append("size","1024x1024");
  form.append("quality",getSetting("oekaki.quality","medium"));
  form.append("background","transparent");
  form.append("output_format","png");
  const response=await fetch(API_URL,{method:"POST",headers:{"Authorization":`Bearer ${key}`},body:form});
  const text=await response.text(); let data={}; try{data=JSON.parse(text)}catch{}
  if(!response.ok) throw new Error(data?.error?.message || `OpenAI API error (${response.status})`);
  const first=data?.data?.[0];
  if(first?.b64_json) return base64ToBlob(first.b64_json);
  if(first?.url){ const r=await fetch(first.url); if(!r.ok) throw new Error("生成画像を取得できませんでした。"); return await r.blob(); }
  throw new Error("生成画像データが見つかりませんでした。");
}

/* ---------- GIF ---------- */
async function getWorkerBlobUrl(){
  if(workerBlobUrl) return workerBlobUrl;
  const r=await fetch(GIF_WORKER_URL); if(!r.ok) throw new Error("GIFワーカーを読み込めませんでした。");
  workerBlobUrl=URL.createObjectURL(new Blob([await r.text()],{type:"application/javascript"})); return workerBlobUrl;
}
async function loadImage(blob){
  const url=URL.createObjectURL(blob), img=new Image();
  await new Promise((resolve,reject)=>{img.onload=resolve;img.onerror=reject;img.src=url}); return {img,url};
}
function motionTransform(effects,phase,strength){
  const s=strength/100; let x=0,y=0,rot=0,sx=1,sy=1; const two=Math.PI*2;
  if(effects.includes("jump")){ const j=Math.max(0,Math.sin(Math.PI*phase)); y-=Math.pow(j,1.65)*125*s; const edge=Math.min(phase,1-phase); if(edge<.10){const q=1-edge/.10;sx*=1+.08*q*s;sy*=1-.10*q*s}else sy*=1+.035*j*s; }
  if(effects.includes("sway")){x+=Math.sin(two*phase)*34*s;rot+=Math.sin(two*phase)*4.5*s;}
  if(effects.includes("float")){y+=Math.sin(two*phase)*28*s;rot+=Math.sin(two*phase+Math.PI/3)*2.2*s;}
  if(effects.includes("rotate")){rot+=Math.sin(two*phase)*13*s;}
  if(effects.includes("shake")){x+=Math.sin(two*phase*5)*7*s;rot+=Math.sin(two*phase*6)*2.8*s;}
  if(effects.includes("squash")){const q=Math.sin(two*phase);sx*=1+.07*q*s;sy*=1-.07*q*s;}
  return {x,y,rot,sx,sy};
}
async function makeGif(pngBlob,motions){
  if(typeof GIF==="undefined") throw new Error("GIFライブラリを読み込めませんでした。");
  const {img,url}=await loadImage(pngBlob), worker=await getWorkerBlobUrl();
  const size=640,frames=28,strength=Number(motionStrength.value),speed=Number(motionSpeed.value),delay=Math.max(35,Math.round(75*100/speed));
  const fit=Math.min(size*.72/img.naturalWidth,size*.64/img.naturalHeight),baseW=img.naturalWidth*fit,baseH=img.naturalHeight*fit,baseX=size/2,baseY=size*.55,chroma="#010203";
  const effects=selectedEffects(motions);
  const gif=new GIF({workers:2,quality:10,width:size,height:size,repeat:0,transparent:0x010203,workerScript:worker});
  for(let i=0;i<frames;i++){
    const phase=i/frames,tr=motionTransform(effects,phase,strength),canvas=document.createElement("canvas"); canvas.width=size; canvas.height=size;
    const ctx=canvas.getContext("2d"); ctx.fillStyle=chroma; ctx.fillRect(0,0,size,size); ctx.save(); ctx.translate(baseX+tr.x,baseY+tr.y); ctx.rotate(tr.rot*Math.PI/180); ctx.scale(tr.sx,tr.sy); ctx.drawImage(img,-baseW/2,-baseH/2,baseW,baseH); ctx.restore(); gif.addFrame(ctx,{copy:true,delay});
  }
  URL.revokeObjectURL(url);
  return await new Promise((resolve,reject)=>{gif.on("finished",resolve);gif.on("abort",()=>reject(new Error("GIF作成が中断されました。")));gif.render();});
}

createBtn.addEventListener("click",async()=>{
  clearError();
  const motions=currentMotionConfigs();
  if(!getApiKey().trim()){ showError("APIキーが未設定です。右上の「設定」からAPIキーを入力してください。"); return; }
  if(!chosenFile){ showError("先に「カメラで撮る」または「画像を選ぶ」から絵を取り込んでください。"); return; }
  if(!motions.length){ showError("動きを1つ以上選んでください。"); return; }
  createBtn.disabled=true;
  try{
    setStatus("イラストを作成中…",`「${getActivePrompt().name}」と動きプロンプトを使って生成しています。`);
    const pngBlob=await generateIllustration(motions);
    if(pngUrl)URL.revokeObjectURL(pngUrl); pngUrl=URL.createObjectURL(pngBlob); pngResult.src=pngUrl; pngDownload.href=pngUrl;
    setStatus("GIFを作成中…","選択した動きを組み合わせています。");
    const gifBlob=await makeGif(pngBlob,motions);
    if(gifUrl)URL.revokeObjectURL(gifUrl); gifUrl=URL.createObjectURL(gifBlob); gifResult.src=gifUrl; gifDownload.href=gifUrl;
    $("motionSummary").textContent="動き: "+motions.map(m=>m.name).join(" ＋ ");
    hideStatus(); resultsWrap.classList.remove("hidden");
    (document.querySelector(".png-result-box") || resultsWrap).scrollIntoView({behavior:"smooth",block:"center"});
  }catch(err){
    hideStatus(); const msg=String(err?.message||err);
    if(msg.includes("Failed to fetch")) showError("APIへ接続できませんでした。通信状態、APIキー、ブラウザの通信制限を確認してください。"); else showError(msg);
  }finally{updateReadyState();}
});

function installDownload(link, filename){
  link.addEventListener("click", (ev) => {
    const href=link.getAttribute("href");
    if(!href || href === "#"){ ev.preventDefault(); return; }
    // download属性を毎回明示。Blob URLを直接開く端末でも長押し/共有が使える。
    link.setAttribute("download", filename);
  });
}
installDownload(pngDownload,"illustration.png");
installDownload(gifDownload,"animation.gif");

renderMotions();
updateReadyState();

if("serviceWorker" in navigator && location.protocol === "https") addEventListener("load",()=>navigator.serviceWorker.register("./sw.js").catch(()=>{}));
