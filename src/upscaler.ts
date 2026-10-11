/* v0.98: АПСКЕЙЛЕР РЕТРО ПИКСЕЛЬ-КАРТИНОК — клиентское увеличение без «размазывания».
   Зачем: найти картинку (например, карту мира Супер Марио), увеличить её прямо в редакторе
   карт и поставить фоном — получится готовая карта с чёткими пиксельными кромками и хорошим
   разрешением вместо мыльного растяжения браузером.

   Методы:
   - xBRZ («Scale by rules», Zenju) — лучший для пиксель-арта: дорисовывает острые кромки,
     диагонали и окружности; порт — src/vendor/xbrz.js (xbrz-js 1.9.2 by Jimbly, GPL-3).
   - Scale2x/3x/4x (AdvMAME) — классика «чётких граней»; формулы официальные (scale2x,
     corner-правила EPX; Scale4x = два прохода Scale2x, как в оригинале).
   - Ближайший сосед — идеальные квадраты без всякой интерполяции.

   Всё считается ЛОКАЛЬНО в браузере: картинка → Uint32Array (ARGB, как вьюха ImageData) →
   скейл ПОЛОСАМИ строк (не блокируя UI, с прогрессом; для xBRZ полосы байт-в-байт равны
   одноразовому вызову — проверено тестом) → PNG dataURL. Ничего никуда не отправляется. */
import { xbrzScale, ColorFormat } from './vendor/xbrz.js';

export type ScaleMethod = 'xbrz' | 'scale2x' | 'nearest';

/** Лимит стороны результата: больше не умеет канва браузера. */
export const UPSCALE_MAX_DIM = 16384;
/** Лимит площади результата (~160 МБ RGBA-памяти под пиксели). */
export const UPSCALE_MAX_PX = 40_000_000;

/** Конфиг xBRZ: oobRead='duplicate' — края картинки дублируются, плоские заливки дают
   байт-в-байт тот же цвет на всей площади (с 'transparent' углы подмешивают альфу). */
const XBRZ_CFG = {
  equalColorTolerance: 30,
  centerDirectionBias: 4,
  dominantDirectionThreshold: 3.6,
  steepDirectionThreshold: 2.4,
  oobRead: 'duplicate',
  testAttribute: 0,
};

export const METHOD_LABELS: Record<ScaleMethod, string> = {
  xbrz: 'xBRZ',
  scale2x: 'Scale2x/3x/4x',
  nearest: 'Ближний сосед',
};

export const METHOD_HINTS: Record<ScaleMethod, string> = {
  xbrz: 'xBRZ — лучший для пиксель-арта: острые кромки и гладкие диагонали',
  scale2x: 'Scale2x/3x/4x (AdvMAME) — классические чёткие грани, без смешения цветов',
  nearest: 'Ближний сосед — каждый пиксель просто увеличивается в N раз, идеальные квадраты',
};

/** Доступные кратности метода (xBRZ умеет 2–6, Scale2x/3x — 2/3/4, сосед — любая). */
export function methodFactors(m: ScaleMethod): number[] {
  if (m === 'xbrz') return [2, 3, 4, 5, 6];
  if (m === 'scale2x') return [2, 3, 4];
  return [2, 3, 4, 5, 6, 8];
}

/** Текст-предупреждение, если результат не влезет в канву/память, иначе null. */
export function upscaleWarn(w: number, h: number, factor: number): string | null {
  const ow = w * factor, oh = h * factor;
  if (ow > UPSCALE_MAX_DIM || oh > UPSCALE_MAX_DIM) return `${ow}×${oh}: сторона больше ${UPSCALE_MAX_DIM}px — канва браузера столько не умеет`;
  if (ow * oh > UPSCALE_MAX_PX) return `${ow}×${oh}: больше ${Math.round(UPSCALE_MAX_PX / 1e6)}М пикселей — не хватит памяти`;
  return null;
}

