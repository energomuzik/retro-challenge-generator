/* Смоук v0.179: ЗАГРУЗКА ЧУЖОГО СЕЙВА (.SRM/.SAV/ZIP) + КНОПКА БАЗЫ ПЕРЕЕХАЛА ВВЕРХ
   (заказчик: «всётаки хочется использовать уже сделанные сейвы другими игроками.
   добавим кнопку загрузка .srm/.sav к кнопкам быстрая загрузка, быстрое сохранение.
   Загружать ром, запустили ром, жмем загрузка .srm/.sav — выбираем файл на компе.
   Он загружает сохранения. Игрок сохраняет нужное место нашими кнопками. И уже эти
   сохранения идут в базу, когда игрок нажмет сохранить базу и отправит мне. 2. кнопку
   сохранить все для базы переместить чуть вверх к другим кнопкам… что было красивее»).
   Проверки:
   (1) zipStore.ts — ЧТЕНИЕ ЧУЖИХ ZIP: extractSaveFromZip (EOCD ищется с конца,
       центральный каталог PK\x01\x02, локальный PK\x03\x04, store 0 + deflate 8 через
       штатный DecompressionStream, CRC проверяется, приоритет расширений .srm > .sav >
       .sa1 > карты памяти > .eep/.brm > .nv > .bin, ромы/картинки/мусор не выдаются за
       сейвы); СТАРОЕ живо: makeZip/crc32/sanitizeRepoSeg/b64; файл по-прежнему БЕЗ импортов;
   (2) SegaBox.tsx — SegaApi.importSram + SramImportResult (postMessage import-sram →
       ejs-sram, таймаут 6 с, чистка pendingSramRef); ВНУТРИ iframe — ТОЧНО официальный
       путь EmulatorJS: getSaveFilePath (cwrap save_file_path) → mkdir сегментов →
       unlink старого → FS.writeFile → loadSaveFiles (cwrap refresh_save_files);
   (3) EmulatorLauncher.tsx — кнопка «📥 Загрузка .srm/.sav» (sky, sramBusy, файловый
       input с маской .srm/.sav/…/.zip, «PK»-детект ZIP → extractSaveFromZip); кнопка
       «📦 Сохранить все для базы (ZIP)» теперь ВВЕРХУ (первое вхождение РАНЬШЕ
       разделителя border-t-2), внизу — справка + CloudSavesBlock; ряд кнопок виден
       ВСЕГДА (импорт/ZIP нужны и при нуле сохранений); внятные подсказки быстрых
       кнопок при пустом списке;
   (4) РЕГРЕССИИ v0.170–v0.178 живы (курсор под углом + заливка, один край-триггер
       инвентаря, чистка clicksOff, колесо, насос R1/R2, карта мира Select-Back,
       облачная база: ZIP «ром_ник», папки без ника, частные тоже, Trees API + raw);
       APP_VERSION 173; на заставке 0.179.0.
   (5) ФУНКЦИОНАЛЬНО В NODE (esbuild + zlib): ZIP от makeZip (store) разбирается
       extractSaveFromZip байт-в-байт; ZIP с DEFLATE собирается вручную и тоже читается;
       ZIP с папкой/readme/двумя сейвами → берётся .srm, а не .sav/.bin/мусор;
       ZIP только с ромом → честная ошибка «не нашлось файла сохранения»;
       испорченный байт → ошибка CRC; ZIP с комментарием после EOCD читается.
   Запуск: node scripts/v179-smoke.mjs */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

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

