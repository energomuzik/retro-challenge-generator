/* v0.123 СМОУК-ТЕСТ ДВИЖКА FRENDY (esbuild-бандл engine, node) */
import { build } from 'esbuild';

const outfile = '/home/z/my-project/rcg-work/scripts/.v123-engine-bundle.mjs';
await build({
  entryPoints: ['/home/z/my-project/rcg-work/src/engine.ts'],
  bundle: true,
  format: 'esm',
  platform: 'browser',
  outfile,
  logLevel: 'silent',
});
const { applyAction, newSession } = await import(outfile);

let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; console.log('  ✔', name); } else { fail++; console.log('  ✘ FAIL:', name); } };

const CELL = 64;
const W = 1280, H = 960;
const task = (i) => ({ romId: 'rom1', saveId: 'sv1', title: `Задание ${i}`, desc: 'тест' });
const mkMap = () => ({
  id: 'mapFrendy', name: 'FRENDY TEST', cols: W / CELL, rows: H / CELL, mw: W, mh: H,
  mode: 'frendy', ready: true, createdAt: 1, updatedAt: 1,
  cells: [
    { n: 1, x: 0, y: 0, cx: 640, cy: 840, cw: 128, ch: 96, type: 'start', task: null },
    { n: 2, x: 0, y: 0, cx: 200, cy: 160, cw: 128, ch: 128, type: 'furnace', task: null },
    ...Array.from({ length: 10 }, (_, i) => ({ n: 3 + i, x: 0, y: 0, cx: 120 + (i % 5) * 220, cy: 300 + Math.floor(i / 5) * 220, cw: 128, ch: 96, type: 'task', task: task(i) })),
  ],
  quizzes: [],
});
const opts = { name: 'H', broadcast: false, autoReloadOnViolation: false, showCellNumbers: false, volume: 0.5, streamFps: 30, emuSound: false, emuVolume: 0.5, hideUnrevealed: false, relay: '', relayHub: '', turn: '', delMode: 'instant', hideRoomCode: false, scanlines: false, ntscMode: 0, cutBars: 'classic', spoilerMode: 'remember', followZoom: false, showFps: false };

const map = mkMap();
let s = newSession('TEST', map.id, 'h1', 'ХОСТ');
s = applyAction(s, { t: 'hello', id: 'g1', name: 'ГОСТЬ' }, map, opts);
s = applyAction(s, { t: 'start' }, map, opts);
ok(s.phase === 'rollOff', 'старт: фаза rollOff');
s = applyAction(s, { t: 'rollOffReady', id: 'h1' }, map, opts);
s = applyAction(s, { t: 'rollOffReady', id: 'g1' }, map, opts);
ok(s.phase === 'playing', 'старт: фаза playing');
ok(s.players.length === 2 && s.players.every((p) => !p.spect), 'никто не зритель (FRENDY — все играют)');
const f = s.frendy;
ok(!!f && f.total >= 8 && f.total <= 16, `микросхем 8–16 (${f?.total})`);
ok(f.chips.length === f.total, 'все микросхемы на поле');
const furnace = map.cells[1];
ok(f.chips.every((c) => Math.hypot(c.x - furnace.cx, c.y - furnace.cy) > 80), 'чипы не на печи');
ok(f.chips.every((c) => Math.hypot(c.x - 640, c.y - 840) > 80), 'чипы не на старте');
ok(f.boss === null && f.nextSpawnAt > Date.now(), 'Френди спит 25 с');
ok(s.players.every((p) => p.hp === 100), 'HP 100 у всех');

/* — СОЛО-СТАРТ: один игрок тоже может — */
const mapS = mkMap();
let ss = newSession('SOLO', mapS.id, 'solo', 'ОДИНОЧКА');
ss = applyAction(ss, { t: 'start' }, mapS, opts);
ok(ss.phase === 'rollOff', 'СОЛО: старт с одним игроком разрешён');

/* — ПОДБОР чипа проходом — */
const gPos = { x: f.chips[0].x, y: f.chips[0].y };
s.journeyPos.g1 = { x: gPos.x, y: gPos.y, ts: Date.now(), mv: false };
const before = f.chips.length;
s = applyAction(s, { t: 'frendyTick', id: 'h1' }, map, opts);
ok(s.frendy.chips.length === before - 1, 'чип подобран проходом');
ok((s.players.find((p) => p.id === 'g1').items ?? []).some((x) => x.kind === 'frendyChip'), 'чип в инвентаре');

/* — ПРОБУЖДЕНИЕ (форсим цель: спавн выбирает случайного игрока — проверяем на g1) — */
s.frendy.nextSpawnAt = Date.now() - 10;
s = applyAction(s, { t: 'frendyTick', id: 'h1' }, map, opts);
ok(!!s.frendy.boss, 'Френди проснулся');
ok(s.frendy.boss.targetId !== null, 'цель выбрана');
ok(!!s.frendy.phrase && s.log[0].includes('ФРЕНДИ'), 'фразочка в общем логе');
/* детерминизм: босс охотится на g1 и стоит на нём (спавн «прямо на игроке») */
s.frendy.boss.targetId = 'g1';
s.frendy.boss.x = 640; s.frendy.boss.y = 840;
const bossX0 = s.frendy.boss.x, bossY0 = s.frendy.boss.y;

