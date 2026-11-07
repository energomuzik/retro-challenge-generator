/* Смоук v0.171: МЫШЬ ВЕЗДЕ + ТУМБЛЕР + ЗУМ + УПРАВЛЕНИЕ ВСЕХ ПЛАТФОРМ —
   (1) padMouse.ts: глобальное вкл/выкл (padMouseSetOff/padMouseIsOff/usePadMouseOff),
       режим «только курсор» (padMouseSetClicksOff), замок на время захвата (padMouseSetUiLock),
       чувствительность (prefs.padMouseSpeed × MAX_SPEED), тумблер usePadMouseToggle (F7/L3).
   (2) input.ts: quickSave/furn/padToggle/zoomIn/zoomOut/padMouseSpeed в EmuPrefs + дефолты
       (F5/R3, E/крест-A, F7/L3, L1 «+» / L2 «-») + padBtnName/padBtnLabel.
   (3) App.tsx: usePadMouse(true) + usePadMouseToggle() — глобальный монтаж.
   (4) GameScreen.tsx: авто-режим окон заданий (игра крутится — выкл, окно закрылось — вкл),
       «только курсор» на чистом поле, useQuickSave, зум L1/L2, печь/приставка на furnPad/furnKey,
       подсказки в трёх окнах заданий.
   (5) KeyBinder.tsx: 9 глобальных кнопок, фиксированный блок мыши (только показать),
       ползунок чувствительности, имена кнопок пада (ДЖОЙ 4 · L1 (LB)), uiLock.
   (6) OptionsScreen.tsx: «Управление (все платформы)» — табы всех консолей.
   (7) EmulatorLauncher.tsx: быстрое сохранение выделенного + авто-выкл мыши при игре.
   (8) MapEditor.tsx: зум L1/L2 с джойстика и «+»/«-» с клавиатуры.
   Запуск: node scripts/v171-smoke.mjs (esbuild бандлит, import.meta.glob — заглушка). */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = path.join(ROOT, 'scripts', 'v171-tmp');
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
import { QUICKSAVE_KEY_DEFAULT, QUICKSAVE_PAD_DEFAULT, FURN_KEY_DEFAULT, FURN_PAD_DEFAULT,
  PADTOGGLE_KEY_DEFAULT, PADTOGGLE_PAD_DEFAULT, ZOOMIN_KEY_DEFAULT, ZOOMIN_PAD_DEFAULT,
  ZOOMOUT_KEY_DEFAULT, ZOOMOUT_PAD_DEFAULT, PADMOUSE_SPEED_DEFAULT, loadEmuPrefs,
  padBtnName, padBtnLabel } from '${ROOT}/src/input';
globalThis.__X = { APP_VERSION, VERSION, QUICKSAVE_KEY_DEFAULT, QUICKSAVE_PAD_DEFAULT,
  FURN_KEY_DEFAULT, FURN_PAD_DEFAULT, PADTOGGLE_KEY_DEFAULT, PADTOGGLE_PAD_DEFAULT,
  ZOOMIN_KEY_DEFAULT, ZOOMIN_PAD_DEFAULT, ZOOMOUT_KEY_DEFAULT, ZOOMOUT_PAD_DEFAULT,
  PADMOUSE_SPEED_DEFAULT, loadEmuPrefs, padBtnName, padBtnLabel };
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
check('ВЕРСИЯ 0.171.0 / APP_VERSION 165', X.VERSION === '0.171.0' && X.APP_VERSION === 165, `${X.VERSION} / ${X.APP_VERSION}`);

