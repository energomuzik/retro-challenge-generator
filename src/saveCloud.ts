/* v0.178: ОБЛАЧНАЯ БАЗА СОХРАНЕНИЙ НА GITHUB (отдельный репозиторий).
   Как это устроено (решение заказчика — «план почти такой же, только убираем
   самостоятельный деплой игроку»):
   1) Создатель жмёт «📦 Сохранить все для базы (ZIP)» в панели «Сохранения»
      в «Запуске эмулятора» — собирается ZIP с именем рома с ПРАВИЛЬНЫМ
      РАСПОЛОЖЕНИЕМ ПАПОК базы. ПАПКИ — БЕЗ НИКА (заказчик: «надо ник убрать,
      а то будут множиться разные сохранения — к одним и тем же местам, боссам»):
      У КАЖДОГО СОХРАНЕНИЯ СВОЯ ПАПКА ПО ЕГО ИМЕНИ
      saves/<ром>/<имя сохранения>/card.json + save.state. Два сохранения «к одному
      и тому же месту/боссу» называются одинаково → при распаковке заменяют друг
      друга, а не множатся. v0.180: НИКА НЕТ ВООБЩЕ (заказчик: «надо удалить
      всетаки ник игрока, когда игрок будет сохранять свою базу. Что бы даже ник
      игрока не записывался у меня на сайте») — ни в имени ZIP-файла, ни в
      карточках (поле author убрано). Частные сохранения ТОЖЕ уходят в базу
      (заказчик: «пускай будут частные сохранения тоже, не исключай их»).
   2) ZIP передаётся владельцу проекта любым мессенджером.
   3) Владелец распаковывает его в папку своего репозитория базы
      retro-challenge-saves и пушит (git add/commit/push) — единожды на пачку ZIP,
      без какого-либо сайта и ввода ников у игрока.
   4) Игра НАХОДИТ сохранения в базе по имени файла рома (та же сверка, что уже
      реализована для локальной библиотеки и Яндекса — findLocalRomByFile) и
      показывает их в «Запуске эмулятора» и «Редакторе заданий»; «⬇ Забрать»
      добавляет сохранение в библиотеку устройства, ничего не перезаписывая.

   Техника: список — открытый GitHub Trees API (1 запрос, кэш 5 минут в
   localStorage), карточки и файлы состояний — raw.githubusercontent.com. Ключей,
   токенов и паролей НЕТ и не нужно: репозиторий публичный. CORS у GitHub
   открытый — работаёт прямо со страницы GitHub Pages. */

import type { RomDef, SaveDef, SaveKind } from './types';
import { saveKindOf } from './types';
import { idbGet, idbPut, uid } from './db';
import { makeZip, b64ToBytes, bytesToB64, sanitizeRepoSeg, downloadBlob, type ZipEntry } from './zipStore';
import { VERSION } from './version';

/* Репозиторий базы сохранений — ВЛАДЕЛЕЦ СОЗДАЁТ ЕГО на github.com ровно с таким
   именем (Public). Если когда-нибудь переименует — правится только эта строка. */
export const SAVE_DB_REPO = 'energomuzik/retro-challenge-saves';
export const SAVE_DB_BRANCH = 'main';

export const saveDbTreeUrl = () =>
  `https://api.github.com/repos/${SAVE_DB_REPO}/git/trees/${SAVE_DB_BRANCH}?recursive=1`;
export const saveDbRawUrl = (path: string) =>
  `https://raw.githubusercontent.com/${SAVE_DB_REPO}/${SAVE_DB_BRANCH}/${path.split('/').map(encodeURIComponent).join('/')}`;

/* ---------- карточка ОДНОГО сохранения (card.json в его папке) ---------- */

