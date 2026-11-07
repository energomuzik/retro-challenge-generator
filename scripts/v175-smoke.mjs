/* Смоук v0.175: ФИКС «ПРОКРУТКА ЛЕВЫМ СТИКОМ ПРОПАДАЕТ В ГЛАВНОМ МЕНЮ ПОСЛЕ ВЫХОДА ИЗ ПАРТИИ»
   (заказчик: «на левый стик, прокрутка, то работает, то нет. Т.е. я затестил управление джоем
   мыши в игре. Но после выхода в главное меню, мышь нормально передвигалась, скролл на левый
   стик пропал. т.е. когда игра видит джой и пишет джой иксбокс найден, когда перезагружаешь
   страницу»).
   Проверки:
   (1) GameScreen.tsx: у эффекта «чистого поля» ЕСТЬ очистка при размонтировании —
       return () => padMouseSetClicksOff(false) — флаг clicksOff больше не «залипает»
       после выхода из партии (главная причина бага);
   (2) padMouse.ts: прокрутка гейтована clicksOff и игровой зоной как в v0.172/0.174
       (wheelable = !clicksOff && !inZone) — сам механизм не тронут, чистка флага
       возвращает ему правильное значение «0» вне партии;
   (3) Регрессии v0.170–v0.174 живы: глобальная мышь в App, настоящие клики
       (elementFromPoint), ретро-курсор прикреплён к странице (appendChild),
       ползунки/каретка (caretRangeFromPoint), левый стик — колесо (WheelEvent),
       игровая зона + флаг retropolia-pad-trig-ui, насос SegaBox пропускает W3C 5/7,
       интро Френди в списке оверлеев, мышь в окне задания не гаснет.
   Запуск: node scripts/v175-smoke.mjs  (без зависимостей, только fs). */
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
const pm = read('src/padMouse.ts');
const sb = read('src/SegaBox.tsx');
const el = read('src/screens/EmulatorLauncher.tsx');
const app = read('src/App.tsx');
const types = read('src/types.ts');
const ver = read('src/version.ts');

/* ---------- (1) ГЛАВНЫЙ ФИКС v0.175: чистка clicksOff при размонтировании ---------- */
must(/padMouseSetClicksOff\(!!bare\);\s*\n\s*return \(\) => padMouseSetClicksOff\(false\);/.test(gs),
  'v0.175: у эффекта «чистого поля» есть очистка return () => padMouseSetClicksOff(false)');
must(gs.includes('// v0.175: ушли из партии/открыли окно — «чистое поле» сброшено, прокрутка в меню и окнах жива'),
  'v0.175: у очистки есть поясняющий комментарий');
must(!/padMouseSetClicksOff\(!!bare\);\s*\n\s*\}, \[/.test(gs),
  'v0.175: старый вариант без очистки (padMouseSetClicksOff сразу перед закрывающей },[) удалён');
must((gs.match(/padMouseSetClicksOff/g) || []).length === 3,
  'v0.175: padMouseSetClicksOff в GameScreen ровно 3 раза (импорт + установка + очистка)');

/* ---------- (2) МЕХАНИЗМ ПРОКРУТКИ НЕ ТРОНУТ (v0.172 + v0.174) ---------- */
must(pm.includes('const wheelable = !clicksOff && !inZone; // v0.174: чистое поле и игровая зона — без колеса'),
  'v0.172/0.174 живы: прокрутка = !clicksOff && !inZone (колесо левым стиком)');
must(pm.includes("new WheelEvent('wheel'"), 'v0.172 живо: колесо — настоящий WheelEvent в точке курсора');
must(pm.includes('scrollableBox(el)'), 'v0.172 живо: после wheel ручная прокрутка ближайшего прокручиваемого предка');
must(pm.includes('const inGameZone = (el: Element): boolean =>'),
  'v0.174 живо: игровая зона — iframe экрана эмулятора');

/* ---------- (3) РЕГРЕССИИ v0.170–v0.174 ---------- */
must(app.includes('usePadMouse(true)'), 'v0.171 живо: мышь с джойстика смонтирована глобально в App');
must(pm.includes('elementFromPoint'), 'v0.170 живо: настоящие клики в точке курсора (elementFromPoint)');
must(pm.includes('document.body.appendChild(cur)'), 'v0.173 живо: ретро-курсор ПРИКРЕПЛЁН к странице');
must(pm.includes('caretRangeFromPoint'), 'v0.172 живо: текстовые поля — фокус и каретка в точке клика');
must(pm.includes("TRIG_FLAG_KEY = 'retropolia-pad-trig-ui'"), 'v0.174 живо: флаг trig-ui для насоса игры');
must(pm.includes('setTrigFlag(!inZone && !clicksOff)'), 'v0.174 живо: над интерфейсом R1/R2 — кнопки мыши');
must(sb.includes('localStorage.getItem("retropolia-pad-trig-ui")'), 'v0.174 живо: насос SegaBox читает флаг');
must(sb.includes('if(trigUi&&(phys===5||phys===7))'), 'v0.174 живо: насос НЕ пересылает R1/R2 игре над интерфейсом');
must(gs.includes('!hackBox && !frendyIntro;'), 'v0.174 живо: интро Френди в списке оверлеев («Пропустить» нажимается)');
must(gs.includes('useEffect(() => { if (taskWinOpenUi) padMouseSetOff(false); }, [taskWinOpenUi]);'),
  'v0.174 живо: мышь в окне задания не гаснет на время игры');
must(el.includes('return () => padMouseSetOff(false);'), 'v0.174 живо: «Запуск эмулятора» чистит userOff при размонтировании');
must(/APP_VERSION = 169;/.test(types), 'v0.175: APP_VERSION 168→169');
must(ver.includes('0.175.0 ФИКС «ПРОКРУТКА ЛЕВЫМ СТИКОМ ПРОПАДАЕТ В ГЛАВНОМ МЕНЮ ПОСЛЕ ВЫХОДА ИЗ ПАРТИИ»'),
  'v0.175: версия на заставке — 0.175.0 с описанием фикса');
must(ver.includes('// 0.174.0 (история)'), 'v0.175: v0.174 ушла в историю версии');

console.log(`\nИТОГО: ${ok} проверок`);
if (process.exitCode) { console.log('SMOKE FAIL'); process.exit(1); }
console.log('SMOKE OK');
