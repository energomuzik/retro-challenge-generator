/* v0.109 БОГАЧ — ДОНАТЫ: дверь слушателя (локальный WebSocket к батнику),
   пул ромов/сейвов, конвейер применения донат-команды и шпаргалка для стрима.
   Слушатель (bogach-donat.bat + bogach-listener.js + .env с ключом DonatePay)
   крутится на компьютере стримера: сам опрашивает DonatePay и передаёт команды
   сюда через ws://127.0.0.1:8765. Ключ и донаты НЕ покидают компьютер.
   v0.113: дверь ОТКРЫВАЕТСЯ ТОЛЬКО ПО КНОПКЕ «Включить донаты» в панели —
   при создании комнаты браузер больше НЕ спрашивает доступ к локальной сети;
   вопрос появляется один раз, когда хост сам захотел донаты. */
import { useApp } from './store';
import { dispatch, sendBig } from './useGame';
import type { TaskDef, MapMode, ChaosKind, GameMap, MemCond } from './types';
import { DONATE_CHAOS, DONATE_UNIVERSAL_NUMS, DONATE_DICE_ONLY, taskPlatOfExt, APP_VERSION } from './types';
import { parseCond } from './memcode';

/* ---------- режимы с кубиками: только Ретрополия (и её соло-вариант) ---------- */
export const hasDice = (m?: MapMode): boolean => m === 'classic' || m === 'classic1p';

/* ---------- ПУЛ ДОНАТОВ: нумерованные ромы и сохранения ----------
   Хранится в localStorage браузера хоста. Номер донатера = позиция в списке (с 1). */
export interface BogachPool {
  roms: string[]; // id ромов из библиотеки
  saves: string[]; // id сохранений из библиотеки (могут быть частными — они уезжают гостям с библиотекой)
}
const POOL_KEY = 'bogach-pool';
export const loadPool = (): BogachPool => {
  try {
    const raw = localStorage.getItem(POOL_KEY);
    const p = raw ? (JSON.parse(raw) as BogachPool) : null;
    return { roms: Array.isArray(p?.roms) ? p!.roms.filter((x) => typeof x === 'string') : [], saves: Array.isArray(p?.saves) ? p!.saves.filter((x) => typeof x === 'string') : [] };
  } catch {
    return { roms: [], saves: [] };
  }
};
export const savePool = (p: BogachPool) => {
  try { localStorage.setItem(POOL_KEY, JSON.stringify(p)); } catch { /* noop */ }
  notify();
};

/* ---------- v0.122 БАЗА КОДОВ ДЛЯ ЗАДАНИЙ (нумерованная) ----------
   Код условия (RPC1:АДРЕС:ТИП:ОПЕРАТОР:ЗНАЧЕНИЕ) копируется в CodeSearch — и
   СРАЗУ попадает сюда: порядковый номер (с 1), платформа, название игры и
   подпись «что за условие» (правится в окне «Коды» редактора заданий). Донатер
   пишет номера из этой базы в донате: «донат режим ЯЧЕЙКА РОМ СЕЙВ ПАКОСТЬ
   КОД_ПОБЕДЫ КОД_ПОРАЖЕНИЯ» — задание ячейки получит эти условия победы/поражения.
   Хранится в localStorage браузера хоста — как пул донатов. Номер = позиция в
   списке: как и с пулом, не меняй порядок после публикации шпаргалки. */
