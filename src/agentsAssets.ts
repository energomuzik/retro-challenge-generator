/* v0.132 АГЕНТЫ («Секретные материалы», неофициальное ФБР) —
   эпилог режима FRENDY после ПОБЕДЫ (все микросхемы сожжены).
   Ассеты: спрайты (idle/walk, нарезаны из арт-листа заказчика) + портреты для
   диалога в стиле визуальной новеллы + озвучка диалога (flac, записи заказчика).
   v0.133: тексты реплик заменены РАСШИФРОВКОЙ ЗАКАЗЧИКА (больше не реконструкция
   по ASR) и добавлены новые реплики — всего 13 файлов: Скаллер 1–6, Альдер
   1, 2, 2-2, 3, 4, 5, 5-2. Порядок разговора — по смыслу сцены (см. EPI_SCRIPT).
   v0.136: ПЕРЕИМЕНОВАНИЕ ПЕРСОНАЖЕЙ (заказчик): СКАЛЛЕР → САЛЛИ, АЛЬДЕР → МОЛДЕР —
   новые имена в плашках новеллы (AGENT_NAMES) и во всех репликах, где они звучат;
   реплики №4 заменены новой расшифровкой и ПЕРЕЗАПИСАННЫМ голосом заказчика
   (flac-файлы skaller-4.flac и alder-4.flac заменены под теми же именами).
   Внутренние id (skaller/alder) НЕ менялись — файлы спрайтов/озвучки и код целы. */
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
export const AGENT_NAMES: Record<AgentWho, string> = { alder: 'МОЛДЕР', skaller: 'САЛЛИ' }; // v0.136: переименование заказчика (было АЛЬДЕР/СКАЛЛЕР)

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
   v0.134: ПОРЯДОК РЕПЛИК — КАК ЗАКАЗАЛ ЗАКАЗЧИК (раньше «Или кто-то…» и вопрос про
   ДНК выскакивали раньше ответа Скаллер про «кто-то очень не хотел…»); тексты —
   расшифровка заказчика дословно.
   ПОРЯДОК: skaller-1 → alder-1 → skaller-2 → alder-2 + alder-2-2 → skaller-3 →
   → alder-3 → skaller-4 → alder-4 → skaller-5 → alder-5 + alder-5-2 → skaller-6. */
export interface EpiLine {
  who: AgentWho;
  text: string;
  src: string;   // url flac (может быть '' — реплика без звука)
}

const line = (who: AgentWho, text: string, file: string): EpiLine => ({ who, text, src: flac(file) });

export const EPI_SCRIPT: EpiLine[] = [
  line('skaller', 'Я думала ты все еще боишься подвального монстра из печи.', 'skaller-1.flac'),
  line('alder', 'Температура в этой печи была настолько высока, что могла расплавить сталь.', 'alder-1.flac'),
  line('skaller', 'Кто то очень не хотел, то что сожгли в ней вообще существовало.', 'skaller-2.flac'),
  line('alder', 'Или кто то...', 'alder-2.flac'),
  line('alder', 'Есть хоть какие ни будь отпечатки ДНК, хоть какие ни будь зацепки?', 'alder-2-2.flac'),
  line('skaller', 'Ничего, кроме вот этой вещицы, не понятно как она не расплавилась, но на ней любопытный узор.', 'skaller-3.flac'),
  line('alder', 'Похож на слона или Гиппопотама. Наш виновник призрак из зоопарка?', 'alder-3.flac'),
  line('skaller', 'Я отдам ее нашим специалистам , И Молдер ты действительно думаешь, что тут кого то сожгли?', 'skaller-4.flac'), // v0.136: новая расшифровка + новый голос
  line('alder', 'Непременно Салли, "Парильщик" обманывать не будет.', 'alder-4.flac'), // v0.136: новая расшифровка + новый голос
  line('skaller', 'Почему ты так ему доверяешь, ты ведь его совсем не знаешь?', 'skaller-5.flac'),
  line('alder', 'Не важно доверяю ли я ему.', 'alder-5.flac'),
  line('alder', 'Просто Салли- доверь мне хорошо?', 'alder-5-2.flac'), // v0.136: имя заменено
  line('skaller', 'Пойдем, тут больше делать нечего.', 'skaller-6.flac'),
];

/* Состояние эпилога под рукой рендеру/худу */
export const epiStage = (epi: FrendyEpi | undefined | null): FrendyEpi['stage'] | null => epi?.stage ?? null;
