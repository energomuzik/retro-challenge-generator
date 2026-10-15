/* v0.109 БОГАЧ — панель донатов хоста: статус слушателя, минималка,
   пул ромов/сейвов, ручная форма и шпаргалка для стрима.
   v0.112: панель открыта и ИЗ РЕДАКТОРА ЗАДАНИЙ (кнопка «💰 Донаты» в тулбаре):
   там заранее, без партии, набирается пул ГАЛОЧКАМИ (папка целиком или
   отдельные ромы/сохранения), скачивается батник и генерируется шпаргалка
   по редактируемой карте. В партии — та же панель плюс статус и ручная форма. */
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../store';
import { Modal, Field, PxBtn, Ic } from '../ui';
import { sfx } from '../sound';
import { DONATE_CHAOS } from '../types';
import { SAVE_KIND_CLS, SAVE_KIND_LABEL, SAVE_KIND_SHORT, saveKindOf } from '../types';
import type { GameMap, RomDef, SaveDef } from '../types';
import { CartridgeBadge } from '../cartridge';
import { loadPool, savePool, setMinimalka, applyDonat, buildShpargalka, subscribeBogach, getBogachStatus, type BogachPool } from '../bogach';
import { BOGACH_BAT } from '../bogachBat';

export function BogachPanel({ onClose, editorMap }: { onClose: () => void; editorMap?: GameMap | null }) {
  const editor = editorMap !== undefined; // v0.112: панель открыта из редактора заданий
  const { roms, saves, sessionMap, room } = useApp();
  const [, force] = useState(0);
  useEffect(() => subscribeBogach(() => force((n) => n + 1)), []);
  const status = getBogachStatus();
  const [pool, setPool] = useState<BogachPool>(() => loadPool());
  const [min, setMin] = useState<string>(() => String(getBogachStatus().min));
  const [fCell, setFCell] = useState('');
  const [fRom, setFRom] = useState('');
  const [fSave, setFSave] = useState('');
  const [fChaos, setFChaos] = useState('0');
  const [formErr, setFormErr] = useState('');
  const [shp, setShp] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const romFolders = useMemo(() => [...new Set(roms.map((r) => r.folder ?? '').filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru')), [roms]);
  const looseRoms = roms.filter((r) => !r.folder);

  const poolRomSet = useMemo(() => new Set(pool.roms), [pool.roms]);
  const poolSaveSet = useMemo(() => new Set(pool.saves), [pool.saves]);
  const commitPool = (p: BogachPool) => { setPool(p); savePool(p); };

  /* v0.112: галочки пула — ром/папка/сейв/сейвы рома; папка снимается ЦЕЛИКОМ, если всё внутри отмечено */
  const togglePoolRom = (id: string) => {
    commitPool(poolRomSet.has(id) ? { ...pool, roms: pool.roms.filter((x) => x !== id) } : { ...pool, roms: [...pool.roms, id] });
    sfx.click();
  };
  const togglePoolFolder = (f: string) => {
    const ids = roms.filter((r) => r.folder === f).map((r) => r.id);
    const allIn = ids.length > 0 && ids.every((id) => poolRomSet.has(id));
    commitPool(allIn
      ? { ...pool, roms: pool.roms.filter((x) => !ids.includes(x)) }
      : { ...pool, roms: [...pool.roms, ...ids.filter((id) => !poolRomSet.has(id))] });
    sfx.click();
  };
  const togglePoolSave = (id: string) => {
    commitPool(poolSaveSet.has(id) ? { ...pool, saves: pool.saves.filter((x) => x !== id) } : { ...pool, saves: [...pool.saves, id] });
    sfx.click();
  };
  const togglePoolRomSaves = (romId: string) => {
    const ids = saves.filter((s) => s.romId === romId).map((s) => s.id);
    const allIn = ids.length > 0 && ids.every((id) => poolSaveSet.has(id));
    commitPool(allIn
      ? { ...pool, saves: pool.saves.filter((x) => !ids.includes(x)) }
      : { ...pool, saves: [...pool.saves, ...ids.filter((id) => !poolSaveSet.has(id))] });
    sfx.click();
  };
  const clearPoolRoms = () => { commitPool({ ...pool, roms: [] }); sfx.click(); };
  const clearPoolSaves = () => { commitPool({ ...pool, saves: [] }); sfx.click(); };

  const applyManual = async () => {
    setFormErr('');
    const res = await applyDonat({ manual: true, cell: Number(fCell), rom: Number(fRom), save: Number(fSave) || 0, chaos: Number(fChaos) });
    if (res.ok) {
      sfx.coin();
      setFCell(''); setFSave(''); setFChaos('0');
    } else {
      sfx.fail();
      setFormErr(res.reason);
    }
  };

  const genShp = () => {
    /* v0.112: в редакторе шпаргалка строится по редактируемой карте */
    const txt = buildShpargalka(editor ? editorMap : undefined);
    setShp(txt);
    setCopied(false);
    sfx.click();
  };

  const copyShp = async () => {
    if (!shp) return;
    try {
      await navigator.clipboard.writeText(shp);
      setCopied(true);
      sfx.click();
      window.setTimeout(() => setCopied(false), 2500);
    } catch { /* clipboard недоступен — текст и так в поле ниже */ }
  };

  const dlShp = () => {
    if (!shp) return;
    try {
      const blob = new Blob([shp], { type: 'text/plain;charset=utf-8' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `shpargalka-bogach-${editor ? (editorMap?.name ?? 'karta') : (room?.code ?? 'party')}.txt`;
      a.click();
      URL.revokeObjectURL(a.href);
      sfx.click();
    } catch { /* noop */ }
  };

  const doorLabel = status.door === 'open' ? 'СЛУШАТЕЛЬ НА СВЯЗИ' : status.door === 'connecting' ? 'СЛУШАТЕЛЬ НЕ ЗАПУЩЕН (жду…)' : 'ДВЕРЬ ЗАКРЫТА';

  /* v0.111: батник v2.0 вшит в игру и отдаётся Blob-ом — на сайте файлов нет, ничего публиковать не нужно */
  const dlBat = () => {
    try {
      const blob = new Blob([BOGACH_BAT], { type: 'application/octet-stream' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'bogach-donat.bat';
      a.click();
      URL.revokeObjectURL(a.href);
      sfx.click();
    } catch { /* noop */ }
  };

  /* v0.112: строка галочки рома — метка «РОМ №N» = номер, который донатер пишет в команде */
  const romCheckRow = (r: RomDef) => {
    const inPool = poolRomSet.has(r.id);
    const no = pool.roms.indexOf(r.id) + 1;
    return (
      <label key={r.id} className="flex items-center gap-1.5 px-1 py-0.5 cursor-pointer hover:bg-[rgba(255,207,63,0.07)]">
        <input type="checkbox" className="accent-[var(--color-gold)] cursor-pointer shrink-0" checked={inPool} onChange={() => togglePoolRom(r.id)} />
        <CartridgeBadge rom={r} h={14} />
        <span className="text-[11px] text-paper truncate flex-1">{r.name}</span>
        {inPool
          ? <span className="font-pixel text-[8px] text-gold shrink-0">РОМ №{no}</span>
          : <span className="tick-label text-faint shrink-0">{(r.ext ?? '').toUpperCase()}</span>}
      </label>
    );
  };

  /* v0.112: строка галочки сохранения — метка «СЕЙВ №N» */
  const saveCheckRow = (sv: SaveDef) => {
    const inPool = poolSaveSet.has(sv.id);
    const no = pool.saves.indexOf(sv.id) + 1;
    return (
      <label key={sv.id} className="flex items-center gap-1.5 px-1 py-0.5 cursor-pointer hover:bg-[rgba(255,207,63,0.07)]">
        <input type="checkbox" className="accent-[var(--color-gold)] cursor-pointer shrink-0" checked={inPool} onChange={() => togglePoolSave(sv.id)} />
        <span className={`font-pixel text-[7px] px-1 py-0.5 shrink-0 ${SAVE_KIND_CLS[saveKindOf(sv)]}`}>{SAVE_KIND_SHORT[saveKindOf(sv)]}</span>
        <span className="text-[11px] text-paper truncate flex-1">{sv.name}</span>
        {inPool && <span className="font-pixel text-[8px] text-gold shrink-0">СЕЙВ №{no}</span>}
      </label>
    );
  };

  return (
    <Modal title={editor ? 'Богач · донаты (редактор)' : 'Богач · донаты'} icon={Ic.cart(16)} onClose={onClose} w="max-w-3xl">
      <div className="space-y-4">
        {/* ---------- СТАТУС (в партии) / ПОДСКАЗКА (в редакторе) ---------- */}
        {editor ? (
          <div className="border-2 border-edge px-3 py-2.5">
            <div className="font-pixel text-[10px] text-gold">РЕЖИМ РЕДАКТОРА ЗАДАНИЙ</div>
            <p className="text-[10px] text-dim mt-1 leading-snug">
              Здесь донаты готовятся ЗАРАНЕЕ: отметь пул галочками и задай минималку — всё сохранится в этом браузере
              и заработает в партии. Кнопка «💰 Донаты» появится и в игре у хоста: там будут статус слушателя,
              ручная форма и шпаргалка. Батник скачивается ниже — он один и тот же.
            </p>
          </div>
        ) : (
          <div className="border-2 border-edge px-3 py-2.5 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap font-pixel text-[10px]">
              <span className={status.door === 'open' ? 'text-teal' : 'text-dim'}>● {doorLabel}</span>
              <span className={status.key ? 'text-teal' : 'text-magma'}>· ключ .env: {status.key ? 'найден' : 'НЕ найден — проверь .env рядом с батником'}</span>
            </div>
            <div className="font-pixel text-[9px] text-dim">
              минималка слушателя: {status.min} ₽ · опрос DonatePay каждые {status.interval} с · команд принято: {status.processed}
            </div>
            {status.results.length > 0 && (
              <div className="space-y-0.5 max-h-28 overflow-y-auto">
                {status.results.map((r) => (
                  <div key={r.id + r.ts} className={`font-pixel text-[9px] leading-tight ${r.ok ? 'text-teal' : 'text-magma'}`}>
                    {r.ok ? '✔' : '✖'} {r.manual ? 'вручную' : `${r.name ?? '?'} · ${r.sum ?? '?'} ₽`} — {r.ok ? 'применено' : r.reason}
                    {r.text ? ` · «${r.text.slice(0, 60)}»` : ''}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ---------- ИНТЕРАКТИВ СО ЗРИТЕЛЯМИ: один батник под спойлером ---------- */}
        <Field label="Интерактив со зрителями — донаты меняют задания ячеек">
          <details className="border-2 border-edge px-3 py-2">
            <summary className="cursor-pointer select-none font-pixel text-[10px] text-gold hover:text-paper">▸ Как подключить донаты себе: описание и один батник</summary>
            <p className="text-[10px] text-dim mt-2 leading-snug">
              Зритель донатит через DonatePay от минималки и пишет в тексте доната команду
              «донат режим ЯЧЕЙКА РОМ СЕЙВ ПАКОСТЬ» — игра на этой ячейке меняется у всей компании в реальном
              времени: ром из твоего пула, сохранение, пакость 0–30. Задание донатер не пишет — играет вшитое в
              карту. Обычные донаты без команды не трогаются — алерты OBS работают как работали. У каждого хоста —
              свой DonatePay и своя выручка.
            </p>
            <div className="mt-2">
              <PxBtn small color="gold" onClick={dlBat}>{Ic.download(12)} Скачать bogach-donat.bat — ОДИН файл</PxBtn>
            </div>
            <ol className="text-[10px] text-dim mt-1.5 space-y-0.5 list-decimal list-inside">
              <li>Положи батник в любую папку (например C:\bogach) и запусти. Если браузер дописал «.txt» — сотри его.</li>
              <li>Батник сам развернёт слушателя и подсказки (instrukcia-bogach.txt, bogach-dlya-strima.txt) и сам скачает Node.js (~30 МБ, один раз) — качать больше ничего не нужно.</li>
              <li>Батник сам создаст .env и откроет Блокнот — впиши СВОЙ ключ: donatepay.ru → Настройки → API → DONATEPAY_KEY=ключ → Ctrl+S.</li>
              <li>Держи окно открытым весь стрим (свернуть можно). В партии появится «СЛУШАТЕЛЬ НА СВЯЗИ» — пул и минималку можно было заполнить здесь заранее, галочками.</li>
            </ol>
            <p className="text-[10px] text-faint mt-1.5">
              Безопасно: ключ живёт только в .env на твоём компьютере — сайт и игроки его не видят; слушатель общается
              только с donatepay.ru и этой вкладкой; чужие сайты управлять им не могут — только эта игра. При каждом
              запуске батник сам проверяет папку и доделывает, чего не хватает.
            </p>
          </details>
        </Field>

        {/* ---------- МИНИМАЛКА ---------- */}
        <Field label="Минималка доната (₽) — сумма, с которой команда срабатывает">
          <div className="flex gap-2">
            <input className="field-in w-28 px-2 py-2 text-sm" inputMode="numeric" value={min} onChange={(e) => setMin(e.target.value.replace(/\D/g, ''))} />
            <PxBtn small onClick={() => { setMinimalka(Number(min) || 50); sfx.click(); }}>Сохранить</PxBtn>
          </div>
          <p className="text-[10px] text-faint mt-1">Обычные донаты без команды «донат режим …» игнорируются — алерты OBS работают как работали.</p>
        </Field>

        {/* ---------- ПУЛ РОМОВ ---------- */}
        <Field label={`Пул ромов для донатов (${pool.roms.length}) — номер донатера = строка`}>
          <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
            {pool.roms.length === 0 && <p className="text-[11px] text-dim">Пусто — отметь игры галочками ниже: папка целиком или отдельные ромы.</p>}
            {pool.roms.map((rid, i) => {
              const r = roms.find((x) => x.id === rid);
              return (
                <div key={`${rid}-${i}`} className="flex items-center gap-2 border-2 border-edge px-2 py-1">
                  <span className="font-pixel text-[10px] text-gold w-6">{i + 1}</span>
                  <span className="text-[11px] text-paper truncate flex-1">{r?.name ?? rid} <span className="text-faint">({(r?.ext ?? '?').toUpperCase()})</span></span>
                  <button onClick={() => { commitPool({ ...pool, roms: pool.roms.filter((_, j) => j !== i) }); sfx.click(); }} className="text-dim hover:text-coral cursor-pointer" title="Убрать из пула">{Ic.trash(12)}</button>
                </div>
              );
            })}
          </div>
          {/* v0.112: БЫСТРЫЙ ВЫБОР ГАЛОЧКАМИ — папка целиком или отдельные ромы */}
          <div className="mt-2 border-2 border-edge px-2 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="tick-label text-gold">☑ Быстрый выбор галочками</span>
              {pool.roms.length > 0 && (
                <button onClick={clearPoolRoms} className="tick-label text-faint hover:text-coral cursor-pointer" title="Убрать из пула сразу все ромы">очистить пул</button>
              )}
            </div>
            <p className="text-[9.5px] text-faint mt-0.5 leading-snug">
              Галочка = ром в пуле донатов; папка — отметить или снять всё внутри. Золотая метка «РОМ №N» —
              номер, который донатер пишет в команде. Порядок номеров = порядок в списке выше.
            </p>
            <div className="mt-1 space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {romFolders.map((f) => {
                const inF = roms.filter((r) => r.folder === f);
                const inCnt = inF.filter((r) => poolRomSet.has(r.id)).length;
                const allIn = inCnt === inF.length;
                return (
                  <div key={`bf-${f}`}>
                    <label className="flex items-center gap-1.5 px-1 py-0.5 cursor-pointer hover:bg-[rgba(255,207,63,0.07)]" title={allIn ? `Снять ВСЮ папку «${f}» с пула` : `Добавить ВСЮ папку «${f}» в пул`}>
                      <input
                        type="checkbox"
                        className="accent-[var(--color-gold)] cursor-pointer shrink-0"
                        checked={allIn}
                        ref={(el) => { if (el) el.indeterminate = inCnt > 0 && !allIn; }}
                        onChange={() => togglePoolFolder(f)}
                      />
                      <span className="text-[11px] shrink-0">📁</span>
                      <span className="font-display text-[10px] uppercase text-dim truncate">{f}</span>
                      <span className="tick-label text-faint ml-auto shrink-0">{inCnt}/{inF.length}</span>
                    </label>
                    <div className="pl-5">{inF.map((r) => romCheckRow(r))}</div>
                  </div>
                );
              })}
              {looseRoms.length > 0 && (
                <div>
                  <div className="tick-label text-faint px-1 py-0.5">Без папки · {looseRoms.length}</div>
                  <div>{looseRoms.map((r) => romCheckRow(r))}</div>
                </div>
              )}
              {roms.length === 0 && (
                <p className="text-[11px] text-dim">Библиотека ромов пуста — загрузите ромы в «Запуске эмулятора», тогда их можно будет отметить здесь.</p>
              )}
            </div>
          </div>
        </Field>

        {/* ---------- ПУЛ СОХРАНЕНИЙ ---------- */}
        <Field label={`Пул сохранений для донатов (${pool.saves.length}) — 0 в донате = с начала игры`}>
          <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
            {pool.saves.length === 0 && <p className="text-[11px] text-dim">Пусто — отметь галочками ниже: уровни, боссов, именные. Частные тоже можно: уедут гостям с картой.</p>}
            {pool.saves.map((sid, i) => {
              const sv = saves.find((x) => x.id === sid);
              const rn = sv ? roms.find((x) => x.id === sv.romId)?.name ?? '' : '';
              return (
                <div key={`${sid}-${i}`} className="flex items-center gap-2 border-2 border-edge px-2 py-1">
                  <span className="font-pixel text-[10px] text-gold w-6">{i + 1}</span>
                  <span className="text-[11px] text-paper truncate flex-1">{sv?.name ?? sid} <span className="text-faint">({sv ? SAVE_KIND_LABEL[saveKindOf(sv)] : 'уровень'} · {rn})</span></span>
                  <button onClick={() => { commitPool({ ...pool, saves: pool.saves.filter((_, j) => j !== i) }); sfx.click(); }} className="text-dim hover:text-coral cursor-pointer" title="Убрать из пула">{Ic.trash(12)}</button>
                </div>
              );
            })}
          </div>
          {/* v0.112: БЫСТРЫЙ ВЫБОР ГАЛОЧКАМИ — сохранения сгруппированы по ромам */}
          <div className="mt-2 border-2 border-edge px-2 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="tick-label text-gold">☑ Быстрый выбор галочками</span>
              {pool.saves.length > 0 && (
                <button onClick={clearPoolSaves} className="tick-label text-faint hover:text-coral cursor-pointer" title="Убрать из пула сразу все сохранения">очистить пул</button>
              )}
            </div>
            <p className="text-[9.5px] text-faint mt-0.5 leading-snug">
              Галочка = сохранение в пуле; ром — отметить или снять все его сохранения. Золотая метка «СЕЙВ №N» —
              номер для команды донатера (0 = с начала игры).
            </p>
            <div className="mt-1 space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {roms.map((r) => {
                const list = saves.filter((s) => s.romId === r.id);
                if (!list.length) return null;
                const inCnt = list.filter((s) => poolSaveSet.has(s.id)).length;
                const allIn = inCnt === list.length;
                return (
                  <div key={`bs-${r.id}`}>
                    <label className="flex items-center gap-1.5 px-1 py-0.5 cursor-pointer hover:bg-[rgba(255,207,63,0.07)]" title={allIn ? `Снять ВСЕ сохранения «${r.name}» с пула` : `Добавить ВСЕ сохранения «${r.name}» в пул`}>
                      <input
                        type="checkbox"
                        className="accent-[var(--color-gold)] cursor-pointer shrink-0"
                        checked={allIn}
                        ref={(el) => { if (el) el.indeterminate = inCnt > 0 && !allIn; }}
                        onChange={() => togglePoolRomSaves(r.id)}
                      />
                      <span className="text-[11px] shrink-0">🎮</span>
                      <span className="font-display text-[10px] uppercase text-dim truncate">{r.name}</span>
                      <span className="tick-label text-faint ml-auto shrink-0">{inCnt}/{list.length}</span>
                    </label>
                    <div className="pl-5">{list.map((sv) => saveCheckRow(sv))}</div>
                  </div>
                );
              })}
              {saves.length === 0 && (
                <p className="text-[11px] text-dim">Сохранений нет — запустите ромы в эмуляторе и запишите состояния, тогда их можно будет отметить здесь.</p>
              )}
            </div>
          </div>
        </Field>

        {/* ---------- РУЧНАЯ ФОРМА (только в партии) ---------- */}
        {!editor && (
          <Field label="Применить вручную (тот же конвейер, что у донатов)">
            <div className="grid grid-cols-4 gap-2">
              <input className="field-in px-2 py-2 text-sm" placeholder="Ячейка" inputMode="numeric" value={fCell} onChange={(e) => setFCell(e.target.value.replace(/\D/g, ''))} />
              <input className="field-in px-2 py-2 text-sm" placeholder="Ром" inputMode="numeric" value={fRom} onChange={(e) => setFRom(e.target.value.replace(/\D/g, ''))} />
              <input className="field-in px-2 py-2 text-sm" placeholder="Сейв (0=нет)" inputMode="numeric" value={fSave} onChange={(e) => setFSave(e.target.value.replace(/\D/g, ''))} />
              <select className="field-in px-2 py-2 text-sm" value={fChaos} onChange={(e) => setFChaos(e.target.value)}>
                {DONATE_CHAOS.map((c) => <option key={c.num} value={String(c.num)}>{c.num} — {c.name}</option>)}
              </select>
            </div>
            <div className="mt-2">
              <PxBtn small color="magma" onClick={() => void applyManual()}>Применить</PxBtn>
            </div>
            {formErr && <p className="text-[11px] text-magma mt-1.5">✖ Донат отклонён: {formErr}</p>}
          </Field>
        )}

        {/* ---------- ШПАРГАЛКА ---------- */}
        <Field label="Шпаргалка для стрима — с фактическими номерами ячеек и пула">
          <div className="flex gap-2 flex-wrap">
            <PxBtn small onClick={genShp}>📋 Сгенерировать</PxBtn>
            {shp && <PxBtn small color="teal" onClick={() => void copyShp()}>{copied ? '✔ Скопировано' : 'Скопировать'}</PxBtn>}
            {shp && <PxBtn small onClick={dlShp}>{Ic.download(12)} Скачать .txt</PxBtn>}
          </div>
          {shp && (
            <textarea readOnly className="field-in w-full h-48 px-2 py-2 text-[10px] font-pixel mt-1.5 whitespace-pre" value={shp} />
          )}
        </Field>

        {editor ? (
          editorMap && (
            <p className="text-[10px] text-faint">
              Карта: «{editorMap.name}» · редактор заданий · номера донатеров = порядок в списках пула — не меняй порядок после публикации шпаргалки.
            </p>
          )
        ) : (
          sessionMap && (
            <p className="text-[10px] text-faint">
              Карта: «{sessionMap.name}» · комната {room?.code ?? '—'} · донат применяет только хост этой вкладки.
            </p>
          )
        )}
      </div>
    </Modal>
  );
}
