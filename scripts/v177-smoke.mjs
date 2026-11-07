/* Смоук v0.177: КУРСОР ПОД УГЛОМ + ЖЁЛТАЯ ЗАЛИВКА + ИНВЕНТАРЬ БЕЗ СБОЕВ
   (заказчик после v0.176: «select и вызов карты работает нормально. 2. курсор джоя
   нарисован нормально. только он расположен прямо. А надо как курсор, сделать его
   под углом. Что бы место тыканья было понятно. Да и пусть он будет желтый как был,
   а не только обводка. 3. Вызов инвентаря на треугольник (Y) работает через раз
   почему то»).
   Проверки:
   (1) padMouse.ts: корабль ПОВЁРНУТ на −45° (нос в верхний левый угол (2,2) бокса
       30×30 — как у стрелки мыши; поворот в координатах пути, не CSS); ЗАЛИВКА
       золотом #ffcf3f + тёмный контур #0b0e1c (как у пиксельной стрелы v0.172),
       блик #ffe9a3, пламя повёрнуто вместе с кораблём; старый прямой силуэт и
       тёмная подложка v0.176 убраны; hotspot = нос (2,2), place() вычитает;
   (2) GameScreen.tsx: инвентарь на Y — ОДИН край-триггер вместо двух эффектов:
       опрос каждые 16 мс (66 мс теряли короткий тап), один флаг края на
       открытие+закрытие (база снимается один раз при монтировании — нажатия не
       съедаются при перемонтировках), состояние через живые ref'ы; открытие —
       гарды как у Tab (кат-сцена/диалог/окно задания/карман) + приоритет
       печи/приставки; закрытие — всегда; старые invPadPrevRef/invClosePadRef
       и тумблер setInvOpen(o=>!o) в пад-эффекте убраны;
   (3) Регрессии v0.170–v0.176 живы: карта мира (M/Select-Back), чистка clicksOff,
       колесо, игровая зона, насос R1/R2, курсор прикреплён, мышь в окне задания
       не гаснет; APP_VERSION 171; на заставке 0.177.0.
   Запуск: node scripts/v177-smoke.mjs  (без зависимостей, только fs). */
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

/* ---------- (1) КУРСОР: ПОД УГЛОМ + ЖЁЛТАЯ ЗАЛИВКА (padMouse.ts) ---------- */
must(pm.includes('КУРСОР «КОРАБЛЬ ИЗ ASTEROIDS» — ПОД УГЛОМ, ЖЁЛТАЯ ЗАЛИВКА'),
  'v0.177: блок курсора помечен (под углом + заливка)');
must(pm.includes('M2 2 L27.5 11.9 L20.7 14.4 L14.4 20.7 L11.9 27.5 Z'),
  'v0.177: корабль повёрнут на −45° — нос в верхний левый угол (2,2), как у стрелки мыши');
must(pm.includes('const SHIP_W = 30, SHIP_H = 30, SHIP_HOT_X = 2, SHIP_HOT_Y = 2;'),
  'v0.177: hotspot = остриё носа (2,2) в боксе 30×30');
must(pm.includes('st.x - SHIP_HOT_X') && pm.includes('st.y - SHIP_HOT_Y'),
  'v0.177: точка клика = кончик носа (place вычитает hotspot)');
must(pm.includes('fill="${fill}" stroke="#0b0e1c"'),
  'v0.177: корпус ЗАЛИТ цветом (fill=${fill}) + тёмный контур #0b0e1c — как у стрелы v0.172');
must(pm.includes("shipSvg('#ffcf3f', '#ffe9a3', false)") && pm.includes("shipSvg('#ff5d73', '#ffb3a8', true)"),
  'v0.177: палитра проекта — жёлтый #ffcf3f / коралл при ЛКМ');
must(pm.includes('M4.8 4.1 L11.9 21.8'),
  'v0.177: грань-блик #ffe9a3 повёрнут вместе с кораблём');
