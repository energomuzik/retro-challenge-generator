import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameMap, GameSession } from '../types';
import { FRENDY_CINE, MAP_MODES, PLAYER_COLORS } from '../types';
import { VERSION } from '../version';
import { frendyCineVoice, makeFrendyAudio } from '../frendyVoice';
import { frendyFrame, frendyPortrait } from '../frendyAssets'; // v0.135: спрайт; v0.137: портрет для новеллы
import { VnText } from './AgentsVn'; // v0.137: печатная машинка — как у агентов
import { useApp } from '../store';
import { sfx } from '../sound';

/* ---------- v0.124 FRENDY: КАТ-СЦЕНЫ И ТИТРЫ (заглушки-анимации, фирменные заменят) ----------
   FrendyIntroCine — интро в начале раунда (когда у карты НЕТ своих кат-сцен «старт»):
   темнота → появляется ФРЕНДИ, произносит фразу (слышат все), исчезает — катсцена кончилась.
   EndCredits — финал партии: (а) FRENDY-победа: печь + кто положил последнюю микросхему +
   фраза Френди + злой смех + он СГОРАЕТ → 2 секунды тишины → титры; (б) титры (все режимы):
   кино-стиль — мелкие фразы медленно появляются и исчезают, благодарственное письмо
   донатерам; во FRENDY в конце — СТИНГЕР: титры замирают, музыка молчит, Френди «ещё
   увидимся» → «ВЫ ПРОШЛИ ИГРУ» → музыка продолжает с того же места.
   ВСЯ информация титров живёт ТОЛЬКО на компе игрока (на сервер не уходит) — после
   завершения показа она больше не нужна.
   ТАЙМИНГ АДАПТИВНЫЙ: сцены листаются по окончании ОЗВУЧКИ (onended) — длительность mp3
   может быть любой; страховочные таймеры (cap) не дают катсцене зависнуть без звука.
   v0.135 ПРОПУСК УБРАН из финала: кнопка «Пропустить» осталась ТОЛЬКО в интро (фраза
   Френди в начале партии — игроки начинают партию много раз). Титры/печь/стингер/
   финал «Секретных материалов» НЕ пропускаются: финал редкий, смотрим целиком —
   всё листается автоматически, кнопок нет. */

const vol = (): number => Math.max(0, Math.min(1, useApp.getState().options.volume ?? 0.8));
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function makeAudio(url: string | null): HTMLAudioElement | null {
  /* v0.133: реплики Френди играются с громкостью из Опций «Голос Френди» (0–150%, усиление WebAudio внутри) */
  return makeFrendyAudio(url);
}

/** Последовательное проигрывание озвучки; onDone — после последней или по капу (страховка).
    v0.125: если автоплей заблокирован (play() отклонён) — НЕ ждём кап целиком, идём дальше
    через 350 мс: катсцена обязана закончиться при любом раскладе (баг v124 — вечное интро). */
function playSeq(urls: (string | null)[], onDone: () => void, capMs = 16000): () => void {
  let cancelled = false;
  let fired = false;
  const fire = () => { if (!cancelled && !fired) { fired = true; onDone(); } };
  const cap = window.setTimeout(fire, capMs);
  let audio: HTMLAudioElement | null = null;
  const playAt = (i: number) => {
    if (cancelled) return;
    if (i >= urls.length || !urls[i]) { fire(); return; }
    const a = makeAudio(urls[i]);
    if (!a) { playAt(i + 1); return; }
    audio = a;
    let advanced = false;
    const next = () => { if (!advanced && !cancelled) { advanced = true; playAt(i + 1); } };
    a.onended = next;
    try {
      const p = a.play();
      if (p && typeof p.catch === 'function') p.catch(() => { window.setTimeout(next, 350); });
    } catch { window.setTimeout(next, 350); }
  };
  playAt(0);
  return () => { cancelled = true; clearTimeout(cap); try { audio?.pause(); } catch { /* noop */ } };
}

