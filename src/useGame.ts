import { useApp, getRomData } from './store';
import { createRoom, type Room } from './net';
import { createHubRoom } from './hub';
import { applyAction, type Action } from './engine';
import type { GameMap, GameOptions, GameSession, NetMsg, RomDef, SaveDef, SessionSnapshot, TokenDir } from './types';
import { APP_VERSION, isJourneyMoveOnly, markersHash } from './types';
import { idbGet, idbPut } from './db';
import { startDoor, loadPool, isDoorWanted } from './bogach';

/* base64 <-> ArrayBuffer для передачи ромов по сети */
function bufToB64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = '';
  const CH = 0x8000;
  for (let i = 0; i < bytes.length; i += CH) bin += String.fromCharCode(...bytes.subarray(i, i + CH));
  return btoa(bin);
}
function b64ToBuf(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

/* Гость сообщает прогресс загрузки: и хосту (по сети), и себе (чтобы собственная
   полоска в лобби двигалась, а не стояла на нуле). */
function reportSync(room: Room, pct: number) {
  useApp.getState().setSync(room.selfId, pct);
  room.send('action', { t: 'syncProgress', id: room.selfId, pct });
}

/* ---------- чанковая передача больших данных (карта, библиотека ромов) ----------
   Карта с пиксель-артом и библиотека ромов — это мегабайты. Одним куском они
   ломаются на любом «узком» пути (туннель, прокси, чужой провайдер между
   городами) — и всё молча замирает на 0%. режем на кусочки ~48 КБ: они проходят
   по любому каналу, полоска загрузки двигается по-настоящему, а повреждённый/
   недокачанный набор можно перезапросить («needResend») — как в торрентах. */
const CHUNK_SIZE = 48 * 1024;
const CHUNK_TTL = 120_000; // собранный набор живёт 2 мин, потом чистим

const rxChunks = new Map<string, { parts: string[]; got: number; n: number; timer: number }>();
/* последние отправленные наборы — чтобы ответить на needResend без пересборки */
const txCache = new Map<string, { t: string; json: string }>();

export function sendBig(room: Room, t: string, p: unknown) {
  const json = JSON.stringify(p);
  const n = Math.max(1, Math.ceil(json.length / CHUNK_SIZE));
  const key = `${room.selfId}-${t}-${Date.now().toString(36)}`;
  txCache.set(key, { t, json });
  if (txCache.size > 6) {
    const oldest = txCache.keys().next().value as string;
    txCache.delete(oldest);
  }
  for (let i = 0; i < n; i++) {
    room.send('chunk', { key, t, i, n, part: json.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE) });
  }
}

function resendChunks(room: Room, key: string) {
  const e = txCache.get(key);
  if (!e) return; // набор уже выдавлен из кэша — гость перезайдёт и получит заново через hello
  const n = Math.max(1, Math.ceil(e.json.length / CHUNK_SIZE));
  for (let i = 0; i < n; i++) {
    room.send('chunk', { key, t: e.t, i, n, part: e.json.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE) });
  }
}

/* приём кусочков; по завершении возвращает собранный payload или null */
function takeChunk(room: Room, c: { key: string; t: string; i: number; n: number; part: string }): unknown | null {
  if (!c || typeof c.key !== 'string' || typeof c.part !== 'string' || !Number.isInteger(c.i) || !Number.isInteger(c.n)) return null;
  let st = rxChunks.get(c.key);
  if (!st) {
    st = { parts: new Array<string>(c.n), got: 0, n: c.n, timer: 0 };
    st.timer = window.setTimeout(() => rxChunks.delete(c.key), CHUNK_TTL);
    rxChunks.set(c.key, st);
  }
  if (c.i < 0 || c.i >= st.n) return null;
  if (st.parts[c.i] === undefined) {
    st.parts[c.i] = c.part;
    st.got++;
  }
  const pct = Math.round((st.got / st.n) * 100);
  if (!room.isHost) {
    /* реальный прогресс: карта — 0..59, библиотека — 60..99 (100 — в обработчике library) */
    if (c.t === 'map') reportSync(room, Math.min(59, Math.round(pct * 0.6)));
    else if (c.t === 'library') reportSync(room, 60 + Math.min(39, Math.round(pct * 0.4)));
  }
  if (st.got >= st.n) {
    clearTimeout(st.timer);
    rxChunks.delete(c.key);
    try {
      return JSON.parse(st.parts.join(''));
    } catch {
      if (!room.isHost) room.send('action', { t: 'needResend', key: c.key });
      return null;
    }
  }
  return null;
}