const yieldUi = () => new Promise<void>((r) => setTimeout(r, 0));

/** Рисуем картинку 1:1 и забираем пиксели как Uint32Array (ARGB — порядок байт как в ImageData). */
export function imgToU32(img: HTMLImageElement): { src: Uint32Array; w: number; h: number } {
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) throw new Error('пустая картинка');
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const cx = cv.getContext('2d', { willReadFrequently: true });
  if (!cx) throw new Error('канва недоступна');
  cx.imageSmoothingEnabled = false;
  cx.drawImage(img, 0, 0);
  const d = cx.getImageData(0, 0, w, h);
  return { src: new Uint32Array(d.data.buffer), w, h };
}

/* ---- Scale2x/3x: band-обработка строк [y0, y1), формулы официальные ----
   Окрестность: A B C / D E F / G H I (E — текущий пиксель); край — дублируем соседа. */
function scaleBand(src: Uint32Array, dst: Uint32Array, w: number, h: number, f: 2 | 3, y0: number, y1: number) {
  const ow = w * f;
  for (let y = y0; y < y1; y++) {
    const yu = (y > 0 ? y - 1 : 0) * w, ym = y * w, yd = (y < h - 1 ? y + 1 : h - 1) * w;
    for (let x = 0; x < w; x++) {
      const xl = x > 0 ? x - 1 : 0, xr = x < w - 1 ? x + 1 : w - 1;
      const A = src[yu + xl], B = src[yu + x], C = src[yu + xr];
      const D = src[ym + xl], E = src[ym + x], F = src[ym + xr];
      const G = src[yd + xl], H = src[yd + x], I = src[yd + xr];
      const c0 = D === B && B !== F && D !== H; // верх-лев: запад==север
      const c2 = B === F && B !== D && F !== H; // верх-прав: север==восток
      const c6 = D === H && H !== F && D !== B; // низ-лев: юг==запад
      const c8 = H === F && F !== B && H !== D; // низ-прав: восток==юг
      const o = y * f * ow + x * f;
      if (f === 2) {
        dst[o] = c0 ? D : E;
        dst[o + 1] = c2 ? F : E;
        dst[o + ow] = c6 ? D : E;
        dst[o + ow + 1] = c8 ? F : E;
      } else {
        dst[o] = c0 ? D : E;
        dst[o + 1] = (c0 && E !== C) || (c2 && E !== A) ? B : E;
        dst[o + 2] = c2 ? F : E;
        dst[o + ow] = (c6 && E !== A) || (c0 && E !== G) ? D : E;
        dst[o + ow + 1] = E;
        dst[o + ow + 2] = (c2 && E !== I) || (c8 && E !== C) ? F : E;
        dst[o + ow * 2] = c6 ? D : E;
        dst[o + ow * 2 + 1] = (c8 && E !== G) || (c6 && E !== I) ? H : E;
        dst[o + ow * 2 + 2] = c8 ? F : E;
      }
    }
  }
}

/* ---- Ближний сосед: band-обработка ---- */
function nearestBand(src: Uint32Array, dst: Uint32Array, w: number, h: number, f: number, y0: number, y1: number) {
  const ow = w * f;
  for (let y = y0; y < y1; y++) {
    const srow = y * w, orow0 = y * f * ow;
    for (let dy = 0; dy < f; dy++) {
      const orow = orow0 + dy * ow;
      for (let x = 0; x < w; x++) {
        const p = src[srow + x];
        const base = orow + x * f;
        for (let dx = 0; dx < f; dx++) dst[base + dx] = p;
      }
    }
  }
}

