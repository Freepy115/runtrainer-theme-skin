// 主题皮肤核心：颜色工具、图片压缩、取色算法、皮肤规范化。
// 纯函数/无副作用（除 loadImageFile 依赖 DOM 的 canvas/FileReader），便于单测。

export const COLOR_KEYS = [
  'accent', 'accent-soft', 'bg', 'bg-card', 'bg-hover',
  'text', 'text-muted', 'border', 'gridline',
];

export const COLOR_LABELS = {
  'accent': '主色', 'accent-soft': '主色浅底', 'bg': '背景', 'bg-card': '卡片',
  'bg-hover': '悬停', 'text': '文字', 'text-muted': '次要文字', 'border': '边框', 'gridline': '网格线',
};

// 内置黑红暗色主题的 9 色（与 app.css [data-theme="dark"] 一致），手动调色的默认起点
export const DEFAULT_COLORS = {
  'accent': '#e03131', 'accent-soft': '#2e1418', 'bg': '#0b0b0e',
  'bg-card': '#16161c', 'bg-hover': '#20202a', 'text': '#e8e8ee',
  'text-muted': '#8a8a96', 'border': '#2a2a34', 'gridline': '#22222b',
};

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// ---- 颜色工具 ----
export function hexToRgb(hex) {
  const m = /^#?([0-9a-f]{6})$/i.exec(String(hex || '').trim());
  if (!m) return null;
  const n = parseInt(m[1], 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function rgbToHex({ r, g, b }) {
  const c = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0');
  return '#' + c(r) + c(g) + c(b);
}

export function rgbToHsl({ r, g, b }) {
  r /= 255; g /= 255; b /= 255;
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  const l = (mx + mn) / 2;
  if (mx === mn) return { h: 0, s: 0, l };
  const d = mx - mn;
  const s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
  let h;
  if (mx === r) h = (g - b) / d + (g < b ? 6 : 0);
  else if (mx === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  return { h: h * 60, s, l };
}

export function hslToRgb({ h, s, l }) {
  h = ((h % 360) + 360) % 360;
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  let r, g, b;
  if (h < 60) [r, g, b] = [c, x, 0];
  else if (h < 120) [r, g, b] = [x, c, 0];
  else if (h < 180) [r, g, b] = [0, c, x];
  else if (h < 240) [r, g, b] = [0, x, c];
  else if (h < 300) [r, g, b] = [x, 0, c];
  else [r, g, b] = [c, 0, x];
  return { r: Math.round((r + m) * 255), g: Math.round((g + m) * 255), b: Math.round((b + m) * 255) };
}

export function relLuminance({ r, g, b }) {
  const f = (v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
}

export function contrastRatio(a, b) {
  const la = relLuminance(a), lb = relLuminance(b);
  const hi = Math.max(la, lb), lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
}

// t: 0→a，1→b
export function mix(a, b, t) {
  return { r: a.r + (b.r - a.r) * t, g: a.g + (b.g - a.g) * t, b: a.b + (b.b - a.b) * t };
}

export function saturation({ r, g, b }) {
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
  return mx === 0 ? 0 : (mx - mn) / mx;
}

// ---- 图片加载与压缩 ----
function readFileAsDataURL(file) {
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(new Error('读取文件失败'));
    fr.readAsDataURL(file);
  });
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片加载失败'));
    img.src = src;
  });
}

const MAX_BG_BYTES = 512 * 1024; // 单张背景 data URL 上限，超限自动降质防 kv 膨胀

/**
 * 读图片文件 → 缩到最长边 maxEdge → 返回 { imageData, dataUrl, width, height }。
 * imageData 保留 alpha（取色时忽略透明像素）；dataUrl 为压缩后的 JPEG（背景用）。
 */
export async function loadImageFile(file, { maxEdge = 1600, quality = 0.82 } = {}) {
  const rawUrl = await readFileAsDataURL(file);
  const img = await loadImage(rawUrl);
  const scale = Math.min(1, maxEdge / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * scale));
  const h = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = w; canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(img, 0, 0, w, h);
  const imageData = ctx.getImageData(0, 0, w, h); // 先取（含 alpha），再转 JPEG
  let dataUrl = canvas.toDataURL('image/jpeg', quality);
  let q = quality;
  while (dataUrl.length > MAX_BG_BYTES && q > 0.4) {
    q -= 0.1;
    dataUrl = canvas.toDataURL('image/jpeg', q);
  }
  return { imageData, dataUrl, width: w, height: h };
}

