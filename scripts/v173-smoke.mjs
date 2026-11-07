/* Смоук v0.173: ФИКС «КУРСОР ДЖОЙ-МЫШИ НИГДЕ НЕ ВИДЕН» —
   в v0.172 при переделке курсора на ретро-SVG из блока создания выпала строка
   document.body.appendChild(cur): элемент создавался, но не прикреплялся к странице,
   и указателя не было видно ни в одном меню/окне (клики работали — elementFromPoint
   не зависит от курсора). Проверки:
   (1) padMouse.ts: курсор ПРИКРЕПЛЯЕТСЯ к document.body сразу после создания и до
       первого tick; при размонтировании снимается (cur.remove()); приказ hide/show
       по-прежнему управляет display (style в cssText до appendChild).
   (2) Регрессии v0.170–v0.172 живы: фиксированная раскладка, тумблер/userOff/clicksOff,
       прокрутка левым стиком, ретро-курсор, ползунки, поля ввода, галочки, select.
   (3) types.ts: APP_VERSION 167; version.ts: VERSION 0.173.0.
   Запуск: node scripts/v173-smoke.mjs (esbuild бандлит, import.meta.glob — заглушка). */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = path.join(ROOT, 'scripts', 'v173-tmp');
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
import { loadEmuPrefs, PADMOUSE_SPEED_DEFAULT } from '${ROOT}/src/input';
globalThis.__X = { APP_VERSION, VERSION, loadEmuPrefs, PADMOUSE_SPEED_DEFAULT };
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
check('ВЕРСИЯ 0.173.0 / APP_VERSION 167', X.VERSION === '0.173.0' && X.APP_VERSION === 167, `${X.VERSION} / ${X.APP_VERSION}`);

/* ---------- (1) ГЛАВНЫЙ ФИКС v0.173: КУРСОР ПРИКРЕПЛЁН К СТРАНИЦЕ ---------- */
const pm = src('src/padMouse.ts');
const iCreate = pm.indexOf("const cur = document.createElement('div');");
const iInner = pm.indexOf('cur.innerHTML = CURSOR_IDLE;');
const iAppend = pm.indexOf('document.body.appendChild(cur);');
const iTick = pm.indexOf('const tick = (now: number) => {');
check('padMouse: курсор создаётся и наполняется ретро-SVG', iCreate >= 0 && iInner > iCreate);
check('padMouse: ФИКС — document.body.appendChild(cur) ЕСТЬ и стоит до первого tick', iAppend > iInner && iAppend < iTick, `innerHTML@${iInner}, appendChild@${iAppend}, tick@${iTick}`);
check('padMouse: appendChild — ровно один (без дублей при пересозданиях)', (pm.match(/document\.body\.appendChild\(cur\)/g) || []).length === 1);
check('padMouse: при размонтировании курсор снимается со страницы (cur.remove())', pm.includes('cur.remove();'));
check('padMouse: стиль курсора (position:fixed, z-index, pointer-events:none) задан', pm.includes('position:fixed;left:0;top:0;z-index:2147483000;pointer-events:none'));
check('padMouse: show() ставит display:block, hide() — display:none', pm.includes("cur.style.display = 'block'") && pm.includes("cur.style.display = 'none'"));

/* ---------- (2) регрессии v0.172 живы: ПРОКРУТКА ЛЕВЫМ СТИКОМ ---------- */
check('padMouse: левый стик — ось 1 (AXIS_LY), вертикаль', /const AXIS_LY = 1;/.test(pm));
check('padMouse: колесо — порции 100 px с паузой (SCROLL_NOTCH/SCROLL_GAP)', /const SCROLL_NOTCH = 100;/.test(pm) && /const SCROLL_GAP = 55;/.test(pm));
check('padMouse: скорость прокрутки × padMouseSpeed и dt', pm.includes('MAX_SCROLL * spd * dt'));
check('padMouse: накапливает ход стика до щелчка (scrollAcc >= SCROLL_NOTCH)', pm.includes('Math.abs(scrollAcc) >= SCROLL_NOTCH'));
check('padMouse: синтетический WheelEvent в точке курсора', pm.includes('new WheelEvent(') && pm.includes('deltaY: notch'));
check('padMouse: defaultPrevented уважается (зум канвы редактора сам)', pm.includes('if (!ev.defaultPrevented) {'));
check('padMouse: ручная прокрутка — scrollableBox (окна списков, панели)', pm.includes('function scrollableBox(') && pm.includes('box.scrollBy(0, notch)') && pm.includes('window.scrollBy(0, notch)'));
check('padMouse: прокрутка гаснет ТАМ ЖЕ, где клики (clicksOff/uiLock — return выше)', pm.indexOf('if (clicksOff || uiLock) return;') < pm.indexOf('const sdy = curve(gp.axes[AXIS_LY]'));

/* ---------- (3) регрессии v0.172 живы: РЕТРО-КУРСОР ---------- */
check('padMouse: пиксельная матрица курсора (CURSOR_PIXELS) → SVG', pm.includes('const CURSOR_PIXELS = [') && pm.includes('cursorSvg'));
check('padMouse: палитра проекта — золото #ffcf3f, чернила #0b0e1c', pm.includes("cursorSvg('#ffcf3f', '#ffe9a3')") && pm.includes("'#0b0e1c'"));
check('padMouse: зажатая ЛКМ — коралловая стрела (#ff5d73)', pm.includes("cursorSvg('#ff5d73', '#ffb3a8')"));
check('padMouse: белой стандартной стрелки больше нет', !pm.includes('fill="#ffffff"'));
check('padMouse: crispEdges — рёбра пикселей без сглаживания', pm.includes('shape-rendering="crispEdges"'));
check('padMouse: курсор крупнее системного (SCALE 2 → 20×32)', /const CURSOR_SCALE = 2;/.test(pm));

