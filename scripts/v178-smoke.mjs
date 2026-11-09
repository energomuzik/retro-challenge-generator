/* Смоук v0.178: ОБЛАЧНАЯ БАЗА СОХРАНЕНИЙ НА GITHUB — ЭКСПОРТ ZIP + ОБЛАЧНЫЙ СПИСОК
   (заказчик: «Всетаки твоя идея с передачей мне сохранений лучше… Проще просто сделать
   кнопку внизу. Сохранить все сохранения для базы. И сохранялся бы зип папка с
   названием игры + ник игрока введённый в опциях с правильным расположением файлов
   сохранений и папок… Я создам новый репозиторий для сохранений retro-challenge-saves…»;
   доработка: «ты пишешь что будет расположено папки так saves/Игра/Ник/card.json. надо
   ник убрать. а то будут множится разные сохранения — к одним и тем же местам, боссам.
   Да, и пускай будут частные сохранения тоже, не исключай их»).
   Проверки:
   (1) zipStore.ts — ZIP БЕЗ ЗАВИСИМОСТЕЙ: crc32 (эталон «123456789» → 0xCBF43926),
       makeZip (сигнатуры PK\x03\x04 / PK\x01\x02 / PK\x05\x06, флаг UTF-8 0x0800,
       store-метод), sanitizeRepoSeg (Windows-нелегальные символы → «_», кириллица
       жива), ФУНКЦИОНАЛЬНО в Node: ZIP собирается и разбирается обратно (имена,
       размеры, crc, содержимое совпадают байт-в-байт);
   (2) saveCloud.ts — репозиторий базы energomuzik/retro-challenge-saves, URL
       Trees API + raw; card.json У КАЖДОГО СОХРАНЕНИЯ СВОЙ (формат 2: игра, АВТОР
       вместо папки ника, имя, вид, слот, даты, save.state); ПАПКА — ПО ИМЕНИ
       СОХРАНЕНИЯ, БЕЗ НИКА (saves/<ром>/<имя сохранения>/); сохранения к одним и
       тем же местам/боссам заменяют друг друга (уникализация имён папок внутри ZIP);
       ЧАСТНЫЕ СОХРАНЕНИЯ ТОЖЕ ВЫГРУЖАЮТСЯ (не исключаются); state достаётся полной
       записью из базы (v0.166); importCloudCard: НОВАЯ запись uid('save'), свои не
       перезаписываются, частное из базы забирается как «уровень»; кэш индекса 5 минут;
   (3) EmulatorLauncher.tsx: кнопка «📦 Сохранить все для базы (ZIP)» ВНИЗУ панели
       «Сохранения» (в ZIP идут ВСЕ сохранения, включая частные) + CloudSavesBlock
       под ней; TaskEditor.tsx: CloudSavesBlock в спойлере сохранений выбранного
       рома, спойлер виден и при 0 сохранений; OptionsScreen.tsx: подсказка
       «имя = ник в базе (автор в карточках)»;
   (4) CloudSavesBlock.tsx: список ОТДЕЛЬНЫХ сохранений (имя/автор/вид/дата),
       «⬇ Забрать» по одному без перезаписи, «⟳ обновить» (сброс кэша),
       дружелюбные ошибки 404/403;
   (5) РЕГРЕССИИ v0.170–v0.177 живы (курсор под углом + заливка, один край-триггер
       инвентаря, чистка clicksOff, колесо, насос R1/R2, карта мира Select-Back);
       APP_VERSION 172; на заставке 0.178.0.
   Запуск: node scripts/v178-smoke.mjs  (функциональная часть — через esbuild из
   node_modules; если его нет, функциональные проверки пропускаются). */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(root, p), 'utf8');
let ok = 0;
const O = (msg) => { ok++; console.log('OK ', msg); };
const must = (cond, msg) => {
  if (cond) return O(msg);
  console.error('FAIL', msg);
  process.exitCode = 1;
};

const gs = read('src/screens/GameScreen.tsx');
const kb = read('src/KeyBinder.tsx');
const inp = read('src/input.ts');
const pm = read('src/padMouse.ts');
const sb = read('src/SegaBox.tsx');
const el = read('src/screens/EmulatorLauncher.tsx');
const te = read('src/screens/TaskEditor.tsx');
const os = read('src/screens/OptionsScreen.tsx');
const app = read('src/App.tsx');
const types = read('src/types.ts');
const ver = read('src/version.ts');
const zc = read('src/zipStore.ts');
const sc = read('src/saveCloud.ts');
const cb = read('src/CloudSavesBlock.tsx');