/* v0.131: СМЕХ УДАЛЁН — заказчик перезаписал все фразы, смех ВШИТ В КАЖДУЮ ФРАЗУ
   (отдельные треки laugh-0/1 удалены из ассетов и кода). */

/* ---------- ФИГУРА ФРЕНДИ (стоящий спрайт — осталась только в badend) ---------- */
/* v0.135: ФРЕНДИ — СПРАЙТ (src/frendyAssets) вместо CSS-заглушки. Канонический облик:
   сутулый мужчина в оливковой рабочей куртке с жетоном-слоном и POWER GLOVE с шипами.
   v0.137: «дыхание» (смена кадров 460 мс) УДАЛЕНО совсем — Френди стоит статично
   (заказ: «дыхания у Френди не должно быть, даже когда стоит в игре»); при burning
   кадр затемняется и обгорает (CSS .frendy-fig.burning сверху добавляет огонь 🔥).
   Крупные сцены (интро/печь/стингеры) больше НЕ используют фигуру — они в формате
   новеллы: FrendyVnScene (портрет слева + диалог), как у Салли и Молдера. */
function FrendyFigure({ size = 190, burning = false }: { size?: number; burning?: boolean }) {
  const im = frendyFrame(false, 0); // v0.137: статичная стойка — дыхания больше нет
  return (
    <div className={`frendy-fig relative ${burning ? 'burning' : ''}`} style={{ width: size, height: size * 1.3 }}>
      {im && (
        <img
          src={im.src}
          alt="Френди"
          draggable={false}
          className="absolute left-1/2 bottom-0 -translate-x-1/2 h-full w-auto max-w-none"
          style={{ filter: burning ? 'brightness(0.55) saturate(1.35) sepia(0.3) hue-rotate(-20deg)' : undefined }}
        />
      )}
      {burning && (
        <>
          <span className="ff-flame" style={{ left: '8%', fontSize: size * 0.3 }}>🔥</span>
          <span className="ff-flame" style={{ left: '42%', fontSize: size * 0.38, animationDelay: '0.3s' }}>🔥</span>
          <span className="ff-flame" style={{ right: '6%', fontSize: size * 0.28, animationDelay: '0.6s' }}>🔥</span>
          <span className="ff-flame" style={{ left: '24%', bottom: '22%', fontSize: size * 0.22, animationDelay: '0.45s' }}>🔥</span>
        </>
      )}
    </div>
  );
}

/* ---------- v0.137 ФРЕНДИ В ФОРМАТЕ НОВЕЛЛЫ (как у Салли и Молдера) ----------
   Портрет СЛЕВА экрана + реплика «машинкой» в том же текстовом боксе, что у агентов,
   плашка «ФРЕНДИ» (красная). Никакой фигуры и «дыхания» — заказ: крупные фразы
   (фраза в начале, сожгли в печи, стингеры) — в том же формате диалога, что у агентов.
   Фразочки ВНУТРИ игры (крик-плашки охоты) не тронуты — как и было. */
function FrendyVnScene({ text }: { text: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* ПОРТРЕТ: слева, как Салли у агентов (портрет анфас — зеркало не нужно) */}
      <div className="absolute bottom-[27%] left-[2%] md:left-[6%]">
        <img
          src={frendyPortrait()}
          alt="Френди"
          className="h-[58vh] md:h-[64vh] max-w-none drop-shadow-[0_12px_28px_rgba(0,0,0,0.8)]"
          draggable={false}
        />
      </div>
      {/* Плашка имени над текстовым боксом */}
      <div className="absolute bottom-[24.5%] left-[7%]">
        <span className="font-display uppercase tracking-wider text-[13px] px-3 py-1 border-2 pixel-corners text-[#ff5d73] border-[#ff5d73] bg-[rgba(20,4,8,0.85)]">ФРЕНДИ</span>
      </div>
      {/* ТЕКСТОВЫЙ БОКС — тот же, что у агентов (печатная машинка) */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[94%] max-w-3xl border-[3px] border-edge bg-[rgba(6,8,18,0.93)] pixel-corners px-5 py-4">
        <div className="text-[14px] md:text-[15px] text-paper leading-snug min-h-[3.4em]">
          <VnText text={text} speed={30} />
        </div>
        <div className="mt-2 font-pixel text-[9px] text-faint uppercase tracking-wider">Френди · Тайные материалы</div>
      </div>
    </div>
  );
}

