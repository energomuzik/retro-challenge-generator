/* v0.161: РОМЫ С ЯНДЕКС.ДИСКА — ПУБЛИЧНАЯ ПАПКА С РОМСЕТОМ ИГРОКА/АВТОРА.
   Заказчик: «закинуть весь ромсет на яндекс диск, например весь ромсет goodnes
   в распакованном виде, плюс в той же папке картинки для обложек с теми же
   названиями, и текстовый файл spisok.txt, в котором перечислены все ромы…
   игрок вставляет ссылку в новое поле — проект сканирует spisok.txt и показывает
   названия всех ромов, как обычные ромы. Игрок нажимает на ром — проект скачивает
   этот ром в память браузера и, если есть картинка по тому же названию, берёт
   обложку — и игрок играет как обычно».

   КАК РАБОТАЕТ:
   • Папка на Диске: ромы в корне + обложки «<имя рома>.jpg» (или «имя без
     расширения.png») + spisok.txt (одна строка — одно имя файла рома).
   • СПИСОК: сперва пробуем spisok.txt (ОДИН запрос на весь список — идеи
     заказчика; тысячи ромов не стоят ни одного лишнего запроса листинга);
     нет файла или он пуст — автоскан папки через официальный API
     (/v1/disk/public/resources, страницы по 200, потолок 10 000 файлов):
     автоскан знает и размеры, и точные пути обложек.
   • ЗАПУСК: ром качается ТОЛЬКО по нажатию (прогресс в строке блока), и сразу
     становится ОБЫЧНЫМ ромом библиотеки (папка «Яндекс Диск», обложка, поля
     как у загруженного с диска) — сохранения, задания, экспорт игры работают
     без изменений, повторные запуски БЕЗ скачивания (ром уже в IndexedDB).
     Если ром с таким именем уже есть — качание не нужно вовсе.
   • ОБЛОЖКИ в списке — только у уже скачанных ромов (и локальных с тем же
     именем): мы НЕ долбим Яндекс запросом на каждую строку списка (тысяча
     строк = тысяча запросов — против идеи «меньше запросов»). Обложка
     подхватывается в момент скачивания рома и живёт в библиотеке.
   • ЦЕПОЧКА CORS — та же, что у ядер (проверена в v0.160 живой папкой):
     cloud-api.yandex.net → downloader.disk.yandex.ru (302) → mds.storage.yandex.net.
   • ЗАДАНИЯ КАРТ: TaskDef.romFile (имя файла рома задания) + GameMap.romsYandex
     (ссылка на папку) + RomDef.srcYandex (откуда ром приехал) — у другого игрока
     ром задания, которого нет в библиотеке, автоматически докачивается с папки
     (см. ensureTaskRom) — хост/соло; гостю ром привозит хост по needRom как раньше. */

import { uid, idbGet, idbPut } from './db';
import type { RomDef } from './types';
import { fetchYandexBuf, yandexResolveHref } from './yandexCores';
import { getRomData, useApp } from './store';

/* общие хелперы Яндекс API — потребителям удобнее брать их отсюда же */
export { fetchYandexBuf, yandexResolveHref };

const MB = 1024 * 1024;

/** Ключ localStorage с последней ссылкой игрока на папку ромов. */
export const YA_ROMS_LINK_KEY = 'rcgYaRomsLink';

/** Расширения ромов, которые понимает приложение (EmulatorJS + наши привычки). */
const ROM_EXT = ['nes', 'fds', 'unf', 'unif', 'sfc', 'smc', 'gb', 'gbc', 'gba', 'md', 'smd', 'gen', 'sms', 'gg', 'pce', 'sgx', 'a26', 'zip', '7z'];

/** Расширение рома по имени файла (null — не ром). */
export function romExtOf(name: string): string | null {
  const m = /\.([a-z0-9]+)$/i.exec(name.trim());
  if (!m) return null;
  const e = m[1].toLowerCase();
  return ROM_EXT.includes(e) ? e : null;
}

/** Имя рома без расширения («Abadox (J) [!].nes» → «Abadox (J) [!]»). */
export function romStemOf(name: string): string {
  return name.replace(/\.[a-z0-9]+$/i, '');
}

/** Имя картриджа для библиотеки: имя файла без расширения, компактнее некуда. */
export function romTitleOf(fileName: string): string {
  return romStemOf(fileName.split('/').pop() || fileName).slice(0, 80);
}

/* ---------- spisok.txt ---------- */

/** spisok.txt → список имён ромов. Кодировка: пробуем UTF-8; если в байтах
 *  не-UTF-8 (файл сделан «dir /b» на русской Windows — cp866/cp1251), повторяем
 *  windows-1251. Разделители строк — CRLF/LF/CR, пустые строки и «#» — мимо.
 *  Строка может быть с подпапкой («roms/Abadox.nes») — путь сохраняется. */
