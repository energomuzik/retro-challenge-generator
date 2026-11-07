/* Смоук v0.170: МЫШЬ С ДЖОЙСТИКА В ОКНАХ —
   (1) padMouse.ts: usePadMouse — правый стик (оси 2/3) двигает курсор, R2 (W3C 7) = ЛКМ,
       R1 (W3C 5) = ПКМ; раскладка ФИКСИРОВАННАЯ; синтетические pointer/mouse-события
       в точке курсора (elementFromPoint); click — только при нажатии и отпускании
       на том же элементе; «залипшие» кнопки отпускаются при выключении.
   (2) input.ts: invBackKey/invBackPad (Esc / B-круг) в EmuPrefs + loadEmuPrefs.
   (3) KeyBinder.tsx: строка «ВЫХОД ИЗ ОКНА / НАЗАД» в глобальных кнопках (захват клавиши и пада).
   (4) GameScreen.tsx: usePadMouse активен, пока открыты окна (инвентарь/печь/приставка);
       кнопка «Назад» закрывает их (клавиша + край-триггер пада); подсказка в окне инвентаря.
   (5) FrendyInv.tsx: подсказки в окнах печи и приставки.
   Запуск: node scripts/v170-smoke.mjs (esbuild бандлит, import.meta.glob — заглушка). */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = path.join(ROOT, 'scripts', 'v170-tmp');
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
import { INVBACK_KEY_DEFAULT, INVBACK_PAD_DEFAULT, loadEmuPrefs } from '${ROOT}/src/input';
globalThis.__X = { APP_VERSION, VERSION, INVBACK_KEY_DEFAULT, INVBACK_PAD_DEFAULT, loadEmuPrefs };
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
check('ВЕРСИЯ 0.170.0 / APP_VERSION 164', X.VERSION === '0.170.0' && X.APP_VERSION === 164, `${X.VERSION} / ${X.APP_VERSION}`);

