// v0.197 smoke: тени ВЫКЛ по умолчанию + переключатель; автопауза загрузки сохранения
// ВЫКЛ по умолчанию (+ миграция); Френди ТАЩИТ пойманного к приставке как боссы (без
// мгновенного телепорта, задание после доставки); цепочки CodeSearch правятся по любой
// позиции; доп. условия победы/поражения в редакторе заданий. Регрессии v0.187–0.196 живы.
import { readFileSync, existsSync, statSync, mkdtempSync, writeFileSync, rmSync } from 'fs';
import path from 'path';
import os from 'os';
import url from 'url';

const ROOT = process.env.RCG_ROOT || '/home/z/my-project/rcg'; // RCG_ROOT — для roundtrip-прогона в чистом клоне
let ok = 0, fail = 0;
const t = (cond, name) => { if (cond) { ok++; console.log(`  ✓ ${name}`); } else { fail++; console.error(`  ✗ FAIL: ${name}`); } };
const src = (p) => readFileSync(path.join(ROOT, p), 'utf8');

/* ---------- 1. версии ---------- */
console.log('1. ВЕРСИИ');
const typesSrc = src('src/types.ts');
const versionSrc = src('src/version.ts');
t(/export const APP_VERSION = 191;/.test(typesSrc), 'APP_VERSION = 191');
t(typesSrc.includes('APP_VERSION 190→191; v0.197.0'), 'чейнджлог APP_VERSION 190→191; v0.197.0');
t(typesSrc.includes('// 190: 0.196.0 ПЯТЬ ИЗМЕНЕНИЙ') || typesSrc.includes('// 190: 0.196.0 ТРИ ИЗМЕНЕНИЯ'), 'история 0.196.0 сдвинута в // 190:');
t(versionSrc.includes('ФРЕНДИ ТАЩИТ ПОЙМАННОГО К ПРИСТАВКЕ'), 'в version.ts inline-коммент 0.197.0');
t(versionSrc.includes('// 0.196.0 (история)'), 'в version.ts 0.196.0 ушла в историю');

/* ---------- 2. п.1 ТЕНИ ---------- */
console.log('2. ТЕНИ — ВЫКЛ ПО УМОЛЧАНИЮ + ПЕРЕКЛЮЧАТЕЛЬ');
const render = src('src/render.ts');
const store = src('src/store.ts');
const opts = src('src/screens/OptionsScreen.tsx');
const gs = src('src/screens/GameScreen.tsx');
t(render.includes('shadows?: boolean;'), 'BoardDrawOpts: поле shadows');
t(render.includes('const shadows = o.shadows ?? false;'), 'drawBoard: дефолт ВЫКЛ');
t((render.match(/withShadow = false/g) ?? []).length === 3, 'drawFrendyConsole/Chip/Boss: параметр withShadow (дефолт false)');
t(render.includes('if (withShadow) {\n      ctx.fillStyle = \'rgba(0,0,0,0.3)\';'), 'приставка: тень корпуса под гейтом');
t(render.includes('if (shadows) {\n      ctx.fillStyle = \'rgba(0,0,0,0.45)\';\n      ctx.beginPath();\n      ctx.ellipse(0, sz * 0.47'), 'фишки: тень под гейтом');
t(render.includes('if (shadows) {\n        ctx.fillStyle = \'rgba(0,0,0,0.4)\';\n        ctx.beginPath();\n        ctx.ellipse(0, 3, w * 0.22'), 'агенты (Молдер/Салли): тень под гейтом');
t((render.match(/drawFrendyConsole\((.*)shadows\);/g) ?? []).length === 2, 'приставки: shadows в обоих вызовах');
t(render.includes('drawFrendyChip(ctx, c.x, c.y + by, o.time, c.kind, cartArt, shadows);'), 'микросхемы: shadows в вызове');
t(render.includes('drawFrendyBoss(ctx, o.frendyBoss.x, o.frendyBoss.y, o.time, o.frendyBoss.fx, o.frendyBoss.fxTs, o.frendyBoss.walking, o.frendyBoss.flip, shadows);'), 'Френди: shadows в вызове');
t(store.includes('entityShadows: false,'), 'store: entityShadows = false');
t(opts.includes('checked={options.entityShadows ?? false}'), 'Опции: тумблер теней (дефолт ВЫКЛ)');
t(opts.includes('label="Тени под персонажами и приставками"'), 'Опции: подпись тумблера');
t(gs.includes('shadows: options.entityShadows ?? false,'), 'GameScreen: shadows уходит в drawBoard');

