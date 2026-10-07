/* v0.84.0: ФОНОВАЯ МУЗЫКА С ЯНДЕКС.ДИСКА — ПЛЕЕР 2.0 (по замечаниям заказчика).

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
   (3) «СОВСЕМ РАНДОМНЫЙ РАНДОМ» (галочка в Опциях): новый трек стартует не
       с начала, а со случайного места (в стороне от начала и конца).
   (4) МИКРО-ПЛЕЕР: при старте музыки снизу выезжает плашка с названием
       трека, кнопкой «следующий» и ползунком громкости; уезжает через
       5 секунд; наведение мыши удерживает её на экране.
   (5) ТИШИНА В ОБУЧЕНИИ («Помощь») — экран training добавлен к партийным.
   (6) ПЛЕЙЛИСТ — 9 ТРЕКОВ Dj Berto: Dendy minimix #1–#7 + RetroGame MIX.

   КАК РАБОТАЕТ: треки хранятся на Яндекс.Диске автора (публичные ссылки).
   По публичной ссылке открытый API Диска (cloud-api.yandex.net) отдаёт пря-
   мую ссылку на файл — браузер играет её через один <audio> с Range-стрими-
   нгом (файл не скачивается целиком). Сайт не весит ни байта больше.

   БЕЗ REFERER: Яндекс.Диск отдаёт файлы только запросам без чужого Referer
   (ссылка на наш сайт в запросе = HTTP 403 Invalid Referer) — Referer убран
   мета-тегом no-referrer в index.html (v0.83.1).

   АВТОПЛЕЙ: браузеры запрещают звук до первого действия пользователя —
   музыка стартует после первого клика/клавиши на сайте (initMusic).

   АВТОРСТВО: Dj Berto — promodj.com/berto (кликабельно в Опциях, с
   предупреждением о переходе на внешнюю страницу). */

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

/** Режимы «где играть» (выбор в Опциях). */
export type MusicMode = 'title' | 'everywhere';
type MusicStatus = 'idle' | 'resolving' | 'playing' | 'paused' | 'error';

const LS_VOL = 'rcgMusicVol'; // 0..1, дефолт 0.5
const LS_ON = 'rcgMusicOn'; // '1' | '0', дефолт включена
const LS_MODE = 'rcgMusicMode'; // 'title' | 'everywhere', дефолт title
const LS_WILD = 'rcgMusicWild'; // '1' | '0', дефолт выключен

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

/* Экраны, где музыка МОЛЧИТ в режиме «везде»: весь партийный контур
   (создание игры, подключение, лобби, партия), запуск ромов и ОБУЧЕНИЕ
   («Помощь») — по решению заказчика. */
const SILENT_SCREENS: readonly string[] = ['create', 'join', 'lobby', 'game', 'emulator', 'training'];

interface MusicState {
  enabled: boolean;
  mode: MusicMode;
  volume: number;
  wild: boolean; // «совсем рандомный рандом»: новый трек стартует со случайного места
  status: MusicStatus;
  error: string;
  track: string; // название текущего трека (для Опций и микро-плеера)
  setEnabled: (on: boolean) => void;
  setMode: (m: MusicMode) => void;
  setVolume: (v: number) => void;
  setWild: (w: boolean) => void;
  next: () => void; // «Следующий трек» (кнопки в Опциях и в микро-плеере)
}

export const useMusic = create<MusicState>((set) => ({
  enabled: readLS(LS_ON) !== '0',
  mode: readLS(LS_MODE) === 'everywhere' ? 'everywhere' : 'title',
  volume: (() => {
    const raw = readLS(LS_VOL); // ВАЖНО: пусто ≠ 0 — без ключа дефолт 50% (Number('') = 0!)
    if (raw !== '') {
      const n = Number(raw);
      if (Number.isFinite(n) && n >= 0 && n <= 1) return n;
    }
    return 0.5;
  })(),
  wild: readLS(LS_WILD) === '1',
  status: 'idle',
  error: '',
  track: '',
  setEnabled: (on) => {
    writeLS(LS_ON, on ? '1' : '0');
    set({ enabled: on });
    if (!on) {
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
let gesture = false; // был ли первый жест пользователя (снятие блокировки автоплея)
let lastTry = 0; // защита от спама запросов к Диску
let failStreak = 0; // подряд неудачных стартов (успех обнуляет)
let recovering = false; // внутри цепочки авто-восстановления
let savedPos = 0; // место трека на паузе/сбое — продолжить с него

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
    handlePlaybackFailure('файл не загрузился с Диска');
  });
  return audio;
}

function pauseAudio() {
  try {
    if (audio && !audio.paused && audio.currentTime > 0) savedPos = audio.currentTime;
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

/** Длительность текущего src (ждёт loadedmetadata, максимум 8 с). */
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

/** Поставить позицию (после того как метаданные файла стали известны). */
async function seekTo(a: HTMLAudioElement, pos: number): Promise<void> {
  const dur = await metaDuration(a);
  if (!Number.isFinite(dur)) return;
  if (pos >= dur - 3) pos = 0; // почти конец — начинаем заново
  try {
    a.currentTime = pos;
  } catch {
    /* не критично: играет с того места, где возможно */
  }
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

/** Центральный старт трека. fresh = трек начинается заново (начало/случайное
 *  место при wild); !fresh = продолжение того же трека с места паузы/сбоя. */
async function playTrack(idx: number, fresh: boolean): Promise<void> {
  const st = useMusic.getState();
  if (!st.enabled || !gesture || !allowedNow()) return;
  if (idx < 0 || idx >= SOURCES.length) idx = Math.floor(Math.random() * SOURCES.length);
  if (!fresh && Date.now() - lastTry < 15000) return; // не долбим Диск чаще раза в 15 с
  lastTry = Date.now();
  curTrack = idx;
  useMusic.setState({ status: 'resolving', error: '', track: SOURCES[idx].title });
  try {
    const a = getAudio();
    const canReuse = !fresh && srcValid && srcTrack === idx; // продолжение — резолв не нужен
    if (!canReuse) {
      const href = await resolveHref(SOURCES[idx].key);
      if (a.src !== href) a.src = href;
      srcTrack = idx;
      srcValid = true;
      // позиция старта: продолжение — место паузы; новый — 0 или случайное при wild
      if (!fresh) {
        if (savedPos > 0) await seekTo(a, savedPos);
      } else if (useMusic.getState().wild) {
        const dur = await metaDuration(a);
        if (Number.isFinite(dur) && dur > 90) {
          const pos = 30 + Math.random() * (dur - 90); // в стороне от начала и конца
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
    useMusic.setState({ status: 'playing', error: '' });
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
    a.volume = st.volume;
    useMusic.setState({ status: 'resolving' });
    a.play()
      .then(() => useMusic.setState({ status: 'playing', error: '' }))
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
  void playTrack(curTrack < 0 ? Math.floor(Math.random() * SOURCES.length) : curTrack, true);
}

/** Вызывается из App при смене экрана. */
export function musicSync(screen: string): void {
  currentScreen = screen;
  syncPlayback();
}

/** Первый жест пользователя снимает блокировку автоплея — вызывается один раз из App. */
export function initMusic(): void {
  const kick = () => {
    if (gesture) return;
    gesture = true;
    window.removeEventListener('pointerdown', kick);
    window.removeEventListener('keydown', kick);
    syncPlayback();
  };
  window.addEventListener('pointerdown', kick);
  window.addEventListener('keydown', kick);
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
