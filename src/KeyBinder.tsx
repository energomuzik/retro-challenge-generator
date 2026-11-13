import { useEffect, useRef, useState } from 'react';
import {
  keyLabel, listGamepads, loadEmuPrefs,
  saveEmuPrefs, DEFAULT_KEYS, DEFAULT_GPAD, DEFAULT_SEGA_KEYS, DEFAULT_SEGA_GPAD,
  FAMILY_ACTIONS, FAMILY_LABELS, FAMILY_KEYS_FIELD, FAMILY_PAD_FIELD, FAMILY_KEY_KIND, FAMILY_HINT,
  DEFAULT_SNES_KEYS, DEFAULT_SNES_GPAD, DEFAULT_GBA_KEYS, DEFAULT_GBA_GPAD,
  DEFAULT_PCE_KEYS, DEFAULT_PCE_GPAD, DEFAULT_A26_KEYS, DEFAULT_A26_GPAD,
  INV_KEY_DEFAULT, INV_PAD_DEFAULT, PICKUP_KEY_DEFAULT, PICKUP_PAD_DEFAULT,
  INVBACK_KEY_DEFAULT, INVBACK_PAD_DEFAULT,
  QUICKSAVE_KEY_DEFAULT, QUICKSAVE_PAD_DEFAULT,
  FURN_KEY_DEFAULT, FURN_PAD_DEFAULT,
  PADTOGGLE_KEY_DEFAULT, PADTOGGLE_PAD_DEFAULT,
  ZOOMIN_KEY_DEFAULT, ZOOMIN_PAD_DEFAULT, ZOOMOUT_KEY_DEFAULT, ZOOMOUT_PAD_DEFAULT,
  MAP_KEY_DEFAULT, MAP_PAD_DEFAULT,
  PADMOUSE_SPEED_DEFAULT, padBtnName, padBtnLabel,
  type EmuPrefs, type PadFamily,
} from './input';
import { padMouseSetUiLock, PAD_MOUSE_HINT_FULL } from './padMouse';
import { sfx } from './sound';
import { Toggle } from './ui'; // v0.184: галочки джоемыши стали переключателями в общем стиле опций

type Capture = { kind: 'key' | 'gpad'; action: string } | null;

/* v0.141: глобальные кнопки на поле (вне раскладок консолей) — список захвата;
   v0.170: + «выход из окна / назад» (инвентарь/печь/приставка);
   v0.171: + быстрое сохранение, открыть печь/приставку, тумблер мыши с джойстика, зум карты */
