/* v0.178: БЛОК «☁ В БАЗЕ СОХРАНЕНИЙ» — общий для «Запуска эмулятора» (внизу
   панели «Сохранения», полный вид) и «Редактора заданий» (в спойлере сохранений
   выбранного рома, компактный вид). Показывает СОХРАНЕНИЯ ДЛЯ ЭТОГО РОМА из базы
   на GitHub — сверка по имени файла рома, как уже реализовано в библиотеке
   (findLocalRomByFile) и в ромах с Яндекса. В базе у каждого сохранения СВОЯ
   папка ПО ИМЕНИ СОХРАНЕНИЯ (без ника; v0.180 — ника нет и в карточках), поэтому
   в списке видно каждое сохранение отдельно: имя, вид, дата — и «⬇
   Забрать» качает ИМЕННО ЕГО и добавляет в библиотеку устройства НОВОЙ записью —
   свои сохранения никто не перезаписывает. Кнопка «⟳ обновить» перечитывает
   базу с GitHub, сбросив 5-минутный кэш. */

import { useEffect, useState } from 'react';
import { useApp } from './store';
import { PxBtn } from './ui';
import { sfx } from './sound';
import type { RomDef } from './types';
import {
  SAVE_DB_REPO,
  fetchCloudIndex,
  fetchCloudCard,
  importCloudCard,
  type CloudCard,
  type CloudSaveGroup,
} from './saveCloud';
import { sanitizeRepoSeg } from './zipStore';

const fmtWhen = (ts: number) =>
  new Date(ts).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

const KIND_RU: Record<string, string> = { level: 'уровень', boss: 'босс', mytask: 'моё задание', private: 'частное' };

export default function CloudSavesBlock({ rom, compact }: { rom: RomDef | null; compact?: boolean }) {
  const { toast, refresh } = useApp();
  const [phase, setPhase] = useState<'loading' | 'ready' | 'error'>('loading');
  const [errText, setErrText] = useState('');
  const [groups, setGroups] = useState<CloudSaveGroup[]>([]);
  const [cards, setCards] = useState<Record<string, CloudCard>>({});
  const [busyPath, setBusyPath] = useState<string | null>(null);
  const [tick, setTick] = useState(0);
  const romId = rom?.id ?? null;

  useEffect(() => {
    if (!rom) return;
    let dead = false;
    const run = async (force: boolean) => {
      setPhase('loading');
      setErrText('');
      const folder = sanitizeRepoSeg(rom.fileName);
      try {
        const idx = await fetchCloudIndex(force);
        const mine = idx.filter((g) => g.gameFolder === folder);
        /* карточки — маленькие JSON: тянем сразу все для этого рома, чтобы показать
           имена/виды без лишних кликов (состояния качаются отдельно) */
        const cs: Record<string, CloudCard> = {};
        await Promise.all(mine.map(async (g) => {
          try { cs[g.cardPath] = await fetchCloudCard(g.cardPath); } catch { /* покажем имя папки без деталей */ }
        }));
        if (dead) return;
        setCards(cs);
        setGroups(mine);
        setPhase('ready');
      } catch (e) {
        if (dead) return;
        setErrText(e instanceof Error ? e.message : 'Связи с GitHub нет');
        setPhase('error');
      }
    };
    void run(false);
    return () => { dead = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [romId, tick]);

  if (!rom) return null;

  const refreshClick = () => { sfx.click(); setTick((t) => t + 1); };

  const grab = (g: CloudSaveGroup) => {
    void (async () => {
      const card = cards[g.cardPath];
      if (!card) { sfx.fail(); toast('Карточка сохранения не открылась — нажмите ⟳ и попробуйте снова', 'err'); return; }
      setBusyPath(g.cardPath);
      try {
        const folder = g.cardPath.slice(0, g.cardPath.lastIndexOf('/')); // папка сохранения в базе
        const n = await importCloudCard(rom.id, card, folder);
        if (n > 0) {
          await refresh();
          sfx.success();
          toast(`☁ «${card.name || g.saveFolder}» добавлено в библиотеку — оно уже в списке сохранений рома`, 'ok');
        } else {
          sfx.fail();
          toast('Не получилось забрать сохранение — проверьте интернет и нажмите ⟳', 'err');
        }
      } catch {
        sfx.fail();
        toast('Не получилось забрать сохранение — проверьте интернет и попробуйте снова', 'err');
      }
      setBusyPath(null);
    })();
  };

  const head = (
    <div className="flex items-center gap-2 flex-wrap">
      <span className={`tick-label ${groups.length ? 'text-teal' : 'text-dim'}`}>
        ☁ В базе сохранений для «{rom.name}»{groups.length ? ` — сохранений: ${groups.length}` : ' пока пусто'}
      </span>
      <button
        onClick={refreshClick}
        className="tick-label text-gold hover:underline cursor-pointer shrink-0"
        title="Перечитать базу с GitHub, сбросив кэш на 5 минут"
      >⟳ обновить</button>
    </div>
  );

  if (phase === 'error') {
    return (
      <div className={compact ? 'mt-1.5 border-t-2 border-edge pt-1.5' : 'space-y-1'}>
        {head}
        <div className="tick-label text-magma leading-snug">База недоступна: {errText}.</div>
        <div className="tick-label text-faint leading-snug">База живёт в репозитории {SAVE_DB_REPO} — если она ещё не создана, она появится после первого деплоя сохранений владельцем.</div>
      </div>
    );
  }

  return (
    <div className={compact ? 'mt-1.5 border-t-2 border-edge pt-1.5 space-y-1' : 'space-y-1.5'}>
      {head}
      {phase === 'loading' && <div className="tick-label text-faint">Ищу в базе на GitHub…</div>}
      {phase === 'ready' && groups.length > 0 && (
        <div className={compact ? 'space-y-1' : 'grid sm:grid-cols-2 gap-2'}>
          {groups.map((g) => {
            const card = cards[g.cardPath];
            const when = card ? (card.createdAt || card.exportedAt || 0) : 0;
            return (
              <div key={g.cardPath} className="border-2 border-edge bg-panel px-2.5 py-2 flex items-center gap-2">
                <div className="min-w-0 flex-1">
                  <div className="font-display text-[10px] uppercase text-paper truncate">💾 {card?.name || g.saveFolder}</div>
                  <div className="tick-label text-faint mt-0.5 leading-snug">
                    {/* v0.180: подписи с автором больше НЕТ — ник игрока не записывается в базу */}
                    {KIND_RU[card?.kind || 'level'] || 'уровень'}
                    {when ? ` · от ${fmtWhen(when)}` : ''}
                  </div>
                </div>
                <PxBtn
                  small
                  color="teal"
                  onClick={() => grab(g)}
                  disabled={busyPath === g.cardPath}
                  title="Скачать это сохранение из базы и добавить в библиотеку (свои сохранения не трогаются)"
                >
                  {busyPath === g.cardPath ? '⏳ Забираю…' : '⬇ Забрать'}
                </PxBtn>
              </div>
            );
          })}
        </div>
      )}
      {phase === 'ready' && groups.length > 0 && (
        <p className="tick-label text-faint leading-snug">
          «⬇ Забрать» добавляет сохранение в библиотеку устройства НОВОЙ записью — свои сохранения никто не перезаписывает.
          Сохранения находятся по имени файла рома в базе {SAVE_DB_REPO}.
        </p>
      )}
    </div>
  );
}
