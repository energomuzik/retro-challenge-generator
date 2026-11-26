// v0.195 smoke: быстрые клавиши в игре сняты (только редактор сохранений); зум в задании
// выключен; двухфазные условия «было → стало» + удержание; звуки телепорта Френди.
// Регрессии v0.187-0.194 живы.
import { readFileSync, existsSync, statSync } from 'fs';
import path from 'path';

const ROOT = '/home/z/my-project/rcg';
let ok = 0, fail = 0;
const t = (cond, name) => { if (cond) { ok++; console.log(`  ✓ ${name}`); } else { fail++; console.error(`  ✗ FAIL: ${name}`); } };
const src = (p) => readFileSync(path.join(ROOT, p), 'utf8');

/* ---------- 1. версии ---------- */
console.log('1. ВЕРСИИ');
const typesSrc = src('src/types.ts');
const versionSrc = src('src/version.ts');
t(/export const APP_VERSION = 189;/.test(typesSrc), 'APP_VERSION = 189');
t(typesSrc.includes('APP_VERSION 188→189; v0.195.0'), 'чейнджлог APP_VERSION 188→189; v0.195.0');
t(typesSrc.includes('// 188: 0.194.0 ТРИ ИЗМЕНЕНИЯ'), 'история 0.194.0 сдвинута в // 188:');
t(versionSrc.includes('звуки телепорта Френди'), 'в version.ts inline-коммент 0.195.0');
t(versionSrc.includes('// 0.194.0 (история)'), 'в version.ts 0.194.0 ушла в историю');

/* ---------- 2. быстрые клавиши в игре сняты ---------- */
console.log('2. БЫСТРЫЕ КЛАВИШИ В ИГРЕ СНЯТЫ (GameScreen)');
const gs = src('src/screens/GameScreen.tsx');
t(!gs.includes('useQuickLoad('), 'useQuickLoad из игрового экрана убран');
t(!gs.includes('useQuickSave('), 'useQuickSave из игрового экрана убран');
t(!gs.includes('quickLoadFire'), 'quickLoadFire удалён');
t(!gs.includes('quickSaveFire'), 'quickSaveFire удалён');
t(gs.includes("const quickKeyLbl = '';"), 'подписи «⚡F6» на кнопках «Перезапуск» сняты');
t(src('src/screens/EmulatorLauncher.tsx').includes('useQuickLoad(quickLoadFire)') && src('src/screens/EmulatorLauncher.tsx').includes('useQuickSave(quickSaveFire)'), 'хуки остались в «Запуске эмулятора»');
const kb = src('src/KeyBinder.tsx');
t((kb.match(/работает ТОЛЬКО в «Запуске эмулятора»/g) ?? []).length === 2, 'KeyBinder: оба описания «только в Запуске эмулятора»');

/* ---------- 3. зум в задании выключен ---------- */
console.log('3. ЗУМ В ЗАДАНИИ ВЫКЛЮЧЕН (GameScreen)');
t(gs.includes('const taskWinOpen = (myQJob !== undefined && !!myQTask) || (myJob !== undefined && !!myRubgTask);'), 'гейт «окно задания открыто»');
t(gs.includes("!ch && !taskWinOpen && !s.pendingCard"), 'canLookAround гейтится taskWinOpen');
t(gs.includes('v0.195: пока ОТКРЫТО ОКНО ЗАДАНИЯ'), 'комментарий-обоснование на месте');

