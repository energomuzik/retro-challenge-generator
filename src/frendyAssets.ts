/* v0.137 ФРЕНДИ (FRENDY GLOVER) — ФИРМЕННЫЙ АРТ ЗАКАЗЧИКА (Qwen Image Edit 2.1 Turbo,
   метод «поза-референс»: один seed + ЯДРО описания на все кадры — персонаж собирается).
   Программный спрайт-заглушка v0.135 (рисован Pillow) больше не используется.
   Канонический облик: сутулый худой мужчина, пепельная кожа, ожог-шрам на левой щеке,
   оливково-серая рабочая куртка 90-х с жетоном-слоном, тёмные сальные волосы, на правой
   руке — POWER GLOVE (бело-серая, красные кнопки, стальные шипы, провода).
   v0.137: ПОЛНАЯ ХОДЬБА — ВСЕ 15 кадров заказчика (сырые файлы БЕЗ зеркала: Френди
   смотрит ВПРАВО, как нарисовано; в v0.136 кадры были отзеркалены — из-за этого
   «анимация влево, а Френди идёт вправо» и наоборот). Каждый кадр нормализован по
   высоте фигуры до 320 px (исходники прыгали 908…1188 — кадры «скакали»), нижняя
   привязка, центрирование по корпусу. idle — ОДНА статичная стойка (зеркальная,
   тоже смотрит вправо — согласована с ходьбой); ДЫХАНИЯ БОЛЬШЕ НЕТ (frendy-idle-1
   удалён, в том числе когда Френди просто стоит в игре). Портрет 560×736 — для
   крупных сцен в формате новеллы (FrendyCine: интро, печь, стингеры).
   Замена арта заказчиком = положить PNG с теми же именами в src/assets/frendy/. */
const IMG = import.meta.glob('./assets/frendy/frendy-*.png', { eager: true, import: 'default', query: '?url' }) as Record<string, string>;

const img = (name: string): string => IMG[`./assets/frendy/${name}`] ?? '';

export type FrendyWho = 'frendy';

/* v0.137: idle — одна статичная стойка («дыхание» удалено по заказу: Френди стоит
   без анимации и в игре, и в кат-сценах). Ходьба — полный цикл из 15 кадров. */
const idleUrls: string[] = [img('frendy-idle-0.png')];
const walkUrls: string[] = Array.from({ length: 15 }, (_, i) => img(`frendy-walk-${i}.png`)); // v0.137: ВСЕ 15 кадров

/** v0.137: темп ходьбы — 55 мс/кадр (15 кадров ≈ 0.83 с на круг, ~0.4 с на шаг —
    кадр не мельтешит и шаг не «плывёт» при скорости Френди на поле). */
export const FRENDY_WALK_MS = 55;

/** Портрет крупным планом (560×736) — крупные сцены в формате новеллы (портрет слева + диалог). */
export const frendyPortrait = (): string => img('frendy-portrait.png');

/* Кэш картинок: грузим заранее, чтобы рендер на канве/оверлее не мигал */
const cache = new Map<string, HTMLImageElement>();
const getImage = (url: string): HTMLImageElement | null => {
  if (!url) return null;
  let im = cache.get(url) ?? null;
  if (!im) {
    im = new Image();
    im.src = url;
    cache.set(url, im);
  }
  return im.complete && im.naturalWidth > 0 ? im : null;
};

/** Кадр Френди: walk=true — полный цикл ходьбы (15 кадров по FRENDY_WALK_MS),
    иначе СТАТИЧНАЯ стойка (idx игнорируется — дыхания больше нет). */
export const frendyFrame = (walking: boolean, time: number, idx = 0): HTMLImageElement | null => {
  const urls = walking ? walkUrls : idleUrls;
  if (!urls.length) return null;
  const n = walking ? Math.floor(time / FRENDY_WALK_MS) % urls.length : 0;
  return getImage(urls[n]);
};