/* — ПРЕСЛЕДОВАНИЕ (BFS) — */
s.journeyPos.g1 = { x: 1000, y: 500, ts: Date.now(), mv: false };
s = applyAction(s, { t: 'frendyTick', id: 'h1' }, map, opts);
const d0 = Math.hypot(1000 - bossX0, 500 - bossY0);
const d1 = Math.hypot(1000 - s.frendy.boss.x, 500 - s.frendy.boss.y);
ok(d1 < d0, `Френди приблизился (${Math.round(d0)} → ${Math.round(d1)} px)`);
ok(d1 >= d0 - 220, 'шаг не телепорт');

/* — УДАР — */
s.journeyPos.g1 = { x: s.frendy.boss.x + 30, y: s.frendy.boss.y, ts: Date.now(), mv: false };
const hp0 = s.players.find((p) => p.id === 'g1').hp;
s = applyAction(s, { t: 'frendyTick', id: 'h1' }, map, opts);
ok(s.players.find((p) => p.id === 'g1').hp === hp0 - 10, 'удар лапой: −10 HP');
ok(s.frendy.boss.fx === 'attack', 'анимация атаки выставлена');

/* — ПОИМКА (удержание 1100 мс = 3 тика) + КРАЖА ЧИПА — детерминировано: у g1 ровно ОДИН чип, контакт на старте (там чипов не бывает) */
{
  const g1pre = s.players.find((p) => p.id === 'g1');
  g1pre.items = [{ id: 'one', kind: 'frendyChip' }];
  s.frendy.boss.x = 640; s.frendy.boss.y = 840;
}
s.journeyPos.g1 = { x: 640, y: 840, ts: Date.now(), mv: false };
s = applyAction(s, { t: 'frendyTick', id: 'h1' }, map, opts);
s = applyAction(s, { t: 'frendyTick', id: 'h1' }, map, opts);
s = applyAction(s, { t: 'frendyTick', id: 'h1' }, map, opts);
ok(s.frendy.boss === null, 'после поимки Френди исчез');
const g1 = s.players.find((p) => p.id === 'g1');
const jobCell = s.qJobs?.g1?.cellIdx;
ok(jobCell !== undefined && map.cells[jobCell].type === 'task', `телепорт к ячейке задания (№${jobCell !== undefined ? jobCell + 1 : '?'})`);
ok(!s.players.find((p) => p.id === 'g1').items?.some((x) => x.kind === 'frendyChip'), 'чип отобран');
ok(s.frendy.chips.some((c) => !c.kind || c.kind === 'frendyChip'), 'чип перепрятан на поле');

/* — КОФЕ: иммунитет к поимке, но не к ударам — */
s.frendy.nextSpawnAt = Date.now() - 10;
s = applyAction(s, { t: 'frendyTick', id: 'h1' }, map, opts);
ok(!!s.frendy.boss, 'Френди проснулся снова');
/* детерминизм: цель — g1; g1 пере-фетчим — applyAction клонирует сессию */
s.frendy.boss.targetId = 'g1';
const g1c = s.players.find((p) => p.id === 'g1');
g1c.items = [...(g1c.items ?? []), { id: 'cf1', kind: 'coffee' }];
s = applyAction(s, { t: 'frendyUse', id: 'g1', itemId: 'cf1' }, map, opts);
ok((s.frendy.coffeeUntil.g1 ?? 0) > Date.now(), 'кофе: иммунитет активирован');
s.journeyPos.g1 = { x: s.frendy.boss.x, y: s.frendy.boss.y, ts: Date.now(), mv: false };
s = applyAction(s, { t: 'frendyTick', id: 'h1' }, map, opts);
s = applyAction(s, { t: 'frendyTick', id: 'h1' }, map, opts);
s = applyAction(s, { t: 'frendyTick', id: 'h1' }, map, opts);
ok(s.frendy.boss !== null, 'кофе: поимки НЕТ (босс продолжает охоту)');
const hpImmune = s.players.find((p) => p.id === 'g1').hp;
ok(hpImmune < 100, 'кофе: удары всё равно проходят');

/* — ВЫБРОСИТЬ ЧИП — */
const g1d = s.players.find((p) => p.id === 'g1');
g1d.items = [...(g1d.items ?? []), { id: 'ch1', kind: 'frendyChip' }];
const chips0 = s.frendy.chips.length;
s = applyAction(s, { t: 'frendyDrop', id: 'g1', itemId: 'ch1' }, map, opts);
ok(!s.players.find((p) => p.id === 'g1').items?.some((x) => x.id === 'ch1') && s.frendy.chips.length === chips0 + 1, 'чип выброшен на землю');