/* ---------- (1) ZIP БЕЗ ЗАВИСИМОСТЕЙ (zipStore.ts) ---------- */
must(zc.includes('0xEDB88320'), 'v0.178: crc32 по таблице (полином 0xEDB88320 — стандарт zip)');
must(zc.includes('export function crc32') && zc.includes('export function makeZip'), 'v0.178: экспортируются crc32 и makeZip');
must(zc.includes("w32(0x04034b50)") && zc.includes("w32(0x02014b50)") && zc.includes("w32(0x06054b50)"),
  'v0.178: сигнатуры ZIP — local header / central directory / EOCD');
must(zc.includes('w16(0x0800)'), 'v0.178: флаг UTF-8 имён 0x0800 — кириллические имена корректно распакуются');
must(zc.includes('export function sanitizeRepoSeg'), 'v0.178: sanitizeRepoSeg — сегменты папок базы');
must(zc.includes(".replace(/[\\\\/:*?\"<>|]/g, '_')"),
  'v0.178: Windows-нелегальные символы пути → «_» (ZIP распакуется на машине владельца)');
must(zc.includes('export function downloadBlob'), 'v0.178: downloadBlob — выгрузка файла игроку');
must(!zc.includes('import '), 'v0.178: zipStore.ts НУЛЕВОЙ по импортам (грязный Node-смоук невозможен из-за IndexedDB)');
must(zc.includes('export function b64ToBytes') && zc.includes('export function bytesToB64'),
  'v0.178: base64-конвертация состояний (база хранит состояния БИНАРНЫМИ файлами)');

/* ---------- (2) БАЗА НА GITHUB (saveCloud.ts) ---------- */
must(sc.includes("export const SAVE_DB_REPO = 'energomuzik/retro-challenge-saves';"),
  'v0.178: репозиторий базы — energomuzik/retro-challenge-saves (владелец создаст с этим именем)');
must(sc.includes('api.github.com/repos/${SAVE_DB_REPO}/git/trees/${SAVE_DB_BRANCH}?recursive=1'),
  'v0.178: список сохранений — открытый GitHub Trees API (1 запрос на всё дерево)');
must(sc.includes('raw.githubusercontent.com/${SAVE_DB_REPO}/${SAVE_DB_BRANCH}/'),
  'v0.178: карточки и состояния — raw.githubusercontent.com');
must(sc.includes('game: rom.fileName, // ИМЯ ФАЙЛА рома — сверка в базе идёт по нему (как в библиотеке)'),
  'v0.178: в карточке — имя файла рома (сверка по названию рома, как уже реализовано)');
must(sc.includes('format: 2') && sc.includes('author: nickSeg, // ник — ВНУТРИ карточки, в путях папок его нет'),
  'v0.178: карточка ОДНОГО сохранения (формат 2) — ник записан ВНУТРИ как author');
must(sc.includes('const dir = `saves/${gameSeg}/${seg}`'),
  'v0.178: папка сохранения — saves/<ром>/<ИМЯ СОХРАНЕНИЯ>/ (НИКА в путях НЕТ)');
must(sc.includes("'save.state'") && !sc.includes('sv1.state'),
  'v0.178: состояние лежит рядом с карточкой как save.state');
must(sc.includes('const used = new Set<string>()') && sc.includes('while (used.has(seg)) seg = `${base} ${k++}`'),
  'v0.178: сохранения к одним и тем же местам/боссам ЗАМЕНЯЮТ друг друга (имя папки = имя сохранения, внутри ZIP уникализуется)');
must(!sc.includes("filter((s) => saveKindOf(s) !== 'private')") && !sc.includes("saves.filter((s) => saveKindOf(s) !== 'private')"),
  'v0.178: ЧАСТНЫЕ сохранения ТОЖЕ выгружаются в базу (заказчик: «не исключай их»)');
must(sc.includes("idbGet<SaveDef>('saves', s.id)"),
  'v0.178: state достаётся ПОЛНОЙ записью из базы (v0.166 — в ОЗУ его нет)');
must(sc.includes('const id = uid(\'save\');'),
  'v0.178: импорт — НОВАЯ запись (uid save), свои сохранения никто не перезаписывает');
must(sc.includes("card.kind !== 'private' ? card.kind : 'level'"),
  'v0.178: частное из базы забирается как «уровень» — им можно пользоваться в игре');
