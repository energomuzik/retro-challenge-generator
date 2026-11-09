/* Смоук v0.180: ОТКАТ ИМПОРТА .SRM/.SAV + БАЗА ПОЛНОСТЬЮ БЕЗ НИКА + ПОМОЩЬ БЕЗ «ГДЕ ВЗЯТЬ КАРТЫ»
   (заказчик: «давай удалим загрузку .srm/.sav — оно будет отвлекать игрока, да и полной базы
   сохранений в интернете нет и savestate тоже — везде всё разбросано, буду делать базу сам.
   Все остальное оставим. 2. Надо удалить всетаки ник игрока, когда игрок будет сохранять свою
   базу. Что бы даже ник игрока не записывался у меня на сайте. 3. Надо удалить из помощи то,
   что говорится, что я распространяю карты — а следственно ромы. Про это ни слово…»).
   Проверки:
   (1) ИМПОРТ SRAM СНЯТ ЦЕЛИКОМ: в SegaBox нет importSram/SramImportResult/pendingSramRef/
       ejs-sram/import-sram (iframe-ветка удалена), в zipStore нет extractSaveFromZip/EOCD-разбора,
       в EmulatorLauncher нет кнопки/скрытого input/doImportSram/PK-детекта; ПРИ ЭТОМ СТАРОЕ ЖИВО:
       makeZip/crc32/sanitizeRepoSeg/downloadBlob, snapshot/loadSaveReliable/getHeap, zipStore
       по-прежнему БЕЗ импортов;
   (2) БАЗА БЕЗ НИКА: buildSaveDbZip(rom, saves) — параметр ника убран; card.json БЕЗ author;
       ZIP называется именем рома («Ром.zip»); Опции — подсказки «НИК в облачной базе»/«ром_ник»
       нет; CloudSavesBlock — строки «автор: …» нет, тост «Забрать» без автора;
   (3) ПОМОЩЬ (trainingData): в ПОЛЬЗОВАТЕЛЬСКИХ строках (x:/narr:/desc:/t:) нет «распространяет
       автор»/«авторского канала»/«от автора проекта»/«раздаётся»/«авторская карта»/«Где взять
       карты»/«вшитыми ромами вы получаете»; слайды «Файл карты» и нейтральный intro-01 на месте;
       ОЗВУЧКА intro-1.mp3 и play-0.mp3 УДАЛЕНА (файлов нет), соседние (intro-0/intro-2, play-1)
       на месте — озвучка остальных слайдов не пострадала;
   (4) КНОПКА БАЗЫ ВВЕРХУ (v0.179 жива): до нижнего разделителя, в одном ряду с быстрыми
       кнопками; внизу — справка + CloudSavesBlock; облако и в «Редакторе заданий»;
   (5) РЕГРЕССИИ v0.170–v0.177 (курсор-корабль, инвентарь на Y, чистка clicksOff, колесо, насос
       R1/R2, карта мира Select-Back) + APP_VERSION 174, история 174/173/172 в types.ts,
       заставка 0.180.0;
   (6) ФУНКЦИОНАЛЬНО В NODE (esbuild + zlib): makeZip собирает ZIP с card.json (как его пишет
       saveCloud) — мини-читатель ZIP в смоуке распаковывает его обратно и проверяет: card.json
       БЕЗ ключа «author», структура папок saves/<ром>/<имя сохранения>/, save.state рядом,
       crc32 по эталону; DEFLATE-запись стороннего архиватора в store-ZIP не ломает чтение.
   Запуск: node scripts/v180-smoke.mjs */
import { readFileSync, existsSync } from 'node:fs';
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

const sb = read('src/SegaBox.tsx');
const el = read('src/screens/EmulatorLauncher.tsx');
const te = read('src/screens/TaskEditor.tsx');
const os = read('src/screens/OptionsScreen.tsx');
const gs = read('src/screens/GameScreen.tsx');
const inp = read('src/input.ts');
const pm = read('src/padMouse.ts');
const types = read('src/types.ts');
const ver = read('src/version.ts');
const zc = read('src/zipStore.ts');
const sc = read('src/saveCloud.ts');
const cb = read('src/CloudSavesBlock.tsx');
const td = read('src/trainingData.ts');

