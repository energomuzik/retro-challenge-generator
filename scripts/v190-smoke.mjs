// v0.190 smoke: поимка Френди не проваливает задание без сейва; SELECT/M не открывают
// карту мира в окне задания; плитка «S-ФАЙЛЫ · СКОРО» на главном экране.
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
t(/export const APP_VERSION = 184;/.test(typesSrc), 'APP_VERSION = 184');
t(typesSrc.includes('APP_VERSION 183→184; v0.190.0'), 'чейнджлог APP_VERSION 183→184; v0.190.0');
t(typesSrc.includes('// 183: 0.189.0 ТРИ ФИКСА'), 'история 0.189.0 сдвинута в // 183:');
t(versionSrc.includes('S-ФАЙЛЫ · СКОРО'), 'в version.ts inline-коммент 0.190.0');
t(versionSrc.includes('// 0.189.0 (история)'), 'в version.ts 0.189.0 ушла в историю');

/* ---------- 2. догоняние сохранения ---------- */
console.log('2. СОХРАНЕНИЕ ДО СТАРТА ЯДРА (GameScreen)');
const gs = src('src/screens/GameScreen.tsx');
t(gs.includes('const taskSaveFetch = async ('), 'хелпер taskSaveFetch');
t(gs.includes("st.room?.send('needRom', { romId, saveId });"), 'запрос needRom хосту между попытками');
t((gs.match(/await taskSaveFetch\(/g) ?? []).length === 3, 'taskSaveFetch вызывается в 3 окнах (челлендж/RUBG/личное)');
t(gs.includes('if ((chCode || chCodeF) && task?.saveId && !saveState) return;'), 'гейт монитора: челлендж');
t(gs.includes('if ((qCode || qCodeF) && myQTask?.saveId && !qSaveState) return;'), 'гейт монитора: личное окно');
t(gs.includes('if ((rCode || rCodeF) && myRubgTask?.saveId && !rSaveState) return;'), 'гейт монитора: RUBG');
t(gs.includes('me, saveState, qSaveState, rSaveState]);'), 'депсы монитора включают сейв-состояния');
t(gs.includes('СОХРАНЕНИЕ ЗАДАНИЯ НЕ НАЙДЕНО'), 'баннер «сейв не найден»');
t(gs.includes('myQTask?.saveId && !qSaveState && qRomBuf && ('), 'баннер горит только ПОСЛЕ монтирования ядра');

/* ---------- 3. страж SELECT/M ---------- */
console.log('3. SELECT/M В ОКНЕ ЗАДАНИЯ');
t(gs.includes('const taskWinOpenUiRef = useRef(false);'), 'taskWinOpenUiRef объявлен');
t(gs.includes('if (taskWinOpenUiRef.current) return; // v0.190: в окне задания M карту мира не открывает'), 'M-клавиша заглушена в окне задания');
t(gs.includes('if (cur && !was && !cutActiveRef.current && !taskWinOpenUiRef.current) { toggleWorldMapView(); sfx.click(); }'), 'Select-джойстик заглушен в окне задания');
t(gs.includes('taskWinOpenUiRef.current = open; // v0.190: зеркало'), 'рефл обновляется из эффекта окна');

/* ---------- 4. плитка S-файлы ---------- */
console.log('4. ПЛИТКА «S-ФАЙЛЫ · СКОРО»');
const ql = src('src/qrLinks.ts');
t(ql.includes("key: 'sfiles', label: 'S-ФАЙЛЫ · СКОРО', url: 'https://github.com/energomuzik/S-files'"), 'запись в QR_LINKS_RIGHT');
const iconPath = path.join(ROOT, 'src/assets/qr/sfiles-icon.png');
t(existsSync(iconPath) && statSync(iconPath).size > 1000, 'иконка sfiles-icon.png в assets/qr/');

/* ---------- 5. регрессии v0.188-0.189 живы ---------- */
console.log('5. РЕГРЕССИИ ЖИВЫ');
t(gs.includes('Date.now() - emuBootStamp.ts >= 2500'), 'v0.189: грейс монитора 2.5 с жив');
t(gs.includes('failStreakRef.current >= 2'), 'v0.189: провал при 2 подряд жив');
const sb = src('src/SegaBox.tsx');
t(sb.includes('export const emuBootStamp = { ts: 0 };'), 'v0.189: emuBootStamp жив');
t(sb.includes('},200);'), 'v0.189: насос громкости 200 мс жив');
const eng = src('src/engine.ts');
t(!eng.includes('ЗАЧИСТКА ЗАВИСШИХ ЗАДАНИЙ'), 'v0.189: фоновая зачистка по-прежнему снята');
t(gs.includes("dispatch({ t: 'declareDone', id: me, byTimer: true })"), 'v0.187: таймер автопрохождения жив');

console.log(`\nИТОГ: ${ok} ok, ${fail} fail`);
process.exit(fail ? 1 : 0);
