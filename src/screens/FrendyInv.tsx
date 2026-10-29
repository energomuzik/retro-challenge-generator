import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FRENDY_INV_COLS, FRENDY_INV_ROWS, RUBG_ITEMS, cartFitsConsole, rubgGridFits, rubgItemSize } from '../types';
import type { CartRegion } from '../types';
import { frendyConsoleImg } from '../consoleAssets'; // v0.144: фото приставок (Dendy/Famicom/NES)
import type { RubgItem, RubgItemKind } from '../types';
import { GhostBtn, Ic } from '../ui';
import { sfx } from '../sound';

/* ---------- v0.141 FRENDY: DIABLO-ПОДОБНЫЙ ИНВЕНТАРЬ ----------
   • РЮКЗАК — СЕТКА 10×6, предметы лежат КАРТИНКАМИ и занимают столько клеток,
     сколько им положено: микросхема 2×2, картридж Dendy 2×2, кофе 1×1, аптечка 2×3.
   • ПОДНЯТЬ предмет с земли можно кнопкой (E / джойстик / клик по предмету); если в
     сетке НЕТ МЕСТА — предмет НЕ ПОДНЯТЬ (движок оставит его на земле, клиент
     покажет «отскок» — как в Diablo 1).
   • В окне: предметы ПЕРЕТАСКИВАЮТСЯ (ЛКМ/палец) — внутри сетки перекладываются,
     ЗА ПРЕДЕЛЫ окна — выбрасываются на землю, НА ПЕЧЬ (в окне печи) — сжигаются.
   • ПКМ по предмету (на телефоне — долгое нажатие) — КОНТЕКСТНОЕ МЕНЮ:
     использовать / сжечь в печи / выбросить.
   • Двигок авторитетен: диспатчи frendyPickup / frendyInvMove / frendyBurn /
     frendyDrop проверяют всё заново на хосте; клиентская проверка — только UX. */

const CELL_PX = 46; // размер клетки сетки на экране

type DropRes = { kind: 'furnace' } | { kind: 'grid'; gx: number; gy: number } | { kind: 'floor' };

interface DragInfo { itemId: string; kind: RubgItemKind; from: 'grid' | 'tray'; x: number; y: number; moved: boolean }

/* Общий «захват предмета указателем» (ЛКМ мыши / палец телефона).
   Пока тянем — ghost следует за пальцем; отпустили — onEnd получает координаты отпускания
   (куда именно упало — печь / клетка сетки / за окном — решает вызывающий код по своим ref'ам).
   onFirstMove — например, снять таймер долгого нажатия. */
function useInvDrag(onEnd: (info: DragInfo) => void, onFirstMove?: () => void) {
  const [drag, setDrag] = useState<DragInfo | null>(null);
  /* v0.145: ОТМЕНА ПЕРЕТАСКИВАНИЯ при размонтировании окна (принудительное закрытие —
     Френди ПОЙМАЛ и утащил, конец партии): «подвешенный» предмет не должен никуда
     деваться — слушатели указателя снимаются, onEnd НЕ вызывается. Предмет ОСТАЁТСЯ
     В РЮКЗАКЕ: движку ничего не отправлено (вставка/выброс диспатчатся только при
     отпускании). Раньше отпускание мыши после закрытия окна решало «за окном → на
     землю» (ref'ы уже пусты) — и картридж ПРОПАДАЛ у поимканного игрока. */
  const cancelRef = useRef<(() => void) | null>(null);
  useEffect(() => () => { cancelRef.current?.(); }, []);
  const start = (e: React.PointerEvent, itemId: string, kind: RubgItemKind, from: 'grid' | 'tray') => {
    if (e.pointerType === 'mouse' && e.button !== 0) return; // перетаскивание — только ЛКМ (ПКМ — меню)
    e.preventDefault();
    const sx = e.clientX, sy = e.clientY;
    let moved = false;
    let done = false;
    const move = (ev: PointerEvent) => {
      if (!moved && Math.hypot(ev.clientX - sx, ev.clientY - sy) > 6) { moved = true; onFirstMove?.(); }
      if (moved) setDrag({ itemId, kind, from, x: ev.clientX, y: ev.clientY, moved });
    };
    const up = (ev: PointerEvent) => {
      done = true;
      cancelRef.current = null;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      setDrag(null);
      if (moved) onEnd({ itemId, kind, from, x: ev.clientX, y: ev.clientY, moved: true });
    };
    cancelRef.current = () => {
      if (done) return;
      done = true;
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      setDrag(null);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
  };
  return { drag, start };
}

/* v0.143: МИКРОСХЕМА — ТОЧНАЯ КОПИЯ ИКОНКИ С ПОЛА (заказчик: «иконки в инвентаре должны
   совпадать с теми, что на полу — те, что на полу, и есть оригинал»). На поле чип рисуется
   в render.ts (drawFrendyChip): зелёная плата, золотые ножки, синий кристалл, красный
   светодиод — этот SVG повторяет тот же рисунок, и в рюкзаке видна ТА ЖЕ микросхема. */
export function ChipArt({ px, className }: { px: number; className?: string }) {
  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 36 32"
      className={className}
      style={{ imageRendering: 'pixelated', userSelect: 'none', WebkitUserSelect: 'none' }}
      aria-label="Микросхема Френди"
      role="img"
    >
      {/* золотые ножки: 5 сверху и 5 снизу, по краям торчат за плату — как на поле */}
      {[-2, -1, 0, 1, 2].map((i) => <rect key={`t${i}`} x={18 + i * 5 - 1.2} y={2} width={2.4} height={6} fill="#c9a13c" />)}
      {[-2, -1, 0, 1, 2].map((i) => <rect key={`b${i}`} x={18 + i * 5 - 1.2} y={24} width={2.4} height={6} fill="#c9a13c" />)}
      {/* зелёная плата + светлый срез сверху */}
      <rect x={9} y={8} width={18} height={16} fill="#1f7a3d" />
      <rect x={9} y={8} width={18} height={3} fill="rgba(255,255,255,0.14)" />
      {/* дорожки */}
      <path d="M11 21 h5 v-4 h5" fill="none" stroke="rgba(200,255,210,0.5)" strokeWidth={1} />
      <path d="M25 11 h-5" fill="none" stroke="rgba(200,255,210,0.5)" strokeWidth={1} />
      {/* синий кристалл с бликом */}
      <rect x={14} y={12} width={8} height={7} fill="#12335a" />
      <rect x={14} y={12} width={8} height={2} fill="rgba(255,255,255,0.25)" />
      {/* красный светодиод с ореолом */}
      <circle cx={24} cy={20} r={3.6} fill="rgba(255,70,60,0.25)" />
      <circle cx={24} cy={20} r={2.2} fill="#ff463c" />
    </svg>
  );
}

