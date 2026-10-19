/* v0.131 ОЗВУЧКА ФРЕНДИ — ЗАПИСИ ЗАКАЗЧИКА СВОИМ ГОЛОСОМ (смех ВШИТ в каждую фразу —
   отдельных смехов laugh-0/1 больше НЕТ ни в коде, ни в ассетах):
   frendy-N.mp3 — фразочка начала охоты №N (порядок = FRENDY_PHRASES),
   cine-intro-N.mp3 / cine-win-N.mp3 / cine-sting-N.mp3 — реплики кат-сцен (FRENDY_CINE),
   cine-badend-N.mp3 — глумление, когда все проиграли (титры поражения, FRENDY_CINE.badend).
   Сопоставление файлов ЯВНОЕ (по имени), а не по сортировке папки.
   Нет файла — вызывающий код фолбэчится на синтез речи. */
const FILES = import.meta.glob('./assets/frendy/*.mp3', { eager: true, import: 'default', query: '?url' }) as Record<string, string>;

const byName = (name: string): string | null => FILES[`./assets/frendy/${name}`] ?? null;

/** Озвучка фразочки начала охоты №n (порядок = FRENDY_PHRASES). */
export const frendyPhraseVoice = (n: number): string | null => byName(`frendy-${n}.mp3`);

/** Реплика катсцены: группа intro/win/sting/badend, вариант i (порядок = FRENDY_CINE[group]). */
export const frendyCineVoice = (group: 'intro' | 'win' | 'sting' | 'badend', i: number): string | null => byName(`cine-${group}-${i}.mp3`);

/** Сколько файлов-фраз реально вшито (для фолбэков). */
export const frendyVoiceCount = Object.keys(FILES).length;