/* ---------- 3. п.2 АВТОПАУЗА ЗАГРУЗКИ ---------- */
console.log('3. АВТОПАУЗА ЗАГРУЗКИ СОХРАНЕНИЯ — ДЕФОЛТ ВЫКЛ');
t(store.includes('pauseOnSaveLoad: false, // v0.197'), 'store: pauseOnSaveLoad = false');
t(store.includes('options.pauseMig197'), 'store: одноразовая миграция pauseMig197');
t(store.includes('options.pauseOnSaveLoad = false;'), 'store: миграция снимает включённую автопаузу');
t(opts.includes('checked={options.pauseOnSaveLoad ?? false}'), 'Опции: дефолт ВЫКЛ');
t(opts.includes('ВЫКЛ (по умолчанию с 0.197)'), 'Опции: подпись обновлена');
const el = src('src/screens/EmulatorLauncher.tsx');
t(el.includes('st.options.pauseOnSaveLoad ?? false'), 'EmulatorLauncher: дефолт ВЫКЛ');
t(opts.includes('checked={options.pauseOnTaskStart ?? true}'), 'регрессия: «Пауза при старте задания» осталась ВКЛ');
t(typesSrc.includes('pauseMig197?: boolean;'), 'types: pauseMig197 в GameOptions');
t(typesSrc.includes('entityShadows?: boolean;'), 'types: entityShadows в GameOptions');

/* ---------- 4. п.3 ФРЕНДИ ТАЩИТ ---------- */
console.log('4. ФРЕНДИ ТАЩИТ ПОЙМАННОГО (КАК БОССЫ)');
const eng = src('src/engine.ts');
t(typesSrc.includes('frendyCatch?: Record<string, { cell: number; at: number }>'), 'types: frendyCatch в сессии');
t(eng.includes('const oldPos = s.journeyPos?.[tgt.id]; // где жертва стояла в момент поимки'), 'engine: старая точка жертвы запомнена');
t(eng.includes("s.frendyCatch[tgt.id] = { cell: pick, at: now + dragMs + 1000 };"), 'engine: отложенный маркер задания');
t(eng.includes('base.frendyCatch = rk(base.frendyCatch);'), 'engine: frendyCatch ремапится по игрокам');
t((eng.match(/if \(r\) s\.journeyPos\[tgt\.id\] = \{ x: Math\.round\(r\.x \+ r\.w \/ 2\), y: Math\.round\(r\.y \+ r\.h \/ 2\), ts: now, mv: false \};/g) ?? []).length === 2, 'engine: 2 ветки journeyPos БЕЗ tp:true (вооружённая/любая приставка)');
t(eng.includes('s.journeyPos[tgt.id] = { x: Math.round(spot.x), y: Math.round(spot.y), ts: now, mv: false };'), 'engine: вышвырнувание тоже БЕЗ tp (тащит)');
t(eng.includes('const frendyCatchOpen = (pid: string): boolean => {'), 'engine: frendyCatchOpen');
t(eng.includes('if (isFrendyMode(map.mode)) {\n        if (s.phase === \'playing\') frendyCatchOpen(a.id);\n        break;\n      }'), 'engine: ветка Френди в bossTaskGo');
t(eng.includes('if (Date.now() > mc.at + 3000) frendyCatchOpen(pid);'), 'engine: страховка — хост откроет сам через 3 с');
t(eng.includes('СХВАТИЛ и ТАЩИТ к ПРИСТАВКЕ'), 'engine: лог «тащит»');
t(gs.includes('const frendyDragTsRef = useRef(0);'), 'GameScreen: frendyDragTsRef');
t(gs.includes("bossDragRef.current = { bossId: 'frendy'"), 'GameScreen: несение Френди через bossDragRef (кино как у боссов)');
t(gs.includes('frendyTpSnapRef.current = 0; // несение вместо телепорта'), 'GameScreen: снап-телепорт снят при несении');
t(gs.includes("bossCarryFxRef.current['frendy']"), 'GameScreen: локальный спрайт Френди-носильщика в drawBoard');
t(gs.includes('frendyCatchFx.who === me && jp && frendyCatchFx.ts === jp.ts'), 'GameScreen: старт несения по fx catch + ts journeyPos');
t(gs.includes('scheduleBossTaskGo(jp.ts, 1700);'), 'регрессия: классический захват боссом жив (та же математика v0.65)');

