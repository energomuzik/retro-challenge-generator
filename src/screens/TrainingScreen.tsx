import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApp } from '../store';
import { GhostBtn, Ic, PxBtn } from '../ui';
import { sfx } from '../sound';
import { TRAINING, type TSection, type TSlide } from '../trainingData';

/* v0.81 ОБУЧЕНИЕ 2.0 — КАДРЫ-ШАГИ вместо одного снимка.
   Каждый слайд — ПОСЛЕДОВАТЕЛЬНОСТЬ кадров (до 20 снимков полного экрана
   1280×720), снятых с живого интерфейса: видно, как вёл курсор мышки и
   ПОСЛЕ какого клика что-то произошло. Курсор вшит в сами кадры при съёмке,
   никаких стрелок/рамок/аннотаций поверх (v0.80 и старше — слой указателей
   убран целиком). Кадры сменяются автоматически, РАВНОМЕРНО растянутые на
   длительность озвучки слайда: голос рассказывает тот же шаг, что на экране.
   Клик по снимку — следующий кадр вручную. Без mp3 — шаг 2.6 с на кадр.
   v0.80: два КУРСА (игрок / создатель карт), сквозная нумерация слайдов,
   ползунок громкости (localStorage rcgTrainingVol) — сохранены.
   v0.92: ВЫБОР ГОЛОСА ОЗВУЧКИ в шапке окна слайдов — ДМИТРИЙ / КИНАМАН / БЛОГЕРЫ (заглушка:
   записи «Кинамана» и «Блогеров» ещё не заведены — играет Дмитрий, у кнопок бейдж «скоро»);
   выбор запоминается (rcgTrainingVoice), смена голоса перезапускает текущий слайд;
   файлы принимаются и mp3, и FLAC (<раздел>-<номер>.mp3/.flac в voice-kin/, voice-blog/). */

/* URL кадров: Vite собирает всё из src/assets/training (webp), ключ — имя файла */
const IMGS = import.meta.glob('../assets/training/*.webp', { eager: true, import: 'default', query: '?url' }) as Record<string, string>;
const imgOf = (key: string): string | null => {
  const url = IMGS[`../assets/training/${key}.webp`];
  return typeof url === 'string' ? url : null;
};

/* Озвучка: имя файла = `${section.id}-${индексСлайда}.mp3` (или .flac).
   v0.92: голоса — Дмитрий (voice/, пока единственный), Кинаман (voice-kin/) и Ретро блоггеры
   (voice-blog/) — ЗАГЛУШКА выбора: папки будущих записей уже смотрятся glob'ами (и mp3, и FLAC) —
   файлы положим в папку, и выбор заработает без правок кода. У выбранного голоса своего файла нет —
   автоматически играет Дмитрий. ВАЖНО: import.meta.glob — только статические литералы. */
type TVoiceId = 'dm' | 'kin' | 'blog';
const VOICE_LABEL: Record<TVoiceId, string> = { dm: 'Дмитрий', kin: 'Кинаман', blog: 'Блогеры' };
const VOICE_DIR: Record<TVoiceId, string> = { dm: '../assets/training/voice/', kin: '../assets/training/voice-kin/', blog: '../assets/training/voice-blog/' };
const VOICES: Record<string, string> = {
  ...(import.meta.glob('../assets/training/voice/*.mp3', { eager: true, import: 'default', query: '?url' }) as Record<string, string>),
  ...(import.meta.glob('../assets/training/voice/*.flac', { eager: true, import: 'default', query: '?url' }) as Record<string, string>),
  ...(import.meta.glob('../assets/training/voice-kin/*.mp3', { eager: true, import: 'default', query: '?url' }) as Record<string, string>),
  ...(import.meta.glob('../assets/training/voice-kin/*.flac', { eager: true, import: 'default', query: '?url' }) as Record<string, string>),
  ...(import.meta.glob('../assets/training/voice-blog/*.mp3', { eager: true, import: 'default', query: '?url' }) as Record<string, string>),
  ...(import.meta.glob('../assets/training/voice-blog/*.flac', { eager: true, import: 'default', query: '?url' }) as Record<string, string>),
};
/* есть ли у голоса СВОЙ файл этого слайда (для честной подписи внизу) */
const voiceHas = (v: TVoiceId, secId: string, idx: number): boolean => {
  const base = `${secId}-${idx}`, d = VOICE_DIR[v];
  return typeof VOICES[`${d}${base}.mp3`] === 'string' || typeof VOICES[`${d}${base}.flac`] === 'string';
};
/* URL озвучки слайда: у выбранного голоса своего файла нет → играет Дмитрий */
const voiceOf = (v: TVoiceId, secId: string, idx: number): string | null => {
  const base = `${secId}-${idx}`, d = VOICE_DIR[v] ?? VOICE_DIR.dm;
  const hit = VOICES[`${d}${base}.mp3`] ?? VOICES[`${d}${base}.flac`];
  if (typeof hit === 'string') return hit;
  return v === 'dm' ? null : voiceOf('dm', secId, idx);
};

