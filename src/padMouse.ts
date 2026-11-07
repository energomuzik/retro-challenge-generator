/* ---------- v0.170→v0.171: ВИРТУАЛЬНАЯ МЫШЬ ДЖОЙСТИКА (правый стик + R1/R2) ----------
   Мышью теперь можно управлять БЕЗ реальной мыши — курсор эмулируется:
     • ПРАВЫЙ СТИК — двигает курсор (чем сильнее отклонён, тем быстрее;
       скорость регулируется ползунком «Чувствительность» в «Управлении»);
     • R2 (на Xbox — RT) — ЛЕВАЯ кнопка мыши: нажал-держишь — тащишь предмет,
       отпустил — положил (перетаскивание по сетке, на печь, в приставку);
     • R1 (на Xbox — RB) — ПРАВАЯ кнопка мыши: контекстное меню предмета
       (использовать / сжечь / выбросить).
   Раскладка ФИКСИРОВАННАЯ и в «Управлении» НЕ переназначается: оси 2/3 и кнопки
   W3C 5/7 у всех стандартных падов (PlayStation, Xbox, Generic) означают одно и
   то же — правый стик, R1/RB, R2/RT. Только у Xbox они называются иначе:
   R1 = RB (правый бампер), R2 = RT (правый триггер).
   Механика: курсор — служебный SVG-указатель поверх всех окон (pointer-events
   нет — клики проходят «сквозь» него в окна); нажатия — НАСТОЯЩИЕ события
   pointerdown/mousedown/contextmenu/… в точке курсора (document.elementFromPoint),
   поэтому окнам всё равно, чем кликнули: Diablo-перетаскивание, ПКМ-меню и
   кнопки работают ровно как от мыши. Пока ЛКМ «держится» (R2 зажат), курсор
   продолжает двигаться правым стиком — так тащат предметы.

   v0.171 — МЫШЬ РАБОТАЕТ ВЕЗДЕ (меню, редакторы, окна заданий): один глобальный
   экземпляр в App.tsx. Три состояния, которые гасят курсор/клики:
     • userOff — кнопка «Мышь с джойстика вкл/выкл» (по умолчанию F7 / L3):
       в окне задания триггеры R1/R2 бывают заняты игрой (SNES/SEGA) — нажал,
       и курсор с кликами выключился; окно задания закрылось — включилась сама;
     • clicksOff — «режим только курсора» на чистом поле партии (окна закрыты):
       курсор виден и двигается, но клики НЕ отправляются — случайное нажатие
       R1/R2 не откроет ячейку и не нажмёт кнопки HUD;
     • главный тумблер «Геймпад» в Опциях (prefs.gamepad === false) — как было.

   v0.172 — ЛЕВЫЙ СТИК ПРОКРУЧИВАЕТ, РЕТРО-КУРСОР, ПОЛЗУНКИ И ПОЛЯ ВВОДА:
     • ЛЕВЫЙ СТИК вверх/вниз — прокрутка меню и панелей (как колёсико мыши):
       работает во всех окнах, списках и редакторах, отключается ТОЙ ЖЕ кнопкой
       тумблера, что и ЛКМ/ПКМ (в окне задания игра крутится — тумблер погасил
       и прокрутку тоже), а по канвам редакторов колесо зумит, как настоящая
       мышь; щелчки колеса — порциями по 100 px, как у настоящего ролика;
     • курсор больше не стандартная белая стрела — ПИКСЕЛЬНАЯ стрела в палитре
       проекта: золото #ffcf3f с бликом и чернильным контуром, при зажатой ЛКМ
       — коралловая #ff5d73 (крупнее системной, 20×32);
     • ПОЛЗУНКИ (громкость, чувствительность…) — раньше молчали: синтетические
       события не запускают нативный драг браузера. Теперь сами: клик прыгает
       в точку, «держишь и ведёшь» — ползунок тащится (считаем value из X
       курсора и шлём input/change — React onChange срабатывает как надо);
     • ТЕКСТОВЫЕ ПОЛЯ (ник, названия карт…) — клик ставит фокус и каретку
       ввода в точку клика (нативный фокус от синтетики не приходит);
     • ГАЛОЧКИ и РАДИОКНОПКИ (в т.ч. завёрнутые в <label>) — переключаются:
       настоящий клик делает это сам, синтетический — нет, переключаем сами и
       шлём click в сам чекбокс; выпадающие списки <select> получают фокус
       (раскрыть список браузер разрешает только настоящей мыши).

   v0.174 — КЛИКИ ВО ВРЕМЯ ИГРЫ: ПАНЕЛЬ ВВЕРХУ И «ПРОПУСТИТЬ» ИНТРО (заказчик:
   «в начале френди, когда Френди говорит фразу — мышкой джоя не нажимается на
   пропустить; во время игры мышкой джоя не нажать на кнопки на панели вверху —
   там инвентарь, карта мира и т.д.»):
     • ЭКРАН ИГРЫ — ИГРОВАЯ ЗОНА: эмулятор — <iframe> (SegaBox), синтетические
       события в него всё равно не попадают; над ним клики/колесо гасим, зато
       R1/R2 свободно уходят в игру как триггеры;
     • над ИНТЕРФЕЙСОМ (панель вверху, окна, кнопки) — наоборот: R2/R1 — кнопки
       мыши, а триггеры игре НЕ пересылаются: насос кнопок в SegaBox каждый кадр
       читает localStorage['retropolia-pad-trig-ui'] и пока там «1», пропускает
       физические кнопки W3C 5/7 (R1/RB, R2/RT) — конфликт триггеров разведён
       ГЕОМЕТРИЕЙ: курсор над экраном — триггеры, курсор над интерфейсом — мышь;
     • мышь в окне задания больше НЕ гаснет на время игры (GameScreen/запуск
       эмулятора) — курсор всегда на месте, панель нажимается и на бегу;
     • «только курсор» на чистом поле стал умнее: кнопки HUD («Инвентарь»,
       «Карта мира», «Сохранить») нажимаются, гасятся только клики по КАНВЕ
       карты (случайное R1/R2 не откроет ячейку);
     • интро Френди было «голым полем» без галочки в списке оверлеев — клики
       гасились и «Пропустить» не нажималась; добавлено в список. */
