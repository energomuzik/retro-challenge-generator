/* v0.84.0: МИКРО-ПЛЕЕР фонововой музыки — по решению заказчика.
   При старте музыки снизу экрана ВЫЕЗЖАЕТ плашка: название трека,
   кнопка «следующий трек» и ползунок громкости (действует только на
   музыку). Плашка живёт на экране 5 секунд; если навести на неё мышь —
   останется, пока мышь не уберут; убрали — через 5 секунд уезжает.
   Прячется сразу, когда музыка уходит в тишину (партия, подключение,
   обучение и т. д.). */

import { useEffect, useRef, useState } from 'react';
import { useMusic } from './music';
import { GhostBtn } from './ui';

const SHOW_MS = 5000;

export function MiniPlayer() {
  const status = useMusic((s) => s.status);
  const track = useMusic((s) => s.track);
  const volume = useMusic((s) => s.volume);
  const setVolume = useMusic((s) => s.setVolume);
  const next = useMusic((s) => s.next);
  const [shown, setShown] = useState(false);
  const hoverRef = useRef(false);
  const timerRef = useRef(0);

  /* показ/скрытие по статусу: playing/resolving — показать на 5 с,
     иначе (пауза, тишина, ошибка, выключена) — спрятать сразу */
  useEffect(() => {
    if (status === 'playing' || status === 'resolving') {
      setShown(true);
      window.clearTimeout(timerRef.current);
      timerRef.current = window.setTimeout(() => {
        if (!hoverRef.current) setShown(false);
      }, SHOW_MS);
    } else {
      window.clearTimeout(timerRef.current);
      setShown(false);
    }
    return () => window.clearTimeout(timerRef.current);
  }, [status, track]);

  /* ползунок громкости в мини-плеере не должен перехватывать клик как жест
     «включить музыку» повторно — он и так не мешает: initMusic вешается один раз */
  return (
    <div
      onMouseEnter={() => {
        hoverRef.current = true;
        window.clearTimeout(timerRef.current); // навели — держим на экране
      }}
      onMouseLeave={() => {
        hoverRef.current = false;
        window.clearTimeout(timerRef.current);
        timerRef.current = window.setTimeout(() => {
          if (!hoverRef.current) setShown(false);
        }, SHOW_MS); // убрали мышь — уезжает через 5 с
      }}
      className={`fixed bottom-3 left-1/2 z-40 -translate-x-1/2 transition-transform duration-300 ease-out ${
        shown ? 'translate-y-0' : 'translate-y-[160%]'
      }`}
      aria-hidden={!shown}
    >
      <div className="pixel-panel pixel-corners flex items-center gap-2.5 px-3 py-2 max-w-[92vw]">
        <span className="text-[13px] leading-none text-teal shrink-0" aria-hidden>♪</span>
        <span
          className="font-display text-[11px] text-paper truncate max-w-[220px] sm:max-w-[320px]"
          title={track || 'Музыка'}
        >
          {track || 'Музыка'}
        </span>
        <GhostBtn
          small
          className="shrink-0"
          title="Следующий трек"
          aria-label="Следующий трек"
          onClick={() => next()}
        >
          ⏭
        </GhostBtn>
        <input
          type="range" min={0} max={1} step={0.05} value={volume}
          onChange={(e) => setVolume(Number(e.target.value))}
          title={`Громкость музыки: ${Math.round(volume * 100)}%`}
          aria-label="Громкость музыки"
          className="w-20 sm:w-24 accent-[#ffcf3f] cursor-pointer shrink-0"
        />
      </div>
    </div>
  );
}
