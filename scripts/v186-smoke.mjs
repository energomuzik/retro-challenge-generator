// v0.186 smoke: настоящая пауза в запуске эмулятора (кнопка «Пауза/Продолжить»,
// проп paused в SegaBox, сброс паузы при launch/reset/«Выключить») + квадрат в
// кнопке «Выключить» (была иконка паузы) + версии/история.
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
t(/export const APP_VERSION = 180;/.test(typesSrc), 'APP_VERSION = 180');
t(typesSrc.includes('APP_VERSION 179→180; v0.186.0'), 'в чейнджлоге APP_VERSION 179→180; v0.186.0');
t(typesSrc.includes('// 179: 0.185.0 ОЗВУЧКА КИНАМАНА'), 'история 0.185.0 сдвинута в // 179:');
t(versionSrc.includes('APP_VERSION + 6'), 'VERSION = APP_VERSION + 6 (0.186.0)');
t(versionSrc.includes('// 0.186.0 НАСТОЯЩАЯ ПАУЗА'), 'в version.ts inline-коммент 0.186.0');
t(versionSrc.includes('// 0.185.0 (история)'), 'в version.ts 0.185.0 ушла в историю');

/* ---------- 2. иконка stop — квадрат ---------- */
console.log('2. ИКОНКА STOP (квадрат)');
const uiSrc = src('src/ui.tsx');
t(/stop: \(s = 16, c\?: string\) => \(/.test(uiSrc), 'Ic.stop определён в ui.tsx');
t(/pause: \(s = 16, c\?: string\) => \(/.test(uiSrc), 'Ic.pause остался на месте (для кнопки «Пауза»)');
{
  const block = uiSrc.match(/stop: \(s = 16[\s\S]*?p=\{\[([\s\S]*?)\]\}/)?.[1] ?? '';
  const rows = [...block.matchAll(/'([01.]{10})'/g)].map((m) => m[1]);
  t(rows.length >= 8, `у stop >= 8 рядов по 10 пикселей — факт: ${rows.length}`);
  const filled = rows.filter((r) => r.includes('1'));
  t(filled.length > 0 && filled.every((r) => r.includes('11111111')), 'заливка сплошная шириной 8 — КВАДРАТ');
  t(rows.some((r) => /^\.{10}$/.test(r)) && filled.every((r) => r.startsWith('.') && r.endsWith('.')), 'отступ по краям (контур точками)');
  t(rows.every((r) => r.length === 10 && /^[01.]+$/.test(r)), 'матрица чистая: только 0/1/точки');
}

/* ---------- 3. кнопка «Выключить» — теперь с квадратом ---------- */
console.log('3. КНОПКА «ВЫКЛЮЧИТЬ»');
const emuSrc = src('src/screens/EmulatorLauncher.tsx');
t(emuSrc.includes('Ic.stop(13)} Выключить'), '«Выключить» использует Ic.stop(13)');
t(!emuSrc.includes('Ic.pause(13)} Выключить'), 'иконка паузы у «Выключить» убрана');
t((emuSrc.match(/Ic\.stop\(/g) || []).length === 1, 'Ic.stop в EmulatorLauncher ровно один');

/* ---------- 4. настоящая пауза ---------- */
console.log('4. НАСТОЯЩАЯ ПАУЗА');
t(/const \[emuPaused, setEmuPaused\] = useState\(false\);/.test(emuSrc), 'состояние emuPaused объявлено');
t(emuSrc.includes("paused={emuPaused}"), 'paused={emuPaused} проброшен в SegaBox');
t(emuSrc.includes("'Продолжить' : 'Пауза'"), 'кнопка переключается «Пауза ↔ Продолжить»');
t(emuSrc.includes('Ic.pause(13) : Ic.play(13)') || emuSrc.includes('emuPaused ? Ic.play(13) : Ic.pause(13)'), 'иконки ⏸/▶ у кнопки паузы');
const resets = (emuSrc.match(/setEmuPaused\(false\)/g) || []).length;
t(resets >= 3, `пауза сбрасывается минимум в 3 местах (launch, resetEmu, «Выключить») — факт: ${resets}`);
t(/const launch = async \(state\?: unknown\) => \{[\s\S]*?setEmuPaused\(false\);[\s\S]*?launchedRomRef\.current = romId;/.test(emuSrc), 'launch снимает паузу');
t(/const resetEmu = \(\) => \{[\s\S]*?loadSaveReliable\(null\);[\s\S]*?setEmuPaused\(false\);/.test(emuSrc), 'resetEmu (живой путь) снимает паузу');
t(/setRunning\(false\); launchedRomRef\.current = null; setEmuPaused\(false\);/.test(emuSrc), '«Выключить» снимает паузу');

/* ---------- 5. SegaBox и GameScreen не сломаны ---------- */
console.log('5. SEGABOX/GAMESCREEN БЕЗ ИЗМЕНЕНИЙ СЕМАНТИКИ');
const sb = src('src/SegaBox.tsx');
t(sb.includes('function doPause(p){'), 'каскад паузы doPause жив');
t(sb.includes("postMessage({ type: 'pause', paused: !!paused }"), 'внешняя пауза через postMessage жива');
t(sb.includes("paused && status === 'ready'"), 'баннер «ПАУЗА» жив');
const gs = src('src/screens/GameScreen.tsx');
t((gs.match(/paused=\{/g) || []).length >= 3, 'три пропа паузы GameScreen на месте ( партии не тронуты )');
t(gs.includes("paused={ch.status === 'ready'"), 'пауза лобби GameScreen не изменилась');

console.log(`\nИТОГ: ${ok} ok, ${fail} fail`);
process.exit(fail ? 1 : 0);
