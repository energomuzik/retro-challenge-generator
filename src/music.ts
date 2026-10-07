/* v0.85.0: ФОНОВАЯ МУЗЫКА С ЯНДЕКС.ДИСКА — ПЛЕЕР 2.1 (по замечаниям заказчика).

   ЧТО НОВОГО:
   (1) МУЗЫКА БОЛЬШЕ НЕ СБРАСЫВАЕТСЯ ПРИ ПЕРЕХОДАХ: уходя в тишину (партия,
       подключение, создание, запуск ромов, ОБУЧЕНИЕ), плеер ставит трек на
       паузу и запоминает место; вернулись в разрешённый экран — трек
       продолжается С ТОГО ЖЕ МЕСТА. Прямая ссылка Диска берётся заново
       только когда трек действительно начинается заново (первый старт,
       кнопка «Следующий», окончание трека, сбой) — presigned-ссылки
       недолговечны, поэтому они никогда не кэшируются надолго.
   (2) ТРЕКИ ИДУТ В СЛУЧАЙНОМ ПОРЯДКЕ: каждый следующий трек выбирается
       случайно и не повторяет предыдущий (раньше треки шли по кругу по
       порядку, и за сессию почти всегда звучал один и тот же).
   (3) «СОВСЕМ РАНДОМНЫЙ РАНДОМ» (галочка в Опциях) — УЛУЧШЕННЫЙ РАНДОМ:
       новый трек стартует не с начала, а со случайного места, И раз в
       3–7 минут мелодия сама переключается на другой случайный трек в
       случайном месте.
   (4) МИКРО-ПЛЕЕР: при старте музыки снизу выезжает плашка с названием
       трека, кнопкой «следующий» и ползунком громкости; уезжает через
       5 секунд; наведение мыши удерживает её на экране.
   (5) ТИШИНА В ОБУЧЕНИИ («Помощь») — экран training добавлен к партийным.
   (6) ПЛЕЙЛИСТ — 9 ТРЕКОВ Dj Berto: Dendy minimix #1–#7 + RetroGame MIX.
   (7) МУЗЫКА ИГРАЕТ С КОМПЬЮТЕРА ИГРОКА: прослушанный трек один раз
       сохраняется в кэш браузера (IndexedDB), и все следующие разы играет
       ЛОКАЛЬНО — без единого скачивания с Диска. Первый раз трек стримится
       с Диска и в это же время докачивается в кэш. Кэш виден в Опциях
       («сколько треков на компьютере и сколько мегабайт») и чистится
       кнопкой. Битый кэш выкидывается сам — трек перезакэшируется с Диска.
   (8) ПОСЛЕ ОБНОВЛЕНИЯ СТРАНИЦЫ (F5) ПЛЕЕР ПРОДОЛЖАЕТ: тот же трек, с того
       же места (позиция пишется каждые 3 секунды). Браузеры запрещают звук
       до первого действия — поэтому после F5 музыка включается после
       первого клика/клавиши; если браузер разрешает автоплей (сайт часто
       посещается) — включается сразу, даже без клика.
   (9) НАСТРОЙКА «ПОСЛЕ ТИШИНЫ»: продолжать ту же мелодию (по умолчанию)
       или включать новую случайную — выбор в Опциях.
   (10) РЕЖИМ «ВЕЗДЕ, КРОМЕ…» — ТЕПЕРЬ ПО УМОЛЧАНИЮ (разовая миграция
       сбрасывает старую сохранённую настройку; каждый может выбрать своё).
   (11) ССЫЛКИ НА АВТОРА: сайт promodj.com/berto И YouTube-канал
       @DJ_Berto — кликабельны в Опциях, с предупреждением о переходе.

   КАК РАБОТАЕТ: треки хранятся на Яндекс.Диске автора (публичные ссылки).
   По публичной ссылке открытый API Диска (cloud-api.yandex.net) отдаёт пря-
   мую ссылку на файл — браузер играет её через один <audio> с Range-стрими-
   нгом (файл не скачивается целиком). Сайт не весит ни байта больше.

   БЕЗ REFERER: Яндекс.Диск отдаёт файлы только запросам без чужого Referer
   (ссылка на наш сайт в запросе = HTTP 403 Invalid Referer) — Referer убран
   мета-тегом no-referrer в index.html (v0.83.1).

   АВТОПЛЕЙ: браузеры запрещают звук до первого действия пользователя —
   музыка стартует после первого клика/клавиши на сайте (initMusic).

   АВТОРСТВО: Dj Berto — promodj.com/berto и youtube.com/@DJ_Berto
   (кликабельно в Опциях, с предупреждением о переходе на внешнюю страницу). */

