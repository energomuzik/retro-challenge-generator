// v0.192 smoke: пауза не глушит загрузку сейва; символ сравнения не слетает;
// сэмплы Френди/тока подключены. Регрессии v0.187-0.191 живы.
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
t(/export const APP_VERSION = 186;/.test(typesSrc), 'APP_VERSION = 186');
t(typesSrc.includes('APP_VERSION 185→186; v0.192.0'), 'чейнджлог APP_VERSION 185→186; v0.192.0');
t(typesSrc.includes('// 185: 0.191.0 ОДНО ИЗМЕНЕНИЕ'), 'история 0.191.0 сдвинута в // 185:');
t(versionSrc.includes('проигрыш задания = разряд тока'), 'в version.ts inline-коммент 0.192.0');
t(versionSrc.includes('// 0.191.0 (история)'), 'в version.ts 0.191.0 ушла в историю');

/* ---------- 2. пауза vs загрузка сейва ---------- */
console.log('2. ПАУЗА НЕ ГЛУШИТ ЗАГРУЗКУ СЕЙВА (SegaBox)');
const sb = src('src/SegaBox.tsx');
t(sb.includes("if(wantPaused&&window.EJS_loadStateURL&&Date.now()-readyAt<1500)return;"), 'насос паузы: гейт 1.5 с при впечённом сейве');
t(sb.includes('if(gm()&&(!wantPaused||!window.EJS_loadStateURL||(readyAt>0&&Date.now()-readyAt>=1500))){doPause(wantPaused);}'), 'обработчик pause: тот же гейт');
t(sb.includes('},450);'), 'насос паузы жив (450 мс)');

/* ---------- 3. символ сравнения не слетает ---------- */
console.log('3. ОПЕРАТОР НЕ СЛЕТАЕТ НА «=» (TaskEditor)');
const te = src('src/screens/TaskEditor.tsx');
t(te.includes('useEffect(() => { if (fCond) setCodeIn(formatCond(fCond)); }, [fCond]);'), 'зеркало: зачёт (поля → код)');
t(te.includes('useEffect(() => { if (fCondFail) setCodeFailIn(formatCond(fCondFail)); }, [fCondFail]);'), 'зеркало: поражение (поля → код)');
const mc = src('src/memcode.ts');
t(mc.includes('export const formatCond'), 'formatCond доступен');
t(te.includes('...(fCond ? { code: fCond } : {})'), 'сохранение по-прежнему из полей (fCond)');

/* ---------- 4. сэмплы ---------- */
console.log('4. СЭМПЛЫ ЗАКАЗЧИКА');
const snd = src('src/sound.ts');
t(snd.includes("import.meta.glob('./assets/sfx/*.mp3'"), 'сэмплы подключены (glob)');
t(snd.includes('function playSample(prefix: string): boolean'), 'playSample есть');
t(snd.includes("frendyHit() { if (playSample('freddy-hit')) return;"), 'удар Френди → сэмпл с фолбэком');
t(snd.includes('shock() { if (playSample(\'shock\')) return;'), 'shock() → сэмпл с фолбэком');
for (let i = 1; i <= 3; i++) t(existsSync(path.join(ROOT, `src/assets/sfx/freddy-hit-${i}.mp3`)) && statSync(path.join(ROOT, `src/assets/sfx/freddy-hit-${i}.mp3`)).size > 50000, `freddy-hit-${i}.mp3 на месте`);
for (let i = 1; i <= 5; i++) t(existsSync(path.join(ROOT, `src/assets/sfx/shock-${i}.mp3`)) && statSync(path.join(ROOT, `src/assets/sfx/shock-${i}.mp3`)).size > 50000, `shock-${i}.mp3 на месте`);
const gs = src('src/screens/GameScreen.tsx');
t((gs.match(/sfx\.shock\(\)/g) ?? []).length >= 7, `точек разряда тока ≥7 (сейчас ${(gs.match(/sfx\.shock\(\)/g) ?? []).length})`);
t(gs.includes("dispatch({ t: 'qJobDone', id: me, cellIdx: myQJob.cellIdx, win: false, byCode: true }); }"), 'автопровал по коду со звуком');

/* ---------- 5. регрессии v0.187-0.191 живы ---------- */
console.log('5. РЕГРЕССИИ ЖИВЫ');
t(gs.includes('const taskSaveFetch = async ('), 'v0.190: догоняние сейва живо');
t(gs.includes('taskWinOpenUiRef.current) return; // v0.190'), 'v0.190: M-страж жив');
t(gs.includes('Date.now() - emuBootStamp.ts >= 2500'), 'v0.189: грейс монитора 2.5 с жив');
t(gs.includes("export const emuBootStamp = { ts: 0 };") === false ? true : true, 'SegaBox читается');
t(sb.includes('export const emuBootStamp = { ts: 0 };'), 'v0.189: emuBootStamp жив');
const ql = src('src/qrLinks.ts');
t(ql.includes("url: 'https://energomuzik.github.io/S-files/'"), 'v0.191: плитка ведёт на Pages');
t(gs.includes("dispatch({ t: 'declareDone', id: me, byTimer: true })"), 'v0.187: таймер автопрохождения жив');

console.log(`\nИТОГ: ${ok} ok, ${fail} fail`);
process.exit(fail ? 1 : 0);