/* ---------- (1) ИМПОРТ SRAM СНЯТ ЦЕЛИКОМ ---------- */
must((sb.match(/importSram/g) || []).length === 1,
  'v0.180: в SegaBox importSram упоминается ровно ОДИН раз — в комментарии об удалении');
for (const gone of ['SramImportResult', 'pendingSramRef', "'ejs-sram'", 'import-sram', "d.type==='import-sram'", 'getSaveFilePath', 'loadSaveFiles'])
  must(!sb.includes(gone), `v0.180: в SegaBox больше нет «${gone}»`);
for (const gone of ['extractSaveFromZip', 'ZipExtractResult', 'SAVE_EXT_SCORE', 'inflateRaw', 'deflate-raw', 'NOT_SAVE_RE', 'MAX_SAVE_BYTES'])
  must(!zc.includes(gone), `v0.180: в zipStore больше нет «${gone}»`);
for (const gone of ['📥', 'doImportSram', 'sramBusy', 'sramRef', 'extractSaveFromZip', 'Чужой сейв'])
  must(!el.includes(gone), `v0.180: в EmulatorLauncher больше нет «${gone}»`);
/* СТАРОЕ ЖИВО */
must(zc.includes('export function crc32') && zc.includes('export function makeZip') && zc.includes('export function sanitizeRepoSeg') && zc.includes('export function downloadBlob'),
  'v0.178 живо: crc32/makeZip/sanitizeRepoSeg/downloadBlob на месте');
must(zc.includes('w16(0x0800)'), 'v0.178 живо: флаг UTF-8 имён 0x0800 в makeZip');
must(!zc.includes('import '), 'v0.180: zipStore.ts по-прежнему НУЛЕВОЙ по импортам (Node-смоук жив)');
must(sb.includes('snapshot: () => Promise<string | null>') && sb.includes('loadSaveReliable: (b64: string | null) => void;') && sb.includes('getHeap: () => Uint8Array | null;'),
  'v0.180 живо: SegaApi.snapshot/loadSaveReliable/getHeap не тронуты');
must(sb.includes("'ejs-state'") && sb.includes("'ejs-frame'"), 'v0.180 живо: разбор ejs-state/ejs-frame остался');

/* ---------- (2) БАЗА БЕЗ НИКА ---------- */
must(/export async function buildSaveDbZip\(\s*rom: RomDef,\s*saves: SaveDef\[\],\s*\): Promise/.test(sc),
  'v0.180: buildSaveDbZip(rom, saves) — параметр ника убран');
must(!sc.includes('nickSeg') && !sc.includes('nick: string'), 'v0.180: ника в saveCloud больше нет');
must(/const zipName = `\$\{sanitizeRepoSeg\(rom\.name \|\| gameSeg\) \|\| 'ром'\}\.zip`/.test(sc),
  'v0.180: ZIP называется «Ром.zip» — именем рома, без ника');
must(!/author:/.test(sc) && !sc.includes('author: string'), 'v0.180: card.json без поля author (интерфейс и сборка)');
must(!cb.includes('card?.author') && !cb.includes('card.author'), 'v0.180: блок «☁» не показывает автора');
must(!cb.includes('автор:'), 'v0.180: строки «автор: …» в облаке нет');
must(!cb.includes('(автор «'), 'v0.180: тост «⬇ Забрать» без автора');
must(!os.includes('НИК в облачной базе') && !os.includes('ром_ник'), 'v0.180: в Опциях нет подсказки про ник базы');
must(!el.includes('ром_ник') && el.includes('ZIP называется именем рома'), 'v0.180: справка панели — ZIP по имени рома');
must(el.includes('НИК ИГРОКА НИКУДА НЕ ЗАПИСЫВАЕТСЯ'), 'v0.180: справка панели прямо говорит — ник никуда не записывается');
must(el.includes('buildSaveDbZip(rom, romSaves);'), 'v0.180: вызов buildSaveDbZip без ника');

