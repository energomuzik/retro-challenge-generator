/* Смоук v0.176: КНОПКА «КАРТА МИРА — БЫСТРЫЙ ВЫЗОВ»
   (заказчик: «забыл добавь в кнопки управления кнопку быстрого вызова карты мира.
   пусть на джое это будет select и аналог иксбокса»).
   Проверки:
   (1) input.ts: константы MAP_KEY_DEFAULT='m' / MAP_PAD_DEFAULT=8, поля mapKey/mapPad
       в EmuPrefs, дефолты и загрузка из localStorage с самовосстановлением,
       имя кнопки 8 теперь «Select (Back)» (Xbox-аналог Select, как просил заказчик);
   (2) KeyBinder.tsx: новая строка «Управления» — mapOpen в GLOBAL_ACTIONS, поля
       mapKey/mapPad, заголовок «КАРТА МИРА — БЫСТРЫЙ ВЫЗОВ», описание с Select/Back/View,
       дефолт пада 8, подписи клавиши и пада;
   (3) GameScreen.tsx: toggleWorldMapView — одна логика для ТРЁХ источников (кнопка
       панели, клавиша, джойстик); кнопка панели вызывает её; эффект: keydown (M) с
       гардом полей ввода + ПРЯМОЙ опрос пада (Select не лицевая — collectPadButtons
       его не видит, нужен padBtnDown) каждые 66 мс, край-триггер, sfx.click, игнор кат-сцен;
   (4) Регрессии v0.170–v0.175 живы: чистка clicksOff, колесо, игровая зона, насос
       R1/R2, курсор прикреплён, мышь в окне задания не гаснет; APP_VERSION 170.
   (5) v0.176 (пополнение): курсор «КОРАБЛЬ ИЗ ASTEROIDS» — заказчик: «крестик создан
       с ошибкой. хвост который должен быть по середине сдвинут к левому краю стрелки.
       Сделай крестик джоя в более современном стиле, без хвоста - в стиле корабля из
       какой-то игры из аркадных автоматов…» (Atari Asteroids, 1979): векторный силуэт
       нос→крылья→выемка кормы БЕЗ хвоста, hotspot = остриё носа (SHIP_HOT), пламя
       двигателя при ЛКМ, старая пиксельная матрица CURSOR_PIXELS полностью убрана.
   Запуск: node scripts/v176-smoke.mjs  (без зависимостей, только fs). */
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
const app = read('src/App.tsx');
const types = read('src/types.ts');
const ver = read('src/version.ts');

/* ---------- (1) input.ts: константы и настройки ---------- */
must(inp.includes("export const MAP_KEY_DEFAULT = 'm';"), "input: MAP_KEY_DEFAULT = 'm' (клавиша по умолчанию)");
must(inp.includes('export const MAP_PAD_DEFAULT = 8;'), 'input: MAP_PAD_DEFAULT = 8 (Select; Xbox — Back/View)');
must(inp.includes('  mapKey?: string;') && inp.includes('  mapPad?: number;'), 'input: поля mapKey/mapPad в EmuPrefs');
must(inp.includes('    mapKey: MAP_KEY_DEFAULT, // v0.176: M — быстрый вызов карты мира') &&
     inp.includes('    mapPad: MAP_PAD_DEFAULT, // v0.176: Select (у Xbox — Back/View)'),
  'input: дефолты в loadEmuPrefs');
must(inp.includes('mapKey: typeof p.mapKey === \'string\' && p.mapKey ? p.mapKey.toLowerCase() : MAP_KEY_DEFAULT,') &&
     inp.includes('mapPad: typeof p.mapPad === \'number\' && p.mapPad >= 0 ? p.mapPad : MAP_PAD_DEFAULT,'),
  'input: чтение mapKey/mapPad из localStorage с самовосстановлением');
must(inp.includes("8: 'Select (Back)'"), "input: подпись кнопки 8 — «Select (Back)» (аналог иксбокса)");
must(!inp.includes("'Select (Share)'"), 'input: старая подпись «Select (Share)» заменена');

