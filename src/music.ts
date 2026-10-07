/* v0.83.0: ФОНОВАЯ МУЗЫКА — плейлист с Яндекс.Диска (по решению заказчика:
   только Яндекс, без вшитых треков). Музыка играет вне партийного контура:
   в главном меню и на всех экранах работы с проектом; молчит при создании
   игры, подключении, в лобби и во время партии, а также в запуске ромов.

   КАК РАБОТАЕТ: треки хранятся на Яндекс.Диске автора (публичные ссылки).
   По публичной ссылке открытый API Диска (cloud-api.yandex.net) отдаёт
   прямую ссылку на файл — браузер играет её через один <audio> с Range-
   стримингом (файл не скачивается целиком). Сайт не весит ни байта больше:
   музыка не вшивается в бандл и не грузится, пока не включена.

   АВТОПЛЕЙ: браузеры запрещают звук до первого действия пользователя —
   музыка стартует после первого клика/клавиши на сайте (initMusic).

   АВТОРСТВО: Dj Berto — Dendy (NES) minimixes. Источник и авторство
   показываются в Опциях (панель «Музыка»). */

import { create } from 'zustand';

/* Публичные ссылки на треки (файлы на Яндекс.Диске, доступ «по ссылке»).
   Хочешь поменять музыку — замени ссылки/файлы на Диске и обнови этот
   список (нужен новый патч). */
const SOURCES: { key: string; title: string }[] = [
  { key: 'https://disk.yandex.ru/d/_84ywlm16JOmMg', title: 'Dj Berto — Dendy NES minimix #3' },
  { key: 'https://disk.yandex.ru/d/fDo0oIbZQeTiVw', title: 'Dj Berto — Dendy (NES) minimix #2' },
  { key: 'https://disk.yandex.ru/d/rUClIQU7209F2w', title: 'Dj Berto — Dendy (NES) minimix #4' },
];

/** Режимы «где играть» (выбор в Опциях). */
export type MusicMode = 'title' | 'everywhere';
type MusicStatus = 'idle' | 'resolving' | 'playing' | 'paused' | 'error';

const LS_VOL = 'rcgMusicVol'; // 0..1, дефолт 0.5
const LS_ON = 'rcgMusicOn'; // '1' | '0', дефолт включена
const LS_MODE = 'rcgMusicMode'; // 'title' | 'everywhere', дефолт title

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
   (создание игры, подключение, лобби, партия) + запуск ромов. */
const SILENT_SCREENS: readonly string[] = ['create', 'join', 'lobby', 'game', 'emulator'];

interface MusicState {
  enabled: boolean;
  mode: MusicMode;
  volume: number;
  status: MusicStatus;
  error: string;
  setEnabled: (on: boolean) => void;
  setMode: (m: MusicMode) => void;
  setVolume: (v: number) => void;
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
  status: 'idle',
  error: '',
  setEnabled: (on) => {
    writeLS(LS_ON, on ? '1' : '0');
    set({ enabled: on });
    if (!on) {
      pauseAudio();
      useMusic.setState({ status: 'idle' });
    } else {
      void playCurrent(true);
    }
  },
  setMode: (m) => {
    writeLS(LS_MODE, m);
    set({ mode: m });
    void syncPlayback();
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
}));

/* ---------- движок ---------- */

let audio: HTMLAudioElement | null = null;
let curTrack = -1; // индекс текущего трека (-1 = ещё не выбирали)
let currentScreen = 'menu';
let gesture = false; // был ли первый жест пользователя (снятие блокировки автоплея)
let lastTry = 0; // защита от спама ретраев при лежащем Диске

function getAudio(): HTMLAudioElement {
  if (audio) return audio;
  audio = new Audio();
  audio.preload = 'none';
  audio.addEventListener('ended', () => {
    nextTrack();
  });
  audio.addEventListener('error', () => {
    useMusic.setState({ status: 'error', error: 'файл не проигрался (сеть?)' });
  });
  return audio;
}

function pauseAudio() {
  try {
    audio?.pause();
  } catch {
    /* noop */
  }
}

/** Прямая ссылка на файл по публичной ссылке Диска. Открытый API:
 *  ключ не нужен, вход в аккаунт не нужен, CORS разрешает сайтам. */
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

async function playCurrent(force = false): Promise<void> {
  const st = useMusic.getState();
  if (!st.enabled || !gesture) return;
  if (!allowedNow()) return;
  if (!force && Date.now() - lastTry < 15000) return; // после ошибки не долбим Диск чаще раза в 15 с
  lastTry = Date.now();
  useMusic.setState({ status: 'resolving' });
  try {
    if (curTrack < 0) curTrack = Math.floor(Math.random() * SOURCES.length); // первый трек — случайный
    const href = await resolveHref(SOURCES[curTrack].key);
    const a = getAudio();
    if (a.src !== href) a.src = href;
    a.volume = useMusic.getState().volume;
    await a.play();
    useMusic.setState({ status: 'playing', error: '' });
  } catch (e) {
    // Отказ play() без жеста или сеть — тихо; статус покажем в Опциях.
    useMusic.setState({ status: 'error', error: e instanceof Error ? e.message : String(e) });
  }
}

function nextTrack(): void {
  if (SOURCES.length === 0) return;
  curTrack = (curTrack + 1) % SOURCES.length;
  if (audio) audio.removeAttribute('src'); // сброс буфера предыдущего трека
  void playCurrent(true);
}

/** Синхронизация с текущим экраном: играть, если экран разрешён, иначе тишина. */
function syncPlayback(): Promise<void> {
  const st = useMusic.getState();
  if (!st.enabled || !allowedNow()) {
    pauseAudio();
    useMusic.setState({ status: st.enabled ? 'paused' : 'idle' });
    return Promise.resolve();
  }
  return playCurrent();
}

/** Вызывается из App при смене экрана. */
export function musicSync(screen: string): void {
  currentScreen = screen;
  void syncPlayback();
}

/** Первый жест пользователя снимает блокировку автоплея — вызывается один раз из App. */
export function initMusic(): void {
  const kick = () => {
    if (gesture) return;
    gesture = true;
    window.removeEventListener('pointerdown', kick);
    window.removeEventListener('keydown', kick);
    void syncPlayback();
  };
  window.addEventListener('pointerdown', kick);
  window.addEventListener('keydown', kick);
}

/** Проверка плейлиста из Опций: сколько источников отвечает. */
export async function probePlaylist(): Promise<{ ok: number; fail: number }> {
  let ok = 0;
  let fail = 0;
  for (const s of SOURCES) {
    try {
      const r = await fetch(
        `https://cloud-api.yandex.net/v1/disk/public/resources?public_key=${encodeURIComponent(s.key)}`,
      );
      if (r.ok) ok++;
      else fail++;
    } catch {
      fail++;
    }
  }
  return { ok, fail };
}

export const MUSIC_TITLES = SOURCES.map((s) => s.title);
