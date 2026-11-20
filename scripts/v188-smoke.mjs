// v0.188 smoke: фикс Френди «ON не запускает задание после поимки».
// Зависшее «невидимое» личное задание (окно не открывается — myQTask = null)
// молча блокировало frendyPowerOn и кнопку POWER ON. Четыре слоя защиты:
// хост-зачистка висших qJobs, фильтр поимки, самолечение в powerOn,
// честные сообщения в логе вместо немых стражей.
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
t(/export const APP_VERSION = 182;/.test(typesSrc), 'APP_VERSION = 182');
t(typesSrc.includes('APP_VERSION 181→182; v0.188.0'), 'чейнджлог APP_VERSION 181→182; v0.188.0');
t(typesSrc.includes('// 181: 0.187.0 ДВЕ АВТОПАУЗЫ'), 'история 0.187.0 сдвинута в // 181:');
t(versionSrc.includes('// 0.188.0 ФИКС ФРЕНДИ'), 'в version.ts inline-коммент 0.188.0');
t(versionSrc.includes('// 0.187.0 (история)'), 'в version.ts 0.187.0 ушла в историю');

/* ---------- 2. хост-зачистка висших qJobs ---------- */
console.log('2. ХОСТ-ЗАЧИСТКА ВИСШИХ ЗАДАНИЙ (frendyTickDo)');
const eng = src('src/engine.ts');
t(eng.includes('v0.188 ЗАЧИСТКА ЗАВИСШИХ ЗАДАНИЙ'), 'коммент блока зачистки');
t(/if \(jb && !cellTaskOf\(s, map, jb\.cellIdx\)\) \{\s*\n\s*delete s\.qJobs\[pid\];/.test(eng), 'запись без решаемого задания удаляется');
t(eng.includes('зависшее задание (приставка №'), 'лог зачистки в тике');
const tickDo = eng.slice(eng.indexOf('const frendyTickDo = () => {'), eng.indexOf('const frendyTickDo = () => {') + 1600);
t(tickDo.includes('cellTaskOf'), 'зачистка ВНУТРИ frendyTickDo');

/* ---------- 3. поимка не создаёт невидимых заданий ---------- */
console.log('3. ФИЛЬТР ПОИМКИ (armed)');
t(/const armed = map\.cells\.map\(\(c, i\) => \(\{ c, i \}\)\)\.filter\(\(\{ i \}\) => map\.cells\[i\]\.type === 'task' && frendyCartTaskIdx\(s, map, i\) !== null && cellTaskOf\(s, map, i\) !== null && !consolesBusy\(i\)\);/.test(eng), 'armed требует решаемое задание');
t(eng.includes('чьё задание РЕАЛЬНО\n         открывается'), 'коммент фильтра поимки');

/* ---------- 4. POWER ON: самолечение и честные сообщения ---------- */
console.log('4. FRENDYPOWERON: САМОЛЕЧЕНИЕ И ЛОГИ');
t(/if \(!cellTaskOf\(s, map, s\.qJobs\[p\.id\]\.cellIdx\)\) \{ delete s\.qJobs\[p\.id\]; log\(`🧹 \$\{p\.name\}: зависшее задание снято — приставка снова свободна`\); \}/.test(eng), 'зависшее задание снимается НА МЕСТЕ, ON срабатывает');
t(eng.includes('у тебя уже открыто личное задание — закончи его или нажми «Уйти»'), 'живое задание: честное сообщение');
t(eng.includes('📼 Картридж не читается: задания на нём больше нет — вставь другой'), 'нечитающийся картридж: сообщение вместо тишины');
t(!/if \(s\.qJobs\?\.\[p\.id\]\) break; \/\/ уже играешь личное задание/.test(eng), 'немой страж «уже играешь» удалён');

/* ---------- 5. Регрессии v0.186–v0.187 живы ---------- */
console.log('5. РЕГРЕССИИ ЖИВЫ');
const gs = src('src/screens/GameScreen.tsx');
t(gs.includes("dispatch({ t: 'declareDone', id: me, byTimer: true })"), 'v0.187: таймер автопрохождения жив');
t(gs.includes('pauseOnTaskStart ?? true'), 'v0.187: автопауза при старте задания жива');
const emuSrc = src('src/screens/EmulatorLauncher.tsx');
t(emuSrc.includes('void launch(full.state, pauseOnSaveLoad);'), 'v0.187: автопауза при загрузке сейва жива');
t(eng.includes('byTimer'), 'v0.187: byTimer в движке жив');
const te = src('src/screens/TaskEditor.tsx');
t(te.includes('Таймер автопрохождения М:СС (необязательно)'), 'v0.187: поле win-таймера в редакторе живо');

console.log(`\nИТОГ: ${ok} ok, ${fail} fail`);
process.exit(fail ? 1 : 0);