const GLOBAL_ACTIONS = ['quickLoad', 'quickSave', 'invOpen', 'itemPickup', 'furnOpen', 'invBack', 'padToggle', 'mapOpen', 'zoomIn', 'zoomOut'] as const;
type GlobalAction = (typeof GLOBAL_ACTIONS)[number];
const GLOBAL_FIELDS: Record<GlobalAction, string> = {
  quickLoad: 'quickKey', quickSave: 'quickSaveKey', invOpen: 'invKey', itemPickup: 'pickupKey',
  furnOpen: 'furnKey', invBack: 'invBackKey', padToggle: 'padToggleKey', mapOpen: 'mapKey', zoomIn: 'zoomInKey', zoomOut: 'zoomOutKey',
};
const GLOBAL_PAD_FIELDS: Record<GlobalAction, string> = {
  quickLoad: 'quickPad', quickSave: 'quickSavePad', invOpen: 'invPad', itemPickup: 'pickupPad',
  furnOpen: 'furnPad', invBack: 'invBackPad', padToggle: 'padTogglePad', mapOpen: 'mapPad', zoomIn: 'zoomInPad', zoomOut: 'zoomOutPad',
};
const GLOBAL_TITLES: Record<GlobalAction, string> = {
  quickLoad: '⚡ Быстрая загрузка · одна на все консоли',
  quickSave: '💾 Быстрое сохранение · одна на все консоли',
  invOpen: '🎒 Открыть/закрыть ИНВЕНТАРЬ · на поле и в окне печи',
  itemPickup: '✋ ПОДНЯТЬ ПРЕДМЕТ с земли · режим FRENDY',
  furnOpen: '🔥 ОТКРЫТЬ ПЕЧЬ / ПРИСТАВКУ · режим FRENDY',
  invBack: '🚪 ВЫХОД ИЗ ОКНА / НАЗАД · инвентарь, печь, приставка',
  padToggle: '🖱 МЫШЬ С ДЖОЙСТИКА вкл/выкл · для игр с триггерами',
  mapOpen: '🗺 КАРТА МИРА — БЫСТРЫЙ ВЫЗОВ · одной кнопкой',
  zoomIn: '🔍 ПРИБЛИЗИТЬ КАРТУ · L1 по умолчанию',
  zoomOut: '🔍 ОТДАЛИТЬ КАРТУ · L2 по умолчанию',
};
const GLOBAL_DESCS: Record<GlobalAction, string> = {
  quickLoad: 'В «Запуске эмулятора» — мгновенно грузит ВЫДЕЛЕННОЕ кликом сохранение; во время задания — перезапускает задание (в VERSUS — за 1 бронзу, как кнопка «Перезапуск»). Работает и когда фокус у эмулятора. По умолчанию F6.',
  quickSave: 'Парная к быстрой загрузке: в «Запуске эмулятора» — перезаписывает ВЫДЕЛЕННОЕ кликом сохранение текущим состоянием игры; в окне задания — ставит СВОЮ точку возврата: «Перезапуск» и F6 вернут именно сюда (чужие игроки и общий сейв задания не задеваются). По умолчанию F5 / R3 (клик правым стиком).',
  invOpen: 'Открывает и закрывает ИНВЕНТАРЬ на поле игры. В FRENDY — рюкзак-сетка в стиле Diablo (перетаскивайте предметы, ПКМ — меню). Закрывает и окно ПЕЧИ. По умолчанию Tab / кнопка 3 (Y / треугольник).',
  itemPickup: 'Поднимает предмет, на котором стоит фишка (режим FRENDY): микросхемы, картриджи, аптечки, кофе. Нет места в рюкзаке — предмет не поднять! Работает и рядом с печью/приставкой (с v0.147). По умолчанию F / кнопка 2 (X / квадрат).',
  furnOpen: 'Открывает окно ПЕЧИ или ПРИСТАВКИ, когда фишка рядом с ними (режим FRENDY). По умолчанию E / крест (A на Xbox) — как просили: «поднять — квадрат, а печь/приставку — крестик». Раньше открывали любые лицевые кнопки — теперь одна, чтобы лицевые не спорили между собой.',
  invBack: 'Закрывает открытые окна на поле: ИНВЕНТАРЬ, окно ПЕЧИ, окно ПРИСТАВКИ — «назад», как на консолях. По умолчанию Esc / кнопка 1 (B / круг).',
  padToggle: 'Выключает/включает мышь с джойстика (правый стик + R2/R1). Нужна, когда триггеры заняты игрой (у SNES плечи R/L, у SEGA — Z/Y): нажали — курсор с кликами выключился, играете спокойно; окно задания закрыли (победа/поражение/«Уйти») — мышь включилась САМА. По умолчанию F7 / L3 (клик левым стиком).',
  mapOpen: 'Открывает и закрывает КАРТУ МИРА одним нажатием — то же, что кнопка «Карта мира» на панели вверху (рядом с «Инвентарём»): сбрасывает зум и панораму, повторное нажатие возвращает «К игроку». Работает во всех режимах, где есть карта. По умолчанию M / кнопка 8 — SELECT (у Xbox эта кнопка называется BACK, на новых падах — VIEW).',
  zoomIn: 'Приближает карту: «Карта мира», «Глянуть карту мира» и осмотр поля со своей фишки (как колесо мыши). Также работает в редакторе карт. По умолчанию L1 / «+».',
  zoomOut: 'Отдаляет карту: «Карта мира», «Глянуть карту мира» и осмотр поля со своей фишки. Также работает в редакторе карт. По умолчанию L2 / «-».',
};