import { useEffect, useState } from 'react';
import { listGamepads, loadEmuPrefs } from './input';
import { sfx } from './sound';

/* Подсказка для окон (одна на все; имена кнопок — PS + Xbox в скобках) */
export const PAD_MOUSE_HINT = '🎮 Правый стик — курсор · R2 (RT) — ЛКМ · R1 (RB) — ПКМ';
/* v0.172: расширенная подсказка для «Управления» и панелей, где есть место */
export const PAD_MOUSE_HINT_FULL = PAD_MOUSE_HINT + ' · левый стик — прокрутка (колёсико)';

/* ФИКСИРОВАННАЯ раскладка (W3C Standard Gamepad) — намеренно без настроек */
const AXIS_X = 2;       // правый стик, горизонталь
const AXIS_Y = 3;       // правый стик, вертикаль
const BTN_LMB = 7;      // R2 (PS) = RT (Xbox) — левая кнопка мыши
const BTN_RMB = 5;      // R1 (PS) = RB (Xbox) — правая кнопка мыши
const DEADZONE = 0.22;  // мёртвая зона стика (не ползёт от лёгкого наклона)
const MAX_SPEED = 1150; // пикселей в секунду при полном отклонении (× padMouseSpeed)

/* ---------- v0.172: ЛЕВЫЙ СТИК — ПРОКРУТКА (колёсико мыши) ---------- */
const AXIS_LY = 1;         // левый стик, вертикаль — прокрутка меню вверх/вниз
const SCROLL_NOTCH = 100;  // один «щелчок» колёсика — как у настоящей мыши
const SCROLL_GAP = 55;     // мс между щелчками (не чаще ~18/с — как быстрый ролик)
const MAX_SCROLL = 900;    // пикселей в секунду при полном отклонении (× padMouseSpeed)

