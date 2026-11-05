import { idbAllKeys, idbDelMany, idbEachRange, idbGet } from './db';
import type { AutosavePolicy, GameMap, SessionSnapshot } from './types';
import { autosavePolicyOf } from './types';

/* ОДНОРАЗОВАЯ ЧИСТКА АВТОСЕЙВОВ — лекарство от переполнения «Загрузить игру».
   Прежние версии писали автосейвы под ключом auto-КОДКОМНАТЫ-0..4, а код комнаты
   НОВЫЙ у каждой партии: 5 записей-тяжеловесов (состояние партии + ЦЕЛАЯ карта
   внутри, v0.114) на каждую партию — за месяцы тестов накапливались сотни.
   Экран «Загрузить игра» читал их ВСЕ в память разом и падал по памяти
   («не хватает памяти, страница перезагружена»), не успев показать список.
   Чистка (один раз на браузер, при старте):
   • автосейвы, чья карта уже не в библиотеке (включая все старые auto-КОД), — удалить;
   • у живых карт оставить 5 НОВЕЙШИХ автосейвов, старшие копии — удалить;
   • v0.168: автосейвы с именем «Автосейв · ход N» на картах БЕЗ ходов (ФРЕНДИ, QUEST,
     RUBG, Джёрни, Богач) и в QUIZowo — удалить: универсальная политика «по ходам»
     писала там одинаковые «ход 1» каждые 8 секунд; новые автосейвы этих режимов
     зовутся честно («Автосейв · 14:32») и появятся сами в первые 5 минут игры;
   • РУЧНЫЕ сохранения партий («Сохранить партию») НЕ ТРОГАЕМ — как просил заказчик. */
const FLAG = 'retropolia-autoslot-prune-2';
const KEEP_PER_MAP = 5;
const RE_TURN_NAME = /^Автосейв · ход \d+$/; // имя автосейва «по ходам» — законно только в классике
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
    /* v0.168: политика карты (по mode из библиотеки) с кэшем — карты читаем по одной */
    const modeCache = new Map<string, AutosavePolicy | undefined>();
    const policyOf = async (mid: string): Promise<AutosavePolicy | undefined> => {
      if (modeCache.has(mid)) return modeCache.get(mid);
      const m = mid && mapSet.has(mid) ? await idbGet<GameMap>('maps', mid) : undefined;
      const p = m ? autosavePolicyOf(m.mode) : undefined;
      modeCache.set(mid, p);
      return p;
    };
    const legacy: string[] = []; // auto-КОД (карта неизвестна) или карта удалена
    const perMap = new Map<string, { key: string; at: number }[]>();
    const misnamed: string[] = []; // «ход N» на карте без ходов — мусор старой политики
    await idbEachRange<SessionSnapshot>('sessions', 'auto-', 'auto-\uffff', (k, v) => {
      const cut = k.lastIndexOf('-');
      const mid = cut > 5 ? k.slice(5, cut) : '';
      if (mid && mapSet.has(mid)) {
        if (v && typeof v.name === 'string' && RE_TURN_NAME.test(v.name)) misnamed.push(k);
        const arr = perMap.get(mid) ?? [];
        arr.push({ key: k, at: v?.createdAt ?? 0 });
        perMap.set(mid, arr);
      } else legacy.push(k);
    });
    const del = new Set<string>([...legacy]);
    for (const arr of perMap.values()) {
      arr.sort((a, b) => b.at - a.at);
      for (const x of arr.slice(KEEP_PER_MAP)) del.add(x.key);
    }
    for (const k of misnamed) {
      if (del.has(k)) continue; // уже в списке (лишняя копия)
      const cut = k.lastIndexOf('-');
      const mid = cut > 5 ? k.slice(5, cut) : '';
      const pol = await policyOf(mid);
      if (pol && pol !== 'turn') del.add(k); // «ход N» законен только в классике с ходами
    }
    if (!del.size) {
      try { localStorage.setItem(FLAG, '1'); } catch { /* noop */ }
      return;
    }
    await idbDelMany('sessions', [...del]);
    try { localStorage.setItem(FLAG, '1'); } catch { /* noop */ }
    toast?.(`🧹 Починено «Загрузить игру»: удалено автосейвов — ${del.size} (лишние копии и «ход N» в режимах без ходов). Теперь их максимум 5 на карту, перезаписываются по кругу`, 'ok');
  } catch { /* база недоступна — попробуем при следующем запуске (флаг не ставим) */ }
}
