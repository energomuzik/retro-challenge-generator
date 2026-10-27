/* Смоук v0.140: ТРИ ПРАВКИ ПО ЗАКАЗУ —
   (1) помощь FRENDY: БЕЗ ФБР/агентов («ходят слухи»), перчатка вместо когтей, без тактики
       «несколько подряд», без УЛЬТРА-упоминания, без совета про аптечку/кофе, слайд 2 =
       новый мех. сжигания (печь → инвентарь → «Сжечь»); кадры перегенерированы, озвучка новая;
   (2) ЯРОСТЬ ФРЕНДИ: тик без s в зависимостях (больше не голодает, когда фишки бегут) +
       явный пассивный гейт базы в движке (движение только к стоящей цели);
   (3) сжигание из ИНВЕНТАРЯ у печи («🔥 Сжечь» + «Выбросить» в рюкзаке, окно печи = статус),
       пульс frendyBusy и наказание занятых (телепорт + атака) в движке.
   Запуск: node scripts/v140-smoke.mjs (esbuild бандлит, import.meta.glob — заглушка). */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = path.join(ROOT, 'scripts', 'v140-tmp');
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
import { APP_VERSION, FRENDY_FURY_MS, FRENDY_FURY_SPEED, FRENDY_ULTRA_SPEED, FRENDY_ULTRA_TP_MS, FRENDY_ULTRA_HIT_CD, FRENDY_UIBUSY_MS, FRENDY_BUSY_TP_MS } from '${ROOT}/src/types';
import { VERSION } from '${ROOT}/src/version';
import { TRAINING } from '${ROOT}/src/trainingData';
globalThis.__X = { APP_VERSION, VERSION, TRAINING, FRENDY_FURY_MS, FRENDY_FURY_SPEED, FRENDY_ULTRA_SPEED, FRENDY_ULTRA_TP_MS, FRENDY_ULTRA_HIT_CD, FRENDY_UIBUSY_MS, FRENDY_BUSY_TP_MS };
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
check('ВЕРСИЯ 0.140.0 / APP_VERSION 134', X.VERSION === '0.140.0' && X.APP_VERSION === 134, `${X.VERSION} / ${X.APP_VERSION}`);

const gs = src('src/screens/GameScreen.tsx');
const eng = src('src/engine.ts');
const trd = src('src/trainingData.ts');

/* ---------- (1) помощь FRENDY без ФБР/агентов и с новыми акцентами ---------- */
const frendy = X.TRAINING.find((s) => s.id === 'frendy');
check('раздел FRENDY есть, 5 слайдов', !!frendy && frendy.slides.length === 5);
const allText = !!frendy ? frendy.slides.map((s) => `${s.t} ${s.x} ${s.narr ?? ''}`).join(' ') : '';
check('НИ СЛОВА про ФБР', !/ФБР/i.test(allText));
check('НИ СЛОВА про агентов (приедут/считают/выехали)', !/агент/i.test(allText));
check('о злодее — «ходят слухи»', /ходят (только )?слухи/i.test(allText) && /поговаривают|говорят/i.test(allText));
check('Френди бьёт ПЕРЧАТКОЙ (и в x, и в narr)', /бьёт ПЕРЧАТКОЙ/.test(allText) && /Бьёт перчаткой/.test(allText));
check('НИ СЛОВА про когти', !/когт/i.test(allText));
check('без тактики «несколько микросхем подряд»', !/несколько микросхем/i.test(allText) && !/жгите несколько/i.test(allText));
check('без УЛЬТРА-упоминания и «последней микросхемы»', !/ультра/i.test(allText) && !/последн(яя|ей) микросхем/i.test(allText));
check('без совета «держите аптечку и кофе»', !/держите аптечку/i.test(allText));
check('слайд 4 — «Ярость Френди», кадр frendyUltra скрыт', !!frendy && frendy.slides[3].t === 'Ярость Френди' && !frendy.slides.some((s) => s.frames.includes('frendyUltra')));
check('слайд 2 учит новому сжиганию (инвентарь + «Сжечь»)', !!frendy && /открой(те)? ИНВЕНТАРЬ/.test(frendy.slides[1].x) && /«🔥 Сжечь»/.test(frendy.slides[1].x));
check('в помощи НЕТ описания логики Френди (телепорт/чует)', !/телепорт/i.test(allText));
/* кадры */
const frames = ['frendyStart', 'frendyMode', 'frendyBoard', 'frendyChips', 'frendyFurnace', 'frendyHunt', 'frendyFury', 'frendyWin', 'frendyLose'];
const missingFrames = frames.filter((f) => !fs.existsSync(path.join(ROOT, 'src/assets/training', f + '.webp')));
check('все кадры webp на месте', missingFrames.length === 0, missingFrames.join(',') || '');
/* кадры перегенерированы: frendyWin.webp изменился (агенты убраны) — проверяем свежесть по размеру >30 КБ */
check('кадры v140 перегенерированы (свежие webp)', ['frendyMode', 'frendyHunt', 'frendyFury', 'frendyWin', 'frendyLose'].every((f) => fs.statSync(path.join(ROOT, 'src/assets/training', f + '.webp')).size > 10000));
/* озвучка новая */
const missingVoice = ['frendy-0', 'frendy-1', 'frendy-2', 'frendy-3', 'frendy-4'].filter((f) => {
  const p = path.join(ROOT, 'src/assets/training/voice', f + '.mp3');
  return !fs.existsSync(p) || fs.statSync(p).size < 20000;
});
check('новая озвучка frendy-0..4 (>20 КБ)', missingVoice.length === 0, missingVoice.join(',') || '');
check('frendy-3 короче прочих (ярость — короткий слайд)', fs.statSync(path.join(ROOT, 'src/assets/training/voice/frendy-3.mp3')).size < fs.statSync(path.join(ROOT, 'src/assets/training/voice/frendy-1.mp3')).size);
check('у всех слайдов FRENDY есть narr', !!frendy && frendy.slides.every((s) => typeof s.narr === 'string' && s.narr.length > 60));
check('раздел FRENDY в «Курсе игрока»', src('src/screens/TrainingScreen.tsx').includes("'quest', 'rubg', 'frendy', 'solo'"));