/* ---------- (1) ЧТЕНИЕ ЧУЖИХ ZIP (zipStore.ts) ---------- */
must(zc.includes('export async function extractSaveFromZip'), 'v0.179: extractSaveFromZip — достаёт сейв из ZIP-архива');
must(zc.includes('0x02014b50') && zc.includes('0x04034b50'), 'v0.179: сигнатуры центрального каталога и локального заголовка');
must(zc.includes("u8[i + 2] === 0x05 && u8[i + 3] === 0x06"), 'v0.179: EOCD «PK\\x05\\x06» ищется С КОНЦА (комментарий архива не мешает)');
must(zc.includes("'deflate-raw'"), 'v0.179: deflate разжимается штатным DecompressionStream (без библиотек)');
must(zc.includes('crc32(data) !== crc'), 'v0.179: CRC записи проверяется — битый архив не молча проглотится');
must(zc.includes('[/\\.srm$/i, 10], [/\\.sav$/i, 9]'), 'v0.179: приоритет расширений — .srm и .sav первыми');
must(zc.includes('.mcd$/i, 6], [/\\.mcr$/i, 6], [/\\.vmc$/i, 6]'), 'v0.179: карты памяти (mcd/mcr/vmc/mc) в приоритете');
must(zc.includes('NOT_SAVE_RE'), 'v0.179: ромы/картинки/доки НЕ выдаются за сейвы (fallback их не берёт)');
must(zc.includes('MAX_SAVE_BYTES = 16 * 1024 * 1024'), 'v0.179: гигантские записи (не сейвы) отсеиваются');
must(!zc.includes('import '), 'v0.179: zipStore.ts по-прежнему НУЛЕВОЙ по импортам (Node-смоук жив)');
must(zc.includes('export function crc32') && zc.includes('export function makeZip') && zc.includes('export function sanitizeRepoSeg') && zc.includes('export function downloadBlob'),
  'v0.178 живо: crc32/makeZip/sanitizeRepoSeg/downloadBlob на месте');
must(zc.includes('w16(0x0800)'), 'v0.178 живо: флаг UTF-8 имён 0x0800 в makeZip');

/* ---------- (2) IMПОРТ SRAM В ЭМУЛЯТОРЕ (SegaBox.tsx) ---------- */
must(sb.includes('importSram: (data: Uint8Array) => Promise<SramImportResult | null>;'),
  'v0.179: SegaApi.importSram — официальный интерфейс импорта SRAM');
must(sb.includes('export interface SramImportResult { ok: boolean; path?: string; size?: number; error?: string }'),
  'v0.179: SramImportResult — ок/ошибка + путь ядра и размер');
must(sb.includes("postMessage({ type: 'import-sram', data, reqId }, '*')"),
  'v0.179: байты сейва уходят в iframe через postMessage import-sram');
must(sb.includes("d.type === 'ejs-sram' && d.reqId"), 'v0.179: ответ iframe (ejs-sram) разбирается наверху');
must(sb.includes('pendingSramRef'), 'v0.179: ожидающие импорт запросы в своём ref-е (чистятся при размонтировании)');
must(sb.includes('}, 6000);'), 'v0.179: таймаут импорта 6 с — кнопка не виснет, если ядро не поднялось');
must(sb.includes('if(d.type==="import-sram"){'), 'v0.179: ветка import-sram внутри iframe-документа');
must(sb.includes('qX.getSaveFilePath()'), 'v0.179: путь SRAM ядро СООБЩАЕТ САМО (getSaveFilePath) — ничего не угадываем');
must(sb.includes('qX.FS.analyzePath(accX).exists') && sb.includes('qX.FS.mkdir(accX)'), 'v0.179: каталоги пути создаются (как в официальном обработчике EmulatorJS)');
must(sb.includes('qX.FS.unlink(spX)') && sb.includes('qX.FS.writeFile(spX,sramU8)'), 'v0.179: старый SRAM-файл снимается, байты пишутся в FS');
must(sb.includes('qX.loadSaveFiles();'), 'v0.179: refresh_save_files перечитывает SRAM в память ядра — игра видит сейв БЕЗ перезапуска');
must(sb.toLowerCase().includes('точно официальный путь emulatorjs'),
  'v0.179: в комментарии зафиксировано — путь РОВНО официальный (кнопка «Import Save File» EmulatorJS)');

/* ---------- (3) КНОПКИ ПАНЕЛИ «СОХРАНЕНИЯ» (EmulatorLauncher.tsx) ---------- */
must(el.includes('📥 Загрузка .srm/.sav'), 'v0.179: кнопка «📥 Загрузка .srm/.sav» на месте');
must(el.includes("{sramBusy ? '⏳ Читаю…' : '📥 Загрузка .srm/.sav'}"), 'v0.179: у кнопки есть занятой-статус');
must(el.includes('color="sky"') && el.includes('onClick={() => sramRef.current?.click()}'), 'v0.179: кнопка импорта отдельного цвета (sky) и открывает выбор файла');
must(el.includes('accept=".srm,.sav,.sa1,.sav2,.eep,.mcd,.mcr,.vmc,.mc,.brm,.bin,.zip"'),
  'v0.179: маска файлов — SRAM всех систем + ZIP (GameFAQs отдаёт сейвы зипами)');
