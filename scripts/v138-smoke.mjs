/* Смоук v0.138: ВОСЕМЬ ПРАВОК ПО ЗАКАЗУ —
   (1) ходьба Френди: 15 кадров на месте, FRENDY_WALK_MS = 55 (цикл виден целиком —
       фикс обрывов в п.3/4);
   (2) старый кадр (свитер+федора) не проскакивает: drawFrendyBossFallback УДАЛЁН из
       render.ts, в frendyAssets — предзагрузка всех кадров (idle+15 walk+портрет);
   (3)+(4) плавная погоня Френди: в GameScreen есть сегмент-экстраполяция (frendyHostSegRef),
       гистерезис «идёт/стоит» (frendyStillTsRef), экспонента 0.22 для Френди убрана;
   (5) инвентарь: invBlockRef проверяется в трёх путях ввода (клавиши, геймпад, D-pad)
       и сбрасывает journeyKeys при открытии;
   (6) режим VERSUS: плашка в лобби «VERSUS», обучение «Режим VERSUS», слова «Спринтер»
       нет вне исторических комментариев версий;
   (7) Молдер в эпилоге: экстраполяция epiAlderSegRef, движущий кадр по скорости (не по дистанции);
   (8) портрет: frendy-portrait.png 560×736 (перекадрирован под бюст).
   Запуск: node scripts/v138-smoke.mjs (esbuild бандлит, import.meta.glob — заглушка). */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = path.join(ROOT, 'scripts', 'v138-tmp');
fs.mkdirSync(TMP, { recursive: true });

let ok = true;
const check = (name, cond, extra = '') => {
  console.log(`${cond ? 'OK ' : 'FAIL'} ${name}${extra ? ' — ' + extra : ''}`);
  if (!cond) ok = false;
};