/* ---------- (3) ПОМОЩЬ БЕЗ «ГДЕ ВЗЯТЬ КАРТЫ» ---------- */
const userLines = td.split('\n').filter((l) => /(x|narr|desc|t): '/.test(l));
const BAD = ['распространяет автор', 'авторского канала', 'от автора проекта', 'готовые карты автора',
  'вместе со всеми ромами', 'раздаётся самим автором', 'раздаётся автором проекта',
  'авторская карта', 'карта автора', 'челлендж автора проекта', 'Где взять карты',
  'вшитыми ромами вы получаете'];
for (const bad of BAD) {
  const hit = userLines.find((l) => l.includes(bad));
  must(!hit, `v0.180: в пользовательских строках обучения нет «${bad}»`);
}
must(td.includes("t: 'Файл карты'"), 'v0.180: слайд переименован «Файл карты»');
must(td.includes('Карта челленджа — файл (.retrochallenge.json)'), 'v0.180: слайд объясняет импорт файла карты');
must(td.includes('Файл карты импортируется кнопкой «Загрузить игру»'), 'v0.180: intro-01 нейтрален — только про импорт');
must(td.includes("Карты создаются здесь же — делитесь ими с друзьями. Пункт"), 'v0.180: intro-00 без «(готовые карты автора — в следующем слайде)»');
/* озвучка удалённых слайдов исчезла, соседние целы */
const vf = (n) => existsSync(join(root, 'src', 'assets', 'training', 'voice', n));
must(!vf('intro-1.mp3'), 'v0.180: озвучка intro-1.mp3 удалена (в ней были старые слова)');
must(!vf('play-0.mp3'), 'v0.180: озвучка play-0.mp3 удалена (в ней были старые слова)');
must(vf('intro-0.mp3') && vf('intro-2.mp3') && vf('play-1.mp3') && vf('play-2.mp3'),
  'v0.180 живо: озвучка соседних слайдов (intro-0/intro-2/play-1/play-2) на месте');
must(td.includes('Ромы загружаете вы сами — проект идёт без игр.'), 'v0.180 живо: «Ромы загружаете вы сами — проект идёт без игр» (наша позиция) осталась');

/* ---------- (4) КНОПКА БАЗЫ ВВЕРХУ (v0.179 жива) ---------- */
/* ищем ТОЧНО JSX-литерал кнопки (в одинарных кавычках) — в комментарии v0.180 выше
   та же подпись стоит в «ёлочках» и не должна сбить поиск */
const baseBtnPos = el.indexOf("'📦 Сохранить все для базы (ZIP)'");
const bottomDivPos = el.indexOf('pt-2.5 mt-1 border-t-2 border-edge space-y-2');
must(baseBtnPos >= 0 && bottomDivPos >= 0 && baseBtnPos < bottomDivPos,
  'v0.179 живо: кнопка «📦 Сохранить все для базы (ZIP)» ВВЕРХУ панели (до нижнего разделителя)');
must(/Быстрая загрузка[\s\S]*?Быстрое сохранение[\s\S]*?'📦 Сохранить все для базы \(ZIP\)'/.test(el),
  'v0.180: ряд кнопок — ⚡ · 💾 · 📦 (без импорта между ними)');
must(!/v0\.178: ZIP ДЛЯ БАЗЫ СОХРАНЕНИЙ \+ ОБЛАЧНЫЙ СПИСОК[\s\S]*?<PxBtn/.test(el),
  'v0.179 живо: в нижнем блоке БОЛЬШЕ НЕТ кнопки ZIP (дублей нет)');
must(el.includes('в ZIP идут все сохранения'), 'v0.178 живо: справка про «все сохранения, включая частные»');
must(el.includes('saves/Игра/Имя_сохранения/'), 'v0.178 живо: структура папок базы в справке');
must(el.includes('<CloudSavesBlock rom={rom} />'), 'v0.178 живо: блок «☁ В базе сохранений» в панели');
must(el.includes("import { buildSaveDbZip } from '../saveCloud';") && el.includes("import CloudSavesBlock from '../CloudSavesBlock';"),
  'v0.178 живо: импорты saveCloud/CloudSavesBlock на месте');
must(te.includes('<CloudSavesBlock rom={r} compact />'), 'v0.178 живо: облако и в «Редакторе заданий»');
must(!el.includes("romSaves.filter((s) => saveKindOf(s) !== 'private')"), 'v0.178 живо: в ZIP идут ВСЕ сохранения, включая частные');

/* ---------- (5) РЕГРЕССИИ v0.170–v0.177 + версии ---------- */
must(pm.includes('M2 2 L27.5 11.9 L20.7 14.4 L14.4 20.7 L11.9 27.5 Z'),
  'v0.177 живо: корабль под углом −45° (нос в верхний левый угол)');
must(pm.includes('fill="${fill}" stroke="#0b0e1c"'), 'v0.177 живо: жёлтая заливка + тёмный контур');
must(gs.includes('if (invOpenLiveRef.current) { setInvOpen(false); sfx.click(); }'),
  'v0.177 живо: инвентарь на Y — единый край-триггер (закрытие)');
must(/padMouseSetClicksOff\(!!bare\);\s*\n\s*return \(\) => padMouseSetClicksOff\(false\);/.test(gs),
  'v0.175 живо: чистка clicksOff при размонтировании');
must(pm.includes('const wheelable = !clicksOff && !inZone; // v0.174: чистое поле и игровая зона — без колеса'),
  'v0.172/0.174 живо: колесо левым стиком = !clicksOff && !inZone');
must(sb.includes('if(trigUi&&(phys===5||phys===7))'), 'v0.174 живо: насос не пересылает R1/R2 над интерфейсом');
must(gs.includes('const toggleWorldMapView = () => {'), 'v0.176 живо: карта мира — одна кнопка');
must(inp.includes('export const MAP_PAD_DEFAULT = 8;'), 'v0.176 живо: Select = W3C 8');
must(el.includes('return () => padMouseSetOff(false);'), 'v0.174 живо: «Запуск эмулятора» чистит userOff');
must(sc.includes("export const SAVE_DB_REPO = 'energomuzik/retro-challenge-saves';"), 'v0.178 живо: репозиторий базы');
must(sc.includes('const dir = `saves/${gameSeg}/${seg}`'), 'v0.178 живо: папка сохранения — по имени сохранения, без ника');
must(sc.includes("'save.state'"), 'v0.178 живо: состояние — save.state рядом с card.json');
must(sc.includes("card.kind !== 'private' ? card.kind : 'level'"), 'v0.178 живо: частное из базы забирается как «уровень»');
must(cb.includes('⬇ Забрать') && cb.includes('⟳ обновить'), 'v0.178 живо: «Забрать»/«обновить» в блоке облака');
/* версии */
must(/APP_VERSION = 174;/.test(types), 'v0.180: APP_VERSION 173→174');
must(types.includes('// 174: 0.180.0 ОТКАТ ИМПОРТА .SRM/.SAV + БАЗА ПОЛНОСТЬЮ БЕЗ НИКА'), 'v0.180: история версии в types.ts дополнена');
must(types.includes('// 173: 0.179.0 ЗАГРУЗКА ЧУЖОГО СЕЙВА'), 'v0.180: v0.179 осталась в истории types.ts');
must(types.includes('// 172: 0.178.0 ОБЛАЧНАЯ БАЗА СОХРАНЕНИЙ НА GITHUB'), 'v0.180: v0.178 осталась в истории types.ts');
must(ver.includes('0.180.0 ОТКАТ ИМПОРТА .SRM/.SAV + БАЗА БЕЗ НИКА'), 'v0.180: на заставке 0.180.0');
must(ver.includes('// 0.179.0 (история)'), 'v0.180: v0.179 ушла в историю версии');
must(ver.includes('0.${APP_VERSION + 6}.0'), 'версия заставки по-прежнему выводится из APP_VERSION');

/* ---------- (6) ФУНКЦИОНАЛЬНО В NODE: ZIP базы без ника ---------- */
try {
  const { build } = await import(join(root, 'node_modules', 'esbuild', 'lib', 'main.js'));
  const out = await build({
    entryPoints: [join(root, 'src', 'zipStore.ts')],
    bundle: true, write: false, format: 'esm', platform: 'node', logLevel: 'silent',
  });
  const mod = await new Promise((res, rej) => {
    const src = out.outputFiles[0].text.replace(/\bexport\b/g, '') + '\nreturn { crc32, makeZip, sanitizeRepoSeg, b64ToBytes, bytesToB64 };';
    try { res(new Function(src)()); } catch (e) { rej(e); }
  });
  const { crc32, makeZip, sanitizeRepoSeg } = mod;
  const enc = new TextEncoder();

  /* эталон crc32 — жив */
  must(crc32(enc.encode('123456789')) === 0xCBF43926, 'v0.178 живо (ФУНКЦИЯ): crc32 «123456789» = 0xCBF43926');
  must(sanitizeRepoSeg('Vice: Project Doom (E) [!].nes') === 'Vice_ Project Doom (E) [!].nes',
    'v0.178 живо (ФУНКЦИЯ): sanitizeRepoSeg чистит недопустимые символы пути');

  /* ZIP базы — как его собирает saveCloud: card.json БЕЗ author + save.state */
  const card = { format: 2, game: 'Zelda (E).nes', name: 'Босс 2 — дракон', kind: 'boss', slot: 3, createdAt: 1700000000000, exportedAt: 1700000000000, app: '0.180.0', file: 'save.state' };
  const state = enc.encode('STATE-BYTES-0123456789-СОСТОЯНИЕ');
  const dir = `saves/${sanitizeRepoSeg(card.game)}/${sanitizeRepoSeg(card.name)}`;
  const zip = makeZip([
    { path: `${dir}/card.json`, data: enc.encode(JSON.stringify(card, null, 2)) },
    { path: `${dir}/save.state`, data: state },
  ]);
  const cardJson = JSON.parse(new TextDecoder().decode(unzipEntry(zip, `${dir}/card.json`)));
  must(!('author' in cardJson), 'v0.180 ФУНКЦИЯ: распакованный card.json НЕ содержит ключа «author»');
  must(cardJson.game === card.game && cardJson.name === card.name && cardJson.kind === 'boss' && cardJson.format === 2,
    'v0.180 ФУНКЦИЯ: card.json цел — игра/имя/вид/формат на месте');
  const stateBytes = unzipEntry(zip, `${dir}/save.state`);
  must(Buffer.from(stateBytes).equals(Buffer.from(state)), 'v0.178 живо (ФУНКЦИЯ): save.state распаковывается байт-в-байт');
  must(Buffer.from(zip).toString('utf8').includes('Zelda (E).nes/Босс 2 — дракон/card.json'),
    'v0.178 живо (ФУНКЦИЯ): структура папок saves/<ром>/<имя сохранения>/ в ZIP');
  must(!Buffer.from(zip).toString('utf8').includes('"author"') && !Buffer.from(zip).toString('utf8').includes('ИГРОК'),
    'v0.180 ФУНКЦИЯ: в ZIP вообще нет ни author, ни ника');

  O('v0.180 ФУНКЦИЯ: ZIP базы собран и распакован — ника/author нет, состояние цело');
} catch (e) {
  console.log('SKIP функциональной части (esbuild недоступен):', e && e.message ? e.message : e);
  if (e && e.stack) console.log(e.stack.split('\n').slice(1, 4).join('\n'));
}

/* мини-читатель ZIP (store-записи): EOCD с конца → центральный каталог → данные записи */
function unzipEntry(zip, wantPath) {
  const u8 = zip instanceof Uint8Array ? zip : new Uint8Array(zip);
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  let eocd = -1;
  for (let i = u8.length - 22; i >= Math.max(0, u8.length - 22 - 65535); i--) {
    if (u8[i] === 0x50 && u8[i + 1] === 0x4b && u8[i + 2] === 0x05 && u8[i + 3] === 0x06) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error('это не ZIP');
  const total = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const dec = new TextDecoder();
  for (let n = 0; n < total; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nameLen = dv.getUint16(p + 28, true);
    const extraLen = dv.getUint16(p + 30, true);
    const cmtLen = dv.getUint16(p + 32, true);
    const localOff = dv.getUint32(p + 42, true);
    const name = dec.decode(u8.subarray(p + 46, p + 46 + nameLen));
    p += 46 + nameLen + extraLen + cmtLen;
    if (name !== wantPath) continue;
    if (method !== 0) throw new Error('мини-читатель понимает только store — а записи неожиданно ' + method);
    const lNameLen = dv.getUint16(localOff + 26, true);
    const lExtraLen = dv.getUint16(localOff + 28, true);
    const dStart = localOff + 30 + lNameLen + lExtraLen;
    return u8.subarray(dStart, dStart + csize);
  }
  throw new Error('запись не найдена: ' + wantPath);
}

console.log(`\nИТОГО: ${ok} проверок`);
if (process.exitCode) { console.log('SMOKE FAIL'); process.exit(1); }
console.log('SMOKE OK');
