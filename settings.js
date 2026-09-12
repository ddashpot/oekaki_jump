const DEFAULT_PROMPT = `添付した子どもの絵をもとに、キャラクターだけを完成イラストにしてください。

写真に写っている紙、布、机、影、文字、メモ、周囲の不要なものをすべて取り除き、キャラクターの絵の部分だけを抽出してください。

元の子どもの絵にある形、色、線、手描き感、独特なバランスや特徴をできるだけ残し、勝手に別のキャラクターデザインへ変更しないでください。

背景は完全に透明。キャラクター全体が切れないよう中央に配置し、周囲に十分な透明余白を残してください。

子どもの原画の魅力を残した、明るくかわいい児童向けの完成イラストにしてください。文字は出力しないでください。キャラクターは1体だけにしてください。`;

const DEFAULT_PROMPT_PROFILES = [
  {id:"standard", name:"標準・原画を活かす", prompt:DEFAULT_PROMPT},
  {id:"soft-watercolor", name:"やわらか水彩", prompt:`${DEFAULT_PROMPT}\n\n仕上げは、淡くやさしい水彩の質感にしてください。輪郭は強すぎず、子どもの原画の色と形を最優先してください。`},
  {id:"pop-sticker", name:"ポップなステッカー", prompt:`${DEFAULT_PROMPT}\n\n仕上げは、明るくポップなステッカー風にしてください。輪郭は見やすく、色は元絵を尊重しながら少しだけ鮮やかにしてください。`}
];

const DEFAULT_MOTIONS = [
  {id:"jump", name:"ジャンプ", emoji:"🐾", effect:"jump", prompt:"キャラクターが元気よく上へ跳び、着地で少し弾む。全身が切れないよう上下方向に十分な余白を残す。"},
  {id:"sway", name:"左右ゆれ", emoji:"↔️", effect:"sway", prompt:"キャラクターが左右へ楽しそうにゆらゆら揺れる。左右方向に余白を残し、中心が安定して見える構図にする。"},
  {id:"float", name:"ふわふわ", emoji:"☁️", effect:"float", prompt:"キャラクターが空中でふんわり浮かぶように、やさしく上下する。軽やかで穏やかな印象にする。"},
  {id:"rotate", name:"くるくる", emoji:"🌀", effect:"rotate", prompt:"キャラクターが中心を軸に小さくくるくる回る。回転しても手足や耳などが切れない余白を確保する。"},
  {id:"shake", name:"ぷるぷる", emoji:"〰️", effect:"shake", prompt:"キャラクターが小刻みにぷるぷる震える。かわいくコミカルで、輪郭が読み取りやすい仕上がりにする。"},
  {id:"squash", name:"伸び縮み", emoji:"↕️", effect:"squash", prompt:"キャラクターが弾むように縦横へ少し伸び縮みする。柔らかく楽しい動きに見えるよう中央へ配置する。"}
];

const $ = id => document.getElementById(id);
const apiKey = $("apiKey");
const rememberKey = $("rememberKey");
const model = $("model");
const quality = $("quality");
const saveMessage = $("saveMessage");

let promptProfiles = [];
let motionProfiles = [];
let activePromptId = "";
let currentPromptId = "";
let currentMotionId = "";

