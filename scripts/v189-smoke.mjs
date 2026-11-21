// v0.189 smoke: три фикса по карте «FRENDY КАРТА BETA2» (Пятница 13).
// 1) Мгновенный провал при запуске задания (гонка загрузки сейва против монитора codeFail).
// 2) Звук на максимуме при загрузке сохранения (новые AL-источники играют до тика насоса).
// 3) Фоновая зачистка висших qJobs из v0.188 снята — лечение событийное.
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
t(/export const APP_VERSION = 183;/.test(typesSrc), 'APP_VERSION = 183');
t(typesSrc.includes('APP_VERSION 182→183; v0.189.0'), 'чейнджлог APP_VERSION 182→183; v0.189.0');
t(typesSrc.includes('// 182: 0.188.0 ФИКС ФРЕНДИ'), 'история 0.188.0 сдвинута в // 182:');
t(versionSrc.includes('ТРИ ФИКСА ПО КАРТЕ «FRENDY КАРТА BETA2»'), 'в version.ts inline-коммент 0.189.0');
t(versionSrc.includes('// 0.188.0 (история)'), 'в version.ts 0.188.0 ушла в историю');

/* ---------- 2. штамп старта ядра ---------- */
console.log('2. ШТАМП СТАРТА ЯДРА (SegaBox → emuBootStamp)');
const sb = src('src/SegaBox.tsx');
t(sb.includes('export const emuBootStamp = { ts: 0 };'), 'emuBootStamp экспортирован');
t(/emuBootStamp\.ts = Date\.now\(\);\s*\n\s*frameRef\.current\?\.contentWindow\?\.postMessage\(\{ type: 'boot'/.test(sb), 'штамп обновляется при каждом boot');

/* ---------- 3. гейт монитора codeFail ---------- */
console.log('3. ГЕЙТ МОНЙТОРА ПОРАЖЕНИЯ (GameScreen)');
const gs = src('src/screens/GameScreen.tsx');
t(gs.includes("import SegaBox, { emuBootStamp, type SegaApi } from '../SegaBox';"), 'emuBootStamp импортирован');
t(gs.includes('Date.now() - emuBootStamp.ts >= 2500'), 'грейс 2.5 с от старта ядра');
t(gs.includes('failStreakRef.current >= 2'), 'провал только при 2 подряд совпадениях');
t(/} else failStreakRef\.current = 0;/.test(gs), 'сброс счётчика при несовпадении');
t(gs.includes('ГРАЖДАНСКАЯ ОБОРОНА ОТ МГНОВЕННОГО ПРОВАЛА'), 'коммент фикса');

/* ---------- 4. громкость ---------- */
console.log('4. ГРОМКОСТЬ (насос в iframe)');
t(sb.includes("setVolNow(wantVol);try{parent.postMessage({type:\"ejs-ready\"}"), 'громкость применяется сразу в EJS_ready');
t(sb.includes('},200);'), 'насос тикает 200 мс (был 500)');
t(sb.includes('c.context.suspend()'), 'нулевая громкость — suspend AudioContext');
t(sb.includes('c.context.resume()'), 'ненулевая — resume контекста');

/* ---------- 5. зачистка снята, событийное лечение живо ---------- */
console.log('5. ЗАЧИСТКА СНЯТА, СОБЫТИЙНОЕ ЛЕЧЕНИЕ ЖИВО');
const eng = src('src/engine.ts');
t(!eng.includes('ЗАЧИСТКА ЗАВИСШИХ ЗАДАНИЙ'), 'фоновая зачистка из frendyTickDo удалена');
t(eng.includes('фоновая зачистка зависших qJobs из v0.188 СНЯТА'), 'коммент про событийную модель');
t(eng.includes('зависшее задание снято — приставка снова свободна'), 'v0.188: самолечение в powerOn живо');
t(/frendyCartTaskIdx\(s, map, i\) !== null && cellTaskOf\(s, map, i\) !== null/.test(eng), 'v0.188: фильтр поимки жив');

/* ---------- 6. Регрессии живы ---------- */
console.log('6. РЕГРЕССИИ ЖИВЫ');
t(gs.includes("dispatch({ t: 'declareDone', id: me, byTimer: true })"), 'v0.187: таймер автопрохождения жив');
t(gs.includes('pauseOnTaskStart ?? true'), 'v0.187: автопауза при старте задания жива');
const emuSrc = src('src/screens/EmulatorLauncher.tsx');
t(emuSrc.includes('void launch(full.state, pauseOnSaveLoad);'), 'v0.187: автопауза при загрузке сейва жива');
t(sb.includes('window.EJS_volume='), 'громкость по-прежнему запекается в iframe');

console.log(`\nИТОГ: ${ok} ok, ${fail} fail`);
process.exit(fail ? 1 : 0);