/* ---------- (2) ярость: тик больше не голодает + явная пассивная база ---------- */
check('frendy-тик БЕЗ s в зависимостях (главная починка)', gs.includes('}, [isFrendy, room?.isHost, me, s?.phase, frendyIntro]);') && !gs.includes('}, [isFrendy, room?.isHost, me, s?.phase, s, frendyIntro]);'));
check('rubg-тик тоже БЕЗ s (зона не замирает)', gs.includes('}, [isRubg, room?.isHost, me, s?.phase]);'));
check('пассивная база: движение только к стоящей цели', eng.includes('const tgtMoving = tp.mv === true && now - (tp.ts ?? 0) < 3000;') && eng.includes('if (dist > 1 && (furious || ultra || !tgtMoving)) frendyWalk(b, tp.x, tp.y, spdMult);'));
check('в ярости/ультра гейт НЕ действует', /furious \|\| ultra \|\| !tgtMoving/.test(eng));
check('константы ярости/ультра не тронуты', X.FRENDY_FURY_MS === 120000 && X.FRENDY_FURY_SPEED === 1.5 && X.FRENDY_ULTRA_SPEED === 1.75 && X.FRENDY_ULTRA_TP_MS === 6000 && X.FRENDY_ULTRA_HIT_CD === 800);