must(pm.includes('M16.8 20.4 L21.4 21.4 L20.4 16.8'),
  'v0.177: пламя двигателя повёрнуто (тяга смотрит по курсу — вправо-вниз)');
must(!pm.includes('M14 2 L25 27') && !pm.includes('rgba(11,14,28,0.45)'),
  'v0.177: старый прямой силуэт v0.176 и тёмная подложка убраны');
must(!pm.includes('CURSOR_PIXELS') && !pm.includes('cursorSvg'),
  'v0.172 живо: пиксельная стрела по-прежнему отсутствует');
must(pm.includes('stroke-linejoin="round"') && pm.includes('filter:drop-shadow'),
  'v0.176 живо: скруглённые соединения + тень проекта');
must(pm.includes('cur.innerHTML = CURSOR_IDLE;') && pm.indexOf('document.body.appendChild(cur)') > pm.indexOf('cur.innerHTML = CURSOR_IDLE;'),
  'v0.173 живо: курсор наполняется SVG и прикрепляется к странице');
must(pm.includes('cur.remove();'), 'v0.173 живо: при размонтировании курсор снимается со страницы');

/* ---------- (2) ИНВЕНТАРЬ НА Y — ОДИН НАДЁЖНЫЙ КРАЙ-ТРИГГЕР (GameScreen.tsx) ---------- */
must(gs.includes('ИНВЕНТАРЬ С ДЖОЙСТИКА (Y/треугольник) — ОДИН НАДЁЖНЫЙ КРАЙ-ТРИГГЕР'),
  'v0.177: единый триггер инвентаря на месте');
must(gs.includes('invOpenLiveRef') && gs.includes('invPhaseLiveRef') && gs.includes('invFurnConsLiveRef'),
  'v0.177: состояние читается через живые ref\'ы (invOpen/фаза/печь-приставка)');
must(gs.includes('    }, 16); // v0.177: 66→16 мс — короткий тап больше не теряется между опросами'),
  'v0.177: опрос каждые 16 мс (66 мс теряли короткий тап)');
must(gs.includes('if (invOpenLiveRef.current) { setInvOpen(false); sfx.click(); }'),
  'v0.177: открыт — Y закрывает (один флаг края на открытие и закрытие)');
must(gs.includes("else if (invPhaseLiveRef.current === 'playing' && !cutActiveRef.current && !taskWinRef.current && !dlgOpenIdRef.current && !pocketBlockRef.current && !invFurnConsLiveRef.current) { setInvOpen(true); sfx.click(); }"),
  'v0.177: закрыт — Y открывает (гарды как у Tab + приоритет печи/приставки)');
must(/useEffect\(\(\) => \{\s*\n    let prev = false;\s*\n    const init = new Set<number>\(\);\s*\n    collectPadButtons\(init\);\s*\n    prev = init\.has\(loadEmuPrefs\(\)\.invPad \?\? INV_PAD_DEFAULT\);[\s\S]*?return \(\) => window\.clearInterval\(iv\);\s*\n  \}, \[\]\);/.test(gs),
  'v0.177: база снимается ОДИН раз при монтировании (deps [] — пересниматься нечему)');
must(gs.includes('INVBACK_KEY_DEFAULT, INVBACK_PAD_DEFAULT, INV_PAD_DEFAULT,'),
  'v0.177: INV_PAD_DEFAULT импортирован');
must(gs.includes('INV_PAD_DEFAULT); // зажатое при монтировании — не хлопает'),
  'v0.177: зажатое при монтировании нажатие не хлопает');
must(!gs.includes('invPadPrevRef') && !gs.includes('invClosePadRef'),
  'v0.177: старые invPadPrevRef/invClosePadRef (две базы, два эффекта) убраны');
must(!gs.includes('{ setInvOpen((o) => !o); sfx.click(); }'),
  'v0.177: тумблер setInvOpen(o=>!o) в пад-эффекте убран (явные открыть/закрыть)');
must(gs.includes('(инвентарь\n     закрывается своим единым триггером Y — v0.177, эффект выше)'),
  'v0.177: комментарий у печи/приставки ссылается на новый триггер');