export interface BogachCode {
  id: string; // стабильный ключ (для React и правки)
  code: string; // строка условия: RPC1:001AB2C8:u8:eq:3
  plat: string; // платформа: NES / SEGA (подпись у кода)
  game: string; // название игры (можно править)
  note: string; // за что отвечает: «купить карту», «потеря жизни» (можно править)
}
const CODES_KEY = 'bogach-codes';
const codeUid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
export const loadCodes = (): BogachCode[] => {
  try {
    const raw = localStorage.getItem(CODES_KEY);
    const l = raw ? (JSON.parse(raw) as BogachCode[]) : null;
    if (!Array.isArray(l)) return [];
    return l.filter((x) => x && typeof x.code === 'string').map((x) => ({
      id: typeof x.id === 'string' ? x.id : codeUid(),
      code: x.code,
      plat: typeof x.plat === 'string' ? x.plat : '?',
      game: typeof x.game === 'string' ? x.game : '',
      note: typeof x.note === 'string' ? x.note : '',
    }));
  } catch {
    return [];
  }
};
export const saveCodes = (list: BogachCode[]) => {
  try { localStorage.setItem(CODES_KEY, JSON.stringify(list)); } catch { /* noop */ }
  notify();
};
/** Добавить код в базу при копировании из CodeSearch. Дубликат (та же строка
 *  условия) НЕ создаётся заново — вернётся номер уже лежащего кода. */
export const addCode = (code: string, plat: string, game: string): { num: number; fresh: boolean } => {
  const list = loadCodes();
  const found = list.findIndex((x) => x.code === code);
  if (found >= 0) return { num: found + 1, fresh: false };
  list.push({ id: codeUid(), code, plat: plat || '?', game: game || 'Без названия', note: '' });
  saveCodes(list);
  return { num: list.length, fresh: true };
};

/* ---------- v0.114: мини-кнопки 💰 в списках РЕДАКТОРА (можно спрятать) ----------
   По умолчанию СКРЫТЫ: обычному создателю карт они не нужны и путают. Пул набирается
   из кнопки «💰 Донаты» (панель — там дерево выбора). Кто ведёт донаты — включит
   галочкой в панели донатов, и мини-кнопки вернутся в списки слева. */
const SIDE_KEY = 'bogach-sidebtns';
let sideBtns = (() => { try { return localStorage.getItem(SIDE_KEY) === '1'; } catch { return false; } })();
export const sideBtnsOn = (): boolean => sideBtns;
export const setSideBtns = (v: boolean) => {
  sideBtns = v;
  try { localStorage.setItem(SIDE_KEY, v ? '1' : '0'); } catch { /* noop */ }
  notify();
};

/* ---------- статус двери/слушателя для панели ---------- */
export interface BogachResult {
  id: string; ts: number; ok: boolean; text: string; reason?: string; sum?: number; name?: string; manual?: boolean;
}
export interface BogachStatus {
  door: 'off' | 'connecting' | 'open'; // дверь вкладки к слушателю
  wanted: boolean; // v0.113: хост ВКЛЮЧИЛ донаты (иначе дверь не открывается вовсе)
  key: boolean; // слушатель нашёл ключ в .env
  min: number; // минималка слушателя
  interval: number; // интервал опроса DonatePay, с
  processed: number; // команд принято слушателем за запуск
  results: BogachResult[]; // последние 8 результатов
}
const DOOR_WANT_KEY = 'bogach-door-wanted';
let doorWanted = (() => { try { return localStorage.getItem(DOOR_WANT_KEY) === '1'; } catch { return false; } })();
const status: BogachStatus = { door: 'off', wanted: doorWanted, key: false, min: 50, interval: 15, processed: 0, results: [] };
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((cb) => cb());
export const subscribeBogach = (cb: () => void): (() => void) => { listeners.add(cb); return () => { listeners.delete(cb); }; };
export const getBogachStatus = (): BogachStatus => status;

const pushResult = (r: BogachResult) => {
  status.results = [r, ...status.results].slice(0, 8);
  notify();
};

/* ---------- ДВЕРЬ: WebSocket вкладки к слушателю ---------- */
let ws: WebSocket | null = null;
let retryTimer: number | null = null;
let pingTimer: number | null = null;
let doorRoom = '';
let doorOn = false;
const BOT_PORT = 8765; // порт слушателя (bogach-listener.js); менять только парой, см. инструкцию

const botSend = (obj: unknown) => {
  try { if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(obj)); } catch { /* noop */ }
};

const setStatus = (patch: Partial<BogachStatus>) => { Object.assign(status, patch); notify(); };