export function parseSpisok(bytes: ArrayBuffer): string[] {
  if (bytes.byteLength === 0 || bytes.byteLength > 8 * MB) return [];
  let txt = new TextDecoder('utf-8').decode(bytes);
  if (txt.includes('\uFFFD')) {
    try { txt = new TextDecoder('windows-1251').decode(bytes); } catch { /* остаётся utf-8 */ }
  }
  if (txt.charCodeAt(0) === 0xfeff) txt = txt.slice(1); // BOM
  return txt
    .split(/\r\n|\n|\r/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && !s.startsWith('#') && !!romExtOf(s));
}

/* ---------- сканирование папки ---------- */

export interface YaRomEntry {
  name: string; // имя файла рома (может с подпапкой — из spisok.txt)
  path: string; // путь внутри публичной папки для API («/имя»)
  size: number; // байты; 0 — неизвестен (spisok.txt размеров не даёт)
  coverPath?: string; // точный путь обложки (знает только автоскан)
}

const MAX_LIST = 10000; // потолок автоскана (хватило бы GoodNES с запасом)

/** Список ромов публичной папки: spisok.txt → иначе автоскан API-листингом. */
export async function scanYandexRoms(link: string, onNote?: (s: string) => void): Promise<YaRomEntry[]> {
  if (!link) return [];
  // 1) spisok.txt — идея заказчика: весь список одним файлом
  try {
    const href = await yandexResolveHref(link, 'spisok.txt');
    if (href) {
      const buf = await fetchYandexBuf(href, () => {});
      const names = parseSpisok(buf);
      if (names.length) {
        return names.map((n) => ({ name: n, path: n.startsWith('/') ? n : `/${n}`, size: 0 }));
      }
    }
  } catch { /* файл не скачался — уходим в автоскан */ }
  // 2) автоскан: страницы листинга по 200
  const out: YaRomEntry[] = [];
  const covers = new Map<string, string>();
  let offset = 0;
  for (;;) {
    const u = `https://cloud-api.yandex.net/v1/disk/public/resources?public_key=${encodeURIComponent(link)}&limit=200&offset=${offset}`;
    const r = await fetch(u);
    if (!r.ok) throw new Error(`list http ${r.status}`);
    const j = (await r.json()) as { _embedded?: { items?: { type?: string; name?: string; size?: number; path?: string }[]; total?: number } };
    const items = j._embedded?.items ?? [];
    for (const it of items) {
      if (it.type !== 'file' || !it.name) continue;
      const path = it.path ? it.path.split('disk:')[1] || it.path : `/${it.name}`;
      if (romExtOf(it.name)) out.push({ name: it.name, path, size: it.size ?? 0 });
      else if (/\.(png|jpe?g|webp)$/i.test(it.name)) covers.set(it.name.replace(/\.[a-z0-9]+$/i, ''), path);
    }
    const total = j._embedded?.total ?? 0;
    offset += items.length;
    onNote?.(`сканирую папку: ${offset}${total > 0 ? ` из ${total}` : ''}`);
    if (items.length < 200 || offset >= total || offset >= MAX_LIST) break;
  }
  for (const e of out) e.coverPath = covers.get(e.name) ?? covers.get(romStemOf(e.name));
  return out;
}

/* ---------- обложки ---------- */

/* Промахи обложек в рамках сессии: по одному разу на имя — повторных запросов нет. */
const coverMiss = new Set<string>();

/** Обложка рома: точный путь от автоскана или перебор кандидатов по имени
 *  («<ром>.jpg» — приём заказчика, затем «<имя без расширения>.png/jpg/webp»).
 *  Возвращает dataURL (он живёт в RomDef.cover библиотеки) или null. */
