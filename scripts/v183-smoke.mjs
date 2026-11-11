#!/usr/bin/env node
/* v0.183 смоук: автоматика джоемыши + 3 галочки в опциях + «Импортировать все»
   в базе сейвов + «Забрать»→«Импорт» (+ переснятые кадры play-10/play-11).
   Запуск: node scripts/v183-smoke.mjs  (из корня репо) */
import fs from 'node:fs';

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  OK  ' : '  FAIL') + ' ' + msg); if (!cond) fails++; };

// ---------- 1) padMouse.ts: автоматика с ручным оверрайдом ----------
const pm = fs.readFileSync('src/padMouse.ts', 'utf8');
ok(pm.includes('export function padMouseAutoHide'), 'padMouse: padMouseAutoHide есть');
ok(pm.includes('export function padMouseAutoRestore'), 'padMouse: padMouseAutoRestore есть');
ok(pm.includes('export function padMouseAutoShow'), 'padMouse: padMouseAutoShow есть');
ok(pm.includes('autoOffByUs'), 'padMouse: флаг ручного оверрайда autoOffByUs');
ok(pm.includes('padSeen'), 'padMouse: фронт обнаружения джоя (padSeen)');
ok(/padMouseAutoHide[\s\S]*?padMouseEnabled === false[\s\S]*?padMouseAutoTask === false/.test(pm), 'padMouse: автопрячка уважает галочки (рубильник + автоматика задания)');
ok(/if \(!userOff\) \{ padMouseSetOff\(true\); autoOffByUs = true; \}/.test(pm), 'padMouse: не выключает, если игрок выключил сам (userOff)');
ok(/if \(autoOffByUs\) \{[\s\S]*?padMouseSetOff\(false\)/.test(pm), 'padMouse: возвращает мышь только если выключили МЫ');
ok(/if \(prefs\.padMouseEnabled === false\) \{ setTrigFlag\(false\); hide\(\); return; \}/.test(pm), 'padMouse: рубильник ВЫКЛ — курсора нет вообще');
ok(/padHere !== padSeen/.test(pm) && /padMouseAutoOn/.test(pm), 'padMouse: при появлении джоя мышь включается по галочке padMouseAutoOn');

// ---------- 2) input.ts: три галочки EmuPrefs, дефолт ВКЛ ----------
const inp = fs.readFileSync('src/input.ts', 'utf8');
ok(inp.includes('padMouseEnabled?: boolean;') && inp.includes('padMouseAutoOn?: boolean;') && inp.includes('padMouseAutoTask?: boolean;'), 'input: три новых поля EmuPrefs');
ok(inp.includes('padMouseEnabled: true,') && inp.includes('padMouseAutoOn: true,') && inp.includes('padMouseAutoTask: true,'), 'input: дефолт всех трёх — ВКЛ');
ok(inp.includes('p.padMouseEnabled !== false') && inp.includes('p.padMouseAutoOn !== false') && inp.includes('p.padMouseAutoTask !== false'), 'input: нормализация старых prefs (отсутствует = ВКЛ)');

// ---------- 3) GameScreen.tsx: окна заданий дергают автоматику ----------
const gs = fs.readFileSync('src/screens/GameScreen.tsx', 'utf8');
ok(gs.includes('chRunMouse') && gs.includes('qRunMouse') && gs.includes('jRunMouse'), 'GameScreen: три окна заданий (совместное/квест/VERSUS-RUBG) заводят автоматику');
ok(gs.includes('if (chRunMouse) padMouseAutoHide(); else padMouseAutoRestore();'), 'GameScreen: окно совместного задания — прячет/возвращает мышь');
ok(gs.includes('useEffect(() => () => padMouseAutoRestore(), []);'), 'GameScreen: размонтирование — мышь возвращается');
ok(gs.includes('if (taskWinPrevRef.current && !open) padMouseAutoRestore();'), 'GameScreen: закрытие окна задания — мышь возвращается');

// ---------- 4) EmulatorLauncher.tsx: редактор сохранений ----------
const el = fs.readFileSync('src/screens/EmulatorLauncher.tsx', 'utf8');
ok(el.includes('if (running) padMouseAutoHide();'), 'EmulatorLauncher: игра пошла — мышь выключается');
ok(el.includes('else padMouseAutoRestore();'), 'EmulatorLauncher: игра закрыта — мышь возвращается');
ok(el.includes('useEffect(() => { padMouseAutoShow(); return () => padMouseAutoRestore(); }, []);'), 'EmulatorLauncher: вход в редактор — мышь включается, выход — восстанавливается');

// ---------- 5) KeyBinder.tsx: блок «Мышь с джойстика» с тремя галочками ----------
const kb = fs.readFileSync('src/KeyBinder.tsx', 'utf8');
ok(kb.includes('МЫШЬ С ДЖОЙСТИКА'), 'KeyBinder: блок «МЫШЬ С ДЖОЙСТИКА» есть');
ok(kb.includes('padMouseEnabled') && kb.includes('padMouseAutoOn') && kb.includes('padMouseAutoTask'), 'KeyBinder: все три галочки подключены к prefs');

// ---------- 6) CloudSavesBlock.tsx: «Импортировать все» + «Импорт» ----------
const cs = fs.readFileSync('src/CloudSavesBlock.tsx', 'utf8');
ok(cs.includes('busyAll'), 'CloudSavesBlock: busyAll (счётчик массового импорта)');
ok(cs.includes('⬇ Импортировать все'), 'CloudSavesBlock: кнопка «⬇ Импортировать все»');
ok(cs.includes('⏳ Импортирую… осталось'), 'CloudSavesBlock: счётчик «осталось N» на кнопке');
ok(cs.includes("'⬇ Импорт'"), 'CloudSavesBlock: одиночная кнопка «⬇ Импорт»');
ok(cs.includes('импортировано в библиотеку'), 'CloudSavesBlock: тост одиночного импорта');
ok(cs.includes('Импортировано:'), 'CloudSavesBlock: тост массового импорта со счётом');
ok(!cs.includes('Забрать'), 'CloudSavesBlock: слова «Забрать» больше нет');

// ---------- 7) saveCloud.ts + TaskEditor.tsx: «Забрать» → «Импорт» ----------
const sc = fs.readFileSync('src/saveCloud.ts', 'utf8');
ok(!sc.includes('«⬇ Забрать»') && sc.includes('«⬇\n   Импорт»') || sc.includes('⬇\n   Импорт') || !sc.includes('Забрать'), 'saveCloud: «Забрать» заменено на «Импорт»');
ok(sc.includes('importCloudCard'), 'saveCloud: importCloudCard на месте');
const te = fs.readFileSync('src/screens/TaskEditor.tsx', 'utf8');
ok(!te.includes('⬇ Забрать') && !te.includes('можно забрать'), 'TaskEditor: кнопка «Забрать» переименована');
ok(te.includes('Импорт') || te.includes('импорт'), 'TaskEditor: упоминается «Импорт»');

// ---------- 8) обучение: слайды play-10/play-11 под новые слова ----------
const td = fs.readFileSync('src/trainingData.ts', 'utf8');
ok(td.includes('«⬇ Импорт» скачивает выбранное сохранение'), 'trainingData: слайд play-11 описывает «Импорт»');
ok(td.includes('«⬇ Импортировать все» тащит разом весь список'), 'trainingData: слайд play-11 описывает «Импортировать все»');
ok(!td.includes('Кнопка «Забрать»') && !td.includes('кнопка «Забрать»'), 'trainingData: старого описания «Забрать» нет');
ok(td.includes('v183.txt'), 'trainingData: пометка про текст для перезаписи play-11.mp3 (v183.txt)');

// ---------- 9) кадры пересняты (webp 1280x720, свежие) ----------
for (const f of ['play-10-00', 'play-10-01', 'play-10-02', 'play-11-00', 'play-11-01', 'play-11-02']) {
  const p = `src/assets/training/${f}.webp`;
  ok(fs.existsSync(p) && fs.statSync(p).size > 30000, `${f}.webp на месте (${fs.existsSync(p) ? fs.statSync(p).size : 0} Б)`);
}

// ---------- 10) версия ----------
ok(fs.readFileSync('src/types.ts', 'utf8').includes('export const APP_VERSION = 177;'), 'APP_VERSION = 177');
const vt = fs.readFileSync('src/version.ts', 'utf8');
ok(vt.includes('v0.183.0'), 'version.ts: строка v0.183.0');
ok(vt.includes('0.182.0 (история)'), 'version.ts: история 0.182 сохранена');
ok(vt.includes('0.181.0 (история)'), 'version.ts: история 0.181 сохранена');

// ---------- 11) ОЗВУЧКА: play-11.mp3 Кинамана пока со старыми словами (перезапись — за заказчиком) ----------
ok(fs.existsSync('src/assets/training/voice-kin/play-11.mp3'), 'voice-kin/play-11.mp3 существует (пока старые слова — текст в v183.txt)');

console.log(fails === 0 ? '\nSMOKE OK — все проверки пройдены' : `\nSMOKE FAILED: ${fails}`);
process.exit(fails === 0 ? 0 : 1);
