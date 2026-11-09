// v0.181 smoke: озвучка (Дмитрий восстановлен, Кинаман без «раздаю карты»),
// новые слайды play-10/play-11 про облачную базу, версии, чистота текстов, ZIP-механика.
import { buildSync } from '/home/z/my-project/rcg/node_modules/esbuild/lib/main.js';
import { readdirSync, readFileSync, existsSync, statSync } from 'fs';
import path from 'path';

const ROOT = '/home/z/my-project/rcg';
let ok = 0, fail = 0;
const t = (cond, name) => { if (cond) { ok++; console.log(`  ✓ ${name}`); } else { fail++; console.error(`  ✗ FAIL: ${name}`); } };

/* ---------- 1. версии ---------- */
console.log('1. ВЕРСИИ');
const typesSrc = readFileSync(path.join(ROOT, 'src/types.ts'), 'utf8');
const versionSrc = readFileSync(path.join(ROOT, 'src/version.ts'), 'utf8');
t(/export const APP_VERSION = 175;/.test(typesSrc), 'APP_VERSION = 175');
t(versionSrc.includes('0.${APP_VERSION + 6}.0'), 'VERSION = APP_VERSION + 6 (0.181.0)');
t(typesSrc.includes('// 175: 0.181.0 ОЗВУЧКА'), 'история 0.181.0 в types.ts');
t(versionSrc.includes('v0.181.0'), 'комментарий v0.181.0 в version.ts');

/* ---------- 2. TRAINING: структура и новые слайды ---------- */
console.log('2. TRAINING: новые слайды play-10/play-11');
const out = buildSync({ entryPoints: [path.join(ROOT, 'src/trainingData.ts')], bundle: true, write: false, format: 'esm', platform: 'neutral', external: ['*.webp', '*.mp3', '*.png', '*.jpg'] });
const mod = await import('data:text/javascript;base64,' + Buffer.from(out.outputFiles[0].contents).toString('base64'));
const TRAINING = mod.TRAINING;
const play = TRAINING.find(s => s.id === 'play');
t(!!play, 'раздел play есть');
t(play.slides.length === 12, `в play 12 слайдов (было 10, +2) — факт: ${play.slides.length}`);
t(play.slides[10].t === 'База сохранений: свой ZIP', 'play[10] «База сохранений: свой ZIP»');
t(play.slides[11].t === 'Чужие сохранения из базы', 'play[11] «Чужие сохранения из базы»');
t(JSON.stringify(play.slides[10].frames) === JSON.stringify(['play-10-00', 'play-10-01', 'play-10-02']), 'play[10] 3 кадра');
t(JSON.stringify(play.slides[11].frames) === JSON.stringify(['play-11-00', 'play-11-01', 'play-11-02']), 'play[11] 3 кадра');
t(/ник игрока внутрь не пишется вовсе/.test(play.slides[10].x), 'play[10] говорит «ник внутрь не пишется»');
t(/свои сохранения не перезаписываются/.test(play.slides[11].x), 'play[11] говорит «свои не перезаписываются»');
// индексы прежних слайдов не сдвинулись
t(play.slides[8].t === 'Загрузить игру: карточка сейва' && play.slides[9].t === 'Что сохраняется в сейве', 'play[8]/play[9] на местах (mp3 play-8/play-9 валидны)');
t(play.slides[0].t === 'Файл карты' && play.slides[1].t === 'Открываем комнату', 'play[0]/play[1] на местах');
let slideCount = 0; TRAINING.forEach(s => { slideCount += s.slides.length; });
t(slideCount === 114, `всего слайдов 114 (было 112) — факт: ${slideCount}`);

/* ---------- 3. все кадры существуют ---------- */
console.log('3. КАДРЫ: все файлы существуют');
let framesMissing = 0, framesChecked = 0;
for (const sec of TRAINING) for (const s of sec.slides) for (const f of s.frames) {
  framesChecked++;
  if (!existsSync(path.join(ROOT, 'src/assets/training', f + '.webp'))) { framesMissing++; console.error(`   нет кадра: ${f}.webp (слайд «${s.t}»)`); }
}
t(framesMissing === 0, `все ${framesChecked} кадров-файлов существуют (не хватает: ${framesMissing})`);
const newFrames = ['play-10-00', 'play-10-01', 'play-10-02', 'play-11-00', 'play-11-01', 'play-11-02'];
for (const f of newFrames) {
  const p = path.join(ROOT, 'src/assets/training', f + '.webp');
  const buf = existsSync(p) ? readFileSync(p) : null;
  t(!!buf && buf.length > 20000 && buf.slice(0, 4).toString() === 'RIFF' && buf.slice(8, 12).toString() === 'WEBP', `${f}.webp — валидный WEBP (${buf ? buf.length : 0} байт)`);
}