/* — АПТЕЧКА — */
const g1e = s.players.find((p) => p.id === 'g1');
g1e.items = [...(g1e.items ?? []), { id: 'md1', kind: 'medkit' }];
g1e.hp = 40;
s = applyAction(s, { t: 'frendyUse', id: 'g1', itemId: 'md1' }, map, opts);
ok(s.players.find((p) => p.id === 'g1').hp === 65, 'аптечка: +25 HP');

/* — СЖИГАНИЕ: не у печи отказ, у печи — успех; сожгли все → ПОБЕДА — */
s.journeyPos.h1 = { x: 1000, y: 900, ts: Date.now(), mv: false };
s.players[0].items = [{ id: 'hch', kind: 'frendyChip' }];
s = applyAction(s, { t: 'frendyBurn', id: 'h1' }, map, opts);
ok(s.frendy.burned === 0, 'далеко от печи — отказ');
s.journeyPos.h1 = { x: furnace.cx, y: furnace.cy, ts: Date.now(), mv: false };
let guard = 0;
while (s.phase === 'playing' && guard++ < 30) {
  if (!(s.players[0].items ?? []).some((x) => x.kind === 'frendyChip')) s.players[0].items = [{ id: 'hch' + guard, kind: 'frendyChip' }];
  s = applyAction(s, { t: 'frendyBurn', id: 'h1' }, map, opts);
}
ok(s.frendy.won === true, 'все микросхемы сожжены → won');
ok(s.phase === 'over' && s.winner === 'h1', 'ПОБЕДА партии');
ok(s.log[0].includes('ФРЕНДИ ПОВЕРЖЕН'), 'лог победы');

/* — СЕССИЯ 2: смерть → Френди победил; призрак ходит, но не триггерит — */
const map2 = mkMap();
let s2 = newSession('T2', map2.id, 'h2', 'ХОСТ2');
s2 = applyAction(s2, { t: 'hello', id: 'g2', name: 'ГОСТЬ2' }, map2, opts);
s2 = applyAction(s2, { t: 'start' }, map2, opts);
s2 = applyAction(s2, { t: 'rollOffReady', id: 'h2' }, map2, opts);
s2 = applyAction(s2, { t: 'rollOffReady', id: 'g2' }, map2, opts);
s2.frendy.nextSpawnAt = Date.now() - 10;
s2 = applyAction(s2, { t: 'frendyTick', id: 'h2' }, map2, opts);
ok(!!s2.frendy.boss, 'сессия 2: Френди проснулся');
/* детерминизм: босс на g2, hp гость почти нулевой */
s2.frendy.boss.targetId = 'g2';
s2.players[1].hp = 10;
s2.journeyPos.g2 = { x: 700, y: 400, ts: Date.now(), mv: false };
s2.frendy.boss.x = 700; s2.frendy.boss.y = 400;
s2 = applyAction(s2, { t: 'frendyTick', id: 'h2' }, map2, opts);
ok(!s2.players.find((p) => p.id === 'g2').alive, 'гость выбыл на нуле HP');
ok(s2.phase === 'playing', 'партия жива, пока есть выжившие (не last-man)');
/* призрак ходит */
s2 = applyAction(s2, { t: 'journeyMove', id: 'g2', x: 640, y: 320, mv: false }, map2, opts);
ok(!!s2.journeyPos.g2 && Math.abs(s2.journeyPos.g2.x - 640) < 1, 'призрак ходит по плиткам');
/* призрак наступает на ячейку задания — задание НЕ открывается */
const tcell = map2.cells.findIndex((c) => c.type === 'task');
const tr = map2.cells[tcell];
s2.journeyPos.g2 = { x: tr.cx, y: tr.cy, ts: Date.now(), mv: false };
s2 = applyAction(s2, { t: 'journeyMove', id: 'g2', x: tr.cx + 2, y: tr.cy + 2, mv: false }, map2, opts);
ok(s2.qJobs?.g2 === undefined, 'призрак не берёт задания');
/* добиваем хоста → все погибли (босс после смерти цели перецелился на h2 — ставим его вплотную) */
s2.players[0].hp = 5;
if (!s2.frendy.boss) {
  s2.frendy.nextSpawnAt = Date.now() - 10;
  s2 = applyAction(s2, { t: 'frendyTick', id: 'h2' }, map2, opts);
}
s2.frendy.boss.targetId = 'h2';
s2.frendy.boss.x = s2.journeyPos.h2.x + 10;
s2.frendy.boss.y = s2.journeyPos.h2.y;
s2.frendy.boss.lastHitAt = 0;
s2 = applyAction(s2, { t: 'frendyTick', id: 'h2' }, map2, opts);
ok(s2.phase === 'over' && s2.winner === null, 'все погибли → партия окончена');
ok(s2.log.some((l) => l.includes('ВСЕ ПОГИБЛИ')), 'лог поражения');

console.log(`\nИТОГО: ${pass} ✔ / ${fail} ✘`);
process.exit(fail ? 1 : 0);
