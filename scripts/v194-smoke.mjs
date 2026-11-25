// v0.194 smoke: отсечение v0.193 снято (карта мира по select цела); кеш фонов плиток;
// непрозрачный канвас поля; быстрое сохранение в задании запрещено; победа «==0» только
// если значение было > 0 (босс Karate Kid). Регрессии v0.187-0.193 живы.
import { readFileSync } from 'fs';
import path from 'path';

const ROOT = '/home/z/my-project/rcg';
let ok = 0, fail = 0;
const t = (cond, name) => { if (cond) { ok++; console.log(`  ✓ ${name}`); } else { fail++; console.error(`  ✗ FAIL: ${name}`); } };
const src = (p) => readFileSync(path.join(ROOT, p), 'utf8');

/* ---------- 1. версии ---------- */
console.log('1. ВЕРСИИ');
const typesSrc = src('src/types.ts');
const versionSrc = src('src/version.ts');
t(/export const APP_VERSION = 188;/.test(typesSrc), 'APP_VERSION = 188');
t(typesSrc.includes('APP_VERSION 187→188; v0.194.0'), 'чейнджлог APP_VERSION 187→188; v0.194.0');
t(typesSrc.includes('// 187: 0.193.0 ЧЕТЫРЕ ИЗМЕНЕНИЯ'), 'история 0.193.0 сдвинута в // 187:');
t(versionSrc.includes('кеш '), 'в version.ts inline-коммент 0.194.0');
t(versionSrc.includes('// 0.193.0 (история)'), 'в version.ts 0.193.0 ушла в историю');

/* ---------- 2. отсечение снято, кеш фонов ---------- */
console.log('2. ОТСЕЧЕНИЕ СНЯТО + КЕШ ФОНОВ (render)');
const rd = src('src/render.ts');
t(!rd.includes('const vx0 = view.x - width / (2 * z) - 128;'), 'видимая область v0.193 удалена');
t(!(rd.match(/вне кадра — не рисуем/g) ?? []).length, 'отсечений «вне кадра» не осталось');
t(rd.includes('const bgCache = new Map<string, HTMLCanvasElement>();'), 'кеш фонов объявлен');
t(rd.includes('function cachedTileBg(url: string, real: boolean, w: number, h: number)'), 'cachedTileBg: url+mode+размер');
t(rd.includes('if (real) c.drawImage(img, 0, 0);'), '«real» рисуется 1:1 в кеш (срез границей = бывший clip)');
t((rd.match(/ctx\.drawImage\(cvB, px, py\);/g) ?? []).length === 2, 'блит из кеша в 2 циклах (карты-плитки, плитки)');
t(rd.includes("if (bgCache.size > 32)"), 'LRU-шапка кеша (32 записи)');

/* ---------- 3. канвас поля непрозрачный ---------- */
console.log('3. НЕПРОЗРАЧНЫЙ КАНВАС ПОЛЯ (GameScreen)');
const gs = src('src/screens/GameScreen.tsx');
t(gs.includes("cv.getContext('2d', { alpha: false })!"), 'getContext 2d { alpha: false }');

/* ---------- 4. быстрое сохранение в задании запрещено ---------- */
console.log('4. QUICKSAVE В ЗАДАНИИ ЗАПРЕЩЁН (GameScreen + KeyBinder)');
t(gs.includes('const taskOn = (!!myQJob && !!myQTask && qArmed) || (myJob !== undefined && !!myRubgTask && rubgJobArmed) || (!!ch && myTurn && ch.status === \'playing\' && !!ch.started);'), 'гейт «задание идёт» — все три окна');
t(gs.indexOf('const taskOn =') < gs.indexOf('if (!ejsApiRef.current)'), 'гейт стоит ПЕРВЫМ (раньше проверки эмулятора)');
t(gs.includes('Быстрое сохранение недоступно во время задания'), 'в задании — внятный отказ, ничего не пишется');
t(!gs.includes('Быстрый сейв записан — «Перезапуск»/F6 теперь вернёт сюда'), 'старая запись точки возврата в задании удалена');
t(!gs.includes('if (myQJob && myQTask && qArmed) { setQSaveState(st)'), 'старая ветка сохранения в qJob удалена');
t(gs.includes('Сохранять некуда — эмулятор не запущен'), 'вне задания тост «эмулятор не запущен» жив (запуска эмулятора это не касается)');
t(src('src/KeyBinder.tsx').includes('Во время задания быстрое сохранение НЕ РАБОТАЕТ'), 'описание кнопки в «Управлении» переписано');

/* ---------- 5. победа «==0» только если значение было > 0 ---------- */
console.log('5. ARMED-ПОБЕДА «==0» (GameScreen)');
t(gs.includes('const winArmedRef = useRef(false);'), 'winArmedRef объявлен');
t((gs.match(/winArmedRef\.current = false;/g) ?? []).length >= 2, 'armed сбрасывается при смене задания И при перезапуске ядра');
t(gs.includes("const zeroWin = activeCode.op === 'eq' && activeCode.v === 0;"), 'zeroWin только для «== 0»');
t(gs.includes('if (zeroWin && cur > 0) winArmedRef.current = true;'), 'arming: значение побывало > 0');
t(gs.includes('(!zeroWin || winArmedRef.current)'), 'ноль победы гейтится армингом');
t(gs.includes('winStreakRef.current >= 2'), 'два опроса подряд живы (v0.193)');

/* ---------- 6. регрессии v0.187-0.193 живы ---------- */
console.log('6. РЕГРЕССИИ ЖИВЫ');
t(gs.includes('const taskSaveFetch = async ('), 'v0.190: догоняние сейва живо');
t(gs.includes('Date.now() - emuBootStamp.ts >= 2500'), 'v0.189: грейс провала жив');
t(gs.includes('failStreakRef.current >= 2'), 'v0.189: двойной опрос провала жив');
t(gs.includes('failStreakRef.current = 0;\n    winStreakRef.current = 0;\n    winArmedRef.current = false;'), 'сброс счётчиков в теле эффекта');
t((gs.match(/sfx\.shock\(\)/g) ?? []).length >= 7, `v0.192: точки разряда ≥7 (сейчас ${(gs.match(/sfx\.shock\(\)/g) ?? []).length})`);
t(!gs.includes('&& !invFurnConsLiveRef.current) { setInvOpen(true)'), 'v0.193: гард «у печи/приставки» у Y снят');
t(gs.includes('setInvOpen(true); setFurnOpen(false); setConsoleOpen(false); sfx.click();'), 'v0.193: Y открывает инвентарь');
const eng = src('src/engine.ts');
t(eng.includes('now - (b.planAt ?? b.sinceTs) >= 7000'), 'v0.193: план охоты перебрасывается каждые ~7 с');
const snd = src('src/sound.ts');
t(snd.includes("a.preload = 'auto';"), 'v0.193: сэмплы предпрогреваются');

console.log(`\nИТОГ: ${ok} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