const doorConnect = () => {
  if (!doorOn) return;
  try { ws?.close(); } catch { /* noop */ }
  setStatus({ door: 'connecting' });
  let sock: WebSocket;
  try { sock = new WebSocket(`ws://127.0.0.1:${BOT_PORT}`); } catch { doorRetry(); return; }
  ws = sock;
  sock.onopen = () => {
    if (ws !== sock) return;
    setStatus({ door: 'open' });
    // v0.112: версия игры в рукопожатии — из APP_VERSION (раньше каменела на 104)
    botSend({ t: 'tab', room: doorRoom, app: APP_VERSION });
    // v0.113: сразу и статус-пинг (не ждать 15 с — слушатель сразу маршрутизирует донаты)
    const st0 = useApp.getState();
    botSend({ t: 'ping', room: doorRoom, visible: document.visibilityState === 'visible', host: !!st0.room?.isHost, live: !!st0.session && st0.session.phase !== 'lobby' });
    // сразу скажем слушателю актуальную минималку панели (у кого новее — тот прав)
    const own = Number(localStorage.getItem('bogach-min') ?? '');
    if (Number.isFinite(own) && own > 0) botSend({ t: 'min', v: own });
    notify();
  };
  sock.onmessage = (e) => {
    if (ws !== sock) return;
    let m: Record<string, unknown> | null = null;
    try { m = JSON.parse(String(e.data)); } catch { return; }
    if (!m || typeof m.t !== 'string') return;
    if (m.t === 'status') {
      setStatus({ key: !!m.key, min: Number(m.min) || 50, interval: Number(m.interval) || 15, processed: Number(m.processed) || 0 });
    } else if (m.t === 'donat') {
      void handleDonat(m as unknown as DonatMsg);
    }
  };
  sock.onclose = () => {
    if (ws !== sock) return;
    ws = null;
    setStatus({ door: doorOn ? 'connecting' : 'off' });
    if (doorOn) doorRetry();
  };
  sock.onerror = () => { try { sock.close(); } catch { /* noop */ } };
};

const doorRetry = () => {
  if (!doorOn || retryTimer !== null) return;
  retryTimer = window.setTimeout(() => { retryTimer = null; doorConnect(); }, 5000);
};

/** Запустить дверь (хост включил донаты в панели или хост новой партии с уже включёнными). */
export const startDoor = (roomCode: string) => {
  doorOn = true;
  doorRoom = roomCode;
  if (retryTimer !== null) { clearTimeout(retryTimer); retryTimer = null; }
  doorConnect();
  if (pingTimer === null) {
    pingTimer = window.setInterval(() => {
      const st = useApp.getState();
      const vis = document.visibilityState === 'visible';
      botSend({ t: 'ping', room: doorRoom, visible: vis, host: !!st.room?.isHost, live: !!st.session && st.session.phase !== 'lobby' });
    }, 15000);
  }
  document.addEventListener('visibilitychange', onVis);
};

/** Остановить дверь (хост вышел из партии). */
export const stopDoor = () => {
  doorOn = false;
  if (retryTimer !== null) { clearTimeout(retryTimer); retryTimer = null; }
  if (pingTimer !== null) { clearInterval(pingTimer); pingTimer = null; }
  document.removeEventListener('visibilitychange', onVis);
  try { ws?.close(); } catch { /* noop */ }
  ws = null;
  setStatus({ door: 'off' });
};

const onVis = () => botSend({ t: 'ping', room: doorRoom, visible: document.visibilityState === 'visible' });

/* ---------- v0.113: дверь по кнопке — без запроса браузера при создании комнаты ----------
   Публичный сайт подключается к 127.0.0.1 — Chrome спрашивает разрешение на локальную сеть.
   Раньше вопрос выскакивал у ВСЕХ при создании комнаты. Теперь донаты выключены по умолчанию:
   дверь открывается только кнопкой «Включить донаты» в панели (enableDoor) — и вопрос видит
   только тот, кто захотел донаты. Выбор запоминается: следующие партии подключаются сами. */
