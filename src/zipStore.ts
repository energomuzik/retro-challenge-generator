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
