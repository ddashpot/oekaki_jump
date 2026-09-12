const API_URL = "https://api.openai.com/v1/images/edits";
const GIF_JS_URL = "https://cdn.jsdelivr.net/npm/gif.js.optimized@1.0.1/dist/gif.worker.js";

const PROMPT = `添付した子どもの絵をもとに、キャラクターだけを完成イラストにしてください。

写真に写っている紙、布、机、影、文字、メモ、周囲の不要なものをすべて取り除き、
キャラクターの絵の部分だけを抽出してください。

元の子どもの絵にある形、色、線、手描き感、独特なバランスや特徴をできるだけ残し、
勝手に別のキャラクターデザインへ変更しないでください。

背景は完全に透明。キャラクター全体が切れないよう中央に配置し、
周囲に十分な透明余白を残してください。
子どもの原画の魅力を残した、明るくかわいい児童向けの完成イラストにしてください。
文字は出力しないでください。キャラクターは1体だけにしてください。`;

const $ = (id) => document.getElementById(id);
const apiKey = $("apiKey");
const toggleKey = $("toggleKey");
const fileInput = $("file");
const createBtn = $("create");
const previewWrap = $("previewWrap");
const preview = $("preview");
const statusBox = $("status");
const statusTitle = $("statusTitle");
const statusText = $("statusText");
const errorBox = $("error");
const results = $("results");
const pngResult = $("pngResult");
const gifResult = $("gifResult");
const pngDownload = $("pngDownload");
const gifDownload = $("gifDownload");
const jump = $("jump");
const jumpValue = $("jumpValue");
const model = $("model");
const quality = $("quality");

let chosenFile = null;
let sourcePreviewUrl = null;
let pngObjectUrl = null;
let gifObjectUrl = null;
let workerBlobUrl = null;

function setStatus(title, text) {
  statusTitle.textContent = title;
  statusText.textContent = text;
  statusBox.classList.remove("hidden");
}

function hideStatus() {
  statusBox.classList.add("hidden");
}

function showError(message) {
  errorBox.textContent = message;
  errorBox.classList.remove("hidden");
}

function clearError() {
  errorBox.classList.add("hidden");
  errorBox.textContent = "";
}

function updateButton() {
  createBtn.disabled = !(chosenFile && apiKey.value.trim());
}

function jumpLabel(value) {
  const v = Number(value);
  if (v < 120) return "ひかえめ";
  if (v < 210) return "ふつう";
  return "たかめ";
}

jump.addEventListener("input", () => {
  jumpValue.textContent = jumpLabel(jump.value);
});

toggleKey.addEventListener("click", () => {
  const showing = apiKey.type === "text";
  apiKey.type = showing ? "password" : "text";
  toggleKey.textContent = showing ? "表示" : "隠す";
});

apiKey.addEventListener("input", updateButton);

fileInput.addEventListener("change", () => {
  const f = fileInput.files?.[0];
  if (!f) return;
  chosenFile = f;

  if (sourcePreviewUrl) URL.revokeObjectURL(sourcePreviewUrl);
  sourcePreviewUrl = URL.createObjectURL(f);
  preview.src = sourcePreviewUrl;
  previewWrap.classList.remove("hidden");
  results.classList.add("hidden");
  clearError();
  updateButton();
});

async function normalizeImage(file) {
  const bitmap = await createImageBitmap(file);
  const maxSide = 1536;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d", { alpha: false });
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob = await new Promise((resolve, reject) => {
    canvas.toBlob(
      b => b ? resolve(b) : reject(new Error("画像の変換に失敗しました。")),
      "image/png"
    );
  });
  return new File([blob], "drawing.png", { type: "image/png" });
}

function base64ToBlob(base64, type = "image/png") {
  const binary = atob(base64);
  const chunk = 1024 * 1024;
  const parts = [];
  for (let i = 0; i < binary.length; i += chunk) {
    const slice = binary.slice(i, i + chunk);
    const bytes = new Uint8Array(slice.length);
    for (let j = 0; j < slice.length; j++) bytes[j] = slice.charCodeAt(j);
    parts.push(bytes);
  }
  return new Blob(parts, { type });
}

