import { useEffect, useState } from 'react';
import { sfx } from '../sound';

/* v0.128: ЛОР ФРЕНДИ — ОБЩИЙ БЛОК предыстории злодея.
   Живёт в двух местах:
   • «ПОМОЩЬ - ОБУЧЕНИЕ» — карточка под двумя курсами (v0.127);
   • ЭКРАН СТАРТА партии FRENDY (v0.129, перенесено из лобби) — панель
     «ВСЕ СТАРТУЮТ ОДНОВРЕМЕННО», где каждый выбирает фишку и жмёт
     «Старт игры»: перед стартом каждый видит, ПРОТИВ КОГО играет.
     Там карточка КОМПАКТНАЯ (compact) — панель и без того высокая.
   Тексты — из запроса заказчика: Тайвань 90-х → нематериальное зло → плохая
   приставка на чердаке → печь → стальная перчатка из неописуемого зла →
   слияние с приставкой → ФРЕНДИ, мстящий детям плохими играми на Дэнди. */

export function FrendyLore({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  return (
    <>
      <button
        onClick={() => { sfx.click(); setOpen(true); }}
        onMouseEnter={() => sfx.hover()}
        className={`menu-row w-full text-left flex items-center gap-4 border-2 border-edge bg-[rgba(19,26,51,0.55)] transition-all hover:bg-panel2 ${compact ? 'px-3.5 py-2.5' : 'px-5 py-3.5'}`}
        style={{ '--rowc': '#ff5d73' } as React.CSSProperties}
      >
        <span className={`shrink-0 font-pixel ${compact ? 'text-[12px]' : 'text-[15px]'}`} style={{ color: '#ff5d73' }}>😈</span>
        <span className="flex-1 min-w-0">
          <span className={`block font-display uppercase tracking-wide text-paper ${compact ? 'text-[11.5px]' : 'text-[14px]'}`}>Лор Френди — предыстория злодея</span>
          {!compact && <span className="block text-[10.5px] text-faint mt-0.5">Тайвань · чердак · печь · стальная перчатка — узнай, ПРОТИВ КОГО играешь, до того как нажмёшь «Начать игру»</span>}
        </span>
        <span className="font-pixel text-[9px]" style={{ color: '#ff5d73' }}>▶</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-[85] bg-black/85 flex items-center justify-center p-4" onClick={() => setOpen(false)}>
          <div className="pixel-panel pixel-corners w-full max-w-xl max-h-[85vh] overflow-y-auto bg-[rgba(13,18,38,0.97)] border-2 border-[#ff5d73]/70 p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
              <div className="font-pixel text-[15px] title-glow" style={{ color: '#ff5d73' }}>ЛОР ФРЕНДИ</div>
              <button title="Закрыть (Esc)" onClick={() => setOpen(false)} className="px-2 py-1 border-2 border-edge text-dim font-pixel text-[10px] hover:text-paper hover:border-edge2">✕</button>
            </div>
            <p className="font-pixel text-[9px] text-faint uppercase tracking-wider mt-1 mb-4">предыстория злодея</p>
            <div className="space-y-3.5 text-[12.5px] leading-relaxed text-paper/90">
              <p>90-е. Тайвань. В недрах одной фабрики дешёвых приставок родилось зло — нематериальное, безымянное. Оно впитывало всё худшее из конвейера: хрип пиканья, ломаные крестовины, музыку, от которой сводило зубы, и бесконечные обещания красивых обложек.</p>
              <p>Одну из приставок купили. Она оказалась настолько плоха, что её отправили пылиться на чердак. Прошло несколько лет — в доме затеяли уборку, и старый хлам полетел в печь. Вместе с приставкой.</p>
              <p>Но среди хлама нашлась стальная перчатка с лезвиями на пальцах. Её выковали из зла, которое не описать словами. В огне печи перчатка слилась с приставкой — так родился <span className="font-display uppercase" style={{ color: '#ff5d73' }}>Френди</span>.</p>
              <p>Теперь он мстит детям: заставляет играть в плохие игры на Дэнди — с ужасным управлением, пищащей музыкой, простейшей графикой и обнадёживающей обложкой. Соберёшь его микросхемы — придёт лично: с лапой-перчаткой и парой любезных фразочек.</p>
              <p className="text-gold">Сожги все микросхемы Френди в печи — и, может быть, ты проснёшься.</p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