/* ---------- (1) padMouse.ts ---------- */
const pm = src('src/padMouse.ts');
check('padMouse: экспорт usePadMouse и PAD_MOUSE_HINT', pm.includes('export function usePadMouse') && pm.includes('export const PAD_MOUSE_HINT'));
check('padMouse: глобальное вкл/выкл (padMouseSetOff/padMouseIsOff/подписчики)', pm.includes('export function padMouseSetOff') && pm.includes('export function padMouseIsOff') && pm.includes('export function padMouseOnOffChange'));
check('padMouse: usePadMouseOff — React-хук состояния для подсказок', pm.includes('export function usePadMouseOff'));
check('padMouse: режим «только курсор» (padMouseSetClicksOff, клики гасятся)', pm.includes('export function padMouseSetClicksOff') && pm.includes('if (clicksOff || uiLock) return;'));
check('padMouse: замок на время захвата кнопки (padMouseSetUiLock)', pm.includes('export function padMouseSetUiLock'));
check('padMouse: userOff гасит курсор и отпускает «залипшие» кнопки', pm.includes('if (userOff) { releaseAll(); hide(); return; }'));
check('padMouse: чувствительность — padMouseSpeed умножает скорость', pm.includes('prefs.padMouseSpeed') && pm.includes('MAX_SPEED * spd * dt'));
check('padMouse: правый стик — оси 2/3, R2 (W3C 7) = ЛКМ, R1 (W3C 5) = ПКМ (фиксировано)', /const AXIS_X = 2;/.test(pm) && /const AXIS_Y = 3;/.test(pm) && /const BTN_LMB = 7;/.test(pm) && /const BTN_RMB = 5;/.test(pm));
check('padMouse: тумблер usePadMouseToggle — клавиатура + край-триггер пада', pm.includes('export function usePadMouseToggle') && pm.includes('padMouseSetOff(!userOff)'));
check('padMouse: события в точке курсора через elementFromPoint + contextmenu', pm.includes('document.elementFromPoint') && pm.includes("'contextmenu'"));
check('padMouse: тумблер «Геймпад» в Опциях уважается', pm.includes('prefs.gamepad === false'));

/* ---------- (2) input.ts ---------- */
check('input: дефолты v0.171 (F5/R3, E/0, F7/10, L1 «+» / L2 «-», скорость 1)',
  X.QUICKSAVE_KEY_DEFAULT === 'f5' && X.QUICKSAVE_PAD_DEFAULT === 11 &&
  X.FURN_KEY_DEFAULT === 'e' && X.FURN_PAD_DEFAULT === 0 &&
  X.PADTOGGLE_KEY_DEFAULT === 'f7' && X.PADTOGGLE_PAD_DEFAULT === 10 &&
  X.ZOOMIN_KEY_DEFAULT === '+' && X.ZOOMIN_PAD_DEFAULT === 4 &&
  X.ZOOMOUT_KEY_DEFAULT === '-' && X.ZOOMOUT_PAD_DEFAULT === 6 &&
  X.PADMOUSE_SPEED_DEFAULT === 1);
check('input: loadEmuPrefs читает новые поля из localStorage', (() => {
  const s = src('src/input.ts');
  return s.includes('quickSaveKey: typeof p.quickSaveKey') && s.includes('furnPad: typeof p.furnPad') &&
    s.includes('padTogglePad: typeof p.padTogglePad') && s.includes('zoomInPad: typeof p.zoomInPad') &&
    s.includes('padMouseSpeed: typeof p.padMouseSpeed === \'number\' && p.padMouseSpeed >= 0.3 && p.padMouseSpeed <= 2.5');
})());
check('input: padBtnName/padBtnLabel — имена кнопок пада (L3, R1 (RB)…)', X.padBtnName(10) === 'L3' && X.padBtnName(5) === 'R1 (RB)' && X.padBtnLabel(4).includes('L1'));
check('input: чувствительность в подсказке ползунка 0,3–2,5', (() => {
  const s = src('src/KeyBinder.tsx');
  return s.includes('min={0.3}') && s.includes('max={2.5}');
})());

/* ---------- (3) App.tsx ---------- */
const ap = src('src/App.tsx');
check('App: мышь с джойстика смонтирована ГЛОБАЛЬНО (usePadMouse(true) + usePadMouseToggle)', ap.includes('usePadMouse(true);') && ap.includes('usePadMouseToggle();'));