const MODES: PadFamily[] = ['nes', 'sega', 'snes', 'gba', 'pce', 'a26'];

const FAMILY_DEFAULTS: Record<PadFamily, { keys: Record<string, string>; pad: Record<string, number> }> = {
  nes: { keys: DEFAULT_KEYS, pad: DEFAULT_GPAD },
  sega: { keys: DEFAULT_SEGA_KEYS, pad: DEFAULT_SEGA_GPAD },
  snes: { keys: DEFAULT_SNES_KEYS, pad: DEFAULT_SNES_GPAD },
  gba: { keys: DEFAULT_GBA_KEYS, pad: DEFAULT_GBA_GPAD },
  pce: { keys: DEFAULT_PCE_KEYS, pad: DEFAULT_PCE_GPAD },
  a26: { keys: DEFAULT_A26_KEYS, pad: DEFAULT_A26_GPAD },
};

const MODE_TITLES: Record<PadFamily, string> = {
  nes: 'NES', sega: 'SEGA Genesis', snes: 'SNES', gba: 'Game Boy Advance',
  pce: 'PC Engine', a26: 'Atari 2600',
};

/* e.key-значения (нижний регистр) в человекочитаемый вид (SEGA-стиль). */
const EKEY_LABELS: Record<string, string> = {
  arrowup: '↑', arrowdown: '↓', arrowleft: '←', arrowright: '→',
  shift: 'Shift', control: 'Ctrl', alt: 'Alt', enter: 'Enter', space: 'Пробел', tab: 'Tab', escape: 'Esc',
};

function ekeyLabel(k: string): string {
  return EKEY_LABELS[k] ?? k;
}

/* v0.141: подпись клавиши глобальных кнопок (e.key в нижнем регистре → человекочитаемо) */
function globalKeyLabel(k: string): string {
  if (!k) return '—';
  if (k === 'space') return 'Пробел';
  if (k === 'shift') return 'Shift';
  if (k === 'control') return 'Ctrl';
  if (k === 'alt') return 'Alt';
  if (k === 'enter') return 'Enter';
  if (k === 'tab') return 'Tab';
  return k.length === 1 ? k.toUpperCase() : k;
}

/**
 * Редактор управления: клавиатура (захват по нажатию) и геймпад (захват кнопки).
 * mode — семейство раскладки: 'nes' (NES и Game Boy/Color), 'sega' (Genesis,
 * Master System, Game Gear и 32X), 'snes', 'gba', 'pce', 'a26'.
 * NES хранит e.code, остальные — e.key (нижний регистр, как читает ядро EmulatorJS).
 * Работает «на лету»: сохранили — эмуляторы подхватили без перезапуска.
 */