/** Сам апскейл: src (ARGB) → новый Uint32Array (w*factor × h*factor), полосами с прогрессом. */
export async function upscaleU32(
  src: Uint32Array, w: number, h: number, factor: number, method: ScaleMethod,
  onProgress?: (p: number) => void,
): Promise<Uint32Array> {
  const warn = upscaleWarn(w, h, factor);
  if (warn) throw new Error(warn.replace(/^[\d×]+:\s*/, ''));
  const dst = new Uint32Array(w * factor * h * factor);
  if (method === 'xbrz') {
    // полосы строк: ~3 Мп результата на полосу (8..512 исходных строк)
    const bandRows = Math.max(8, Math.min(512, Math.round(3_000_000 / Math.max(1, w * factor * factor))));
    for (let y0 = 0; y0 < h; y0 += bandRows) {
      const y1 = Math.min(y0 + bandRows, h);
      xbrzScale(factor, src, dst, w, h, ColorFormat.argb, XBRZ_CFG, y0, y1);
      onProgress?.(y1 / h * 0.97);
      await yieldUi();
    }
  } else if (method === 'scale2x') {
    if (factor === 2 || factor === 3) {
      const bandRows = Math.max(16, Math.min(2048, Math.round(4_000_000 / Math.max(1, w * factor))));
      for (let y0 = 0; y0 < h; y0 += bandRows) {
        const y1 = Math.min(y0 + bandRows, h);
        scaleBand(src, dst, w, h, factor as 2 | 3, y0, y1);
        onProgress?.(y1 / h * 0.97);
        await yieldUi();
      }
    } else {
      // Scale4x = ДВА прохода Scale2x (официальное определение AdvMAME4x)
      const w2 = w * 2, h2 = h * 2;
      const mid = new Uint32Array(w2 * h2);
      const b1 = Math.max(16, Math.min(2048, Math.round(2_000_000 / Math.max(1, w2))));
      for (let y0 = 0; y0 < h; y0 += b1) {
        const y1 = Math.min(y0 + b1, h);
        scaleBand(src, mid, w, h, 2, y0, y1);
        onProgress?.(y1 / h * 0.45);
        await yieldUi();
      }
      const b2 = Math.max(16, Math.min(2048, Math.round(2_000_000 / Math.max(1, w2 * 2))));
      for (let y0 = 0; y0 < h2; y0 += b2) {
        const y1 = Math.min(y0 + b2, h2);
        scaleBand(mid, dst, w2, h2, 2, y0, y1);
        onProgress?.(0.45 + y1 / h2 * 0.52);
        await yieldUi();
      }
    }
  } else {
    const bandRows = Math.max(32, Math.min(4096, Math.round(8_000_000 / Math.max(1, w * factor))));
    for (let y0 = 0; y0 < h; y0 += bandRows) {
      const y1 = Math.min(y0 + bandRows, h);
      nearestBand(src, dst, w, h, factor, y0, y1);
      onProgress?.(y1 / h * 0.97);
      await yieldUi();
    }
  }
  onProgress?.(1);
  return dst;
}

/** Uint32Array → канва (для putImageData). */
export function u32ToCanvas(u: Uint32Array, w: number, h: number): HTMLCanvasElement {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const cx = cv.getContext('2d');
  if (!cx) throw new Error('канва недоступна');
  cx.putImageData(new ImageData(new Uint8ClampedArray(u.buffer as ArrayBuffer), w, h), 0, 0); // буфер всегда наш (new Uint32Array) — не SharedArrayBuffer
  return cv;
}

export interface UpscaleResult { url: string; w: number; h: number; ms: number; }

/** Полный цикл: картинка → пиксели → скейл → PNG dataURL. */
export async function runUpscale(
  img: HTMLImageElement, factor: number, method: ScaleMethod,
  onProgress?: (p: number) => void,
): Promise<UpscaleResult> {
  const t0 = Date.now();
  const { src, w, h } = imgToU32(img);
  const dst = await upscaleU32(src, w, h, factor, method, onProgress);
  await yieldUi();
  const ow = w * factor, oh = h * factor;
  const url = u32ToCanvas(dst, ow, oh).toDataURL('image/png');
  return { url, w: ow, h: oh, ms: Date.now() - t0 };
}
