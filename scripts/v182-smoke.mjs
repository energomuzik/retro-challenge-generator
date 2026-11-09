#!/usr/bin/env node
/* v0.182 смоук: голос «Кинаман» записал весь курс.
   Запуск: node scripts/v182-smoke.mjs  (из корня репо) */
import fs from 'node:fs';
import path from 'node:path';

let fails = 0;
const ok = (cond, msg) => { console.log((cond ? '  OK  ' : '  FAIL') + ' ' + msg); if (!cond) fails++; };
const KIN = 'src/assets/training/voice-kin';
const DM = 'src/assets/training/voice';

const NEW18 = ['frendy-0','frendy-1','frendy-2','frendy-3','frendy-4','intro-1','intro-2','mk-skill-0','play-0','play-10','play-11','play-8','play-9','quizovo-0','quizovo-1','quizovo-2','skill-0','skill-2'];

// 1) все 18 новых файлов Кинамана на месте и не пустые
for (const b of NEW18) {
  const p = path.join(KIN, b + '.mp3');
  ok(fs.existsSync(p) && fs.statSync(p).size > 10000, `voice-kin/${b}.mp3 на месте (${fs.existsSync(p) ? fs.statSync(p).size : 0} Б)`);
}
// 2) old extra-10 Кинамана удалён, у Дмитрия — есть
ok(!fs.existsSync(path.join(KIN, 'extra-10.mp3')), 'voice-kin/extra-10.mp3 удалён (старые слова)');
ok(fs.existsSync(path.join(DM, 'extra-10.mp3')), 'voice/extra-10.mp3 (Дмитрий) перегенерирован');

// 3) множества: kin + extra-10 == dm (114 слайдов, у Кинамана 113)
const dmSet = new Set(fs.readdirSync(DM).filter(f => f.endsWith('.mp3')));
const kinSet = new Set(fs.readdirSync(KIN).filter(f => f.endsWith('.mp3')));
ok(kinSet.size === 113, `voice-kin: ${kinSet.size} файлов (ожидалось 113)`);
ok(dmSet.size === 114, `voice (Дмитрий): ${dmSet.size} файлов (ожидалось 114)`);
let diff = 0;
dmSet.forEach(f => { if (f !== 'extra-10.mp3' && !kinSet.has(f)) diff++; });
kinSet.forEach(f => { if (!dmSet.has(f)) diff++; });
ok(diff === 0, 'наборы совпадают: kin+extra-10 == dm, лишних имён нет');

// 4) trainingData: новый текст extra-10, старых фраз нет
const td = fs.readFileSync('src/trainingData.ts', 'utf8');
ok(td.includes('«Кинаман» — все слайды'), 'trainingData: «Кинаман» — все слайды»');
ok(!td.includes('на нескольких слайдах'), 'trainingData: фраза «на нескольких слайдах» удалена');
ok(!td.includes('около 32 МБ'), 'trainingData: вес ~32 МБ заменён');
ok(td.includes('около 40 МБ'), 'trainingData: вес ~40 МБ указан');

// 5) версия
ok(fs.readFileSync('src/types.ts', 'utf8').includes('export const APP_VERSION = 176;'), 'APP_VERSION = 176');
ok(fs.readFileSync('src/version.ts', 'utf8').includes('v0.182.0'), 'version.ts: строка 0.182.0');

// 6) mp3-магия у всех новых файлов (ID3/0xFFF3)
for (const b of NEW18) {
  const buf = fs.readFileSync(path.join(KIN, b + '.mp3'));
  const isMp3 = (buf[0] === 0x49 && buf[1] === 0x44 && buf[2] === 0x33) || (buf[0] === 0xFF && (buf[1] & 0xE0) === 0xE0);
  ok(isMp3, `${b}.mp3 — валидная mp3-сигнатура`);
}

console.log(fails === 0 ? '\nSMOKE OK — все проверки пройдены' : `\nSMOKE FAILED: ${fails}`);
process.exit(fails === 0 ? 0 : 1);
