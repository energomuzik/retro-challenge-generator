/* Смоук v0.137: ПЯТЬ ПРАВОК ПО ЗАКАЗУ —
   (1) стингер: субтитр «Не выключай приставку, я уже внутри!» (не «печь»);
   (2) диалог агентов: 13 реплик — порядок/тексты/файлы = нумерованный набор заказчика
       (позиция N = файл «N.Салли/Молдер»; md5 всех 13 flac сверяются с эталоном);
   (3) ходьба Френди: 15 кадров, есть frendy-walk-0..14, FRENDY_WALK_MS = 55;
   (4) формат новеллы: FrendyCine использует портрет (frendyPortrait) и машинку (VnText),
       фигура FrendyFigure — статичная (без интервала дыхания);
   (5) дыхание удалено: frendy-idle-1.png ОТСУТСТВУЕТ, idle — один кадр.
   Запуск: node scripts/v137-smoke.mjs (esbuild бандлит, import.meta.glob — заглушка). */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = path.join(ROOT, 'scripts', 'v137-tmp');
fs.mkdirSync(TMP, { recursive: true });

let ok = true;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'OK ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) ok = false;
};

/* ---------- (2)(4)(5) код через esbuild (glob — заглушка) ---------- */
const out = path.join(TMP, 'code.cjs');
await build({
  stdin: {
    contents: `
import { EPI_SCRIPT } from '${ROOT}/src/agentsAssets';
import { FRENDY_CINE, APP_VERSION } from '${ROOT}/src/types';
import { VERSION } from '${ROOT}/src/version';
import * as FA from '${ROOT}/src/frendyAssets';
globalThis.__X = { EPI_SCRIPT, FRENDY_CINE, APP_VERSION, VERSION, FA };
`,
    loader: 'tsx',
    resolveDir: TMP,
  },
  bundle: true,
  write: true,
  outfile: out,
  format: 'cjs',
  platform: 'node',
  loader: { '.png': 'file', '.flac': 'file', '.mp3': 'file' },
  banner: { js: 'var GLOBAL_GLOB_STUB = function () { return {}; };' },
  define: { 'import.meta.glob': 'GLOBAL_GLOB_STUB', 'import.meta.env': '{}' },
  logLevel: 'silent',
});
createRequire(import.meta.url)(out); // бандл при require кладёт объект в globalThis.__X
const { EPI_SCRIPT, FRENDY_CINE, APP_VERSION, VERSION, FA } = globalThis.__X;

/* (1) стингер */
const sting = FRENDY_CINE.sting[0].t;
check('П1 стингер: «приставку» в субтитре', sting.includes('Не выключай приставку, я уже внутри!'), sting);
check('П1 стингер: слова «печь» больше нет', !sting.includes('печь'));