interface PlayItem { slide: TSlide; sec: TSection; si: number }
interface PlayState { title: string; color: string; items: PlayItem[]; idx: number }

/* ---------- v0.80: КУРСЫ — обучение разделено на игрока и создателя карт ----------
   Курс = выбранные разделы ПОДРЯД; слайды нумеруются сквозно по всему курсу.
   v0.81: порядок разделов пересобран по новой программе заказчика — сначала
   знакомство и режимы игры (7 разделов), потом редакторы и карты-примеры (12). */
interface TCourse { id: string; title: string; desc: string; color: string; secs: string[] }
const COURSES: TCourse[] = [
  {
    id: 'player', title: 'Курс игрока', color: '#5aa9ff',
    desc: 'знакомство · старт · режимы · соло — как играть',
    secs: ['intro', 'play', 'retropolia', 'skill', 'quest', 'rubg', 'solo'],
  },
  {
    id: 'creator', title: 'Курс создателя карт', color: '#ff9d5c',
    desc: 'редакторы · задания · квизы · карты-примеры',
    secs: ['editors', 'maped', 'tasks', 'quiz', 'tokens', 'dialogs', 'mk-retropolia', 'mk-journey', 'mk-quest', 'mk-rubg', 'mk-skill', 'extra'],
  },
];
const SEC_BY_ID = new Map(TRAINING.map((s) => [s.id, s]));
const courseSlides = (c: TCourse): TSlide[] => c.secs.flatMap((id) => SEC_BY_ID.get(id)?.slides ?? []);

/* длительность слайда без озвучки: читаемая скорость + шаг на каждый кадр */
const slideDur = (s: TSlide): number =>
  Math.max(6000, Math.min(24000, 3500 + (s.narr ?? s.x).length * 60 + s.frames.length * 1800));