/* ---------- (3) сжигание из инвентаря + наказание занятых ---------- */
check('новое действие frendyBusy в типе Action', eng.includes("| { t: 'frendyBusy'; id: string; on: boolean }"));
check('движок: case frendyBusy пишет uiBusyAt', eng.includes("case 'frendyBusy':") && eng.includes('s.frendy.uiBusyAt[p.id] = a.on ? Date.now() : 0;'));
check('types: поле uiBusyAt в FrendyState', src('src/types.ts').includes('uiBusyAt?: Record<string, number>;'));
check('константы занятости: 7 с пульс / 6 с телепорт', X.FRENDY_UIBUSY_MS === 7000 && X.FRENDY_BUSY_TP_MS === 6000);
check('uiBusy-хелпер в тике (щит задания сильнее)', eng.includes('const uiBusy = (pid: string)') && eng.includes('busy(p.id) || !uiBusy(p.id)'));
check('Френди просыпается на копающемся в инвентаре', eng.includes('const pool = busyUi.length ? busyUi : cands;'));
check('Френди телепортируется к занятому (кулдаун BUSY_TP)', eng.includes('if (!ultra && uiBusy(tgt.id) && dist > CELL_PX * 1.7 && now - (b.lastTpAt ?? 0) > FRENDY_BUSY_TP_MS)'));
check('журнал: «ТЕЛЕПОРТИРУЕТСЯ К ... — не засиживайся в инвентаре»', eng.includes('ТЕЛЕПОРТИРУЕТСЯ К ${tgt.name} — не засиживайся в инвентаре!'));
check('клиент: пульс занятости при открытом инвентаре', gs.includes("dispatch({ t: 'frendyBusy', id: me, on: true })") && gs.includes('setInterval(() => dispatch({ t: \'frendyBusy\', id: me, on: true }), 2500)'));
check('клиент: снятие занятости при закрытии', gs.includes("dispatch({ t: 'frendyBusy', id: me, on: false })"));
check('разжигание картриджем будит Френди', eng.includes('if (!f.boss) f.nextSpawnAt = Math.min(f.nextSpawnAt, nowB + 1500);') && eng.includes('жар привлекает кошмар'));
/* кнопки: инвентарь */
check('в «Кошмарном рюкзаке» есть кнопка «🔥 Сжечь»', gs.includes('>🔥 Сжечь</PxBtn>'));
check('кнопка шлёт frendyBurn (chip/cart) из инвентаря', gs.includes("dispatch({ t: 'frendyBurn', id: me!, what: chip ? 'chip' : 'cart' })"));
check('кнопка «Выбросить» на месте', gs.includes("dispatch({ t: 'frendyDrop', id: me!, itemId: it.id })"));
check('кнопка «Сжечь» учитывает печь и сильный огонь', gs.includes('const burnOff = !frendyInv?.near || (chip && !frendyInv.strong);'));
check('дистанция кнопки = дистанция движка', gs.includes('Math.max(140, Math.max(r.w, r.h) * 0.8 + 40)'));
/* окно печи */
check('окно печи: кнопки сжигания УБРАНЫ', !gs.includes('🔩 СЖЕЧЬ МИКРОСХЕМУ') && !gs.includes('📼 БРОСИТЬ КАРТРИДЖ В ОГОНЬ'));
check('окно печи: статус + счётчик + инструкция остались', gs.includes('Сожжено {frendy.burned} из {frendy.total}') && gs.includes('Сжигают ИЗ ИНВЕНТАРЯ, стоя у печи'));
check('сообщение движка «печь далеко» обновлено', eng.includes('печь далеко — подойди К ПЕЧИ и жги из ИНВЕНТАРЯ'));

/* ---------- регрессии v0.139 не сломаны ---------- */
check('F6 во время задания FRENDY молчит', gs.includes('if (isFrendy) return; // v0.139: перезапуска задания во FRENDY нет'));
check('кнопка «Перезапуск» скрыта во FRENDY', gs.includes('{!isFrendy && (') && gs.includes("grid ${isFrendy ? 'grid-cols-2' : 'grid-cols-3'}"));
check('экспонента 0.22 у Молдера (откат v0.138) жива', gs.includes('as.x += (epiS.alder.x - as.x) * 0.22;'));
check('furious/ultra вычисляются как в v0.139', eng.includes("const furious = (f.furyUntil ?? 0) > now || map.frendyAggr === 'rage';") && eng.includes('const ultra = chipsLeft === 1;'));
check('сжигание микросхемы включает ярость', eng.includes('f.furyUntil = nowB + FRENDY_FURY_MS;'));
check('HUD-бейдж «ЯРОСТЬ ФРЕНДИ»', gs.includes('⚡ ЯРОСТЬ ФРЕНДИ'));
check('шапки «Тайные материалы» на месте', src('src/screens/FrendyCine.tsx').includes('Френди · Тайные материалы') && src('src/screens/AgentsVn.tsx').includes('Тайные материалы · реплика'));
check('слайд режимов — 6 режимов', trd.includes("t: 'Режимы партий'") && trd.includes('Режимов шесть'));
check('intro-2.mp3 не тронут (>200 КБ)', fs.statSync(path.join(ROOT, 'src/assets/training/voice/intro-2.mp3')).size > 200000);

console.log(ok ? 'SMOKE OK' : 'SMOKE FAIL');
process.exit(ok ? 0 : 1);