import { create } from 'zustand';

/* Публичные ссылки на треки (файлы на Яндекс.Диске, доступ «по ссылке»).
   Хочешь поменять музыку — замени ссылки/файлы на Диске и обнови этот
   список (нужен новый патч). */
const SOURCES: { key: string; title: string }[] = [
  { key: 'https://disk.yandex.ru/d/_84ywlm16JOmMg', title: 'Dj Berto — Dendy NES minimix #3' },
  { key: 'https://disk.yandex.ru/d/fDo0oIbZQeTiVw', title: 'Dj Berto — Dendy (NES) minimix #2' },
  { key: 'https://disk.yandex.ru/d/rUClIQU7209F2w', title: 'Dj Berto — Dendy (NES) minimix #4' },
  { key: 'https://disk.yandex.ru/d/frMv9JWnewLzkw', title: 'Dj Berto — Dendy NES minimix #1' },
  { key: 'https://disk.yandex.ru/d/YmnX59zZ7gL1kQ', title: 'Dj Berto — Dendy NES minimix #5' },
  { key: 'https://disk.yandex.ru/d/g8hdaGXQP_x4Lw', title: 'Dj Berto — Dendy NES minimix #6' },
  { key: 'https://disk.yandex.ru/d/gnKXiA2ok376Vg', title: 'Dj Berto — Dendy NES minimix #7' },
  { key: 'https://disk.yandex.ru/d/y_R1EpB912ovSg', title: 'Dj Berto — RetroGame MIX #2' },
  { key: 'https://disk.yandex.ru/d/f58fqyJC8FA4jw', title: 'Dj Berto — RetroGame MIX #3' },
];

/** Сайт автора музыки (кликабельно в Опциях, с предупреждением о переходе). */
export const MUSIC_AUTHOR_URL = 'https://promodj.com/berto';
/** YouTube-канал автора музыки (v0.84.0 — по просьбе заказчика). */
export const MUSIC_AUTHOR_YT = 'https://www.youtube.com/@DJ_Berto/videos';

/** Режимы «где играть» (выбор в Опциях). */
export type MusicMode = 'title' | 'everywhere';
/** Что включать при выходе из тишины (выбор в Опциях). */
export type MusicResume = 'same' | 'new';
type MusicStatus = 'idle' | 'resolving' | 'playing' | 'paused' | 'error';

const LS_VOL = 'rcgMusicVol'; // 0..1, дефолт 0.5
const LS_ON = 'rcgMusicOn'; // '1' | '0', дефолт включена
const LS_MODE = 'rcgMusicMode'; // 'title' | 'everywhere', дефолт 'everywhere' (v0.84.0)
const LS_WILD = 'rcgMusicWild'; // '1' | '0', дефолт выключен
const LS_RESUME = 'rcgMusicResume'; // 'same' | 'new', дефолт 'new' (v0.87.0)
const LS_POS = 'rcgMusicPos'; // {"t":индекс трека,"p":секунда} — продолжение после F5
const LS_MIG = 'rcgMusicMig'; // отметка разовых миграций настроек

const readLS = (k: string): string => {
  try {
    return localStorage.getItem(k) ?? '';
  } catch {
    return '';
  }
};
const writeLS = (k: string, v: string) => {
  try {
    localStorage.setItem(k, v);
  } catch {
    /* noop */
  }
};

/* РАЗОВАЯ МИГРАЦИЯ v0.87.0 (и раньше — v0.84.0): дефолты музыки приведены
   к просьбе заказчика — «где играть» = «везде, кроме создания игры и
   подключения», «после тишины» = ВКЛЮЧАТЬ НОВУЮ МЕЛОДИЮ, «рандомный
   рандом» = выключен. Старые сохранённые настройки этих трёх пунктов
   сбрасываем один раз; дальше каждый волен выбрать своё. */
if (readLS(LS_MIG) !== '86') {
  try {
    localStorage.removeItem(LS_MODE);
    localStorage.removeItem(LS_RESUME);
    localStorage.removeItem(LS_WILD);
  } catch {
    /* noop */
  }
  writeLS(LS_MIG, '86');
}