export interface CloudCard {
  format: 2;
  game: string; // ИМЯ ФАЙЛА рома («Super Mario Bros. (E) [!].nes») — по нему идёт сверка
  /* v0.180: поля author больше НЕТ — ник игрока никуда не записывается */
  name: string; // человеческое имя сохранения («Босс 2 — дракон»)
  kind?: SaveKind; // уровень/босс/моё задание/частное (частные тоже выгружаются)
  slot: number;
  createdAt: number;
  exportedAt: number;
  app: string;
  file: string; // имя файла состояния рядом с карточкой («save.state»)
}

/* ---------- индекс базы: какие сохранения и для каких игр лежат ---------- */

export interface CloudSaveGroup {
  gameFolder: string; // сегмент папки игры («Super Mario Bros. (E) [!].nes»)
  saveFolder: string; // сегмент папки сохранения (по имени сохранения — без ника)
  cardPath: string; // путь card.json от корня базы
}

const IDX_KEY = 'rcgSaveCloudIndex';
const IDX_TTL = 5 * 60 * 1000; // 5 минут — деревья у GitHub кэшируются и так

/** Список сохранений базы. force — сбросить кэш и перечитать с GitHub. */
export async function fetchCloudIndex(force = false): Promise<CloudSaveGroup[]> {
  if (!force) {
    try {
      const raw = localStorage.getItem(IDX_KEY);
      if (raw) {
        const c = JSON.parse(raw) as { ts: number; groups: CloudSaveGroup[] };
        if (Date.now() - c.ts < IDX_TTL && Array.isArray(c.groups)) return c.groups;
      }
    } catch { /* битый кэш — просто перечитаем */ }
  }
  const res = await fetch(saveDbTreeUrl(), { headers: { Accept: 'application/vnd.github+json' } });
  if (!res.ok) {
    if (res.status === 404) throw new Error('база ещё не создана на GitHub (404)');
    if (res.status === 403) throw new Error('GitHub временно ограничил запросы — подождите несколько минут (403)');
    throw new Error(`GitHub ответил ${res.status}`);
  }
  const tree = (await res.json()) as { tree?: { path?: string }[] };
  const groups: CloudSaveGroup[] = [];
  const seen = new Set<string>();
  for (const it of tree.tree ?? []) {
    const m = /^saves\/([^/]+)\/([^/]+)\/card\.json$/.exec(it.path || '');
    if (!m) continue;
    if (seen.has(m[0])) continue;
    seen.add(m[0]);
    groups.push({ gameFolder: m[1], saveFolder: m[2], cardPath: m[0] });
  }
  try { localStorage.setItem(IDX_KEY, JSON.stringify({ ts: Date.now(), groups })); } catch { /* приватный режим */ }
  return groups;
}

/** Карточка сохранения — маленький JSON с именем/датой (само состояние
 *  качается ТОЛЬКО при «⬇ Забрать»). */
export async function fetchCloudCard(cardPath: string): Promise<CloudCard> {
  const res = await fetch(saveDbRawUrl(cardPath));
  if (!res.ok) throw new Error(`GitHub ответил ${res.status}`);
  const j = (await res.json()) as CloudCard;
  if (!j || typeof j.game !== 'string' || !j.file) throw new Error('карточка сохранения повреждена');
  return j;
}

/* ---------- ЭКСПОРТ: ZIP для базы ---------- */

const KINDS_OK: SaveKind[] = ['level', 'boss', 'mytask', 'private'];

/** Собрать и скачать ZIP со ВСЕМИ сохранениями рома (включая частные). Внутри —
 *  готовое расположение папок базы: saves/<ром>/<имя сохранения>/card.json + save.state.
 *  Папка называется ИМЕНЕМ СОХРАНЕНИЯ (без ника — так сохранения «к одному и тому
 *  же месту/боссу» заменяют друг друга, а не множатся). v0.180: НИКА НЕТ НИГДЕ —
 *  ни в имени ZIP, ни в карточках (author убран; заказчик: «что бы даже ник
 *  игрока не записывался у меня на сайте»). Владелец распаковывает ZIP прямо
 *  в папку репозитория — и всё лежит как надо. */