/* Ближайший прокручиваемый предок (окно списка, панель редактора) — синтетическое
   колесо браузер сам не прокатывает, прокручиваем вручную. */
function scrollableBox(el: Element): HTMLElement | null {
  let n: HTMLElement | null = el instanceof HTMLElement ? el : el.parentElement;
  while (n && n !== document.body) {
    if (n.scrollHeight - n.clientHeight > 2) {
      const oy = window.getComputedStyle(n).overflowY;
      if (oy === 'auto' || oy === 'scroll') return n;
    }
    n = n.parentElement;
  }
  return null;
}

/* ---------- v0.172: РЕТРО-КУРСОР — пиксельная стрела в палитре проекта ----------
   Матрица пикселей → SVG-прямоугольники (crispEdges — рёбра без сглаживания).
   X — чернильный контур #0b0e1c, H — блик, F — золото проекта #ffcf3f;
   зажатая ЛКМ — коралловая заливка #ff5d73. Курсор 20×32 — крупнее системного. */
const CURSOR_PIXELS = [
  'X.........',
  'XX........',
  'XHX.......',
  'XHHX......',
  'XHFFX.....',
  'XHFFFX....',
  'XHFFFFX...',
  'XHFFFFFX..',
  'XHFFFFFFX.',
  'XHFFFFFFFX',
  'XHFFFFXXXX',
  'XHFFFX....',
  'XXHFFX....',
  '..XHFX....',
  '...XHFX...',
  '....XX....',
];
const CURSOR_SCALE = 2; // 10×16 пикселей × 2
const cursorSvg = (fill: string, hi: string): string => {
  let rects = '';
  CURSOR_PIXELS.forEach((row, j) => {
    for (let i = 0; i < row.length; i++) {
      const c = row[i];
      if (c === '.') continue;
      const col = c === 'X' ? '#0b0e1c' : c === 'H' ? hi : fill;
      rects += `<rect x="${i * CURSOR_SCALE}" y="${j * CURSOR_SCALE}" width="${CURSOR_SCALE}" height="${CURSOR_SCALE}" fill="${col}"/>`;
    }
  });
  return `<svg width="${10 * CURSOR_SCALE}" height="${16 * CURSOR_SCALE}" viewBox="0 0 ${10 * CURSOR_SCALE} ${16 * CURSOR_SCALE}" shape-rendering="crispEdges" style="filter:drop-shadow(0 2px 2px rgba(0,0,0,0.85))">${rects}</svg>`;
};
const CURSOR_IDLE = cursorSvg('#ffcf3f', '#ffe9a3'); // золото проекта
const CURSOR_LMB = cursorSvg('#ff5d73', '#ffb3a8');  // зажата ЛКМ — коралл

/* ---------- v0.171: СОСТОЯНИЕ «ВЫКЛЮЧЕНО КНОПКОЙ» (userOff) + подписчики ---------- */
let userOff = false;
const offListeners = new Set<() => void>();

/** Выключить/включить мышь с джойстика (кнопка-тумблер и авто-режим окон заданий). */
export function padMouseSetOff(v: boolean): void {
  if (userOff === v) return;
  userOff = v;
  offListeners.forEach((l) => { try { l(); } catch { /* noop */ } });
}
export function padMouseIsOff(): boolean { return userOff; }

/** Подписка на смену состояния (для подсказок «мышь ВКЛ/выкл»). Возвращает отписку. */
export function padMouseOnOffChange(l: () => void): () => void {
  offListeners.add(l);
  return () => { offListeners.delete(l); };
}

/** React-хук для UI: текущее состояние «мышь с джойстика выключена». */
export function usePadMouseOff(): boolean {
  const [off, setOff] = useState(userOff);
  useEffect(() => padMouseOnOffChange(() => setOff(userOff)), []);
  return off;
}

/* ---------- v0.171: РЕЖИМ «ТОЛЬКО КУРСОР» (клики по канве поля выключены) ----------
   На чистом поле партии (все окна закрыты) курсор двигается, клики по КАНВЕ
   карты гасятся: случайное R1/R2 не «кликнет» ячейку. КНОПКИ HUD при этом
   нажимаются (v0.174 — «Инвентарь», «Карта мира» работают и на чистом поле). */
