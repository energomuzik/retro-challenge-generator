/* v0.136 ФРЕНДИ (FRENDY GLOVER) — ФИРМЕННЫЙ АРТ ЗАКАЗЧИКА (Qwen Image Edit 2.1 Turbo,
   метод «поза-референс»: один seed + ЯДРО описания на все кадры — персонаж собирается).
   Программный спрайт-заглушка v0.135 (рисован Pillow) больше не используется.
   Канонический облик: сутулый худой мужчина, пепельная кожа, ожог-шрам на левой щеке,
   оливково-серая рабочая куртка 90-х с жетоном-слоном, тёмные сальные волосы, на правой
   руке — POWER GLOVE (бело-серая, красные кнопки, стальные шипы, провода).
   Кадры (высота 320 — как у агентов; постобработка: тримминг по альфе, общий масштаб
   всей серии ходьбы, нижняя привязка):
   idle ×2 — стойка (0 — основной кадр заказчика, 1 — второй дубль-стойка);
   walk ×6 — ЦИКЛ ХОДЬБЫ (130 мс на кадр, ~0.78 с на круг) — теперь ХОДЯТ И НА ПОЛЕ
   (render.ts: drawFrendyBoss рисует спрайт вместо пиксельной заглушки-«Крюгера»);
   портрет 560×736 — для будущих диалогов/новеллы (пока в игре не показывается).
   Замена арта заказчиком = положить PNG с теми же именами в src/assets/frendy/. */
const IMG = import.meta.glob('./assets/frendy/frendy-*.png', { eager: true, import: 'default', query: '?url' }) as Record<string, string>;

const img = (name: string): string => IMG[`./assets/frendy/${name}`] ?? '';

export type FrendyWho = 'frendy';

const idleUrls: string[] = [img('frendy-idle-0.png'), img('frendy-idle-1.png')];
const walkUrls: string[] = [img('frendy-walk-0.png'), img('frendy-walk-1.png'), img('frendy-walk-2.png'), img('frendy-walk-3.png'), img('frendy-walk-4.png'), img('frendy-walk-5.png')]; // v0.136: цикл из 6 кадров

/** Портрет крупным планом (560×736) — для будущих диалогов/новеллы. */
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

/** Кадр Френди: walk=true — цикл ходьбы (по времени, 130 мс/кадр), иначе idle (дыхание/стойка, idx). */
export const frendyFrame = (walking: boolean, time: number, idx = 0): HTMLImageElement | null => {
  const urls = walking ? walkUrls : idleUrls;
  if (!urls.length) return null;
  const n = walking ? Math.floor(time / 130) % urls.length : Math.abs(idx) % urls.length;
  return getImage(urls[n]);
};
