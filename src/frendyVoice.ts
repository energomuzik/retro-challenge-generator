/* v0.131 ОЗВУЧКА ФРЕНДИ — ЗАПИСИ ЗАКАЗЧИКА СВОИМ ГОЛОСОМ (смех ВШИТ в каждую фразу —
   отдельных смехов laugh-0/1 больше НЕТ ни в коде, ни в ассетах):
   frendy-N.mp3 — фразочка начала охоты №N (порядок = FRENDY_PHRASES),
   cine-<группа>-<N>.mp3 — реплики кат-сцен (FRENDY_CINE: intro/win/sting/badend).
   v0.135: номер файла реплики кат-сцены берётся ЯВНО из поля f (FrendyCineLine) —
   порядок реплик в FRENDY_CINE больше не обязан совпадать с нумерацией файлов;
   лор-реплики интро удалены вместе с файлами cine-intro-0.mp3 и cine-intro-2.mp3.
   Сопоставление файлов ЯВНОЕ (по имени), а не по сортировке папки.
   Нет файла — вызывающий код фолбэчится на синтез речи.
   v0.133 ГРОМКОСТЬ ФРЕНДИ: все реплики Френди (фразы охоты, кат-сцены) и разговор
   агентов в эпилоге играются с СОБСТВЕННОЙ громкостью из Опций (options.frendyVol,
   0..150%) — больше не привязаны к «Эффектам интерфейса». По умолчанию 100% —
   громче прежнего (раньше бралась громкость эффектов, по умолчанию 60%).
   Значения больше 100% усиливаются через WebAudio GainNode (сам Audio.volume
   ограничен единицей); если контекст звука ещё нельзя запустить — играем как 100%. */
const FILES = import.meta.glob('./assets/frendy/*.mp3', { eager: true, import: 'default', query: '?url' }) as Record<string, string>;

import { useApp } from './store';

/** Громкость реплик Френди из Опций (0..1.5; отсутствие поля у старых настроек = 100%). */
export const frendyVol = (): number => {
  const v = useApp.getState().options.frendyVol;
  return typeof v === 'number' && Number.isFinite(v) ? Math.max(0, Math.min(1.5, v)) : 1;
};

/* WebAudio-усиление (>100%): один AudioContext на страницу, GainNode на каждый элемент.
   Контекст может быть запрещён до первого клика — тогда усиление не подключаем вовсе
   (элемент играет как обычно), звук НЕ пропадает никогда. */
let AC: AudioContext | null = null;
function boostGain(a: HTMLAudioElement, factor: number): void {
  try {
    AC = AC ?? new AudioContext();
    if (AC.state === 'suspended') void AC.resume().catch(() => { /* noop */ });
    if (AC.state !== 'running') return; // усиливать нельзя — остаёмся на 100% (звук не теряем)
    const src = AC.createMediaElementSource(a);
    const g = AC.createGain();
    g.gain.value = factor;
    src.connect(g);
    g.connect(AC.destination);
  } catch { /* элемент уже подключён или WebAudio недоступен — обычная громкость */ }
}

/** Audio-элемент реплики Френди с громкостью из Опций (создаёт Audio, но НЕ вызывает play). */
export function makeFrendyAudio(url: string | null): HTMLAudioElement | null {
  if (!url) return null;
  try {
    const a = new Audio(url);
    const v = frendyVol();
    if (v > 1) { boostGain(a, v); a.volume = 1; } else a.volume = v;
    return a;
  } catch { return null; }
}

const byName = (name: string): string | null => FILES[`./assets/frendy/${name}`] ?? null;

/** Озвучка фразочки начала охоты №n (порядок = FRENDY_PHRASES). */
export const frendyPhraseVoice = (n: number): string | null => byName(`frendy-${n}.mp3`);

/** Реплика катсцены: группа intro/win/sting/badend, вариант i (порядок = FRENDY_CINE[group]). */
export const frendyCineVoice = (group: 'intro' | 'win' | 'sting' | 'badend', i: number): string | null => byName(`cine-${group}-${i}.mp3`);

/** Сколько файлов-фраз реально вшито (для фолбэков). */
export const frendyVoiceCount = Object.keys(FILES).length;