export const isDoorWanted = (): boolean => doorWanted;
export const enableDoor = (roomCode: string) => {
  doorWanted = true;
  try { localStorage.setItem(DOOR_WANT_KEY, '1'); } catch { /* noop */ }
  setStatus({ wanted: true });
  startDoor(roomCode);
};
export const disableDoor = () => {
  doorWanted = false;
  try { localStorage.setItem(DOOR_WANT_KEY, '0'); } catch { /* noop */ }
  setStatus({ wanted: false });
  stopDoor();
};

/** Панель сменила минималку — сообщим слушателю и запомним. */
export const setMinimalka = (v: number) => {
  const n = Math.max(1, Math.min(100000, Math.floor(v) || 50));
  try { localStorage.setItem('bogach-min', String(n)); } catch { /* noop */ }
  botSend({ t: 'min', v: n });
  setStatus({ min: n });
};

/* ---------- конвейер донат-команды ---------- */
interface DonatMsg {
  id?: string; name?: string; sum?: number; text?: string;
  ok?: boolean; reason?: string; manual?: boolean;
  cell?: number; rom?: number; save?: number; chaos?: number; room?: string | null;
  /* v0.122: задания ПО КОДУ — номера из базы кодов (пара: победа + поражение);
     слушатель v2.4 шлёт их, когда в донате после ПАКОСТИ ещё ДВА числа */
  win?: number; lose?: number;
}

/* выбита ли ячейка сейчас (Ретрополия — ходы, Джёрни — минута, VERSUS — до конца катки) */
const brokenActive = (br: { left?: number; at?: number; ms?: number; perm?: boolean; task?: TaskDef } | undefined): boolean => {
  if (!br) return false;
  if (br.task) return true; // ждёт задание хозяина — донат конфликтует
  if (br.perm) return true; // VERSUS: до конца катки
  if ((br.left ?? 0) > 0) return true; // Ретрополия/Скилл: до N ходов
  if (br.ms && Date.now() - (br.at ?? 0) < br.ms) return true; // Джёрни: минута починки
  return false;
};