/* (2) диалог: 13 реплик в порядке заказчика */
const WANT = [
  ['skaller', 'Я думала ты все еще боишься подвального монстра из печи.', 'skaller-1.flac'],
  ['alder', 'Температура в этой печи была настолько высока, что могла расплавить сталь.', 'alder-1.flac'],
  ['skaller', 'Кто то очень не хотел, то что сожгли в ней вообще существовало.', 'skaller-2.flac'],
  ['alder', 'Или кто то...', 'alder-2.flac'],
  ['alder', 'Есть хоть какие ни будь отпечатки ДНК, хоть какие ни будь зацепки?', 'alder-2-2.flac'],
  ['skaller', 'Ничего, кроме вот этой вещицы, не понятно как она не расплавилась, но на ней любопытный узор.', 'skaller-3.flac'],
  ['alder', 'Похож на слона или Гиппопотама. Наш виновник призрак из зоопарка?', 'alder-3.flac'],
  ['skaller', 'Я отдам ее нашим специалистам, И Молдер ты действительно думаешь, что тут кого то сожгли?', 'skaller-4.flac'],
  ['alder', 'Непременно Салли, "Парильщик" обманывать не будет.', 'alder-4.flac'],
  ['skaller', 'Почему ты так ему доверяешь, ты ведь его совсем не знаешь?', 'skaller-5.flac'],
  ['alder', 'Не важно доверяю ли я ему.', 'alder-5.flac'],
  ['alder', 'Просто Салли- доверься мне хорошо?', 'alder-5-2.flac'],
  ['skaller', 'Пойдем, тут больше делать нечего.', 'skaller-6.flac'],
];
check('П2 диалог: ровно 13 реплик', EPI_SCRIPT.length === 13, String(EPI_SCRIPT.length));
for (let i = 0; i < 13; i++) {
  const ln = EPI_SCRIPT[i];
  const [who, text, file] = WANT[i];
  check(`П2 реплика ${i + 1}: ${who} «${text.slice(0, 24)}…» + ${file}`,
    ln.who === who && ln.text === text,
    ln.who === who && ln.text === text ? 'текст/говорящий ок' : `получено: ${ln.who} «${ln.text.slice(0, 24)}…»`);
}
/* md5 всех 13 flac = нумерованный набор заказчика */
const MD5 = {
  'skaller-1.flac': '6a965e304a44995e302ee30fb2fa3e6e',
  'alder-1.flac': 'abf3835879fcf14686c85730d260b6bb',
  'skaller-2.flac': 'ecc643775abefdfe70b733cab7b151f3',
  'alder-2.flac': 'c35627bc7b18371d78e36b4b2e0cf5a9',
  'alder-2-2.flac': '094db043b790dcae4bcefe7e47b7e50c',
  'skaller-3.flac': 'e586f5d89fad1ef7af0733ed20d45395',
  'alder-3.flac': '08c625815587ea758b973a5cee8b0656',
  'skaller-4.flac': 'd3ea56a582a94f717032f749db2cef6e',
  'alder-4.flac': '33f23c76a1e3a39ac46a7d05f326e79d',
  'skaller-5.flac': 'c7426d590e69dc32c410a435ca7ecb14',
  'alder-5.flac': 'a6d7ea7d6115d9dc13021dafc99f55ba',
  'alder-5-2.flac': '21e5ba0715e6f630b35d03bd92306e97',
  'skaller-6.flac': '465bb04960f610ac4b89a86f894d407d',
};
for (const [file, want] of Object.entries(MD5)) {
  const p = path.join(ROOT, 'src', 'assets', 'agents', file);
  const got = fs.existsSync(p) ? crypto.createHash('md5').update(fs.readFileSync(p)).digest('hex') : 'MISSING';
  check(`П2 аудио ${file}`, got === want, got === want ? 'md5 = файл заказчика' : `md5 ${got.slice(0, 10)} ≠ ${want.slice(0, 10)}`);
}

/* (3) ходьба: 15 кадров + темп */
check('П3 ходьба: 15 кадров', FA.FRENDY_WALK_MS === 55, `FRENDY_WALK_MS=${FA.FRENDY_WALK_MS}`);
for (let i = 0; i < 15; i++) {
  const p = path.join(ROOT, 'src', 'assets', 'frendy', `frendy-walk-${i}.png`);
  check(`П3 кадр frendy-walk-${i}.png есть`, fs.existsSync(p));
}
check('П3 кадров ровно 15 (нет walk-15+)', !fs.existsSync(path.join(ROOT, 'src', 'assets', 'frendy', 'frendy-walk-15.png')));

/* (4) формат новеллы в кат-сценах */
const cine = fs.readFileSync(path.join(ROOT, 'src', 'screens', 'FrendyCine.tsx'), 'utf-8');
check('П4 интро/печь/стингеры: FrendyVnScene (портрет+диалог)', cine.includes('function FrendyVnScene') && cine.includes('frendyPortrait()'));
check('П4 машинка как у агентов (VnText)', cine.includes("from './AgentsVn'"));
const vnCount = (cine.match(/<FrendyVnScene /g) || []).length;
check('П4 портрет+диалог в 4 местах (интро, печь, 2 стингера)', vnCount === 4, `мест: ${vnCount}`);

/* (5) дыхание удалено */
check('П5 frendy-idle-1.png отсутствует', !fs.existsSync(path.join(ROOT, 'src', 'assets', 'frendy', 'frendy-idle-1.png')));
check('П5 фигура без интервала дыхания (setInterval 460 убран)', !/setInterval\(\(\) => setF/.test(cine));
check('П5 у FrendyFigure нет цикла кадров', !cine.includes('frendyFrame(false, 0, f)'));

/* версия */
check('ВЕРСИЯ 0.137.0 / APP_VERSION 131', VERSION === '0.137.0' && APP_VERSION === 131, `v${VERSION} / ${APP_VERSION}`);

console.log(ok ? '\nSMOKE OK' : '\nSMOKE FAIL');
process.exit(ok ? 0 : 1);