/* ---------- 4. двухфазные условия «было → стало» ---------- */
console.log('4. ДВУХФАЗНЫЕ УСЛОВИЯ (types + memcode + GameScreen + TaskEditor)');
t(typesSrc.includes('then?: MemCond;'), 'MemCond.then объявлен');
t(typesSrc.includes('holdSec?: number;'), 'MemCond.holdSec объявлен');
const mc = src('src/memcode.ts');
t(mc.includes('c.then'), 'formatCond сериализует фазу 2');
t(mc.includes("if (str.includes('>'))"), 'parseCond понимает вид «фаза1>фаза2>секунд»');
t(mc.includes('СНАЧАЛА'), 'memCondText объясняет двухфазность');
t(mc.includes('(c: MemCond): string'), 'formatCond имеет явный тип возврата');
t(gs.includes('const twoPhase = !!activeCode.then;'), 'win-опрос: двухфазность');
t(gs.includes('winArmedRef.current && cur2 !== null && opOk(cur2'), 'win-опрос: фаза 2 только после арминга');
t(gs.includes('failArmRef.current && curF2 !== null && opOk(curF2'), 'fail-опрос: двухфазное поражение');
t((gs.match(/Math\.max\(2, Math\.ceil\(\(/g) ?? []).length === 2, 'удержание holdSec в win и fail');
t(gs.includes('activeCode?.then?.a, activeCode?.then?.t, activeCode?.then?.op, activeCode?.then?.v, activeCode?.holdSec'), 'deps эффекта: фаза 2 победы');
t(gs.includes('activeFail?.then?.a, activeFail?.then?.t, activeFail?.then?.op, activeFail?.then?.v, activeFail?.holdSec'), 'deps эффекта: фаза 2 поражения');
const te = src('src/screens/TaskEditor.tsx');
t(te.includes("+ Двухфазное (было → стало)"), 'редактор: кнопка двухфазного условия');
t(te.includes('ДЕРЖАТЬ:'), 'редактор: секунды удержания');
t(te.includes('setFCond({ ...fCond, then: { ...fCond.then!, t: e.target.value as CodeType } })'), 'редактор: поля фазы 2');

/* ---------- 5. звуки телепорта Френди ---------- */
console.log('5. ЗВУКИ ТЕЛЕПОРТА (assets + sound + engine + watcher)');
const pIn = path.join(ROOT, 'src/assets/sfx/freddy-tp-in-1.mp3');
const pOut = path.join(ROOT, 'src/assets/sfx/freddy-tp-out-1.mp3');
t(existsSync(pIn) && statSync(pIn).size > 100000, 'freddy-tp-in-1.mp3 на месте (≈177 КБ)');
t(existsSync(pOut) && statSync(pOut).size > 100000, 'freddy-tp-out-1.mp3 на месте (≈178 КБ)');
const snd = src('src/sound.ts');
t(snd.includes("frendyTpIn() { if (!playSample('freddy-tp-in', frendyTpInSynth)) frendyTpInSynth(); }"), 'sfx.frendyTpIn: сэмпл + синтез-фолбэк');
t(snd.includes("frendyTpOut() { if (!playSample('freddy-tp-out', frendyTpOutSynth)) frendyTpOutSynth(); }"), 'sfx.frendyTpOut: сэмпл + синтез-фолбэк');
t(snd.includes('const frendyTpInSynth'), 'синтез «появления»');
t(snd.includes('const frendyTpOutSynth'), 'синтез «исчезновения»');
const eng = src('src/engine.ts');
t((eng.match(/b\.fx = 'tp'; b\.fxTs = now;/g) ?? []).length === 2, 'engine: 2 телепорта → fx «tp» (ультра + к занятому)');
t((eng.match(/f\.fx = \{ kind: 'vanish', ts: now \};/g) ?? []).length === 2, 'engine: 2 растворения → fx «vanish» (после удара + охота затянулась)');
t(typesSrc.includes("'spawn' | 'attack' | 'catch' | 'repair' | 'tp' | null"), 'тип boss.fx допускает «tp»');
t(typesSrc.includes("{ kind: 'catch' | 'repair' | 'vanish'; who?: string; ts: number }"), 'тип level-fx допускает «vanish»');
t(gs.includes("else if (b.fx === 'tp') sfx.frendyTpIn();"), 'вотчер: звук «появления»');
t(gs.includes("else if (fx.kind === 'vanish') sfx.frendyTpOut();"), 'вотчер: звук «исчезновения»');

/* ---------- 6. регрессии v0.187-0.194 живы ---------- */
console.log('6. РЕГРЕССИИ ЖИВЫ');
t(gs.includes('const taskSaveFetch = async ('), 'v0.190: догоняние сейва живо');
t(gs.includes('Date.now() - emuBootStamp.ts >= 2500'), 'v0.189: грейс провала жив');
t(gs.includes('if (bootSeenRef.current !== emuBootStamp.ts)'), 'v0.194: сброс арминга при перезапуске ядра жив');
t(gs.includes('const zeroWin = !twoPhase && activeCode.op === \'eq\' && activeCode.v === 0;'), 'v0.194: авто-арминг «==0» сохранён для однофазных');
t(gs.includes("cv.getContext('2d', { alpha: false })!"), 'v0.194: непрозрачный канвас поля жив');
const rd = src('src/render.ts');
t(rd.includes('const bgCache = new Map<string, HTMLCanvasElement>();'), 'v0.194: кеш фонов жив');
t(!rd.includes('const vx0 = view.x - width / (2 * z) - 128;'), 'v0.194: отсечение v0.193 по-прежнему снято');
t(gs.includes('setInvOpen(true); setFurnOpen(false); setConsoleOpen(false); sfx.click();'), 'v0.193: Y открывает инвентарь');
t(eng.includes('now - (b.planAt ?? b.sinceTs) >= 7000'), 'v0.193: план охоты перебрасывается каждые ~7 с');
t(snd.includes("a.preload = 'auto';"), 'v0.193: сэмплы предпрогреваются');
t((gs.match(/sfx\.shock\(\)/g) ?? []).length >= 7, `v0.192: точки разряда ≥7 (сейчас ${(gs.match(/sfx\.shock\(\)/g) ?? []).length})`);

console.log(`\nИТОГ: ${ok} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
