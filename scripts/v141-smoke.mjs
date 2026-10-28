/* Смоук v0.141: ТРИ ПРАВКИ ПО ЗАКАЗУ —
   (1) ПРОПУСК титров при ПРОИГРЫШЕ (FRENDY-поражение: кнопка в lose1/roll; победный финал не тронут);
   (2) СЛУХ в помощи: призрак — в ПЛОХИХ ИГРАХ-КАРТРИДЖАХ (не в приставках!), заснувшие за плохими
       играми — в кошмаре; слайд 2 = Diablo-механика (E-подъём, сетка, перетащить на печь);
       в слайде 5 — титры поражения можно пропустить; озвучка frendy-0..4 свежая;
   (3) DIABLO-ИНВЕНТАРЬ: автоподбор проходом УДАЛЁН (frendyPickup/frendyInvMove, burn по itemId),
       сетка 10×6 и размеры предметов в types.ts (чистые хелперы), окно печи + рюкзак-сетка
       (FrendyInv.tsx), драг-н-дроп (перекладывание/выброс/на печь), ПКМ-меню, новые глобальные
       кнопки «Инвентарь» (Tab/джой 3) и «Поднять предмет» (E/джой 4), пульс frendyBusy при окне печи.
   Запуск: node scripts/v141-smoke.mjs (esbuild бандлит, import.meta.glob — заглушка). */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = path.join(ROOT, 'scripts', 'v141-tmp');
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
import { APP_VERSION, FRENDY_INV_COLS, FRENDY_INV_ROWS, rubgItemSize, rubgGridFits, rubgGridFirstFit, RUBG_ITEMS } from '${ROOT}/src/types';
import { VERSION } from '${ROOT}/src/version';
import { TRAINING } from '${ROOT}/src/trainingData';
import { INV_KEY_DEFAULT, INV_PAD_DEFAULT, PICKUP_KEY_DEFAULT, PICKUP_PAD_DEFAULT } from '${ROOT}/src/input';
globalThis.__X = { APP_VERSION, VERSION, TRAINING, FRENDY_INV_COLS, FRENDY_INV_ROWS, rubgItemSize, rubgGridFits, rubgGridFirstFit, RUBG_ITEMS, INV_KEY_DEFAULT, INV_PAD_DEFAULT, PICKUP_KEY_DEFAULT, PICKUP_PAD_DEFAULT };
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
check('ВЕРСИЯ 0.141.0 / APP_VERSION 135', X.VERSION === '0.141.0' && X.APP_VERSION === 135, `${X.VERSION} / ${X.APP_VERSION}`);

const gs = src('src/screens/GameScreen.tsx');
const eng = src('src/engine.ts');
const trd = src('src/trainingData.ts');
const cin = src('src/screens/FrendyCine.tsx');
const finv = src('src/screens/FrendyInv.tsx');
const kb = src('src/KeyBinder.tsx');
const inp = src('src/input.ts');

