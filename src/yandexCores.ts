/* v0.160: РЕЗЕРВНАЯ ЗАГРУЗКА ЯДЕР С ЯНДЕКС.ДИСКА АВТОРА.
   У одного из игроков ядро эмулятора зависало на «0.0 mb» — большие файлы с сайта
   не доходили до браузера (регион/провайдер; у автора с компа, телефона и мобильного
   интернета всё работает). Решение заказчика: публичная папка с ядрами на его
   Яндекс.Диске — если ядро не качается с сайта, приложение САМО докачивает его с
   Яндекса и подкладывает в кэш EmulatorJS (IndexedDB EmulatorJS-core) — пересобранный
   эмулятор находит ядро в кэше мгновенно и не качает с сайта вовсе.
   ЦЕПОЧКА CORS ПРОВЕРЕНА (v0.160): cloud-api.yandex.net → downloader.disk.yandex.ru
   (302) → mds.storage.yandex.net — все хопы отдают Access-Control-Allow-Origin,
   финальный хост ещё и accept-ranges: bytes, поэтому fetch с прогрессом работает.

   Ссылку на папку дал автор (распакованный архив retro-cores → Яндекс.Диск →
   «Поделиться»): подключена в CORES_YANDEX_URL ниже. Пути внутри папки перебираются
   автоматически: «/<файл>» и «/cores/<файл>» — структура папки на Диске может быть
   любой из двух (реальная папка автора — файлы в корне, работает первый путь).
   ПО УМОЛЧАНИЮ РЕЗЕРВ ВЫКЛЮЧЕН (заказчик: «по дефолту пускай скачивание с яндекс
   диска пускай будет выключена») — включается галочкой в Опциях (блок «Ядро
   эмулятора»); когда ядро качается с сайта нормально, резерв ни при чём.

   ФОЛБЭК «АРХИВ ЦЕЛИКОМ» (v0.160): у Яндекса оказался глюк хранилища — 3 файла из
   18 (fceumm-legacy, gambatte-legacy, genesis_plus_gx) отдают «file IO failure:
   LRC groups are unavailable» (HTTP 500/503), причём ПЕРЕЗАЛИВКА ТЕХ ЖЕ БАЙТОВ
   (даже в новой папке) не лечит — дедупликация Диска ссылается на те же битые
   блоки. Лечение — файл С ДРУГИМИ БАЙТАМИ: автор залил в папку retro-cores-full.zip
   (md5 ecd9a5770861fc725d7b4feb5c056404) со ВСЕМИ 18 ядрами (METHOD STORE, имена
   плоские) — архив проверен живым скачиванием, байты ядер внутри = эталону;
   если прямой файл не качается, резерв качает
   этот архив ОДИН раз (~18 МБ, дальша — из кэша), распаковывает ПРЯМО В БРАУЗЕРЕ
   (свой мини-парсер ZIP без зависимостей, метод STORE) и подкладывает в кэш
   EmulatorJS СРАЗУ ВСЕ ядра — после одного архива covered любая консоль. */

/** Публичная ССЫЛКА на папку с ядрами на Яндекс.Диске автора (пусто = резерв неактивен). */
export const CORES_YANDEX_URL = 'https://disk.yandex.ru/d/wqEVrHVk-fPtOw';

/** Имя архива со всеми ядрами в той же папке (фолбэк для глючных файлов). */
export const CORES_ZIP_NAME = 'retro-cores-full.zip';

/** Резерв вообще доступен (ссылка подключена)? */
export function coresYandexReady(): boolean {
  return CORES_YANDEX_URL.length > 0;
}

/* Системное имя ядра (EJS_core) → имя файла ядра на сайте/Яндексе.
   Это ПЕРВЫЙ выбор из списка getCores() бандла EmulatorJS 4.2.3:
   nes→fceumm, snes→snes9x, gb/gbc→gambatte, gba→mgba, segaMD/segaCD/sega→genesis_plus_gx,
   segaMS→smsplus, segaGG→genesis_plus_gx, sega32x→picodrive, atari2600→stella2014, pce→mednafen_pce. */
const CORE_FILE: Record<string, string> = {
  nes: 'fceumm',
  snes: 'snes9x',
  gb: 'gambatte',
  gbc: 'gambatte',
  gba: 'mgba',
  segaMD: 'genesis_plus_gx',
  segaCD: 'genesis_plus_gx',
  sega: 'genesis_plus_gx',
  segaMS: 'smsplus',
  segaGG: 'genesis_plus_gx',
  sega32x: 'picodrive',
  atari2600: 'stella2014',
  pce: 'mednafen_pce',
};

