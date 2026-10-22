import { useEffect, useRef, useState } from 'react';
import { agentPortrait, AGENT_NAMES, EPI_SCRIPT, type EpiLine } from '../agentsAssets';
import type { AgentWho } from '../agentsAssets';
import { makeFrendyAudio } from '../frendyVoice';

/* v0.132: ПЕЧАТНАЯ МАШИНКА — общий кирпичик для VN-подачи (эпилог агентов и
   диалоги NPC с галочкой «🎭 визуальная новелла»). Печатает текст посимвольно. */
export function VnText({ text, speed = 28, className }: { text: string; speed?: number; className?: string }) {
  const [n, setN] = useState(0);
  useEffect(() => {
    setN(0);
    const iv = window.setInterval(() => {
      setN((x) => {
        if (x >= text.length) { window.clearInterval(iv); return x; }
        return x + 1;
      });
    }, speed);
    return () => window.clearInterval(iv);
  }, [text, speed]);
  return (
    <span className={className}>
      {text.slice(0, n)}
      <span className="inline-block w-1.5 h-3.5 ml-0.5 align-[-2px] bg-gold blink-hard" />
    </span>
  );
}

/* v0.132 ЭПИЛОГ FRENDY: РАЗГОВОР АЛЬДЕРА И СКАЛЛЕР в стиле ВИЗУАЛЬНОЙ НОВЕЛЛЫ.
   Показывается ВСЕМ игрокам синхронно (номер реплики живёт в сессии — epi.talkIdx).
   Портреты: СКАЛЛЕР слева, АЛЬДЕР справа (как заказано); реплика печатается
   «машинкой», озвучка (flac заказчика) играет у каждого локально при смене реплики.
   Листает ТОЛЬКО хост (его фишка — Скаллер): кнопка «Далее» / клик по экрану /
   E, Space, Enter; «Пропустить» — сразу финал. */
export function AgentsVn({ idx, isHost, onNext }: { idx: number; isHost: boolean; onNext: (all?: boolean) => void }) {
  const safeIdx = Math.max(0, Math.min(idx, EPI_SCRIPT.length - 1));
  const ln: EpiLine = EPI_SCRIPT[safeIdx];
  const [typed, setTyped] = useState('');
  const audioRef = useRef<HTMLAudioElement | null>(null);

  /* смена реплики: стоп прошлого звука, старт нового, печатная машинка.
     v0.133: громкость реплик агентов — из Опций «Голос Френди» (как и все реплики FRENDY) */
  useEffect(() => {
    setTyped('');
    try { audioRef.current?.pause(); } catch { /* noop */ }
    audioRef.current = null;
    let cancelled = false;
    if (ln.src) {
      const a = makeFrendyAudio(ln.src);
      if (a) {
        audioRef.current = a;
        void a.play().catch(() => { /* автоплей заблокирован — субтитры продолжают */ });
      }
    }
    const full = ln.text;
    let i = 0;
    const iv = window.setInterval(() => {
      if (cancelled) return;
      i += 1;
      setTyped(full.slice(0, i));
      if (i >= full.length) window.clearInterval(iv);
    }, 30);
    return () => {
      cancelled = true;
      window.clearInterval(iv);
      try { audioRef.current?.pause(); } catch { /* noop */ }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeIdx]);

  /* хост листает реплики клавишами (клик по экрану тоже) */
  useEffect(() => {
    if (!isHost) return;
    const onKey = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === 'e' || k === 'у' || k === ' ' || k === 'enter') {
        e.preventDefault();
        onNext(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isHost, onNext]);

  const port = (who: AgentWho) => agentPortrait(who);
  const active = ln.who;
  const sideCls = (who: AgentWho): string =>
    `absolute bottom-[27%] transition-all duration-300 ${active === who ? 'opacity-100' : 'opacity-60 grayscale-[35%] brightness-[0.8]'}`;
  const nameCls = (who: AgentWho): string =>
    `font-display uppercase tracking-wider text-[13px] px-3 py-1 border-2 pixel-corners ${active === who ? 'text-gold border-gold bg-[rgba(20,16,4,0.85)]' : 'text-faint border-edge bg-[rgba(6,8,18,0.85)]'}`;

  return (
    <div className="fixed inset-0 z-[76] select-none" style={{ background: 'linear-gradient(180deg, rgba(2,3,8,0.55) 0%, rgba(2,3,8,0.2) 35%, rgba(2,3,8,0.78) 100%)' }}>
      {/* ПОРТРЕТЫ: Скаллер слева, Альдер справа */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className={`${sideCls('skaller')} left-[2%] md:left-[6%]`} style={{ transform: active === 'skaller' ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.97)' }}>
          <img src={port('skaller')} alt="Скаллер" className="h-[58vh] md:h-[64vh] max-w-none drop-shadow-[0_12px_28px_rgba(0,0,0,0.8)]" draggable={false} />
        </div>
        <div className={`${sideCls('alder')} right-[2%] md:right-[6%]`} style={{ transform: active === 'alder' ? 'translateY(0) scale(1)' : 'translateY(8px) scale(0.97)' }}>
          <img src={port('alder')} alt="Альдер" className="h-[58vh] md:h-[64vh] max-w-none drop-shadow-[0_12px_28px_rgba(0,0,0,0.8)]" draggable={false} />
        </div>
      </div>

      {/* Плашки имён над текстовым боксом */}
      <div className="absolute bottom-[24.5%] left-0 right-0 flex justify-center gap-40 pointer-events-none">
        <span className={nameCls('skaller')}>{AGENT_NAMES.skaller}</span>
        <span className={nameCls('alder')}>{AGENT_NAMES.alder}</span>
      </div>

      {/* ТЕКСТОВЫЙ БОКС с печатной машинкой */}
      <div
        className="absolute bottom-6 left-1/2 -translate-x-1/2 w-[94%] max-w-3xl border-[3px] border-edge bg-[rgba(6,8,18,0.93)] pixel-corners px-5 py-4 cursor-pointer"
        onClick={() => { if (isHost) onNext(false); }}
        title={isHost ? 'Дальше (E / Space / клик)' : undefined}
      >
        <div className="text-[14px] md:text-[15px] text-paper leading-snug min-h-[3.4em]">
          {typed}
          <span className="inline-block w-2 h-4 ml-0.5 align-[-2px] bg-gold blink-hard" />
        </div>
        <div className="flex items-center justify-between mt-2">
          <span className="font-pixel text-[9px] text-faint uppercase tracking-wider">Секретные материалы · реплика {safeIdx + 1} из {EPI_SCRIPT.length}</span>
          {isHost ? (
            <span className="flex items-center gap-3">
              <button
                onClick={(e) => { e.stopPropagation(); onNext(true); }}
                className="text-[10px] font-display uppercase px-2 py-1 border-2 border-edge text-faint hover:text-paper hover:border-teal cursor-pointer"
              >Пропустить ✕</button>
              <span className="text-gold text-sm blink-hard">▼ Далее (E)</span>
            </span>
          ) : (
            <span className="font-pixel text-[9px] text-faint uppercase">разговор ведёт хост…</span>
          )}
        </div>
      </div>
    </div>
  );
}
