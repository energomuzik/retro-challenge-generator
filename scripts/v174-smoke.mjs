/* Смоук v0.174: КЛИКИ ВО ВРЕМЯ ИГРЫ — ПАНЕЛЬ ВВЕРХУ, «ПРОПУСТИТЬ» ИНТРО ФРЕНДИ,
   ТРИГГЕРЫ БЕЗ КОНФЛИКТА (заказчик: «в начале режима френди, когда Френди говорит
   фразу — мышкой джоя не нажимается на пропустить; во время игры мышкой джоя не
   нажать на кнопки на панели вверху — там инвентарь, карта мира и т.д.»).
   Проверки:
   (1) padMouse.ts: игровая зона (iframe экрана эмулятора) — клики/колесо над ней
       гасятся, отпускания всегда доходят; флаг retropolia-pad-trig-ui для насоса
       игры (пишется только при смене, снимается на выключениях и при размонтировании);
       «только курсор» стал умнее — на чистом поле гасятся клики только по канве.
   (2) SegaBox.tsx: насос кнопок каждый кадр читает флаг и НЕ пересылает R1/R2
       (W3C 5/7) игре, пока курсор над интерфейсом.
   (3) GameScreen.tsx: frendyIntro в списке оверлеев «чистого поля» (кнопка
       «Пропустить» нажимается); мышь в окне задания НЕ гаснет на время игры
       (padMouseSetOff(emuRunInWin) удалён); подсказки переписаны.
   (4) EmulatorLauncher.tsx: мышь не гаснет на время игры.
   (5) Регрессии v0.170–v0.173 живы (фиксированная раскладка, тумблер, курсор
       прикреплён к body, ползунки, поля, прокрутка левым стиком).
   (6) types.ts: APP_VERSION 168; version.ts: VERSION 0.174.0.
   Запуск: node scripts/v174-smoke.mjs (esbuild бандлит, import.meta.glob — заглушка). */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = path.join(ROOT, 'scripts', 'v174-tmp');
fs.mkdirSync(TMP, { recursive: true });

let ok = true;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'OK ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) ok = false;
};
const src = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

/* ---------- код через esbuild (glob — заглушка) ---------- */
const out = path.join(TMP, 'code.cjs');
await build({
  stdin: {
    contents: `
import { APP_VERSION } from '${ROOT}/src/types';
import { VERSION } from '${ROOT}/src/version';
import { loadEmuPrefs } from '${ROOT}/src/input';
globalThis.__X = { APP_VERSION, VERSION, loadEmuPrefs };
`,
    loader: 'tsx',
    resolveDir: TMP,
  },
  bundle: true,
  write: true,
  outfile: out,
  format: 'cjs',
  platform: 'node',
  loader: { '.png': 'file', '.flac': 'file', '.mp3': 'file', '.webp': 'file' },
  banner: { js: 'var GLOBAL_GLOB_STUB = function () { return {}; };' },
  define: { 'import.meta.glob': 'GLOBAL_GLOB_STUB', 'import.meta.env': '{}' },
  logLevel: 'silent',
});
createRequire(import.meta.url)(out);
const X = globalThis.__X;

/* ---------- версия ---------- */
check('ВЕРСИЯ 0.174.0 / APP_VERSION 168', X.VERSION === '0.174.0' && X.APP_VERSION === 168, `${X.VERSION} / ${X.APP_VERSION}`);

/* ---------- (1) padMouse.ts: ИГРОВАЯ ЗОНА + ФЛАГ ТРИГГЕРОВ ---------- */
const pm = src('src/padMouse.ts');
check('padMouse: игровая зона — экран эмулятора это iframe (inGameZone)', pm.includes("el.tagName === 'IFRAME' || !!el.closest('iframe')"));
check('padMouse: флаг для насоса игры — ключ retropolia-pad-trig-ui', pm.includes("const TRIG_FLAG_KEY = 'retropolia-pad-trig-ui';"));
check('padMouse: флаг пишется в localStorage только при смене значения', pm.includes('if (trigFlagPrev === s) return;') && pm.includes("localStorage.setItem(TRIG_FLAG_KEY, s)"));
check('padMouse: над интерфейсом R1/R2 — кнопки мыши (setTrigFlag(!inZone && !clicksOff))', pm.includes('setTrigFlag(!inZone && !clicksOff);'));
check('padMouse: выключения мыши сбрасывают флаг (gamepad off / userOff / пада нет / uiLock)', (pm.match(/setTrigFlag\(false\)/g) || []).length >= 4);
check('padMouse: при размонтировании флаг снимается (removeItem) — триггеры игре без ограничений', pm.includes('localStorage.removeItem(TRIG_FLAG_KEY)'));
check('padMouse: нажатие ЛКМ гасится над игровой зоной и по канве чистого поля', pm.includes('if (lmbNow && !st.lmb && !inZone && !(clicksOff && fieldCanvas)) {'));
check('padMouse: нажатие ПКМ гасится так же (R1 — контекстное меню)', pm.includes('if (rmbNow && !st.rmb && !inZone && !(clicksOff && fieldCanvas)) {'));
check('padMouse: отпускание ВСЕГДА доходит (без «залипших» кнопок — else if (!lmbNow && st.lmb))', pm.includes("} else if (!lmbNow && st.lmb) {") && pm.includes("} else if (!rmbNow && st.rmb) {"));
check('padMouse: колесо не шлётся на чистом поле и над игровой зоной (wheelable)', pm.includes('const wheelable = !clicksOff && !inZone;') && pm.includes('if (sdy && wheelable) {'));
check('padMouse: канва карты под курсором — fieldCanvas (closest canvas)', pm.includes("const fieldCanvas = !!elNow.closest('canvas');"));