/* ---------- (2) KeyBinder.tsx: строка «Управления» ---------- */
must(/const GLOBAL_ACTIONS = \[[^\]]*'mapOpen'[^\]]*\] as const;/.test(kb), 'KeyBinder: mapOpen в списке глобальных кнопок');
must(/mapOpen: 'mapKey',/.test(kb), "KeyBinder: клавиша mapOpen хранится в mapKey");
must(/mapOpen: 'mapPad',/.test(kb), "KeyBinder: кнопка пада mapOpen хранится в mapPad");
must(kb.includes('🗺 КАРТА МИРА — БЫСТРЫЙ ВЫЗОВ · одной кнопкой'), 'KeyBinder: заголовок блока «КАРТА МИРА — БЫСТРЫЙ ВЫЗОВ»');
must(kb.includes('SELECT (у Xbox эта кнопка называется BACK, на новых падах — VIEW)'),
  'KeyBinder: описание называет Xbox-аналог (Back/View)');
must(/mapOpen: MAP_PAD_DEFAULT,/.test(kb), 'KeyBinder: дефолт подписи пада — кнопка 8');
must(/const mapKeyLabel = gKeyLabel\(prefs\.mapKey, MAP_KEY_DEFAULT\);/.test(kb), 'KeyBinder: подпись клавиши из настроек');
must(/mapOpen: mapKeyLabel,/.test(kb) && /mapOpen: MAP_PAD_DEFAULT,/.test(kb), 'KeyBinder: подписи включены в таблицы');

