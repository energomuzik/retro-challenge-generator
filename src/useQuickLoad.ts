import { useEffect, useRef, useState } from 'react';
import { loadEmuPrefs, saveEmuPrefs, listGamepads, PREFS_EVENT, type EmuPrefs } from './input';

/* ---------- v0.107: БЫСТРАЯ ЗАГРУЗКА (глобальная кнопка «Управления») ----------
   Одна привязка на всё приложение (клавиша + кнопка геймпада), вне раскладок консолей.
   Работает ВЕЗДЕ, где подключён хук:
   • «Запуск эмулятора» — грузит ВЫДЕЛЕННОЕ кликом сохранение текущего рома;
   • во время задания — ПЕРЕЗАПУСКАЕТ задание (та же логика, что кнопка «Перезапуск»).
   Клавиатура ловится двумя путями: окно приложения (когда фокус у него) и ПЕРЕСЫЛКА
   из iframe эмулятора (SegaBox шлёт {type:'emu-key', key} — фокус у игры, а нажать
   F6 хочется, не отрываясь от геймплея). Геймпад опрашивается напрямую — Gamepad API
   виден окну независимо от фокуса. По умолчанию F6; переназначается в «Управлении». */

export function quickKeyLabelOf(p: EmuPrefs): string {
  const k = (p.quickKey ?? '').toLowerCase();
  if (!k) return '';
  if (/^f\d{1,2}$/.test(k)) return k.toUpperCase();
  if (k === 'space') return 'Пробел';
  if (k === 'shift') return 'Shift';
  if (k === 'control') return 'Ctrl';
  if (k === 'alt') return 'Alt';
  if (k === 'enter') return 'Enter';
  if (k === 'tab') return 'Tab';
  return k.length === 1 ? k.toUpperCase() : k;
}

export function quickPadLabelOf(p: EmuPrefs): string {
  return p.quickPad === undefined || p.quickPad === null || (p.quickPad as number) < 0 ? '' : `Джой ${p.quickPad}`;
}

export function useQuickLoadPrefs(): EmuPrefs {
  const [prefs, setPrefs] = useState<EmuPrefs>(() => loadEmuPrefs());
  useEffect(() => {
    const on = () => setPrefs(loadEmuPrefs());
    window.addEventListener(PREFS_EVENT, on);
    window.addEventListener('storage', on);
    return () => { window.removeEventListener(PREFS_EVENT, on); window.removeEventListener('storage', on); };
  }, []);
  return prefs;
}

/**
 * Подключает глобальную кнопку быстрой загрузки.
 * onFire вызывается на нажатие назначенной клавиши/кнопки джойстика
 * (клавиша — с фокуса окна ИЛИ из iframe эмулятора; кнопка пада — по фронту).
 */
export function useQuickLoad(onFire: () => void): void {
  const fireRef = useRef(onFire);
  fireRef.current = onFire;
  const [prefs, setPrefs] = useState<EmuPrefs>(() => loadEmuPrefs());
  useEffect(() => {
    const on = () => setPrefs(loadEmuPrefs());
    window.addEventListener(PREFS_EVENT, on);
    window.addEventListener('storage', on);
    return () => { window.removeEventListener(PREFS_EVENT, on); window.removeEventListener('storage', on); };
  }, []);
  const prefsRef = useRef(prefs);
  prefsRef.current = prefs;

  /* клавиатура: фокус у ОКНА приложения (не в поле ввода) */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const qk = (prefsRef.current.quickKey ?? '').toLowerCase();
      if (!qk) return;
      const t = e.target as HTMLElement | null;
      const typing = !!t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable);
      if (typing) return;
      if ((e.key ?? '').toLowerCase() !== qk) return;
      e.preventDefault();
      e.stopPropagation();
      fireRef.current();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, []);

  /* клавиатура: фокус у IFRAME эмулятора — SegaBox пересылает нажатия ({type:'emu-key'}) */
  useEffect(() => {
    const onMsg = (ev: MessageEvent) => {
      const d = ev.data as { type?: string; key?: string } | null;
      if (!d || d.type !== 'emu-key') return;
      const qk = (prefsRef.current.quickKey ?? '').toLowerCase();
      if (!qk) return;
      if ((d.key ?? '').toLowerCase() !== qk) return;
      fireRef.current();
    };
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  /* геймпад: опрос с фронтом (нажатие = одно срабатывание) */
  useEffect(() => {
    let prev = false;
    const t = setInterval(() => {
      const qp = prefsRef.current.quickPad;
      if (qp === undefined || qp === null || qp < 0) { prev = false; return; }
      let pressed = false;
      for (const gp of listGamepads()) {
        const b = gp.buttons[qp];
        if (b && (b.pressed || b.value > 0.5)) { pressed = true; break; }
      }
      if (pressed && !prev) fireRef.current();
      prev = pressed;
    }, 80);
    return () => clearInterval(t);
  }, []);
}

/** Записать привязку быстрой загрузки (клавиша e.key в нижнем регистре / индекс кнопки пада). */
export function saveQuickBind(patch: { quickKey?: string; quickPad?: number }): void {
  const p = loadEmuPrefs();
  saveEmuPrefs({ ...p, ...patch } as EmuPrefs);
}