/* Автосейв партии хостом: чтобы при зависании/перезагрузке сессию можно было
   восстановить из «Загрузить игру». Пишем не чаще раза в 8 с и при смене хода. */
/* Автосейв: 5 циклических слотов на комнату, перезаписываются по кругу на каждом
   ходе. Идентификатор слота auto-CODE-0..4, поэтому старых копий не копится. */
const AUTO_SLOTS = 5;
let lastAutosave = 0;
let lastAutosaveTurn = -1;
let autoSlotByCode: Record<string, number> = {};
async function autosaveSession(next: GameSession) {
  /* v0.124: партия ЗАВЕРШЕНА (победа/поражение) — автосейв НЕ пишем: на титрах
     сохраняться нельзя, финальное состояние не должно затирать автослоты */
  if (next.phase === 'lobby' || next.phase === 'over') return; // в лобби сохранять нечего
  const st = useApp.getState();
  if (!st.sessionMap) return;
  const now = Date.now();
  const turnChanged = next.turn !== lastAutosaveTurn;
  if (!turnChanged && now - lastAutosave < 8000) return;
  lastAutosave = now;
  lastAutosaveTurn = next.turn;
  const slot = ((autoSlotByCode[next.code] ?? -1) + 1) % AUTO_SLOTS;
  autoSlotByCode[next.code] = slot;
  /* реальный номер хода партии (инкрементируется движком в endTurnNow) */
  const turnNo = next.turnNo ?? 1;
  const snap: SessionSnapshot = {
    id: `auto-${next.code}-${slot}`,
    name: `Автосейв · ход ${turnNo}`,
    mapName: st.sessionMap.name,
    code: next.code,
    state: next,
    /* v0.114: КАРТА ЕДЕТ ВНУТРЬ СЕЙВА — восстановление не зависит от библиотеки
       (сейв работает на любом устройстве), а донат-замены ячеек не теряются */
    map: st.sessionMap,
    createdAt: now,
    auto: true,
    slot,
  };
  try { await idbPut('sessions', snap.id, snap); } catch { /* noop */ }
}

/* Хост собирает ромы и сохранения, на которые ссылается карта, и отдаёт их гостю. */
async function sendLibrary(room: Room, map: GameMap): Promise<void> {
  const romIds = new Set<string>();
  const saveIds = new Set<string>();
  for (const c of map.cells) {
    if (c.task?.romId) romIds.add(c.task.romId);
    if (c.task?.saveId) saveIds.add(c.task.saveId);
    /* v0.105: варианты задания (СПРИНТЕР) — их ромы тоже уезжают сразу,
       чтобы общий запуск гонки открывался у гостей мгновенно, без needRom */
    for (const v of c.taskVariants ?? []) if (v?.romId) romIds.add(v.romId);
  }
  /* v0.109 БОГАЧ: пул донатов — ромы и сохранения (включая ЧАСТНЫЕ) уезжают гостям
     вместе с библиотекой карты, чтобы донат-задания открывались без ожидания */
  const pool = loadPool();
  for (const rid of pool.roms) romIds.add(rid);
  for (const sid of pool.saves) saveIds.add(sid);
  const st = useApp.getState();
  const roms = st.roms.filter((r) => romIds.has(r.id));
  /* Гости должны видеть в игре (после захвата ячейки) все «уровни / боссы / моё задание»
     используемых ромов — шлём их ЦЕЛИКОМ. Частные сохранения уезжают только если на
     них напрямую ссылается какая-то ячейка (выбор частных возможен лишь в редакторе). */
  for (const s of st.saves) {
    if (romIds.has(s.romId) && (s.kind ?? 'level') !== 'private') saveIds.add(s.id);
  }
  const saves = st.saves.filter((s) => saveIds.has(s.id));
  const blobs: Record<string, string> = {};
  for (const r of roms) {
    const buf = await getRomData(r.id);
    if (buf) blobs[r.id] = bufToB64(buf);
  }
  sendBig(room, 'library', { roms, saves, blobs });
}