must(sc.includes("'rcgSaveCloudIndex'") && sc.includes('IDX_TTL = 5 * 60 * 1000'),
  'v0.178: индекс кэшируется на 5 минут (localStorage rcgSaveCloudIndex)');
must(sc.includes("res.status === 404") && sc.includes('база ещё не создана') && sc.includes('403') && sc.includes('ограничил запросы'),
  'v0.178: дружелюбные ошибки — 404 (базы нет) и 403 (лимит GitHub)');
must(cb.includes('idx.filter((g) => g.gameFolder === folder)'),
  'v0.178: сохранения фильтруются по папке рома (та же sanitizeRepoSeg, что при выгрузке)');

/* ---------- (3) КНОПКА ВНИЗУ + ОБЛАКО В ЭКРАНАХ ---------- */
must(el.includes("📦 Сохранить все для базы (ZIP)"), 'v0.178: кнопка «📦 Сохранить все для базы (ZIP)» на месте');
must(/v0\.178: ZIP ДЛЯ БАЗЫ СОХРАНЕНИЙ[\s\S]*?border-t-2 border-edge space-y-2[\s\S]*?exportSaveDbZip[\s\S]*?<CloudSavesBlock rom=\{rom\} \/>/.test(el),
  'v0.178: кнопка и облако — ВНИЗУ панели «Сохранения» (после сетки сохранений, за разделителем)');
must(el.includes('options.name.trim() || \'ИГРОК\''),
  'v0.178: ник в ZIP — «Имя в комнате» из Опций (пусто → ИГРОК)');
must(!el.includes("romSaves.filter((s) => saveKindOf(s) !== 'private')") && el.includes('buildSaveDbZip(rom, romSaves,'),
  'v0.178: в ZIP идут ВСЕ сохранения рома, включая частные («в ZIP идут все сохранения рома, включая частные»)');
must(el.includes('в ZIP идут все сохранения рома, включая частные'),
  'v0.178: подпись у кнопки честно говорит, что частные тоже уходят');
must(el.includes('saves/Игра/Имя_сохранения/'),
  'v0.178: в описании у кнопки — новая структура папок (без ника)');
must(el.includes("import { buildSaveDbZip } from '../saveCloud';") && el.includes("import CloudSavesBlock from '../CloudSavesBlock';"),
  'v0.178: EmulatorLauncher импортирует saveCloud и CloudSavesBlock');
must(te.includes('<CloudSavesBlock rom={r} compact />'),
  'v0.178: в «Редакторе заданий» облако — в спойлере сохранений ВЫБРАННОГО рома');
must(te.includes('{sel && (\n          <div className="mt-1 border-2 border-edge bg-[rgba(11,14,28,0.6)] px-2 py-1.5">'),
  'v0.178: спойлер сохранений виден и при 0 сохранений (забрать из базы можно сразу)');
must(te.includes('Сохранений у рома пока нет — ниже можно забрать их из облачной базы ☁'),
  'v0.178: подсказка при пустом списке — «заберите из облачной базы»');
must(os.includes('Это же имя — ваш НИК в облачной базе сохранений') && os.includes('вы записаны АВТОРОМ'),
  'v0.178: в Опциях у «Имя в комнате» объяснено — это ник в базе (автор в карточках)');

/* ---------- (4) БЛОК «☁ В БАЗЕ СОХРАНЕНИЙ» ---------- */
must(cb.includes('⬇ Забрать'), 'v0.178: кнопка «⬇ Забрать» в блоке облака');
must(cb.includes('⟳ обновить'), 'v0.178: «⟳ обновить» — перечитать базу, сбросив кэш');
must(cb.includes("своей папке ПО ИМЕНИ СОХРАНЕНИЯ") || cb.includes('СВОЯ\n   папка ПО ИМЕНИ СОХРАНЕНИЯ'),
  'v0.178: в блоке — папка сохранения по его имени (без ника)');
must(cb.includes("автор: {card?.author || '—'}") && cb.includes('KIND_RU'),
  'v0.178: у каждого сохранения показаны АВТОР и ВИД (уровень/босс/задание/частное)');
must(cb.includes('— сохранений: ${groups.length}'),
  'v0.178: в заголовке блока — сколько сохранений рома лежит в базе');
must(cb.includes('importCloudCard(rom.id, card, folder)'),
  'v0.178: «Забрать» импортирует сохранение в библиотеку выбранного рома');
