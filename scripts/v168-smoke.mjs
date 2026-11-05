/* Смоук v0.168: СВОЙ АВТОСЕЙВ ДЛЯ КАЖДОГО РЕЖИМА —
   (1) ПОЛИТИКА по режиму (types.ts): классика/versus/skill — 'turn' (ход N как было);
       ФРЕНДИ, QUEST(+SOLO), RUBG, Джёрни(+SOLO), Богач — 'timer' (раз в 5 минут);
       QUIZowo — 'answer' (после каждого ответа квиза);
   (2) useGame.ts: автосейв на действиях работает только по политике (timer — только от
       5-минутного таймера, answer — только quizAnswer), честные имена («Автосейв · 14:32»),
       отдельный 20-секундный тикер с периодом 5 минут, сброс отсчёта в openRoom;
   (3) snapPrune.ts: чистка «ход N» на картах без ходов (флаг prune-2), ручные не тронуты;
   (4) Lobby.tsx: подсказка на «Загрузить игру» про новые правила.
   Запуск: node scripts/v168-smoke.mjs (esbuild бандлит, import.meta.glob — заглушка). */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = path.join(ROOT, 'scripts', 'v168-tmp');
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
import { APP_VERSION, AUTOSAVE_TIMER_MS, autosavePolicyOf } from '${ROOT}/src/types';
import { VERSION } from '${ROOT}/src/version';
globalThis.__X = { APP_VERSION, AUTOSAVE_TIMER_MS, autosavePolicyOf, VERSION };
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
check('ВЕРСИЯ 0.168.0 / APP_VERSION 162', X.VERSION === '0.168.0' && X.APP_VERSION === 162, `${X.VERSION} / ${X.APP_VERSION}`);

/* ---------- (1) политика по режимам ---------- */
check('AUTOSAVE_TIMER_MS = 5 минут', X.AUTOSAVE_TIMER_MS === 5 * 60 * 1000);
const P = X.autosavePolicyOf;
check('классика/VERSUS/SOLO/SKILL — turn («ход N» как было)',
  P('classic') === 'turn' && P('classic1p') === 'turn' && P('skill') === 'turn');
check('ФРЕНДИ / QUEST / QUEST SOLO / RUBG — timer (5 минут)',
  P('frendy') === 'timer' && P('quest') === 'timer' && P('quest1p') === 'timer' && P('rubg') === 'timer');
check('Джёрни / Джёрни SOLO / Богач — тоже без ходов (timer)',
  P('journey') === 'timer' && P('journey1p') === 'timer' && P('bogach') === 'timer');
check('QUIZowo — answer (после ответа на вопрос)', P('quizovo') === 'answer');

/* ---------- (2) useGame.ts ---------- */
const ug = src('src/useGame.ts');
check('автосейв в режимах без ходов НЕ пишется от действий (только таймер)', ug.includes("if (policy === 'timer' && !viaTimer) return;"));
check('QUIZowo: автосейв ТОЛЬКО от quizAnswer (не перед запуском квиза)', ug.includes("if (policy === 'answer' && act?.t !== 'quizAnswer') return;"));
check('политика читается из режима карты', ug.includes('autosavePolicyOf(st.sessionMap.mode)'));
check('демпфер 8 с сохранён (для turn и answer)', ug.includes('now - lastAutosave < 8000'));
check('имя в классике — «Автосейв · ход N»', ug.includes('`Автосейв · ход ${turnNo}`'));
check('имя в режимах без ходов и QUIZowo — «Автосейв · ЧЧ:ММ»', ug.includes('`Автосейв · ${hhmm}`') && ug.includes("padStart(2, '0')"));
check('5-минутный тикер: интервал 20 с, хост, playing, только timer-режимы',
  ug.includes("window.setInterval(() => {\n  const st = useApp.getState();\n  if (!st.room?.isHost || !st.session || !st.sessionMap) return;") &&
  ug.includes("if (st.session.phase !== 'playing') return;") &&
  ug.includes("autosavePolicyOf(st.sessionMap.mode) !== 'timer'") &&
  ug.includes('}, 20000);'));
check('тикер ждёт полные 5 минут с последней записи', ug.includes('Date.now() - lastAutosave < AUTOSAVE_TIMER_MS'));
check('новая партия — отсчёт 5 минут заново (openRoom)', ug.includes('lastAutosave = Date.now(); lastAutosaveTurn = -1;'));
check('все 3 точки вызова передают действие (quizAnswer до политики доходит)',
  ug.includes('void autosaveSession(next, a);') && ug.split('void autosaveSession(next, a);').length === 3 && ug.includes('void autosaveSession(next, act);'));
check('партия завершена (титры) — автосейв по-прежнему молчит', ug.includes("if (next.phase === 'lobby' || next.phase === 'over') return;"));
check('слоты по-прежнему 5 на карту, перезапись по кругу', ug.includes('const AUTO_SLOTS = 5;') && ug.includes('% AUTO_SLOTS;'));

/* ---------- (3) snapPrune.ts ---------- */
const sp = src('src/snapPrune.ts');
check('чистка — новый одноразовый флаг prune-2', sp.includes("const FLAG = 'retropolia-autoslot-prune-2';"));
check('«ход N» на карте без ходов — мусор старой политики (регэксп)', sp.includes('/^Автосейв · ход \\d+$/'));
check('удаление «ход N» только в режимах НЕ-классики', sp.includes("if (pol && pol !== 'turn') del.add(k);"));
check('режим карты для чистки берётся из библиотеки (idbGet maps)', sp.includes("idbGet<GameMap>('maps', mid)") && sp.includes('autosavePolicyOf(m.mode)'));
check('ручно́е сохранение партий чистка НЕ трогает (только auto-*)', sp.includes("'auto-', 'auto-\\uffff'") && sp.includes('РУЧНЫЕ сохранения партий'));
check('держим 5 новейших на карту', sp.includes('const KEEP_PER_MAP = 5;'));

/* ---------- (4) Lobby.tsx ---------- */
const lb = src('src/screens/Lobby.tsx');
check('подсказка «Загрузить игру»: классика — каждый ход', lb.includes('в классике с ходами — каждый ход'));
check('подсказка: режимы без ходов — раз в 5 минут', lb.includes('раз в 5 минут'));
check('подсказка: QUIZowo — после каждого ответа', lb.includes('после каждого ответа на вопрос квиза'));

/* ---------- регрессии v0.167 не сломаны ---------- */
check('v0.167 жив: слоты auto-КАРТА-0..4', ug.includes('`auto-${mid}-${slot}`'));
check('v0.167 жив: карта внутри сейва', ug.includes('map: st.sessionMap,'));
check('v0.166 жив: state не сохраняют гости — только ветки хоста и таймер', ug.split('void autosaveSession(').length === 5); // 4 вызова: 2×(next, a) + (next, act) + таймер

console.log(ok ? 'SMOKE OK' : 'SMOKE FAIL');
process.exit(ok ? 0 : 1);