/* Восстановление плеера после обновления страницы (F5): читаем, какой
   трек и на какой секунде играли в прошлую сессию. */
let restoreT = -1;
let restoreP = 0;
try {
  const j = JSON.parse(readLS(LS_POS) || '{}') as { t?: unknown; p?: unknown };
  if (typeof j.t === 'number' && Number.isFinite(j.t) && j.t >= 0 && j.t < SOURCES.length) {
    restoreT = j.t;
    if (typeof j.p === 'number' && Number.isFinite(j.p) && j.p > 0) restoreP = j.p;
  }
} catch {
  /* нет записи — начнём со случайного трека */
}

/* Экраны, где музыка МОЛЧИТ в режиме «везде»: весь партийный контур
   (создание игры, подключение, лобби, партия), запуск ромов и ОБУЧЕНИЕ
   («Помощь») — по решению заказчика. */
const SILENT_SCREENS: readonly string[] = ['create', 'join', 'lobby', 'game', 'emulator', 'training'];

/* ---------- кэш на компьютере игрока (IndexedDB) ---------- */

const CACHE_DB = 'rcgMusicCache';
const CACHE_STORE = 'tracks';
let cacheDb: IDBDatabase | null = null;
const cacheInflight = new Set<string>(); // ключи, докачиваемые прямо сейчас

function idbOpen(): Promise<IDBDatabase | null> {
  if (cacheDb) return Promise.resolve(cacheDb);
  return new Promise((res) => {
    try {
      const rq = indexedDB.open(CACHE_DB, 1);
      rq.onupgradeneeded = () => {
        if (!rq.result.objectStoreNames.contains(CACHE_STORE)) rq.result.createObjectStore(CACHE_STORE);
      };
      rq.onsuccess = () => {
        cacheDb = rq.result;
        res(cacheDb);
      };
      rq.onerror = () => res(null);
    } catch {
      res(null);
    }
  });
}

/** Трек из кэша компьютера (null — там его нет, надо брать с Диска). */
async function cacheGet(key: string): Promise<Blob | null> {
  const db = await idbOpen();
  if (!db) return null;
  return new Promise((res) => {
    try {
      const rq = db.transaction(CACHE_STORE, 'readonly').objectStore(CACHE_STORE).get(key);
      rq.onsuccess = () => res((rq.result as Blob | undefined) ?? null);
      rq.onerror = () => res(null);
    } catch {
      res(null);
    }
  });
}

async function cachePut(key: string, blob: Blob): Promise<void> {
  const db = await idbOpen();
  if (!db) return;
  await new Promise<void>((res) => {
    try {
      const rq = db.transaction(CACHE_STORE, 'readwrite').objectStore(CACHE_STORE).put(blob, key);
      rq.onsuccess = () => res();
      rq.onerror = () => res(); // переполнение квоты — просто не кэшим
    } catch {
      res();
    }
  });
  refreshCacheInfo();
}

async function cacheDelete(key: string): Promise<void> {
  const db = await idbOpen();
  if (!db) return;
  await new Promise<void>((res) => {
    try {
      const rq = db.transaction(CACHE_STORE, 'readwrite').objectStore(CACHE_STORE).delete(key);
      rq.onsuccess = () => res();
      rq.onerror = () => res();
    } catch {
      res();
    }
  });
  refreshCacheInfo();
}

async function cacheClearAll(): Promise<void> {
  const db = await idbOpen();
  if (!db) return;
  await new Promise<void>((res) => {
    try {
      const rq = db.transaction(CACHE_STORE, 'readwrite').objectStore(CACHE_STORE).clear();
      rq.onsuccess = () => res();
      rq.onerror = () => res();
    } catch {
      res();
    }
  });
}

/** Сколько треков уже на компьютере и сколько это мегабайт (для Опций). */
function refreshCacheInfo(): void {
  void idbOpen().then((db) => {
    if (!db) return;
    try {
      const rq = db.transaction(CACHE_STORE, 'readonly').objectStore(CACHE_STORE).getAll();
      rq.onsuccess = () => {
        const blobs = (rq.result ?? []) as Blob[];
        let bytes = 0;
        for (const b of blobs) bytes += b?.size ?? 0;
        useMusic.setState({ cacheCount: blobs.length, cacheBytes: bytes });
      };
    } catch {
      /* приватный режим и т.п. — просто без счётчика */
    }
  });
}

/* ---------- стейт для Опций и микро-плеера ---------- */