/* ---------- (4) регрессии v0.172 живы: ПОЛЗУНКИ ---------- */
check('padMouse: ползунок под курсором (rangeAt — closest input[type=range])', pm.includes("el.closest('input[type=\"range\"]')"));
check('padMouse: значение из X курсора с min/max/step (rangeValueAt)', pm.includes('const rangeValueAt = (r: HTMLInputElement, x: number)'));
check('padMouse: клик прыгает в точку (setRange при нажатии ЛКМ)', pm.includes('st.range = rangeAt(el);') && pm.includes('setRange(st.range, rangeValueAt(st.range, st.x), false);'));
check('padMouse: держишь и ведёшь — тащится (per-tick update при держании)', pm.includes('if (st.lmb && st.range) {'));
check('padMouse: React onChange получает input/change (fire input + change)', pm.includes("fire(r, 'input', st.x, st.y, 0, 1);") && pm.includes("fire(r, 'change', st.x, st.y, 0, 1);"));
check('padMouse: отпускание ползунка — финальное change (и при releaseAll)', pm.includes('if (st.range && st.range.isConnected) fire(st.range'));
check('padMouse: «залипший» ползунок чистится при выключении мыши (releaseAll → st.range = null)', pm.includes('st.range = null; st.lmbEl = null;'));

/* ---------- (5) регрессии v0.172 живы: ПОЛЯ ВВОДА, ГАЛОЧКИ, SELECT ---------- */
check('padMouse: клик по полю — фокус вручную (focusField + preventScroll)', pm.includes('const focusField = (f: Element, x: number, y: number)') && pm.includes('focus({ preventScroll: true })'));
check('padMouse: каретка в точку клика (caretRangeFromPoint/FromPosition)', pm.includes('caretRangeFromPoint') && pm.includes('caretPositionFromPoint'));
check('padMouse: поля ловятся по closest (input, textarea, contenteditable)', pm.includes("el.closest('input, textarea, [contenteditable=\"true\"], [contenteditable=\"\"]')"));
check('padMouse: галочки/радио — clickTargetFor (label.control → чекбокс)', pm.includes('const clickTargetFor') && pm.includes('(lbl as HTMLLabelElement).control'));
check('padMouse: переключаем checked сами (checkbox toggle, radio = true)', pm.includes('inp.checked = t.checkbox ? !inp.checked : true;'));
check('padMouse: select — фокус + попытка showPicker', pm.includes('sel.showPicker?.()'));
check('padMouse: подсказка дополнена прокруткой (PAD_MOUSE_HINT_FULL)', pm.includes("export const PAD_MOUSE_HINT_FULL = PAD_MOUSE_HINT + ' · левый стик — прокрутка (колёсико)'"));

/* ---------- (6) регрессии v0.170/171 живы ---------- */
check('v0.171 жив: фиксированная раскладка (оси 2/3, R2=ЛКМ/R1=ПКМ)', /const AXIS_X = 2;/.test(pm) && /const BTN_LMB = 7;/.test(pm) && /const BTN_RMB = 5;/.test(pm));
check('v0.171 жив: userOff/тумблер/замок/«только курсор» на месте', pm.includes('export function padMouseSetOff') && pm.includes('export function usePadMouseToggle') && pm.includes('export function padMouseSetUiLock') && pm.includes('export function padMouseSetClicksOff'));
check('v0.171 жив: клик — только при отпускании на том же месте (el === st.lmbEl)', pm.includes('if (el === st.lmbEl) {'));
check('v0.171 жив: ПКМ — contextmenu в точке курсора', pm.includes("'contextmenu'"));
check('v0.171 жив: App монтирует мышь глобально', src('src/App.tsx').includes('usePadMouse(true);'));
check('v0.171 жив: авто-режим окон заданий в GameScreen', src('src/screens/GameScreen.tsx').includes('padMouseSetOff(emuRunInWin)'));
check('v0.171 жив: подсказки окон используют PAD_MOUSE_HINT (без изменения текста)', (() => {
  const gs = src('src/screens/GameScreen.tsx');
  const fi = src('src/screens/FrendyInv.tsx');
  return (gs.match(/PAD_MOUSE_HINT/g) || []).length >= 4 && (fi.match(/PAD_MOUSE_HINT/g) || []).length >= 2;
})());

/* ---------- (7) KeyBinder.tsx: описание возможностей мыши ---------- */
const kb = src('src/KeyBinder.tsx');
check('KeyBinder: подсказка мыши с прокруткой (PAD_MOUSE_HINT_FULL)', kb.includes('PAD_MOUSE_HINT_FULL'));
check('KeyBinder: тумблер гасит и прокрутку (в тексте)', kb.includes('и она же гасит прокрутку левым стиком'));
check('KeyBinder: ползунки/поля/галочки упомянуты', kb.includes('ползунки тянутся') && kb.includes('текстовые поля открываются кликом') && kb.includes('галочки переключаются'));
check('KeyBinder: чувствительность тянется джойстиком (упомянуто)', kb.includes('Этот ползунок чувствительности тоже можно тянуть джойстиком'));
check('KeyBinder: v0.171 жив — фиксированный блок мыши и глобальные кнопки', kb.includes('ФИКСИРОВАННО — НЕ ПЕРЕНАЗНАЧАЕТСЯ') && kb.includes("'padToggle'") && kb.includes("'quickSave'"));

/* ---------- итог ---------- */
console.log(ok ? 'SMOKE OK' : 'SMOKE FAIL');
fs.rmSync(TMP, { recursive: true, force: true });
process.exit(ok ? 0 : 1);