/* мини-шина для кадров трансляции */
export interface StreamPacket { from: string; name: string; data: string; ts: number; }
type StreamCb = (p: StreamPacket) => void;
const streamListeners = new Set<StreamCb>();
export const streamBus = {
  on: (cb: StreamCb) => { streamListeners.add(cb); return () => { streamListeners.delete(cb); }; },
  emit: (p: StreamPacket) => { streamListeners.forEach((cb) => cb(p)); },
};

/* ---------- v0.163: ЛЁГКИЕ ОБНОВЛЕНИЯ ДВИЖЕНИЯ (jpos) ----------
   Раньше КАЖДЫЙ шаг фишки (journeyMove, ~6 сообщений/с на игрока) заставлял хоста
   рассылать ВСЁ состояние партии (сотни КБ с историей) каждому игроку — при 12
   идущих одновременно это десятки МБ/с: хост-стример захлёбывается, «кто первый
   нажал» в квизе плывёт. Теперь если шаг ТОЛЬКО сдвинул фишку (без событий —
   квиз/задание/карточка/босс/починка ячейки/лог), хост шлёт крошечный jpos
   (id,x,y,dir,mv,tp ≈ 0.1 КБ) батчем раз в 120 мс; полное состояние уходит только
   на СОБЫТИЯ. isJourneyMoveOnly сравнивает компактные маркеры состояния. */
interface JposItem { id: string; x: number; y: number; dir?: TokenDir; mv?: boolean; tp?: boolean; }
const jposPending = new Map<string, JposItem>();
let jposTimer: number | null = null;
function queueJpos(room: Room, jp: JposItem) {
  jposPending.set(jp.id, jp); // последняя позиция игрока — предыдущие не нужны
  if (jposTimer !== null) return;
  jposTimer = window.setTimeout(() => {
    jposTimer = null;
    const list = [...jposPending.values()];
    jposPending.clear();
    if (list.length) room.send('jposBatch', { list });
  }, 120);
}
/* ---------- v0.164: СВЕРКА ПАРТИИ (sig/needState) — самолечение сети ----------
   Страховка лёгкой сети: хост каждые 3 с шлёт подпись маркеров состояния (~10 байт),
   гость сверяет со своей. Совпало — тишина; разошлось (потерянный пакет невозможен —
   каналы надёжные, но любой будущий механизм, изменивший состояние мимо маркеров,
   или лаг при входе в комнату) — гость сам просит полный state ('needState', не чаще
   раза в 2.5 с) и снова становится идентичен хосту. Позиции фишек в подпись НЕ
   входят — ходьба не вызывает сверок; события и так едут полным state мгновенно. */
let sigTimer: number | null = null;
let lastStateSentAt = 0;
let lastNeedStateAt = 0;
const SIG_EVERY = 3000;
function sigBeatStart(room: Room) {
  if (sigTimer !== null) window.clearInterval(sigTimer);
  const myRoom = room;
  sigTimer = window.setInterval(() => {
    const st = useApp.getState();
    if (st.room !== myRoom) { window.clearInterval(sigTimer!); sigTimer = null; return; } // комната закрыта/сменена — тишина
    if (!st.session || Date.now() - lastStateSentAt < 2000) return; // полный state только что ушёл — подпись излишня
    myRoom.send('sig', { h: markersHash(st.session) });
  }, SIG_EVERY);
}

/* ---------- v0.165: ТУМБЛЕР СИНХРОНИЗАЦИИ ФИШЕК (опции → «Как устроена связь», решает ХОСТ) ----------
   classic — КАК ГОДАМИ: каждый чистый шаг фишки рассылает ПОЛНОЕ состояние партии всем (механика ровно та,
   что была до v0.163; тяжело по сети только при большой компании). light — всегда лёгкие jpos-пакеты.
   auto (по умолчанию) — ДО 4 ИГРОКОВ ВКЛЮЧИТЕЛЬНО = classic (прежняя привычная механика),
   5 и больше = light (иначе хост захлёбывается при одновременном хождении).
   Сверка партии (sig/needState) работает при ЛЮБОМ положении — стоит килобайты и только лечит рассинхрон. */