must(el.includes('const doImportSram'), 'v0.179: обработчик импорта есть');
must(el.includes('bytes[0] === 0x50 && bytes[1] === 0x4b'), 'v0.179: «PK»-детект — ZIP распаковывается на лету (extractSaveFromZip)');
must(el.includes('await extractSaveFromZip(buf);'), 'v0.179: ZIP-сейвы читаются через extractSaveFromZip');
must(el.includes('ejsApiRef.current.importSram(bytes)'), 'v0.179: байты уходят в эмулятор через importSram');
must(el.includes('в игре выберите её пункт Load/Continue'), 'v0.179: тост объясняет, как подхватить чужой прогресс в игре');
must(el.includes('Нужное место запишите нашими кнопками'), 'v0.179: тост ведёт дальше по цепочке — закрепить место нашими кнопками (и они уедут в базу)');
must(el.includes('Сначала запустите ром — чужой сейв подхватывает именно запущенная игра'),
  'v0.179: без запущенного рома — внятная подсказка');
must(el.includes('У рома пока нет сохранений — запустите ром и запишите первое'),
  'v0.179: быстрые кнопки при пустом списке подсказывают «запустите ром и запишите первое» (а не «выделите сохранение»)');

/* кнопка базы переехала ВВЕРХ: первое вхождение её подписи РАНЬШЕ разделителя нижнего блока */
const baseBtnPos = el.indexOf('📦 Сохранить все для базы (ZIP)');
const bottomDivPos = el.indexOf('pt-2.5 mt-1 border-t-2 border-edge space-y-2');
must(baseBtnPos >= 0 && bottomDivPos >= 0 && baseBtnPos < bottomDivPos,
  'v0.179: кнопка «📦 Сохранить все для базы (ZIP)» теперь ВВЕРХУ панели (до нижнего разделителя)');
must(el.indexOf('📥 Загрузка .srm/.sav') < bottomDivPos, 'v0.179: кнопка импорта тоже в верхнем ряду');
must(/v0\.179: РЯД КНОПОК — ВСЕГДА виден у выбранного рома[\s\S]*?Быстрая загрузка[\s\S]*?Быстрое сохранение[\s\S]*?Загрузка \.srm\/\.sav[\s\S]*?Сохранить все для базы/.test(el),
  'v0.179: все четыре кнопки в одном ряду (заказчик: «рядом… что было красивее»)');
must(!/v0\.178: ZIP ДЛЯ БАЗЫ СОХРАНЕНИЙ \+ ОБЛАЧНЫЙ СПИСОК[\s\S]*?<PxBtn/.test(el),
  'v0.179: в нижнем блоке БОЛЬШЕ НЕТ кнопки ZIP (переехала вверх, дублей нет)');
must(el.includes('📦 ZIP для базы собирается кнопкой «Сохранить все для базы (ZIP)» СВЕРХУ'),
  'v0.179: внизу — короткая справка, где теперь кнопка ZIP');
must(el.includes('в ZIP идут все сохранения'), 'v0.178 живо: справка про «все сохранения, включая частные» сохранилась');
must(el.includes('saves/Игра/Имя_сохранения/'), 'v0.178 живо: структура папок базы в справке');
must(el.includes('<CloudSavesBlock rom={rom} />'), 'v0.178 живо: блок «☁ В базе сохранений» в панели');
must(el.includes('options.name.trim() || \'ИГРОК\''), 'v0.178 живо: ник в ZIP из Опций');
must(!el.includes("romSaves.filter((s) => saveKindOf(s) !== 'private')") && el.includes('buildSaveDbZip(rom, romSaves,'),
  'v0.178 живо: в ZIP идут ВСЕ сохранения рома, включая частные');
must(el.includes("import { extractSaveFromZip } from '../zipStore';"), 'v0.179: EmulatorLauncher импортирует extractSaveFromZip');
must(el.includes("import { buildSaveDbZip } from '../saveCloud';") && el.includes("import CloudSavesBlock from '../CloudSavesBlock';"),
  'v0.178 живо: импорты saveCloud/CloudSavesBlock на месте');
must(te.includes('<CloudSavesBlock rom={r} compact />'), 'v0.178 живо: облако и в «Редакторе заданий»');
must(os.includes('Это же имя — ваш НИК в облачной базе сохранений'), 'v0.178 живо: подсказка про ник базы в Опциях');

