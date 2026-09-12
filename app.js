const API_URL = "https://api.openai.com/v1/images/edits";
const GIF_WORKER_URL = "https://cdn.jsdelivr.net/npm/gif.js.optimized@1.0.1/dist/gif.worker.js";
const DEFAULT_PROMPT = "添付した子どもの絵をもとに、キャラクターだけを完成イラストにしてください。\n\n写真に写っている紙、布、机、影、文字、メモ、周囲の不要なものをすべて取り除き、\nキャラクターの絵の部分だけを抽出してください。\n\n元の子どもの絵にある形、色、線、手描き感、独特なバランスや特徴をできるだけ残し、\n勝手に別のキャラクターデザインへ変更しないでください。\n\n背景は完全に透明。キャラクター全体が切れないよう中央に配置し、\n周囲に十分な透明余白を残してください。\n\n子どもの原画の魅力を残した、明るくかわいい児童向けの完成イラストにしてください。\n文字は出力しないでください。キャラクターは1体だけにしてください。";

const $ = id => document.getElementById(id);
const galleryInput = $("galleryInput");
const cameraFallback = $("cameraFallback");
const cameraBtn = $("cameraBtn");
const previewWrap = $("previewWrap");
const preview = $("preview");
const createBtn = $("create");
const apiState = $("apiState");
const goSettings = $("goSettings");
const errorBox = $("error");
const statusBox = $("status");
const statusTitle = $("statusTitle");
const statusText = $("statusText");
const results = $("results");
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

function getSetting(key, fallback="") {
  return localStorage.getItem(key) ?? fallback;
}

function getApiKey() {
  return localStorage.getItem("oekaki.rememberKey") === "1"
    ? (localStorage.getItem("oekaki.apiKey") || "")
    : (sessionStorage.getItem("oekaki.apiKey") || "");
}

function currentMotions() {
  return [...document.querySelectorAll("[data-motion]:checked")].map(x => x.dataset.motion);
}

const motionNames = {
  jump:"ジャンプ", sway:"左右ゆれ", float:"ふわふわ",
  rotate:"くるくる", shake:"ぷるぷる", squash:"伸び縮み"
};

function updateReadyState() {
  const hasKey = !!getApiKey().trim();
  apiState.textContent = hasKey ? "API設定済み" : "APIキーが未設定です";
  apiState.style.color = hasKey ? "#21683a" : "#9d2924";
  goSettings.classList.toggle("hidden", hasKey);
  createBtn.disabled = !(hasKey && chosenFile && currentMotions().length);
}

document.querySelectorAll("[data-motion]").forEach(el => {
  el.addEventListener("change", updateReadyState);
});

function setFile(file) {
  if (!file) return;
  chosenFile = file;
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = URL.createObjectURL(file);
  preview.src = previewUrl;
  previewWrap.classList.remove("hidden");
  results.classList.add("hidden");
  clearError();
  updateReadyState();
}

galleryInput.addEventListener("change", () => setFile(galleryInput.files?.[0]));
cameraFallback.addEventListener("change", () => setFile(cameraFallback.files?.[0]));

$("clearImage").addEventListener("click", () => {
  chosenFile = null;
  previewWrap.classList.add("hidden");
  galleryInput.value = "";
  cameraFallback.value = "";
  if (previewUrl) URL.revokeObjectURL(previewUrl);
  previewUrl = null;
  updateReadyState();
});

function labelFromRange(v) {
  v = Number(v);
  return v < 85 ? "ひかえめ" : v > 115 ? "大きめ" : "ふつう";
}
function speedLabel(v) {
  v = Number(v);
  return v < 90 ? "ゆっくり" : v > 115 ? "速め" : "ふつう";
}
motionStrength.addEventListener("input", () => $("motionStrengthLabel").textContent = labelFromRange(motionStrength.value));
motionSpeed.addEventListener("input", () => $("motionSpeedLabel").textContent = speedLabel(motionSpeed.value));

function clearError() {
  errorBox.classList.add("hidden");
  errorBox.textContent = "";
}
function showError(msg) {
  errorBox.textContent = msg;
  errorBox.classList.remove("hidden");
}
function setStatus(title, text) {
  statusTitle.textContent = title;
  statusText.textContent = text;
  statusBox.classList.remove("hidden");
}
function hideStatus() { statusBox.classList.add("hidden"); }

/* ---------- Camera ---------- */
async function stopCamera() {
  if (cameraStream) {
    cameraStream.getTracks().forEach(t => t.stop());
    cameraStream = null;
  }
  $("cameraVideo").srcObject = null;
}