function clone(value){ return JSON.parse(JSON.stringify(value)); }
function uid(prefix){
  if (crypto?.randomUUID) return `${prefix}-${crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
}
function readJson(key, fallback){
  try {
    const value = JSON.parse(localStorage.getItem(key));
    return Array.isArray(value) && value.length ? value : clone(fallback);
  } catch { return clone(fallback); }
}
function cleanName(value, fallback){ return String(value || "").trim() || fallback; }

function loadSettings(){
  const remembered = localStorage.getItem("oekaki.rememberKey") === "1";
  rememberKey.checked = remembered;
  apiKey.value = remembered ? (localStorage.getItem("oekaki.apiKey") || "") : (sessionStorage.getItem("oekaki.apiKey") || "");
  model.value = localStorage.getItem("oekaki.model") || "gpt-image-2.5-sunburst";
  quality.value = localStorage.getItem("oekaki.quality") || "medium";

  const storedProfiles = localStorage.getItem("oekaki.promptProfiles");
  if (storedProfiles) {
    promptProfiles = readJson("oekaki.promptProfiles", DEFAULT_PROMPT_PROFILES);
  } else {
    const legacy = localStorage.getItem("oekaki.prompt");
    promptProfiles = legacy ? [{id:"standard", name:"標準・移行済み", prompt:legacy}] : clone(DEFAULT_PROMPT_PROFILES);
  }
  activePromptId = localStorage.getItem("oekaki.activePromptId") || promptProfiles[0].id;
  if (!promptProfiles.some(p => p.id === activePromptId)) activePromptId = promptProfiles[0].id;

  motionProfiles = readJson("oekaki.motionProfiles", DEFAULT_MOTIONS)
    .filter(m => m && m.id && m.name && m.effect)
    .map(m => ({...m, prompt:String(m.prompt || ""), emoji:String(m.emoji || "✨")}));
  if (!motionProfiles.length) motionProfiles = clone(DEFAULT_MOTIONS);

  renderPromptSelect(activePromptId);
  renderMotionSelect(motionProfiles[0].id);
}

function renderPromptSelect(selectId){
  const select = $("promptSelect");
  select.innerHTML = "";
  promptProfiles.forEach(p => {
    const o = document.createElement("option");
    o.value = p.id;
    o.textContent = p.id === activePromptId ? `★ ${p.name}` : p.name;
    select.appendChild(o);
  });
  const target = promptProfiles.some(p => p.id === selectId) ? selectId : promptProfiles[0].id;
  select.value = target;
  loadPromptForm(target);
  $("promptCount").textContent = `${promptProfiles.length}件保存`;
}

function loadPromptForm(id){
  const p = promptProfiles.find(x => x.id === id) || promptProfiles[0];
  currentPromptId = p.id;
  $("promptName").value = p.name;
  $("promptEditor").value = p.prompt;
  $("useThisPrompt").checked = p.id === activePromptId;
  $("activePromptHint").textContent = p.id === activePromptId ? "現在このプロンプトを使用します。" : "選ぶと、このプロンプトをメイン画面で使用します。";
}

function commitPromptForm(){
  const p = promptProfiles.find(x => x.id === currentPromptId);
  if (!p) return;
  p.name = cleanName($("promptName").value, "名称未設定");
  p.prompt = $("promptEditor").value.trim() || DEFAULT_PROMPT;
}

function renderMotionSelect(selectId){
  const select = $("motionSelect");
  select.innerHTML = "";
  motionProfiles.forEach(m => {
    const o = document.createElement("option");
    o.value = m.id;
    o.textContent = `${m.emoji || "✨"} ${m.name}`;
    select.appendChild(o);
  });
  const target = motionProfiles.some(m => m.id === selectId) ? selectId : motionProfiles[0].id;
  select.value = target;
  loadMotionForm(target);
  $("motionCount").textContent = `${motionProfiles.length}件保存`;
}

function loadMotionForm(id){
  const m = motionProfiles.find(x => x.id === id) || motionProfiles[0];
  currentMotionId = m.id;
  $("motionName").value = m.name;
  $("motionEmoji").value = m.emoji || "✨";
  $("motionEffect").value = m.effect || "jump";
  $("motionPrompt").value = m.prompt || "";
}

function commitMotionForm(){
  const m = motionProfiles.find(x => x.id === currentMotionId);
  if (!m) return;
  m.name = cleanName($("motionName").value, "新しい動き");
  m.emoji = cleanName($("motionEmoji").value, "✨").slice(0,8);
  m.effect = $("motionEffect").value;
  m.prompt = $("motionPrompt").value.trim();
}

$("toggleKey").addEventListener("click", () => {
  const show = apiKey.type === "password";
  apiKey.type = show ? "text" : "password";
  $("toggleKey").textContent = show ? "隠す" : "表示";
});

$("promptSelect").addEventListener("change", e => {
  commitPromptForm();
  renderPromptSelect(e.target.value);
});
$("promptName").addEventListener("input", () => {
  commitPromptForm();
  const option = [...$("promptSelect").options].find(o => o.value === currentPromptId);
  if (option) option.textContent = `${currentPromptId === activePromptId ? "★ " : ""}${promptProfiles.find(p=>p.id===currentPromptId)?.name || "名称未設定"}`;
});
$("useThisPrompt").addEventListener("change", () => {
  if (!$("useThisPrompt").checked) return;
  commitPromptForm();
  activePromptId = currentPromptId;
  renderPromptSelect(currentPromptId);
});
$("addPrompt").addEventListener("click", () => {
  commitPromptForm();
  const p = {id:uid("prompt"), name:"新しいプロンプト", prompt:DEFAULT_PROMPT};
  promptProfiles.push(p);
  renderPromptSelect(p.id);
});
$("duplicatePrompt").addEventListener("click", () => {
  commitPromptForm();
  const src = promptProfiles.find(p => p.id === currentPromptId);
  const p = {id:uid("prompt"), name:`${src.name} のコピー`, prompt:src.prompt};
  promptProfiles.push(p);
  renderPromptSelect(p.id);
});
$("deletePrompt").addEventListener("click", () => {
  if (promptProfiles.length <= 1) return alert("生成プロンプトは1件以上必要です。");
  const src = promptProfiles.find(p => p.id === currentPromptId);
  if (!confirm(`「${src.name}」を削除しますか？`)) return;
  const idx = promptProfiles.findIndex(p => p.id === currentPromptId);
  promptProfiles.splice(idx,1);
  if (activePromptId === currentPromptId) activePromptId = promptProfiles[Math.max(0, idx-1)].id;
  renderPromptSelect(activePromptId);
});
$("resetPrompt").addEventListener("click", () => {
  if (confirm("このプロンプト本文を標準の初期値に戻しますか？")) $("promptEditor").value = DEFAULT_PROMPT;
});

$("motionSelect").addEventListener("change", e => {
  commitMotionForm();
  renderMotionSelect(e.target.value);
});
[$("motionName"),$("motionEmoji")].forEach(el => el.addEventListener("input", () => {
  commitMotionForm();
  const m = motionProfiles.find(x => x.id === currentMotionId);
  const option = [...$("motionSelect").options].find(o => o.value === currentMotionId);
  if (option && m) option.textContent = `${m.emoji || "✨"} ${m.name}`;
}));
$("addMotion").addEventListener("click", () => {
  commitMotionForm();
  const m = {id:uid("motion"), name:"新しい動き", emoji:"✨", effect:"jump", prompt:"キャラクターが楽しく動く。全身が切れないよう十分な余白を残す。"};
  motionProfiles.push(m);
  renderMotionSelect(m.id);
});
$("duplicateMotion").addEventListener("click", () => {
  commitMotionForm();
  const src = motionProfiles.find(m => m.id === currentMotionId);
  const m = {...src, id:uid("motion"), name:`${src.name} のコピー`};
  motionProfiles.push(m);
  renderMotionSelect(m.id);
});
$("deleteMotion").addEventListener("click", () => {
  if (motionProfiles.length <= 1) return alert("動きプリセットは1件以上必要です。");
  const src = motionProfiles.find(m => m.id === currentMotionId);
  if (!confirm(`「${src.name}」を削除しますか？`)) return;
  const idx = motionProfiles.findIndex(m => m.id === currentMotionId);
  motionProfiles.splice(idx,1);
  renderMotionSelect(motionProfiles[Math.max(0,idx-1)].id);
});
$("resetMotions").addEventListener("click", () => {
  if (!confirm("動きプリセットを初期セットに戻しますか？追加・編集した内容は置き換わります。")) return;
  motionProfiles = clone(DEFAULT_MOTIONS);
  renderMotionSelect(motionProfiles[0].id);
});

$("saveSettings").addEventListener("click", () => {
  commitPromptForm();
  commitMotionForm();
  const key = apiKey.value.trim();

  localStorage.setItem("oekaki.model", model.value);
  localStorage.setItem("oekaki.quality", quality.value);
  localStorage.setItem("oekaki.promptProfiles", JSON.stringify(promptProfiles));
  localStorage.setItem("oekaki.activePromptId", activePromptId);
  localStorage.setItem("oekaki.motionProfiles", JSON.stringify(motionProfiles));

  const active = promptProfiles.find(p => p.id === activePromptId) || promptProfiles[0];
  localStorage.setItem("oekaki.prompt", active.prompt); // v2互換

  if (rememberKey.checked) {
    localStorage.setItem("oekaki.rememberKey", "1");
    localStorage.setItem("oekaki.apiKey", key);
    sessionStorage.removeItem("oekaki.apiKey");
  } else {
    localStorage.setItem("oekaki.rememberKey", "0");
    localStorage.removeItem("oekaki.apiKey");
    if (key) sessionStorage.setItem("oekaki.apiKey", key);
    else sessionStorage.removeItem("oekaki.apiKey");
  }

  saveMessage.classList.remove("hidden");
  setTimeout(() => location.href = "./index.html", 550);
});

loadSettings();
