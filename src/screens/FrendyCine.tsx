import { useEffect, useMemo, useRef, useState } from 'react';
import type { GameMap, GameSession } from '../types';
import { FRENDY_CINE, MAP_MODES, PLAYER_COLORS } from '../types';
import { VERSION } from '../version';
import { frendyCineVoice } from '../frendyVoice';
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
   может быть любой; страховочные таймеры (cap) не дают катсцене зависнуть без звука. */

const vol = (): number => Math.max(0, Math.min(1, useApp.getState().options.volume ?? 0.8));
const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];

function makeAudio(url: string | null): HTMLAudioElement | null {
  if (!url) return null;
  try {
    const a = new Audio(url);
    a.volume = vol();
    return a;
  } catch { return null; }
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

/* ---------- ФИГУРА ФРЕНДИ (рисованная заглушка на CSS) ---------- */
function FrendyFigure({ size = 190, burning = false }: { size?: number; burning?: boolean }) {
  return (
    <div className={`frendy-fig relative ${burning ? 'burning' : ''}`} style={{ width: size, height: size * 1.18 }}>
      {/* шляпа-федора */}
      <div className="absolute left-1/2 -translate-x-1/2" style={{ top: 0, width: size * 0.78, height: size * 0.2, background: 'linear-gradient(180deg,#17141a,#0a090c)', borderRadius: '46% 46% 12% 12%', boxShadow: 'inset 0 -6px 12px rgba(255,45,45,0.16)' }} />
      <div className="absolute left-1/2 -translate-x-1/2" style={{ top: size * 0.16, width: size * 1.04, height: size * 0.075, background: '#0a090c', borderRadius: '50%' }} />
      {/* лицо-тень */}
      <div className="absolute left-1/2 -translate-x-1/2" style={{ top: size * 0.2, width: size * 0.66, height: size * 0.42, background: 'linear-gradient(180deg,#241d20 0%,#120e11 70%)', borderRadius: '38% 38% 30% 30%' }} />
      {/* глаза — красное свечение */}
      <div className="ff-eyes absolute" style={{ top: size * 0.33, left: size * 0.3, width: size * 0.13, height: size * 0.07, background: 'radial-gradient(circle,#ff3b2f 0%,#7a0d08 60%,transparent 100%)', borderRadius: '50%', boxShadow: '0 0 18px 6px rgba(255,60,40,0.75)' }} />
      <div className="ff-eyes absolute" style={{ top: size * 0.33, right: size * 0.3, width: size * 0.13, height: size * 0.07, background: 'radial-gradient(circle,#ff3b2f 0%,#7a0d08 60%,transparent 100%)', borderRadius: '50%', boxShadow: '0 0 18px 6px rgba(255,60,40,0.75)' }} />
      {/* свитер в полоску */}
      <div className="absolute left-1/2 -translate-x-1/2 overflow-hidden" style={{ top: size * 0.6, width: size * 0.92, height: size * 0.55, borderRadius: '26% 26% 12% 12%', background: 'repeating-linear-gradient(160deg,#3d0f10 0 14px,#16090a 14px 28px)', boxShadow: 'inset 0 10px 24px rgba(0,0,0,0.7)' }} />
      {/* лапа с когтями (заглушка) */}
      <div className="ff-claw absolute" style={{ top: size * 0.42, right: -size * 0.1, width: size * 0.4, height: size * 0.5 }}>
        <div style={{ position: 'absolute', right: size * 0.1, top: size * 0.34, width: size * 0.16, height: size * 0.18, background: '#2a1b1d', borderRadius: '40% 40% 20% 20%' }} />
        {[0, 1, 2].map((i) => (
          <div key={i} style={{ position: 'absolute', right: size * (0.02 + i * 0.09), top: size * 0.1, width: size * 0.035, height: size * 0.3, background: 'linear-gradient(180deg,#d8d2c8,#8d8578)', borderRadius: '40%', boxShadow: '0 0 6px rgba(255,255,255,0.35)', transform: `rotate(${(i - 1) * 9}deg)` }} />
        ))}
      </div>
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

/* ---------- ИНТРО (начало раунда FRENDY без своих кат-сцен) ---------- */
export function FrendyIntroCine({ onDone }: { onDone: () => void }) {
  const [stage, setStage] = useState(0); // 0 темнота, 1 Френди, 2 уход
  const phrase = useMemo(() => pick(FRENDY_CINE.intro), []);
  const stopRef = useRef<(() => void) | null>(null);
  useEffect(() => {
    const t0 = window.setTimeout(() => {
      setStage(1);
      sfx.frendySpawn();
      const i = Math.max(0, FRENDY_CINE.intro.indexOf(phrase));
      stopRef.current = playSeq(
        [frendyCineVoice('intro', i % Math.max(1, FRENDY_CINE.intro.length))],
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
      <button onClick={() => { stopRef.current?.(); onDone(); }} className="absolute bottom-4 right-4 z-10 px-3 py-1.5 border-2 border-[#5b2430] text-[#b98490] font-display text-[10px] uppercase tracking-wider hover:text-paper hover:border-[#ff5d73] cursor-pointer bg-[rgba(10,8,12,0.7)]">Пропустить ✕</button>
      {stage >= 1 && (
        <div className="flex flex-col items-center gap-5">
          <FrendyFigure size={200} />
          <div className="font-display uppercase text-center text-lg md:text-2xl text-[#ff5d73] px-6" style={{ textShadow: '0 0 18px rgba(255,45,45,0.8)' }}>«{phrase}»</div>
          <div className="font-pixel text-[9px] text-[#6c5a60] uppercase">Френди проснулся…</div>
        </div>
      )}
    </div>
  );
}

/* ---------- ТИТРЫ + ПОБЕДНАЯ КАТСЦЕНА + СТИНГЕР ---------- */
type CineLine = { t: string; c?: string; style?: React.CSSProperties };
const LINE_MS = 2900; // одна фраза титров

export function EndCredits({ map, sess, isFrendy, onClose }: { map: GameMap; sess: GameSession; isFrendy: boolean; onClose: () => void }) {
  const won = !!sess.frendy?.won;
  const [phase, setPhase] = useState<'win1' | 'win2' | 'win3' | 'lose1' | 'roll' | 'sting' | 'stingEnd' | 'done'>(isFrendy && won ? 'win1' : isFrendy ? 'lose1' : 'roll');
  const [idx, setIdx] = useState(0);
  const musicRef = useRef<HTMLAudioElement | null>(null);
  const stopRef = useRef<(() => void) | null>(null);
  const winner = sess.players.find((p) => p.id === sess.winner) ?? null;
  const winPhrase = useMemo(() => pick(FRENDY_CINE.win), []);
  const stingPhrase = useMemo(() => pick(FRENDY_CINE.sting), []);
  const losePhrase = useMemo(() => pick(FRENDY_CINE.badend), []); // v0.131: все проиграли — Френди глумится

  /* Список фраз титров (строится один раз) */
  const lines = useMemo<CineLine[]>(() => {
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
      if (winner) out.push({ t: `Последнюю микросхему в печь положил ${winner.name}`, c: 'font-display uppercase text-[11px] text-gold' });
    } else if (winner) {
      out.push({ t: `🏆 ${winner.name} — ПОБЕДИТЕЛЬ!`, c: 'font-display uppercase text-base', style: { color: PLAYER_COLORS[winner.color] ?? '#ffd76a' } });
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  /* СТИНГЕР (только FRENDY-победа): после письма, перед финальной строкой версии */
  const stingAt = isFrendy && won ? lines.length : -1;

  const finish = () => {
    try { musicRef.current?.pause(); } catch { /* noop */ }
    stopRef.current?.();
    setPhase('done');
    onClose();
  };

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
      const i = Math.max(0, FRENDY_CINE.win.indexOf(winPhrase));
      stopRef.current = playSeq(
        [frendyCineVoice('win', i % Math.max(1, FRENDY_CINE.win.length))],
        () => setPhase('win3'),
        24000,
      );
      return () => stopRef.current?.();
    }
    if (phase === 'win3') {
      const t = window.setTimeout(() => setPhase('roll'), 2000); // «проходит 2 секунды»
      return () => clearTimeout(t);
    }
    /* v0.131: ВСЕ ПРОИГРАЛИ (Френди победил) — сначала его глумление (badend), потом титры */
    if (phase === 'lose1') {
      sfx.frendySpawn();
      const i = Math.max(0, FRENDY_CINE.badend.indexOf(losePhrase));
      stopRef.current = playSeq(
        [frendyCineVoice('badend', i % Math.max(1, FRENDY_CINE.badend.length))],
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
    const i = Math.max(0, FRENDY_CINE.sting.indexOf(stingPhrase));
    stopRef.current = playSeq(
      [frendyCineVoice('sting', i % Math.max(1, FRENDY_CINE.sting.length))],
      () => setPhase('stingEnd'),
      26000,
    );
    return () => stopRef.current?.();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stingPhrase]);
  useEffect(() => {
    if (phase !== 'stingEnd') return;
    try { void musicRef.current?.play().catch(() => { /* noop */ }); } catch { /* noop */ }
    const t = window.setTimeout(() => setIdx(stingAt + 1), 3400); // продолжаем с того же места
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, stingAt]);

  /* ---------- ПОКАЗ ---------- */
  if (phase === 'win1' || phase === 'win2' || phase === 'win3' || phase === 'lose1') {
    return (
      <div className="fixed inset-0 z-[80] bg-black flex items-center justify-center cine-fadein">
        <button onClick={finish} className="absolute bottom-4 right-4 z-10 px-3 py-1.5 border-2 border-[#5b2430] text-[#b98490] font-display text-[10px] uppercase tracking-wider hover:text-paper hover:border-[#ff5d73] cursor-pointer bg-[rgba(10,8,12,0.7)]">Пропустить ✕</button>
        {phase === 'win1' && (
          <div className="flex flex-col items-center gap-6">
            <div className="relative text-7xl md:text-8xl" style={{ filter: 'drop-shadow(0 0 30px rgba(255,122,26,0.8))' }}>🔥🧱🔥</div>
            <div className="font-display uppercase text-center text-base md:text-xl text-[#ffb257] px-6">{winner ? `${winner.name} кладёт ПОСЛЕДНЮЮ микросхему в печь…` : 'Последняя микросхема летит в печь…'}</div>
          </div>
        )}
        {phase === 'win2' && (
          <div className="flex flex-col items-center gap-5">
            <FrendyFigure size={210} burning />
            <div className="font-display uppercase text-center text-lg md:text-2xl text-[#ff5d73] px-6" style={{ textShadow: '0 0 18px rgba(255,45,45,0.8)' }}>«{winPhrase}»</div>
          </div>
        )}
        {phase === 'win3' && <div className="w-full h-full bg-black" />}
        {phase === 'lose1' && (
          <div className="flex flex-col items-center gap-5">
            <FrendyFigure size={210} />
            <div className="font-display uppercase text-center text-base md:text-xl text-[#ff5d73] px-6" style={{ textShadow: '0 0 14px rgba(255,45,45,0.55)' }}>КОШМАР ПОБЕДИЛ…</div>
            <div className="font-display uppercase text-center text-lg md:text-2xl text-[#ff5d73] px-6" style={{ textShadow: '0 0 18px rgba(255,45,45,0.8)' }}>«{losePhrase}»</div>
          </div>
        )}
      </div>
    );
  }

  if (phase === 'sting' || phase === 'stingEnd') {
    return (
      <div className="fixed inset-0 z-[80] bg-black flex items-center justify-center">
        <div className="cine-shake flex flex-col items-center gap-5">
          <FrendyFigure size={220} burning={phase === 'sting'} />
          {phase === 'sting' && (
            <div className="font-display uppercase text-center text-lg md:text-2xl text-[#ff5d73] px-6" style={{ textShadow: '0 0 18px rgba(255,45,45,0.8)' }}>«{stingPhrase}»</div>
          )}
          {phase === 'stingEnd' && (
            <div className="font-pixel uppercase tracking-[0.4em] text-teal text-xl md:text-3xl" style={{ textShadow: '0 0 22px rgba(46,230,168,0.7)' }}>ВЫ ПРОШЛИ ИГРУ</div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[80] bg-black flex items-center justify-center cine-fadein">
      <button onClick={finish} className="absolute bottom-4 right-4 z-10 px-3 py-1.5 border-2 border-edge text-faint font-display text-[10px] uppercase tracking-wider hover:text-paper hover:border-teal cursor-pointer bg-[rgba(10,8,12,0.7)]">Пропустить титры ✕</button>
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
