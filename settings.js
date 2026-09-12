const DEFAULT_PROMPT = "添付した子どもの絵をもとに、キャラクターだけを完成イラストにしてください。\n\n写真に写っている紙、布、机、影、文字、メモ、周囲の不要なものをすべて取り除き、\nキャラクターの絵の部分だけを抽出してください。\n\n元の子どもの絵にある形、色、線、手描き感、独特なバランスや特徴をできるだけ残し、\n勝手に別のキャラクターデザインへ変更しないでください。\n\n背景は完全に透明。キャラクター全体が切れないよう中央に配置し、\n周囲に十分な透明余白を残してください。\n\n子どもの原画の魅力を残した、明るくかわいい児童向けの完成イラストにしてください。\n文字は出力しないでください。キャラクターは1体だけにしてください。";

const $ = id => document.getElementById(id);
const apiKey = $("apiKey");
const rememberKey = $("rememberKey");
const model = $("model");
const quality = $("quality");
const promptEditor = $("promptEditor");
const saveMessage = $("saveMessage");

function loadSettings() {
  const remembered = localStorage.getItem("oekaki.rememberKey") === "1";
  rememberKey.checked = remembered;
  apiKey.value = remembered
    ? (localStorage.getItem("oekaki.apiKey") || "")
    : (sessionStorage.getItem("oekaki.apiKey") || "");

  model.value = localStorage.getItem("oekaki.model") || "gpt-image-2.5-sunburst";
  quality.value = localStorage.getItem("oekaki.quality") || "medium";
  promptEditor.value = localStorage.getItem("oekaki.prompt") || DEFAULT_PROMPT;
}

$("toggleKey").addEventListener("click", () => {
  const show = apiKey.type === "password";
  apiKey.type = show ? "text" : "password";
  $("toggleKey").textContent = show ? "隠す" : "表示";
});

$("resetPrompt").addEventListener("click", () => {
  if (confirm("プロンプトを初期設定に戻しますか？")) {
    promptEditor.value = DEFAULT_PROMPT;
  }
});

$("saveSettings").addEventListener("click", () => {
  const key = apiKey.value.trim();

  localStorage.setItem("oekaki.model", model.value);
  localStorage.setItem("oekaki.quality", quality.value);
  localStorage.setItem("oekaki.prompt", promptEditor.value.trim() || DEFAULT_PROMPT);

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
  setTimeout(() => location.href = "./index.html", 500);
});

loadSettings();