/* ---------- 4. озвучка: Дмитрий восстановлен ---------- */
console.log('4. ОЗВУЧКА ДМИТРИЯ: нет слайдов без голоса');
const VOICE = path.join(ROOT, 'src/assets/training/voice');
const KIN = path.join(ROOT, 'src/assets/training/voice-kin');
const dmFiles = new Set(readdirSync(VOICE).filter(f => /\.(mp3|flac)$/i.test(f)));
const kinFiles = new Set(readdirSync(KIN).filter(f => /\.(mp3|flac)$/i.test(f)));
let noVoice = [];
TRAINING.forEach(sec => sec.slides.forEach((s, i) => {
  const base = `${sec.id}-${i}`;
  if (![...dmFiles].some(f => f.startsWith(base + '.'))) noVoice.push(base);
}));
t(noVoice.length === 0, `у всех ${slideCount} слайдов есть mp3 Дмитрия (без голоса: ${noVoice.join(', ') || 'нет'})`);
for (const f of ['intro-1.mp3', 'play-0.mp3', 'intro-2.mp3', 'skill-0.mp3', 'skill-2.mp3', 'mk-skill-0.mp3', 'play-10.mp3', 'play-11.mp3']) {
  const buf = readFileSync(path.join(VOICE, f));
  const sig = buf.slice(0, 3).toString() === 'ID3' || (buf[0] === 0xff && (buf[1] & 0xe0) === 0xe0);
  t(buf.length > 30000 && sig, `voice/${f} — валидный mp3 (${(buf.length / 1024).toFixed(0)} КБ)`);
}
t(dmFiles.size === 114, `в voice/ 114 mp3 (112 было − 2 удалено + 2 регенерировано + 2 новых) — факт: ${dmFiles.size}`);
t(existsSync(path.join(VOICE, 'intro-0.mp3')), 'voice/intro-0.mp3 НЕ тронут (его narr в v0.180 не менялся)');

/* ---------- 5. озвучка: Кинаман без «раздаю карты» ---------- */
console.log('5. ОЗВУЧКА КИНАМАНА: старые mp3 удалены');
for (const f of ['intro-1.mp3', 'intro-2.mp3', 'play-0.mp3', 'skill-0.mp3', 'skill-2.mp3', 'mk-skill-0.mp3']) {
  t(!existsSync(path.join(KIN, f)), `voice-kin/${f} удалён`);
}
t(kinFiles.size === 96, `в voice-kin/ 96 mp3 (102 было − 6) — факт: ${kinFiles.size}`);
t(existsSync(path.join(KIN, 'intro-0.mp3')) && existsSync(path.join(KIN, 'skill-1.mp3')) && existsSync(path.join(KIN, 'skill-3.mp3')), 'voice-kin: intro-0/skill-1/skill-3 на месте (не под подозрением)');

/* ---------- 6. чистота текстов обучения ---------- */
console.log('6. ТЕКСТЫ: ни слова про «раздаю карты»');
const BAD = [
  'от автора проекта', 'раздаётся самим автором', 'раздаётся автором', 'раздаётся автором проекта',
  'распространяет автор проекта', 'карты с вшитыми ромами', 'готовые карты автора', 'готовая карта от автора',
  'ссылка в описании авторского канала', 'вы получаете от автора',
];
let badHits = [];
const texts = [];
for (const sec of TRAINING) for (const s of sec.slides) { texts.push(s.x || ''); if (s.narr) texts.push(s.narr); texts.push(sec.desc || ''); texts.push(sec.title || ''); }
for (const txt of texts) for (const b of BAD) if (txt.toLowerCase().includes(b.toLowerCase())) badHits.push(b);
t(badHits.length === 0, `запрещённых фраз в текстах нет (нашли: ${[...new Set(badHits)].join('; ') || '—'})`);
// Яндекс упоминается только в музыкальном контексте (Dj Berto), не про ромы (\b — «Громкость» не считается)
const yaHits = texts.filter(x => /яндекс/i.test(x) && /\bром/i.test(x));
t(yaHits.length === 0, `«Яндекс» рядом с «ром» не встречается (нашли: ${yaHits.length})`);

