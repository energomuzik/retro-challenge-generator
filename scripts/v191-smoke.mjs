// v0.191 smoke: плитка «S-ФАЙЛЫ» ведёт на Pages-сборку; регрессии v0.187-0.190 живы.
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
t(/export const APP_VERSION = 185;/.test(typesSrc), 'APP_VERSION = 185');
t(typesSrc.includes('APP_VERSION 184→185; v0.191.0'), 'чейнджлог APP_VERSION 184→185; v0.191.0');
t(typesSrc.includes('// 184: 0.190.0 ТРИ ИЗМЕНЕНИЯ'), 'история 0.190.0 сдвинута в // 184:');
t(versionSrc.includes('energomuzik.github.io/S-files/'), 'в version.ts inline-коммент 0.191.0');
t(versionSrc.includes('// 0.190.0 (история)'), 'в version.ts 0.190.0 ушла в историю');

/* ---------- 2. плитка S-файлы → Pages ---------- */
console.log('2. ПЛИТКА «S-ФАЙЛЫ» → PAGES');
const ql = src('src/qrLinks.ts');
t(ql.includes("key: 'sfiles', label: 'S-ФАЙЛЫ', url: 'https://energomuzik.github.io/S-files/'"), 'url плитки = Pages-сборка');
t(!ql.includes("url: 'https://github.com/energomuzik/S-files'"), 'ссылки на файлы репозитория больше нет');
t(!ql.includes("label: 'S-ФАЙЛЫ · СКОРО'"), 'метка «СКОРО» снята (в label)');
const iconPath = path.join(ROOT, 'src/assets/qr/sfiles-icon.png');
t(existsSync(iconPath) && statSync(iconPath).size > 1000, 'иконка sfiles-icon.png на месте');

/* ---------- 3. регрессии v0.187-0.190 живы ---------- */
console.log('3. РЕГРЕССИИ ЖИВЫ');
const gs = src('src/screens/GameScreen.tsx');
t(gs.includes('const taskSaveFetch = async ('), 'v0.190: догоняние сейва живо');
t((gs.match(/await taskSaveFetch\(/g) ?? []).length === 3, 'v0.190: taskSaveFetch в 3 окнах');
t(gs.includes('СОХРАНЕНИЕ ЗАДАНИЯ НЕ НАЙДЕНО'), 'v0.190: баннер жив');
t(gs.includes('taskWinOpenUiRef.current) return; // v0.190'), 'v0.190: M-страж жив');
t(gs.includes('&& !taskWinOpenUiRef.current) { toggleWorldMapView(); sfx.click(); }'), 'v0.190: Select-страж жив');
t(gs.includes('Date.now() - emuBootStamp.ts >= 2500'), 'v0.189: грейс монитора 2.5 с жив');
t(gs.includes('failStreakRef.current >= 2'), 'v0.189: провал при 2 подряд жив');
t(gs.includes("dispatch({ t: 'declareDone', id: me, byTimer: true })"), 'v0.187: таймер автопрохождения жив');

console.log(`\nИТОГ: ${ok} ok, ${fail} fail`);
process.exit(fail ? 1 : 0);
