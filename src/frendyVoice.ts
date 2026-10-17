/* v0.124 FRENDY: ОЗВУЧКА — сопоставление файлов ЯВНОЕ (по имени), а не по сортировке папки:
   frendy-N.mp3 — фразочка начала охоты №N (порядок = FRENDY_PHRASES),
   cine-intro-N.mp3 / cine-win-N.mp3 / cine-sting-N.mp3 — реплики кат-сцен (FRENDY_CINE),
   laugh-N.mp3 — злой смех (катсцены, паузы между фразами).
   Нет файла — вызывающий код фолбэчится на синтез речи. */
const FILES = import.meta.glob('./assets/frendy/*.mp3', { eager: true, import: 'default', query: '?url' }) as Record<string, string>;

const byName = (name: string): string | null => FILES[`./assets/frendy/${name}`] ?? null;

/** Озвучка фразочки начала охоты №n (порядок = FRENDY_PHRASES). */
export const frendyPhraseVoice = (n: number): string | null => byName(`frendy-${n}.mp3`);

/** Реплика катсцены: группа intro/win/sting, вариант i (порядок = FRENDY_CINE[group]). */
export const frendyCineVoice = (group: 'intro' | 'win' | 'sting', i: number): string | null => byName(`cine-${group}-${i}.mp3`);

/** Злой смех №i (для катсцен и стингера). */
export const frendyLaughVoice = (i: number): string | null => byName(`laugh-${i}.mp3`);

/** Сколько файлов-фраз реально вшито (для фолбэков). */
export const frendyVoiceCount = Object.keys(FILES).length;