let clicksOff = false;
/** Запретить/разрешить КЛИКИ мыши с джойстика по канве поля (HUD доступен всегда). */
export function padMouseSetClicksOff(v: boolean): void { clicksOff = v; }

/* ---------- v0.174: ИГРОВАЯ ЗОНА — ЭКРАН ЭМУЛЯТОРА ----------
   Экран игры — <iframe srcDoc> (SegaBox): document.elementFromPoint возвращает
   сам iframe, синтетические события в его документ всё равно не проходят.
   Над iframe клики/колесо не шлём, зато R1/R2 свободно доходят до игры. */
const inGameZone = (el: Element): boolean =>
  el.tagName === 'IFRAME' || !!el.closest('iframe');

/* ---------- v0.174: ФЛАГ ДЛЯ НАСОСА КНОПОК ИГРЫ (SegaBox) ----------
   Насос кнопок внутри iframe каждый кадр читает localStorage['retropolia-pad-trig-ui']:
   «1» — курсор над интерфейсом, R1/R2 сейчас кнопки мыши — игре их НЕ пересылать;
   «0»/нет записи — R1/R2 идут в игру как триггеры. Пишем только при смене. */
const TRIG_FLAG_KEY = 'retropolia-pad-trig-ui';
let trigFlagPrev: string | null = null;
const setTrigFlag = (v: boolean): void => {
  const s = v ? '1' : '0';
  if (trigFlagPrev === s) return;
  trigFlagPrev = s;
  try { localStorage.setItem(TRIG_FLAG_KEY, s); } catch { /* noop */ }
};

/* ---------- v0.171: ЗАМОК НА ВРЕМЯ НАЗНАЧЕНИЯ КНОПКИ ----------
   Пока в «Управлении» ловится кнопка/клавиша, тумблер мыши не срабатывает —
   нажатие, которым назначают кнопку, не должно гасить курсор. */
let uiLock = false;
export function padMouseSetUiLock(v: boolean): void { uiLock = v; }

/* События мыши в точке (x,y): элемент под курсором через elementFromPoint
   (сам курсор pointer-events:none — не перехватывает), с всплытием —
   React-обработчики (onPointerDown, onContextMenu, onClick…) срабатывают
   как от настоящего клика. pointerdown дублируется mousedown, pointerup —
   mouseup: часть кода слушает и те, и другие. */
function elAt(x: number, y: number): Element {
  return document.elementFromPoint(x, y) ?? document.body;
}

function fire(el: Element, type: string, x: number, y: number, button: number, buttons: number) {
  const init: EventInit & Record<string, unknown> = {
    bubbles: true, cancelable: true, composed: true, view: window,
    clientX: x, clientY: y, screenX: x, screenY: y, button, buttons,
  };
  let ev: Event;
  if (type.startsWith('pointer') && typeof PointerEvent === 'function') {
    ev = new PointerEvent(type, { ...init, pointerId: 1, pointerType: 'mouse', isPrimary: true, pressure: buttons ? 0.5 : 0 });
  } else {
    ev = new MouseEvent(type, init);
  }
  el.dispatchEvent(ev);
}

const btnHeld = (gp: Gamepad, idx: number): boolean => {
  const b = gp.buttons[idx];
  return !!b && (b.pressed || b.value > 0.5);
};

/** Глобальная виртуальная мышь джойстика: правый стик двигает курсор,
 *  R2 = ЛКМ, R1 = ПКМ (фиксировано). Монтируется ОДИН раз в App.tsx.
 *  Выключение — курсор снят, «зажатые» кнопки отпущены. */
