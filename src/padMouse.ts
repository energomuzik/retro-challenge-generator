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
     • главный тумблер «Геймпад» в Опциях (prefs.gamepad === false) — как было. */
import { useEffect, useState } from 'react';
import { listGamepads, loadEmuPrefs } from './input';
import { sfx } from './sound';

/* Подсказка для окон (одна на все; имена кнопок — PS + Xbox в скобках) */
export const PAD_MOUSE_HINT = '🎮 Правый стик — курсор · R2 (RT) — ЛКМ · R1 (RB) — ПКМ';

/* ФИКСИРОВАННАЯ раскладка (W3C Standard Gamepad) — намеренно без настроек */
const AXIS_X = 2;       // правый стик, горизонталь
const AXIS_Y = 3;       // правый стик, вертикаль
const BTN_LMB = 7;      // R2 (PS) = RT (Xbox) — левая кнопка мыши
const BTN_RMB = 5;      // R1 (PS) = RB (Xbox) — правая кнопка мыши
const DEADZONE = 0.22;  // мёртвая зона стика (не ползёт от лёгкого наклона)
const MAX_SPEED = 1150; // пикселей в секунду при полном отклонении (× padMouseSpeed)

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

/* ---------- v0.171: РЕЖИМ «ТОЛЬКО КУРСОР» (клики выключены) ----------
   На чистом поле партии (все окна закрыты) курсор пусть двигается, но клики
   с джойстика не отправляются: случайное R1/R2 не «кликнет» ячейку или кнопку HUD. */
let clicksOff = false;
/** Запретить/разрешить КЛИКИ мыши с джойстика (курсор продолжает двигаться). */
export function padMouseSetClicksOff(v: boolean): void { clicksOff = v; }

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
    cur.innerHTML =
      '<svg width="27" height="27" viewBox="0 0 24 24" style="filter:drop-shadow(0 2px 3px rgba(0,0,0,0.9))">' +
      '<path d="M4 1.6 L4 18.8 L8.9 14.4 L11.8 21.3 L15.1 19.9 L12.2 13.2 L18.6 13.2 Z" fill="#ffffff" fill-opacity="0.96" stroke="#0a0c14" stroke-width="1.4" stroke-linejoin="round"/></svg>';
    document.body.appendChild(cur);
    const st = {
      x: Math.round(window.innerWidth / 2),
      y: Math.round(window.innerHeight / 2),
      lmb: false, rmb: false,
      lmbEl: null as Element | null,
      shown: false,
    };
    const place = () => { cur.style.transform = `translate(${st.x - 1}px, ${st.y - 1}px)`; };
    const show = () => { if (!st.shown) { st.shown = true; place(); cur.style.display = 'block'; } };
    const hide = () => { if (st.shown) { st.shown = false; cur.style.display = 'none'; } };
    const markLmb = (on: boolean) => {
      const path = cur.querySelector('path');
      if (path) path.setAttribute('fill', on ? '#ffd25e' : '#ffffff'); // зажатая ЛКМ — курсор желтеет
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
        st.lmbEl = null;
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
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick);
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const prefs = loadEmuPrefs();
      if (prefs.gamepad === false) { hide(); return; } // главный тумблер «Геймпад» в Опциях
      if (userOff) { releaseAll(); hide(); return; } // v0.171: выключено кнопкой/авто-режимом окон заданий
      const gp = listGamepads()[0];
      if (!gp) { hide(); return; } // пада нет — курсор не показываем, мышь реальная работает сама
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
      if (clicksOff || uiLock) return; // v0.171: только курсор — клики не отправляются
      /* R2 → ЛКМ (край-триггер; пока держится — работает тащение) */
      const lmbNow = btnHeld(gp, BTN_LMB);
      if (lmbNow && !st.lmb) {
        const el = elAt(st.x, st.y);
        st.lmb = true; st.lmbEl = el; markLmb(true);
        fire(el, 'pointerdown', st.x, st.y, 0, btnMask());
        fire(el, 'mousedown', st.x, st.y, 0, btnMask());
      } else if (!lmbNow && st.lmb) {
        st.lmb = false; markLmb(false);
        const el = elAt(st.x, st.y);
        fire(el, 'pointerup', st.x, st.y, 0, btnMask());
        fire(el, 'mouseup', st.x, st.y, 0, btnMask());
        if (el === st.lmbEl) fire(el, 'click', st.x, st.y, 0, 0); // клик — как у мыши: нажали и отпустили на том же месте
        st.lmbEl = null;
      }
      /* R1 → ПКМ (контекстное меню предметов) */
      const rmbNow = btnHeld(gp, BTN_RMB);
      if (rmbNow && !st.rmb) {
        const el = elAt(st.x, st.y);
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