interface MusicState {
  enabled: boolean;
  mode: MusicMode;
  volume: number;
  wild: boolean; // «совсем рандомный рандом»: случайное место + случайные переключения
  resume: MusicResume; // что играть после выхода из тишины
  status: MusicStatus;
  error: string;
  track: string; // название текущего трека (для Опций и микро-плеера)
  cacheCount: number; // сколько треков уже на компьютере игрока
  cacheBytes: number; // сколько байт занимает кэш
  setEnabled: (on: boolean) => void;
  setMode: (m: MusicMode) => void;
  setVolume: (v: number) => void;
  setWild: (w: boolean) => void;
  setResume: (r: MusicResume) => void;
  clearCache: () => Promise<void>;
  next: () => void; // «Следующий трек» (кнопки в Опциях и в микро-плеере)
}

export const useMusic = create<MusicState>((set) => ({
  enabled: readLS(LS_ON) !== '0',
  mode: readLS(LS_MODE) === 'title' ? 'title' : 'everywhere', // v0.84.0: дефолт «везде, кроме…»
  volume: (() => {
    const raw = readLS(LS_VOL); // ВАЖНО: пусто ≠ 0 — без ключа дефолт 50% (Number('') = 0!)
    if (raw !== '') {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0 && n <= 1) return n;
    }
    return 0.5;
  })(),
  wild: readLS(LS_WILD) === '1',
  resume: readLS(LS_RESUME) === 'same' ? 'same' : 'new', // v0.87.0: дефолт «включать новую мелодию»
  status: 'idle',
  error: '',
  track: '',
  cacheCount: 0,
  cacheBytes: 0,
  setEnabled: (on) => {
    writeLS(LS_ON, on ? '1' : '0');
    set({ enabled: on });
    if (!on) {
      cancelWild();
      pauseAudio();
      useMusic.setState({ status: 'idle', error: '' });
    } else {
      syncPlayback();
    }
  },
  setMode: (m) => {
    writeLS(LS_MODE, m);
    set({ mode: m });
    syncPlayback();
  },
  setVolume: (v) => {
    const nv = Math.max(0, Math.min(1, v));
    writeLS(LS_VOL, String(nv));
    set({ volume: nv });
    try {
      if (audio) audio.volume = nv;
    } catch {
      /* noop */
    }
  },
  setWild: (w) => {
    writeLS(LS_WILD, w ? '1' : '0');
    set({ wild: w }); // действует на следующие новые старты трека
    if (w) scheduleWild(); // и включаем случайные переключения на ходу
    else cancelWild();
  },
  setResume: (r) => {
    writeLS(LS_RESUME, r);
    set({ resume: r });
  },
  clearCache: async () => {
    await cacheClearAll();
    refreshCacheInfo();
  },
  next: () => {
    if (!useMusic.getState().enabled) return;
    void playTrack(randomOther(curTrack), true);
  },
}));

/* ---------- движок ---------- */

let audio: HTMLAudioElement | null = null;
let curTrack = -1; // индекс выбранного трека (-1 = ещё не выбирали)
let srcTrack = -1; // какой трек сейчас залит в audio.src
let srcValid = false; // src жив (после установки не было сбоев)
let currentScreen = 'menu';
let lastTry = 0; // защита от спама запросов к Диску
let failStreak = 0; // подряд неудачных стартов (успех обнуляет)
let recovering = false; // внутри цепочки авто-восстановления
let savedPos = 0; // место трека на паузе/сбое — продолжить с него
let silenced = false; // сейчас в тишине (для настройки «после тишины»)
let wildTimer = 0; // таймер случайного переключения (улучшенный рандом)
let lastBlobUrl = ''; // blob:-URL из кэша (освобождаем при смене трека)
let srcIsBlob = false; // играет ли сейчас файл из кэша компьютера
let lastSave = 0; // троттлинг записи позиции для F5

function getAudio(): HTMLAudioElement {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = 'none';
  /* Главное лекарство от 403 Invalid Referer — мета-тег no-referrer
     в index.html: браузер не посылает Referer на Диск. */
  audio.addEventListener('ended', () => {
    void playTrack(randomOther(curTrack), true);
  });
  audio.addEventListener('error', () => {
    srcValid = false;
    /* Споткнулся файл из кэша — выкидываем его: в следующий раз трек
       снова пойдёт с Диска и перезакэшируется. */
    if (srcIsBlob && curTrack >= 0) void cacheDelete(SOURCES[curTrack].key);
    handlePlaybackFailure('файл не загрузился');
  });
  /* Позиция для продолжения после F5: пишем раз в 3 секунды, пока играет. */
  audio.addEventListener('timeupdate', () => {
    try {
      if (!audio || audio.paused || curTrack < 0) return;
      const now = Date.now();
      if (now - lastSave < 3000) return;
      lastSave = now;
      writeLS(LS_POS, JSON.stringify({ t: curTrack, p: Math.floor(audio.currentTime) }));
    } catch {
      /* noop */
    }
  });
  return audio;
}

