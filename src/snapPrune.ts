import { idbAllKeys, idbDelMany, idbEachRange } from './db';
import type { SessionSnapshot } from './types';

/* v0.167: ОДНОРАЗОВАЯ ЧИСТКА АВТОСЕЙВОВ — лекарство от переполнения «Загрузить игру».
   Прежние версии писали автосейвы под ключом auto-КОДКОМНАТЫ-0..4, а код комнаты
   НОВЫЙ у каждой партии: 5 записей-тяжеловесов (состояние партии + ЦЕЛАЯ карта
   внутри, v0.114) на каждую партию — за месяцы тестов накапливались сотни.
   Экран «Загрузить игра» читал их ВСЕ в память разом и падал по памяти
   («не хватает памяти, страница перезагружена»), не успев показать список.
   Чистка (один раз на браузер, при старте):
   • автосейвы, чья карта уже не в библиотеке (включая все старые auto-КОД), — удалить;
   • у живых карт оставить 5 НОВЕЙШИХ автосейвов, старшие копии — удалить;
   • РУЧНЫЕ сохранения партий («Сохранить партию») НЕ ТРОГАЕМ — как заказывал заказчик. */
const FLAG = 'retropolia-autoslot-prune-1';
const KEEP_PER_MAP = 5;
let ran = false;

export async function pruneAutosaveBloat(toast?: (text: string, kind?: 'ok' | 'err' | 'info') => void): Promise<void> {
  if (ran) return;
  ran = true;
  try {
    try { if (localStorage.getItem(FLAG)) return; } catch { /* приватный режим — чистим без флага */ }
    const keys = await idbAllKeys('sessions');
    if (!keys.some((k) => k.startsWith('auto-'))) {
      try { localStorage.setItem(FLAG, '1'); } catch { /* noop */ }
      return; // автосейвов нет вообще — чистить нечего
    }
    const mapSet = new Set(await idbAllKeys('maps'));
    const legacy: string[] = []; // auto-КОД (карта неизвестна) или карта удалена
    const perMap = new Map<string, { key: string; at: number }[]>();
    await idbEachRange<SessionSnapshot>('sessions', 'auto-', 'auto-\uffff', (k, v) => {
      const cut = k.lastIndexOf('-');
      const mid = cut > 5 ? k.slice(5, cut) : '';
      if (mid && mapSet.has(mid)) {
        const arr = perMap.get(mid) ?? [];
        arr.push({ key: k, at: v?.createdAt ?? 0 });
        perMap.set(mid, arr);
      } else legacy.push(k);
    });
    const del = [...legacy];
    for (const arr of perMap.values()) {
      arr.sort((a, b) => b.at - a.at);
      for (const x of arr.slice(KEEP_PER_MAP)) del.push(x.key);
    }
    if (!del.length) {
      try { localStorage.setItem(FLAG, '1'); } catch { /* noop */ }
      return;
    }
    await idbDelMany('sessions', del);
    try { localStorage.setItem(FLAG, '1'); } catch { /* noop */ }
    toast?.(`🧹 Починено «Загрузить игру»: удалено лишних автосейвов — ${del.length}. Теперь их 5 на карту, перезаписываются по кругу`, 'ok');
  } catch { /* база недоступна — попробуем при следующем запуске (флаг не ставим) */ }
}