/** Имя файла ядра для системного имени (null — неизвестная система, резерв не применим). */
export function coreFileFor(system: string): string | null {
  return CORE_FILE[system] ?? null;
}

/* buildStart из отчётов cores/reports/<core>.json — ровно та «версия», с которой
   EmulatorJS считает запись кэша валидной (i.version === e.buildStart).
   Зашиты из ТОЙ ЖЕ сборки, что и сами отчёты на сайте, поэтому всегда синхронны. */
const CORE_BUILD: Record<string, string> = {
  fceumm: '2025-06-14T17:55:31+00:00',
  gambatte: '2025-06-14T18:09:21+00:00',
  genesis_plus_gx: '2025-06-14T18:29:12+00:00',
  mednafen_pce: '2025-06-14T18:57:26+00:00',
  mgba: '2025-06-14T18:10:32+00:00',
  picodrive: '2025-06-14T18:38:00+00:00',
  smsplus: '2025-06-14T19:21:40+00:00',
  snes9x: '2025-06-14T17:58:11+00:00',
  stella2014: '2025-06-14T18:26:44+00:00',
};

/** Есть ли WebGL2: от него зависит, какой файл ядро запросит EmulatorJS —
 *  обычный «<core>-wasm.data» или «<core>-legacy-wasm.data» (без WebGL2). */
function hasWebgl2(): boolean {
  try {
    const c = document.createElement('canvas');
    return typeof window.WebGL2RenderingContext !== 'undefined' && !!c.getContext('webgl2');
  } catch { return false; }
}

/* ── IndexedDB: формат в точности как у EmulatorJS (EJS_STORAGE('EmulatorJS-core','core')) ── */

function idbOpen(): Promise<IDBDatabase> {
  return new Promise((res, rej) => {
    let rq: IDBOpenDBRequest;
    try {
      rq = indexedDB.open('EmulatorJS-core', 1);
    } catch (e) { rej(e); return; }
    rq.onupgradeneeded = () => {
      const db = rq.result;
      if (!db.objectStoreNames.contains('core')) db.createObjectStore('core');
    };
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error ?? new Error('idb open failed'));
    rq.onblocked = () => rej(new Error('idb blocked'));
  });
}

function idbPut(db: IDBDatabase, key: string, value: unknown): Promise<void> {
  return new Promise((res, rej) => {
    const tx = db.transaction(['core'], 'readwrite');
    tx.objectStore('core').put(value, key);
    tx.oncomplete = () => res();
    tx.onerror = () => rej(tx.error ?? new Error('idb put failed'));
    tx.onabort = () => rej(tx.error ?? new Error('idb put aborted'));
  });
}

/* Список ключей '?EJS_KEYS!' — EmulatorJS ведёт его в addFileToDB при каждом put.
   Добавляем наш файл, чтобы кэш был неотличим от «родного». */
async function idbEnsureKey(db: IDBDatabase, key: string): Promise<void> {
  try {
    const cur = await new Promise<unknown>((res) => {
      const tx = db.transaction(['core'], 'readonly');
      const rq = tx.objectStore('core').get('?EJS_KEYS!');
      rq.onsuccess = () => res(rq.result);
      rq.onerror = () => res(undefined);
    });
    const list = Array.isArray(cur) ? cur.slice() : [];
    if (!list.includes(key)) list.push(key);
    await idbPut(db, '?EJS_KEYS!', list);
  } catch { /* список — косметика: сам кэш уже записан */ }
}

/* ── Яндекс: резолв прямой ссылки + качание с прогрессом ── */

/** Прямая ссылка на файл в публичной папке: пробуем «/<файл>» и «/cores/<файл>» —
 *  автор может опубликовать как саму папку с ядрами, так и её родителя. */
async function resolveYandexHref(file: string): Promise<string | null> {
  for (const path of [`/${file}`, `/cores/${file}`]) {
    try {
      const u = `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=${encodeURIComponent(CORES_YANDEX_URL)}&path=${encodeURIComponent(path)}`;
      const r = await fetch(u, { method: 'GET' });
      if (!r.ok) continue;
      const j = (await r.json()) as { href?: unknown };
      if (j && typeof j.href === 'string' && j.href.length > 0) return j.href;
    } catch { /* следующий путь / отказ */ }
  }
  return null;
}

const MB = 1024 * 1024;

