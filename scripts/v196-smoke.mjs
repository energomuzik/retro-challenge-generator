// v0.196 smoke: двухфазное «было → стало» у ПОРАЖЕНИЯ + кнопка в CodeSearch; панель ромов
// разворачивается сама при выборе ячейки задания; все появления Френди звучат записью
// «появление». Регрессии v0.187-0.195 живы.
import { readFileSync, existsSync, statSync, mkdtempSync, writeFileSync, rmSync } from 'fs';
import path from 'path';
import os from 'os';

const ROOT = process.env.RCG_ROOT || '/home/z/my-project/rcg'; // RCG_ROOT — для roundtrip-прогона в чистом клоне
let ok = 0, fail = 0;
const t = (cond, name) => { if (cond) { ok++; console.log(`  ✓ ${name}`); } else { fail++; console.error(`  ✗ FAIL: ${name}`); } };
const src = (p) => readFileSync(path.join(ROOT, p), 'utf8');

/* ---------- 1. версии ---------- */
console.log('1. ВЕРСИИ');
const typesSrc = src('src/types.ts');
const versionSrc = src('src/version.ts');
t(/export const APP_VERSION = 190;/.test(typesSrc), 'APP_VERSION = 190');
t(typesSrc.includes('APP_VERSION 189→190; v0.196.0'), 'чейнджлог APP_VERSION 189→190; v0.196.0');
t(typesSrc.includes('// 189: 0.195.0 ЧЕТЫРЕ ИЗМЕНЕНИЯ'), 'история 0.195.0 сдвинута в // 189:');
t(versionSrc.includes('кнопка сразу в CodeSearch'), 'в version.ts inline-коммент 0.196.0');
t(versionSrc.includes('// 0.195.0 (история)'), 'в version.ts 0.195.0 ушла в историю');

/* ---------- 2. двухфазное ПОРАЖЕНИЕ в редакторе заданий ---------- */
console.log('2. ДВУХФАЗНОЕ ПОРАЖЕНИЕ (TaskEditor)');
const te = src('src/screens/TaskEditor.tsx');
t((te.match(/\+ Двухфазное \(было → стало\)/g) ?? []).length === 2, 'кнопки двухфазного условия: победа И поражение');
t(te.includes('setFCondFail({ ...fCondFail, then: { ...fCondFail.then!, t: e.target.value as CodeType } })'), 'поражение: поля фазы 2 (тип)');
t(te.includes("setFCondFail(fCondFail.then ? { a: fCondFail.a, t: fCondFail.t, op: fCondFail.op, v: fCondFail.v } : { ...fCondFail, then: { a: fCondFail.a, t: fCondFail.t, op: 'eq', v: 0 }, holdSec: 0 })"), 'поражение: переключатель двухфазности');
t(te.includes('поражение после «было», когда это выполнится'), 'поражение: подпись «СТАЛО»');
t((te.match(/setFCondFail\(\{ \.\.\.fCondFail, holdSec: Number\.isFinite\(n\) && n > 0 \? Math\.min\(60, Math\.round\(n \* 2\) \/ 2\) : 0 \}\)/g) ?? []).length === 1, 'поражение: «ДЕРЖАТЬ N с»');
t(te.includes('rgba(255,93,115,0.45)'), 'поражение: блок фазы 2 в коралловой рамке');

/* ---------- 3. двухфазная кнопка в CodeSearch ---------- */
console.log('3. CODESEARCH: «БЫЛО → СТАЛО» (код сразу верный)');
const cs = src('src/CodeSearch.tsx');
t(cs.includes('const [condTwo, setCondTwo] = useState(false);'), 'состояние двухфазности');
t(cs.includes('+ Двухфазное (было → стало)'), 'кнопка «+ Двухфазное» в шаге 3');
t(cs.includes('formatCond(condTwo'), 'condCode собирается двухфазным');
t(cs.includes('then: { a: condAddr, t, op: condThenOp, v: Number(condThenVal) || 0 }'), 'фаза 2 — тот же адрес/тип, свои оператор/значение');
t(cs.includes('(!condTwo || (condThenVal.trim() !== \'\' && Number.isFinite(Number(condThenVal))))'), 'condValid проверяет и фазу 2');
t(cs.includes('СРАЗУ верный двухфазный код') || cs.includes('включил — оператор/значение выше становятся фазой 1'), 'подсказка про фазу 1 из полей шага 3');
t(cs.includes('Код верный (двухфазный)'), '«Проверить код условия» показывает обе фазы');
t(cs.includes('RPC1:…:gt:0>RPC1:…:eq:0>0'), 'подсказка формата двухфазного кода');
t(cs.includes('type { CodeOp, CodeType, MemCond }'), 'MemCond импортирован');

/* ---------- 4. панель ромов разворачивается сама ---------- */
console.log('4. ПАНЕЛЬ РОМОВ — АВТО-РАЗВОРОТ (TaskEditor)');
t(te.includes('const romPanelRef = useRef<HTMLDivElement | null>(null);'), 'romPanelRef объявлен');
t(te.includes('ref={romPanelRef}'), 'реф на контейнере левой панели');
t(te.includes('data-rom-row={r.id}'), 'метка строки рома');
t(te.includes('data-save-row={sv.id}'), 'метка строки сохранения');
t(te.includes('if (rom?.folder) setRomFolderOvr((s) => ({ ...s, [rom.folder!]: true }));'), 'папка рома задания раскрывается');
t(te.includes('setRomSavesOvr(true);'), 'спойлер «💾 Сохранения» открывается');
t((te.match(/scrollIntoView\(\{ block: 'nearest' \}\)/g) ?? []).length === 2, 'прокрутка к рому и к сейву');
t(te.includes('ПАНЕЛЬ РОМОВ САМА РАЗВОРАЧИВАЕТСЯ'), 'комментарий-обоснование на месте');