/* Картинка предмета — ВСЕГДА ТА ЖЕ, ЧТО НА ПОЛУ (заказчик, v0.143): микросхема — зелёная
   плата (та же, что рисует движок на карте), картридж Dendy — 📼, остальное — эмодзи из
   каталога RUBG_ITEMS (ровно те же значки рисуются на полу в render.ts). */
export function ItemArt({ kind, px, cartSrc }: { kind: RubgItemKind; px: number; cartSrc?: string | null }) {
  if (kind === 'frendyChip') {
    return <ChipArt px={px} />;
  }
  /* v0.144: КАРТРИДЖ ЗАДАНИЯ — его ОБЛОЖКА (та же картинка, что в редакторе заданий:
     своя обложка рома или фото картриджа платформы); без картинки (старые сейвы) — 📼 */
  if (kind === 'dendyCart' && cartSrc) {
    return (
      <img
        src={cartSrc}
        alt="Картридж задания"
        draggable={false}
        style={{ maxHeight: px, maxWidth: px * 1.5, width: 'auto', imageRendering: 'auto', userSelect: 'none' }}
      />
    );
  }
  return <span style={{ fontSize: px, lineHeight: 1, userSelect: 'none' }} draggable={false}>{RUBG_ITEMS[kind].icon}</span>;
}

const artFor = (kind: RubgItemKind): string => (kind === 'frendyChip' ? '🔩' : RUBG_ITEMS[kind].icon);

/* ---------- СЕТКА РЮКЗАКА (используется и в окне инвентаря, и в окне печи) ---------- */
export interface FrendyGridActions {
  onBurn: (itemId: string) => void;   // сжечь (из меню; окно печи решает само — может отложить в «лоток»)
  onUse: (itemId: string) => void;    // использовать (аптечка/кофе)
  onDrop: (itemId: string) => void;   // выбросить на землю
  onMove: (itemId: string, gx: number, gy: number) => void; // переложить в сетке
}

