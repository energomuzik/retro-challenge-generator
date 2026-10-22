/* v0.132 АГЕНТЫ АЛЬДЕР и СКАЛЛЕР («Секретные материалы», неофициальное ФБР) —
   эпилог режима FRENDY после ПОБЕДЫ (все микросхемы сожжены).
   Ассеты: спрайты (idle/walk, нарезаны из арт-листа заказчика) + портреты для
   диалога в стиле визуальной новеллы + озвучка диалога (flac, записи заказчика).
   v0.133: тексты реплик заменены РАСШИФРОВКОЙ ЗАКАЗЧИКА (больше не реконструкция
   по ASR) и добавлены новые реплики — всего 13 файлов: Скаллер 1–6, Альдер
   1, 2, 2-2, 3, 4, 5, 5-2. Порядок разговора — по смыслу сцены (см. EPI_SCRIPT). */
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
   v0.133: ТЕКСТЫ — РАСШИФРОВКА ЗАКАЗЧИКА (файл «расшифровка» из архива с flac);
   слова реплик не менялись — поправлены только знаки препинания для субтитров.
   НОВЫЕ РЕПЛИКИ (v0.133): Скаллер 5, Альдер 5 + Альдер 5-2 (одна реплика двумя
   файлами), Скаллер 6 — разговор стал длиннее.
   ПОРЯДОК: skaller-1 → alder-1 → alder-2 + alder-2-2 → skaller-2 → skaller-3 →
   → alder-3 → skaller-4 → alder-4 → skaller-5 → alder-5 + alder-5-2 → skaller-6. */
export interface EpiLine {
  who: AgentWho;
  text: string;
  src: string;   // url flac (может быть '' — реплика без звука)
}

const line = (who: AgentWho, text: string, file: string): EpiLine => ({ who, text, src: flac(file) });

export const EPI_SCRIPT: EpiLine[] = [
  line('skaller', 'Я думала, ты всё ещё боишься подвального монстра из печи.', 'skaller-1.flac'),
  line('alder', 'Температура в этой печи была настолько высока, что могла расплавить сталь.', 'alder-1.flac'),
  line('alder', 'Или кто-то…', 'alder-2.flac'),
  line('alder', 'Есть хоть какие-нибудь отпечатки ДНК, хоть какие-нибудь зацепки?', 'alder-2-2.flac'),
  line('skaller', 'Кто-то очень не хотел, чтобы то, что сожгли в ней, вообще существовало.', 'skaller-2.flac'),
  line('skaller', 'Ничего, кроме вот этой вещицы. Непонятно, как она не расплавилась, но на ней любопытный узор.', 'skaller-3.flac'),
  line('alder', 'Похож на слона или гиппопотама. Наш виновник — призрак из зоопарка?', 'alder-3.flac'),
  line('skaller', 'Я отдам её нашим специалистам. И Алдер, ты действительно думаешь, что тут кого-то сожгли?', 'skaller-4.flac'),
  line('alder', 'Непременно, Скаллер. «Парильщик» обманывать не будет.', 'alder-4.flac'),
  line('skaller', 'Почему ты так ему доверяешь? Ты ведь его совсем не знаешь?', 'skaller-5.flac'),
  line('alder', 'Не важно, доверяю ли я ему.', 'alder-5.flac'),
  line('alder', 'Просто, Скаллер, — доверь мне, хорошо?', 'alder-5-2.flac'),
  line('skaller', 'Пойдём, тут больше делать нечего.', 'skaller-6.flac'),
];

/* Состояние эпилога под рукой рендеру/худу */
export const epiStage = (epi: FrendyEpi | undefined | null): FrendyEpi['stage'] | null => epi?.stage ?? null;