export async function buildSaveDbZip(
  rom: RomDef,
  saves: SaveDef[],
): Promise<{ fileName: string; blob: Blob; count: number }> {
  /* v0.166: state живёт ТОЛЬКО в базе (в ОЗУ лёгкие записи) — достаём полные.
     Частные НЕ исключаем (заказчик: «пускай будут частные сохранения тоже»). */
  const fulls = (await Promise.all(saves.map((s) => idbGet<SaveDef>('saves', s.id))))
    .filter((s): s is SaveDef => !!s && typeof s.state === 'string' && !!s.state && s.state.length > 0);
  if (!fulls.length) throw new Error('нет сохранений с состоянием');
  const gameSeg = sanitizeRepoSeg(rom.fileName) || 'rom';
  const files: ZipEntry[] = [];
  const used = new Set<string>(); // имена папок уникальны внутри одного ZIP
  fulls.forEach((s, i) => {
    const name = ((s.name || '').trim() || `Сохранение ${i + 1}`).slice(0, 60);
    const base = sanitizeRepoSeg(name) || `Сохранение ${i + 1}`;
    let seg = base;
    let k = 2;
    while (used.has(seg)) seg = `${base} ${k++}`; // два сохранения с одним именем в одном ZIP
    used.add(seg);
    const dir = `saves/${gameSeg}/${seg}`;
    const card: CloudCard = {
      format: 2,
      game: rom.fileName, // ИМЯ ФАЙЛА рома — сверка в базе идёт по нему (как в библиотеке)
      /* v0.180: author УБРАН — ник игрока никуда не записывается */
      name,
      kind: s.kind && KINDS_OK.includes(s.kind) ? s.kind : 'level',
      slot: typeof s.slot === 'number' ? s.slot : i + 1,
      createdAt: s.createdAt || Date.now(),
      exportedAt: Date.now(),
      app: VERSION,
      file: 'save.state',
    };
    files.push({ path: `${dir}/card.json`, data: new TextEncoder().encode(JSON.stringify(card, null, 2)) });
    files.push({ path: `${dir}/save.state`, data: b64ToBytes(s.state as string) });
  });
  const zip = makeZip(files);
  const zipName = `${sanitizeRepoSeg(rom.name || gameSeg) || 'ром'}.zip`; // v0.180: без ника
  const blob = new Blob([zip as unknown as BlobPart], { type: 'application/zip' });
  downloadBlob(blob, zipName);
  return { fileName: zipName, blob, count: fulls.length };
}

/* ---------- ИМПОРТ: «⬇ Забрать» из базы в библиотеку устройства ---------- */

/** Добавить ОДНО сохранение из базы в локальную библиотеку (новая запись, свои
 *  не перезаписываются). folderPath — папка сохранения в базе
 *  («saves/<ром>/<имя сохранения>»). Частное из базы забирается как «уровень» —
 *  чтобы им можно было пользоваться в игре. */
export async function importCloudCard(romId: string, card: CloudCard, folderPath: string): Promise<number> {
  try {
    const res = await fetch(saveDbRawUrl(`${folderPath}/${card.file || 'save.state'}`));
    if (!res.ok) return 0;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (!bytes.length) return 0;
    const state = bytesToB64(bytes);
    const id = uid('save');
    const kind = card.kind && KINDS_OK.includes(card.kind) && card.kind !== 'private' ? card.kind : 'level';
    await idbPut('saves', id, {
      id,
      romId,
      slot: typeof card.slot === 'number' && card.slot > 0 ? card.slot : 1,
      name: ((card.name || 'Из базы').trim() || 'Из базы').slice(0, 60),
      kind,
      state,
      stateSize: state.length,
      createdAt: card.createdAt || Date.now(),
    } satisfies SaveDef);
    return 1;
  } catch { /* файл не открылся — ничего не добавляем */ return 0; }
}