export function FrendyInvGrid({ items, actions, near, strong, hpFull, furnaceRef, zoneRef, containerRef, onDragTo, cartArtOf }: {
  items: RubgItem[];
  actions: FrendyGridActions;
  near: boolean;   // стоишь у печи (для «Сжечь» из меню)
  strong: boolean; // в печи сильный огонь (микросхемы горят)
  hpFull: boolean; // полоска HP полна — «Использовать» не нужно
  cartArtOf?: (it: RubgItem) => { src: string | null; title: string | null } | null; // v0.144: арт/название картриджей заданий
  furnaceRef?: React.MutableRefObject<HTMLDivElement | null>; // куда падает «на печь» (только в окне печи)
  zoneRef?: React.MutableRefObject<HTMLDivElement | null>; // окно рюкзака целиком: дроп внутри окна (мимо сетки) — НЕ выброс, а «вернуть» (щелчок в ближайшую клетку)
  containerRef?: React.MutableRefObject<HTMLDivElement | null>; // наружный ref на сетку (окну печи — для дропа из лотка)
  onDragTo?: (pos: { x: number; y: number } | null, item: RubgItemKind | null) => void; // подсветка печи при перетаскивании
}) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  useEffect(() => { if (containerRef) containerRef.current = gridRef.current; });
  const [menu, setMenu] = useState<{ id: string; kind: RubgItemKind; x: number; y: number } | null>(null);
  const [shake, setShake] = useState<{ id: string; k: number } | null>(null);
  const lpTimer = useRef<number | null>(null); // долгое нажатие (телефон) → меню

  /* резолвер с координатами: печь → сетка (клетка) → внутри окна рюкзака (щелчок в ближайшую клетку) → за окном (на землю) */
  const resolveAt = (x: number, y: number): DropRes => {
    const fr = furnaceRef?.current;
    if (fr) {
      const r = fr.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return { kind: 'furnace' };
    }
    const gr = gridRef.current;
    if (gr) {
      const r = gr.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        const gx = Math.max(0, Math.min(FRENDY_INV_COLS - 1, Math.floor(((x - r.left) / r.width) * FRENDY_INV_COLS)));
        const gy = Math.max(0, Math.min(FRENDY_INV_ROWS - 1, Math.floor(((y - r.top) / r.height) * FRENDY_INV_ROWS)));
        return { kind: 'grid', gx, gy };
      }
      /* внутри окна рюкзака (заголовок/подсказки), но мимо сетки — НЕ выброс: щелкаем в ближайшую клетку */
      const zr = zoneRef?.current?.getBoundingClientRect();
      if (zr && x >= zr.left && x <= zr.right && y >= zr.top && y <= zr.bottom) {
        const gx = Math.max(0, Math.min(FRENDY_INV_COLS - 1, Math.round(((x - r.left) / r.width) * (FRENDY_INV_COLS - 1))));
        const gy = Math.max(0, Math.min(FRENDY_INV_ROWS - 1, Math.round(((y - r.top) / r.height) * (FRENDY_INV_ROWS - 1))));
        return { kind: 'grid', gx, gy };
      }
    }
    return { kind: 'floor' };
  };

  const dragApi = useInvDrag(
    (info) => {
      onDragTo?.(null, null);
      const res = resolveAt(info.x, info.y);
      if (res.kind === 'furnace') { actions.onBurn(info.itemId); return; }
      if (res.kind === 'grid') {
        const sz = rubgItemSize(info.kind);
        const gx = Math.max(0, Math.min(FRENDY_INV_COLS - sz.w, res.gx));
        const gy = Math.max(0, Math.min(FRENDY_INV_ROWS - sz.h, res.gy));
        if (rubgGridFits(items, sz.w, sz.h, gx, gy, info.itemId)) actions.onMove(info.itemId, gx, gy);
        else { setShake({ id: info.itemId, k: Date.now() }); sfx.hover(); } // не влезает — предмет остаётся на месте
        return;
      }
      actions.onDrop(info.itemId); // за пределами окна — на землю
      sfx.drop?.();
    },
    () => { if (lpTimer.current !== null) { window.clearTimeout(lpTimer.current); lpTimer.current = null; } },
  );

  /* подсветка цели перетаскивания (окно печи подсвечивается, когда над ним тащат предмет) */
  useEffect(() => {
    onDragTo?.(dragApi.drag ? { x: dragApi.drag.x, y: dragApi.drag.y } : null, dragApi.drag?.kind ?? null);
  }, [dragApi.drag?.x, dragApi.drag?.y, dragApi.drag?.kind]);

  /* контекстное меню закрывается кликом мимо / Esc */
  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenu(null); };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', esc);
    return () => { window.removeEventListener('pointerdown', close); window.removeEventListener('keydown', esc); };
  }, [menu]);

  const shakeTimer = useRef<number | null>(null);
  useEffect(() => {
    if (!shake) return;
    if (shakeTimer.current !== null) window.clearTimeout(shakeTimer.current);
    shakeTimer.current = window.setTimeout(() => setShake(null), 420);
    return () => { if (shakeTimer.current !== null) window.clearTimeout(shakeTimer.current); };
  }, [shake]);

  const itemOf = (id: string) => items.find((x) => x.id === id);
  const menuIt = menu ? itemOf(menu.id) : null;
  /* почему нельзя сжечь (для меню) */
  const burnWhy = (kind: RubgItemKind): string | null => {
    if (kind !== 'frendyChip' && kind !== 'dendyCart') return 'Печь берёт только картриджи Dendy и микросхемы';
    if (!near) return 'Печь ДАЛЕКО — подойди к печи и попробуй снова';
    if (kind === 'frendyChip' && !strong) return 'Огонь СЛАБЫЙ — микросхема не загорается. Сначала сожги в печи картридж Dendy 📼';
    return null;
  };
  const usable = (kind: RubgItemKind): boolean => kind === 'medkit' || kind === 'flask' || kind === 'bigmed' || kind === 'coffee';

  const openMenu = (e: React.PointerEvent | React.MouseEvent, it: RubgItem) => {
    if (lpTimer.current !== null) { window.clearTimeout(lpTimer.current); lpTimer.current = null; }
    setMenu({ id: it.id, kind: it.kind, x: e.clientX, y: e.clientY });
    sfx.click();
  };

  return (
    <div className="relative select-none" style={{ touchAction: 'none' }}>
      {/* СЕТКА: тёмный фон + золотистые клетки, как в Diablo */}
      <div
        ref={gridRef}
        className="relative border-2 border-[#5b4a22] bg-[rgba(12,10,6,0.92)]"
        style={{
          width: FRENDY_INV_COLS * CELL_PX, height: FRENDY_INV_ROWS * CELL_PX,
          backgroundImage: `linear-gradient(to right, rgba(120,98,44,0.4) 1px, transparent 1px), linear-gradient(to bottom, rgba(120,98,44,0.4) 1px, transparent 1px)`,
          backgroundSize: `${CELL_PX}px ${CELL_PX}px`,
          boxShadow: 'inset 0 0 26px rgba(0,0,0,0.75)',
        }}
      >
        {/* подсветка клетки, над которой тащат предмет (зелёная — влезет, красная — нет) */}
        {dragApi.drag && (() => {
          const res = resolveAt(dragApi.drag.x, dragApi.drag.y);
          if (res.kind !== 'grid') return null;
          const sz = rubgItemSize(dragApi.drag.kind);
          const gx = Math.max(0, Math.min(FRENDY_INV_COLS - sz.w, res.gx));
          const gy = Math.max(0, Math.min(FRENDY_INV_ROWS - sz.h, res.gy));
          const ok = rubgGridFits(items, sz.w, sz.h, gx, gy, dragApi.drag.itemId);
          return (
            <div
              className="absolute pointer-events-none"
              style={{
                left: gx * CELL_PX + 1, top: gy * CELL_PX + 1, width: sz.w * CELL_PX - 2, height: sz.h * CELL_PX - 2,
                background: ok ? 'rgba(60,220,120,0.22)' : 'rgba(255,60,60,0.22)',
                border: `2px solid ${ok ? 'rgba(60,220,120,0.8)' : 'rgba(255,60,60,0.8)'}`,
              }}
            />
          );
        })()}
        {/* предметы */}
        {items.map((it) => {
          const sz = rubgItemSize(it.kind);
          if (it.gx === undefined || it.gy === undefined) return null; // предмет без места — движок кладёт при выдаче
          const meta = RUBG_ITEMS[it.kind];
          const ca = cartArtOf ? cartArtOf(it) : null; // v0.144: обложка/название картриджа
          const nm = it.kind === 'dendyCart' && ca?.title ? `Картридж «${ca.title}»` : meta.name;
          return (
            <div
              key={it.id}
              className={`absolute flex items-center justify-center cursor-grab active:cursor-grabbing hover:brightness-125 ${shake?.id === it.id ? 'frendy-item-shake' : ''}`}
              style={{
                left: it.gx * CELL_PX + 2, top: it.gy * CELL_PX + 2, width: sz.w * CELL_PX - 4, height: sz.h * CELL_PX - 4,
                background: 'linear-gradient(160deg, rgba(46,38,20,0.9), rgba(24,20,10,0.95))',
                border: '1px solid rgba(160,132,60,0.65)',
                boxShadow: 'inset 0 0 8px rgba(0,0,0,0.6)',
              }}
              title={`${nm}${it.kind === 'frendyChip' ? ' — сожги в ПЕЧИ (сильный огонь)' : it.kind === 'dendyCart' ? ' — брось в ПЕЧЬ (сильный огонь) или вставь в пустую ПРИСТАВКУ' : it.kind === 'coffee' ? ' — 5 минут без поимки' : meta.hp > 0 ? ` — лечит +${meta.hp}% HP` : ''}`}
              onPointerDown={(e) => {
                /* телефон: долгое нажатие (~550 мс) — контекстное меню; движение — перетаскивание */
                if (e.pointerType === 'touch') {
                  const itId = it.id;
                  if (lpTimer.current !== null) window.clearTimeout(lpTimer.current);
                  lpTimer.current = window.setTimeout(() => {
                    lpTimer.current = null;
                    setMenu((m) => m ?? { id: itId, kind: it.kind, x: e.clientX, y: e.clientY });
                    sfx.click();
                  }, 550);
                }
                dragApi.start(e, it.id, it.kind, 'grid');
              }}
              onContextMenu={(e) => { e.preventDefault(); openMenu(e, it); }}
            >
              <ItemArt kind={it.kind} px={Math.min(sz.w, sz.h) >= 2 ? 34 : 24} cartSrc={ca?.src ?? null} />
            </div>
          );
        })}
      </div>
      <div className="font-pixel text-[9px] text-faint mt-1.5 leading-snug">
        ЛКМ/палец — перетащить (за окно — выбросить) · ПКМ/долгое нажатие — меню · микросхема и картридж 2×2 · кофе 1×1 · аптечка 2×3
      </div>

      {/* ПРИЗРАК ПРЕДМЕТА под курсором/пальцем — v0.143: через ПОРТАЛ в body:
         окно «Инвентаря» держит transform от pop-in — fixed внутри него смещался */}
      {dragApi.drag && createPortal(
        <div className="fixed z-[130] pointer-events-none" style={{ left: dragApi.drag.x, top: dragApi.drag.y, transform: 'translate(-50%,-50%) rotate(-6deg)', filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.8))' }}>
          <ItemArt kind={dragApi.drag.kind} px={40} cartSrc={cartArtOf?.(items.find((x) => x.id === dragApi.drag!.itemId) ?? ({ id: '', kind: dragApi.drag.kind } as RubgItem))?.src ?? null} />
        </div>,
        document.body,
      )}

      {/* КОНТЕКСТНОЕ МЕНЮ (ПКМ / долгое нажатие): использовать / сжечь в печи / выбросить.
          v0.143: через ПОРТАЛ в body — меню появляется ТОЧНО под местом нажатия ПКМ.
          Раньше окно «Инвентаря» держало transform от pop-in (fill-mode both), и fixed-меню
          позиционировалось относительно ОКНА, а не экрана — уезжало в сторону. */}
      {menu && menuIt && createPortal(
        <div
          className="fixed z-[120] min-w-[190px] border-2 border-[#a0843c] bg-[rgba(12,10,6,0.97)] pixel-corners py-1.5 shadow-2xl"
          style={{ left: Math.max(4, Math.min(menu.x, window.innerWidth - 210)), top: Math.max(4, Math.min(menu.y, window.innerHeight - 150)) }}
          onPointerDown={(e) => e.stopPropagation()}
        >
          <div className="px-3 pb-1.5 font-display text-[10px] uppercase tracking-wider text-[#d8b95c] border-b border-[#a0843c]/30 mb-1">{(() => { const ca2 = cartArtOf ? cartArtOf(menuIt) : null; return menuIt.kind === 'dendyCart' && ca2?.title ? `Картридж «${ca2.title}»` : RUBG_ITEMS[menuIt.kind].name; })()}</div>
          {usable(menuIt.kind) && (
            <button
              className="w-full text-left px-3 py-1.5 text-[12px] text-paper hover:bg-[#a0843c]/20 cursor-pointer font-display"
              onClick={() => { setMenu(null); actions.onUse(menuIt.id); }}
            >
              {menuIt.kind === 'coffee' ? '☕ Выпить (иммунитет 5 мин)' : '🩹 Использовать (лечит)'}
            </button>
          )}
          {(menuIt.kind === 'frendyChip' || menuIt.kind === 'dendyCart') && (() => {
            const why = burnWhy(menuIt.kind);
            return (
              <button
                className={`w-full text-left px-3 py-1.5 text-[12px] font-display ${why ? 'text-faint cursor-not-allowed' : 'text-[#ff8b3f] hover:bg-[#ff6b35]/20 cursor-pointer'}`}
                disabled={!!why}
                title={why ?? undefined}
                onClick={() => { if (why) return; setMenu(null); actions.onBurn(menuIt.id); }}
              >
                🔥 Сжечь в печи
              </button>
            );
          })()}
          <button
            className="w-full text-left px-3 py-1.5 text-[12px] text-paper hover:bg-[#a0843c]/20 cursor-pointer font-display"
            onClick={() => { setMenu(null); actions.onDrop(menuIt.id); sfx.drop?.(); }}
          >
            ✋ Выбросить на землю
          </button>
          {hpFull && usable(menuIt.kind) && <div className="px-3 pt-1 font-pixel text-[8px] text-faint">HP полна — лечение не нужно</div>}
        </div>,
        document.body,
      )}
    </div>
  );
}