/** Проверка и применение донат-команды (только ХОСТ). Возвращает {ok, reason}. */
export async function applyDonat(cmd: DonatMsg): Promise<{ ok: boolean; reason: string; note?: string }> {
  const st = useApp.getState();
  const room = st.room;
  const session = st.session;
  const map = st.sessionMap;
  if (!room?.isHost) return { ok: false, reason: 'применять донаты может только хост партии' };
  if (!session || !map || session.phase === 'lobby') return { ok: false, reason: 'нет активной партии — донат не к чему применять' };

  /* --- ячейка --- */
  const cellNum = Math.floor(Number(cmd.cell));
  const idx = map.cells.findIndex((c) => c.n === cellNum);
  if (!Number.isFinite(cellNum) || idx < 0) return { ok: false, reason: `на карте нет ячейки №${cmd.cell ?? '?'}` };
  const cell = map.cells[idx];
  if (cell.type !== 'task' || !cell.task) return { ok: false, reason: `ячейка №${cellNum} — не ячейка задания` };
  if (brokenActive((session.broken as Record<string, { left?: number; at?: number; ms?: number; perm?: boolean; task?: TaskDef }> | undefined)?.[idx]))
    return { ok: false, reason: `ячейка №${cellNum} сейчас выбита — донат нельзя` };

  /* --- пул: ром и сейв --- */
  const pool = loadPool();
  const romNum = Math.floor(Number(cmd.rom));
  const romDef = pool.roms[romNum - 1] ? st.roms.find((r) => r.id === pool.roms[romNum - 1]) : undefined;
  if (!romDef) return { ok: false, reason: `в пуле донатов нет рома №${cmd.rom ?? '?'}` };
  const saveNum = Math.floor(Number(cmd.save) || 0);
  let saveId: string | undefined;
  let saveName = '';
  if (saveNum > 0) {
    const svId = pool.saves[saveNum - 1];
    const sv = svId ? st.saves.find((x) => x.id === svId) : undefined;
    if (!sv) return { ok: false, reason: `в пуле донатов нет сохранения №${cmd.save ?? '?'}` };
    if (sv.romId !== romDef.id) {
      const own = st.roms.find((r) => r.id === sv.romId)?.name ?? sv.romId;
      return { ok: false, reason: `сейв №${saveNum} не от рома №${romNum} (он от «${own}») — донат отклонён` };
    }
    saveId = sv.id;
    saveName = sv.name;
  }

  /* --- пакость: жёсткая таблица 0–30 --- */
  const chaosNum = Math.floor(Number(cmd.chaos) || 0);
  let chaos: ChaosKind | undefined;
  let chaosName = '';
  let note = '';
  if (chaosNum > 0) {
    const meta = DONATE_CHAOS.find((x) => x.num === chaosNum);
    if (!meta) return { ok: false, reason: `нет пакости №${chaosNum} — номера 0–30` };
    if (meta.kind === 'timer')
      return { ok: false, reason: 'пакость 29 «Таймер» в донатах запрещена — лимит времени ставит только автор карты в редакторе' };
    if (DONATE_DICE_ONLY.includes(meta.kind) && !hasDice(map.mode)) {
      const uni = DONATE_UNIVERSAL_NUMS[Math.floor(Math.random() * DONATE_UNIVERSAL_NUMS.length)];
      const repl = DONATE_CHAOS.find((x) => x.num === uni)!;
      chaos = repl.kind as ChaosKind;
      chaosName = repl.name;
      note = `пакость ${chaosNum} «${meta.name}» заменена на ${uni} «${repl.name}» — в этом режиме нет кубиков`;
    } else if (meta.kind === 'dendy' && romDef.ext !== 'nes') {
      chaos = 'pal50';
      chaosName = '50 Гц (PAL)';
      note = 'пакость 30 «Режим Денди» работает только на NES — применена «50 Гц (PAL)»';
    } else {
      chaos = meta.kind as ChaosKind;
      chaosName = meta.name;
    }
  }

  /* --- v0.122: задания ПО КОДУ — КОД ПОБЕДЫ и КОД ПОРАЖЕНИЯ из базы кодов ---
     Приходят ПАРОЙ (слушатель v2.4: в донате после ПАКОСТИ ровно 2 числа);
     оба номера обязаны лежать в базе — иначе донат отклоняется (уедет в
     «отклонённые», хост сможет применить вручную). Код замещает условие
     победы/поражения вшитого задания ячейки на время этого доната. */
  let codeWin: MemCond | undefined;
  let codeFail: MemCond | undefined;
  const winNum = Math.floor(Number(cmd.win));
  const loseNum = Math.floor(Number(cmd.lose));
  const withCodes = cmd.win !== undefined || cmd.lose !== undefined;
  if (withCodes) {
    if (!(winNum > 0) || !(loseNum > 0))
      return { ok: false, reason: 'коды победы и поражения приходят ПАРОЙ — два номера из базы кодов после пакости' };
    const codes = loadCodes();
    const wEntry = codes[winNum - 1];
    const lEntry = codes[loseNum - 1];
    if (!wEntry) return { ok: false, reason: `в базе кодов нет кода №${winNum} (победа) — всего кодов: ${codes.length}` };
    if (!lEntry) return { ok: false, reason: `в базе кодов нет кода №${loseNum} (поражение) — всего кодов: ${codes.length}` };
    const wCond = parseCond(wEntry.code);
    const lCond = parseCond(lEntry.code);
    if (!wCond) return { ok: false, reason: `код №${winNum} «${wEntry.game}» не разбирается — пересобери его через CodeSearch` };
    if (!lCond) return { ok: false, reason: `код №${loseNum} «${lEntry.game}» не разбирается — пересобери его через CodeSearch` };
    codeWin = wCond;
    codeFail = lCond;
  }

  /* --- применяем: задание ячейки меняется, карта уезжает всем --- */
  const task: TaskDef = {
    ...cell.task,
    romId: romDef.id,
    saveId,
    chaos,
    plat: taskPlatOfExt(romDef.ext),
    ...(codeWin ? { code: codeWin, codeFail } : {}), // v0.122: донат по кодам замещает условия победы/поражения
  };
  const nextMap = { ...map, cells: map.cells.map((c, i) => (i === idx ? { ...c, task } : c)) };
  useApp.setState({ sessionMap: nextMap });
  sendBig(room, 'map', nextMap);
  const who = cmd.manual ? 'Хост (вручную)' : `${cmd.name ?? 'донатер'}${cmd.sum ? ` (${cmd.sum} ₽)` : ''}`;
  const bits = [`ячейка №${cellNum}`, `ром «${romDef.name}»`];
  if (saveName) bits.push(`сейв «${saveName}»`);
  if (chaosName) bits.push(`пакость «${chaosName}»`);
  if (codeWin && cmd.win) bits.push(`победа — код №${cmd.win}`);
  if (codeFail && cmd.lose) bits.push(`поражение — код №${cmd.lose}`);
  const logText = `Донат от ${who}: ${bits.join(' · ')}`;
  dispatch({ t: 'donatLog', text: note ? `${logText} — ${note}` : logText });
  st.toast(`Донат применён: ячейка №${cellNum} → «${romDef.name}»${chaosName ? ` · 😈 ${chaosName}` : ''}${codeWin ? ` · код №${cmd.win}/№${cmd.lose}` : ''}`, 'ok');
  return { ok: true, reason: note || 'применено', note };
}