/* ---------- (4) GameScreen.tsx ---------- */
const gs = src('src/screens/GameScreen.tsx');
check('GameScreen: локальный вызов usePadMouse УБРАН (глобальный в App — без двойного курсора)', !gs.includes('usePadMouse('));
check('GameScreen: авто-режим окон заданий (игра крутится — мышь ВЫКЛ)', gs.includes('padMouseSetOff(emuRunInWin)') && gs.includes('!!myQJob && qArmed && !qPaused'));
check('GameScreen: окно задания закрылось — мышь снова ВКЛ (по заказу)', gs.includes('if (!open) padMouseSetOff(false);'));
check('GameScreen: «только курсор» на чистом поле (padMouseSetClicksOff)', gs.includes('padMouseSetClicksOff(!!bare)'));
check('GameScreen: в окнах заданий окно VERSUS/QUEST/RUBG учтено (ch + myQJob + myJob)', gs.includes('!!ch && myTurn && !!ch.started && ch.status === \'playing\' && !ch.paused') && gs.includes('!!myJob && rubgJobArmed && !rubgPaused'));
check('GameScreen: БЫСТРОЕ СОХРАНЕНИЕ — useQuickSave + локальные точки возврата (qSaveState/rSaveState/saveState)', gs.includes('useQuickSave(quickSaveFire);') && gs.includes('setQSaveState(st)') && gs.includes('setRSaveState(st)') && gs.includes('setSaveState(st)'));
check('GameScreen: зум L1/L2 — карта мира/заглядывание (worldZoom) и осмотр фишки (lookZoomRef)', gs.includes('zoomApplyRef.current(1.16)') && gs.includes('setWorldZoom((z) => Math.min(4, Math.max(0.3, z * f)))') && gs.includes('lookZoomRef.current = Math.min(2.5, Math.max(0.5, lookZoomRef.current * f))'));
check('GameScreen: зум с клавиатуры «+»/«-» (zoomInKey/zoomOutKey)', gs.includes('prefs.zoomInKey ?? ZOOMIN_KEY_DEFAULT') && gs.includes('prefs.zoomOutKey ?? ZOOMOUT_KEY_DEFAULT'));
check('GameScreen: печь/приставка — СВОЯ кнопка furnPad (крест-A), читается напрямую с пада', gs.includes('padBtnDown(prefs.furnPad ?? FURN_PAD_DEFAULT)') && gs.includes('const padBtnDown = (idx: number)'));
check('GameScreen: печь/приставка — своя клавиша furnKey (E, русская У тоже)', gs.includes('prefsK.furnKey ?? FURN_KEY_DEFAULT') && gs.includes("fk === 'e' && e.key.toLowerCase() === 'у'"));
check('GameScreen: guard «у печи предмет рядом — приоритет подъёма» сохранён', gs.includes('nearItemRef.current && padBtnDown(pickPad)'));
check('GameScreen: подсказки мыши в ТРЁХ окнах заданий (VERSUS/QUEST+БОГАЧ+FRENDY/RUBG)', (gs.match(/Мышь с джойстика ВЫКЛЮЧЕНА/g) || []).length >= 3);
check('GameScreen: подсказка показывает состояние и тумблер (padMouseOffUi + padToggleHint)', gs.includes('padMouseOffUi') && gs.includes('padToggleHint'));

/* ---------- (5) KeyBinder.tsx ---------- */
const kb = src('src/KeyBinder.tsx');
check('KeyBinder: 9 глобальных кнопок (быстрая загрузка/сохранение, инвентарь, подъём, печь, назад, тумблер, зум ±)', (() => {
  const need = ['quickLoad', 'quickSave', 'invOpen', 'itemPickup', 'furnOpen', 'invBack', 'padToggle', 'zoomIn', 'zoomOut'];
  return need.every((a) => kb.includes(`'${a}'`));
})());
check('KeyBinder: «БЫСТРОЕ СОХРАНЕНИЕ» и «ОТКРЫТЬ ПЕЧЬ / ПРИСТАВКУ» в списке', kb.includes('💾 Быстрое сохранение') && kb.includes('🔥 ОТКРЫТЬ ПЕЧЬ / ПРИСТАВКУ'));
check('KeyBinder: тумблер мыши и зум карты в списке', kb.includes('МЫШЬ С ДЖОЙСТИКА вкл/выкл') && kb.includes('ПРИБЛИЗИТЬ КАРТУ') && kb.includes('ОТДАЛИТЬ КАРТУ'));
check('KeyBinder: ФИКСИРОВАННАЯ мышь — только ПОКАЗАНА (не переназначается)', kb.includes('ФИКСИРОВАННО — НЕ ПЕРЕНАЗНАЧАЕТСЯ') && kb.includes('PAD_MOUSE_HINT'));
check('KeyBinder: Xbox-имена в подсказке (R1 = RB, R2 = RT)', kb.includes('R1 = RB (правый бампер), R2 = RT'));
check('KeyBinder: ползунок чувствительности (input range + padMouseSpeed)', kb.includes('type="range"') && kb.includes('padMouseSpeed: Number(e.target.value)'));
check('KeyBinder: имена кнопок пада в подписях (padBtnLabel)', kb.includes('padBtnLabel(padOf()[a] ?? 0)') && kb.includes('globalPadLbl(ga)'));
check('KeyBinder: захват клавиш/пада v0.171 через GLOBAL_FIELDS/GLOBAL_PAD_FIELDS', kb.includes('GLOBAL_FIELDS[gi]') && kb.includes('GLOBAL_PAD_FIELDS[gi]'));
check('KeyBinder: uiLock — во время захвата тумблер мыши заблокирован', kb.includes('padMouseSetUiLock(!!capture)'));