/* ---------- (2) SegaBox.tsx: НАСОС КНОПОК УВАЖАЕТ ФЛАГ ---------- */
const sb = src('src/SegaBox.tsx');
check('SegaBox: насос каждый кадр читает retropolia-pad-trig-ui', sb.includes('localStorage.getItem("retropolia-pad-trig-ui")==="1"'));
check('SegaBox: флаг «1» — физические R1/R2 (W3C 5/7) игре НЕ пересылаются', sb.includes('if(trigUi&&(phys===5||phys===7)){continue;}'));
check('SegaBox: флаг «0»/нет — раскладка работает как раньше (строка в pumpGamepad до physToAct)', sb.indexOf('retropolia-pad-trig-ui') < sb.indexOf('var physToAct={};'));

/* ---------- (3) GameScreen.tsx: ИНТРО ФРЕНДИ + МЫШЬ НЕ ГАСНЕТ В ИГРЕ ---------- */
const gs = src('src/screens/GameScreen.tsx');
check('GameScreen: ФИКС — интро Френди в списке оверлеев «чистого поля» (!frendyIntro в bare)', gs.includes('!hackBox && !frendyIntro;'));
check('GameScreen: frendyIntro в зависимостях эффекта (клики переключаются живьём)', gs.includes('!!hackBox, frendyIntro]);'));
check('GameScreen: ФИКС — мышь в окне задания НЕ гаснет на время игры (padMouseSetOff(emuRunInWin) удалён)', !gs.includes('padMouseSetOff(emuRunInWin)'));
check('GameScreen: окно задания открыто — мышь всегда включена (padMouseSetOff(false))', gs.includes('useEffect(() => { if (taskWinOpenUi) padMouseSetOff(false); }, [taskWinOpenUi]);'));
check('GameScreen: окно закрылось — мышь включена сама (как было)', gs.includes("if (!open) padMouseSetOff(false); // окно задания закрылось — мышь с джойстика снова включена"));
check('GameScreen: подсказка объясняет новую геометрию (клики по панели, на экране — триггеры)', (gs.match(/клики по панели вверху и окнам; на экране игры R1\/R2 — игровые триггеры/g) || []).length === 3);

/* ---------- (4) EmulatorLauncher.tsx: мышь не гаснет на время игры ---------- */
const el = src('src/screens/EmulatorLauncher.tsx');
check('EmulatorLauncher: мышь НЕ выключается при запуске рома (padMouseSetOff(!!running) удалён)', !el.includes('padMouseSetOff(!!running)'));
check('EmulatorLauncher: мышь включена и после ухода с экрана', el.includes('return () => padMouseSetOff(false);'));
check('EmulatorLauncher: подсказка объясняет игровую зону', el.includes('клики по кнопкам вокруг экрана; на экране игры R1/R2 — игровые триггеры'));

/* ---------- (5) регрессии v0.170–v0.173 живы ---------- */
check('v0.171 жив: фиксированная раскладка (оси 2/3, R2=ЛКМ/R1=ПКМ)', /const AXIS_X = 2;/.test(pm) && /const BTN_LMB = 7;/.test(pm) && /const BTN_RMB = 5;/.test(pm));
check('v0.171 жив: тумблер/замок/клики-офф на месте', pm.includes('export function padMouseSetOff') && pm.includes('export function usePadMouseToggle') && pm.includes('export function padMouseSetUiLock') && pm.includes('export function padMouseSetClicksOff'));
check('v0.171 жив: клик — только при отпускании на том же месте (el === st.lmbEl)', pm.includes('if (el === st.lmbEl) {'));
check('v0.172 жив: прокрутка левым стиком (ось 1, порции 100 px)', /const AXIS_LY = 1;/.test(pm) && /const SCROLL_NOTCH = 100;/.test(pm));
check('v0.172 жив: ретро-курсор (золото #ffcf3f, коралл при ЛКМ)', pm.includes("cursorSvg('#ffcf3f', '#ffe9a3')") && pm.includes("cursorSvg('#ff5d73', '#ffb3a8')"));
check('v0.172 жив: ползунки (клик — прыжок, держишь — тащится)', pm.includes('st.range = rangeAt(el);') && pm.includes('if (st.lmb && st.range) {'));
check('v0.172 жив: текстовые поля — фокус и каретка (caretRangeFromPoint)', pm.includes('caretRangeFromPoint'));
check('v0.173 жив: курсор ПРИКРЕПЛЁН к странице (appendChild до tick)', (() => {
  const iInner = pm.indexOf('cur.innerHTML = CURSOR_IDLE;');
  const iAppend = pm.indexOf('document.body.appendChild(cur);');
  const iTick = pm.indexOf('const tick = (now: number) => {');
  return iAppend > iInner && iAppend < iTick && (pm.match(/document\.body\.appendChild\(cur\)/g) || []).length === 1;
})());
check('v0.170 жив: App монтирует мышь глобально', src('src/App.tsx').includes('usePadMouse(true);'));
check('v0.170 жив: клики — настоящие события в точке курсора (elementFromPoint + fire)', pm.includes('document.elementFromPoint') && pm.includes("el.dispatchEvent(ev)"));
check('App: нативное контекстное меню подавлено (R1 над кнопками не открывает меню браузера)', src('src/App.tsx').includes("addEventListener('contextmenu'"));

/* ---------- итог ---------- */
console.log(ok ? 'SMOKE OK' : 'SMOKE FAIL');
fs.rmSync(TMP, { recursive: true, force: true });
process.exit(ok ? 0 : 1);