async function startCamera() {
  clearError();
  if (!navigator.mediaDevices?.getUserMedia) {
    cameraFallback.click();
    return;
  }
  try {
    await stopCamera();
    $("cameraModal").classList.remove("hidden");
    $("cameraMessage").textContent = "カメラの使用を許可してください。";
    cameraStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1920 },
        height: { ideal: 1080 }
      },
      audio: false
    });
    $("cameraVideo").srcObject = cameraStream;
    $("cameraMessage").textContent = "絵全体が入るように撮影してください。";
  } catch (err) {
    await stopCamera();
    $("cameraModal").classList.add("hidden");
    // Android/browser permissions or unsupported constraints: fall back to native file camera picker.
    cameraFallback.click();
  }
}

cameraBtn.addEventListener("click", startCamera);
$("cameraClose").addEventListener("click", async () => {
  await stopCamera();
  $("cameraModal").classList.add("hidden");
});
$("switchCamera").addEventListener("click", async () => {
  facingMode = facingMode === "environment" ? "user" : "environment";
  await startCamera();
});
$("takePhoto").addEventListener("click", async () => {
  const video = $("cameraVideo");
  if (!video.videoWidth) return;
  const canvas = $("cameraCanvas");
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0);
  canvas.toBlob(async blob => {
    if (!blob) return;
    const file = new File([blob], "camera-photo.jpg", {type:"image/jpeg"});
    setFile(file);
    await stopCamera();
    $("cameraModal").classList.add("hidden");
  }, "image/jpeg", 0.92);
});

/* ---------- Image API ---------- */
async function normalizeImage(file) {
  const bitmap = await createImageBitmap(file);
  const maxSide = 1536;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext("2d", {alpha:false});
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();
  const blob = await new Promise((resolve, reject) =>
    canvas.toBlob(b => b ? resolve(b) : reject(new Error("画像変換に失敗しました。")), "image/png")
  );
  return new File([blob], "drawing.png", {type:"image/png"});
}

function base64ToBlob(base64, type="image/png") {
  const binary = atob(base64);
  const arrays = [];
  for (let i=0;i<binary.length;i+=1024*1024) {
    const s = binary.slice(i, i+1024*1024);
    const a = new Uint8Array(s.length);
    for (let j=0;j<s.length;j++) a[j] = s.charCodeAt(j);
    arrays.push(a);
  }
  return new Blob(arrays, {type});
}

async function generateIllustration() {
  const key = getApiKey().trim();
  if (!key) throw new Error("APIキーが未設定です。設定画面で入力してください。");
  const normalized = await normalizeImage(chosenFile);
  const form = new FormData();
  form.append("model", getSetting("oekaki.model", "gpt-image-2.5-sunburst"));
  form.append("image", normalized);
  form.append("prompt", getSetting("oekaki.prompt", DEFAULT_PROMPT));
  form.append("size", "1024x1024");
  form.append("quality", getSetting("oekaki.quality", "medium"));
  form.append("background", "transparent");
  form.append("output_format", "png");

  const response = await fetch(API_URL, {
    method:"POST",
    headers:{"Authorization":`Bearer ${key}`},
    body:form
  });
  const text = await response.text();
  let data = {};
  try { data = JSON.parse(text); } catch {}
  if (!response.ok) {
    throw new Error(data?.error?.message || `OpenAI API error (${response.status})`);
  }
  const first = data?.data?.[0];
  if (first?.b64_json) return base64ToBlob(first.b64_json);
  if (first?.url) {
    const r = await fetch(first.url);
    if (!r.ok) throw new Error("生成画像を取得できませんでした。");
    return await r.blob();
  }
  throw new Error("生成画像データが見つかりませんでした。");
}

/* ---------- GIF ---------- */
async function getWorkerBlobUrl() {
  if (workerBlobUrl) return workerBlobUrl;
  const r = await fetch(GIF_WORKER_URL);
  if (!r.ok) throw new Error("GIFワーカーを読み込めませんでした。");
  workerBlobUrl = URL.createObjectURL(new Blob([await r.text()], {type:"application/javascript"}));
  return workerBlobUrl;
}

async function loadImage(blob) {
  const url = URL.createObjectURL(blob);
  const img = new Image();
  await new Promise((resolve,reject) => {
    img.onload = resolve;
    img.onerror = reject;
    img.src = url;
  });
  return {img,url};
}