export async function fetchYandexCover(link: string, e: YaRomEntry): Promise<string | null> {
  if (!link) return null;
  const cands = e.coverPath
    ? [e.coverPath]
    : [`${e.name}.jpg`, `${e.name}.png`, `${e.name}.webp`, `${romStemOf(e.name)}.png`, `${romStemOf(e.name)}.jpg`, `${romStemOf(e.name)}.webp`];
  for (const c of cands) {
    const key = `${link}|${c}`;
    if (coverMiss.has(key)) continue;
    try {
      const href = await yandexResolveHref(link, c.replace(/^\//, ''));
      if (!href) { coverMiss.add(key); continue; }
      const buf = await fetchYandexBuf(href, () => {});
      if (buf.byteLength === 0 || buf.byteLength > 8 * MB) { coverMiss.add(key); continue; }
      return abToDataUrl(buf);
    } catch { coverMiss.add(key); }
  }
  return null;
}

function abToDataUrl(buf: ArrayBuffer): string {
  const u8 = new Uint8Array(buf);
  let bin = '';
  for (let i = 0; i < u8.length; i += 0x8000) bin += String.fromCharCode.apply(null, Array.from(u8.subarray(i, i + 0x8000)));
  const head = u8.length > 3 && u8[0] === 0x89 && u8[1] === 0x50 ? 'image/png' : 'image/jpeg';
  return `data:${head};base64,${btoa(bin)}`;
}

/* ---------- библиотека ---------- */

/** Ром с таким именем файла уже в библиотеке? (запуск без скачивания) */
export function findLocalRomByFile(roms: RomDef[], fileName: string): RomDef | undefined {
  const base = fileName.split('/').pop() || fileName;
  return roms.find((r) => r.fileName === base);
}

/** Записать скачанный с Яндекса ром как ОБЫЧНЫЙ ром библиотеки (папка
 *  «Яндекс Диск», обложка, srcYandex). forceId — id задания карты: ром
 *  записывается под ним, и все ссылки задания работают как родные.
 *  Возвращает id рома и признак «новый» (false = уже был). */
export async function saveYandexRomAsLocal(opts: {
  buf: ArrayBuffer;
  fileName: string;
  link: string;
  cover?: string | null;
  roms: RomDef[];
  forceId?: string;
}): Promise<{ romId: string; created: boolean }> {
  const fileName = opts.fileName.split('/').pop() || opts.fileName;
  // ром с таким id уже описан (деф без данных или с данными) — только доливаем данные
  if (opts.forceId) {
    const ex = opts.roms.find((r) => r.id === opts.forceId) ?? (await idbGet<RomDef>('roms', opts.forceId));
    if (ex) {
      await idbPut('blobs', `rom-${opts.forceId}`, opts.buf);
      if (opts.cover && !ex.cover) await idbPut('roms', opts.forceId, { ...ex, cover: opts.cover });
      return { romId: opts.forceId, created: false };
    }
  }
  const ext = (romExtOf(fileName) || fileName.split('.').pop() || 'bin').toLowerCase();
  const def: RomDef = {
    id: opts.forceId || uid('rom'), // forceId — id задания карты: ссылки карты работают как родные
    name: romTitleOf(fileName),
    fileName,
    ext,
    size: opts.buf.byteLength,
    createdAt: Date.now(),
    folder: 'Яндекс Диск',
    ...(opts.cover ? { cover: opts.cover } : {}),
    ...(opts.link ? { srcYandex: opts.link } : {}),
  };
  await idbPut('roms', def.id, def);
  await idbPut('blobs', `rom-${def.id}`, opts.buf);
  return { romId: def.id, created: true };
}

/* ---------- ром задания карты ---------- */

/** v0.161: ДОКАЧКА РОМА ЗАДАНИЯ С ЯНДЕКС.ДИСКА (хост/соло; гостю ром привозит
 *  хост по needRom). romFile — имя файла из TaskDef; link — ссылка папки из
 *  карты (GameMap.romsYandex), из srcYandex любого рома заданий или своя.
 *  Ром с этим именем уже в библиотеке — его байты копируются под id задания
 *  БЕЗ сети; нет — качается (и обложка в нагрузку). Возвращает данные или null. */
export async function ensureTaskRom(romId: string, romFile: string | undefined, link: string, onNote?: (s: string) => void): Promise<ArrayBuffer | null> {
  if (!romFile || !link) return null;
  onNote?.('Ром задания не в библиотеке — ищу на Яндекс Диске…');
  const st0 = useApp.getState();
  // 1) такой файл уже лежит в библиотеке (под любым id) — копируем байты без сети
  const local = findLocalRomByFile(st0.roms, romFile);
  if (local) {
    const d = await getRomData(local.id);
    if (d) {
      await saveYandexRomAsLocal({ buf: d, fileName: romFile, link, roms: st0.roms, forceId: romId });
      useApp.getState().refresh();
      return d;
    }
  }
  // 2) качаем с папки (+ обложка в нагрузку, промахи — без повторов)
  const href = await yandexResolveHref(link, romFile);
  if (!href) return null;
  const buf = await fetchYandexBuf(href, (got, total) => {
    const part = total > 0 ? `${Math.min(99, Math.floor((got * 100) / total))}%` : `${(got / MB).toFixed(1)} МБ`;
    onNote?.(`Качаю ром задания с Яндекс Диска — ${part}`);
  });
  if (buf.byteLength < 1024) return null; // обрыв/страница ошибки — не ром
  const cover = await fetchYandexCover(link, { name: romFile, path: `/${romFile}`, size: buf.byteLength });
  await saveYandexRomAsLocal({ buf, fileName: romFile, link, cover, roms: useApp.getState().roms, forceId: romId });
  useApp.getState().refresh();
  onNote?.('Ром задания скачан и добавлен в библиотеку');
  return buf;
}