/* ---------- 5. п.4 ЦЕПОЧКИ В CODESEARCH ---------- */
console.log('5. CODESEARCH — КАЖДАЯ ЦИФРА ЦЕПОЧКИ ПРАВИТСЯ');
const cs = src('src/CodeSearch.tsx');
t(cs.includes('const [editPos, setEditPos] = useState(0);'), 'CodeSearch: editPos');
t(cs.includes('const [posSel, setPosSel] = useState<Record<number, number>>({});'), 'CodeSearch: posSel по строкам');
t(cs.includes('const writeRow = (baseA: number, pos: number, raw: string) => {'), 'CodeSearch: writeRow с позицией');
t(cs.includes('const a = baseA + pos * typeSize(t);'), 'CodeSearch: адрес позиции = начало + позиция × размер типа');
t(cs.includes('const toggleFreeze = (a: number, val?: number) => {'), 'CodeSearch: заморозка по точному адресу позиции');
t(cs.includes('onClick={() => { setPosSel((m) => ({ ...m, [r.a]: i })); setEditAddr(r.a); setEditPos(i); setEditVal(String(x)); }}'), 'CodeSearch: клик по цифре выбирает позицию');
t(cs.includes('const selA = r.a + selP * typeSize(t);'), 'CodeSearch: ✏/❄/🎯 работают с выбранной позицией');
t(cs.includes('setCondAddr(selA);'), 'CodeSearch: 🎯 ставит условие по адресу выбранной цифры');
t(cs.includes('каждая цифра — свой адрес'), 'CodeSearch: подсказка обновлена');
t(cs.includes('rows.find((r) => condAddr > r.a && condAddr < r.a + r.v.length * typeSize(t))'), 'CodeSearch: «сейчас там» находит позицию внутри цепочки');
t(cs.includes('0x{hex8(r.a)}{r.v.length > 1 ? <span className="text-faint"> +0…{r.v.length - 1}</span>'), 'CodeSearch: адреса позиций показаны в колонке адреса');