export default function TrainingScreen() {
  const { setScreen } = useApp();

  const [play, setPlay] = useState<PlayState | null>(null);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  /* v0.92: голос озвучки — ДМИТРИЙ / КИНАМАН / БЛОГЕРЫ (заглушка: пока играет Дмитрий),
     выбор запоминается (rcgTrainingVoice) */
  const [voice, setVoice] = useState<TVoiceId>(() => {
    try {
      const raw = localStorage.getItem('rcgTrainingVoice');
      if (raw === 'kin' || raw === 'blog' || raw === 'dm') return raw;
    } catch { /* noop */ }
    return 'dm';
  });
  const voiceRef = useRef<TVoiceId>(voice);
  voiceRef.current = voice;
  const [ownVoice, setOwnVoice] = useState(true); // у выбранного голоса есть свой файл текущего слайда
  /* v0.80: громкость озвучки — ползунок в шапке окна слайдов, запоминается */
  const [vol, setVol] = useState<number>(() => {
    try {
      const raw = localStorage.getItem('rcgTrainingVol'); // ВАЖНО: null ≠ 0 — без ключа дефолт 100%
      if (raw !== null) { const v = Number(raw); if (Number.isFinite(v) && v >= 0 && v <= 1) return v; }
    } catch { /* noop */ }
    return 1;
  });
  const volRef = useRef(vol);
  const [fade, setFade] = useState(false); // плавная смена слайда
  const [voiceOk, setVoiceOk] = useState(true);
  /* v0.81: номер кадра внутри слайда (0..frames.length-1) */
  const [frame, setFrame] = useState(0);
  const epoch = useRef(0); // инвалидация устаревших колбэков озвучки/таймера
  const timer = useRef<number | null>(null);
  const frameTimer = useRef<number | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const stopAudio = useCallback(() => {
    try { audioRef.current?.pause(); } catch { /* noop */ }
    audioRef.current = null;
    if (timer.current !== null) { window.clearTimeout(timer.current); timer.current = null; }
    if (frameTimer.current !== null) { window.clearInterval(frameTimer.current); frameTimer.current = null; }
  }, []);

  const changeVol = useCallback((v: number) => {
    const nv = Math.max(0, Math.min(1, v));
    setVol(nv);
    volRef.current = nv;
    try { localStorage.setItem('rcgTrainingVol', String(nv)); } catch { /* noop */ }
    try { if (audioRef.current) audioRef.current.volume = nv; } catch { /* noop */ }
  }, []);

  /* v0.92: смена голоса — как выключение звука: новая эпоха, текущий слайд перезапускается
     с новой озвучкой (пока у Кинамана/Блогеров файлов нет — играет Дмитрий) */
  const changeVoice = useCallback((v: TVoiceId) => {
    if (v === voiceRef.current) return; // тот же голос — слайд не перезапускаем
    setVoice(v);
    try { localStorage.setItem('rcgTrainingVoice', v); } catch { /* noop */ }
    sfx.click();
    epoch.current += 1;
    setPlay((p) => (p ? { ...p } : p));
  }, []);

  /* ---------- v0.81: проигрывание кадров слайда ----------
     Кадры распределяются РАВНОМЕРНО на длительность озвучки: узнаём duration
     mp3 → интервал = duration/кадров. Пока метаданные не готовы (или звука
     нет) — расчётная длительность слайда. Ручной клик по снимку двигает кадр. */
  const startFrames = useCallback((it: PlayItem, myEpoch: number, audioMs: number | null) => {
    if (frameTimer.current !== null) { window.clearInterval(frameTimer.current); frameTimer.current = null; }
    const n = Math.max(1, it.slide.frames.length);
    const total = audioMs ?? slideDur(it.slide);
    const stepMs = Math.max(900, Math.min(6000, total / n));
    let f = 0;
    setFrame(0);
    if (n === 1) return;
    frameTimer.current = window.setInterval(() => {
      if (epoch.current !== myEpoch) { if (frameTimer.current !== null) { window.clearInterval(frameTimer.current); frameTimer.current = null; } return; }
      f = (f + 1) % n; // кадры идут по кругу, пока звучит озвучка
      setFrame(f);
    }, stepMs);
  }, []);

  /* озвучка слайда + планирование следующего. next() срабатывает РОВНО один раз
     на слайд (сторож onended + таймер могли бы удвоить ход) */
  const narrate = useCallback((it: PlayItem, myEpoch: number) => {
    stopAudio();
    let done = false;
    const next = () => {
      if (done || epoch.current !== myEpoch) return;
      done = true;
      setFade(true);
      window.setTimeout(() => {
        if (epoch.current !== myEpoch) return;
        setPlay((p) => {
          if (!p || epoch.current !== myEpoch) return p;
          if (p.idx + 1 >= p.items.length) return null; // курс закончен → меню
          return { ...p, idx: p.idx + 1 };
        });
        setFade(false);
      }, 420);
    };
    const v = voiceRef.current;
    setOwnVoice(voiceHas(v, it.sec.id, it.si));
    const src = !muted ? voiceOf(v, it.sec.id, it.si) : null;
    setVoiceOk(!!src);
    if (!src) {
      /* mp3 нет (сбой генерации/новый слайд) — листаем по таймеру, подписи остаются */
      startFrames(it, myEpoch, null);
      timer.current = window.setTimeout(next, slideDur(it.slide) + 900);
      return;
    }
    try {
      const a = new Audio(src);
      audioRef.current = a;
      a.volume = volRef.current;
      /* кадры стартуем как только знаем длительность звука — идеальная синхронизация */
      a.onloadedmetadata = () => {
        if (epoch.current === myEpoch && Number.isFinite(a.duration) && a.duration > 0) {
          startFrames(it, myEpoch, a.duration * 1000);
        }
      };
      a.onended = next;
      a.onerror = next;
      a.play().catch(() => next());
      startFrames(it, myEpoch, null); // кадры идут с расчётного шага, duration уточнит их ритм
      /* сторож: если вкладка в фоне тормозит события — ходим по таймеру с запасом */
      timer.current = window.setTimeout(next, Math.max(slideDur(it.slide), 12000) + 45000);
    } catch {
      startFrames(it, myEpoch, null);
      timer.current = window.setTimeout(next, slideDur(it.slide));
    }
  }, [muted, stopAudio, startFrames]);

  /* реакция на смену слайда/раздела/паузы/звука */
  useEffect(() => {
    if (!play) { stopAudio(); return; }
    if (paused) return;
    const it = play.items[play.idx];
    if (!it) { stopAudio(); return; }
    narrate(it, epoch.current);
    return stopAudio; // cleanup при смене зависимости
  }, [play, paused, narrate, stopAudio]);

  /* смена раздела/слайда вручную — новая эпоха */
  const goTo = useCallback((delta: number) => {
    setFade(false);
    setPlay((p) => {
      if (!p) return p;
      const idx = Math.max(0, Math.min(p.items.length - 1, p.idx + delta));
      epoch.current += 1;
      return { ...p, idx };
    });
  }, []);

  /* v0.81: старт — курс (несколько разделов подряд, сквозная нумерация) или один раздел */
  const start = useCallback((what: TSection | TCourse) => {
    sfx.coin();
    stopAudio();
    setPaused(false);
    setFade(false);
    setFrame(0);
    epoch.current += 1;
    const items: PlayItem[] = 'secs' in what
      ? what.secs.flatMap((id) => { const s = SEC_BY_ID.get(id); return s ? s.slides.map((sl, i) => ({ slide: sl, sec: s, si: i })) : []; })
      : what.slides.map((sl, i) => ({ slide: sl, sec: what, si: i }));
    setPlay({ title: what.title, color: what.color, items, idx: 0 });
  }, [stopAudio]);

  const close = useCallback(() => {
    epoch.current += 1;
    stopAudio();
    setPlay(null);
    setPaused(false);
  }, [stopAudio]);

  const togglePause = useCallback(() => {
    setPaused((p) => {
      const np = !p;
      try { if (np) audioRef.current?.pause(); else void audioRef.current?.play(); } catch { /* noop */ }
      if (np && frameTimer.current !== null) { window.clearInterval(frameTimer.current); frameTimer.current = null; }
      return np;
    });
  }, []);

  const toggleMute = useCallback(() => {
    setMuted((m) => {
      const nm = !m;
      try { if (nm) audioRef.current?.pause(); } catch { /* noop */ }
      return nm;
    });
    /* смена звука перезапускает слайд: новая эпоха */
    epoch.current += 1;
    setPlay((p) => (p ? { ...p } : p));
  }, []);

  /* v0.81: клик по снимку — СЛЕДУЮЩИЙ кадр вручную (последний → первый) */
  const stepFrame = useCallback(() => {
    const it = play?.items[play.idx];
    if (!it || it.slide.frames.length < 2) return;
    sfx.hover();
    setFrame((f) => (f + 1) % it.slide.frames.length);
  }, [play]);

  /* Esc — закрыть окно слайдов; ←/→ — листать слайды; пробел — пауза */
  useEffect(() => {
    if (!play) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowLeft') goTo(-1);
      else if (e.key === 'ArrowRight') goTo(1);
      else if (e.key === ' ') { e.preventDefault(); togglePause(); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [play, close, goTo, togglePause]);

  /* уйти с экрана обучения — остановить озвучку */
  useEffect(() => () => { try { audioRef.current?.pause(); } catch { /* noop */ } }, []);

  const cur = play ? play.items[play.idx] : null;
  const frames = cur?.slide.frames ?? [];
  const frameKey = frames[Math.min(frame, frames.length - 1)] ?? frames[0] ?? '';
  const curImg = frameKey ? imgOf(frameKey) : null;
  const pct = play ? Math.round(((play.idx + 1) / play.items.length) * 100) : 0;
  const totalSlides = useMemo(() => TRAINING.reduce((n, s) => n + s.slides.length, 0), []);
  const voiceNote = !voiceOk
    ? 'Этот слайд без озвучки — таймер'
    : voice === 'dm'
      ? 'Озвучка: нейроголос Дмитрий (mp3)'
      : ownVoice
        ? `Озвучка: голос «${VOICE_LABEL[voice]}»`
        : `Голос «${VOICE_LABEL[voice]}» скоро появится — пока говорит Дмитрий`;

  return (
    <div className="h-full crt-grid-bg relative overflow-hidden">
      <div className="absolute inset-0 starfield opacity-60 pointer-events-none" />
      <div className="relative z-10 h-full max-w-4xl mx-auto px-6 py-5 flex flex-col">
        {/* шапка */}
        <div className="flex items-center gap-3 pt-2">
          <GhostBtn onClick={() => { sfx.click(); setScreen('menu'); }}>{Ic.back(14)} Меню</GhostBtn>
          <h1 className="font-pixel text-gold title-glow text-[16px] sm:text-[20px]">ПОМОЩЬ - ОБУЧЕНИЕ</h1>
        </div>
        <p className="mt-2 text-[11px] text-dim font-display uppercase tracking-wider">
          кадры-шаги с живым курсором и озвучкой (голос — в шапке слайдов) · всего {totalSlides} слайдов
        </p>

        {/* v0.80: два курса — слайды каждого курса идут подряд со сквозной нумерацией */}
        <div className="mt-4 grid sm:grid-cols-2 gap-2.5">
          {COURSES.map((c) => (
            <button
              key={c.id}
              onClick={() => start(c)}
              onMouseEnter={() => sfx.hover()}
              className="menu-row w-full text-left flex items-center gap-4 px-5 py-3.5 border-2 border-edge bg-[rgba(19,26,51,0.55)] transition-all hover:bg-panel2"
              style={{ '--rowc': c.color } as React.CSSProperties}
            >
              <span className="shrink-0 font-pixel text-[15px]" style={{ color: c.color }}>{courseSlides(c).length}</span>
              <span className="flex-1 min-w-0">
                <span className="block font-display uppercase tracking-wide text-[14px] text-paper">{c.title}</span>
                <span className="block text-[10.5px] text-faint mt-0.5">{c.desc}</span>
              </span>
              <span className="font-pixel text-[9px]" style={{ color: c.color }}>▶</span>
            </button>
          ))}
        </div>
        <p className="mt-3 mb-0.5 text-[10px] text-faint font-display uppercase tracking-wider">
          или один раздел по темам:
        </p>

        {/* разделы — скроллящийся список кнопок */}
        <div className="mt-4 flex-1 min-h-0 overflow-y-auto pb-4 pr-1">
          <div className="grid sm:grid-cols-2 gap-2.5">
            {TRAINING.map((s, si) => (
              <button
                key={s.id}
                onClick={() => start(s)}
                onMouseEnter={() => sfx.hover()}
                className="menu-row w-full text-left flex items-center gap-4 px-5 py-3 border-2 border-transparent bg-[rgba(19,26,51,0.35)] transition-all hover:bg-panel2"
                style={{ '--rowc': s.color } as React.CSSProperties}
              >
                {/* v0.86: номер пункта по порядку (1, 2, 3…) вместо числа слайдов */}
                <span className="shrink-0 font-pixel text-[13px]" style={{ color: s.color }}>{si + 1}</span>
                <span className="flex-1 min-w-0">
                  <span className="block font-display uppercase tracking-wide text-[14px] text-dim hover:text-paper transition-colors">{s.title}</span>
                  <span className="block text-[10.5px] text-faint mt-0.5">{s.desc}</span>
                </span>
                <span className="font-pixel text-[9px]" style={{ color: s.color }}>▶</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ======== окно просмотра слайдов ======== */}
      {play && cur && (
        <div className="fixed inset-0 z-[90] bg-[rgba(6,9,20,0.93)] backdrop-blur-sm flex flex-col">
          {/* шапка окна */}
          <div className="shrink-0 flex items-center gap-2 px-4 py-3 border-b-2 border-edge bg-[rgba(13,18,38,0.8)]">
            <span className="font-pixel text-[10px]" style={{ color: play.color }}>{play.title.toUpperCase()}</span>
            {/* v0.92: выбор голоса озвучки — ДМИТРИЙ / КИНАМАН / БЛОГЕРЫ (заглушка: у двух последних
                бейдж «скоро», играет Дмитрий); выбор запоминается, смена перезапускает текущий слайд */}
            <span className="ml-2 hidden sm:flex items-center gap-1">
              <span className="font-pixel text-[8px] text-faint">ГОЛОС:</span>
              {(Object.keys(VOICE_LABEL) as TVoiceId[]).map((v) => (
                <button
                  key={v}
                  title={v === 'dm' ? 'Озвучка Дмитрия (нейроголос)' : `Голос «${VOICE_LABEL[v]}» — записи ещё в работе, пока играет Дмитрий`}
                  onClick={() => changeVoice(v)}
                  className={`relative px-1.5 py-0.5 border-2 font-pixel text-[8px] uppercase ${voice === v ? 'text-gold border-gold' : 'text-dim border-edge hover:border-edge2'}`}
                >
                  {VOICE_LABEL[v]}
                  {v !== 'dm' && (
                    <span className="absolute -top-1.5 -right-1.5 px-0.5 text-[7px] leading-none text-magma bg-[rgba(6,9,20,0.85)] border border-magma/60">скоро</span>
                  )}
                </button>
              ))}
            </span>
            <span className="ml-auto font-pixel text-[9px] text-faint">{play.idx + 1} / {play.items.length}</span>
            <button title={paused ? 'Продолжить (пробел)' : 'Пауза (пробел)'} onClick={togglePause}
              className={`px-2 py-1 border-2 border-edge font-pixel text-[10px] ${paused ? 'text-gold border-gold' : 'text-dim'}`}>
              {paused ? '▶' : '❚❚'}
            </button>
            <button title={muted ? 'Включить озвучку' : 'Выключить озвучку'} onClick={toggleMute}
              className={`px-2 py-1 border-2 font-pixel text-[10px] ${muted ? 'text-faint border-edge' : 'text-gold border-gold'}`}>
              {muted ? '🔇' : '🔊'}
            </button>
            {/* v0.80: ползунок громкости озвучки (запоминается) */}
            <span title={`Громкость озвучки: ${Math.round(vol * 100)}%`} className="hidden sm:flex items-center gap-1 px-1">
              <span className="font-pixel text-[9px] text-faint">🔉</span>
              <input
                type="range" min={0} max={1} step={0.05} value={vol}
                onChange={(e) => changeVol(Number(e.target.value))}
                className="w-16 lg:w-24 accent-[#ffcf3f] cursor-pointer"
                aria-label="Громкость озвучки"
              />
              <span className="font-pixel text-[8px] text-faint w-7 text-right">{Math.round(vol * 100)}%</span>
            </span>
            <input
              type="range" min={0} max={1} step={0.05} value={vol}
              onChange={(e) => changeVol(Number(e.target.value))}
              title={`Громкость озвучки: ${Math.round(vol * 100)}%`}
              className="sm:hidden w-14 accent-[#ffcf3f] cursor-pointer"
              aria-label="Громкость озвучки"
            />
            <button title="Закрыть (Esc)" onClick={close} className="px-2 py-1 border-2 border-edge text-dim font-pixel text-[10px] hover:text-paper hover:border-edge2">✕</button>
          </div>

          {/* кадры слайда + подпись */}
          <div className="flex-1 min-h-0 overflow-y-auto flex items-start justify-center px-4 py-4">
            <div className={`w-full max-w-3xl flex flex-col gap-3 transition-opacity duration-300 ${fade ? 'opacity-0' : 'opacity-100'}`}>
              <div className="pixel-panel pixel-corners overflow-hidden bg-[rgba(0,0,0,0.5)] relative">
                {curImg
                  ? <img src={curImg} alt={cur.slide.t} className="w-full h-auto block cursor-pointer" draggable={false} onClick={stepFrame} title="Клик — следующий кадр" />
                  : <div className="h-56 flex flex-col items-center justify-center gap-2 text-faint">
                      <span className="font-pixel text-[12px]">КАДР: {frameKey}</span>
                      <span className="text-[10px]">нет файла src/assets/training/{frameKey}.webp</span>
                    </div>}
                {/* v0.81: счётчик кадров поверх снимка (справа снизу) */}
                {frames.length > 1 && curImg && (
                  <span className="absolute right-2 bottom-2 px-1.5 py-0.5 font-pixel text-[9px] border-2 border-edge bg-[rgba(6,9,20,0.8)] text-dim pointer-events-none">
                    кадр {Math.min(frame, frames.length - 1) + 1}/{frames.length}
                  </span>
                )}
              </div>
              <div className="pixel-panel pixel-corners px-5 py-4">
                <div className="flex items-baseline gap-2 flex-wrap mb-1.5">
                  <div className="font-display uppercase tracking-wide text-[14px]" style={{ color: play.color }}>{cur.slide.t}</div>
                  {/* v0.80: где я нахожусь в курсе — текущий раздел; нумерация сквозная (шапка справа) */}
                  {play.items.length > (cur.sec.slides.length) && (
                    <span className="font-pixel text-[8px] text-faint">раздел {TRAINING.indexOf(cur.sec) + 1}: {cur.sec.title}</span>
                  )}
                  {frames.length > 1 && (
                    <span className="font-pixel text-[8px] text-faint">клик по снимку — следующий кадр</span>
                  )}
                </div>
                <p className="text-[12.5px] leading-relaxed text-paper/90">{cur.slide.x}</p>
              </div>
            </div>
          </div>

          {/* низ: прогресс + навигация */}
          <div className="shrink-0 px-4 py-3 border-t-2 border-edge bg-[rgba(13,18,38,0.8)]">
            <div className="max-w-3xl mx-auto">
              <div className="h-1.5 bg-[rgba(255,255,255,0.08)] overflow-hidden">
                <div className="h-full transition-all duration-500" style={{ width: `${pct}%`, background: play.color }} />
              </div>
              <div className="mt-2.5 flex items-center justify-center gap-3">
                <GhostBtn small onClick={() => goTo(-1)}>‹ Назад</GhostBtn>
                <span className="font-pixel text-[8px] text-faint">{paused ? 'ПАУЗА' : voiceNote.toUpperCase()}</span>
                {play.idx + 1 < play.items.length
                  ? <GhostBtn small onClick={() => goTo(1)}>Далее ›</GhostBtn>
                  : <PxBtn small color="gold" onClick={close}>Готово</PxBtn>}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