async function callImageEdit(key, file) {
  const normalized = await normalizeImage(file);
  const form = new FormData();
  form.append("model", model.value);
  form.append("image", normalized);
  form.append("prompt", PROMPT);
  form.append("size", "1024x1024");
  form.append("quality", quality.value);
  form.append("background", "transparent");
  form.append("output_format", "png");

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`
    },
    body: form
  });

  let data;
  const text = await response.text();
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error(`OpenAI APIから予期しない応答が返りました。（HTTP ${response.status}）`);
  }

  if (!response.ok) {
    const msg = data?.error?.message || data?.message || `HTTP ${response.status}`;
    throw new Error(msg);
  }

  const first = data?.data?.[0];
  if (first?.b64_json) {
    return base64ToBlob(first.b64_json, "image/png");
  }

  if (first?.url) {
    const imgResponse = await fetch(first.url);
    if (!imgResponse.ok) throw new Error("生成画像を取得できませんでした。");
    return await imgResponse.blob();
  }

  throw new Error("生成画像データが見つかりませんでした。");
}

async function blobToImage(blob) {
  const url = URL.createObjectURL(blob);
  try {
    const img = new Image();
    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = () => reject(new Error("生成画像を読み込めませんでした。"));
      img.src = url;
    });
    return { img, url };
  } catch (e) {
    URL.revokeObjectURL(url);
    throw e;
  }
}

async function getWorkerBlobUrl() {
  if (workerBlobUrl) return workerBlobUrl;
  const response = await fetch(GIF_JS_URL, { mode: "cors" });
  if (!response.ok) throw new Error("GIFエンコーダーを読み込めませんでした。");
  const code = await response.text();
  workerBlobUrl = URL.createObjectURL(new Blob([code], { type: "application/javascript" }));
  return workerBlobUrl;
}

async function makeJumpGif(pngBlob, jumpHeight) {
  if (typeof GIF === "undefined") {
    throw new Error("GIFライブラリを読み込めませんでした。通信状態を確認してください。");
  }

  const { img, url } = await blobToImage(pngBlob);
  const workerUrl = await getWorkerBlobUrl();

  const size = 640;
  const frames = 24;
  const fpsDelay = 72;
  const chroma = "#00ff00";
  const transparentColor = 0x00ff00;

  const fit = Math.min((size * 0.76) / img.naturalWidth, (size * 0.60) / img.naturalHeight);
  const baseW = img.naturalWidth * fit;
  const baseH = img.naturalHeight * fit;
  const baseline = size * 0.88;

  const gif = new GIF({
    workers: 2,
    quality: 10,
    width: size,
    height: size,
    repeat: 0,
    transparent: transparentColor,
    workerScript: workerUrl
  });

  for (let i = 0; i < frames; i++) {
    const t = i / frames;
    const rise = Math.pow(Math.max(0, Math.sin(Math.PI * t)), 1.7);
    const yOffset = Number(jumpHeight) * rise * (size / 900);

    const edge = Math.min(t, 1 - t);
    const squash = edge < 0.12 ? Math.max(0, 1 - edge / 0.12) : 0;
    const sx = 1 + 0.09 * squash - 0.025 * rise;
    const sy = 1 - 0.11 * squash + 0.055 * rise;

    const w = baseW * sx;
    const h = baseH * sy;
    const x = (size - w) / 2;
    const y = baseline - h - yOffset;

    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");

    // GIF supports only one fully transparent palette color.
    // Use a chroma-key color that is unlikely to occur in children's drawings.
    ctx.fillStyle = chroma;
    ctx.fillRect(0, 0, size, size);
    ctx.drawImage(img, x, y, w, h);

    gif.addFrame(ctx, { copy: true, delay: fpsDelay });
  }

  URL.revokeObjectURL(url);

  return await new Promise((resolve, reject) => {
    gif.on("finished", resolve);
    gif.on("abort", () => reject(new Error("GIF作成が中断されました。")));
    gif.render();
  });
}

function describeError(err) {
  const msg = String(err?.message || err || "");
  if (msg.includes("Failed to fetch")) {
    return "OpenAI APIへ接続できませんでした。\n通信状態、APIキー、ブラウザの拡張機能やネットワーク制限を確認してください。";
  }
  if (msg.toLowerCase().includes("api key") || msg.includes("Incorrect API key")) {
    return "APIキーを確認してください。\n" + msg;
  }
  return msg;
}

createBtn.addEventListener("click", async () => {
  clearError();
  results.classList.add("hidden");

  const key = apiKey.value.trim();
  if (!key || !chosenFile) return;

  createBtn.disabled = true;

  try {
    setStatus("イラストを作成中…", "背景や文字を除き、元絵を完成イラストにしています。");
    const pngBlob = await callImageEdit(key, chosenFile);

    if (pngObjectUrl) URL.revokeObjectURL(pngObjectUrl);
    pngObjectUrl = URL.createObjectURL(pngBlob);
    pngResult.src = pngObjectUrl;
    pngDownload.href = pngObjectUrl;

    setStatus("GIFを作成中…", "完成イラストをジャンプさせています。");
    const gifBlob = await makeJumpGif(pngBlob, jump.value);

    if (gifObjectUrl) URL.revokeObjectURL(gifObjectUrl);
    gifObjectUrl = URL.createObjectURL(gifBlob);
    gifResult.src = gifObjectUrl;
    gifDownload.href = gifObjectUrl;

    results.classList.remove("hidden");
    hideStatus();
    results.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (err) {
    hideStatus();
    showError(describeError(err));
  } finally {
    updateButton();
  }
});

if ("serviceWorker" in navigator && location.protocol === "https:") {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(() => {});
  });
}