function pauseAudio() {
  try {
    if (audio && !audio.paused && audio.currentTime > 0 && curTrack >= 0) {
      savedPos = audio.currentTime;
      writeLS(LS_POS, JSON.stringify({ t: curTrack, p: Math.floor(savedPos) }));
    }
    audio?.pause();
  } catch {
    /* noop */
  }
}

/** Прямая ссылка на файл по публичной ссылке Диска. Открытый API:
 *  ключ не нужен, вход в аккаунт не нужен, CORS разрешает сайтам.
 *  Вызывается при каждом НОВОМ старте трека: presigned-ссылка недолговечна. */
async function resolveHref(key: string): Promise<string> {
  const r = await fetch(
    `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=${encodeURIComponent(key)}`,
  );
  if (!r.ok) throw new Error(`Яндекс.Диск: HTTP ${r.status}`);
  const j = (await r.json()) as { href?: string };
  if (!j.href) throw new Error('Яндекс.Диск: нет прямой ссылки (файл не расшарен?)');
  return j.href;
}

/** Откуда играть трек: С КОМПЬЮТЕРА ИГРОКА (кэш IndexedDB), а если там
 *  его ещё нет — прямая ссылка с Диска (и в фоне сохраним на будущее). */
async function trackSource(idx: number): Promise<string> {
  const key = SOURCES[idx].key;
  const blob = await cacheGet(key);
  if (blob) return URL.createObjectURL(blob);
  const href = await resolveHref(key);
  void cacheDownload(key, href);
  return href;
}

/** Фоновая докачка в кэш: пока трек стримится с Диска, копия целиком
 *  ложится на компьютер — все следующие разы играем локально. */
async function cacheDownload(key: string, href: string): Promise<void> {
  if (cacheInflight.has(key)) return;
  cacheInflight.add(key);
  try {
    const r = await fetch(href);
    if (!r.ok) return;
    const blob = await r.blob();
    if (blob.size < 65536) return; // подозрительно мало для микса — не кэшим мусор
    await cachePut(key, blob);
  } catch {
    /* нет сети или квоты — останется стриминг */
  } finally {
    cacheInflight.delete(key);
  }
}

function allowedNow(): boolean {
  const { mode } = useMusic.getState();
  if (mode === 'title') return currentScreen === 'menu';
  return !SILENT_SCREENS.includes(currentScreen);
}

/** Случайный трек, не равный предыдущему (плейлист из одного элемента — сам он). */
function randomOther(prev: number): number {
  if (SOURCES.length <= 1) return 0;
  let n = Math.floor(Math.random() * SOURCES.length);
  if (n === prev) n = (n + 1 + Math.floor(Math.random() * (SOURCES.length - 1))) % SOURCES.length;
  return n;
}

/** Длительность текущего src (ждёт loadedmetadata, максимум 8 с).
 *  Вызывается только после a.load() — с preload='none' метаданные иначе не приходят. */
function metaDuration(a: HTMLAudioElement): Promise<number> {
  return new Promise((res) => {
    if (Number.isFinite(a.duration) && a.duration > 0) {
      res(a.duration);
      return;
    }
    const t = setTimeout(() => {
      a.removeEventListener('loadedmetadata', ok);
      res(NaN);
    }, 8000);
    const ok = () => {
      clearTimeout(t);
      res(Number.isFinite(a.duration) && a.duration > 0 ? a.duration : NaN);
    };
    a.addEventListener('loadedmetadata', ok, { once: true });
  });
}

/* ---------- улучшенный рандом («Совсем рандомный рандом») ---------- */

function cancelWild(): void {
  if (wildTimer) {
    clearTimeout(wildTimer);
    wildTimer = 0;
  }
}

/** Пока играет музыка с включённой галочкой, раз в 3–7 минут мелодия сама
 *  переключается на другой случайный трек (в случайном месте — это умеет
 *  старт трека при wild). Пауза/тишина — таймер просто перевзводится. */