export function lightSyncActive(opts: GameOptions, s: GameSession | null | undefined): boolean {
  const mode = opts.netSync ?? 'auto';
  if (mode === 'classic') return false;
  if (mode === 'light') return true;
  const n = s ? s.players.filter((p) => !p.spect).length : 1; // зрители не ходят — не считаем
  return n > 4;
}

export function dispatch(a: Action) {
  const st = useApp.getState();
  const room = st.room;
  if (!room) return;
  if (room.isHost) {
    if (!st.session || !st.sessionMap) return;
    const prev = st.session;
    const next = applyAction(st.session, a, st.sessionMap, st.options);
    st.setSession(next);
    /* при восстановлении партии сначала рассылаем карту и библиотеку ромов,
       и только потом новое состояние — чтобы гости встретили фазу игры уже с картой */
    if (a.t === 'resume' && next.phase !== 'lobby') {
      sendBig(room, 'map', st.sessionMap);
      void sendLibrary(room, st.sessionMap);
    }
    /* v0.163/v0.165: чистый шаг фишки — лёгкий jpos вместо полного состояния (ТУМБЛЕР в опциях:
       авто — до 4 игроков классика «полное состояние», 5+ — лёгкая; classic — всегда полное;
       light — всегда лёгкая). События (квиз, карточка, босс…) идут полным state как раньше */
    if (a.t === 'journeyMove' && isJourneyMoveOnly(prev, next) && lightSyncActive(st.options, next)) {
      const jp = next.journeyPos?.[a.id];
      if (jp) queueJpos(room, { id: a.id, x: jp.x, y: jp.y, dir: jp.dir, mv: jp.mv, tp: jp.tp });
      void autosaveSession(next);
      return;
    }
    jposPending.clear(); // полный state уже несёт свежие позиции — батч не нужен
    room.send('state', next);
    lastStateSentAt = Date.now();
    void autosaveSession(next);
  } else {
    room.send('action', a);
  }
}

/* применить jpos к ЛОКАЛЬНОЙ сессии (гость): только позиция фишки — без полной замены состояния.
   Пока идёт квиз (движение замерло) — запоздалые обновления игнорируем, чтобы фишки не дёргались. */
function applyJposLocal(jp: JposItem) {
  if (!jp || typeof jp.id !== 'string') return;
  const cur = useApp.getState().session;
  if (!cur) return;
  if (cur.quiz && cur.quiz.startedAt && !cur.quiz.resolved) return;
  useApp.setState({
    session: {
      ...cur,
      journeyPos: { ...(cur.journeyPos ?? {}), [jp.id]: { x: jp.x, y: jp.y, dir: jp.dir, ts: Date.now(), mv: jp.mv !== false, tp: jp.tp || undefined } },
    },
  });
}

