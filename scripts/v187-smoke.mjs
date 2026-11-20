// v0.187 smoke: две автопаузы после загрузки сохранения (опции pauseOnTaskStart /
// pauseOnSaveLoad, обе ВКЛ по умолчанию, переключатели в Опциях, автопаузы в трёх
// окнах заданий и в «Запуске эмулятора») + таймер автопрохождения задания
// (TaskDef.winTimerSec: поля в редакторе, byTimer в движке даже у codeOnly,
// бирюзовый бейдж в окнах) + версии/история.
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
t(/export const APP_VERSION = 181;/.test(typesSrc), 'APP_VERSION = 181');
t(typesSrc.includes('APP_VERSION 180→181; v0.187.0'), 'в чейнджлоге APP_VERSION 180→181; v0.187.0');
t(typesSrc.includes('// 180: 0.186.0 НАСТОЯЩАЯ ПАУЗА'), 'история 0.186.0 сдвинута в // 180:');
t(versionSrc.includes('APP_VERSION + 6'), 'VERSION = APP_VERSION + 6 (0.187.0)');
t(versionSrc.includes('// 0.187.0 ДВЕ АВТОПАУЗЫ'), 'в version.ts inline-коммент 0.187.0');
t(versionSrc.includes('// 0.186.0 (история)'), 'в version.ts 0.186.0 ушла в историю');

/* ---------- 2. опции: типы, дефолты, переключатели ---------- */
console.log('2. ДВЕ ОПЦИИ АВТОПАУЗЫ');
t(typesSrc.includes('pauseOnTaskStart?: boolean;'), 'GameOptions.pauseOnTaskStart объявлен');
t(typesSrc.includes('pauseOnSaveLoad?: boolean;'), 'GameOptions.pauseOnSaveLoad объявлен');
const storeSrc = src('src/store.ts');
t(/pauseOnTaskStart: true,/.test(storeSrc), 'дефолт pauseOnTaskStart = true');
t(/pauseOnSaveLoad: true,/.test(storeSrc), 'дефолт pauseOnSaveLoad = true');
const optSrc = src('src/screens/OptionsScreen.tsx');
t(optSrc.includes('checked={options.pauseOnTaskStart ?? true}'), 'переключатель «Пауза при старте задания»');
t(optSrc.includes('checked={options.pauseOnSaveLoad ?? true}'), 'переключатель «Пауза при загрузке сохранения»');
t((optSrc.match(/setOptions\(\{ pauseOnTaskStart: v \}\)/g) || []).length === 1, 'onChange pauseOnTaskStart');
t((optSrc.match(/setOptions\(\{ pauseOnSaveLoad: v \}\)/g) || []).length === 1, 'onChange pauseOnSaveLoad');

/* ---------- 3. автопауза при старте задания (три окна) ---------- */
console.log('3. АВТОПАУЗА ПРИ СТАРТЕ ЗАДАНИЯ');
const gs = src('src/screens/GameScreen.tsx');
t(/dispatch\(\{ t: 'startTask', id: me \}\); if \(options\.pauseOnTaskStart \?\? true\) dispatch\(\{ t: 'togglePause', id: me \}\)/.test(gs), 'классика: togglePause сразу после startTask');
t(/setQArmed\(true\); if \(options\.pauseOnTaskStart \?\? true\) setQPaused\(true\);/.test(gs), 'QUEST/Богач/Френди: setQPaused(true)');
t(/setRubgJobArmed\(true\); if \(options\.pauseOnTaskStart \?\? true\) setRubgPaused\(true\);/.test(gs), 'RUBG: setRubgPaused(true)');

/* ---------- 4. автопауза при загрузке сохранения ---------- */
console.log('4. АВТОПАУЗА ПРИ ЗАГРУЗКЕ СОХРАНЕНИЯ');
const emuSrc = src('src/screens/EmulatorLauncher.tsx');
t(emuSrc.includes("useApp((st) => st.options.pauseOnSaveLoad ?? true)"), 'селектор pauseOnSaveLoad в EmulatorLauncher');
t(/launch = async \(state\?: unknown, pausedAfter\?: boolean\)/.test(emuSrc), 'launch получил параметр pausedAfter');
t(emuSrc.includes('setEmuPaused(!!pausedAfter)'), 'launch ставит паузу по параметру');
t(/if \(pauseOnSaveLoad\) setEmuPaused\(true\);/.test(emuSrc), 'живая загрузка: setEmuPaused(true) по опции');
t(emuSrc.includes('void launch(full.state, pauseOnSaveLoad);'), 'запуск с состоянием: pausedAfter = опция');