/* ---------- (1) padMouse.ts ---------- */
const pm = src('src/padMouse.ts');
check('padMouse: экспорт usePadMouse и PAD_MOUSE_HINT', pm.includes('export function usePadMouse') && pm.includes('export const PAD_MOUSE_HINT'));
check('padMouse: правый стик — оси 2/3 (W3C)', /const AXIS_X = 2;/.test(pm) && /const AXIS_Y = 3;/.test(pm));
check('padMouse: R2 (W3C 7) = ЛКМ, R1 (W3C 5) = ПКМ', /const BTN_LMB = 7;/.test(pm) && /const BTN_RMB = 5;/.test(pm));
check('padMouse: подсказка с именами PS и Xbox (R2 (RT), R1 (RB))', pm.includes('R2 (RT) — ЛКМ · R1 (RB) — ПКМ'));
check('padMouse: раскладка объявлена ФИКСИРОВАННОЙ (без настроек)', pm.includes('ФИКСИРОВАННАЯ') && pm.includes('НЕ переназначается'));
check('padMouse: события в точке курсора через elementFromPoint', pm.includes('document.elementFromPoint'));
check('padMouse: dispatch НАСТОЯЩИХ pointer/mouse-событий (pointerdown + mousedown, contextmenu)', pm.includes("'pointerdown'") && pm.includes("'mousedown'") && pm.includes("'contextmenu'"));
check('padMouse: click только при отпускании на том же элементе', /if \(el === st\.lmbEl\) fire\(el, 'click'/.test(pm));
check('padMouse: pointermove при движении (призрак тащения следует)', pm.includes("'pointermove'") && pm.includes("'mousemove'"));
check('padMouse: pointerType mouse + isPrimary (инвентарь принимает за мышь)', pm.includes("pointerType: 'mouse'") && pm.includes('isPrimary: true'));
check('padMouse: мёртвая зона стика', /const DEADZONE = 0\.22;/.test(pm));
check('padMouse: «залипшие» кнопки отпускаются при выключении (releaseAll в cleanup)', /return \(\) => \{\s*\n\s*cancelAnimationFrame\(raf\);\s*\n\s*releaseAll\(\);/.test(pm));
check('padMouse: тумблер «Геймпад» в Опциях уважается (prefs.gamepad === false → скрыть)', pm.includes('prefs.gamepad === false'));
check('padMouse: без пада курсор не показывается', pm.includes('if (!gp) { hide(); return; }'));

/* ---------- (2) input.ts ---------- */
check('input: INVBACK_KEY_DEFAULT = escape, INVBACK_PAD_DEFAULT = 1 (B/круг)', X.INVBACK_KEY_DEFAULT === 'escape' && X.INVBACK_PAD_DEFAULT === 1);
check('input: invBackKey/invBackPad в EmuPrefs', pm0());
function pm0() {
  const s = src('src/input.ts');
  return s.includes('invBackKey?: string;') && s.includes('invBackPad?: number;') && s.includes('invBackKey: INVBACK_KEY_DEFAULT') && s.includes('invBackPad: INVBACK_PAD_DEFAULT');
}
check('input: loadEmuPrefs восстанавливает invBack-кнопку из сохранённых настроек', src('src/input.ts').includes("invBackKey: typeof p.invBackKey === 'string' && p.invBackKey ? p.invBackKey.toLowerCase() : INVBACK_KEY_DEFAULT"));

/* ---------- (3) KeyBinder.tsx ---------- */
const kb = src('src/KeyBinder.tsx');
check('KeyBinder: строка «ВЫХОД ИЗ ОКНА / НАЗАД» в глобальных кнопках', kb.includes("'invBack'") && kb.includes('🚪 ВЫХОД ИЗ ОКНА / НАЗАД'));
check('KeyBinder: захват КЛАВИШИ для invBack (поле invBackKey)', kb.includes("capture.action === 'invBack' ? 'invBackKey'"));
check('KeyBinder: захват КНОПКИ ПАДА для invBack (поле invBackPad)', kb.includes("else if (c.action === 'invBack') next = { ...prev, invBackPad: bi }"));
check('KeyBinder: подписи по умолчанию (Esc / ДЖОЙ 1)', kb.includes('INVBACK_KEY_DEFAULT') && kb.includes('INVBACK_PAD_DEFAULT'));
check('KeyBinder: описание фиксированной мыши (правый стик, R2/RT, R1/RB)', kb.includes('правый стик — курсор, R2/RT — ЛКМ, R1/RB — ПКМ'));

/* ---------- (4) GameScreen.tsx ---------- */
const gs = src('src/screens/GameScreen.tsx');
check('GameScreen: usePadMouse активен, пока открыты окна (инвентарь/печь/приставка)', gs.includes('usePadMouse(!!(invOpen || furnOpen || consoleOpen))'));
check('GameScreen: клавиша «Назад» закрывает окна (invBackKey)', gs.includes('prefs.invBackKey ?? INVBACK_KEY_DEFAULT'));
check('GameScreen: кнопка пада «Назад» — край-триггер (invBackPad)', gs.includes('invBackPadPrevRef.current') && gs.includes('loadEmuPrefs().invBackPad ?? INVBACK_PAD_DEFAULT'));
check('GameScreen: «Назад» закрывает инвентарь → печь → приставку', /if \(invOpen\) \{ setInvOpen\(false\); sfx\.click\(\); \}\s*\n\s*else if \(furnOpen\) \{ setFurnOpen\(false\); sfx\.click\(\); \}\s*\n\s*else if \(consoleOpen\) \{ setConsoleOpen\(false\); sfx\.click\(\); \}/.test(gs));
check('GameScreen: дубли закрытия печи/приставки лицевыми не создаются (isFace)', gs.includes('const isFace = padIdx >= 0 && padIdx <= 3;'));
check('GameScreen: подсказка мыши в окне инвентаря — только при подключённом паде', gs.includes('{listGamepads().length > 0 && (') && gs.includes('{PAD_MOUSE_HINT} · B (круг) / Esc — назад'));

/* ---------- (5) FrendyInv.tsx ---------- */
const fi = src('src/screens/FrendyInv.tsx');
check('FrendyInv: подсказка мыши в окне ПЕЧИ', (fi.match(/PAD_MOUSE_HINT} · B \(круг\) \/ Tab — закрыть/g) || []).length >= 2);
check('FrendyInv: PAD_MOUSE_HINT импортирован', fi.includes("import { PAD_MOUSE_HINT } from '../padMouse';"));

/* ---------- регрессии v0.169 не сломаны ---------- */
const me = src('src/screens/MapEditor.tsx');
check('v0.169 жив: карта QUIZowo сохраняется без квизов (инфо-тост)', me.includes('Квизов пока нет — карта сохранится'));
const lb = src('src/screens/Lobby.tsx');
check('v0.169 жив: лобби блокирует старт QUIZowo без квизов', lb.includes('noQuizzes'));

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* noop */ }
console.log(ok ? 'SMOKE OK' : 'SMOKE FAIL');
process.exit(ok ? 0 : 1);
