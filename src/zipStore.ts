/* v0.178: МИНИ-ZIP БЕЗ ЗАВИСИМОСТЕЙ — для кнопки «📦 Сохранить все для базы (ZIP)».
   В package.json нет jszip, и добавлять зависимость ради пары МБ состояний не нужно:
   сохранения упаковываются методом STORE (без сжатия) — состояния ядра base64 и так
   почти не сжимаются, а ZIP собирается мгновенно и открывается чем угодно.
   Файл ПУСТОЙ внутри (без импортов) — смоук scripts/v178-smoke.mjs гоняет его в Node:
   crc32 считается по эталону («123456789» → 0xCBF43926), ZIP разбирается обратно.
   Имена файлов пишутся в UTF-8 с флагом 0x0800 — ники кириллицей («Френди_.zip»)
   корректно распаковываются и в Проводнике Windows, и в Git Bash. */

/* Таблица CRC32 (полином 0xEDB88320 — стандарт zlib/zip). */
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(bytes: Uint8Array): number {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

/* little-endian помощники */
const w16 = (v: number) => new Uint8Array([v & 255, (v >>> 8) & 255]);
const w32 = (v: number) => new Uint8Array([v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]);
const cat = (...parts: Uint8Array[]): Uint8Array => {
  const len = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(len);
  let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
};

export interface ZipEntry { path: string; data: Uint8Array }

/** Собрать ZIP (store-метод) из списка файлов. Пути — «saves/Игра/Ник/card.json». */
export function makeZip(files: ZipEntry[]): Uint8Array {
  const enc = new TextEncoder();
  const now = new Date();
  const dosTime = w16((now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2));
  const dosDate = w16(((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate());
  const local: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.path);
    const crc = crc32(f.data);
    const size = f.data.length;
    const head = cat(
      w32(0x04034b50), w16(20), w16(0x0800), w16(0), dosTime, dosDate,
      w32(crc), w32(size), w32(size), w16(name.length), w16(0),
    );
    local.push(head, name, f.data);
    central.push(cat(
      w32(0x02014b50), w16(20), w16(20), w16(0x0800), w16(0), dosTime, dosDate,
      w32(crc), w32(size), w32(size), w16(name.length), w16(0), w16(0),
      w16(0), w16(0), w32(0), w32(offset),
      name,
    ));
    offset += head.length + name.length + size;
  }
  const cd = cat(...central);
  const eocd = cat(
    w32(0x06054b50), w16(0), w16(0), w16(files.length), w16(files.length),
    w32(cd.length), w32(offset), w16(0),
  );
  return cat(...local, cd, eocd);
}

/* ---------- base64 <-> байты (чанками: apply не любит десятки МБ аргументов) ---------- */

export function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export function bytesToB64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + 0x8000)) as unknown as number[]);
  return btoa(bin);
}

/* ---------- v0.179: ЧТЕНИЕ ЧУЖИХ ZIP-СЕЙВОВ ----------
   Сейвы других игроков (GameFAQs и подобные базы) скачиваются ZIP-архивом,
   внутри которого лежит файл сохранения (.srm/.sav/…). Кнопка «📥 Загрузка
   .srm/.sav» принимает и голый файл сохранения, и ZIP: разбор ZIP — чтение
   центрального каталога + распаковка deflate ШТАТНЫМ DecompressionStream
   браузера (без библиотек). Приоритет — файлы сохранений по расширению,
   читая ромы/картинки/мусор последними или никогда. */

export interface ZipExtractResult { name: string; data: Uint8Array }

/* расширения сохранений по приоритету: SRAM батарейки обычных систем →
   карты памяти → прочие NVRAM; .bin — последним (слишком общий) */
const SAVE_EXT_SCORE: [RegExp, number][] = [
  [/\.srm$/i, 10], [/\.sav$/i, 9], [/\.sa1$/i, 8], [/\.srm2$/i, 7],
  [/\.mcd$/i, 6], [/\.mcr$/i, 6], [/\.vmc$/i, 6], [/\.mc$/i, 5],
  [/\.eep$/i, 4], [/\.brm$/i, 4], [/\.nv$/i, 3], [/\.bin$/i, 2],
];
const saveExtScore = (name: string): number => {
  for (const [re, s] of SAVE_EXT_SCORE) if (re.test(name)) return s;
  return 0;
};
/* заведомо НЕ сохранения (ромы/архивы/картинки) — в fallback не берём */
const NOT_SAVE_RE = /\.(nes|md|gen|sms|gg|sfc|smc|fig|gb|gbc|gba|32x|a26|pce|zip|7z|rar|png|jpg|jpeg|gif|txt|pdf|exe|dll)$/i;
const MAX_SAVE_BYTES = 16 * 1024 * 1024; // сохранение не бывает 16 МБ — отсеиваем мусор

