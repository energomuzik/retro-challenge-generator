// v0.193 smoke: инвентарь разблокирован; звук удара на «Легко»; отсечение фонов;
// грейс победы. Регрессии v0.187-0.192 живы.
import { readFileSync, existsSync } from 'fs';
import path from 'path';

const ROOT = '/home/z/my-project/rcg';
let ok = 0, fail = 0;
const t = (cond, name) => { if (cond) { ok++; console.log(`  ✓ ${name}`); } else { fail++; console.error(`  ✗ FAIL: ${name}`); } };
const src = (p) => readFileSync(path.join(ROOT, p), 'utf8');

/* ---------- 1. версии ---------- */
console.log('1. ВЕРСИИ');
const typesSrc = src('src/types.ts');
const versionSrc = src('src/version.ts');
t(/export const APP_VERSION = 187;/.test(typesSrc), 'APP_VERSION = 187');
t(typesSrc.includes('APP_VERSION 186→187; v0.193.0'), 'чейнджлог APP_VERSION 186→187; v0.193.0');
t(typesSrc.includes('// 186: 0.192.0 ЧЕТЫРЕ ИЗМЕНЕНИЯ'), 'история 0.192.0 сдвинута в // 186:');
t(versionSrc.includes('грейс 2.5 с + два опроса'), 'в version.ts inline-коммент 0.193.0');
t(versionSrc.includes('// 0.192.0 (история)'), 'в version.ts 0.192.0 ушла в историю');

/* ---------- 2. инвентарь на джойстике ---------- */
console.log('2. ИНВЕНТАРЬ РАЗБЛОКИРОВАН (GameScreen)');
const gs = src('src/screens/GameScreen.tsx');
t(!gs.includes('&& !invFurnConsLiveRef.current) { setInvOpen(true)'), 'гард «у печи/приставки» снят из Y-открытия');
t(gs.includes('setInvOpen(true); setFurnOpen(false); setConsoleOpen(false); sfx.click();'), 'Y открывает инвентарь и закрывает печь/приставку');

/* ---------- 3. звук удара на «Легко» ---------- */
console.log('3. ЗВУК УДАРА НА «ЛЕГКО»');
const eng = src('src/engine.ts');
t(eng.includes('now - (b.planAt ?? b.sinceTs) >= 7000'), 'план охоты перебрасывается каждые ~7 с');
t(eng.includes('!b.punish && b.plan &&'), 'у расплаты план не трогается');
t(eng.includes('b.planAt = now; }'), 'planAt ставится при первом жребии');
const typesSrc2 = src('src/types.ts');
t(typesSrc2.includes('planAt?: number;'), 'FrendyBossState.planAt объявлен');
const snd = src('src/sound.ts');
t(snd.includes("a.preload = 'auto';"), 'сэмплы предпрогреваются');
t(snd.includes('frendyHit() { if (!playSample(\'freddy-hit\', frendyHitSynth)) frendyHitSynth(); }'), 'удар: сэмпл + гарантированный синтез');
t(snd.includes('shock() { if (!playSample(\'shock\', shockSynth)) shockSynth(); }'), 'разряд: сэмпл + гарантированный синтез');
t(snd.includes('void a.play().catch(() => { if (fallback) fallback();'), 'сбой сэмпла → синтез');

/* ---------- 4. отсечение фонов ---------- */
console.log('4. ОТСЕЧЕНИЕ НЕВИДИМОГО (render)');
const rd = src('src/render.ts');
t(rd.includes('const vx0 = view.x - width / (2 * z) - 128;'), 'видимая область считается');
t((rd.match(/вне кадра — не рисуем/g) ?? []).length === 3, 'отсечение в 3 циклах (карты-плитки, плитки, штампы)');
t(rd.includes('if (px + tg.w < vx0 || px > vx1 || py + tg.h < vy0 || py > vy1) continue;'), 'фоны карт-плиток отсекаются');

/* ---------- 5. грейс победы ---------- */
console.log('5. ГРЕЙС ПОБЕДЫ ПО КОДУ (GameScreen)');
t(gs.includes('winStreakRef = useRef(0)'), 'счётчик побед объявлен');
t(gs.includes('if (Date.now() - emuBootStamp.ts < 2500) return;'), 'win-код ждёт 2.5 с после старта ядра');
t(gs.includes('winStreakRef.current >= 2'), 'победа зачитывается со ВТОРОГО опроса');
t(gs.includes('else winStreakRef.current = 0;'), 'сброс счётчика побед');

/* ---------- 6. регрессии v0.187-0.192 живы ---------- */
console.log('6. РЕГРЕССИИ ЖИВЫ');
t(gs.includes('const taskSaveFetch = async ('), 'v0.190: догоняние сейва живо');
t(gs.includes('Date.now() - emuBootStamp.ts >= 2500'), 'v0.189: грейс провала жив');
t(gs.includes('failStreakRef.current >= 2'), 'v0.189: двойной опрос провала жив');
t((gs.match(/sfx\.shock\(\)/g) ?? []).length >= 7, `v0.192: точки разряда ≥7 (сейчас ${(gs.match(/sfx\.shock\(\)/g) ?? []).length})`);
const sb = src('src/SegaBox.tsx');
t(sb.includes("if(wantPaused&&window.EJS_loadStateURL&&Date.now()-readyAt<1500)return;"), 'v0.192: гейт паузы жив');
const te = src('src/screens/TaskEditor.tsx');
t(te.includes('useEffect(() => { if (fCond) setCodeIn(formatCond(fCond)); }, [fCond]);'), 'v0.192: зеркало кода условия живо');
const ql = src('src/qrLinks.ts');
t(ql.includes("url: 'https://energomuzik.github.io/S-files/'"), 'v0.191: плитка ведёт на Pages');
for (let i = 1; i <= 3; i++) t(existsSync(path.join(ROOT, `src/assets/sfx/freddy-hit-${i}.mp3`)), `freddy-hit-${i}.mp3 на месте`);
for (let i = 1; i <= 5; i++) t(existsSync(path.join(ROOT, `src/assets/sfx/shock-${i}.mp3`)), `shock-${i}.mp3 на месте`);

console.log(`\nИТОГ: ${ok} ok, ${fail} fail`);
process.exit(fail ? 1 : 0);
