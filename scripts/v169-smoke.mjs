/* Смоук v0.169: КВИЗЫ ПОСЛЕ КАРТЫ —
   (1) MapEditor.tsx: разорван круг «без квизов карту не сохранить — редактор квизов
       требует готовую карту»: карта QUIZowo сохраняется с 0 квизов (инфо-тост), ячейки-квизы
       обязательны как были, кнопка «Квизы карты» (persist → setQuizTarget → quizEditor);
   (2) store.ts/QuizEditor.tsx: quizTarget — одноразовая предвыборка карты;
   (3) Lobby.tsx: «Начать игру» блокируется, пока на QUIZowo-карте нет квизов;
   (4) trainingData.ts: слайд QUIZowo переписан под новый порядок;
   (5) ОЗВУЧКА: quizovo-0/1/2.mp3 существуют (раздел «Режим QUIZowo» больше не молчит).
   Запуск: node scripts/v169-smoke.mjs (esbuild бандлит, import.meta.glob — заглушка). */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = path.join(ROOT, 'scripts', 'v169-tmp');
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
globalThis.__X = { APP_VERSION, VERSION };
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
check('ВЕРСИЯ 0.169.0 / APP_VERSION 163', X.VERSION === '0.169.0' && X.APP_VERSION === 163, `${X.VERSION} / ${X.APP_VERSION}`);

/* ---------- (1) MapEditor.tsx ---------- */
const me = src('src/screens/MapEditor.tsx');
check('старый запрет «карта без квизов не сохраняется» УДАЛЁН', !me.includes('без них QUIZowo не сыграть') && !me.includes('без них QUIZowo не сохранить'));
check('квизы при завершении НЕ обязательны: инфо-тост «карта сохранится»', me.includes('Квизов пока нет — карта сохранится'));
check('тост НЕ блокирует (kind info, без return)', /if \(\(map\.quizzes \?\? \[\]\)\.length === 0\) \{\s*\n\s*\/\* НЕ блокируем[\s\S]*?toast\('Квизов пока нет[\s\S]*?'info'\);\s*\n\s*\}/.test(me));
check('ячейки-квизы обязательны как были', me.includes('на поле нет ни одной ЯЧЕЙКИ-КВИЗА') && me.includes("map.cells.filter((c) => c.type === 'quiz')"));
check('подсказка ячеек про НОВЫЙ порядок (квизы после завершения)', me.includes('квизы к ним создаются в редакторе квизов ПОСЛЕ завершения'));
check('кнопка «Квизы карты» — persist + setQuizTarget + quizEditor', me.includes("Квизы карты — создать вопросы") && me.includes('await persist(); setQuizTarget(map.id); setScreen(\'quizEditor\');'));
check('подсказка порядка под кнопкой (1 ячейки → 2 карта → 3 квизы)', me.includes('2) «Карта создана» — карта сохранится и без квизов'));
check('пресет режима QUIZowo говорит новый порядок', me.includes('Порядок: расставьте ЯЧЕЙКИ-КВИЗЫ на поле и завершите карту'));

/* ---------- (2) store.ts + QuizEditor.tsx ---------- */
const st = src('src/store.ts');
check('store: поле quizTarget + setQuizTarget', st.includes('quizTarget: string | null;') && st.includes('setQuizTarget: (id) => set({ quizTarget: id })'));
const qe = src('src/screens/QuizEditor.tsx');
check('QuizEditor: одноразовая предвыборка карты при монтировании', qe.includes('useApp.getState().quizTarget') && qe.includes('useApp.setState({ quizTarget: null })') && qe.includes('const m = maps.find((x) => x.id === t);'));

/* ---------- (3) Lobby.tsx ---------- */
const lb = src('src/screens/Lobby.tsx');
check('лобби: старт QUIZowo без квизов заблокирован', lb.includes("const noQuizzes = sessionMap?.mode === 'quizovo' && (sessionMap?.quizzes?.length ?? 0) === 0;") && lb.includes('fewPlayers || notReady || notLoaded || noQuizzes'));
check('лобби: подсказка на кнопке «Начать игру»', lb.includes('QUIZowo: на карте нет квизов — создайте вопросы в редакторе квизов'));

/* ---------- (4) trainingData.ts ---------- */
const td = src('src/trainingData.ts');
check('слайд QUIZowo: новый порядок — карта сохранится и БЕЗ квизов', td.includes('она сохранится и БЕЗ квизов'));
check('слайд QUIZowo: старое «редактор карту не сохранит» удалено', !td.includes('редактор карту не сохранит'));
check('слайд QUIZowo: озвучка переписана (Квизово, ячейки → карта → квизы)', td.includes('Автор карты, порядок такой: переключите карту в режим Квизово, расставьте ячейки-квизы на поле и завершите карту'));

/* ---------- (5) озвучка quizovo-0/1/2 ---------- */
for (let i = 0; i < 3; i++) {
  const f = path.join(ROOT, 'src', 'assets', 'training', 'voice', `quizovo-${i}.mp3`);
  const sz = fs.existsSync(f) ? fs.statSync(f).size : 0;
  check(`озвучка quizovo-${i}.mp3 существует и не пуста (≥ 50 КБ)`, sz > 50 * 1024, `${(sz / 1024).toFixed(0)} КБ`);
}

/* ---------- регрессии v0.168 не сломаны ---------- */
const ug = src('src/useGame.ts');
check('v0.168 жив: политика автосейва по режимам (timer/answer/turn)', ug.includes('autosavePolicyOf'));
check('v0.168 жив: 5-минутный тикер', ug.includes('Date.now() - lastAutosave < AUTOSAVE_TIMER_MS'));

try { fs.rmSync(TMP, { recursive: true, force: true }); } catch { /* noop */ }
console.log(ok ? 'SMOKE OK' : 'SMOKE FAIL');
process.exit(ok ? 0 : 1);