/* ---------- (3) GameScreen.tsx: одна логика для трёх источников ---------- */
must(gs.includes('const toggleWorldMapView = () => {'), 'GameScreen: toggleWorldMapView выделена (кнопка панели + клавиша + джой)');
must(/const toggleWorldMapView = \(\) => \{[\s\S]{0,200}setPeekMap\(false\);[\s\S]{0,200}setViewMode\(\(m\) => \(m === 'world' \? 'follow' : 'world'\)\);/.test(gs),
  'GameScreen: toggle сбрасывает заглядывание и переключает вид поле↔карта');
must(gs.includes('<GhostBtn small onClick={() => { toggleWorldMapView(); sfx.click(); }}>'),
  'GameScreen: кнопка «Карта мира» на панели вызывает toggleWorldMapView');
must(gs.includes('(prefs.mapKey ?? MAP_KEY_DEFAULT).toLowerCase()'), 'GameScreen: клавиша — mapKey (по умолчанию M)');
must(gs.includes('MAP_KEY_DEFAULT, MAP_PAD_DEFAULT,'), 'GameScreen: константы импортированы');
must(gs.includes("if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable)) return;\n      if (cutActiveRef.current) return;\n      e.preventDefault();\n      toggleWorldMapView();"),
  'GameScreen: клавиша игнорируется в полях ввода и кат-сценах');
must(gs.includes('mapPadPrevRef.current = padBtnDown(loadEmuPrefs().mapPad ?? MAP_PAD_DEFAULT); // зажатое при входе на экран — не хлопает') &&
     gs.includes('const cur = padBtnDown(loadEmuPrefs().mapPad ?? MAP_PAD_DEFAULT);'),
  'GameScreen: кнопка пада читается НАПРЯМУЮ (padBtnDown — Select не лицевая, collectPadButtons его не видит)');
must(gs.includes('const was = mapPadPrevRef.current;') && gs.includes('if (cur && !was && !cutActiveRef.current) { toggleWorldMapView(); sfx.click(); }'),
  'GameScreen: край-триггер (только НОВОЕ нажатие) + игнор кат-сцен');
must(gs.includes('}, 66);'), 'GameScreen: опрос 66 мс — как у инвентаря/печи/«назад»');
must(gs.includes('return () => { window.removeEventListener(\'keydown\', onKey); window.clearInterval(iv); };'),
  'GameScreen: у эффекта быстрого вызова есть очистка слушателей (урок v0.175)');

/* ---------- (4) РЕГРЕССИИ v0.170–v0.175 ---------- */
must(/padMouseSetClicksOff\(!!bare\);\s*\n\s*return \(\) => padMouseSetClicksOff\(false\);/.test(gs),
  'v0.175 живо: чистка clicksOff при размонтировании (прокрутка не глохнет в меню)');
must(pm.includes('const wheelable = !clicksOff && !inZone; // v0.174: чистое поле и игровая зона — без колеса'),
  'v0.172/0.174 живо: колесо левым стиком = !clicksOff && !inZone');
must(pm.includes("new WheelEvent('wheel'"), 'v0.172 живо: настоящий WheelEvent в точке курсора');
must(pm.includes('document.body.appendChild(cur)'), 'v0.173 живо: ретро-курсор прикреплён к странице');
must(pm.includes("TRIG_FLAG_KEY = 'retropolia-pad-trig-ui'"), 'v0.174 живо: флаг игровой зоны');
must(sb.includes('if(trigUi&&(phys===5||phys===7))'), 'v0.174 живо: насос не пересылает R1/R2 над интерфейсом');
must(gs.includes('!hackBox && !frendyIntro;'), 'v0.174 живо: «Пропустить» интро Френди нажимается');
must(gs.includes('useEffect(() => { if (taskWinOpenUi) padMouseSetOff(false); }, [taskWinOpenUi]);'),
  'v0.174 живо: мышь в окне задания не гаснет');
must(el.includes('return () => padMouseSetOff(false);'), 'v0.174 живо: «Запуск эмулятора» чистит userOff');
must(app.includes('usePadMouse(true)'), 'v0.171 живо: мышь с джойстика глобальна');
must(/APP_VERSION = 170;/.test(types), 'v0.176: APP_VERSION 169→170');
must(types.includes('// 170: 0.176.0 КНОПКА «КАРТА МИРА — БЫСТРЫЙ ВЫЗОВ»'), 'v0.176: история версии в types.ts дополнена');
must(ver.includes('0.176.0 КНОПКА «КАРТА МИРА — БЫСТРЫЙ ВЫЗОВ»'), 'v0.176: на заставке 0.176.0');
must(ver.includes('// 0.175.0 (история)'), 'v0.176: v0.175 ушла в историю версии');

/* ---------- (5) v0.176 (пополнение): КУРСОР «КОРАБЛЬ ИЗ ASTEROIDS» ---------- */
must(pm.includes('КУРСОР «КОРАБЛЬ ИЗ ASTEROIDS»'), 'v0.176: блок курсора-корабля на месте (вместо пиксельной стрелы v0.172)');
must(pm.includes('M14 2 L25 27 L18.5 24 L9.5 24 L3 27 Z'), 'v0.176: силуэт корабля — нос → крылья → выемка кормы, БЕЗ хвоста');
must(pm.includes('const SHIP_W = 28, SHIP_H = 30, SHIP_HOT_X = 14, SHIP_HOT_Y = 2;'), 'v0.176: hotspot — остриё носа (14,2)');
must(pm.includes('st.x - SHIP_HOT_X') && pm.includes('st.y - SHIP_HOT_Y'), 'v0.176: точка клика = кончик носа (place вычитает hotspot)');
must(pm.includes("shipSvg('#ffcf3f', '#ffe9a3', false)") && pm.includes("shipSvg('#ff5d73', '#ffb3a8', true)"), 'v0.176: палитра проекта — золото / коралл при ЛКМ');
must(pm.includes('M11.5 25.5 L14 29.5 L16.5 25.5'), 'v0.176: пламя двигателя при зажатой ЛКМ (тяга корабля)');
must(pm.includes('stroke-linejoin="round"') && pm.includes('rgba(11,14,28,0.45)'), 'v0.176: совр. стиль — скруглённые соединения + тёмная подложка (виден на любом фоне)');
must(!pm.includes('CURSOR_PIXELS') && !pm.includes('cursorSvg'), 'v0.176: старая пиксельная стрела (CURSOR_PIXELS/cursorSvg) полностью убрана');
must(pm.includes('cur.innerHTML = CURSOR_IDLE;') && pm.indexOf('document.body.appendChild(cur)') > pm.indexOf('cur.innerHTML = CURSOR_IDLE;'),
  'v0.173 живо: курсор наполняется SVG и прикрепляется к странице');
must(pm.includes('cur.remove();'), 'v0.173 живо: при размонтировании курсор снимается со страницы');

console.log(`\nИТОГО: ${ok} проверок`);
if (process.exitCode) { console.log('SMOKE FAIL'); process.exit(1); }
console.log('SMOKE OK');