/* ---------- (1) ПРОПУСК титров при проигрыше ---------- */
check('EndCredits: кнопка «Пропустить» ТОЛЬКО при поражении', cin.includes("const canSkipLoss = isFrendy && !won && (phase === 'lose1' || phase === 'roll');"));
check('кнопка вызывает finish() (музыка глушится, окно закрывается)', (cin.match(/canSkipLoss && \(/g) || []).length === 2 && cin.includes('{ sfx.click(); finish(); }'));
check('победные фазы win1..3 кнопки НЕ получают', !/win1'.*canSkipLoss|canSkipLoss.*win1/.test(cin));
check('в помощи: титры поражения можно пропустить', /МОЖНО ПРОПУСТИТЬ кнопкой вверху/.test(trd));

/* ---------- (2) слух в помощи: призрак в КАРТРИДЖАХ, не в приставках ---------- */
const frendy = X.TRAINING.find((s) => s.id === 'frendy');
check('раздел FRENDY есть, 5 слайдов', !!frendy && frendy.slides.length === 5);
const allText = !!frendy ? frendy.slides.map((s) => `${s.t} ${s.x} ${s.narr ?? ''}`).join(' ') : '';
check('слух: призрак в ПЛОХИХ играх-КАРТРИДЖАХ (x и narr)', /призрак поселился в ПЛОХИХ играх — проклятых картриджах/.test(allText) && /призрак поселился в плохих играх/.test(allText));
check('заснувшие за плохими играми — в кошмаре (x и narr)', /засыпают за такими играми, просыпаются в его КОШМАРЕ/.test(allText) && /засыпают, играя в такие игры, просыпаются в его кошмаре/.test(allText));
check('НИ СЛОВА «призрак … в приставках»', !/призрак[^.]*приставк/i.test(allText));
check('старый слух удалён из обоих текстов', !/проявляется в старых/i.test(allText));
check('НИ СЛОВА про перенос в приставку (сюрприз финала не раскрыт)', !/я уже внутри/i.test(allText) && !/не выключай приставку/i.test(allText));
check('сюрпризы не тронуты: без ФБР/агентов', !/ФБР/i.test(allText) && !/агент/i.test(allText));
check('слайд 2 = «Рюкзак и печь: Diablo-механика»', !!frendy && frendy.slides[1].t === 'Рюкзак и печь: Diablo-механика');
check('слайд 2 учит E-подъёму и «нет места — не поднять»', /нажми E \(или кнопку подъёма/.test(frendy?.slides[1].x ?? '') && /Нет места в сетке — предмет НЕ ПОДНЯТЬ/.test(frendy?.slides[1].x ?? ''));
check('слайд 2 учит окну печи и перетаскиванию НА ПЕЧЬ', /откроются ПЕЧЬ и РЮКЗАК/.test(frendy?.slides[1].x ?? '') && /перетащи КАРТРИДЖ Dendy 📼 НА ПЕЧЬ/.test(frendy?.slides[1].x ?? ''));
check('размеры в помощи: 2×2 / 1 / 6 клеток', /2×2 клетки, кофе — одну, аптечка — шесть/.test(frendy?.slides[1].x ?? ''));
check('старое «Сжечь» из рюкзака из помощи УБРАНО', !/«🔥 Сжечь»/.test(allText) && !/выбери микросхему и нажми/i.test(allText));
check('без логики Френди в помощи (телепорт/чует/лютое)', !/телепорт/i.test(allText) && !/чует/i.test(allText));
check('у всех слайдов FRENDY есть narr', !!frendy && frendy.slides.every((s) => typeof s.narr === 'string' && s.narr.length > 60));
/* озвучка перегенерирована (все 5 свежие) */
const voiceMissing = [0, 1, 2, 3, 4].filter((i) => !fs.existsSync(path.join(ROOT, `src/assets/training/voice/frendy-${i}.mp3`)) || fs.statSync(path.join(ROOT, `src/assets/training/voice/frendy-${i}.mp3`)).size < 50000);
check('озвучка frendy-0..4 перегенерирована (>50 КБ)', voiceMissing.length === 0, voiceMissing.join(','));

/* ---------- (3a) DIABLO-инвентарь: движок ---------- */
check('диспатчи frendyPickup и frendyInvMove объявлены', eng.includes("| { t: 'frendyPickup'; id: string }") && eng.includes("| { t: 'frendyInvMove'; id: string; itemId: string; gx: number; gy: number }"));
check('frendyBurn принимает itemId', eng.includes("| { t: 'frendyBurn'; id: string; what?: 'chip' | 'cart'; itemId?: string }"));
check('АВТОПОДБОР проходом УДАЛЁН из тика', !eng.includes('ПОДБОР предметов с поля: живой игрок прошёл по предмету'));
check('case frendyPickup: радиус 1 клетка, нет места — предмет ОСТАЁТСЯ', eng.includes("case 'frendyPickup':") && eng.includes('if (d <= CELL_PX && d < bd)') && eng.includes('НЕ ПОДНЯТЬ: освободите место в сетке'));
check('case frendyInvMove: проверка rubgGridFits на хосте', eng.includes("case 'frendyInvMove':") && eng.includes('if (!rubgGridFits(inv, sz.w, sz.h, Math.round(a.gx), Math.round(a.gy), it.id)) break;'));
check('frendyBurn: itemId сжигает КОНКРЕТНЫЙ предмет', eng.includes('if (a.itemId)') && eng.includes('burnIdx = inv.findIndex((x) => x.id === a.itemId);'));
check('frendyBurn: чужой предмет в печи не горит', eng.includes('в печи НЕ ГОРЯТ — печь берёт только картриджи Dendy и микросхемы'));
check('приём награды: нет места — предмет ПАДАЕТ НА ЗЕМЛЮ у ног', eng.includes('падает на землю рядом (освободите место и поднимите)') && eng.includes('const spot = rubgGridFirstFit(inv, kind);'));
check('интро-лог FRENDY учит E-подъёму', eng.includes('ПОДНИМАЙТЕ (подойдите и нажмите E / кнопку подъёма)'));
check('FRENDY-подъём: предмет ищется вокруг СВОЕЙ фишки (journeyPos игрока)', /case 'frendyPickup': \{[\s\S]{0,700}?const pp = s\.journeyPos\?\.\[p\.id];[\s\S]{0,200}?if \(!pp\) break;/.test(eng) && eng.includes('if (bi < 0) break; // рядом с фишкой ничего не лежит — кнопка/клик мимо'));

/* ---------- (3b) сетка и размеры (types.ts) ---------- */
check('сетка 10×6', X.FRENDY_INV_COLS === 10 && X.FRENDY_INV_ROWS === 6);
check('размеры: чип/картридж 2×2, кофе 1×1, аптечка 2×3', X.rubgItemSize('frendyChip').w === 2 && X.rubgItemSize('frendyChip').h === 2 && X.rubgItemSize('dendyCart').w === 2 && X.rubgItemSize('coffee').w === 1 && X.rubgItemSize('medkit').w === 2 && X.rubgItemSize('medkit').h === 3);
check('rubgGridFits: пустая сетка принимает (0,0)', X.rubgGridFits([], 2, 2, 0, 0));
check('rubgGridFits: край сетки — отказ', !X.rubgGridFits([], 2, 2, 9, 5));
check('rubgGridFits: наложение — отказ, skipId — ок', (() => {
  const mk = (id, kind, gx, gy) => ({ id, kind, gx, gy });
  const inv = [mk('a', 'frendyChip', 0, 0)];
  return !X.rubgGridFits(inv, 2, 2, 1, 1) && X.rubgGridFits(inv, 2, 2, 1, 1, 'a') && X.rubgGridFits(inv, 2, 2, 2, 0);
})());
check('rubgGridFirstFit: обходит занятое место', (() => {
  const inv = [{ id: 'a', kind: 'frendyChip', gx: 0, gy: 0 }];
  const p = X.rubgGridFirstFit(inv, 'frendyChip');
  return !!p && p.gx === 2 && p.gy === 0;
})());
check('RubgItem.gx/gy объявлены', src('src/types.ts').includes('gx?: number; // v0.141 FRENDY') && src('src/types.ts').includes('gy?: number; // v0.141 FRENDY'));

/* ---------- (3c) окно печи + рюкзак-сетка (FrendyInv.tsx) ---------- */
check('FrendyInv.tsx существует, экспортирует сетку и окно печи', finv.includes('export function FrendyInvGrid') && finv.includes('export function FrendyFurnaceModal'));
check('дроп-резолвер: печь → сетка → окно → на землю', finv.includes("return { kind: 'furnace' };") && finv.includes("return { kind: 'grid', gx, gy };") && finv.includes("return { kind: 'floor' };"));
check('внутри окна рюкзака НЕ выбрасывает (щелчок в ближайшую клетку)', finv.includes('но мимо сетки — НЕ выброс: щелкаем в ближайшую клетку'));
check('дроп мимо окна = frendyDrop (выбросить на землю)', finv.includes('actions.onDrop(info.itemId); // за пределами окна — на землю'));
check('подсветка клетки: зелёная влезет / красная нет', finv.includes("'rgba(60,220,120,0.22)'" ) && finv.includes("'rgba(255,60,60,0.22)'"));
check('призрак предмета под курсором', finv.includes('ПРИЗРАК ПРЕДМЕТА под курсором/пальцем'));
check('ПКМ-меню: использовать / сжечь в печи / выбросить', finv.includes('Сжечь в печи') && finv.includes('Выбросить на землю') && (finv.includes('Выпить (иммунитет 5 мин)') || finv.includes('Использовать (лечит)')));
check('долгое нажатие (телефон) открывает меню (550 мс)', finv.includes('550'));
check('лоток «НЕ СГОРЕЛО»: слабый огонь оставляет предмет у печи', finv.includes('НЕ СГОРЕЛО') && finv.includes('Перетащи обратно в РЮКЗАК'));
check('предмет сгорел — лоток чистится по состоянию; страховка 1.6 с', finv.includes('setTray(null); return;') && finv.includes('1600'));
check('окно печи: огонь сильный/слабый + счётчик', finv.includes('СИЛЬНЫЙ ОГОНЬ! Микросхемы ГОРЯТ') && finv.includes('Сожжено {burned} из {total}'));
check('GameScreen использует FrendyFurnaceModal/FrendyInvGrid', gs.includes('<FrendyFurnaceModal') && gs.includes('<FrendyInvGrid'));
check('старое окно печи со статусом-инструкцией УДАЛЕНО', !gs.includes('Сжигают ИЗ ИНВЕНТАРЬ, стоя у печи') && !gs.includes('Сжигают ИЗ ИНВЕНТАРЯ, стоя у печи'));
check('старый список «Кошмарный рюкзак» с кнопками УДАЛЁН', !gs.includes('>🔥 Сжечь</PxBtn>') && !gs.includes("what: chip ? 'chip' : 'cart'"));

/* ---------- (3d) подъём и кнопки ---------- */
check('nearItem: ближайший предмет в радиусе 0.95 клетки', gs.includes('const nearItem = useMemo') && gs.includes('d > CELL * 0.95) continue;'));
check('клавиша подъёма — из настроек (pickupKey), приоритет у NPC/печи/Альдера', gs.includes("(prefs.pickupKey ?? 'e').toLowerCase()") && gs.includes('if (nearNpc || nearFurnace || epiNearAlder) return; // у интерактива — его клавиша'));
check('кнопка джойстика подъёма (pickupPad, по умолчанию 4=L1/LB), край-триггер', gs.includes('loadEmuPrefs().pickupPad ?? 4'));
check('клик по предмету на карте — поднять (телефоны)', gs.includes('КЛИК ПО ПРЕДМЕТУ на карте (стоишь рядом) — поднять, как по E'));
check('HUD-подсказка «ПОДНЯТЬ … — E · джойстик · клик»', gs.includes('ПОДНЯТЬ') && gs.includes('E</b> · джойстик · клик'));
check('отскок «НЕ ВЛЕЗ В РЮКЗАК» + тост', gs.includes('frendy-pickup-bounce') && gs.includes('В рюкзаке НЕТ МЕСТА — предмет не влезает!'));
check('движок отказывает — предмет остаётся в chips (следим 650 мс)', gs.includes('Date.now() - tr.at > 650'));

/* ---------- (3e) клавиша/джойстик «инвентарь» ---------- */
check('defaults: Tab / джой 3; E / джой 4', X.INV_KEY_DEFAULT === 'tab' && X.INV_PAD_DEFAULT === 3 && X.PICKUP_KEY_DEFAULT === 'e' && X.PICKUP_PAD_DEFAULT === 4);
check('loadEmuPrefs читает invKey/invPad/pickupKey/pickupPad', inp.includes('invKey: typeof p.invKey') && inp.includes('invPad: typeof p.invPad') && inp.includes('pickupKey: typeof p.pickupKey') && inp.includes('pickupPad: typeof p.pickupPad'));
check('Tab открывает/закрывает ИНВЕНТАРЬ, при открытом окне печи — закрывает ЕГО', gs.includes("(prefs.invKey ?? 'tab').toLowerCase()") && gs.includes("if (furnOpen) { setFurnOpen(false); sfx.click(); return; } // окно печи закрывается той же кнопкой"));
check('джойстик: инвентарь открывает/закрывает (край-триггер, базлайн)', gs.includes('invPadPrevRef') && gs.includes('invClosePadRef') && gs.includes('furnClosePadRef'));
check('окно печи блокирует ходьбу фишки (furnBlockRef)', gs.includes('furnBlockRef.current = furnOpen;') && gs.includes('invBlockRef.current || furnBlockRef.current) return;'));
check('пульс frendyBusy шлётся и при окне печи', gs.includes('(!invOpen && !furnOpen) || s?.phase !== \'playing\''));
check('KeyBinder: три глобальные кнопки (быстрая загрузка, инвентарь, подъём)', kb.includes("'quickLoad', 'invOpen', 'itemPickup'") && kb.includes('Открыть/закрыть ИНВЕНТАРЬ · на поле и в окне печи') && kb.includes('ПОДНЯТЬ ПРЕДМЕТ с земли · режим FRENDY'));
check('KeyBinder: захват клавиш/пада новых кнопок', kb.includes("capture.action === 'quickLoad' || capture.action === 'invOpen' || capture.action === 'itemPickup'") && kb.includes("else if (c.action === 'invOpen') next = { ...prev, invPad: bi } as EmuPrefs;"));

/* ---------- регрессии v0.139/v0.140 не сломаны ---------- */
check('F6 во время задания FRENDY молчит', gs.includes('if (isFrendy) return; // v0.139: перезапуска задания во FRENDY нет'));
check('frendy-тик БЕЗ s в зависимостях (починка v0.140 жива)', gs.includes('}, [isFrendy, room?.isHost, me, s?.phase, frendyIntro]);'));
check('пассивная база: движение только к стоящей цели (v0.140 живо)', eng.includes('if (dist > 1 && (furious || ultra || !tgtMoving)) frendyWalk(b, tp.x, tp.y, spdMult);'));
check('сжигание микросхемы включает ярость', eng.includes('f.furyUntil = nowB + FRENDY_FURY_MS;'));
check('HUD-бейдж «ЯРОСТЬ ФРЕНДИ»', gs.includes('⚡ ЯРОСТЬ ФРЕНДИ'));
check('шапки «Тайные материалы» на месте', src('src/screens/FrendyCine.tsx').includes('Френди · Тайные материалы'));
check('интро-катсцена: «Пропустить» осталась', cin.includes('Пропустить ✕</button>'));
check('эпилог: разговор агентов не тронут', gs.includes("dispatch({ t: 'epiTalk', id: me });"));

console.log(ok ? 'SMOKE OK' : 'SMOKE FAIL');
process.exit(ok ? 0 : 1);