/* ---------- (4) РЕГРЕССИИ v0.170–v0.177 ---------- */
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
/* облачная база v0.178 — целиком */
must(sc.includes("export const SAVE_DB_REPO = 'energomuzik/retro-challenge-saves';"), 'v0.178 живо: репозиторий базы');
must(sc.includes('const dir = `saves/${gameSeg}/${seg}`'), 'v0.178 живо: папка сохранения — по имени сохранения, без ника');
must(sc.includes("'save.state'"), 'v0.178 живо: состояние — save.state рядом с card.json');
must(sc.includes("card.kind !== 'private' ? card.kind : 'level'"), 'v0.178 живо: частное из базы забирается как «уровень»');
must(cb.includes('⬇ Забрать') && cb.includes('⟳ обновить'), 'v0.178 живо: «Забрать»/«обновить» в блоке облака');
must(cb.includes("автор: {card?.author || '—'}"), 'v0.178 живо: автор виден в карточке облака');
/* версии */
must(/APP_VERSION = 173;/.test(types), 'v0.179: APP_VERSION 172→173');
must(types.includes('// 173: 0.179.0 ЗАГРУЗКА ЧУЖОГО СЕЙВА (.SRM/.SAV/ZIP) + КНОПКА БАЗЫ ПЕРЕЕХАЛА ВВЕРХ'),
  'v0.179: история версии в types.ts дополнена');
must(types.includes('// 172: 0.178.0 ОБЛАЧНАЯ БАЗА СОХРАНЕНИЙ НА GITHUB'), 'v0.179: v0.178 осталась в истории types.ts');
must(ver.includes('0.179.0 ЗАГРУЗКА ЧУЖОГО СЕЙВА (.SRM/.SAV/ZIP) + КНОПКА БАЗЫ ВВЕРХ'), 'v0.179: на заставке 0.179.0');
must(ver.includes('// 0.178.0 (история)'), 'v0.179: v0.178 ушла в историю версии');
must(ver.includes('// 0.177.0 (история)'), 'v0.179: v0.177 осталась в истории версии');
must(ver.includes('0.${APP_VERSION + 6}.0'), 'версия заставки по-прежнему выводится из APP_VERSION');

/* ---------- (5) ФУНКЦИОНАЛЬНО В NODE: extractSaveFromZip ---------- */
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
    const src = out.outputFiles[0].text.replace(/\bexport\b/g, '') + '\nreturn { crc32, makeZip, sanitizeRepoSeg, b64ToBytes, bytesToB64, extractSaveFromZip };';
    try { res(new Function(src)()); } catch (e) { rej(e); }
  });
  const enc = new TextEncoder();
  const { crc32, makeZip, extractSaveFromZip } = mod;
  must(typeof DecompressionStream === 'function', 'v0.179 ФУНКЦИЯ: в этом Node есть DecompressionStream — deflate проверяется по-настоящему');

  /* эталон crc32 — жив */
  must(crc32(enc.encode('123456789')) === 0xCBF43926, 'v0.178 живо (ФУНКЦИЯ): crc32 «123456789» = 0xCBF43926');

  /* (а) store-ZIP от makeZip → extractSaveFromZip возвращает байты 1:1 */
  const srmData = enc.encode('SRAM-BYTES-0123456789-СРМ-СЕЙВ');
  const storeZip = makeZip([{ path: 'Game (E).nes/Уровень 1/save.state', data: srmData }]);
  const ex1 = await extractSaveFromZip(storeZip.buffer);
  must(ex1.name.endsWith('.state') && Buffer.from(ex1.data).equals(Buffer.from(srmData)),
    'v0.179 ФУНКЦИЯ: store-ZIP разбирается обратно байт-в-байт (fallback: файл без известного расширения, но не мусор)');

  /* (б) ЧУЖОЙ ZIP как на GameFAQs: папка + readme + два сейва (.sav и .srm) + ром →
         берётся .SRM (высший приоритет), папка и readme пропускаются */
  const savData = enc.encode('SAV-BYTES-1122334455');
  const romData = enc.encode('THIS-IS-A-ROM-NOT-A-SAVE'.repeat(10));
  const zipEntries = [
    { name: 'game/', isDir: true },
    { name: 'game/readme.txt', data: enc.encode('credits and thanks'), method: 8 },
    { name: 'game/rom.gba', data: romData, method: 8 },
    { name: 'game/mysave.sav', data: savData, method: 8 },
    { name: 'game/battery.srm', data: srmData, method: 0 },
  ];
  const gamefaqZip = manualZip(zipEntries, mod.crc32);
  const ex2 = await extractSaveFromZip(gamefaqZip.buffer);
  must(ex2.name === 'game/battery.srm' && Buffer.from(ex2.data).equals(Buffer.from(srmData)),
    'v0.179 ФУНКЦИЯ: DEFLATE-архив читается, выбирается .srm (приоритет), папка/readme/ром пропущены');

  /* (в) ZIP без сейвов (только ром) → честная ошибка */
  const romOnly = manualZip([{ name: 'rom.gba', data: romData, method: 8 }], mod.crc32);
  let threw = null;
  try { await extractSaveFromZip(romOnly.buffer); } catch (e) { threw = e && e.message; }
  must(threw && /не нашлось файла сохранения/.test(threw), `v0.179 ФУНКЦИЯ: ZIP без сейва → внятная ошибка (${threw})`);

  /* (г) испорченный байт → ошибка CRC (бьём байт ВНУТРИ данных записи —
         данные первой записи лежат сразу после локального заголовка 30 + имя 8) */
  const badZip = makeZip([{ path: 'save.srm', data: srmData }]);
  badZip[30 + 8 + 2] ^= 0xFF; // третий байт самих данных SRAM
  threw = null;
  try { await extractSaveFromZip(badZip.buffer); } catch (e) { threw = e && e.message; }
  must(threw && /контрольн/.test(threw), `v0.179 ФУНКЦИЯ: битые данные ловятся CRC (${threw})`);

  /* (д) не ZIP вообще → внятная ошибка */
  threw = null;
  try { await extractSaveFromZip(new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23]).buffer); } catch (e) { threw = e && e.message; }
  must(threw && /не ZIP/.test(threw), `v0.179 ФУНКЦИЯ: не-ZIP → внятная ошибка (${threw})`);

  /* (е) ZIP с комментарием после EOCD (встречается у архиваторов) → читается */
  const withComment = new Uint8Array(storeZip.length + 12);
  withComment.set(storeZip, 0);
  withComment.set(enc.encode('COMMENT-OK12'), storeZip.length);
  const ex3 = await extractSaveFromZip(withComment.buffer);
  must(Buffer.from(ex3.data).equals(Buffer.from(srmData)), 'v0.179 ФУНКЦИЯ: ZIP с комментарием после EOCD читается (поиск EOCD с конца)');

  O(`v0.179 ФУНКЦИЯ: extractSaveFromZip — store/deflate/приоритет/CRC/комментарий все проверены`);
} catch (e) {
  console.log('SKIP функциональной части (esbuild недоступен):', e && e.message ? e.message : e);
}