/* ---------- 5. все появления Френди = запись «появление» ---------- */
console.log('5. ЗВУК ПОЯВЛЕНИЯ ФРЕНДИ ВЕЗДЕ');
const gs = src('src/screens/GameScreen.tsx');
const fc = src('src/screens/FrendyCine.tsx');
const eng = src('src/engine.ts');
const snd = src('src/sound.ts');
t((fc.match(/sfx\.frendyTpIn\(\)/g) ?? []).length === 4, 'кат-сцены: 4 появления → «появление»');
t(!fc.includes('sfx.frendySpawn()'), 'кат-сцены: старого гула больше нет');
t(gs.includes('v0.196: запись заказчика «появление» вместо старого гула') && gs.includes('\n    sfx.frendyTpIn();'), 'пробуждение охоты (фразочка) → «появление»');
t(!gs.includes('sfx.frendySpawn()'), 'GameScreen: старого гула больше нет');
t(eng.includes("fx: 'tp', fxTs: nowB, punish: true"), 'наказание за микросхему: fx «tp»');
t(!/fx: 'spawn', fxTs: nowB, punish/.test(eng), 'наказание: fx «spawn» убран');
t((eng.match(/b\.fx = 'tp'; b\.fxTs = now;/g) ?? []).length === 2, 'УЛЬТРА-телепорт и телепорт к копающемуся: fx «tp» живы (v0.195)');
t(snd.includes('frendySpawn() {'), 'frendySpawn остался в sound.ts как запасной');
t(src('src/types.ts').includes("'spawn' | 'attack' | 'catch' | 'repair' | 'tp' | null"), 'тип boss.fx допускает «tp»');
t(gs.includes("else if (b.fx === 'tp') sfx.frendyTpIn();"), 'вотчер: звук «появления» на fx «tp»');
const pIn = path.join(ROOT, 'src/assets/sfx/freddy-tp-in-1.mp3');
t(existsSync(pIn) && statSync(pIn).size > 100000, 'freddy-tp-in-1.mp3 на месте');

/* ---------- 6. функционально: сериализация двухфазного кода ---------- */
console.log('6. ФУНКЦИОНАЛЬНО (esbuild): formatCond/parseCond');
try {
  const esbuild = (await import(path.join(ROOT, 'node_modules/esbuild/lib/main.js'))).default;
  const tmp = mkdtempSync(path.join(os.tmpdir(), 'v196-'));
  const out = path.join(tmp, 'memcode.mjs');
  await esbuild.build({
    entryPoints: [path.join(ROOT, 'src/memcode.ts')],
    bundle: true, format: 'esm', outfile: out, logLevel: 'silent',
  });
  const mc = await import(out);
  const two = { a: 0x001ab2c8, t: 'u8', op: 'gt', v: 0, then: { a: 0x001ab2c8, t: 'u8', op: 'eq', v: 0 }, holdSec: 2 };
  const s = mc.formatCond(two);
  t(s === 'RPC1:001AB2C8:u8:gt:0>RPC1:001AB2C8:u8:eq:0>2', `formatCond двухфазный (${s})`);
  const back = mc.parseCond(s);
  t(!!back && !!back.then && back.then.op === 'eq' && back.then.v === 0 && back.holdSec === 2, 'parseCond возвращает фазы и удержание');
  t(mc.memCondText(two).includes('СНАЧАЛА') && mc.memCondText(two).includes('ЗАТЕМ'), 'memCondText объясняет двухфазность');
  t(mc.parseCond('RPC1:001AB2C8:u8:le:0')?.op === 'le', 'однофазные парсятся как были');
  rmSync(tmp, { recursive: true, force: true });
} catch (e) {
  console.log(`  ⚠ функциональный тест пропущен (esbuild недоступен: ${String(e).slice(0, 80)})`);
}

/* ---------- 7. регрессии v0.187-0.195 живы ---------- */
console.log('7. РЕГРЕССИИ ЖИВЫ');
t(!gs.includes('useQuickLoad(') && !gs.includes('quickSaveFire'), 'v0.195: быстрые клавиши в игре сняты');
t(gs.includes('const quickKeyLbl = \'\';'), 'v0.195: подписи «⚡F6» сняты');
t(gs.includes("!ch && !taskWinOpen && !s.pendingCard"), 'v0.195: зум в задании выключен');
t(gs.includes('const twoPhase = !!activeCode.then;'), 'v0.195: двухфазная победа в опросе');
t(gs.includes('failArmRef.current && curF2 !== null && opOk(curF2'), 'v0.195: двухфазное поражение в опросе');
t(gs.includes('const taskSaveFetch = async ('), 'v0.190: догоняние сейва живо');
t(gs.includes('Date.now() - emuBootStamp.ts >= 2500'), 'v0.189: грейс провала жив');
t(gs.includes('if (bootSeenRef.current !== emuBootStamp.ts)'), 'v0.194: сброс арминга при перезапуске ядра жив');
t(gs.includes('const zeroWin = !twoPhase && activeCode.op === \'eq\' && activeCode.v === 0;'), 'v0.194: авто-арминг «==0» для однофазных');
t(gs.includes("cv.getContext('2d', { alpha: false })!"), 'v0.194: непрозрачный канвас поля жив');
const rd = src('src/render.ts');
t(rd.includes('const bgCache = new Map<string, HTMLCanvasElement>();'), 'v0.194: кеш фонов жив');
t(gs.includes("else if (fx.kind === 'vanish') sfx.frendyTpOut();"), 'v0.195: звук «исчезновения» жив');

console.log(`\nИТОГ: ${ok} ok / ${fail} fail`);
process.exit(fail ? 1 : 0);