async function inflateRaw(raw: Uint8Array): Promise<Uint8Array> {
  const DS = (globalThis as { DecompressionStream?: typeof DecompressionStream }).DecompressionStream;
  if (!DS) throw new Error('этот браузер не умеет распаковывать ZIP — распакуйте архив вручную и выберите файл .srm/.sav');
  const stream = new Blob([raw as BlobPart]).stream().pipeThrough(new DS('deflate-raw'));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

/** Достать из ZIP-архива файл сохранения. Понимает store (0) и deflate (8);
 *  deflate разжимается штатным DecompressionStream (Chrome 103+/FF 113+).
 *  Бросает ошибку с человеческим текстом — её покажет тост. */
export async function extractSaveFromZip(buf: ArrayBuffer): Promise<ZipExtractResult> {
  const u8 = new Uint8Array(buf);
  const dv = new DataView(buf);
  // EOCD «PK\x05\x06» ищем с КОНЦА (после него бывает комментарий до 64 КБ)
  let eocd = -1;
  const stop = Math.max(0, u8.length - 22 - 65535);
  for (let i = u8.length - 22; i >= stop; i--) {
    if (u8[i] === 0x50 && u8[i + 1] === 0x4b && u8[i + 2] === 0x05 && u8[i + 3] === 0x06) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('это не ZIP-архив');
  const total = dv.getUint16(eocd + 10, true);
  if (!total) throw new Error('ZIP-архив пустой');
  let p = dv.getUint32(eocd + 16, true); // смещение центрального каталога
  const dec = new TextDecoder();
  let best: { name: string; data: Uint8Array } | null = null;
  let bestScore = 0;
  let seen = 0;
  for (let n = 0; n < total; n++) {
    if (p + 46 > u8.length || dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const crc = dv.getUint32(p + 16, true);
    const compSize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const cmtLen = dv.getUint16(p + 32, true);
    const localOff = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + cmtLen;
    seen++;
    if (name.endsWith('/') || compSize <= 0 || compSize > MAX_SAVE_BYTES) continue;
    // данные записи: локальный заголовок «PK\x03\x04» + свои длины имени/extra
    if (localOff + 30 > u8.length || dv.getUint32(localOff, true) !== 0x04034b50) continue;
    const lNameLen = dv.getUint16(localOff + 26, true);
    const lExtraLen = dv.getUint16(localOff + 28, true);
    const dStart = localOff + 30 + lNameLen + lExtraLen;
    if (dStart + compSize > u8.length) continue;
    const packed = u8.subarray(dStart, dStart + compSize);
    let data: Uint8Array;
    try {
      data = method === 0 ? packed : method === 8 ? await inflateRaw(packed) : null as unknown as Uint8Array;
    } catch (e) {
      throw e instanceof Error && /распаковывать ZIP/.test(e.message) ? e : new Error(`ZIP повреждён (запись «${name}»)`);
    }
    if (!data || !data.length) continue;
    if (crc && crc32(data) !== crc) throw new Error('ZIP повреждён — данные не совпали с контрольной суммой');
    const score = saveExtScore(name);
    if (score > bestScore && score > 0) { best = { name, data }; bestScore = score; }
    if (!best && !NOT_SAVE_RE.test(name)) best = { name, data }; // fallback: первый не-мусор
  }
  if (!seen) throw new Error('ZIP-архив пустой');
  if (!best) throw new Error('в архиве не нашлось файла сохранения (.srm/.sav) — распакуйте его вручную и выберите файл');
  return best;
}

/* ---------- имена для базы: папка репозитория и ZIP на устройстве ---------- */

/** Сегмент папки базы: Windows-нелегальные для пути символы → «_», края и
 *  служебные чистим, длину ограничиваем. Кириллица/пробела/скобки ОСТАЮТСЯ —
 *  GitHub и unzip их держат. Одна и та же функция работает при выгрузке (ZIP)
 *  и при поиске в базе — совпадение имён гарантировано. */
export function sanitizeRepoSeg(s: string): string {
  return (s || '')
    .replace(/[\\/:*?"<>|]/g, '_')
    // eslint-disable-next-line no-control-regex
    .replace(/[\x00-\x1f]/g, '')
    .replace(/_{2,}/g, '_')
    .replace(/^\.+/, '')
    .replace(/[. ]+$/, '')
    .trim()
    .slice(0, 80)
    .trim();
}

/** Скачать Blob как файл (кнопка выгрузки ZIP игроку/создателю). */
export function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
