/* Смоук v0.139: ПЯТЬ ПРАВОК ПО ЗАКАЗУ —
   (1) FRENDY: перезапуск задания убран — кнопка скрыта (!isFrendy), F6 молчит (isFrendy return),
       qRestart в движке только для bogach;
   (2) анимации Салли/Молдера: ОТКАТ v0.138 — epiAlderSegRef удалён, снова экспонента 0.22;
   (3) ярость Френди: константы FRENDY_FURY и ULTRA + логика furious/ultra в frendyTickDo,
       триггер furyUntil во frendyBurn, HUD-бейдж «ЯРОСТЬ ФРЕНДИ»;
   (4) «Тайные материалы» вместо «Секретных материалов» в живых строках;
   (5) помощь: раздел FRENDY (5 слайдов, кадры webp, озвучка frendy-0..4.mp3), курс игрока, intro-2 переозвучен.
   Запуск: node scripts/v139-smoke.mjs (esbuild бандлит, import.meta.glob — заглушка). */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = path.join(ROOT, 'scripts', 'v139-tmp');
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
import { APP_VERSION, FRENDY_FURY_MS, FRENDY_FURY_SPEED, FRENDY_ULTRA_SPEED, FRENDY_ULTRA_TP_MS, FRENDY_ULTRA_HIT_CD } from '${ROOT}/src/types';
import { VERSION } from '${ROOT}/src/version';
import { TRAINING } from '${ROOT}/src/trainingData';
globalThis.__X = { APP_VERSION, VERSION, TRAINING, FRENDY_FURY_MS, FRENDY_FURY_SPEED, FRENDY_ULTRA_SPEED, FRENDY_ULTRA_TP_MS, FRENDY_ULTRA_HIT_CD };
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

/* версия */
check('ВЕРСИЯ 0.139.0 / APP_VERSION 133', X.VERSION === '0.139.0' && X.APP_VERSION === 133, `${X.VERSION} / ${X.APP_VERSION}`);

/* (1) перезапуск задания во FRENDY убран */
const gs = src('src/screens/GameScreen.tsx');
const eng = src('src/engine.ts');
check('F6 во время задания FRENDY молчит', gs.includes('if (isFrendy) return; // v0.139: перезапуска задания во FRENDY нет'));
check('кнопка «Перезапуск» скрыта во FRENDY', gs.includes('{!isFrendy && (') && gs.includes("grid ${isFrendy ? 'grid-cols-2' : 'grid-cols-3'}"));
check('кнопка шлёт qRestart только в VERSUS', !gs.includes('isBogach || isFrendy) dispatch'));
check('таймер истёк во FRENDY = поражение (force)', gs.includes("dispatch({ t: 'qJobDone', id: me, cellIdx: myQJob.cellIdx, win: false, force: true })"));
check('движок принимает force только для поражения', eng.includes('codeOnly && !a.byCode && !a.force') && eng.includes('v0.139 force — поражение по ТАЙМЕРУ'));

check('qRestart: только bogach, ветки FRENDY нет', /case 'qRestart': \{[\s\S]*?map\.mode !== 'bogach'\) break;[\s\S]*?\n    \}/.test(eng) && !/case 'qRestart':[\s\S]{0,900}?isFrendyMode\(map\.mode\)\) \{[\s\S]{0,300}?questDefeatApply[\s\S]{0,200}?\}/.test(eng));

/* (2) откат анимаций агентов к v0.136 */
check('epiAlderSegRef удалён (откат v0.138)', !gs.includes('epiAlderSegRef'));
check('экспонента 0.22 у Молдера возвращена', gs.includes('as.x += (epiS.alder.x - as.x) * 0.22;'));
check('порог «идёт» 2.5 возвращён', gs.includes("epiS.stage === 'walk' && Math.hypot(epiS.alder.x - as.x, epiS.alder.y - as.y) > 2.5"));
check('Фредди-экстраполяция не тронута', gs.includes('frendyHostSegRef'));

