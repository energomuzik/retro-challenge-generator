/* Смоук v0.132: эпилог агентов на настоящем движке (applyAction).
   Запуск: node scripts/v132-smoke.mjs (esbuild бандлит engine.ts с заглушкой agentsAssets). */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const ROOT = '/home/z/my-project/rcg-work';
const TMP = '/home/z/my-project/rcg-work/scripts/v132-tmp';
fs.mkdirSync(TMP, { recursive: true });

/* Заглушка agentsAssets (в движке нужен только EPI_SCRIPT) */
const STUB = `export const EPI_SCRIPT = Array.from({ length: 9 }, (_, i) => ({ who: i % 2 ? 'alder' : 'skaller', text: 'r' + i, src: '' }));`;

await build({
  stdin: {
    contents: `
import { newSession, applyAction } from '${ROOT}/src/engine';
import type { GameMap } from '${ROOT}/src/types';

/* --- минимальная карта FRENDY: 4 ячейки в линию, печь №4, стены нет --- */
const cell = (x: number, y: number, type: any = 'plain') => ({ x, y, w: 1, h: 1, cx: x * 64 + 32, cy: y * 64 + 32, type, n: 0 });
const map: GameMap = {
  id: 'm1', name: 'smoke', mode: 'frendy', cols: 6, rows: 3,
  cells: [cell(0, 1, 'start'), cell(1, 1, 'task'), cell(2, 1, 'task'), cell(4, 1, 'furnace')],
  npcs: [], bosses: [], portals: [], walls: [], endings: [], npcLib: [], bonusCards: [], trapCards: [],
} as unknown as GameMap;

const s0 = newSession('room1', 'm1', 'host1', 'Хост');
let s = s0;
const act = (a: any) => { s = applyAction(s, a, map, { name: 'o' } as any); };

/* старт партии: старт-экшен (какой он? — пробуем startGame; если нет, лобби-флоу пропускаем) */
act({ t: 'start' } as any);
console.log('phase после startGame:', s.phase);

/* Жеребьёвка может понадобиться — пробрасываем rollOff, если он активен */
if (s.phase === 'rollOff') {
  act({ t: 'rollOffReady', id: 'host1' } as any);
  console.log('phase после ready:', s.phase);
}

/* принудительно выигрываем: даём хосту все микросхемы и жжём у печи */
s.players[0].items = [{ id: 'c1', kind: 'frendyChip' }, { id: 'c2', kind: 'frendyChip' }] as any;
s.frendy = { ...s.frendy!, total: 2, burned: 0, chips: [], boss: null, nextSpawnAt: Date.now() + 1e9, coffeeUntil: {}, phrase: null, strongUntil: Date.now() + 1e6 } as any;
s.journeyPos = s.journeyPos ?? {};
s.journeyPos['host1'] = { x: 4 * 64 + 32, y: 1 * 64 + 32, mv: false };
act({ t: 'frendyBurn', id: 'host1' } as any);
console.log('после burn#1: burned =', s.frendy!.burned, 'phase =', s.phase);
act({ t: 'frendyBurn', id: 'host1' } as any);
console.log('после burn#2: won =', s.frendy!.won, 'phase =', s.phase, 'winner =', s.winner);

/* ЭПИЛОГ */
act({ t: 'frendyEpilogue', id: 'host1' } as any);
console.log('после epilogue: phase =', s.phase, 'epi.stage =', s.frendy!.epi?.stage, 'фишки убраны:', s.frendy!.chips.length === 0);

/* тики: Альдер должен дойти до печи (128px пути ~ несколько тиков по 0.42*64*0.4 ≈ 10.7px) */
for (let i = 0; i < 60 && s.frendy!.epi!.stage === 'walk'; i++) act({ t: 'epiTick', id: 'host1' } as any);
console.log('после тиков: stage =', s.frendy!.epi!.stage, 'alder =', JSON.stringify(s.frendy!.epi!.alder));

/* ходьба Скаллер (хост) в эпилоге — journeyMove принимается */
act({ t: 'journeyMove', id: 'host1', x: 4 * 64 + 32, y: 2 * 64 + 32, mv: true } as any);
console.log('Скаллер подвинулась:', JSON.stringify(s.journeyPos!['host1']));

/* разговор: 9 реплик */
act({ t: 'epiTalk', id: 'host1' } as any);
console.log('после epiTalk: stage =', s.frendy!.epi!.stage, 'talkIdx =', s.frendy!.epi!.talkIdx);
for (let i = 0; i < 8; i++) act({ t: 'epiTalkNext', id: 'host1' } as any);
console.log('после 8 «Далее»: talkIdx =', s.frendy!.epi!.talkIdx, 'stage =', s.frendy!.epi!.stage);
act({ t: 'epiTalkNext', id: 'host1' } as any);
console.log('ФИНАЛ: stage =', s.frendy!.epi!.stage, 'phase =', s.phase);

/* проверка: не-хост не может двигаться в эпилоге */
const before = JSON.stringify(s.journeyPos!['guest']);
act({ t: 'journeyMove', id: 'guest', x: 10, y: 10, mv: false } as any);
console.log('гость не двигается:', JSON.stringify(s.journeyPos!['guest']) === (before ?? 'undefined') || s.journeyPos!['guest'] === undefined);

/* пропуск разговора */
s.frendy!.epi = { stage: 'talk', alder: { x: 100, y: 100 }, talkIdx: 3, startedAt: 1 } as any;
s.phase = 'epilogue';
act({ t: 'epiTalkNext', id: 'host1', all: true } as any);
console.log('skip: stage =', s.frendy!.epi!.stage, 'phase =', s.phase);
console.log('SMOKE OK');
`,
    resolveDir: TMP,
    loader: 'tsx',
  },
  bundle: true,
  write: false,
  platform: 'node',
  format: 'cjs',
  target: 'node18',
  plugins: [{
    name: 'stub-agents',
    setup(b) {
      b.onResolve({ filter: /agentsAssets$/ }, () => ({ path: 'agentsAssets-stub', namespace: 'stub' }));
      b.onLoad({ filter: /.*/, namespace: 'stub' }, () => ({ contents: STUB, loader: 'ts' }));
      /* render.ts тянет getImage из assets.ts — отдаём настоящие assets.ts и frendyVoice,
         но с заглушкой import.meta.glob (define подменяет его на GLOBAL_GLOB_STUB) */
      b.onLoad({ filter: /src\/frendyVoice\.ts$/ }, () => ({ contents: 'export const frendyPhraseVoice = () => null; export const frendyCineVoice = () => null; export const frendyVoiceCount = 0;', loader: 'ts' }));
    },
  }],
  banner: { js: 'var GLOBAL_GLOB_STUB = function () { return {}; };' }, // v0.136: render.ts тянет frendyAssets (import.meta.glob) в бандл — глобальная заглушка обязана существовать
  define: { 'import.meta.glob': 'GLOBAL_GLOB_STUB' },
}).then(async (r) => {
  const out = path.join(TMP, 'engine.cjs');
  fs.writeFileSync(out, r.outputFiles[0].text);
  const res = execSync(`node ${out}`, { encoding: 'utf8', timeout: 60000 });
  console.log(res);
}).catch((e) => { console.error('SMOKE FAIL:', e.message); process.exit(1); });