function motionTransform(motions, phase, strength) {
  const s = strength / 100;
  let x=0, y=0, rot=0, sx=1, sy=1;
  const two = Math.PI*2;

  if (motions.includes("jump")) {
    const j = Math.max(0, Math.sin(Math.PI * phase));
    y -= Math.pow(j,1.65) * 125 * s;
    const edge = Math.min(phase, 1-phase);
    if (edge < .10) {
      const q = 1 - edge/.10;
      sx *= 1 + .08*q*s;
      sy *= 1 - .10*q*s;
    } else {
      sy *= 1 + .035*j*s;
    }
  }
  if (motions.includes("sway")) {
    x += Math.sin(two*phase) * 34 * s;
    rot += Math.sin(two*phase) * 4.5 * s;
  }
  if (motions.includes("float")) {
    y += Math.sin(two*phase) * 28 * s;
    rot += Math.sin(two*phase + Math.PI/3) * 2.2 * s;
  }
  if (motions.includes("rotate")) {
    rot += Math.sin(two*phase) * 13 * s;
  }
  if (motions.includes("shake")) {
    x += Math.sin(two*phase*5) * 7 * s;
    rot += Math.sin(two*phase*6) * 2.8 * s;
  }
  if (motions.includes("squash")) {
    const q = Math.sin(two*phase);
    sx *= 1 + .07*q*s;
    sy *= 1 - .07*q*s;
  }
  return {x,y,rot,sx,sy};
}

async function makeGif(pngBlob, motions) {
  if (typeof GIF === "undefined") throw new Error("GIFライブラリを読み込めませんでした。");
  const {img,url} = await loadImage(pngBlob);
  const worker = await getWorkerBlobUrl();

  const size = 640;
  const frames = 28;
  const strength = Number(motionStrength.value);
  const speed = Number(motionSpeed.value);
  const delay = Math.max(35, Math.round(75 * 100 / speed));
  const fit = Math.min(size*.72/img.naturalWidth, size*.64/img.naturalHeight);
  const baseW = img.naturalWidth*fit, baseH = img.naturalHeight*fit;
  const baseX = size/2, baseY = size*.55;
  const chroma = "#010203";

  const gif = new GIF({
    workers:2, quality:10, width:size, height:size, repeat:0,
    transparent:0x010203, workerScript:worker
  });

  for (let i=0;i<frames;i++) {
    const phase = i/frames;
    const tr = motionTransform(motions, phase, strength);
    const canvas = document.createElement("canvas");
    canvas.width = size; canvas.height = size;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = chroma; ctx.fillRect(0,0,size,size);

    ctx.save();
    ctx.translate(baseX + tr.x, baseY + tr.y);
    ctx.rotate(tr.rot * Math.PI/180);
    ctx.scale(tr.sx, tr.sy);
    ctx.drawImage(img, -baseW/2, -baseH/2, baseW, baseH);
    ctx.restore();

    gif.addFrame(ctx, {copy:true, delay});
  }
  URL.revokeObjectURL(url);
  return await new Promise((resolve,reject) => {
    gif.on("finished", resolve);
    gif.on("abort", () => reject(new Error("GIF作成が中断されました。")));
    gif.render();
  });
}

createBtn.addEventListener("click", async () => {
  clearError(); results.classList.add("hidden");
  const motions = currentMotions();
  if (!chosenFile || !motions.length) return;
  createBtn.disabled = true;
  try {
    setStatus("イラストを作成中…","背景と文字を取り除き、元絵をイラスト化しています。");
    const pngBlob = await generateIllustration();
    if (pngUrl) URL.revokeObjectURL(pngUrl);
    pngUrl = URL.createObjectURL(pngBlob);
    pngResult.src = pngUrl; pngDownload.href = pngUrl;

    setStatus("GIFを作成中…","選択した動きを組み合わせています。");
    const gifBlob = await makeGif(pngBlob, motions);
    if (gifUrl) URL.revokeObjectURL(gifUrl);
    gifUrl = URL.createObjectURL(gifBlob);
    gifResult.src = gifUrl; gifDownload.href = gifUrl;
    $("motionSummary").textContent = "動き: " + motions.map(m => motionNames[m]).join(" ＋ ");

    hideStatus(); results.classList.remove("hidden");
    results.scrollIntoView({behavior:"smooth", block:"start"});
  } catch(err) {
    hideStatus();
    const msg = String(err?.message || err);
    if (msg.includes("Failed to fetch")) {
      showError("APIへ接続できませんでした。通信状態、APIキー、ブラウザの通信制限を確認してください。");
    } else showError(msg);
  } finally {
    updateReadyState();
  }
});

updateReadyState();

if ("serviceWorker" in navigator && location.protocol === "https:") {
  addEventListener("load", () => navigator.serviceWorker.register("./sw.js").catch(()=>{}));
}