/* (3) ярость Френди */
check('константы ярости/ультра в types.ts', X.FRENDY_FURY_MS === 120000 && X.FRENDY_FURY_SPEED === 1.5 && X.FRENDY_ULTRA_SPEED === 1.75 && X.FRENDY_ULTRA_TP_MS === 6000 && X.FRENDY_ULTRA_HIT_CD === 800);
check('frendyTickDo: furious/ultra вычисляются', eng.includes("const furious = (f.furyUntil ?? 0) > now || map.frendyAggr === 'rage';") && eng.includes('const ultra = chipsLeft === 1;'));
check('в ярости не спит и не растворяется', eng.includes('if (now < f.nextSpawnAt && !furious && !ultra) return;') && eng.includes('if (!furious && !ultra && now - b.sinceTs > prm.huntMs'));
check('ультра телепортируется и бьёт всех', eng.includes('FRENDY_ULTRA_TP_MS') && eng.includes('ФРЕНДИ УЛЬТРА бьёт лапами ВСЕХ рядом'));
check('сжигание включает ярость на 2 мин', eng.includes('f.furyUntil = nowB + FRENDY_FURY_MS;'));
check('HUD-бейдж «ЯРОСТЬ ФРЕНДИ»', gs.includes('⚡ ЯРОСТЬ ФРЕНДИ'));

/* (4) Тайные материалы */
check('шапка сцен Френди — «Тайные материалы»', src('src/screens/FrendyCine.tsx').includes('Френди · Тайные материалы'));
check('шапка разговора агентов — «Тайные материалы»', src('src/screens/AgentsVn.tsx').includes('Тайные материалы · реплика'));
check('плашка задания эпилога — «Тайные материалы»', gs.includes('📁 Тайные материалы — задание'));
check('лог агентов — «Тайные материалы» + имена', eng.includes('АГЕНТЫ МОЛДЕР и САЛЛИ (ФБР, неофициально). «Тайные материалы» продолжаются'));

/* (5) помощь: раздел FRENDY */
const trd = src('src/trainingData.ts');
const frendy = X.TRAINING.find((s) => s.id === 'frendy');
check('раздел FRENDY есть, 5 слайдов', !!frendy && frendy.slides.length === 5);
check('заголовок и порядок раздела', !!frendy && frendy.title === 'Режим FRENDY');
const frames = ['frendyStart', 'frendyMode', 'frendyBoard', 'frendyChips', 'frendyFurnace', 'frendyHunt', 'frendyFury', 'frendyUltra', 'frendyWin', 'frendyLose'];
const missingFrames = frames.filter((f) => !fs.existsSync(path.join(ROOT, 'src/assets/training', f + '.webp')));
check('все 10 кадров webp на месте', missingFrames.length === 0, missingFrames.join(',') || '');
const missingVoice = ['frendy-0', 'frendy-1', 'frendy-2', 'frendy-3', 'frendy-4'].filter((f) => {
  const p = path.join(ROOT, 'src/assets/training/voice', f + '.mp3');
  return !fs.existsSync(p) || fs.statSync(p).size < 20000;
});
check('озвучка frendy-0..4 на месте (>20 КБ)', missingVoice.length === 0, missingVoice.join(',') || '');
check('intro-2.mp3 переозвучен (свежий, >200 КБ)', fs.statSync(path.join(ROOT, 'src/assets/training/voice/intro-2.mp3')).size > 200000);
check('слайд режимов — 6 режимов', trd.includes("t: 'Режимы партий'") && trd.includes('Режимов шесть'));
const tss = src('src/screens/TrainingScreen.tsx');
check('раздел FRENDY в «Курсе игрока»', tss.includes("'quest', 'rubg', 'frendy', 'solo'"));
/* narr каждого слайда FRENDY непустой */
check('у всех слайдов FRENDY есть narr', !!frendy && frendy.slides.every((s) => typeof s.narr === 'string' && s.narr.length > 100));

console.log(ok ? 'SMOKE OK' : 'SMOKE FAIL');
process.exit(ok ? 0 : 1);
