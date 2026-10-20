/* v0.132 АГЕНТЫ АЛЬДЕР и СКАЛЛЕР («Секретные материалы», неофициальное ФБР) —
   эпилог режима FRENDY после ПОБЕДЫ (все микросхемы сожжены).
   Ассеты: спрайты (idle/walk, нарезаны из арт-листа заказчика) + портреты для
   диалога в стиле визуальной новеллы + озвучка диалога (flac, записи заказчика).
   Порядок озвучки — КАК ЗАПИСАНО В ИМЕНАХ ФАЙЛОВ: сначала Скаллер 1, потом
   Альдер 1, потом Скаллер 2, потом Альдер 2 и Альдер 2-2 (одна реплика двумя
   файлами), потом Скаллер 3 и т.д. */
import type { FrendyEpi } from './types';

const IMG = import.meta.glob('./assets/agents/*.png', { eager: true, import: 'default', query: '?url' }) as Record<string, string>;
const FLAC = import.meta.glob('./assets/agents/*.flac', { eager: true, import: 'default', query: '?url' }) as Record<string, string>;

const img = (name: string): string => IMG[`./assets/agents/${name}`] ?? '';
const flac = (name: string): string => FLAC[`./assets/agents/${name}`] ?? '';

/* ---------- СПРАЙТЫ (поля) ---------- */
export type AgentWho = 'alder' | 'skaller';

const idleUrls: Record<AgentWho, string[]> = {
  alder: [img('alder-idle-0.png'), img('alder-idle-1.png'), img('alder-idle-2.png')],
  skaller: [img('skaller-idle-0.png'), img('skaller-idle-1.png'), img('skaller-idle-2.png'), img('skaller-idle-3.png'), img('skaller-idle-4.png')],
};
const walkUrls: Record<AgentWho, string[]> = {
  alder: [img('alder-walk-0.png'), img('alder-walk-1.png'), img('alder-walk-2.png')],
  skaller: [img('skaller-walk-0.png'), img('skaller-walk-1.png'), img('skaller-walk-2.png'), img('skaller-walk-3.png')],
};

export const agentPortrait = (who: AgentWho): string => img(who === 'alder' ? 'alder-portrait.png' : 'skaller-portrait.png');
export const AGENT_NAMES: Record<AgentWho, string> = { alder: 'АЛЬДЕР', skaller: 'СКАЛЛЕР' };

/* Кэш картинок: грузим заранее, чтобы рендер на канве не мигал */
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

/** Кадр спрайта: walk=true — цикл ходьбы (по времени), иначе idle (дыхание не нужно — статичная поза).
    Все кадры одного персонажа выровнены по низу холста — рисуем с якорем «ноги». */
export const agentFrame = (who: AgentWho, walking: boolean, time: number, idx = 0): HTMLImageElement | null => {
  const urls = walking ? walkUrls[who] : idleUrls[who];
  if (!urls.length) return null;
  const n = walking ? Math.floor(time / 130) % urls.length : Math.min(idx, urls.length - 1);
  return getImage(urls[n]);
};

/* ---------- СЦЕНАРИЙ РАЗГОВОРА (диалог в стиле визуальной новеллы) ----------
   ПОРЯДОК ЖЁСТКИЙ: skaller-1 → alder-1 → skaller-2 → alder-2 + alder-2-2 (это ОДНА
   реплика двумя файлами) → skaller-3 → alder-3 → skaller-4 → alder-4.
   ТЕКСТЫ — рекострукция по ASR (озвучка записана заказчиком): если какая-то реплика
   звучит иначе, поправьте текст здесь — субтитры/печатная машинка возьмут его отсюда. */
export interface EpiLine {
  who: AgentWho;
  text: string;
  src: string;   // url flac (может быть '' — реплика без звука)
}

const line = (who: AgentWho, text: string, file: string): EpiLine => ({ who, text, src: flac(file) });

export const EPI_SCRIPT: EpiLine[] = [
  line('skaller', 'Всю жизнь я боялась подземных монстров… И вот мы стоим в логове одного из них.', 'skaller-1.flac'),
  line('alder', 'Температура в этой печи чудовищная. Она могла бы расплавить железо.', 'alder-1.flac'),
  line('skaller', 'И всё-таки никто не хочет, чтобы эта штука здесь взорвалась. Совпадение? Не думаю.', 'skaller-2.flac'),
  line('alder', 'Или… что с ним случилось?', 'alder-2.flac'),
  line('alder', 'У меня есть кое-какие материалы по делу. Хочешь зацепки?', 'alder-2-2.flac'),
  line('skaller', 'Ничего… кроме вот этой штуковины. Непонятно, как она не расплавилась. И на ней любопытный узор.', 'skaller-3.flac'),
  line('alder', 'Похоже на слоновую кость… или гиппопотама. Наш герой явно был не из нашего парка.', 'alder-3.flac'),
  line('skaller', 'Передаю дело нашим экспертам, Альдер. Вы правда думаете, что здесь кто-то жёг?', 'skaller-4.flac'),
  line('alder', 'Непременно, Скаллер. «Парильщик» обмануть не сможет.', 'alder-4.flac'),
];

/* Состояние эпилога под рукой рендеру/худу */
export const epiStage = (epi: FrendyEpi | undefined | null): FrendyEpi['stage'] | null => epi?.stage ?? null;