async function handleDonat(m: DonatMsg) {
  const id = String(m.id ?? Date.now());
  const st = useApp.getState();
  if (!st.room?.isHost) return; // на вкладке гостя донаты не применяются
  if (m.room && String(m.room).toUpperCase() !== doorRoom.toUpperCase()) return;
  if (m.ok === false) {
    pushResult({ id, ts: Date.now(), ok: false, text: String(m.text ?? ''), reason: String(m.reason ?? 'команда не разобрана'), sum: m.sum, name: m.name });
    st.toast(`донат отклонён: ${m.reason ?? 'команда не разобрана'}`, 'err');
    return;
  }
  const res = await applyDonat(m);
  pushResult({ id, ts: Date.now(), ok: res.ok, text: String(m.text ?? ''), reason: res.ok ? undefined : res.reason, sum: m.sum, name: m.name });
  botSend({ t: 'donat-result', id, ok: res.ok, reason: res.reason });
  if (!res.ok) st.toast(`донат отклонён: ${res.reason}`, 'err');
}

/* ---------- ШПАРГАЛКА ДЛЯ СТРИМА ---------- */
/** v0.112: mapOverride — карта из РЕДАКТОРА ЗАДАНИЙ (панель «💰 Донаты» открыта кнопкой
    в тулбаре редактора): шпаргалка строится по её ячейкам ещё до партии. Без параметра —
    по карте активной партии, как раньше. */