/* ---------- 7. база без ника (регресс v0.180 жив) ---------- */
console.log('7. БАЗА: card.json без author (регресс v0.180)');
const saveCloudSrc = readFileSync(path.join(ROOT, 'src/saveCloud.ts'), 'utf8');
const stripComments = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
t(!/author/.test(stripComments(saveCloudSrc)), 'saveCloud.ts: в КОДЕ нет author (только в комментариях истории)');
t(/const zipName = `\$\{sanitizeRepoSeg\(rom\.name \|\| gameSeg\) \|\| 'ром'\}\.zip`/.test(saveCloudSrc), 'ZIP называется именем рома (без ника)');
// функционально: makeZip + crc32 (как в v178)
const zipOut = buildSync({ entryPoints: [path.join(ROOT, 'src/zipStore.ts')], bundle: true, write: false, format: 'esm', platform: 'neutral' });
const zipMod = await import('data:text/javascript;base64,' + Buffer.from(zipOut.outputFiles[0].contents).toString('base64'));
const crc = zipMod.crc32 ? zipMod.crc32(new TextEncoder().encode('123456789')) : 0;
t(crc === 0xCBF43926, `crc32('123456789') = 0x${crc.toString(16).toUpperCase()} (эталон CBF43926)`);
const card = { format: 2, game: 'Test (U).nes', name: 'Босс 1', kind: 'boss', slot: 1, createdAt: 1, exportedAt: 2, app: '0.181.0', file: 'save.state' };
const zipBuf = zipMod.makeZip([{ path: 'saves/Test (U).nes/Босс 1/card.json', data: new TextEncoder().encode(JSON.stringify(card, null, 2)) }]);
t(zipBuf && zipBuf.length > 100 && zipBuf[0] === 0x50 && zipBuf[1] === 0x4b, 'makeZip собирает ZIP (сигнатура PK)');
const zipText = new TextDecoder().decode(zipBuf);
t(zipText.includes('"game": "Test (U).nes"') || zipText.includes('"game":"Test (U).nes"'), 'card.json внутри ZIP читается');
t(!zipText.includes('author'), 'в card.json внутри ZIP нет author');

/* ---------- 8. откат импорта SRAM (регресс v0.180 жив) ---------- */
console.log('8. РЕГРЕСС: импорта .srm/.sav нет');
const emuSrc = readFileSync(path.join(ROOT, 'src/screens/EmulatorLauncher.tsx'), 'utf8');
const segaSrc = readFileSync(path.join(ROOT, 'src/SegaBox.tsx'), 'utf8');
t(!emuSrc.includes('Загрузка .srm/.sav') && !emuSrc.includes('doImportSram'), 'кнопки импорта SRAM нет в EmulatorLauncher');
t(!/importSram/.test(stripComments(segaSrc)), 'SegaBox: в КОДЕ нет importSram (только в комментариях истории)');
t(!readFileSync(path.join(ROOT, 'src/zipStore.ts'), 'utf8').includes('extractSaveFromZip'), 'zipStore без extractSaveFromZip');
t(emuSrc.includes('📦 Сохранить все для базы (ZIP)'), 'кнопка «📦 Сохранить все для базы (ZIP)» на месте');

/* ---------- 9. типы/сборка ---------- */
console.log('9. СБОРКА');
const { execFileSync } = await import('child_process');
try { execFileSync('npx', ['tsc', '--noEmit'], { cwd: ROOT, timeout: 240000 }); t(true, 'tsc --noEmit без ошибок'); } catch (e) { t(false, 'tsc --noEmit: ' + String(e.message).slice(0, 80)); }

console.log(`\nSMOKE ${fail === 0 ? 'OK' : 'FAILED'}: ✓${ok} ✗${fail}`);
process.exit(fail === 0 ? 0 : 1);