/** Качание по прямой ссылке с прогрессом; таймаут 120 с общий + «застряли без байт на 30 с». */
async function fetchYandexBuf(
  href: string,
  onProg: (gotBytes: number, totalBytes: number) => void,
): Promise<ArrayBuffer> {
  const ctrl = new AbortController();
  const lastT = { v: Date.now() };
  const hard = setTimeout(() => ctrl.abort(), 120000);
  const stall = setInterval(() => { if (Date.now() - lastT.v > 30000) ctrl.abort(); }, 5000);
  try {
    const r = await fetch(href, { signal: ctrl.signal });
    if (!r.ok) throw new Error(`http ${r.status}`);
    const total = Number(r.headers.get('content-length') || 0);
    if (!r.body) return await r.arrayBuffer();
    const reader = r.body.getReader();
    const chunks: Uint8Array[] = [];
    let got = 0;
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      if (value && value.length > 0) {
        chunks.push(value);
        got += value.length;
        lastT.v = Date.now();
        onProg(got, total);
      }
    }
    const out = new Uint8Array(got);
    let off = 0;
    for (const c of chunks) { out.set(c, off); off += c.length; }
    return out.buffer;
  } finally {
    clearTimeout(hard);
    clearInterval(stall);
  }
}

/* ── Сид одного файла в кэш EJS ── */

/** Запись буфера в кэш EJS с правильной версией (buildStart). */
async function seedBuf(coreFile: string, file: string, buf: ArrayBuffer): Promise<boolean> {
  if (buf.byteLength < 64 * 1024) return false; // ядро меньше 64 КБ не бывает — обрыв
  // версия записи: buildStart из отчёта (зашит); если неизвестен — спрашиваем отчёт с сайта
  let version = CORE_BUILD[coreFile];
  if (!version) {
    try {
      const base = document.baseURI.endsWith('/') ? document.baseURI : `${document.baseURI}/`;
      const r = await fetch(new URL(`emulatorjs/data/cores/reports/${coreFile}.json`, base).href);
      if (r.ok) {
        const j = (await r.json()) as { buildStart?: unknown };
        if (j && typeof j.buildStart === 'string') version = j.buildStart;
      }
    } catch { /* кэш без версии: сработает, если и отчёт у EJS не загрузился */ }
  }
  const db = await idbOpen();
  try {
    await idbPut(db, file, version ? { version, data: buf } : { data: buf });
    await idbEnsureKey(db, file);
  } finally {
    try { db.close(); } catch { /* noop */ }
  }
  return true;
}

async function seedOne(coreFile: string, file: string, onNote?: (note: string) => void): Promise<boolean> {
  onNote?.('⚡ РЕЗЕРВ: ЯНДЕКС ДИСК — ИЩУ ЯДРО…');
  const href = await resolveYandexHref(file);
  if (!href) return false;
  const buf = await fetchYandexBuf(href, (got, total) => {
    const part = total > 0
      ? `${Math.min(99, Math.floor((got * 100) / total))}%`
      : `${(got / MB).toFixed(1)} МБ`;
    onNote?.(`⚡ РЕЗЕРВ: ЯНДЕКС ДИСК — ${file.toUpperCase()} ${part}`);
  });
  return seedBuf(coreFile, file, buf);
}

/* ── ФОЛБЭК: архив со ВСЕМИ ядрами (retro-cores-full.zip, METHOD STORE) ──
   Мини-парсер ZIP (без зависимостей): только METHOD STORE (без сжатия) — наш архив
   собирается без дефляции, поэтому парсеру не нужен DecompressionStream.
   Возвращает пары «имя → данные» для всех файлов архива. */
export function unzipStoreForTest(buf: ArrayBuffer): { name: string; data: Uint8Array }[] {
  const u8 = new Uint8Array(buf);
  const dv = new DataView(buf);
  const sig = (off: number) => dv.getUint32(off, true);
  // End of Central Directory (0x06054b50) ищем с конца (комментариев у архива нет)
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 22 - 65535); i--) {
    if (sig(i) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('zip: нет EOCD');
  const count = dv.getUint16(eocd + 10, true);
  let off = dv.getUint32(eocd + 16, true);
  const out: { name: string; data: Uint8Array }[] = [];
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (sig(off) !== 0x02014b50) throw new Error('zip: битый central directory');
    const method = dv.getUint16(off + 10, true);
    const csize = dv.getUint32(off + 20, true);
    const nameLen = dv.getUint16(off + 28, true);
    const extraLen = dv.getUint16(off + 30, true);
    const commLen = dv.getUint16(off + 32, true);
    const lho = dv.getUint32(off + 42, true); // смещение local header
    const name = dec.decode(u8.subarray(off + 46, off + 46 + nameLen));
    off += 46 + nameLen + extraLen + commLen;
    if (method !== 0) throw new Error(`zip: метод ${method} не поддержан (нужен STORE)`);
    if (sig(lho) !== 0x04034b50) throw new Error('zip: битый local header');
    const lNameLen = dv.getUint16(lho + 26, true);
    const lExtraLen = dv.getUint16(lho + 28, true);
    const start = lho + 30 + lNameLen + lExtraLen;
    out.push({ name, data: u8.slice(start, start + csize) });
  }
  return out;
}