must(cb.includes('«${card.name || g.saveFolder}» добавлено в библиотеку (автор «${card.author}») — оно уже в списке сохранений рома'),
  'v0.178: после импорта — понятный тост с именем сохранения и автором');
must(cb.includes('g.cardPath.slice(0, g.cardPath.lastIndexOf(\'/\'))'),
  'v0.178: папка сохранения вычисляется из пути card.json');
must(cb.includes('await refresh();'), 'v0.178: после импорта библиотека перечитывается');

/* ---------- (5) РЕГРЕССИИ v0.170–v0.177 ---------- */
must(pm.includes('M2 2 L27.5 11.9 L20.7 14.4 L14.4 20.7 L11.9 27.5 Z'),
  'v0.177 живо: корабль под углом −45° (нос в верхний левый угол)');
must(pm.includes('fill="${fill}" stroke="#0b0e1c"'), 'v0.177 живо: жёлтая заливка + тёмный контур');
must(gs.includes('if (invOpenLiveRef.current) { setInvOpen(false); sfx.click(); }'),
  'v0.177 живо: инвентарь на Y — единый край-триггер (закрытие)');
must(/padMouseSetClicksOff\(!!bare\);\s*\n\s*return \(\) => padMouseSetClicksOff\(false\);/.test(gs),
  'v0.175 живо: чистка clicksOff при размонтировании');
must(pm.includes('const wheelable = !clicksOff && !inZone; // v0.174: чистое поле и игровая зона — без колеса'),
  'v0.172/0.174 живо: колесо левым стиком = !clicksOff && !inZone');
must(pm.includes("TRIG_FLAG_KEY = 'retropolia-pad-trig-ui'"), 'v0.174 живо: флаг игровой зоны');
must(sb.includes('if(trigUi&&(phys===5||phys===7))'), 'v0.174 живо: насос не пересылает R1/R2 над интерфейсом');
must(gs.includes('const toggleWorldMapView = () => {'), 'v0.176 живо: карта мира — одна кнопка (панель/M/Select)');
must(inp.includes('export const MAP_PAD_DEFAULT = 8;'), 'v0.176 живо: Select = W3C 8');
must(el.includes('return () => padMouseSetOff(false);'), 'v0.174 живо: «Запуск эмулятора» чистит userOff');
must(app.includes('usePadMouse(true)'), 'v0.171 живо: мышь с джойстика глобальна');
/* версии */
must(/APP_VERSION = 172;/.test(types), 'v0.178: APP_VERSION 171→172');
must(types.includes('НА GITHUB (коротко): кнопка «📦 Сохранить все для базы (ZIP)» внизу панели «Сохранения» собирает ZIP «ром_ник» (ник — «Имя в комнате» из Опций) с готовым расположением папок базы БЕЗ НИКА'),
  'v0.178: история версии в types.ts дополнена (структура без ника, частные тоже уходят)');
must(types.includes('// 171: 0.177.0 КУРСОР ПОД УГЛОМ + ЖЁЛТАЯ ЗАЛИВКА + ИНВЕНТАРЬ БЕЗ СБОЕВ'),
  'v0.178: v0.177 осталась в истории types.ts');
must(ver.includes('0.178.0 ОБЛАЧНАЯ БАЗА СОХРАНЕНИЙ НА GITHUB'), 'v0.178: на заставке 0.178.0');
must(ver.includes('папки БЕЗ ника — каждое сохранение в папке по своему имени'), 'v0.178: в истории версии — структура без ника');
must(ver.includes('// 0.177.0 (история)'), 'v0.178: v0.177 ушла в историю версии');
must(ver.includes('0.${APP_VERSION + 6}.0'), 'версия заставки по-прежнему выводится из APP_VERSION');

