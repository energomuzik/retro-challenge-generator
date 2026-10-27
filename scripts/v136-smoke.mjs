/* Смоук v0.136: ПЕРЕЗАПУСК ЗАДАНИЯ (qRestart) в двух режимах —
   (1) FRENDY: перезапуск = ПОРАЖЕНИЕ (−HP по цене задания, провал в счёт, задание ОСТАЁТСЯ);
   (2) БОГАЧ (Спринтер): перезапуск по-прежнему стоит 1 бронзу (регресс).
   Запуск: node scripts/v136-smoke.mjs (esbuild бандлит engine.ts, import.meta.glob — заглушка). */
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TMP = path.join(ROOT, 'scripts', 'v136-tmp');
fs.mkdirSync(TMP, { recursive: true });

const STUB = `export const EPI_SCRIPT = Array.from({ length: 13 }, (_, i) => ({ who: i % 2 ? 'alder' : 'skaller', text: 'r' + i, src: '' }));`;

await build({
  stdin: {
    contents: `
import { newSession, applyAction } from '${ROOT}/src/engine';
import type { GameMap } from '${ROOT}/src/types';

const cell = (x: number, y: number, type: any = 'plain') => ({ x, y, w: 1, h: 1, cx: x * 64 + 32, cy: y * 64 + 32, type, n: 0 });
const mk = (mode: any) => ({
  id: 'm1', name: 'smoke', mode, cols: 6, rows: 3,
  cells: [cell(0, 1, 'start'), cell(1, 1, 'task'), cell(2, 1, 'task'), cell(4, 1, mode === 'frendy' ? 'furnace' : 'plain')],
  npcs: [], bosses: [], portals: [], walls: [], endings: [], npcLib: [], bonusCards: [], trapCards: [],
} as unknown as GameMap);

let ok = true;
const chk = (label: string, cond: boolean) => { ok = ok && cond; console.log(cond ? 'OK ' : 'FAIL', label); };

/* ---------- (1) FRENDY: qRestart = поражение ---------- */
{
  const map = mk('frendy');
  let s = newSession('room1', 'm1', 'host1', 'Хост');
  const act = (a: any) => { s = applyAction(s, a, map, { name: 'o' } as any); };
  act({ t: 'start' } as any);
  if (s.phase === 'rollOff') act({ t: 'rollOffReady', id: 'host1' } as any);
  s.phase = 'playing';
  // личное задание в руках игрока (как после поимки Френди или входа в ячейку)
  s.qJobs = { host1: { cellIdx: 1, startedAt: Date.now() } } as any;
  s.players[0].hp = 100;
  act({ t: 'qRestart', id: 'host1', cellIdx: 1 } as any);
  chk('FRENDY qRestart: −5 HP (100→95)', s.players[0].hp === 95);
  chk('FRENDY qRestart: провал в счёт (qFails=1)', (s.qFails?.host1 ?? 0) === 1);
  chk('FRENDY qRestart: ЗАДАНИЕ ОСТАЛОСЬ (не закрылось)', !!s.qJobs?.host1 && s.qJobs.host1.cellIdx === 1);
  // перезапускать можно ещё (HP добивается до 0 — выбытие)
  s.players[0].hp = 5;
  act({ t: 'qRestart', id: 'host1', cellIdx: 1 } as any);
  chk('FRENDY qRestart: HP в ноль → 0', s.players[0].hp === 0);
  // чужой cellIdx не проходит
  const hpBefore = s.players[0].hp;
  act({ t: 'qRestart', id: 'host1', cellIdx: 2 } as any);
  chk('FRENDY qRestart: чужая ячейка игнор', s.players[0].hp === hpBefore);
}

/* ---------- (2) БОГАЧ: qRestart = 1 бронза (регресс) ---------- */
{
  const map = mk('bogach');
  let s = newSession('room2', 'm1', 'host1', 'Хост');
  const act = (a: any) => { s = applyAction(s, a, map, { name: 'o' } as any); };
  act({ t: 'start' } as any);
  if (s.phase === 'rollOff') act({ t: 'rollOffReady', id: 'host1' } as any);
  s.phase = 'playing';
  s.qJobs = { host1: { cellIdx: 1, startedAt: Date.now() } } as any;
  s.players[0].coinsLeft = 10;
  act({ t: 'qRestart', id: 'host1', cellIdx: 1 } as any);
  chk('БОГАЧ qRestart: −1 бронза (10→9)', s.players[0].coinsLeft === 9);
  chk('БОГАЧ qRestart: трата в зачёт (qSpent=1)', (s.qSpent?.host1 ?? 0) === 1);
  chk('БОГАЧ qRestart: задание осталось', !!s.qJobs?.host1);
}

console.log(ok ? 'SMOKE OK' : 'SMOKE FAIL');
if (!ok) process.exit(1);
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
      b.onLoad({ filter: /src\/frendyVoice\.ts$/ }, () => ({ contents: 'export const frendyPhraseVoice = () => null; export const frendyCineVoice = () => null; export const frendyVoiceCount = 0; export const frendyVol = () => 1; export const makeFrendyAudio = () => null;', loader: 'ts' }));
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