/* ---------- ИНТРО (начало раунда FRENDY без своих кат-сцен) ---------- */
export function FrendyIntroCine({ onDone }: { onDone: () => void }) {
  const [stage, setStage] = useState(0); // 0 темнота, 1 Френди, 2 уход
  const phrase = useMemo(() => pick(FRENDY_CINE.intro), []); // { t, f } — v0.135
  const stopRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    const t0 = window.setTimeout(() => {
      setStage(1);
      sfx.frendySpawn();
      stopRef.current = playSeq(
        [frendyCineVoice('intro', phrase.f)],
        () => setStage(2),
        22000, // страховка: даже без звука катсцена закончится
      );
    }, 900);
    return () => { clearTimeout(t0); stopRef.current?.(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* v0.125 ФИКС БАГА v124: после stage 2 (затемнение) сцена ОБЯЗАНА кончиться — раньше
     onDone не вызывался вовсе, оверлей навсегда закрывал экран и кнопки не нажимались. */
  const doneRef = useRef(false);
  useEffect(() => {
    if (stage < 2 || doneRef.current) return;
    doneRef.current = true;
    stopRef.current?.();
    const t = window.setTimeout(onDone, 850); // 0.7s cine-fadeout + запас
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stage]);
  return (
    <div className={`fixed inset-0 z-[80] flex items-center justify-center bg-black ${stage >= 2 ? 'cine-fadeout' : 'cine-fadein'}`}>
      {/* v0.137: кнопка переехала наверх — внизу теперь текстовый бокс новеллы */}
      <button onClick={() => { stopRef.current?.(); onDone(); }} className="absolute top-4 right-4 z-10 px-3 py-1.5 border-2 border-[#5b2430] text-[#b98490] font-display text-[10px] uppercase tracking-wider hover:text-paper hover:border-[#ff5d73] cursor-pointer bg-[rgba(10,8,12,0.7)]">Пропустить ✕</button>
      {/* v0.137: портрет слева + диалог в формате агентов — фигуры и «дыхания» больше нет */}
      {stage >= 1 && <FrendyVnScene text={phrase.t} />}
    </div>
  );
}

/* ---------- ТИТРЫ + ПОБЕДНАЯ КАТСЦЕНА + СТИНГЕР ---------- */
type CineLine = { t: string; c?: string; style?: React.CSSProperties };
const LINE_MS = 2900; // одна фраза титров

/* Список фраз титров (v0.134: вынесен из EndCredits — тот же список крутится
   в финале «Секретные материалы» после разговора агентов) */
function buildCreditLines(map: GameMap, sess: GameSession, isFrendy: boolean, won: boolean): CineLine[] {
  const out: CineLine[] = [];
  const modeName = MAP_MODES.find((m) => m.id === map.mode)?.name ?? 'РЕТРОПОЛИЯ';
  out.push({ t: 'RETRO CHALLENGE GENERATOR', c: 'font-pixel text-[13px] tracking-[0.35em] text-teal' });
  out.push({ t: map.name || 'Безымянная карта', c: 'font-display uppercase text-base text-paper' });
  out.push({ t: `Режим: ${modeName}`, c: 'font-pixel text-[10px] text-dim' });
  if (isFrendy) {
    out.push(won
      ? { t: 'ВСЕ МИКРОСХЕМЫ СОЖЖЕНЫ — ФРЕНДИ ПОВЕРЖЕН', c: 'font-display uppercase text-sm text-teal' }
      : { t: 'КОШМАР ПОБЕДИЛ…', c: 'font-display uppercase text-sm text-[#ff5d73]' });
    out.push({ t: `Сожжено микросхем: ${sess.frendy?.burned ?? 0} из ${sess.frendy?.total ?? '?'}`, c: 'font-pixel text-[10px] text-dim' });
    const roster = sess.players.filter((p) => !p.spect);
    for (const p of roster) {
      const tasks = (sess.qDone?.[p.id] ?? []).length;
      const caught = sess.frendy?.caught?.[p.id] ?? 0;
      out.push({
        t: `${p.alive ? '🧡' : '💀'} ${p.name} — ${p.alive ? 'ВЫЖИЛ' : 'ПОГИБ'} · заданий пройдено: ${tasks} · поимок Френди: ${caught}`,
        c: 'font-pixel text-[10px]',
        style: { color: PLAYER_COLORS[p.color] ?? '#e8e2d0' },
      });
    }
    if (winnerOf(sess)) out.push({ t: `Последнюю микросхему в печь положил ${winnerOf(sess)!.name}`, c: 'font-display uppercase text-[11px] text-gold' });
  } else if (winnerOf(sess)) {
    out.push({ t: `🏆 ${winnerOf(sess)!.name} — ПОБЕДИТЕЛЬ!`, c: 'font-display uppercase text-base', style: { color: PLAYER_COLORS[winnerOf(sess)!.color] ?? '#ffd76a' } });
  } else {
    out.push({ t: 'Партия завершена', c: 'font-display uppercase text-base text-dim' });
  }
  out.push({ t: '— БЛАГОДАРНОСТЬ ДОНАТЕРАМ —', c: 'font-pixel text-[10px] tracking-[0.2em] text-gold' });
  out.push({ t: 'Я благодарю всех донатеров за поддержку моих проектов и начинаний.', c: 'text-[12px] text-paper/90' });
  out.push({ t: 'Особенно Юки Штиль. Он не только поддерживает меня финансово, но и морально. Большое ему спасибо.', c: 'text-[12px] text-paper/90' });
  out.push({ t: 'Спасибо всем тем, кто любит ретро и играет в мои проекты.', c: 'text-[12px] text-paper/90' });
  out.push({ t: 'Желаю ретростримерам здоровья. И поиграйте в мои другие режимы — они классные.', c: 'text-[12px] text-paper/90' });
  out.push({ t: 'Ваш ЭНЕРГО МУЖИК.', c: 'font-display uppercase text-[13px] text-gold' });
  return out;
}

const winnerOf = (sess: GameSession) => sess.players.find((p) => p.id === sess.winner) ?? null;

export function EndCredits({ map, sess, isFrendy, onClose, onEpilogue }: { map: GameMap; sess: GameSession; isFrendy: boolean; onClose: () => void; onEpilogue?: () => void }) {
  const won = !!sess.frendy?.won;
  const [phase, setPhase] = useState<'win1' | 'win2' | 'win3' | 'lose1' | 'roll' | 'sting' | 'stingEnd' | 'done'>(isFrendy && won ? 'win1' : isFrendy ? 'lose1' : 'roll');
  const [idx, setIdx] = useState(0);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const winner = winnerOf(sess);
  const winPhrase = useMemo(() => pick(FRENDY_CINE.win), []);   // { t, f } — v0.135
  const stingPhrase = useMemo(() => pick(FRENDY_CINE.sting), []);
  const losePhrase = useMemo(() => pick(FRENDY_CINE.badend), []); // v0.131: все проиграли — Френди глумится

  /* Список фраз титров (строится один раз; v0.134 — общий с финалом «Секретные материалы») */
  const lines = useMemo<CineLine[]>(() => buildCreditLines(map, sess, isFrendy, won), []);
  /* СТИНГЕР (только FRENDY-победа): после письма, перед финальной строкой версии */
  const stingAt = isFrendy && won ? lines.length : -1;

  /* v0.132 ЭПИЛОГ: в FRENDY-победе после стингера игра НЕ заканчивается —
     вместо закрытия титров вызывается onEpilogue (сцена «Секретные материалы») */
  const finish = () => {
    try { musicRef.current?.pause(); } catch { /* noop */ }
    stopRef.current?.();
    setPhase('done');
    if (isFrendy && won && onEpilogue) onEpilogue();
    else onClose();
  };

  /* v0.132: страховка — при принудительном закрытии (хост запустил эпилог раньше)
     глушим музыку/озвучку титров */
  useEffect(() => () => {
    try { musicRef.current?.pause(); } catch { /* noop */ }
    try { stopRef.current?.(); } catch { /* noop */ }
  }, []);

  /* Музыка титров (вшита в карту) — стартует с титрами. v0.128: громкость —
     ползунок карты (creditsMusicVol, 0..1); у старых карт поля нет — как раньше 0.9 */
  useEffect(() => {
    if (phase !== 'roll' || !map.creditsMusic || musicRef.current) return;
    try {
      const a = new Audio(map.creditsMusic);
      a.volume = Math.min(1, Math.max(0, vol() * (typeof map.creditsMusicVol === 'number' ? map.creditsMusicVol : 0.9)));
      void a.play().catch(() => { /* noop */ });
      musicRef.current = a;
    } catch { /* noop */ }
  }, [phase, map.creditsMusic, map.creditsMusicVol]);

  /* Победная катсцена: печь → Френди сгорает (озвучка по onended) → 2 секунды тишины → титры */
  useEffect(() => {
    if (phase === 'win1') {
      sfx.frendyBurn();
      const t = window.setTimeout(() => setPhase('win2'), 3400);
      return () => clearTimeout(t);
    }
    if (phase === 'win2') {
      stopRef.current = playSeq(
        [frendyCineVoice('win', winPhrase.f)],
        () => setPhase('win3'),
        24000,
      );
      return () => stopRef.current?.();
    }
    if (phase === 'win3') {
      /* v0.134: НОВЫЙ ПОРЯДОК ФИНАЛА FRENDY — после прощальной фразы и 2 секунд тишины
         СРАЗУ появляются агенты (эпилог на карте): разговор → тёмный экран «executive
         producer SERGIO ENERGO» + «to be continued...» → мгновенные титры как в
         «Секретных материалах» → СТИНГЕР → конец игры. Прокрутка титров отсюда больше
         не стартует (она теперь в XFinale, мгновенная — как в сериале). */
      const t = window.setTimeout(() => finish(), 2000); // «проходит 2 секунды»
      return () => clearTimeout(t);
    }
    /* v0.131: ВСЕ ПРОИГРАЛИ (Френди победил) — сначала его глумление (badend), потом титры */
    if (phase === 'lose1') {
      sfx.frendySpawn();
      stopRef.current = playSeq(
        [frendyCineVoice('badend', losePhrase.f)],
        () => setPhase('roll'),
        24000,
      );
      return () => stopRef.current?.();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, winPhrase]);

  /* Прокрутка фраз титров */
  useEffect(() => {
    if (phase !== 'roll') return;
    if (idx === stingAt) {
      setPhase('sting'); // титры замирают, музыка молчит
      return;
    }
    if (idx >= lines.length) {
      const t = window.setTimeout(finish, 1600);
      return () => clearTimeout(t);
    }
    const t = window.setTimeout(() => setIdx((x) => x + 1), LINE_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, idx, lines.length, stingAt]);

  /* СТИНГЕР: музыка замолкает → Френди является → «ВЫ ПРОШЛИ ИГРУ» → музыка с того же места */
  useEffect(() => {
    if (phase !== 'sting') return;
    try { musicRef.current?.pause(); } catch { /* noop */ }
    sfx.frendySpawn();
    stopRef.current = playSeq(
      [frendyCineVoice('sting', stingPhrase.f)],
      () => setPhase('stingEnd'),
      26000,
    );
    return () => stopRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stingPhrase]);
  useEffect(() => {
    if (phase !== 'stingEnd') return;
    try { void musicRef.current?.play().catch(() => { /* noop */ }); } catch { /* noop */ }
    /* v0.133 ФИКС БАГА v0.132: после стингера менялся только ИНДЕКС, а фаза экрана
       оставалась 'stingEnd' — «ВЫ ПРОШЛИ ИГРУ» висело навсегда, до финала и эпилога
       дело не доходило (помогала только кнопка «Пропустить титры» заранее). Теперь
       фаза возвращается в прокрутку: титры показывают хвостовую строку версии,
       после чего finish() сам запускает эпилог (сцена с Альдером и Скаллер). */
    const t = window.setTimeout(() => { setIdx(stingAt + 1); setPhase('roll'); }, 3400); // продолжаем с того же места
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stingAt]);

  /* ---------- ПОКАЗ ---------- */
  if (phase === 'win1' || phase === 'win2' || phase === 'win3' || phase === 'lose1') {
    return (
      <div className="fixed inset-0 z-[80] bg-black flex items-center justify-center cine-fadein">
        {/* v0.135: кнопки «Пропустить» здесь НЕТ — финал смотрим целиком */}
        {phase === 'win1' && (
          <div className="flex flex-col items-center gap-6">
            <div className="relative text-7xl md:text-8xl" style={{ filter: 'drop-shadow(0 0 30px rgba(255,122,26,0.8))' }}>🔥🧱🔥</div>
            <div className="font-display uppercase text-center text-base md:text-xl text-[#ffb257] px-6">{winner ? `${winner.name} кладёт ПОСЛЕДНЮЮ микросхему в печь…` : 'Последняя микросхема летит в печь…'}</div>
          </div>
        )}
        {/* v0.137: прощальная фраза сгоревшего Френди — портрет + диалог, как у агентов */}
        {phase === 'win2' && <FrendyVnScene text={winPhrase.t} />}
        {phase === 'win3' && <div className="w-full h-full bg-black" />}
        {phase === 'lose1' && (
          <div className="flex flex-col items-center gap-5">
            <FrendyFigure size={210} />
            <div className="font-display uppercase text-center text-base md:text-xl text-[#ff5d73] px-6" style={{ textShadow: '0 0 14px rgba(255,45,45,0.55)' }}>КОШМАР ПОБЕДИЛ…</div>
            <div className="font-display uppercase text-center text-lg md:text-2xl text-[#ff5d73] px-6" style={{ textShadow: '0 0 18px rgba(255,45,45,0.8)' }}>«{losePhrase.t}»</div>
          </div>
        )}
      </div>
    );
  }

  if (phase === 'sting' || phase === 'stingEnd') {
    return (
      <div className="fixed inset-0 z-[80] bg-black flex items-center justify-center">
        {/* v0.135: кнопки «Пропустить» на стингере больше НЕТ (и v0.133-хвост убран) */}
        {/* v0.137: стингер — портрет слева + диалог в формате агентов */}
        {phase === 'sting' && <FrendyVnScene text={stingPhrase.t} />}
        {phase === 'stingEnd' && (
          <div className="font-pixel uppercase tracking-[0.4em] text-teal text-xl md:text-3xl" style={{ textShadow: '0 0 22px rgba(46,230,168,0.7)' }}>ВЫ ПРОШЛИ ИГРУ</div>
        )}
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black flex items-center justify-center cine-fadein">
      {/* v0.135: кнопку «Пропустить титры» убрали — титры крутятся сами */}
      <div className="text-center px-6 max-w-2xl">
        {idx < lines.length ? (
          <div key={idx} className={`cine-line ${lines[idx].c ?? 'text-[12px] text-dim'}`} style={lines[idx].style}>{lines[idx].t}</div>
        ) : (
          <div className="font-pixel text-[10px] text-faint tracking-[0.3em]">RETRO CHALLENGE GENERATOR · v{VERSION}</div>
        )}
      </div>
    </div>
  );
}

/* ---------- v0.134 ФИНАЛ «СЕКРЕТНЫЕ МАТЕРИАЛЫ» — после разговора агентов ----------
   Порядок финала FRENDY-победы по заказу: сжигание + прощальная фраза → АГЕНТЫ и
   разговор (эпилог на карте) → ТЁМНЫЙ ЭКРАН: по центру «пишущей машинкой» печатается
   «executive producer SERGIO ENERGO» (как «executive producer CHRIS CARTER» в сериале),
   в левом углу «to be continued...» → ТИТРЫ как в «Секретных материалах»: тот же шрифт,
   тот же размер, тот же цвет, чёрный фон, строки появляются и исчезают МГНОВЕННО (без
   плавного фейда) → СТИНГЕР Френди → «ВЫ ПРОШЛИ ИГРУ» → конец игры.
   Шрифт — пишущая машинка (Courier), цвет — бледно-белый, фон — чёрный. */
const XF_FONT = '"Courier New", "Courier", monospace';
const XF_COLOR = '#e8e8e8';
const XF_EP_TEXT = 'executive producer SERGIO ENERGO';
const XF_TBC_TEXT = 'to be continued...';
const XF_TYPE_MS = 72;     // один символ «машинки»
const XF_TBC_MS = 3000;    // сколько держится «to be continued...»
const XF_LINE_MS = 1900;   // строка титров на экране
const XF_GAP_MS = 300;     // чёрный пробел между строками (мгновенная смена)

export function XFinale({ map, sess, onDone }: { map: GameMap; sess: GameSession; onDone: () => void }) {
  const [phase, setPhase] = useState<'type' | 'tbc' | 'credits' | 'sting' | 'stingEnd'>('type');
  const [typed, setTyped] = useState(0);   // сколько символов напечатано
  const [idx, setIdx] = useState(0);
  const [lineOn, setLineOn] = useState(true);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const doneRef = useRef(false);
  const stingPhrase = useMemo(() => pick(FRENDY_CINE.sting), []); // { t, f } — v0.135
  const lines = useMemo(() => {
    const out = buildCreditLines(map, sess, true, true);
    out.push({ t: `RETRO CHALLENGE GENERATOR · v${VERSION}` }); // финальная строка — перед стингером
    return out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const finish = () => {
    if (doneRef.current) return;
    doneRef.current = true;
    try { musicRef.current?.pause(); } catch { /* noop */ }
    try { stopRef.current?.(); } catch { /* noop */ }
    onDone();
  };

  /* страховка: при размонтировании глушим музыку/озвучку */
  useEffect(() => () => {
    try { musicRef.current?.pause(); } catch { /* noop */ }
    try { stopRef.current?.(); } catch { /* noop */ }
  }, []);

  /* «МАШИНКА»: печатаем «executive producer SERGIO ENERGO» посимвольно */
  useEffect(() => {
    if (phase !== 'type') return;
    if (typed >= XF_EP_TEXT.length) {
      const t = window.setTimeout(() => setPhase('tbc'), 900);
      return () => clearTimeout(t);
    }
    const t = window.setTimeout(() => setTyped((x) => x + 1), XF_TYPE_MS);
    return () => clearTimeout(t);
  }, [phase, typed]);

  /* «to be continued...» в левом углу — та же машинка, мгновенно появилась */
  useEffect(() => {
    if (phase !== 'tbc') return;
    const t = window.setTimeout(() => setPhase('credits'), XF_TBC_MS);
    return () => clearTimeout(t);
  }, [phase]);

  /* Музыка титров (вшита в карту) — стартует с мгновенных титров, как раньше с прокрутки */
  useEffect(() => {
    if (phase !== 'credits' || !map.creditsMusic || musicRef.current) return;
    try {
      const a = new Audio(map.creditsMusic);
      a.volume = Math.min(1, Math.max(0, vol() * (typeof map.creditsMusicVol === 'number' ? map.creditsMusicVol : 0.9)));
      void a.play().catch(() => { /* noop */ });
      musicRef.current = a;
    } catch { /* noop */ }
  }, [phase, map.creditsMusic, map.creditsMusicVol]);

  /* ТИТРЫ «как в Секретных материалах»: строка появилась МГНОВЕННО → держится →
     исчезла МГНОВЕННО (чёрный пробел) → следующая. Никаких фейдов. */
  useEffect(() => {
    if (phase !== 'credits') return;
    if (idx >= lines.length) { setPhase('sting'); return; }
    if (lineOn) {
      const t = window.setTimeout(() => setLineOn(false), XF_LINE_MS);
      return () => clearTimeout(t);
    }
    const t = window.setTimeout(() => { setIdx((x) => x + 1); setLineOn(true); }, XF_GAP_MS);
    return () => clearTimeout(t);
  }, [phase, idx, lineOn, lines.length]);

  /* СТИНГЕР: музыка замолкает → Френди является с прощальной фразой */
  useEffect(() => {
    if (phase !== 'sting') return;
    try { musicRef.current?.pause(); } catch { /* noop */ }
    sfx.frendySpawn();
    stopRef.current = playSeq(
      [frendyCineVoice('sting', stingPhrase.f)],
      () => setPhase('stingEnd'),
      26000,
    );
    return () => stopRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stingPhrase]);

  /* «ВЫ ПРОШЛИ ИГРУ» → конец игры (финальная панель ПОБЕДЫ) */
  useEffect(() => {
    if (phase !== 'stingEnd') return;
    try { void musicRef.current?.play().catch(() => { /* noop */ }); } catch { /* noop */ }
    const t = window.setTimeout(() => finish(), 3400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  const xfText = (extra?: React.CSSProperties): React.CSSProperties => ({
    fontFamily: XF_FONT, color: XF_COLOR, ...extra,
  });

  /* тёмный экран «машинки» (до титров) */
  if (phase === 'type' || phase === 'tbc') {
    return (
      <div className="fixed inset-0 z-[80] bg-black">
        {/* v0.135: без кнопки «Пропустить» — финал смотрим целиком, как серию */}
        <div className="absolute inset-0 flex items-center justify-center px-6">
          <div className="text-center text-[17px] md:text-[21px] tracking-wide" style={xfText({})}>
            {XF_EP_TEXT.slice(0, typed)}
            {typed < XF_EP_TEXT.length && <span className="inline-block w-[0.6em] h-[1.1em] align-[-0.15em] ml-0.5 blink-hard" style={{ background: XF_COLOR }} />}
          </div>
        </div>
        {phase === 'tbc' && (
          <div className="absolute left-5 bottom-7 md:left-8 md:bottom-10 text-[15px] md:text-[19px]" style={xfText({})}>{XF_TBC_TEXT}</div>
        )}
      </div>
    );
  }

  /* мгновенные титры */
  if (phase === 'credits') {
    return (
      <div className="fixed inset-0 z-[80] bg-black">
        {/* v0.135: без кнопки «Пропустить» — титры крутятся сами */}
        <div className="absolute inset-0 flex items-center justify-center px-6">
          {lineOn && idx < lines.length ? (
            <div key={idx} className="text-center text-[16px] md:text-[20px] leading-relaxed max-w-3xl whitespace-pre-line" style={xfText({})}>{lines[idx].t}</div>
          ) : null}
        </div>
      </div>
    );
  }

  /* стингер + «ВЫ ПРОШЛИ ИГРУ» — как в EndCredits, но после титров-машинки */
  return (
    <div className="fixed inset-0 z-[80] bg-black flex items-center justify-center">
      {/* v0.135: без кнопки «Пропустить» */}
      {/* v0.137: стингер — портрет слева + диалог в формате агентов */}
      {phase === 'sting' && <FrendyVnScene text={stingPhrase.t} />}
      {phase === 'stingEnd' && (
        <div className="font-pixel uppercase tracking-[0.4em] text-teal text-xl md:text-3xl" style={{ textShadow: '0 0 22px rgba(46,230,168,0.7)' }}>ВЫ ПРОШЛИ ИГРУ</div>
      )}
    </div>
  );
}