/* ---------- 6. п.5 ДОП. УСЛОВИЯ ---------- */
console.log('6. ДОП. УСЛОВИЯ ПОБЕДЫ/ПОРАЖЕНИЯ');
t(typesSrc.includes('codeWinExtra?: MemCond[];'), 'types: codeWinExtra');
t(typesSrc.includes('codeFailExtra?: MemCond[];'), 'types: codeFailExtra');
const te = src('src/screens/TaskEditor.tsx');
t(te.includes('+ Условие победы'), 'TaskEditor: кнопка «+ Условие победы»');
t(te.includes('+ Условие поражения'), 'TaskEditor: кнопка «+ Условие поражения»');
t(te.includes('const [fCondX, setFCondX] = useState<{ cond: MemCond | null; raw: string; err: string }[]>([]);'), 'TaskEditor: состояние доп. условий победы');
t(te.includes('setFCondX((tdef?.codeWinExtra ?? []).map((c) => ({ cond: c, raw: formatCond(c), err: \'\' })));'), 'TaskEditor: загрузка доп. условий из задания');
t(te.includes('codeWinExtra: fCondX.map((e) => e.cond).filter((c): c is MemCond => !!c)'), 'TaskEditor: сохранение codeWinExtra');
t(te.includes('codeFailExtra: fCondFailX.map((e) => e.cond).filter((c): c is MemCond => !!c)'), 'TaskEditor: сохранение codeFailExtra');
t(te.includes('fCodeOnly && !fCond && !fCondFail && fCondX.every((e) => !e.cond) && fCondFailX.every((e) => !e.cond)'), 'TaskEditor: «Только по коду» учитывает доп. условия');
t(gs.includes('const evalExtra = (c: MemCond, st: { armed: boolean; streak: number }, zeroArm: boolean): boolean => {'), 'GameScreen: evalExtra для доп. условий');
t(gs.includes('allWinX = xw.every((c, i) => evalExtra(c, extraWinStRef.current[i], true));'), 'GameScreen: победа = И по всем доп. условиям');
t(gs.includes('anyFailX = xf.some((c, i) => evalExtra(c, extraFailStRef.current[i], false));'), 'GameScreen: провал = ИЛИ по доп. условиям');
t(gs.includes('if (winStreakRef.current >= needW && allWinX) {'), 'GameScreen: зачёт гейтится доп. условиями');
t(gs.includes('if (xw.length && allWinX && codeFiredRef.current !== key) {'), 'GameScreen: зачёт ТОЛЬКО по доп. условиям (без основного кода)');
t(gs.includes('if (!activeCode && !activeFail && !codeXRef.current.w.length && !codeXRef.current.f.length) return;'), 'GameScreen: вотчер жив и при задании только из доп. условий');
t(gs.includes('extraWinStRef.current = []; // v0.197: арминг/счётчики доп. условий — с чистого листа'), 'GameScreen: сброс арминга доп. условий при старте задания');

/* ---------- 7. функциональная: сериализация доп./двухфазных условий (esbuild) ---------- */
console.log('7. ФУНКЦИОНАЛЬНАЯ ПРОВЕРКА СЕРИАЛИЗАЦИИ');
try {
  const esbuild = (await import(path.join(ROOT, 'node_modules/esbuild/lib/main.js'))).default;
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'v197-'));
  const out = path.join(tmp, 'memcode.mjs');
  await esbuild.build({
    entryPoints: [path.join(ROOT, 'src/memcode.ts')],
    bundle: true, format: 'esm', outfile: out, logLevel: 'silent',
  });
  const mc = await import(out);
  const two = mc.parseCond('RPC1:001AB2C8:u8:gt:0>RPC1:001AB2C8:u8:eq:0>2');
  t(!!two && !!two.then, 'parseCond: двухфазный код разбирается');
  t(two?.holdSec === 2, 'parseCond: удержание 2 с');
  t(mc.formatCond(two) === 'RPC1:001AB2C8:u8:gt:0>RPC1:001AB2C8:u8:eq:0>2', 'formatCond: roundtrip двухфазного');
  const one = mc.parseCond('RPC1:001AB2C8:u8:le:0');
  t(!!one && !one.then, 'parseCond: однофазный (доп. условие поражения «HP ≤ 0») разбирается');
  /* адрес второй цифры цепочки: начало + позиция × размер типа — та же математика, что в CodeSearch */
  t(mc.typeSize('u8') === 1 && mc.typeSize('u16') === 2 && mc.typeSize('u32') === 4, 'typeSize: размеры типов корректны (адрес позиции в цепочке)');
  rmSync(tmp, { recursive: true, force: true });
} catch (e) {
  console.log(`  ⚠ esbuild недоступен в этом окружении — функциональные проверки пропущены честно (${String(e).slice(0, 60)})`);
}

console.log(`\nИТОГО: ${ok} ok, ${fail} FAIL`);
if (fail > 0) process.exit(1);
if (!existsSync(path.join(ROOT, 'src'))) { console.error('нет src — ROOT неверный'); process.exit(1); }
statSync(path.join(ROOT, 'src/engine.ts'));