/* ---------- (6) OptionsScreen.tsx ---------- */
const op = src('src/screens/OptionsScreen.tsx');
check('Options: «Управление (все платформы)» — табы всех консолей + KeyBinder', op.includes('Управление (все платформы)') && op.includes('KeyBinderAllFamilies') && op.includes("fam: 'a26'") && op.includes("fam: 'pce'"));

/* ---------- (7) EmulatorLauncher.tsx ---------- */
const el = src('src/screens/EmulatorLauncher.tsx');
check('EmulatorLauncher: быстрое сохранение ПЕРЕЗАПИСЫВАЕТ выделенное (idbPut + refresh)', el.includes('useQuickSave(quickSaveFire);') && el.includes('⚡ Сохранено в «'));
check('EmulatorLauncher: кнопка «Быстрое сохранение» рядом с быстрой загрузкой', el.includes('💾 Быстрое сохранение'));
check('EmulatorLauncher: авто-выкл мыши при запущенной игре + возврат при выходе', el.includes('padMouseSetOff(!!running)') && el.includes('return () => padMouseSetOff(false);'));
check('EmulatorLauncher: подсказка мыши с живыми подписями тумблера', el.includes('padToggleKey') && el.includes('PAD_MOUSE_HINT'));

/* ---------- (8) MapEditor.tsx ---------- */
const mе = src('src/screens/MapEditor.tsx');
check('MapEditor: зум L1/L2 с джойстика (edge + автоповтор 170 мс)', mе.includes('prefs.zoomInPad ?? ZOOMIN_PAD_DEFAULT') && mе.includes('zoomStepRef.current(1.15)'));
check('MapEditor: зум с клавиатуры «+»/«-»', mе.includes('prefs.zoomInKey ?? ZOOMIN_KEY_DEFAULT') && mе.includes('zoomStepRef.current(k === inK ? 1.15 : 1 / 1.15)'));

/* ---------- регрессии v0.170 не сломаны ---------- */
check('v0.170 жив: подсказка в окне инвентаря (PAD_MOUSE_HINT · B/Esc — назад)', gs.includes('{PAD_MOUSE_HINT} · B (круг) / Esc — назад'));
check('v0.170 жив: кнопка «ВЫХОД ИЗ ОКНА / НАЗАД» закрывает окна (invBackKey/invBackPad)', gs.includes('prefs.invBackKey ?? INVBACK_KEY_DEFAULT') && gs.includes('loadEmuPrefs().invBackPad ?? INVBACK_PAD_DEFAULT'));
const fi = src('src/screens/FrendyInv.tsx');
check('v0.170 жив: подсказки в окнах печи/приставки', (fi.match(/PAD_MOUSE_HINT/g) || []).length >= 2);
const me169 = src('src/screens/MapEditor.tsx');
check('v0.169 жив: карта QUIZowo сохраняется без квизов', me169.includes('Квизов пока нет — карта сохранится'));

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* noop */ }
console.log(ok ? 'SMOKE OK' : 'SMOKE FAIL');
process.exit(ok ? 0 : 1);