/* ---------- ОКНО ПЕЧИ + РЮКЗАК (E у печи): два окна РЯДОМ — печь и сетка-рюкзак.
   Чтобы сжечь — перетащи картридж/микросхему ИЗ рюкзака НА ПЕЧЬ. Не горит (слабый огонь /
   не то) — предмет остаётся ЛЕЖАТЬ У ПЕЧИ в «лотке»: перетащи его обратно в рюкзак. ---------- */
export function FrendyFurnaceModal({ onClose, items, near, strong, burned, total, hpFull, dispatches, cartArtOf }: {
  onClose: () => void;
  items: RubgItem[];
  near: boolean;
  strong: boolean;
  burned: number;
  total: number;
  hpFull: boolean;
  cartArtOf?: (it: RubgItem) => { src: string | null; title: string | null } | null; // v0.144: обложки картриджей
  dispatches: {
    burn: (itemId: string) => void;   // диспатч frendyBurn (предпроверки сделаны)
    use: (itemId: string) => void;
    drop: (itemId: string) => void;
    move: (itemId: string, gx: number, gy: number) => void;
  };
}) {
  const furnaceRef = useRef<HTMLDivElement | null>(null);
  const gridRef = useRef<HTMLDivElement | null>(null);
  const zoneRef = useRef<HTMLDivElement | null>(null);
  /* «лоток» у печи: предмет, который НЕ сгорел (слабый огонь / не горит вообще) или сейчас горит */
  const [tray, setTray] = useState<{ id: string; why: string | null; burning?: boolean } | null>(null);
  const [hot, setHot] = useState(false); // над печью тащат предмет — подсветить

  const trayIt = tray ? items.find((x) => x.id === tray.id) ?? null : null;

  /* попытка сжечь (drag на печь / меню): предпроверка на клиенте, движок перепроверит у хоста */
  const tryBurn = (itemId: string) => {
    const it = items.find((x) => x.id === itemId);
    if (!it) return;
    let why: string | null = null;
    if (it.kind !== 'frendyChip' && it.kind !== 'dendyCart') why = 'Печь берёт только картриджи Dendy и микросхемы';
    else if (it.kind === 'frendyChip' && !strong) why = 'Огонь СЛАБЫЙ — микросхема не загорается. Сначала сожги КАРТРИДЖ Dendy 📼';
    if (why) { setTray({ id: itemId, why }); sfx.fail(); return; } // НЕ горит — предмет остаётся у печи, забери его в рюкзак
    if (it.kind === 'frendyChip') sfx.frendyBurn(); else sfx.frendyStrong();
    dispatches.burn(itemId);
    setTray({ id: itemId, why: null, burning: true });
  };

  /* предмет сгорел (исчез из состояния) — лоток пуст; страховка: 1.6 с и предмет ещё тут — вернуть в сетку */
  useEffect(() => {
    if (!tray) return;
    if (!items.some((x) => x.id === tray.id)) { setTray(null); return; }
    if (!tray.burning) return;
    const t = window.setTimeout(() => setTray((cur) => (cur && cur.burning ? null : cur)), 1600);
    return () => window.clearTimeout(t);
  }, [items, tray]);

  /* драг из ЛОТКА: обратно в сетку / снова на печь / за окно — на землю */
  const resolveAt = (x: number, y: number): DropRes => {
    const gr = gridRef.current;
    if (gr) {
      const r = gr.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) {
        const gx = Math.max(0, Math.min(FRENDY_INV_COLS - 1, Math.floor(((x - r.left) / r.width) * FRENDY_INV_COLS)));
        const gy = Math.max(0, Math.min(FRENDY_INV_ROWS - 1, Math.floor(((y - r.top) / r.height) * FRENDY_INV_ROWS)));
        return { kind: 'grid', gx, gy };
      }
    }
    const fr = furnaceRef.current;
    if (fr) {
      const r = fr.getBoundingClientRect();
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return { kind: 'furnace' };
    }
    return { kind: 'floor' };
  };
  const trayDrag = useInvDrag(
    (info) => {
      setHot(false);
      const res = resolveAt(info.x, info.y);
      if (res.kind === 'furnace') { tryBurn(info.itemId); return; } // ещё раз на печь — вдруг огонь разгорелся
      if (res.kind === 'grid') {
        const sz = rubgItemSize(info.kind);
        const gx = Math.max(0, Math.min(FRENDY_INV_COLS - sz.w, res.gx));
        const gy = Math.max(0, Math.min(FRENDY_INV_ROWS - sz.h, res.gy));
        if (rubgGridFits(items, sz.w, sz.h, gx, gy, info.itemId)) dispatches.move(info.itemId, gx, gy);
        else sfx.hover();
        setTray(null); // предмет всегда был в состоянии — просто возвращаем его в сетку (на старое или новое место)
        return;
      }
      dispatches.drop(info.itemId); // выбросить на землю
      setTray(null);
      sfx.drop?.();
    },
  );

  /* подсветка печи при перетаскивании из сетки (FrendyInvGrid докладывает позицию) */
  const onDragTo = (pos: { x: number; y: number } | null, kind: RubgItemKind | null) => {
    if (!pos || !kind) { setHot(false); return; }
    const fr = furnaceRef.current;
    if (!fr) { setHot(false); return; }
    const r = fr.getBoundingClientRect();
    setHot(pos.x >= r.left && pos.x <= r.right && pos.y >= r.top && pos.y <= r.bottom);
  };

  const flames = tray?.burning ? 5 : strong ? 4 : 2; // сильный огонь — больше пламени

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(4,6,14,0.82)] p-3" style={{ touchAction: 'none' }}>
      <div className="flex flex-col md:flex-row items-stretch justify-center gap-3 max-w-4xl w-full">
        {/* ---------- ОКНО 1: ПЕЧЬ (сюда тащат картриджи и микросхемы) ---------- */}
        <div
          ref={furnaceRef}
          className={`relative pixel-panel pixel-corners p-4 w-full md:w-[300px] shrink-0 text-center space-y-2.5 ${hot ? 'furnace-hot' : ''}`}
          style={hot ? { outline: '3px solid rgba(255,140,40,0.9)', outlineOffset: '-2px' } : undefined}
        >
          <div className="font-display uppercase text-lg text-[#ff8b3f]">🔥 Печь Френди</div>
          {/* сама печь: кирпичная кладка + огонь по состоянию */}
          <div className="relative mx-auto h-[120px] w-[170px] border-2 border-[#3a2a1a]" style={{ background: 'repeating-linear-gradient(0deg, #4a3020 0 16px, #3a2818 16px 18px), repeating-linear-gradient(90deg, transparent 0 38px, rgba(0,0,0,0.35) 38px 40px)', boxShadow: 'inset 0 0 30px rgba(0,0,0,0.8)' }}>
            {/* жерло */}
            <div className="absolute left-1/2 bottom-2 -translate-x-1/2 w-[110px] h-[46px] bg-black border-2 border-[#221810]" style={{ boxShadow: strong ? 'inset 0 0 22px rgba(255,120,20,0.85)' : 'inset 0 0 12px rgba(255,90,20,0.35)' }} />
            <div className="absolute left-1/2 bottom-3 -translate-x-1/2 flex items-end gap-1">
              {Array.from({ length: flames }).map((_, i) => (
                <span key={i} className="ff-flame" style={{ position: 'relative', fontSize: tray?.burning || strong ? 26 + (i % 2) * 8 : 16, left: 'auto', animationDelay: `${i * 0.22}s` }}>🔥</span>
              ))}
            </div>
            {trayIt && !tray?.burning && (
              <div className="absolute left-1/2 -bottom-1 -translate-x-1/2"><ItemArt kind={trayIt.kind} px={30} cartSrc={cartArtOf?.(trayIt)?.src ?? null} /></div>
            )}
          </div>
          <div className={`font-pixel text-[10px] leading-snug ${strong ? 'text-coral' : 'text-dim'}`}>
            {strong ? '🔥🔥🔥 СИЛЬНЫЙ ОГОНЬ! Микросхемы ГОРЯТ — тащи их сюда, пока печь не погасла!' : 'Огонь СЛАБЫЙ: микросхемы в нём НЕ горят. Бросьте в печь КАРТРИДЖ Dendy 📼'}
          </div>
          <div className="font-pixel text-[10px] text-dim">Сожжено {burned} из {total} — сожгите ВСЕ, чтобы победить</div>
          {/* ЛОТОК: предмет, который не сгорел / горит */}
          {tray && trayIt && !tray.burning && (
            <div className="border-2 border-[#ff5d73]/60 bg-[rgba(60,8,14,0.5)] px-2.5 py-2 text-left">
              <div className="flex items-center gap-2">
                <ItemArt kind={trayIt.kind} px={26} cartSrc={cartArtOf?.(trayIt)?.src ?? null} />
                <div className="min-w-0">
                  <div className="font-display text-[11px] text-[#ff8b7a] leading-tight">НЕ СГОРЕЛО</div>
                  <div className="font-pixel text-[9px] text-dim leading-snug">{tray.why}</div>
                  <div className="font-pixel text-[9px] text-[#d8b95c] mt-0.5">Перетащи обратно в РЮКЗАК →</div>
                </div>
              </div>
              {/* сам предмет в лотке можно схвать и тащить */}
              <div
                className="mt-1.5 mx-auto w-max px-3 py-1 border border-[#a0843c]/60 bg-[rgba(24,20,10,0.9)] cursor-grab active:cursor-grabbing"
                onPointerDown={(e) => trayDrag.start(e, trayIt.id, trayIt.kind, 'tray')}
                title="Схвати и перетащи: в рюкзак — забрать, на печь — попробовать снова"
              >
                <ItemArt kind={trayIt.kind} px={22} cartSrc={cartArtOf?.(trayIt)?.src ?? null} />
              </div>
            </div>
          )}
          {tray?.burning && (
            <div className="font-pixel text-[9px] text-[#ffb257] animate-pulse">Предмет в огне…</div>
          )}
          {!tray && (
            <p className="text-[11px] text-dim leading-snug">Перетащи <b className="text-paper">КАРТРИДЖ 📼</b> или <b className="text-gold">МИКРОСХЕМУ <ChipArt px={11} className="inline-block align-[-1px]" /></b> из рюкзака <b className="text-paper">на печь</b>. Не сгорит — предмет останется у печи: забери его назад.</p>
          )}
        </div>

        {/* ---------- ОКНО 2: РЮКЗАК-СЕТКА (Diablo) ---------- */}
        <div ref={zoneRef} className="relative pixel-panel pixel-corners p-4 w-full">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="font-display uppercase tracking-wider text-paper text-sm">🎒 Рюкзак</span>
            <span className="tick-label text-faint">{items.length} предм.</span>
            <GhostBtn small className="ml-auto" onClick={onClose}>{Ic.cross(12)} Закрыть</GhostBtn>
          </div>
          <FrendyInvGrid
            items={items}
            near={near}
            strong={strong}
            hpFull={hpFull}
            cartArtOf={cartArtOf}
            furnaceRef={furnaceRef}
            zoneRef={zoneRef}
            containerRef={gridRef}
            onDragTo={onDragTo}
            actions={{
              onBurn: tryBurn,
              onUse: dispatches.use,
              onDrop: (id) => { dispatches.drop(id); sfx.drop?.(); },
              onMove: dispatches.move,
            }}
          />
          <div className="font-pixel text-[9px] text-faint mt-2 leading-snug">
            Tab · крестик · кнопка джойстика — закрыть · ПКМ по предмету — меню (использовать / сжечь / выбросить)
          </div>
        </div>
      </div>
      {/* призрак предмета при перетаскивании ИЗ ЛОТКА — v0.143: тоже через ПОРТАЛ */}
      {trayDrag.drag && createPortal(
        <div className="fixed z-[130] pointer-events-none" style={{ left: trayDrag.drag.x, top: trayDrag.drag.y, transform: 'translate(-50%,-50%) rotate(-6deg)', filter: 'drop-shadow(0 6px 10px rgba(0,0,0,0.8))' }}>
          <ItemArt kind={trayDrag.drag.kind} px={40} cartSrc={cartArtOf?.(items.find((x) => x.id === trayDrag.drag!.itemId) ?? ({ id: '', kind: trayDrag.drag.kind } as RubgItem))?.src ?? null} />
        </div>,
        document.body,
      )}
    </div>
  );
}