export function usePadMouse(active: boolean) {
  useEffect(() => {
    if (!active) return;
    /* SVG-курсор поверх всех окон (z-index максимальный, pointer-events нет) */
    const cur = document.createElement('div');
    cur.style.cssText = 'position:fixed;left:0;top:0;z-index:2147483000;pointer-events:none;will-change:transform;display:none';
    cur.innerHTML = CURSOR_IDLE; // v0.172: ретро-курсор проекта (пиксельная золотая стрела)
    document.body.appendChild(cur); // v0.173: ФИКС «курсора нигде не видно» — в v0.172 элемент создан, но не прикреплён к странице
    const st = {
      x: Math.round(window.innerWidth / 2),
      y: Math.round(window.innerHeight / 2),
      lmb: false, rmb: false,
      lmbEl: null as Element | null,
      range: null as HTMLInputElement | null, // v0.172: ползунок, который сейчас тащим
      shown: false,
    };
    const place = () => { cur.style.transform = `translate(${st.x - 1}px, ${st.y - 1}px)`; };
    const show = () => { if (!st.shown) { st.shown = true; place(); cur.style.display = 'block'; } };
    const hide = () => { if (st.shown) { st.shown = false; cur.style.display = 'none'; } };
    const markLmb = (on: boolean) => {
      cur.innerHTML = on ? CURSOR_LMB : CURSOR_IDLE; // v0.172: зажатая ЛКМ — курсор коралловеет
    };

    /* ---------- v0.172: ПОЛЗУНКИ (input[type=range]) ----------
       Синтетический pointerdown не включает нативный драг браузера — значение
       считаем из X курсора и ставим сами, React onChange слушает input. */
    const rangeAt = (el: Element): HTMLInputElement | null =>
      el.closest('input[type="range"]') as HTMLInputElement | null;
    const rangeValueAt = (r: HTMLInputElement, x: number): number => {
      const rect = r.getBoundingClientRect();
      const min = r.min === '' ? 0 : parseFloat(r.min);
      const max = r.max === '' ? 100 : parseFloat(r.max);
      if (rect.width <= 0 || !isFinite(min) || !isFinite(max) || max <= min) return parseFloat(r.value) || 0;
      const ratio = Math.max(0, Math.min(1, (x - rect.left) / rect.width));
      let v = min + ratio * (max - min);
      const step = r.step && r.step !== 'any' ? parseFloat(r.step) : 0;
      if (step > 0) v = min + Math.round((v - min) / step) * step;
      return Math.max(min, Math.min(max, v));
    };
    const setRange = (r: HTMLInputElement, v: number, final: boolean): void => {
      const s = String(v);
      if (r.value !== s) {
        r.value = s;
        fire(r, 'input', st.x, st.y, 0, 1);
      }
      if (final) fire(r, 'change', st.x, st.y, 0, 1);
    };

    /* ---------- v0.172: ТЕКСТОВЫЕ ПОЛЯ — фокус и каретка в точку клика ----------
       Настоящий mousedown ставит фокус сам, синтетический — нет: фокусируем
       вручную (React onFocus сработает), каретку ставим через caretRangeFromPoint. */
    const focusField = (f: Element, x: number, y: number): void => {
      try { (f as HTMLElement).focus({ preventScroll: true }); } catch { /* noop */ }
      try {
        const d = document as Document & {
          caretRangeFromPoint?: (x: number, y: number) => Range | null;
          caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
        };
        let rg: Range | null = null;
        if (d.caretRangeFromPoint) rg = d.caretRangeFromPoint(x, y);
        else if (d.caretPositionFromPoint) {
          const cp = d.caretPositionFromPoint(x, y);
          if (cp) { rg = document.createRange(); rg.setStart(cp.offsetNode, cp.offset); }
        }
        if (rg && f.contains(rg.startContainer)) {
          const s = window.getSelection();
          s?.removeAllRanges();
          if (s) s.addRange(rg);
        }
      } catch { /* noop */ }
    };

    /* ---------- v0.172: ГАЛОЧКИ/РАДИО (в т.ч. завёрнутые в <label>) ----------
       Настоящий клик переключает их сам — синтетический не умеет. Клик по label
       переносим в сам чекбокс (label.control) и переключаем вручную. */
    const clickTargetFor = (el: Element): { target: Element; checkbox: boolean; radio: boolean } => {
      const lbl = el.closest('label');
      const ctl = (lbl ? (lbl as HTMLLabelElement).control ?? lbl.querySelector('input[type="checkbox"], input[type="radio"]') : null)
        ?? el.closest('input[type="checkbox"], input[type="radio"]');
      if (ctl instanceof HTMLInputElement && (ctl.type === 'checkbox' || ctl.type === 'radio')) {
        return { target: ctl, checkbox: ctl.type === 'checkbox', radio: ctl.type === 'radio' };
      }
      return { target: el, checkbox: false, radio: false };
    };
    const btnMask = () => (st.lmb ? 1 : 0) | (st.rmb ? 2 : 0);
    const moveCursor = () => {
      place();
      const el = elAt(st.x, st.y);
      fire(el, 'pointermove', st.x, st.y, -1, btnMask()); // движение нужно и при тащении (призрак предмета)
      fire(el, 'mousemove', st.x, st.y, -1, btnMask());
    };
    const releaseAll = () => {
      if (st.lmb) {
        st.lmb = false; markLmb(false);
        const el = elAt(st.x, st.y);
        fire(el, 'pointerup', st.x, st.y, 0, btnMask());
        fire(el, 'mouseup', st.x, st.y, 0, btnMask());
        if (st.range && st.range.isConnected) fire(st.range, 'change', st.x, st.y, 0, 1); // v0.172: ползунок — финальное change
        st.range = null; st.lmbEl = null;
      }
      if (st.rmb) {
        st.rmb = false;
        const el = elAt(st.x, st.y);
        fire(el, 'pointerup', st.x, st.y, 2, btnMask());
        fire(el, 'mouseup', st.x, st.y, 2, btnMask());
      }
    };

    let raf = 0;
    let last = performance.now();
    let scrollAcc = 0;  // v0.172: накопленный ход левого стика до следующего «щелчка» колеса
    let lastWheel = 0;  // v0.172: время последнего щелчка (не чаще SCROLL_GAP)
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const prefs = loadEmuPrefs();
      if (prefs.gamepad === false) { setTrigFlag(false); hide(); return; } // главный тумблер «Геймпад» в Опциях
      if (userOff) { releaseAll(); setTrigFlag(false); hide(); return; } // v0.171: выключено кнопкой-тумблером
      const gp = listGamepads()[0];
      if (!gp) { setTrigFlag(false); hide(); return; } // пада нет — курсор не показываем, мышь реальная работает сама
      show();
      /* v0.171: чувствительность — множитель из «Управления» (ползунок 0.3–2.5) */
      const spd = typeof prefs.padMouseSpeed === 'number' && prefs.padMouseSpeed > 0 ? prefs.padMouseSpeed : 1;
      /* движение: smoothstep-кривая — точные микродвижения у центра, разгон к краям */
      const curve = (v: number): number => {
        const a = Math.abs(v);
        if (a <= DEADZONE) return 0;
        const t = Math.min(1, (a - DEADZONE) / (1 - DEADZONE));
        return Math.sign(v) * (t * t * (3 - 2 * t));
      };
      const dx = curve(gp.axes[AXIS_X] ?? 0) * MAX_SPEED * spd * dt;
      const dy = curve(gp.axes[AXIS_Y] ?? 0) * MAX_SPEED * spd * dt;
      if (dx || dy) {
        st.x = Math.max(1, Math.min(window.innerWidth - 2, st.x + dx));
        st.y = Math.max(1, Math.min(window.innerHeight - 2, st.y + dy));
        moveCursor();
      }
      if (uiLock) { setTrigFlag(false); return; } // захват кнопки в «Управлении» — ничего не шлём
      /* v0.174: элемент под курсором решает, кто получает R1/R2 — мышь или игра.
         Экран игры (iframe) — игровая зона: клики гасятся, триггеры уходят в игру.
         На чистом поле (clicksOff) клики по канве карты гасятся, по кнопкам HUD — нет. */
      const elNow = elAt(st.x, st.y);
      const inZone = inGameZone(elNow);
      const fieldCanvas = !!elNow.closest('canvas'); // канва карты/редактора под курсором
      setTrigFlag(!inZone && !clicksOff); // над интерфейсом R1/R2 — кнопки мыши (насос их игре не пересылает)

      /* ---------- v0.172: ЛЕВЫЙ СТИК — ПРОКРУТКА (колёсико мыши) ----------
         Ход стика копится и щёлкает колесом порциями по 100 px (как настоящий
         ролик): синтетический wheel не прокатывает браузер сам, поэтому после
         него прокручиваем вручную ближайший прокручиваемый предок (окно
         списка, панель). Если свой обработчик колеса уже отреагировал
         (канва редактора — зум, свой скролл) — ничего руками не крутим.
         Гаснет той же кнопкой тумблера, что и клики (clicksOff), а над экраном
         игры (inZone) колесо не шлём вовсе — катим только настоящий интерфейс. */
      const sdy = curve(gp.axes[AXIS_LY] ?? 0) * MAX_SCROLL * spd * dt;
      const wheelable = !clicksOff && !inZone; // v0.174: чистое поле и игровая зона — без колеса
      if (sdy && wheelable) {
        scrollAcc += sdy;
        if (Math.abs(scrollAcc) >= SCROLL_NOTCH && now - lastWheel >= SCROLL_GAP) {
          const notch = Math.max(-120, Math.min(120, Math.round(scrollAcc)));
          scrollAcc = 0;
          lastWheel = now;
          const el = elAt(st.x, st.y);
          const ev = new WheelEvent('wheel', {
            bubbles: true, cancelable: true, composed: true, view: window,
            clientX: st.x, clientY: st.y, screenX: st.x, screenY: st.y,
            deltaY: notch, deltaMode: 0,
          });
          el.dispatchEvent(ev);
          if (!ev.defaultPrevented) {
            const box = scrollableBox(el);
            if (box) box.scrollBy(0, notch);
            else window.scrollBy(0, notch);
          }
        }
      }

      /* v0.172: ЛКМ держится на ползунке — тащим его правым стиком (значение едет за курсором) */
      if (st.lmb && st.range) {
        if (!st.range.isConnected) st.range = null;
        else setRange(st.range, rangeValueAt(st.range, st.x), false);
      }

      /* R2 → ЛКМ (край-триггер; пока держится — работает тащение)
         v0.174: нажатие гасится над игровой зоной (там R2 — триггер игры) и по
         канве чистого поля; отпускание ВСЕГДА доходит — без «залипших» кнопок. */
      const lmbNow = btnHeld(gp, BTN_LMB);
      if (lmbNow && !st.lmb && !inZone && !(clicksOff && fieldCanvas)) {
        const el = elNow;
        st.lmb = true; st.lmbEl = el; markLmb(true);
        /* v0.172: ползунок под курсором — сразу прыгнуть в точку клика (дальше тащится выше) */
        st.range = rangeAt(el);
        if (st.range) {
          setRange(st.range, rangeValueAt(st.range, st.x), false);
        } else {
          /* v0.172: текстовое поле — фокус и каретка в точку клика; список select — фокус */
          const fld = el.closest('input, textarea, [contenteditable="true"], [contenteditable=""]');
          if (fld) focusField(fld, st.x, st.y);
          const sel = el.closest('select');
          if (sel) { try { (sel as HTMLSelectElement).focus({ preventScroll: true }); } catch { /* noop */ } }
        }
        fire(el, 'pointerdown', st.x, st.y, 0, btnMask());
        fire(el, 'mousedown', st.x, st.y, 0, btnMask());
      } else if (!lmbNow && st.lmb) {
        st.lmb = false; markLmb(false);
        const el = elAt(st.x, st.y);
        fire(el, 'pointerup', st.x, st.y, 0, btnMask());
        fire(el, 'mouseup', st.x, st.y, 0, btnMask());
        if (el === st.lmbEl) { // клик — как у мыши: нажали и отпустили на том же месте (над игровой зоной нажатия не бывает — см. выше)
          const t = clickTargetFor(el);
          if (t.checkbox || t.radio) {
            /* v0.172: галочка/радио — переключаем сами (нативный клик от синтетики не приходит) */
            const inp = t.target as HTMLInputElement;
            inp.checked = t.checkbox ? !inp.checked : true;
            fire(inp, 'click', st.x, st.y, 0, 0);
            fire(inp, 'input', st.x, st.y, 0, 1);
            fire(inp, 'change', st.x, st.y, 0, 1);
          } else {
            fire(el, 'click', st.x, st.y, 0, 0);
            const sel = el.closest('select') as HTMLSelectElement | null;
            if (sel) { try { sel.showPicker?.(); } catch { /* без user-активации браузер отказывает */ } }
          }
        }
        if (st.range) { // v0.172: отпустили ползунок — финальное change (даже если увели курсор в сторону)
          if (st.range.isConnected) fire(st.range, 'change', st.x, st.y, 0, 1);
          st.range = null;
        }
        st.lmbEl = null;
      }
      /* R1 → ПКМ (контекстное меню предметов) — гашение как у ЛКМ (v0.174) */
      const rmbNow = btnHeld(gp, BTN_RMB);
      if (rmbNow && !st.rmb && !inZone && !(clicksOff && fieldCanvas)) {
        const el = elNow;
        st.rmb = true;
        fire(el, 'pointerdown', st.x, st.y, 2, btnMask());
        fire(el, 'mousedown', st.x, st.y, 2, btnMask());
        fire(el, 'contextmenu', st.x, st.y, 2, btnMask());
      } else if (!rmbNow && st.rmb) {
        st.rmb = false;
        const el = elAt(st.x, st.y);
        fire(el, 'pointerup', st.x, st.y, 2, btnMask());
        fire(el, 'mouseup', st.x, st.y, 2, btnMask());
      }
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      releaseAll(); // окно закрылось при зажатой кнопке — не оставляем «залипшее» тащение
      trigFlagPrev = null;
      try { localStorage.removeItem(TRIG_FLAG_KEY); } catch { /* noop */ } // v0.174: триггеры игре — без ограничений
      cur.remove();
    };
  }, [active]);
}