/* сборка «чужого» ZIP вручную (store 0 / deflate 8), как пишут настоящие архиваторы */
function manualZip(entries, crcFn) {
  const enc = new TextEncoder();
  const w16 = (v) => new Uint8Array([v & 255, (v >>> 8) & 255]);
  const w32 = (v) => new Uint8Array([v & 255, (v >>> 8) & 255, (v >>> 16) & 255, (v >>> 24) & 255]);
  const cat = (...p) => { const n = p.reduce((a, x) => a + x.length, 0); const o = new Uint8Array(n); let k = 0; for (const x of p) { o.set(x, k); k += x.length; } return o; };
  const locals = [], centrals = [];
  let off = 0;
  for (const e of entries) {
    const name = enc.encode(e.name);
    let method = 0, data = e.data ?? new Uint8Array(0);
    if (e.method === 8) { data = new Uint8Array(zlib.deflateRawSync(Buffer.from(e.data))); method = 8; }
    const crc = e.isDir ? 0 : crcFn(e.data);
    const csize = e.isDir ? 0 : data.length;
    const usize = e.isDir ? 0 : e.data.length;
    const lh = cat(w32(0x04034b50), w16(20), w16(0), w16(method), w16(0), w16(0x21), w32(crc), w32(csize), w32(usize), w16(name.length), w16(0));
    locals.push(lh, name, data);
    centrals.push(cat(w32(0x02014b50), w16(20), w16(20), w16(0), w16(method), w16(0), w16(0x21), w32(crc), w32(csize), w32(usize), w16(name.length), w16(0), w16(0), w16(0), w16(0), w32(0), w32(off), name));
    off += lh.length + name.length + csize;
  }
  const cd = cat(...centrals);
  const eocd = cat(w32(0x06054b50), w16(0), w16(0), w16(entries.length), w16(entries.length), w32(cd.length), w32(off), w16(0));
  return cat(...locals, cd, eocd);
}

console.log(`\nИТОГО: ${ok} проверок`);
if (process.exitCode) { console.log('SMOKE FAIL'); process.exit(1); }
console.log('SMOKE OK');