/* подпись предмета на земле (HUD-подсказка «подними») */
export const groundItemLabel = (kind: RubgItemKind): string => `${artFor(kind)} «${RUBG_ITEMS[kind].name}»`;

/* ---------- v0.144: ОКНО ПРИСТАВКИ + РЮКЗАК (по клику/входу на приставку) ----------
   Слева — фотография приставки со слотом: перетащи КАРТРИДЖ из рюкзака НА ПРИСТАВКУ —
   он встанет в слот (диспатч frendyCartInsert). Потом жми КНОПКУ ПИТАНИЯ — запустится
   игра-задание, записанное на картридже (frendyPowerOn). Победа — картридж переедет
   в рюкзак (его жгут в печи или вставляют в другую пустую приставку).
   v0.145: фото приставки — ЕЁ РЕГИОН (Dendy/Famicom/NES по рому задания); картридж
   входит только в СВОЮ приставку: NES → только NES, Dendy → только Dendy,
   Famicom → Dendy и Famicom («как в реальности»). */
const REGION_LABEL: Record<CartRegion, string> = { dendy: 'DENDY', famicom: 'FAMICOM', nes: 'NES' };
const regionWhy = (cart: CartRegion): string =>
  cart === 'nes'
    ? 'NES-картридж играет ТОЛЬКО на NES-приставке'
    : cart === 'dendy'
      ? 'картридж Dendy играет ТОЛЬКО на приставке Dendy'
      : 'картридж Famicom играет только на Dendy и Famicom';