/* ---------- код через esbuild (glob — заглушка) ---------- */
const out = path.join(TMP, 'code.cjs');
await build({
  stdin: {
    contents: `
import { APP_VERSION } from '${ROOT}/src/types';
import { VERSION } from '${ROOT}/src/version';
import * as FA from '${ROOT}/src/frendyAssets';
globalThis.__X = { APP_VERSION, VERSION, FA };
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
createRequire(import.meta.url)(out);
const { APP_VERSION, VERSION, FA } = globalThis.__X;

/* версия */
check('ВЕРСИЯ 0.138.0 / APP_VERSION 132', VERSION === '0.138.0' && APP_VERSION === 132, `${VERSION} / ${APP_VERSION}`);

/* (1) ходьба: 15 кадров + темп */
check('П1 ходьба: FRENDY_WALK_MS = 55', FA.FRENDY_WALK_MS === 55, `FRENDY_WALK_MS=${FA.FRENDY_WALK_MS}`);
for (let i = 0; i < 15; i++) {
  const p = path.join(ROOT, 'src', 'assets', 'frendy', `frendy-walk-${i}.png`);
  check(`П1 кадр frendy-walk-${i}.png есть`, fs.existsSync(p));
}

/* (2) заглушка удалена + предзагрузка */
const render = fs.readFileSync(path.join(ROOT, 'src', 'render.ts'), 'utf8');
check('П2 render.ts: drawFrendyBossFallback удалён', !render.includes('drawFrendyBossFallback'));
check('П2 render.ts: в комментарии объяснение (старый облик невозможен)', render.includes('старый облик невозможен'));
const fa = fs.readFileSync(path.join(ROOT, 'src', 'frendyAssets.ts'), 'utf8');
check('П2 frendyAssets: предзагрузка всех кадров (idle+walk+портрет)',
  fa.includes('ПРЕДЗАГРУЗКА ВСЕХ КАДРОВ') && fa.includes('[...idleUrls, ...walkUrls'));

/* (3)(4) плавная погоня Френди */
const gs = fs.readFileSync(path.join(ROOT, 'src', 'screens', 'GameScreen.tsx'), 'utf8');
check('П3/4 GameScreen: сегмент-экстраполяция Френди (frendyHostSegRef)', gs.includes('frendyHostSegRef'));
check('П3/4 GameScreen: гистерезис «идёт/стоит» (frendyStillTsRef)', gs.includes('frendyStillTsRef'));
check('П3/4 GameScreen: экстраполяция capped 1.15 тика', gs.includes('Math.min(1.15,'));
const fbBlock = gs.slice(gs.indexOf('const fb0 = sess.frendy?.boss'), gs.indexOf('const epiS = sess.frendy?.epi'));
check('П3/4 GameScreen: экспонента 0.22 у Френди убрана', !fbBlock.includes('* 0.22'));

/* (5) инвентарь — фишка стоит */
check('П5 GameScreen: invBlockRef объявлен и ставится из invOpen',
  gs.includes('const invBlockRef = useRef(false);') && gs.includes('invBlockRef.current = invOpen;'));
check('П5 GameScreen: клавиатура — блок инвентаря',
  gs.includes('if (pocketBlockRef.current || taskWinRef.current || invBlockRef.current) return;'));
check('П5 GameScreen: геймпад — блок инвентаря',
  gs.includes('!pocketBlockRef.current && !taskWinRef.current && !invBlockRef.current'));
check('П5 GameScreen: экранный D-pad — блок инвентаря',
  gs.includes('if (on && (pocketBlockRef.current || invBlockRef.current)) return;'));

/* (6) VERSUS */
const lobby = fs.readFileSync(path.join(ROOT, 'src', 'screens', 'Lobby.tsx'), 'utf8');
check('П6 Lobby: плашка режима VERSUS', lobby.includes("'VERSUS'"));
const train = fs.readFileSync(path.join(ROOT, 'src', 'trainingData.ts'), 'utf8');
check('П6 обучение: «Режим VERSUS»', train.includes('Режим VERSUS'));
check('П6 обучение: «Правила VERSUS»', train.includes('Правила VERSUS'));
/* Спринтер остался ТОЛЬКО в исторических комментариях версий */
const left = [];
for (const f of ['src/screens/Lobby.tsx', 'src/screens/GameScreen.tsx', 'src/engine.ts', 'src/trainingData.ts', 'src/KeyBinder.tsx', 'src/bogach.ts', 'src/types.ts', 'src/screens/MapEditor.tsx']) {
  const txt = fs.readFileSync(path.join(ROOT, f), 'utf8');
  for (const [i, line] of txt.split('\n').entries()) {
    if (line.includes('Спринтер')) {
      const s = line.trim();
      if (/^\/\/\s*(v?0\.\d+|\d+)\s*:/.test(s)) continue; // история версий — ок
      left.push(`${f}:${i + 1}`);
    }
  }
}
check('П6 «Спринтер» только в истории версий', left.length === 0, left.join(', '));
const keyb = fs.readFileSync(path.join(ROOT, 'src', 'KeyBinder.tsx'), 'utf8');
check('П6 KeyBinder: подсказка с VERSUS', keyb.includes('VERSUS'));

/* (7) Молдер в эпилоге */
check('П7 GameScreen: экстраполяция Альдера (epiAlderSegRef)', gs.includes('epiAlderSegRef'));
check('П7 GameScreen: гистерезис Альдера (epiAlderStillTsRef)', gs.includes('epiAlderStillTsRef'));
const epiBlock = gs.slice(gs.indexOf('if (epiS) {'), gs.indexOf('const skPos = sess.journeyPos'));
check('П7 GameScreen: экспонента 0.22 у Альдера убрана', !epiBlock.includes('* 0.22'));

/* (8) портрет 560×736 */
const pp = path.join(ROOT, 'src', 'assets', 'frendy', 'frendy-portrait.png');
check('П8 frendy-portrait.png есть', fs.existsSync(pp));
if (fs.existsSync(pp)) {
  const buf = fs.readFileSync(pp);
  /* PNG IHDR: ширина/высота — байты 16..23 */
  const w = buf.readUInt32BE(16), h = buf.readUInt32BE(20);
  check('П8 портрет 560×736', w === 560 && h === 736, `${w}×${h}`);
}

console.log(ok ? 'SMOKE OK' : 'SMOKE FAIL');
process.exit(ok ? 0 : 1);