// ---- 取色 ----
/** 颜色量化：RGB 每通道 4 档（64 桶）统计频次，返回高频桶均色（按频次降序）。 */
export function extractPalette(imageData, maxColors = 8) {
  const { data } = imageData;
  const buckets = new Map();
  for (let i = 0; i < data.length; i += 4) {
    if (data[i + 3] < 125) continue; // 忽略近透明像素
    const r = data[i], g = data[i + 1], b = data[i + 2];
    const key = ((r >> 6) << 4) | ((g >> 6) << 2) | (b >> 6);
    let bkt = buckets.get(key);
    if (!bkt) { bkt = { r: 0, g: 0, b: 0, n: 0 }; buckets.set(key, bkt); }
    bkt.r += r; bkt.g += g; bkt.b += b; bkt.n += 1;
  }
  if (!buckets.size) return [];
  return [...buckets.values()]
    .map((b) => ({ r: Math.round(b.r / b.n), g: Math.round(b.g / b.n), b: Math.round(b.b / b.n), n: b.n }))
    .sort((a, b) => b.n - a.n)
    .slice(0, maxColors);
}

function tuneAccent(accent, mode) {
  const hsl = rgbToHsl(accent);
  const s = Math.max(0.5, hsl.s);
  // 主色作为按钮底色，按钮文字恒为白：亮度保持在中低区间保证白字可读
  const l = mode === 'dark' ? clamp(hsl.l, 0.28, 0.5) : clamp(hsl.l, 0.22, 0.4);
  return hslToRgb({ h: hsl.h, s, l });
}

function pushBg(bg, mode) {
  const hsl = rgbToHsl(bg);
  // 背景去饱和、压向近黑/近白，只保留图片色相的一丝余韵，避免整屏大红大绿
  const s = Math.min(hsl.s, mode === 'dark' ? 0.35 : 0.25);
  const l = mode === 'dark' ? clamp(hsl.l, 0.04, 0.12) : clamp(hsl.l, 0.93, 0.98);
  return hslToRgb({ h: hsl.h, s, l });
}

/** 把主色列表映射为一套完整主题配色（9 色 + mode）。 */
export function paletteToTheme(swatches) {
  if (!swatches || !swatches.length) return null;
  const avgL = swatches.reduce((s, c) => s + relLuminance(c), 0) / swatches.length;
  const mode = avgL > 0.45 ? 'light' : 'dark';

  const bySat = [...swatches].sort((a, b) => saturation(b) - saturation(a));
  const accent = tuneAccent(bySat[0], mode);

  const byLum = [...swatches].sort((a, b) => relLuminance(a) - relLuminance(b));
  const bg = pushBg(mode === 'dark' ? byLum[0] : byLum[byLum.length - 1], mode);

  const text = mode === 'dark' ? { r: 235, g: 235, b: 240 } : { r: 30, g: 28, b: 26 };
  const bgCard = mix(bg, text, mode === 'dark' ? 0.05 : 0.04);
  const bgHover = mix(bg, text, mode === 'dark' ? 0.1 : 0.08);
  const border = mix(bg, text, mode === 'dark' ? 0.16 : 0.14);
  const textMuted = mix(text, bg, 0.35);
  const accentSoft = mix(accent, bg, 0.88);

  return {
    mode,
    colors: {
      'accent': rgbToHex(accent),
      'accent-soft': rgbToHex(accentSoft),
      'bg': rgbToHex(bg),
      'bg-card': rgbToHex(bgCard),
      'bg-hover': rgbToHex(bgHover),
      'text': rgbToHex(text),
      'text-muted': rgbToHex(textMuted),
      'border': rgbToHex(border),
      'gridline': rgbToHex(border),
    },
  };
}

// ---- 皮肤规范化（新建/导入统一入口） ----
export function makeSkinId() {
  return 'sk_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function isValidHex(hex) { return !!hexToRgb(hex); }

export function validateSkin(skin) {
  if (!skin || typeof skin !== 'object') return false;
  if (typeof skin.name !== 'string' || !skin.name.trim()) return false;
  const c = skin.colors;
  if (!c || typeof c !== 'object') return false;
  return COLOR_KEYS.every((k) => typeof c[k] === 'string' && isValidHex(c[k]));
}

/** 规范化皮肤：补默认色、生成 id、校验 layout，返回可安全存取的皮肤对象。 */
export function normalizeSkin(skin) {
  const src = (skin && typeof skin === 'object') ? skin : {};
  const colors = {};
  for (const k of COLOR_KEYS) {
    colors[k] = isValidHex(src.colors && src.colors[k]) ? src.colors[k] : DEFAULT_COLORS[k];
  }
  const pick = (arr, v, d) => (arr.includes(v) ? v : d);
  return {
    id: (typeof src.id === 'string' && src.id) || makeSkinId(),
    name: (typeof src.name === 'string' && src.name.trim()) || '未命名皮肤',
    mode: src.mode === 'light' ? 'light' : 'dark',
    background: (typeof src.background === 'string' && src.background.startsWith('data:image'))
      ? src.background : '',
    overlay: (typeof src.overlay === 'number' && isFinite(src.overlay))
      ? clamp(src.overlay, 0.2, 1) : 0.82,
    colors,
    layout: {
      radius: pick(['mech', 'round'], src.layout && src.layout.radius, 'mech'),
      sidebar: pick(['compact', 'standard', 'wide'], src.layout && src.layout.sidebar, 'standard'),
      density: pick(['compact', 'normal', 'comfy'], src.layout && src.layout.density, 'normal'),
    },
  };
}