function scheduleWild(): void {
  cancelWild();
  if (!useMusic.getState().wild) return;
  wildTimer = window.setTimeout(() => {
    wildTimer = 0;
    const st = useMusic.getState();
    if (!st.enabled || !st.wild) return;
    if (audio && !audio.paused && allowedNow()) void playTrack(randomOther(curTrack), true);
    else scheduleWild();
  }, 180000 + Math.random() * 240000);
}

/** Сбой: свежий резолв того же трека с места паузы, потом случайные другие;
 *  после провала всего плейлиста — внятная ошибка и авто-повтор через минуту. */
function handlePlaybackFailure(reason: string): void {
  if (recovering) return;
  const st = useMusic.getState();
  if (!st.enabled || !allowedNow()) return;
  try {
    const t = audio?.currentTime ?? 0;
    if (t > 0) savedPos = t;
  } catch {
    /* noop */
  }
  failStreak++;
  if (failStreak > SOURCES.length) {
    cancelWild();
    useMusic.setState({ status: 'error', error: `Яндекс.Диск не отдаёт треки (${reason}). Попробую ещё раз через минуту` });
    setTimeout(() => {
      if (useMusic.getState().status === 'error' && useMusic.getState().enabled && allowedNow()) {
        failStreak = 0;
        void playTrack(curTrack < 0 ? Math.floor(Math.random() * SOURCES.length) : curTrack, false);
      }
    }, 60000);
    return;
  }
  recovering = true;
  setTimeout(() => {
    recovering = false;
    if (failStreak === 1 && curTrack >= 0) void playTrack(curTrack, false); // тот же трек, с места сбоя
    else void playTrack(randomOther(curTrack), true);
  }, 1200);
}

function markPlaying(): void {
  silenced = false;
  useMusic.setState({ status: 'playing', error: '' });
  scheduleWild();
}

/** Центральный старт трека. fresh = трек начинается заново (начало или
 *  случайное место при wild); !fresh = продолжение с места паузы/сбоя/F5. */
async function playTrack(idx: number, fresh: boolean): Promise<void> {
  const st = useMusic.getState();
  if (!st.enabled || !allowedNow()) return;
  if (idx < 0 || idx >= SOURCES.length) idx = Math.floor(Math.random() * SOURCES.length);
  if (!fresh && Date.now() - lastTry < 15000) return; // не долбим Диск чаще раза в 15 с
  lastTry = Date.now();
  curTrack = idx;
  useMusic.setState({ status: 'resolving', error: '', track: SOURCES[idx].title });
  try {
    const a = getAudio();
    const canReuse = !fresh && srcValid && srcTrack === idx; // продолжение — источник уже в плеере
    if (!canReuse) {
      const url = await trackSource(idx); // кэш компьютера, иначе Диск
      if (a.src !== url) {
        if (lastBlobUrl) {
          try {
            URL.revokeObjectURL(lastBlobUrl);
          } catch {
            /* noop */
          }
          lastBlobUrl = '';
        }
        a.src = url;
        srcIsBlob = url.startsWith('blob:');
        if (srcIsBlob) lastBlobUrl = url;
      }
      srcTrack = idx;
      srcValid = true;
      if (!fresh) {
        // продолжение: с места паузы. Если файл ещё не загружен (preload='none'),
        // это «стартовая позиция» плеера — как только загрузится, попадём сюда.
        if (savedPos > 0) {
          try {
            a.currentTime = savedPos;
          } catch {
            /* не критично */
          }
        }
      } else if (st.wild) {
        // wild: случайное место в стороне от начала и конца
        try {
          a.load(); // preload='none' — просим метаданные явно, чтобы узнать длительность
        } catch {
          /* noop */
        }
        const dur = await metaDuration(a);
        if (Number.isFinite(dur) && dur > 90) {
          const pos = 30 + Math.random() * (dur - 90);
          try {
            a.currentTime = pos;
          } catch {
            /* noop */
          }
        }
      }
    }
    a.volume = useMusic.getState().volume;
    await a.play();
    failStreak = 0;
    markPlaying();
  } catch (e) {
    if (e instanceof DOMException && e.name === 'NotAllowedError') {
      // Браузер ещё не дал звук (нет жеста пользователя) — это не отказ Диска.
      useMusic.setState({ status: 'paused', error: '' });
      return;
    }
    srcValid = false;
    handlePlaybackFailure(e instanceof Error ? e.message : String(e));
  }
}