export function buildShpargalka(mapOverride?: GameMap | null): string {
  const st = useApp.getState();
  const map = mapOverride !== undefined ? mapOverride : st.sessionMap;
  const pool = loadPool();
  const code = st.room?.code ?? 'NNNN';
  const L: string[] = [];
  L.push('БОГАЧ — ДОНАТЫ В СМЕНУ ИГРЫ');
  L.push('==============================');
  L.push('');
  L.push('ФОРМАТ ДОНАТА (пишется в тексте доната, сумма — от минималки):');
  L.push('  донат режим ЯЧЕЙКА РОМ СЕЙВ ПАКОСТЬ [КОД_ПОБЕДЫ КОД_ПОРАЖЕНИЯ] [комната ' + code + ']');
  L.push('');
  L.push('Пример: донат режим 5 14 25 13');
  L.push('        донат режим 5 14 25 13 5 12          ← задание по кодам (победа №5, поражение №12)');
  L.push('        донат режим 5 14 25 13 комната ' + code);
  L.push('');
  L.push('ПРАВИЛА:');
  L.push('• ЯЧЕЙКА — номер ячейки задания на карте (список ниже); на ней заменится игра.');
  L.push('• РОМ — номер игры из пула ромов; СЕЙВ — номер сохранения (0 = с начала игры).');
  L.push('• ПАКОСТЬ — номер искажения 0–30 (список ниже); 0 = без пакости.');
  L.push('• КОД ПОБЕДЫ и КОД ПОРАЖЕНИЯ — необязательная ПАРА чисел после пакости: номера');
  L.push('  из таблицы «КОДЫ» ниже. Донат заменит условия победы/поражения задания ячейки');
  L.push('  на эти коды (засчитает эмулятор сам). 4 числа = стандартное задание ячейки,');
  L.push('  6 чисел = задание по кодам. Ошиблись с количеством — донат уедет в отклонённые,');
  L.push('  хост применит вручную.');
  L.push('• Задание в донате не пишется: играет вшитое в карту задание ячейки —');
  L.push('  уровень = «пройти уровень», босс = «победить босса», именное сохранение =');
  L.push('  задание из описания стрима (с кодами — условия из таблицы КОДОВ).');
  L.push('• Комната нужна, только если открыто несколько комнат одновременно.');
  L.push('');
  L.push('ЯЧЕЙКИ ЗАДАНИЙ НА КАРТЕ:');
  if (map) {
    const tasks = map.cells.filter((c) => c.type === 'task' && c.task);
    if (tasks.length === 0) L.push('  (на карте нет ячеек заданий)');
    for (const c of tasks) {
      const lbl = c.label ? `${c.label} — ${c.task!.title}` : c.task!.title;
      L.push(`  ${c.n} — ${lbl}`);
    }
  } else L.push('  (карта не открыта — шпаргалка генерируется в партии)');
  L.push('');
  L.push('ПУЛ РОМОВ (номер = РОМ):');
  if (pool.roms.length === 0) L.push('  (пуст — заполни галочками в панели «💰 Донаты»: в партии или в редакторе заданий)');
  pool.roms.forEach((rid, i) => {
    const r = st.roms.find((x) => x.id === rid);
    L.push(`  ${i + 1} — ${r?.name ?? rid} (${(r?.ext ?? '?').toUpperCase()})`);
  });
  L.push('');
  L.push('ПУЛ СОХРАНЕНИЙ (номер = СЕЙВ, 0 = с начала):');
  if (pool.saves.length === 0) L.push('  (пуст — заполни галочками в панели «💰 Донаты»: в партии или в редакторе заданий)');
  pool.saves.forEach((sid, i) => {
    const sv = st.saves.find((x) => x.id === sid);
    const rn = sv ? st.roms.find((x) => x.id === sv.romId)?.name ?? '' : '';
    L.push(`  ${i + 1} — ${sv?.name ?? sid} (${sv?.kind ?? 'level'}, ром «${rn}»)`);
  });
  L.push('');
  L.push('ПАКОСТИ (номер = ПАКОСТЬ):');
  for (const x of DONATE_CHAOS) {
    const guard = x.num === 0 ? '' : x.note ? ` — ${x.note}` : '';
    L.push(`  ${x.num} — ${x.name}${guard}`);
  }
  L.push('');
  L.push('КОДЫ ДЛЯ ЗАДАНИЙ ПО КОДУ (номер = КОД_ПОБЕДЫ или КОД_ПОРАЖЕНИЯ):');
  const codes = loadCodes();
  if (codes.length === 0) {
    L.push('  (пусто — скопируй код условия в CodeSearch («Скопировать код условия»),');
    L.push('   он сам добавится сюда с номером; название и подпись правятся в окне');
    L.push('   «Коды» редактора заданий)');
  }
  codes.forEach((c, i) => {
    L.push(`  ${i + 1} — ${c.game} (${c.plat})${c.note ? ` — ${c.note}` : ''} — ${c.code}`);
  });
  L.push('');
  L.push('Минималку и статус слушателя смотри в панели «💰 Донаты» у хоста.');
  return L.join('\n');
}