/* Один раз за сессию: качаем архив и сидируем ВСЕ ядра из него. Общий промис —
   параллельные вызовы (таймер + автоповтор) не качают архив дважды. */
let zipInflight: Promise<number> | null = null;

function seedAllFromZip(onNote?: (note: string) => void): Promise<number> {
  if (!zipInflight) {
    zipInflight = (async () => {
      onNote?.('⚡ РЕЗЕРВ: ЯНДЕКС ДИСК — АРХИВ ЯДЕР (обход глючных файлов)…');
      const href = await resolveYandexHref(CORES_ZIP_NAME);
      if (!href) return 0;
      const buf = await fetchYandexBuf(href, (got, total) => {
        const part = total > 0
          ? `${Math.min(99, Math.floor((got * 100) / total))}%`
          : `${(got / MB).toFixed(1)} МБ`;
        onNote?.(`⚡ РЕЗЕРВ: ЯНДЕКС ДИСК — АРХИВ ЯДЕР ${part}`);
      });
      if (buf.byteLength < 1024 * 1024) return 0; // архив ядер меньше МБ не бывает
      let entries: ReturnType<typeof unzipStoreForTest>;
      try { entries = unzipStoreForTest(buf); } catch { return 0; }
      let added = 0;
      for (const { name, data } of entries) {
        // только известные нам ядра: «<core>[-legacy]-wasm.data»
        const m = /^([a-z0-9_]+?)(-legacy)?-wasm\.data$/.exec(name);
        if (!m || !CORE_BUILD[m[1]]) continue;
        const file = name;
        if (seeded.has(file)) continue;
        try {
          if (await seedBuf(m[1], file, data.slice().buffer as ArrayBuffer)) {
            seeded.add(file);
            added++;
          }
        } catch { /* файл пропускаем */ }
      }
      return added;
    })().catch(() => 0);
  }
  return zipInflight;
}

/* Уже закэшировано в этой сессии (не качаем второй раз при перезапусках ядра). */
const seeded = new Set<string>();
/* Общие промисы: параллельные кики (таймер + автоповтор) не качают один файл дважды. */
const inflight = new Map<string, Promise<boolean>>();

/**
 * Докачать ядро системы с Яндекс.Диска автора и подложить в кэш EmulatorJS.
 * @param system  системное имя ядра (EJS_core): 'nes', 'segaMD'…
 * @param onNote  строка прогресса для оверлея загрузки («⚡ РЕЗЕРВ: … 42%»)
 * @returns сколько файлов реально докачано сейчас (0 = нечего делать или не вышло)
 */
export async function seedCoreFromYandex(system: string, onNote?: (note: string) => void): Promise<number> {
  const coreFile = coreFileFor(system);
  if (!CORES_YANDEX_URL || !coreFile) return 0;
  // EmulatorJS запрашивает обычный файл при WebGL2 и «-legacy» без него; качаем нужный первым,
  // второй — запасом (если первому не повезло или WebGL2 определился неверно).
  const plain = `${coreFile}-wasm.data`;
  const legacy = `${coreFile}-legacy-wasm.data`;
  const files = hasWebgl2() ? [plain, legacy] : [legacy, plain];
  const before = files.filter((f) => seeded.has(f)).length;
  for (const f of files) {
    if (seeded.has(f)) continue;
    let p = inflight.get(f);
    if (!p) {
      p = seedOne(coreFile, f, onNote);
      inflight.set(f, p);
    }
    let ok = false;
    try { ok = await p; } catch { ok = false; }
    inflight.delete(f);
    if (ok) { seeded.add(f); continue; }
    /* Прямой файл не вышел (глюк Яндекса «LRC groups» и т.п.) — фолбэк: архив со
       ВСЕМИ ядрами одним файлом (один раз за сессию), распаковка в браузере.
       После него сидировано всё, что смогло — оба наших файла добираем из seeded. */
    await seedAllFromZip(onNote);
  }
  return files.filter((f) => seeded.has(f)).length - before;
}

/** Тестовая сборка файлов ядра (для смоук-теста): какой качаем первым. */
export function coreSeedFilesForTest(system: string): string[] {
  const coreFile = coreFileFor(system);
  if (!coreFile) return [];
  const plain = `${coreFile}-wasm.data`;
  const legacy = `${coreFile}-legacy-wasm.data`;
  return hasWebgl2() ? [plain, legacy] : [legacy, plain];
}