export function FrendyConsoleModal({ onClose, cellIdx, items, cartTaskIdx, busy, cartImgSrc, cartTitle, hpFull, consoleImgSrc, consoleRegion, dispatches }: {
  onClose: () => void;
  cellIdx: number;                 // индекс ячейки-приставки
  items: RubgItem[];
  cartTaskIdx: number | null;      // какой картридж ВСТАВЛЕН (null — приставка пуста)
  busy: boolean;                   // приставку сейчас играет кто-то (qJobs)
  cartImgSrc: string | null;       // арт вставленного картриджа (обложка)
  cartTitle: string | null;        // игра на вставленном картридже
  hpFull: boolean;
  consoleImgSrc?: string | null;   // v0.145: фото приставки по региону её рома (fallback — по индексу)
  consoleRegion?: CartRegion | null; // v0.145: регион приставки (для проверки картриджа)
  dispatches: {
    insert: (itemId: string) => void;   // frendyCartInsert (перетащили картридж на приставку)
    powerOn: () => void;                // frendyPowerOn (кнопка питания)
    use: (itemId: string) => void;
    drop: (itemId: string) => void;
    move: (itemId: string, gx: number, gy: number) => void;
    cartArt: (it: RubgItem) => { src: string | null; title: string | null; region?: CartRegion | null } | null; // арт/название/регион картриджа из рюкзака
  };
}) {
  const slotRef = useRef<HTMLDivElement | null>(null);   // зона «на приставку» (сюда тащат картридж)
  const gridRef = useRef<HTMLDivElement | null>(null);
  const zoneRef = useRef<HTMLDivElement | null>(null);
  const [slotHot, setSlotHot] = useState(false);          // над слотом тащат предмет
  const [slotMsg, setSlotMsg] = useState<string | null>(null); // почему вставить нельзя
  const msgTimer = useRef<number | null>(null);
  useEffect(() => () => { if (msgTimer.current !== null) window.clearTimeout(msgTimer.current); }, []);
  const flashSlot = (msg: string) => {
    setSlotMsg(msg);
    sfx.fail();
    if (msgTimer.current !== null) window.clearTimeout(msgTimer.current);
    msgTimer.current = window.setTimeout(() => setSlotMsg(null), 3200);
  };

  /* попытка вставить (drag на приставку): предпроверки — движок перепроверит у хоста.
     v0.145: ещё и РЕГИОН — карик входит только в СВОЮ приставку («как в реальности»). */
  const tryInsert = (itemId: string) => {
    const it = items.find((x) => x.id === itemId);
    if (!it) return;
    if (it.kind !== 'dendyCart') { flashSlot('Приставка принимает только КАРТРИДЖИ заданий 📼'); return; }
    if (typeof it.taskIdx !== 'number') { flashSlot('Это безымянный картридж — приставка играет только картриджи ЗАДАНИЙ'); return; }
    if (cartTaskIdx !== null) { flashSlot('В приставке УЖЕ ЕСТЬ картридж — сначала победи её задание'); return; }
    if (busy) { flashSlot('Приставку сейчас играет другой игрок'); return; }
    const ca = dispatches.cartArt(it);
    if (ca?.region && consoleRegion && !cartFitsConsole(ca.region, consoleRegion)) {
      flashSlot(`Не подходит: ${regionWhy(ca.region)} — ищи приставку нужного региона`);
      return;
    }
    sfx.frendyStrong(); // щелчок «вставили» — тот же звук, что у Френди
    dispatches.insert(itemId);
  };

  /* драг из сетки: подсветка слота */
  const onDragTo = (pos: { x: number; y: number } | null, kind: RubgItemKind | null) => {
    if (!pos || !kind) { setSlotHot(false); return; }
    const sr = slotRef.current;
    if (!sr) { setSlotHot(false); return; }
    const r = sr.getBoundingClientRect();
    setSlotHot(pos.x >= r.left && pos.x <= r.right && pos.y >= r.top && pos.y <= r.bottom);
  };

  const cartArtOf = (it: RubgItem): { src: string | null; title: string | null; region?: CartRegion | null } | null => (
    it.kind === 'dendyCart' ? dispatches.cartArt(it) : null
  );

  const powerWhy = cartTaskIdx === null ? 'Приставка ПУСТА — вставь картридж' : busy ? 'Приставку сейчас играет другой' : null;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[rgba(4,6,14,0.82)] p-3" style={{ touchAction: 'none' }}>
      <div className="flex flex-col md:flex-row items-stretch justify-center gap-3 max-w-4xl w-full">
        {/* ---------- ОКНО 1: ПРИСТАВКА (сюда тащат картридж, тут кнопка питания) ---------- */}
        <div className="relative pixel-panel pixel-corners p-4 w-full md:w-[320px] shrink-0 text-center space-y-2.5">
          <div className="font-display uppercase text-lg text-[#8fd0ff]">🎮 Приставка №{cellIdx + 1}{consoleRegion ? <span className="ml-1.5 font-pixel text-[9px] align-middle text-[#d8b95c]">· {REGION_LABEL[consoleRegion]}</span> : null}</div>
          <div
            ref={slotRef}
            className={`relative mx-auto h-[190px] w-[240px] border-2 border-[#3a3f5a] flex items-center justify-center ${slotHot ? 'furnace-hot' : ''}`}
            style={{
              background: 'radial-gradient(circle at 50% 38%, rgba(70,84,140,0.35), rgba(10,12,24,0.95) 72%)',
              boxShadow: slotHot ? 'inset 0 0 26px rgba(140,200,255,0.55)' : 'inset 0 0 22px rgba(0,0,0,0.8)',
            }}
          >
            <img
              src={consoleImgSrc ?? frendyConsoleImg(cellIdx)}
              alt="Приставка"
              draggable={false}
              className="absolute inset-0 w-full h-full object-contain p-2 pointer-events-none"
              style={{ imageRendering: 'auto' }}
            />
            {/* слот: вставленный картридж (или подсказка «вставь картридж») */}
            {cartTaskIdx !== null ? (
              <div className="relative z-10 mt-6 flex flex-col items-center gap-1">
                <div style={{ filter: 'drop-shadow(0 5px 9px rgba(0,0,0,0.85))' }}>
                  {cartImgSrc
                    ? <img src={cartImgSrc} alt="Картридж" draggable={false} style={{ maxHeight: 52, maxWidth: 96, width: 'auto' }} />
                    : <span style={{ fontSize: 40 }}>📼</span>}
                </div>
                <div className="font-pixel text-[8px] text-[#d8b95c] bg-[rgba(7,9,18,0.85)] px-1.5 py-0.5 max-w-[200px] truncate">{cartTitle ?? 'игра'}</div>
              </div>
            ) : (
              <div className="relative z-10 mt-8 font-pixel text-[8px] text-dim bg-[rgba(7,9,18,0.85)] px-2 py-1 border border-[#a0843c]/40">
                ПУСТО — тащи картридж сюда
              </div>
            )}
          </div>
          {/* КНОПКА ПИТАНИЯ */}
          <button
            className={`w-full py-2.5 font-display uppercase tracking-wider text-sm border-2 transition-colors ${powerWhy ? 'border-edge text-faint cursor-not-allowed' : 'border-[#2ee6a8] text-[#2ee6a8] hover:bg-[rgba(46,230,168,0.12)] cursor-pointer pulse-ring'}`}
            disabled={!!powerWhy}
            title={powerWhy ?? 'Включить картридж — запустится игра-задание'}
            onClick={() => { if (powerWhy) return; sfx.start(); dispatches.powerOn(); }}
          >
            ⏻ POWER ON
          </button>
          <div className={`font-pixel text-[10px] leading-snug ${slotMsg ? 'text-[#ff8b7a]' : 'text-dim'}`}>
            {slotMsg ?? (busy
              ? '🕹 Эту приставку сейчас ИГРАЕТ кто-то другой — дождись победы/поражения'
              : cartTaskIdx !== null
                ? `В слоте: «${cartTitle ?? 'игра'}». Жми POWER ON — задание запустится в обычном окне (победа — картридж ВЕСЬ ТВОЙ)`
                : 'Перетащи КАРТРИДЖ из рюкзака на приставку, затем жми POWER ON. Картридж входит только в приставку СВОЕГО региона: NES → NES · Dendy → Dendy · Famicom → Dendy и Famicom. Забрать картридж можно, только ПОБЕДИВ задание')}
          </div>
        </div>

        {/* ---------- ОКНО 2: РЮКЗАК-СЕТКА (Diablo) ---------- */}
        <div ref={zoneRef} className="relative pixel-panel pixel-corners p-4 w-full">
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <span className="font-display uppercase tracking-wider text-paper text-sm">🎒 Рюкзак</span>
            <span className="tick-label text-faint">{items.length} предм.</span>
            <GhostBtn small className="ml-auto" onClick={onClose}>{Ic.cross(12)} Закрыть</GhostBtn>
          </div>
          <FrendyInvGrid
            items={items}
            near={false}
            strong={false}
            hpFull={hpFull}
            furnaceRef={slotRef}
            zoneRef={zoneRef}
            containerRef={gridRef}
            onDragTo={onDragTo}
            cartArtOf={cartArtOf}
            actions={{
              /* дроп НА ПРИСТАВКУ = вставить картридж (другое — отказ с пояснением) */
              onBurn: tryInsert,
              onUse: dispatches.use,
              onDrop: (id) => { dispatches.drop(id); sfx.drop?.(); },
              onMove: dispatches.move,
            }}
          />
          <div className="font-pixel text-[9px] text-faint mt-2 leading-snug">
            ПКМ по предмету — меню (сжечь в ПЕЧИ — только рядом с ней) · за окно — выбросить на землю
          </div>
        </div>
      </div>
    </div>
  );
}