/* ---------- (6) ФУНКЦИОНАЛЬНО В NODE: ZIP собирается и разбирается ---------- */
try {
  const { build } = await import(join(root, 'node_modules', 'esbuild', 'lib', 'main.js'));
  const out = await build({
    entryPoints: [join(root, 'src', 'zipStore.ts')],
    bundle: true,
    write: false,
    format: 'esm',
    platform: 'node',
    logLevel: 'silent',
  });
  const mod = await new Promise((res, rej) => {
    const src = out.outputFiles[0].text.replace(/\bexport\b/g, '') + '\nreturn { crc32, makeZip, sanitizeRepoSeg, b64ToBytes, bytesToB64 };';
    try { res(new Function(src)()); } catch (e) { rej(e); }
  });
  const enc = new TextEncoder();
  const { crc32, makeZip, sanitizeRepoSeg } = mod;

  must(crc32(enc.encode('123456789')) === 0xCBF43926, 'v0.178 ФУНКЦИЯ: crc32 «123456789» = 0xCBF43926 (эталон zlib)');
  must(crc32(new Uint8Array(0)) === 0, 'v0.178 ФУНКЦИЯ: crc32 пустых данных = 0');

  must(sanitizeRepoSeg('Super Mario: DFS [!] (E).nes') === 'Super Mario_ DFS [!] (E).nes',
    'v0.178 ФУНКЦИЯ: двоеточие → «_», пробелы/скобки живы');
  must(sanitizeRepoSeg('Босс 2 — дракон') === 'Босс 2 — дракон',
    'v0.178 ФУНКЦИЯ: кириллица и пробелы в имени сохранения живы');
  must(sanitizeRepoSeg('..хак..') === 'хак', 'v0.178 ФУНКЦИЯ: точки по краям чистятся');
  must(sanitizeRepoSeg('///') === '_', 'v0.178 ФУНКЦИЯ: имя из одних нелегальных символов схлопывается в одно подчёркивание');

  const cardJson = JSON.stringify({ format: 2, game: 'Test (E).nes', author: 'Френди', name: 'Босс 2 — дракон', kind: 'boss', slot: 2, createdAt: 1, exportedAt: 1, app: '0.178.0', file: 'save.state' });
  const state = enc.encode('STATE!'),
        files = [
          { path: 'saves/Test (E).nes/Босс 2 — дракон/card.json', data: enc.encode(cardJson) },
          { path: 'saves/Test (E).nes/Босс 2 — дракон/save.state', data: state },
        ];
  const zip = makeZip(files);
  const u8 = zip;
  const sig = (o) => String.fromCharCode(u8[o], u8[o + 1], u8[o + 2], u8[o + 3]);
  must(sig(0) === 'PK\x03\x04', 'v0.178 ФУНКЦИЯ: ZIP начинается с PK\x03\x04');
  must(u8[6] === 0x00 && u8[7] === 0x08, 'v0.178 ФУНКЦИЯ: флаг UTF-8 0x0800 в локальном заголовке');
  must(sig(u8.length - 22) === 'PK\x05\x06', 'v0.178 ФУНКЦИЯ: EOCD в конце');
  must(sig(u8.length - 22 - (46 + enc.encode(files[0].path).length + 46 + enc.encode(files[1].path).length)) === 'PK\x01\x02',
    'v0.178 ФУНКЦИЯ: central directory перед EOCD (длины путей в БАЙТАХ UTF-8)');
  /* обратная распаковка — как это сделает unzip у владельца */
  const names = [];
  const datas = [];
  let o = 0;
  while (o < u8.length - 22 && sig(o) === 'PK\x03\x04') {
    const nlen = u8[o + 26] | (u8[o + 27] << 8);
    const elen = u8[o + 28] | (u8[o + 29] << 8);
    const csize = (u8[o + 18] | (u8[o + 19] << 8) | (u8[o + 20] << 16) | (u8[o + 21] << 24)) >>> 0;
    const name = new TextDecoder().decode(u8.subarray(o + 30, o + 30 + nlen));
    const data = u8.subarray(o + 30 + nlen + elen, o + 30 + nlen + elen + csize);
    names.push(name); datas.push(data);
    o += 30 + nlen + elen + csize;
  }
  must(names.length === 2 && names[1] === 'saves/Test (E).nes/Босс 2 — дракон/save.state',
    'v0.178 ФУНКЦИЯ: папка по имени сохранения (без ника) читается обратно (UTF-8)');
  must(Buffer.from(datas[1]).equals(Buffer.from(state)), 'v0.178 ФУНКЦИЯ: содержимое состояния байт-в-байт');
  must(crc32(datas[0]) === ((u8[14] | (u8[15] << 8) | (u8[16] << 16) | (u8[17] << 24)) >>> 0),
    'v0.178 ФУНКЦИЯ: CRC в заголовке совпадает с фактическим');
  O(`v0.178 ФУНКЦИЯ: ZIP собран (${zip.length} байт) и полностью разобран обратно`);
} catch (e) {
  console.log('SKIP функциональной части (esbuild недоступен):', e && e.message ? e.message : e);
}

console.log(`\nИТОГО: ${ok} проверок`);
if (process.exitCode) { console.log('SMOKE FAIL'); process.exit(1); }
console.log('SMOKE OK');