/* ---------- 5. таймер автопрохождения: типы и редактор ---------- */
console.log('5. ТАЙМЕР АВТОПРОХОЖДЕНИЯ (типы и редактор)');
t(typesSrc.includes('winTimerSec?: number;'), 'TaskDef.winTimerSec объявлен');
const te = src('src/screens/TaskEditor.tsx');
t(te.includes("const [wTimerMin, setWTimerMin] = useState('');"), 'стейты wTimerMin/wTimerSec');
t(te.includes("tdef?.winTimerSec !== undefined && tdef.winTimerSec > 0 ? String(Math.floor(tdef.winTimerSec / 60)) : ''"), 'загрузка winTimerSec в форму');
t(te.includes('return total > 0 ? { winTimerSec: total } : {};'), 'сохранение winTimerSec из формы');
t(te.includes('Таймер автопрохождения М:СС (необязательно)'), 'поле «Таймер автопрохождения» в UI');
t(te.includes('value={wTimerMin}') && te.includes('value={wTimerSec}'), 'инпуты минут и секунд привязаны');

/* ---------- 6. таймер автопрохождения: GameScreen и движок ---------- */
console.log('6. ТАЙМЕР АВТОПРОХОЖДЕНИЯ (GameScreen и движок)');
t(gs.includes('task?.winTimerSec && ch.status === \'playing\''), 'winTimerSpec: классика');
t(gs.includes('myQTask?.winTimerSec && qArmed'), 'winTimerSpec: QUEST/Богач/Френди');
t(gs.includes('myRubgTask?.winTimerSec && rubgJobArmed'), 'winTimerSpec: RUBG');
t((gs.match(/\{winTimerBadge\}/g) || []).length === 3, 'бейдж winTimerBadge в трёх окнах');
t(gs.includes("dispatch({ t: 'declareDone', id: me, byTimer: true })"), 'классика: declareDone byTimer');
t(gs.includes("dispatch({ t: 'rubgJobDone', id: me, cellIdx: myJob.cellIdx, win: true, byTimer: true })"), 'RUBG: rubgJobDone win byTimer');
t(gs.includes("dispatch({ t: 'qJobDone', id: me, cellIdx: myQJob.cellIdx, win: true, byTimer: true })"), 'QUEST: qJobDone win byTimer');
t(gs.includes("timerSpec.kind === 'classic' ? !ch?.paused"), 'таймер провала в классике стоит на паузе');
const eng = src('src/engine.ts');
t(eng.includes("{ t: 'declareDone'; id: string; byCode?: boolean; byTimer?: boolean }"), 'экшен declareDone: byTimer');
t(eng.includes("{ t: 'rubgJobDone'; id: string; cellIdx: number; win: boolean; byCode?: boolean; byTimer?: boolean }"), 'экшен rubgJobDone: byTimer');
t(eng.includes("{ t: 'qJobDone'; id: string; cellIdx: number; win: boolean; byCode?: boolean; force?: boolean; byTimer?: boolean }"), 'экшен qJobDone: byTimer');
t(eng.includes('codeOnly && !a.byCode && !a.force && !a.byTimer'), 'qJobDone: byTimer проходит codeOnly');
t(eng.includes('codeOnly && !a.byCode && !a.byTimer'), 'rubgJobDone: byTimer проходит codeOnly');
t(eng.includes('codeOnlyNow && !a.byCode && !a.byTimer'), 'declareDone: byTimer проходит codeOnly');
t(eng.includes('if (a.byTimer) {'), 'declareDone: победа по таймеру без голосования');
t(eng.includes('ПО ТАЙМЕРУ АВТОПРОХОЖДЕНИЯ'), 'лог RUBG о победе по таймеру');

/* ---------- 7. паузы v0.186 не сломаны ---------- */
console.log('7. ПАУЗА v0.186 ЖИВА');
const sb = src('src/SegaBox.tsx');
t(sb.includes('function doPause(p){'), 'каскад паузы doPause жив');
t(emuSrc.includes('paused={emuPaused}'), 'проп paused в EmulatorLauncher жив');
t(emuSrc.includes("'Продолжить' : 'Пауза'"), 'кнопка Пауза/Продолжить жива');
t((gs.match(/paused=\{/g) || []).length >= 3, 'три пропа паузы GameScreen на месте');

console.log(`\nИТОГ: ${ok} ok, ${fail} fail`);
process.exit(fail ? 1 : 0);
