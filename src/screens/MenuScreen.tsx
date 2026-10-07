import { useEffect, useState } from 'react';
import { useApp } from '../store';
import type { Screen } from '../store';
import { Ic } from '../ui';
import { sfx } from '../sound';
import { VERSION } from '../version';

const MENU: { key: string; label: string; screen: Screen; desc: string; color: string; icon: (s?: number) => React.ReactNode }[] = [
  // v0.86: пункт переименован в «ПОМОЩЬ - ОБУЧЕНИЕ». v0.80: он же — ПЕРВАЯ строка меню (раньше четвёртая): новые игроки
  // сначала проходят курсы, потом идут в комнаты и редакторы
  { key: 'training', label: 'ПОМОЩЬ - ОБУЧЕНИЕ', screen: 'training', desc: 'курсы игрока и создателя карт — с озвучкой', color: '#b48bff', icon: Ic.book },
  { key: 'create', label: 'Создать игру', screen: 'create', desc: 'выбрать карту · открыть комнату', color: '#ffcf3f', icon: Ic.dice },
  { key: 'join', label: 'Подключиться', screen: 'join', desc: 'войти в комнату по коду', color: '#5aa9ff', icon: Ic.globe },
  { key: 'load', label: 'Загрузить игру', screen: 'load', desc: 'сохранённые партии', color: '#8f97c9', icon: Ic.save },
  { key: 'challenge', label: 'Создать челлендж', screen: 'challenge', desc: 'свой режим: ответы на вопросы — и правила готовы', color: '#ff8b3f', icon: Ic.trophy },
  { key: 'editors', label: 'Все редакторы', screen: 'editorsHub', desc: 'карты · задания · квизы · фишки', color: '#2ee6a8', icon: Ic.pen },
  { key: 'emulator', label: 'Запуск эмулятора', screen: 'emulator', desc: 'тест ромов · запись сохранений', color: '#ff5d73', icon: Ic.chip },
  { key: 'options', label: 'Опции', screen: 'options', desc: 'имя · трансляция · звук', color: '#8f97c9', icon: Ic.gear },
];

export default function MenuScreen() {
  const { setScreen } = useApp();
  const [sel, setSel] = useState(0);

  /* v0.81: сетка меню с «широкими» строками: «Обучение» — первой и «Опции» — последней
     НА ВСЮ ШИРИНУ (как кнопка «Опции» просил заказчик) — между ними пары по две колонки,
     расположение кнопок остаётся ровным. rows[] описывает строки сетки для клавиатуры. */
  const rows: number[][] = MENU.length === 8 ? [[0], [1, 2], [3, 4], [5, 6], [7]] : MENU.map((_, i) => [i]);
  const wide = (i: number) => i === 0 || i === MENU.length - 1;

  const rowOf = (idx: number) => rows.findIndex((r) => r.includes(idx));
  const gridNav = (idx: number, dr: -1 | 1): number => {
    const r = rowOf(idx);
    if (r < 0) return idx;
    const nr = Math.max(0, Math.min(rows.length - 1, r + dr));
    const col = rows[r].indexOf(idx);
    return rows[nr][Math.min(col, rows[nr].length - 1)];
  };
  const latNav = (idx: number, d: -1 | 1): number => {
    const r = rowOf(idx);
    if (r < 0 || rows[r].length < 2) return idx;
    const col = rows[r].indexOf(idx);
    return rows[r][(col + d + rows[r].length) % rows[r].length];
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      // v0.61: пункты лежат СЕТКОЙ — стрелки ходят по строкам сетки (учитывая
      // широкие строки «Обучение»/«Опции»), Enter открывает
      if (e.key === 'ArrowDown') { sfx.hover(); setSel((s) => gridNav(s, 1)); }
      else if (e.key === 'ArrowUp') { sfx.hover(); setSel((s) => gridNav(s, -1)); }
      else if (e.key === 'ArrowRight') { sfx.hover(); setSel((s) => latNav(s, 1)); }
      else if (e.key === 'ArrowLeft') { sfx.hover(); setSel((s) => latNav(s, -1)); }
      else if (e.key === 'Enter') { sfx.coin(); setScreen(MENU[sel].screen); }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, setScreen]);

  return (
    <div className="h-full crt-grid-bg relative overflow-hidden">
      <div className="absolute inset-0 starfield opacity-60 pointer-events-none" />
      {/* v0.61: меню на ВСЮ ширину экрана (max-w-4xl) и СЕТКОЙ В ДВЕ КОЛОНКИ —
         все пункты видны сразу, крутить колёсико больше не нужно */}
      <div className="relative z-10 h-full max-w-4xl mx-auto px-6 py-5 flex flex-col">
        {/* логотип */}
        <div className="text-center pt-2 sm:pt-5">
          <h1 className="font-pixel text-gold title-glow glow-throb leading-[1.08] tracking-tight text-[28px] sm:text-[40px]">
            RETRO <span className="text-paper">CHALLENGE</span>
            <span className="block text-[18px] sm:text-[26px] mt-1">GENERATOR</span>
          </h1>
          <p className="mt-2 sm:mt-3 font-display text-dim uppercase tracking-[0.22em] text-[10px] sm:text-[11px]">
            платформа для создания челленджей
          </p>
        </div>

        {/* меню — сетка 2 колонки; «Опции» последним пунктом на всю ширину */}
        <div className="mt-5 sm:mt-7 flex-1 min-h-0 overflow-y-auto">
          <div className="grid sm:grid-cols-2 gap-2.5">
            {MENU.map((m, i) => (
              <button
                key={m.key}
                onClick={() => { sfx.coin(); setScreen(m.screen); }}
                onMouseEnter={() => { if (sel !== i) { sfx.hover(); setSel(i); } }}
                className={`menu-row w-full text-left flex items-center gap-4 px-5 py-3 border-2 transition-all ${
                  wide(i) ? 'sm:col-span-2' : ''
                } ${sel === i ? 'border-edge2 bg-panel2' : 'border-transparent bg-[rgba(19,26,51,0.35)]'}`}
                style={{ '--rowc': m.color } as React.CSSProperties}
              >
                <span className="shrink-0" style={{ color: m.color }}>{m.icon(24)}</span>
                <span className="flex-1 min-w-0">
                  <span className={`block font-display uppercase tracking-wide text-[15px] transition-colors ${sel === i ? 'text-paper' : 'text-dim'}`}>
                    {m.label}
                  </span>
                  <span className="block text-[10.5px] text-faint mt-0.5">{m.desc}</span>
                </span>
                {sel === i && <span className="font-pixel text-[9px] blink-hard" style={{ color: m.color }}>▶</span>}
              </button>
            ))}
          </div>
        </div>

        {/* нижняя строка */}
        <div className="mt-4 mb-1 text-center space-y-2">
          <div className="font-pixel text-[9px] text-faint blink-hard">INSERT SKILL TO CONTINUE</div>
          <div className="text-[10px] text-faint">© ENERGO MUZHIK STUDIOS · v{VERSION}</div>
        </div>
      </div>
    </div>
  );
}