export function openRoom(code: string, isHost: boolean, initial: { session: GameSession | null; map: GameMap | null }): Room {
  jposPending.clear(); // новая комната — старый батч движения не нужен
  if (jposTimer !== null) { clearTimeout(jposTimer); jposTimer = null; }
  lastStateSentAt = 0; lastNeedStateAt = 0; // v0.164: новая комната — сверка с чистого листа
  const st = useApp.getState();
  st.leaveRoom();
  const app = useApp.getState();

  let room: Room;
  const onMsg = (m: NetMsg) => {
    const cur = useApp.getState();
    switch (m.t) {
      case 'map': {
        useApp.setState({ sessionMap: m.p as GameMap });
        if (!room.isHost) reportSync(room, 60);
        break;
      }
      /* кусочек большого пакета (карта/библиотека/ром) — собираем до полного */
      case 'chunk': {
        if (room.isHost) break; // хост и так автор — свои кусочки не применяем
        const c = m.p as { key: string; t: string; i: number; n: number; part: string };
        const payload = takeChunk(room, c);
        if (payload === null) break;
        if (c.t === 'map') {
          onMsg({ mid: m.mid, from: m.from, t: 'map', p: payload });
        } else if (c.t === 'library') {
          onMsg({ mid: m.mid, from: m.from, t: 'library', p: payload });
        } else if (c.t === 'romData') {
          onMsg({ mid: m.mid, from: m.from, t: 'romData', p: payload });
        }
        break;
      }
      /* гость докачал набор с дыркой/битым куском — просим хоста перелить */
      case 'needResend': {
        if (!room.isHost) break;
        const { key } = (m.p ?? {}) as { key?: string };
        if (key) resendChunks(room, key);
        break;
      }
      /* синхронное перемешивание кубиков: все видят грани бросающего */
      case 'shake': {
        const d = m.p as { from: string; a: number; b: number };
        cur.setDiceShake(d);
        break;
      }
      /* восстановление партии: игрок заявляет, кем он играл */
      case 'claim': {
        const c = m.p as { curId: string; savedId: string };
        cur.setResumeClaim(c.curId, c.savedId);
        /* v0.115: ретрансляция ростера с УЖЕ ЗАНЯТЫМИ ролями — следующий подключившийся
           гость автоматически займёт свободную роль, а не ту же самую, что и первый */
        if (room.isHost) {
          const rs = useApp.getState().resumeSnap;
          if (rs) {
            const hostSavedId = rs.state.players.find((p) => p.isHost)?.id;
            const taken = Object.values(useApp.getState().resumeClaims).filter(Boolean);
            room.send('resumeInfo', { players: rs.state.players, mapName: rs.mapName, hostSavedId, taken });
          }
        }
        break;
      }
      /* хост прислал сохранённый ростер — гость видит, кем может заявиться.
         v0.116 КРИТИЧЕСКИЙ ФИКС: хосту СВОЁ же сообщение применять ЗАПРЕЩЕНО —
         хаб и PeerJS доставляют хосту его собственные сообщения (self-delivery,
         «хост — авторитет»), и без этой проверки ростер-заглушка {state:{players}}
         (без captured/qDone/journeyPos/лога!) ЗАМЕНЯЛА настоящий снапшот сейва
         прямо перед нажатием «Восстановить партию»: партия собиралась, но ячейки
         становились нейтральными, история стиралась, фишки теряли места. */
      case 'resumeInfo': {
        if (room.isHost || m.from === room.selfId) break;
        const info = m.p as { players: GameSession['players']; mapName: string; hostSavedId?: string; taken?: string[] };
        cur.setResumeSnap({
          id: 'remote', name: 'Партия', mapName: info.mapName, code: room.code,
          state: { players: info.players } as GameSession, createdAt: Date.now(),
        });
        /* авто-призыв: подключающийся игрок занимает первую СВОБОДНУЮ роль (не хоста и
           не занятую другими — v0.115). Покрывает типичный случай 2 игроков — вручную
           «Это я» нажимать не нужно. ВАЖНО: сообщаем об этом хосту через claim, иначе
           он не узнает о заявке и отбросит роль при восстановлении. Своя заявка уже
           есть — не переназначаем (иначе гонка ретрансляций перебрасывала бы роли). */
        if (info.hostSavedId && !cur.resumeClaims[cur.selfId]) {
          const taken = info.taken ?? [];
          const guestRole = info.players.find((p) => p.id !== info.hostSavedId && !taken.includes(p.id));
          if (guestRole) {
            cur.setResumeClaim(cur.selfId, guestRole.id);
            room.send('claim', { curId: cur.selfId, savedId: guestRole.id });
          }
        }
        break;
      }
      case 'state': {
        const s = m.p as GameSession;
        if (!s || s.v !== APP_VERSION) {
          cur.toast('Версии игры не совпадают — обновление отклонено', 'err');
          return;
        }
        cur.setSession(s);
        if (cur.screen === 'lobby' && s.phase !== 'lobby') cur.setScreen('game');
        // партия восстановлена/идёт — данные сбора команды больше не нужны
        if (s.phase !== 'lobby' && (cur.resumeSnap || Object.keys(cur.resumeClaims).length)) {
          cur.setResumeSnap(null);
          useApp.setState({ resumeClaims: {} });
        }
        break;
      }
      case 'action': {
        if (!room.isHost) break;
        /* прогресс загрузки данных гостя — служебное сообщение, в движок не идёт */
        if ((m.p as { t?: string })?.t === 'syncProgress') {
          const sp = m.p as { id: string; pct: number };
          useApp.getState().setSync(sp.id, sp.pct);
          break;
        }
        /* v0.100 МИНИ-ИКОНКА игрока — служебное сообщение вне состояния партии:
           хост кладёт в свою карту иконок и ПЕРЕДАЁТ всем остальным (состояние партии
           рассылается целиком на каждом действии — возить в нём картинки нельзя) */
        if ((m.p as { t?: string })?.t === 'picon') {
          const pi = m.p as { id: string; icon?: string };
          useApp.getState().setIcon(pi.id, pi.icon);
          room.send('picon', { id: pi.id, icon: pi.icon });
          break;
        }
        const h = useApp.getState();
        if (h.session && h.sessionMap) {
          const act = m.p as Action;
          const prevA = h.session;
          const next = applyAction(h.session, act, h.sessionMap, h.options);
          h.setSession(next);
          void autosaveSession(next);
          /* v0.163/v0.165: чистый шаг фишки от гостя — лёгкий jpos вместо полного состояния
             (решает тумблер синхронизации в опциях хоста — lightSyncActive) */
          if (act.t === 'journeyMove' && isJourneyMoveOnly(prevA, next) && lightSyncActive(h.options, next)) {
            const jp = next.journeyPos?.[act.id];
            if (jp) queueJpos(room, { id: act.id, x: jp.x, y: jp.y, dir: jp.dir, mv: jp.mv, tp: jp.tp });
            if (h.screen === 'lobby' && next.phase !== 'lobby') h.setScreen('game');
            break;
          }
          jposPending.clear(); // полный state уже несёт свежие позиции — батч не нужен
          if (h.screen === 'lobby' && next.phase !== 'lobby') h.setScreen('game');
          // карту рассылаем только когда она реально нужна/меняется: новому игроку (hello)
          // или при создании задания на лету (setCellTask). Это резко снижает трафик.
          if (act.t === 'hello' || act.t === 'setCellTask') sendBig(room, 'map', h.sessionMap);
          // при подключении игрока хост заранее раздаёт ромы и сохранения карты,
          // чтобы в игре задания открывались у всех мгновенно
          if (act.t === 'hello') void sendLibrary(room, h.sessionMap);
          // если идёт сбор команды для восстановления — гостю нужен сохранённый ростер
          if (act.t === 'hello') {
            const rs = useApp.getState().resumeSnap;
            if (rs) {
              const hostSavedId = rs.state.players.find((p) => p.isHost)?.id;
              const taken = Object.values(useApp.getState().resumeClaims).filter(Boolean);
              room.send('resumeInfo', { players: rs.state.players, mapName: rs.mapName, hostSavedId, taken });
            }
            // v0.100: новичку — все собранные иконки (включая свою, хостовую)
            const hh = useApp.getState();
            const allIcons: Record<string, string | undefined> = { ...hh.icons, [room.selfId]: hh.options.pIcon };
            for (const [pid, ic] of Object.entries(allIcons)) {
              if (ic) room.send('picon', { id: pid, icon: ic });
            }
          }
          room.send('state', next);
          lastStateSentAt = Date.now();
        }
        break;
      }
      /* Гость получил библиотеку ромов/сохранений от хоста — кладёт её в свою базу. */
      case 'library': {
        const lib = m.p as { roms: RomDef[]; saves: SaveDef[]; blobs: Record<string, string> };
        void (async () => {
          for (const r of lib.roms) {
            await idbPut('roms', r.id, r);
            const b = lib.blobs[r.id];
            if (b) await idbPut('blobs', `rom-${r.id}`, b64ToBuf(b));
          }
          for (const sv of lib.saves) await idbPut('saves', sv.id, sv);
          await useApp.getState().refresh();
          if (!room.isHost) reportSync(room, 100);
          useApp.getState().toast('Данные карты загружены от хоста', 'ok');
        })().catch(() => undefined);
        break;
      }
      /* Гость запросил ром/сохранение, которых нет в его IndexedDB — хост отдаёт бинарник. */
      case 'needRom': {
        if (!room.isHost) break;
        const { romId, saveId } = (m.p ?? {}) as { romId?: string; saveId?: string };
        if (!romId) break;
        void (async () => {
          const buf = await getRomData(romId);
          let saveState: unknown = null;
          if (saveId) {
            const sv = await idbGet<unknown>('saves', saveId);
            saveState = (sv as { state?: unknown } | undefined)?.state ?? null;
          }
          sendBig(room, 'romData', {
            romId,
            saveId: saveId ?? null,
            romB64: buf ? bufToB64(buf) : null,
            saveState,
          });
        })();
        break;
      }
      /* Гость получил ром/сохранение от хоста — кладёт в in-memory кэш и перезапускает загрузку. */
      case 'romData': {
        if (room.isHost) break;
        const { romId, saveId, romB64, saveState } = (m.p ?? {}) as {
          romId?: string; saveId?: string | null; romB64?: string | null; saveState?: unknown;
        };
        if (!romId) break;
        if (romB64) {
          useApp.getState().cacheRomData(romId, b64ToBuf(romB64), saveId ?? undefined, saveState);
        } else {
          // у хоста нет этого рома — сообщим, чтобы не ждать вечно
          useApp.getState().toast('У хоста нет этого рома — задание не запустится', 'err');
        }
        break;
      }
      case 'stream': {
        streamBus.emit(m.p as StreamPacket);
        break;
      }
      /* v0.100 МИНИ-ИКОНКА игрока (хост передал гостям; своё хост положил при перехвате) */
      case 'picon': {
        const pi = (m.p ?? {}) as { id?: string; icon?: string };
        if (pi.id) useApp.getState().setIcon(pi.id, pi.icon);
        break;
      }
      /* v0.163: лёгкие обновления движения от хоста — сдвигаем фишку в ЛОКАЛЬНОЙ сессии
         без полной замены состояния (квиз/задание приходят полным state как раньше). */
      case 'jposBatch': {
        if (room.isHost) break; // хост применил позиции сам — своё сообщение ему не нужно
        const list = ((m.p ?? {}) as { list?: JposItem[] }).list ?? [];
        for (const jp of list) applyJposLocal(jp);
        break;
      }
      case 'jpos': {
        if (room.isHost) break;
        applyJposLocal((m.p ?? {}) as JposItem);
        break;
      }
      /* v0.164: подпись состояния от хоста — гость сверяет СО СВОЕЙ копией; любое
         расхождение = «я мог что-то пропустить» → прошу полный state (не чаще 2.5 с). */
      case 'sig': {
        if (room.isHost) break;
        const h = (m.p ?? {}) as { h?: unknown };
        const myS = cur.session;
        if (!myS || typeof h.h !== 'string') break;
        if (markersHash(myS) !== h.h && Date.now() - lastNeedStateAt > 2500) {
          lastNeedStateAt = Date.now();
          room.send('needState', {});
        }
        break;
      }
      /* v0.164: гость просит полный state — хост отдаёт текущую партию целиком. */
      case 'needState': {
        if (!room.isHost) break;
        const sNow = useApp.getState().session;
        if (sNow) {
          room.send('state', sNow);
          lastStateSentAt = Date.now();
        }
        break;
      }
      default:
        break;
    }
  };

  const hubBase = useApp.getState().options.relayHub?.trim();
  room = hubBase
    ? createHubRoom(hubBase, code, isHost, app.selfId, onMsg, (info) => useApp.getState().setNetInfo(info))
    : createRoom(code, isHost, app.selfId, onMsg, (info) => useApp.getState().setNetInfo(info), useApp.getState().options.relay, useApp.getState().options.turn);

  app.boot(room, isHost, initial.session, initial.map);
  /* v0.109 БОГАЧ: у хоста партии открывается «дверь донатов» — локальный
     WebSocket к слушателю (батнику) на компьютере стримера.
     v0.113: ТОЛЬКО если хост уже включил донаты кнопкой в панели — иначе
     браузер при создании комнаты спрашивает доступ к локальной сети,
     и это сбивает с толку. Не включал — вопроса нет. */
  if (isHost && isDoorWanted()) startDoor(code);
  if (initial.session && initial.session.phase !== 'lobby') useApp.getState().setScreen('game');
  if (isHost && initial.session && initial.map) {
    sendBig(room, 'map', initial.map);
    room.send('state', initial.session);
    lastStateSentAt = Date.now();
  }
  /* v0.164: хост начинает сверку партии (гости сверяются по подписи сами) */
  if (isHost) sigBeatStart(room);
  return room;
}