/* ---------- (3) РЕГРЕССИИ v0.170–v0.176 ---------- */
must(/padMouseSetClicksOff\(!!bare\);\s*\n\s*return \(\) => padMouseSetClicksOff\(false\);/.test(gs),
  'v0.175 живо: чистка clicksOff при размонтировании (прокрутка не глохнет в меню)');
must(pm.includes('const wheelable = !clicksOff && !inZone; // v0.174: чистое поле и игровая зона — без колеса'),
  'v0.172/0.174 живо: колесо левым стиком = !clicksOff && !inZone');
must(pm.includes("new WheelEvent('wheel'"), 'v0.172 живо: настоящий WheelEvent в точке курсора');
must(pm.includes("TRIG_FLAG_KEY = 'retropolia-pad-trig-ui'"), 'v0.174 живо: флаг игровой зоны');
must(sb.includes('if(trigUi&&(phys===5||phys===7))'), 'v0.174 живо: насос не пересылает R1/R2 над интерфейсом');
must(gs.includes('!hackBox && !frendyIntro;'), 'v0.174 живо: «Пропустить» интро Френди нажимается');
must(gs.includes('useEffect(() => { if (taskWinOpenUi) padMouseSetOff(false); }, [taskWinOpenUi]);'),
  'v0.174 живо: мышь в окне задания не гаснет');
must(el.includes('return () => padMouseSetOff(false);'), 'v0.174 живо: «Запуск эмулятора» чистит userOff');
must(app.includes('usePadMouse(true)'), 'v0.171 живо: мышь с джойстика глобальна');
/* v0.176: карта мира + Select */
must(gs.includes('const toggleWorldMapView = () => {'), 'v0.176 живо: toggleWorldMapView (кнопка панели + клавиша + джой)');
must(gs.includes('mapPadPrevRef.current = padBtnDown(loadEmuPrefs().mapPad ?? MAP_PAD_DEFAULT); // зажатое при входе на экран — не хлопает') &&
     gs.includes('if (cur && !was && !cutActiveRef.current) { toggleWorldMapView(); sfx.click(); }'),
  'v0.176 живо: Select читается напрямую, край-триггер, кат-сцены игнор');
must(gs.includes('}, 66);'), 'v0.176 живо: опрос 66 мс у карты/печи/«назад» сохранён');
must(inp.includes('export const MAP_PAD_DEFAULT = 8;') && inp.includes("8: 'Select (Back)'"),
  'v0.176 живо: MAP_PAD_DEFAULT = 8, подпись «Select (Back)»');
must(/const GLOBAL_ACTIONS = \[[^\]]*'mapOpen'[^\]]*\] as const;/.test(kb), 'v0.176 живо: блок «КАРТА МИРА — БЫСТРЫЙ ВЫЗОВ» в «Управлении»');
/* версии */
must(/APP_VERSION = 171;/.test(types), 'v0.177: APP_VERSION 170→171');
must(types.includes('// 171: 0.177.0 КУРСОР ПОД УГЛОМ + ЖЁЛТАЯ ЗАЛИВКА + ИНВЕНТАРЬ БЕЗ СБОЕВ'),
  'v0.177: история версии в types.ts дополнена');
must(types.includes('// 170: 0.176.0 КНОПКА «КАРТА МИРА — БЫСТРЫЙ ВЫЗОВ»'), 'v0.177: v0.176 осталась в истории types.ts');
must(ver.includes('0.177.0 КУРСОР ДЖОЙ-МЫШИ ПОД УГЛОМ'), 'v0.177: на заставке 0.177.0');
must(ver.includes('// 0.176.0 (история)'), 'v0.177: v0.176 ушла в историю версии');
must(ver.includes('0.${APP_VERSION + 6}.0'), 'версия заставки по-прежнему выводится из APP_VERSION');

console.log(`\nИТОГО: ${ok} проверок`);
if (process.exitCode) { console.log('SMOKE FAIL'); process.exit(1); }
console.log('SMOKE OK');
