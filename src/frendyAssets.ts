/* v0.135 ФРЕНДИ (FRENDY GLOVER) — СПРАЙТ ЗЛОДЕЯ В СТИЛЕ АГЕНТОВ.
   Первый канонический облик (заглушка-«Фредди Крюгер» с федорой и полосатым
   свитером больше не используется — это был чужой персонаж): сутулый худой мужчина,
   пепельная кожа, ожог-шрам на левой щеке, оливково-серая рабочая куртка 90-х с
   жетоном-слоном, тёмные сальные волосы, на правой руке — POWER GLOVE (бело-серая,
   красные кнопки, стальные шипы на костяшках, провода к предплечью).
   Кадры нарисованы программно (пиксель-арт, высота 320 — как у агентов):
   idle ×2 (лёгкое «дыхание»), walk ×3 (готово к будущим сценам на поле).
   ЛОР персонажа в игре НЕ раскрывается (v0.135) — предыстория будет показана в
   продолжении расследования со Скаллер и Алдер. Замена на фирменный арт (например,
   Qwen image): положить PNG с теми же именами в src/assets/frendy/. */
const IMG = import.meta.glob('./assets/frendy/frendy-*.png', { eager: true, import: 'default', query: '?url' }) as Record<string, string>;

const img = (name: string): string => IMG[`./assets/frendy/${name}`] ?? '';

export type FrendyWho = 'frendy';

const idleUrls: string[] = [img('frendy-idle-0.png'), img('frendy-idle-1.png')];
const walkUrls: string[] = [img('frendy-walk-0.png'), img('frendy-walk-1.png'), img('frendy-walk-2.png')];

/** Портрет крупным планом (голова+плечи, 560×736) — для будущих диалогов/новеллы. */
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

/** Кадр Френди: walk=true — цикл ходьбы (по времени), иначе idle (лёгкое «дыхание», idx). */
export const frendyFrame = (walking: boolean, time: number, idx = 0): HTMLImageElement | null => {
  const urls = walking ? walkUrls : idleUrls;
  if (!urls.length) return null;
  const n = walking ? Math.floor(time / 130) % urls.length : Math.abs(idx) % urls.length;
  return getImage(urls[n]);
};