/* ---------- v0.171: КНОПКА-ТУМБЛЕР «МЫШЬ С ДЖОЙСТИКА ВКЛ/ВЫКЛ» ----------
   Работает на любом экране (по умолчанию F7 / L3, переназначается в «Управлении»).
   Сценарий: в окне задания триггеры R1/R2 заняты игрой (SNES-плечи, SEGA Z) —
   нажал тумблер, и мышь с джойстика выключилась (курсор исчез, клики не шлются);
   окно задания закрылось — GameScreen включит мышь обратно автоматически.
   Во время захвата кнопки в «Управлении» тумблер заблокирован (uiLock). */
export function usePadMouseToggle() {
  useEffect(() => {
    const flip = () => {
      if (uiLock) return;
      padMouseSetOff(!userOff);
      try { sfx.click(); } catch { /* звук не критичен */ }
    };
    /* клавиатура (по умолчанию F7) — capture, чтобы работать и над окнами */
    const onKey = (e: KeyboardEvent) => {
      const prefs = loadEmuPrefs();
      const k = (prefs.padToggleKey ?? '').toLowerCase();
      if (!k) return;
      if ((e.key ?? '').toLowerCase() !== k) return;
      const tgt = e.target as HTMLElement | null;
      if (tgt && (tgt.tagName === 'INPUT' || tgt.tagName === 'TEXTAREA' || tgt.isContentEditable || tgt.tagName === 'SELECT')) return;
      e.preventDefault();
      e.stopPropagation();
      flip();
    };
    window.addEventListener('keydown', onKey, true);
    /* кнопка джойстика (по умолчанию L3 = W3C 10) — край-триггер */
    let prev = false;
    const iv = window.setInterval(() => {
      const prefs = loadEmuPrefs();
      const idx = prefs.padTogglePad;
      if (idx === undefined || idx < 0) { prev = false; return; }
      let now = false;
      for (const gp of listGamepads()) {
        if (btnHeld(gp, idx)) { now = true; break; }
      }
      if (now && !prev) flip();
      prev = now;
    }, 66);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.clearInterval(iv);
    };
  }, []);
}