/** Синхронизация с текущим экраном: играть (продолжая!), если разрешён, иначе тишина. */
function syncPlayback(): void {
  const st = useMusic.getState();
  if (!st.enabled || !allowedNow()) {
    if (audio && !audio.paused && audio.currentTime > 0) {
      try {
        savedPos = audio.currentTime; // запомнить место — вернёмся, продолжим
      } catch {
        /* noop */
      }
    }
    pauseAudio();
    cancelWild();
    if (st.enabled) silenced = true; // вышли в тишину — запомним для «после тишины»
    useMusic.setState({ status: st.enabled ? 'paused' : 'idle' });
    return;
  }
  const a = audio;
  if (a && curTrack >= 0 && srcTrack === curTrack && srcValid) {
    // трек уже в плеере — ПРОДОЛЖАЕМ с того же места, ничего не сбрасывая
    if (!a.paused) {
      useMusic.setState({ status: 'playing' });
      return;
    }
    if (st.resume === 'new' && silenced) {
      // настройка «после тишины включать новую мелодию»
      void playTrack(randomOther(curTrack), true);
      return;
    }
    a.volume = st.volume;
    useMusic.setState({ status: 'resolving' });
    a.play()
      .then(() => markPlaying())
      .catch((e: unknown) => {
        if (e instanceof DOMException && e.name === 'NotAllowedError') {
          useMusic.setState({ status: 'paused', error: '' });
          return;
        }
        srcValid = false;
        handlePlaybackFailure(e instanceof Error ? e.message : String(e));
      });
    return;
  }
  /* После обновления страницы (F5): продолжаем тот же трек с того же места —
     плеер «перезапускается» ровно там, где его остановили. */
  if (curTrack < 0 && restoreT >= 0) {
    const idx = restoreT;
    restoreT = -1;
    savedPos = restoreP;
    void playTrack(idx, false);
    return;
  }
  void playTrack(curTrack < 0 ? Math.floor(Math.random() * SOURCES.length) : curTrack, true);
}

/** Вызывается из App при смене экрана. */
export function musicSync(screen: string): void {
  currentScreen = screen;
  syncPlayback();
}

/** Готовим плеер при загрузке страницы: сразу пробуем включить (некоторые
 *  браузеры разрешают автоплей для часто посещаемых сайтов), иначе — после
 *  первого клика/клавиши (требование всех браузеров). */
export function initMusic(): void {
  const kick = () => {
    window.removeEventListener('pointerdown', kick);
    window.removeEventListener('keydown', kick);
    syncPlayback();
  };
  window.addEventListener('pointerdown', kick);
  window.addEventListener('keydown', kick);
  syncPlayback(); // вдруг автоплей разрешён — заиграет сразу даже без клика
}

/** Проверка плейлиста из Опций — ЧЕСТНАЯ и ПАРАЛЛЕЛЬНАЯ: для каждого трека
 *  резолвим прямую ссылку и читаем метаданные файла (не только ответ API). */
export async function probePlaylist(): Promise<{ ok: number; fail: number }> {
  const results = await Promise.all(
    SOURCES.map(async (s) => {
      try {
        const r = await fetch(
          `https://cloud-api.yandex.net/v1/disk/public/resources/download?public_key=${encodeURIComponent(s.key)}`,
        );
        if (!r.ok) return false;
        const j = (await r.json()) as { href?: string };
        if (!j.href) return false;
        const a = document.createElement('audio');
        a.preload = 'metadata'; // Referer убран мета-тегом no-referrer (index.html)
        a.src = j.href;
        const good = await new Promise<boolean>((res) => {
          const t = setTimeout(() => {
            a.src = '';
            res(false);
          }, 7000);
          a.addEventListener('loadedmetadata', () => {
            clearTimeout(t);
            a.src = '';
            res(true);
          }, { once: true });
          a.addEventListener('error', () => {
            clearTimeout(t);
            a.src = '';
            res(false);
          }, { once: true });
          a.load();
        });
        return good;
      } catch {
        return false;
      }
    }),
  );
  return { ok: results.filter(Boolean).length, fail: results.filter((x) => !x).length };
}

export const MUSIC_TITLES = SOURCES.map((s) => s.title);

/* Счётчик кэша для Опций — посчитаем сразу при загрузке страницы. */
refreshCacheInfo();