export default function KeyBinder({ compact = false, mode = 'nes' }: { compact?: boolean; mode?: PadFamily }) {
  const fam: PadFamily = MODES.includes(mode) ? mode : 'nes';
  const isCode = FAMILY_KEY_KIND[fam] === 'code';
  const keysField = FAMILY_KEYS_FIELD[fam];
  const padField = FAMILY_PAD_FIELD[fam];
  const actions = FAMILY_ACTIONS[fam];
  const labels = FAMILY_LABELS[fam];
  const defaults = FAMILY_DEFAULTS[fam];
  const [prefs, setPrefs] = useState<EmuPrefs>(() => loadEmuPrefs());
  const [capture, setCapture] = useState<Capture>(null);
  const [pads, setPads] = useState<Gamepad[]>(() => listGamepads());
  const captureRef = useRef<Capture>(null);
  captureRef.current = capture;

  const update = (p: EmuPrefs) => {
    setPrefs(p);
    saveEmuPrefs(p);
  };

  const keysOf = () => prefs[keysField] as Record<string, string>;
  const padOf = () => prefs[padField] as Record<string, number>;

  /* захват клавиши: NES — e.code; остальные — e.key (нижний регистр, как читает ядро).
     v0.107: action 'quickLoad' — глобальная клавиша «Быстрой загрузки» (e.key, вне семейств).
     v0.141: 'invOpen' / 'itemPickup' — глобальные кнопки поля (e.key, вне семейств).
     v0.171: + quickSave/furnOpen/padToggle/zoomIn/zoomOut (e.key, вне семейств). */
  useEffect(() => {
    if (!capture || capture.kind !== 'key') return;
    const onKey = (e: KeyboardEvent) => {
      e.preventDefault();
      if (e.code === 'Escape') { setCapture(null); return; }
      const gi = capture.kind === 'key' && (GLOBAL_ACTIONS as readonly string[]).includes(capture.action)
        ? (capture.action as GlobalAction) : null;
      if (gi) {
        const keyName = e.key === ' ' ? 'space' : e.key.toLowerCase();
        update({ ...prefs, [GLOBAL_FIELDS[gi]]: keyName } as EmuPrefs);
        setCapture(null);
        sfx.coin();
        return;
      }
      if (isCode) {
        update({ ...prefs, [keysField]: { ...keysOf(), [capture.action]: e.code } } as EmuPrefs);
      } else {
        const keyName = e.key === ' ' ? 'space' : e.key.toLowerCase();
        update({ ...prefs, [keysField]: { ...keysOf(), [capture.action]: keyName } } as EmuPrefs);
      }
      setCapture(null);
      sfx.coin();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [capture, prefs, fam]);

  /* v0.171: пока «Управление» ловит кнопку/клавишу — тумблер мыши с джойстика заблокирован:
   нажатие, которым назначают кнопку, не гасит курсор посреди настройки */
  useEffect(() => {
    padMouseSetUiLock(!!capture);
    return () => padMouseSetUiLock(false);
  }, [capture]);

  /* захват кнопки геймпада + список подключённых падов.
     Ждём только НОВОЕ нажатие: на старте захвата запоминаем уже зажатые кнопки
     (baseline) и держим паузу ~300 мс — иначе «будящая» кнопка падка (браузер
     видит пад только после первого нажатия) или ещё не отпущенная кнопка
     предыдущего назначения вписывались сами. Порог — value>0.5, чтобы
     полузажатые триггеры не ловились. */
  const gpCapRef = useRef<{ baseline: boolean[]; since: number } | null>(null);
  useEffect(() => {
    if (!capture || capture.kind !== 'gpad') { gpCapRef.current = null; return; }
    const baseline: boolean[] = [];
    for (const gp of listGamepads()) {
      gp.buttons.forEach((b, i) => { if (b.pressed || b.value > 0.5) baseline[i] = true; });
    }
    gpCapRef.current = { baseline, since: Date.now() };
  }, [capture]);
  useEffect(() => {
    const t = setInterval(() => {
      setPads(listGamepads());
      const c = captureRef.current;
      const st = gpCapRef.current;
      if (!c || c.kind !== 'gpad' || !st) return;
      if (Date.now() - st.since < 300) return;
      for (const gp of listGamepads()) {
        const bi = gp.buttons.findIndex((b, i) => !st.baseline[i] && (b.pressed || b.value > 0.5));
        if (bi >= 0) {
          setPrefs((prev) => {
            /* v0.107: quickLoad — глобальная кнопка пада (вне семейств); v0.141: + инвентарь и подъём;
               v0.171: + быстрое сохранение, печь/приставка, тумблер мыши, зум карты */
            let next = prev;
            const gi = (GLOBAL_ACTIONS as readonly string[]).includes(c.action) ? (c.action as GlobalAction) : null;
            if (gi) next = { ...prev, [GLOBAL_PAD_FIELDS[gi]]: bi } as EmuPrefs;
            else next = { ...prev, [padField]: { ...(prev[padField] as Record<string, number>), [c.action]: bi } } as EmuPrefs;
            saveEmuPrefs(next);
            return next;
          });
          setCapture(null);
          sfx.coin();
          return;
        }
      }
    }, 80);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fam]);

  /* сброс ТОЛЬКО текущего семейства (чужие раскладки не трогаем; быстрая загрузка не сбрасывается) */
  const reset = () => {
    update({ ...prefs, [keysField]: { ...defaults.keys }, [padField]: { ...defaults.pad } } as EmuPrefs);
    sfx.fail();
  };

  /* v0.107–v0.171: подписи клавиш глобальных кнопок (e.key в нижнем регистре → человекочитаемо) */
  const gKeyLabel = (v: string | undefined, def: string): string => {
    const k = (v ?? def).toLowerCase();
    if (!k) return '—';
    if (/^f\d{1,2}$/.test(k)) return k.toUpperCase();
    if (k === '+') return '+';
    if (k === '-') return '-';
    return globalKeyLabel(k);
  };
  const quickKeyLabel = gKeyLabel(prefs.quickKey, '');
  const quickSaveKeyLabel = gKeyLabel(prefs.quickSaveKey, QUICKSAVE_KEY_DEFAULT);
  const invKeyLabel = gKeyLabel(prefs.invKey, INV_KEY_DEFAULT);
  const pickupKeyLabel = gKeyLabel(prefs.pickupKey, PICKUP_KEY_DEFAULT);
  const furnKeyLabel = gKeyLabel(prefs.furnKey, FURN_KEY_DEFAULT);
  const invBackKeyLabel = gKeyLabel(prefs.invBackKey, INVBACK_KEY_DEFAULT);
  const padToggleKeyLabel = gKeyLabel(prefs.padToggleKey, PADTOGGLE_KEY_DEFAULT);
  const mapKeyLabel = gKeyLabel(prefs.mapKey, MAP_KEY_DEFAULT);
  const zoomInKeyLabel = gKeyLabel(prefs.zoomInKey, ZOOMIN_KEY_DEFAULT);
  const zoomOutKeyLabel = gKeyLabel(prefs.zoomOutKey, ZOOMOUT_KEY_DEFAULT);
  const globalKeyLbl: Record<GlobalAction, string> = {
    quickLoad: quickKeyLabel, quickSave: quickSaveKeyLabel, invOpen: invKeyLabel, itemPickup: pickupKeyLabel,
    furnOpen: furnKeyLabel, invBack: invBackKeyLabel, padToggle: padToggleKeyLabel,
    mapOpen: mapKeyLabel, zoomIn: zoomInKeyLabel, zoomOut: zoomOutKeyLabel,
  };
  /* v0.171: подписи кнопок пада глобальных действий — с именами (ДЖОЙ 4 · L1 (LB)):
   заказчик: «на иксбоксовском джое постоянно забываю как называются R1 и R2» */
  const globalPadDef: Record<GlobalAction, number | undefined> = {
    quickLoad: undefined, quickSave: QUICKSAVE_PAD_DEFAULT, invOpen: INV_PAD_DEFAULT, itemPickup: PICKUP_PAD_DEFAULT,
    furnOpen: FURN_PAD_DEFAULT, invBack: INVBACK_PAD_DEFAULT, padToggle: PADTOGGLE_PAD_DEFAULT,
    mapOpen: MAP_PAD_DEFAULT, zoomIn: ZOOMIN_PAD_DEFAULT, zoomOut: ZOOMOUT_PAD_DEFAULT,
  };
  const globalPadLbl = (ga: GlobalAction): string => {
    if (ga === 'quickLoad') return prefs.quickPad !== undefined && prefs.quickPad >= 0 ? padBtnLabel(prefs.quickPad) : 'ДЖОЙ —';
    const v = (prefs as unknown as Record<string, unknown>)[GLOBAL_PAD_FIELDS[ga]] as number | undefined;
    return padBtnLabel(v, globalPadDef[ga]);
  };

  const btnCls = (active: boolean) =>
    `font-pixel text-[9px] px-2 py-1.5 border-2 transition-colors cursor-pointer min-w-[64px] text-center ${
      active ? 'border-magma text-magma blink-hard bg-magma/10' : 'border-edge2 text-paper hover:border-gold hover:text-gold'
    }`;

  return (
    <div className="space-y-3">
      <div className={`grid ${compact ? 'grid-cols-2' : 'grid-cols-2 sm:grid-cols-4'} gap-2`}>
        {actions.map((a) => (
          <div key={a} className="border-2 border-edge bg-[rgba(0,0,0,0.25)] px-2.5 py-2">
            <div className="tick-label text-faint mb-1.5">{labels[a]}</div>
            <div className="flex flex-col gap-1.5">
              <button
                onClick={() => { setCapture({ kind: 'key', action: a }); sfx.hover(); }}
                className={btnCls(capture?.kind === 'key' && capture.action === a)}
                title="Назначить клавишу"
              >
                {capture?.kind === 'key' && capture.action === a ? 'НАЖМИТЕ…' : isCode ? keyLabel(keysOf()[a] ?? '') : ekeyLabel(keysOf()[a] ?? '')}
              </button>
              <button
                onClick={() => { setCapture({ kind: 'gpad', action: a }); sfx.hover(); }}
                className={btnCls(capture?.kind === 'gpad' && capture.action === a)}
                title="Назначить кнопку геймпада"
              >
                {capture?.kind === 'gpad' && capture.action === a ? 'КНОПКУ…' : padBtnLabel(padOf()[a] ?? 0)}
              </button>
            </div>
          </div>
        ))}
      </div>
      {/* v0.107→v0.171: ГЛОБАЛЬНЫЕ кнопки (вне раскладок консолей) */}
      <div className="border-2 border-gold/50 bg-[rgba(255,207,63,0.06)] px-2.5 py-2 space-y-2">
        {GLOBAL_ACTIONS.map((ga) => {
          const isKey = capture?.kind === 'key' && capture.action === ga;
          const isPad = capture?.kind === 'gpad' && capture.action === ga;
          return (
            <div key={ga} className={ga !== 'quickLoad' ? 'border-t-2 border-gold/20 pt-2' : ''}>
              <div className="tick-label text-gold mb-1">{GLOBAL_TITLES[ga]}</div>
              <p className="text-[10px] text-dim leading-snug mb-2">{GLOBAL_DESCS[ga]}</p>
              <div className="grid grid-cols-2 gap-2 max-w-[320px]">
                <button
                  onClick={() => { setCapture({ kind: 'key', action: ga }); sfx.hover(); }}
                  className={btnCls(isKey)}
                  title="Назначить клавишу"
                >
                  {isKey ? 'НАЖМИТЕ…' : globalKeyLbl[ga]}
                </button>
                <button
                  onClick={() => { setCapture({ kind: 'gpad', action: ga }); sfx.hover(); }}
                  className={btnCls(isPad)}
                  title="Назначить кнопку геймпада"
                >
                  {isPad ? 'КНОПКУ…' : globalPadLbl(ga)}
                </button>
              </div>
            </div>
          );
        })}
      </div>
      {/* v0.170/171: МЫШЬ С ДЖОЙСТИКА — раскладка ФИКСИРОВАННАЯ (показываем, не меняем) + чувствительность */}
      <div className="border-2 border-sky/50 bg-[rgba(70,150,255,0.06)] px-2.5 py-2 space-y-2">
        <div className="tick-label text-sky mb-1">🖱 МЫШЬ С ДЖОЙСТИКА · ФИКСИРОВАННО — НЕ ПЕРЕНАЗНАЧАЕТСЯ</div>
        <p className="text-[10px] text-dim leading-snug">
          {PAD_MOUSE_HINT_FULL} — работает во всех меню, редакторах и окнах (инвентарь, печь, приставка,
          меню задания). Имена у всех падов одинаковые: у Xbox R1 = RB (правый бампер), R2 = RT
          (правый триггер). Кнопку-тумблер мыши (вкл/выкл) назначайте выше — она переназначается,
          и она же гасит прокрутку левым стиком во время задания. Курсор — в ретро-стиле проекта;
          ползунки тянутся (клик — прыжок, держишь — тащится), текстовые поля открываются кликом,
          переключатели щёлкаются. Этот ползунок чувствительности тоже можно тянуть джойстиком.
        </p>
        <div>
          <div className="tick-label text-faint mb-1">
            Чувствительность мыши (правый стик): ×{(prefs.padMouseSpeed ?? PADMOUSE_SPEED_DEFAULT).toFixed(2).replace('.', ',')}
          </div>
          <div className="flex items-center gap-3 max-w-[420px]">
            <input
              type="range"
              min={0.3}
              max={2.5}
              step={0.05}
              value={prefs.padMouseSpeed ?? PADMOUSE_SPEED_DEFAULT}
              onChange={(e) => update({ ...prefs, padMouseSpeed: Number(e.target.value) } as EmuPrefs)}
              className="flex-1 accent-[var(--color-sky)] cursor-pointer"
            />
            <button
              onClick={() => { update({ ...prefs, padMouseSpeed: PADMOUSE_SPEED_DEFAULT } as EmuPrefs); sfx.fail(); }}
              className="btn-ghost pixel-corners px-2 py-1 text-[9px] uppercase font-display shrink-0"
              title="Вернуть обычную скорость"
            >
              Сброс
            </button>
          </div>
          <p className="text-[9px] text-faint mt-1 leading-snug">0,3 — медленно (точно по сетке рюкзака) · 1 — обычная · 2,5 — очень быстро</p>
        </div>
        {/* v0.184: вместо галочек — ПЕРЕКЛЮЧАТЕЛИ (Toggle) в общем стиле экрана «Опции».
            Все три ВКЛ по умолчанию (у старых сохранённых настроек поле отсутствует = ВКЛ,
            принудительной смены нет). Главный снят — два пункта ниже приглушены и недоступны. */}
        <div className="space-y-2 pt-1">
          <Toggle
            checked={prefs.padMouseEnabled !== false}
            onChange={(v) => update({ ...prefs, padMouseEnabled: v } as EmuPrefs)}
            label="Мышь с джойстика включена"
            hint="Главный рубильник. Снят — курсора с джоя нет вообще: не поднимется ни автоматикой, ни кнопкой-тумблером. Включать обратно — только этим переключателем."
          />
          <div className={prefs.padMouseEnabled === false ? 'space-y-2 opacity-50' : 'space-y-2'}>
            <Toggle
              disabled={prefs.padMouseEnabled === false}
              checked={prefs.padMouseAutoOn !== false}
              onChange={(v) => update({ ...prefs, padMouseAutoOn: v } as EmuPrefs)}
              label="Включать мышь при обнаружении джоя"
              hint="Втыкнули геймпад (или страница открылась с уже подключённым) — мышь с джоя поднимается сама. Переключатель снят: при обнаружении мышь гаснет — включать самому кнопкой-тумблером (по умолчанию L3 / F7)."
            />
            <Toggle
              disabled={prefs.padMouseEnabled === false}
              checked={prefs.padMouseAutoTask !== false}
              onChange={(v) => update({ ...prefs, padMouseAutoTask: v } as EmuPrefs)}
              label="Автоматика задания: при игре выкл, после — вкл"
              hint="Эмулятор крутится в задании (или в «Запуске эмулятора») — мышь выключается сама; прошёл, проиграл, закрыл игру — включается обратно. Включил тумблером сам во время игры — при закрытии ничего не трогаем. Переключатель снят: вокруг игры ничего не происходит — выключать самому."
            />
          </div>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <p className="text-[11px] text-dim max-w-md leading-relaxed">
          Верхняя кнопка — клавиатура, нижняя — геймпад. Крестовина падка дублируется левым стиком. {compact ? 'Раскладка применяется сразу, прямо во время задания.' : ''}
          {pads.length === 0
            ? ' Геймпад не обнаружен — подключите и нажмите на нём кнопку.'
            : ` Геймпадов подключено: ${pads.length}.`}
        </p>
        <button
          onClick={reset}
          className="btn-ghost pixel-corners px-3 py-1.5 text-[11px] uppercase font-display inline-flex items-center gap-2"
        >
          Сбросить раскладку
        </button>
      </div>
      {/* подсказка дефолтной раскладки семейства (невидимый носитель данных для тестов/UI) */}
      <span data-family-hint={FAMILY_HINT[fam]} data-family={MODE_TITLES[fam]} className="hidden" />
    </div>
  );
}
