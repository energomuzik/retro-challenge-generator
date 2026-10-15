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
import { loadPool, savePool, setMinimalka, applyDonat, buildShpargalka, subscribeBogach, getBogachStatus, enableDoor, disableDoor, sideBtnsOn, setSideBtns, type BogachPool } from '../bogach';
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
  const [openRom, setOpenRom] = useState<string | null>(null); // v0.114: раскрытый ром в дереве

  const romFolders = useMemo(() => [...new Set(roms.map((r) => r.folder ?? '').filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru')), [roms]);
  const looseRoms = roms.filter((r) => !r.folder);

  const poolRomSet = useMemo(() => new Set(pool.roms), [pool.roms]);
  const poolSaveSet = useMemo(() => new Set(pool.saves), [pool.saves]);
  const commitPool = (p: BogachPool) => { setPool(p); savePool(p); };

  /* v0.112: галочки пула — ром/папка/сейв; v0.114: ОДНО ДЕРЕВО «папка → ром → сохранения»:
     галочка РОМА = ром + все его сохранения; галочка ПАПКИ = все ромы и все сохранения внутри */
  const togglePoolSave = (id: string) => {
    commitPool(poolSaveSet.has(id) ? { ...pool, saves: pool.saves.filter((x) => x !== id) } : { ...pool, saves: [...pool.saves, id] });
    sfx.click();
  };
  const toggleRomAll = (romId: string) => {
    const sids = saves.filter((s) => s.romId === romId).map((s) => s.id);
    const allIn = poolRomSet.has(romId) && (sids.length === 0 || sids.every((id) => poolSaveSet.has(id)));
    commitPool(allIn
      ? { roms: pool.roms.filter((x) => x !== romId), saves: pool.saves.filter((x) => !sids.includes(x)) }
      : { roms: [...new Set([...pool.roms, romId])], saves: [...new Set([...pool.saves, ...sids])] });
    sfx.click();
  };
  const toggleFolderAll = (f: string) => {
    const rids = roms.filter((r) => r.folder === f).map((r) => r.id);
    const sids = saves.filter((s) => rids.includes(s.romId)).map((s) => s.id);
    const allIn = rids.every((id) => poolRomSet.has(id)) && sids.every((id) => poolSaveSet.has(id));
    commitPool(allIn
      ? { roms: pool.roms.filter((x) => !rids.includes(x)), saves: pool.saves.filter((x) => !sids.includes(x)) }
      : { roms: [...new Set([...pool.roms, ...rids])], saves: [...new Set([...pool.saves, ...sids])] });
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

  /* v0.113: дверь донатов включается кнопкой — без вопроса браузера при создании комнаты */
  const turnOn = () => { enableDoor(room?.code ?? ''); sfx.click(); };
  const turnOff = () => { disableDoor(); sfx.click(); };

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

  /* v0.114: строка РОМА в дереве: галочка = ром + все его сохранения; ▸ раскрывает сейвы */
  const romTreeRow = (r: RomDef) => {
    const svs = saves.filter((s) => s.romId === r.id);
    const sids = svs.map((s) => s.id);
    const inCnt = sids.filter((id) => poolSaveSet.has(id)).length;
    const romIn = poolRomSet.has(r.id);
    const allIn = romIn && (sids.length === 0 || inCnt === sids.length);
    const no = pool.roms.indexOf(r.id) + 1;
    const open = openRom === r.id;
    return (
      <div key={`tr-${r.id}`}>
        <div className="flex items-center gap-1.5 px-1 py-0.5 hover:bg-[rgba(255,207,63,0.07)]">
          <input
            type="checkbox"
            className="accent-[var(--color-gold)] cursor-pointer shrink-0"
            checked={allIn}
            ref={(el) => { if (el) el.indeterminate = (romIn && inCnt < sids.length) || (!romIn && inCnt > 0); }}
            onChange={() => toggleRomAll(r.id)}
            title={allIn ? 'Снять ром и все его сохранения' : 'Добавить ром и ВСЕ его сохранения'}
          />
          <CartridgeBadge rom={r} h={14} />
          <span className="text-[11px] text-paper truncate flex-1">{r.name}</span>
          {romIn
            ? <span className="font-pixel text-[8px] text-gold shrink-0">РОМ №{no}</span>
            : <span className="tick-label text-faint shrink-0">{(r.ext ?? '').toUpperCase()}</span>}
          {svs.length > 0 && (
            <button
              onClick={() => { setOpenRom(open ? null : r.id); sfx.click(); }}
              className={`tick-label cursor-pointer shrink-0 px-1 hover:text-gold ${open ? 'text-gold' : 'text-faint'}`}
              title={open ? 'Скрыть сохранения рома' : 'Показать сохранения рома — отметить нужные'}
            >
              {open ? '▾' : '▸'} сейвы {inCnt}/{svs.length}
            </button>
          )}
        </div>
        {open && svs.length > 0 && (
          <div className="pl-6 ml-3 border-l-2 border-edge">{svs.map((sv) => saveCheckRow(sv))}</div>
        )}
      </div>
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
            <label className="flex items-start gap-1.5 mt-1.5 cursor-pointer select-none" title="Мини-кнопки 💰 у папок/ромов/сейвов в левой панели редактора — для тех, кто ведёт донаты; остальным они не нужны и по умолчанию скрыты">
              <input type="checkbox" className="accent-[var(--color-gold)] cursor-pointer mt-0.5" checked={sideBtnsOn()} onChange={(e) => { setSideBtns(e.target.checked); sfx.click(); }} />
              <span className="text-[10px] text-dim leading-snug">Показывать кнопки 💰 в списках слева редактора — галочка в один клик добавляет игру/сохранение в пул (обычному создателю карт они не нужны — поэтому по умолчанию спрятаны)</span>
            </label>
          </div>
        ) : !status.wanted ? (
          <div className="border-2 border-edge px-3 py-2.5 space-y-1.5">
            <div className="font-pixel text-[10px] text-dim">● ДОНАТЫ ВЫКЛЮЧЕНЫ</div>
            <p className="text-[10px] text-dim leading-snug">
              Игра не связывается с батником — поэтому при создании комнаты браузер больше ничего не спрашивает.
              Хочешь донаты от зрителей — нажми кнопку: браузер ОДИН раз спросит доступ к локальной сети
              (это безопасная связь только с твоим же компьютером — с батником, который слушает донаты) —
              разреши, и появится «СЛУШАТЕЛЬ НА СВЯЗИ».
            </p>
            <div>
              <PxBtn small color="teal" onClick={turnOn}>🔌 Включить донаты — подключить слушателя</PxBtn>
            </div>
          </div>
        ) : (
          <div className="border-2 border-edge px-3 py-2.5 space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap font-pixel text-[10px]">
              <span className={status.door === 'open' ? 'text-teal' : 'text-dim'}>● {doorLabel}</span>
              <span className={status.key ? 'text-teal' : 'text-magma'}>· ключ .env: {status.key ? 'найден' : 'НЕ найден — проверь .env рядом с батником'}</span>
              <button onClick={turnOff} className="ml-auto tick-label text-faint hover:text-coral cursor-pointer" title="Отвязать игру от батника до следующего включения">выключить донаты</button>
            </div>
            <div className="font-pixel text-[9px] text-dim">
              минималка слушателя: {status.min} ₽ · опрос DonatePay каждые {status.interval} с · команд принято: {status.processed}
            </div>
            <p className="text-[9.5px] text-faint leading-snug">
              ws://127.0.0.1:8765 в браузере открывать НЕ нужно и не получится — это не сайт, а внутренний адрес
              батника на твоём компьютере: вкладка игры подключается к нему сама. В окне батника можно написать код
              комнаты (например {room?.code ?? 'NNNN'}) и нажать Enter — донаты без слова «комната» уйдут в неё.
            </p>
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
              <li>В игре открой панель «💰 Донаты» и нажми «🔌 Включить донаты» — браузер один раз спросит доступ к локальной сети (связь с батником на твоём ПК) — разреши. В окне батника можно написать код комнаты — донаты без «комната» уйдут в неё.</li>
              <li>Держи окно открытым весь стрим (свернуть можно). В панели появится «СЛУШАТЕЛЬ НА СВЯЗИ» — пул и минималку можно было заполнить здесь заранее, галочками.</li>
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
            {pool.roms.length === 0 && <p className="text-[11px] text-dim">Пусто — отметь игры в дереве ниже.</p>}
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
          {/* v0.114: ОДНО ДЕРЕВО ВЫБОРА: папка → ром → сохранения (вместо двух раздельных списков) */}
          <div className="mt-2 border-2 border-edge px-2 py-2">
            <div className="flex items-center justify-between gap-2">
              <span className="tick-label text-gold">☑ Дерево выбора: папка → ром → сохранения</span>
              {(pool.roms.length > 0 || pool.saves.length > 0) && (
                <button onClick={() => { commitPool({ roms: [], saves: [] }); sfx.click(); }} className="tick-label text-faint hover:text-coral cursor-pointer" title="Очистить весь пул: ромы и сохранения">очистить всё</button>
              )}
            </div>
            <p className="text-[9.5px] text-faint mt-0.5 leading-snug">
              Галочка РОМА = игра и ВСЕ её сохранения сразу; нажми «▸ сейвы» — раскроется список,
              можно отметить только нужные. Галочка ПАПКИ = все ромы и все сохранения внутри.
              Золотые метки «РОМ №N»/«СЕЙВ №N» — номера для команды донатера.
            </p>
            <div className="mt-1 space-y-1.5 max-h-72 overflow-y-auto pr-1">
              {romFolders.map((f) => {
                const inF = roms.filter((r) => r.folder === f);
                const fids = inF.map((r) => r.id);
                const fSaves = saves.filter((s) => fids.includes(s.romId));
                const total = inF.length + fSaves.length;
                const got = inF.filter((r) => poolRomSet.has(r.id)).length + fSaves.filter((s) => poolSaveSet.has(s.id)).length;
                const allIn = total > 0 && got === total;
                return (
                  <div key={`bf-${f}`}>
                    <label className="flex items-center gap-1.5 px-1 py-0.5 cursor-pointer hover:bg-[rgba(255,207,63,0.07)]" title={allIn ? `Снять ВСЮ папку «${f}»` : `Добавить ВСЮ папку «${f}»: ромы и все сохранения`}>
                      <input
                        type="checkbox"
                        className="accent-[var(--color-gold)] cursor-pointer shrink-0"
                        checked={allIn}
                        ref={(el) => { if (el) el.indeterminate = got > 0 && !allIn; }}
                        onChange={() => toggleFolderAll(f)}
                      />
                      <span className="text-[11px] shrink-0">📁</span>
                      <span className="font-display text-[10px] uppercase text-dim truncate">{f}</span>
                      <span className="tick-label text-faint ml-auto shrink-0">{got}/{total}</span>
                    </label>
                    <div className="pl-5">{inF.map((r) => romTreeRow(r))}</div>
                  </div>
                );
              })}
              {looseRoms.length > 0 && (
                <div>
                  <div className="tick-label text-faint px-1 py-0.5">Без папки · {looseRoms.length}</div>
                  <div>{looseRoms.map((r) => romTreeRow(r))}</div>
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
            {pool.saves.length === 0 && <p className="text-[11px] text-dim">Пусто — отметь сохранения в дереве выше (▸ сейвы у рома). Частные тоже можно: уедут гостям с картой.</p>}
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
          <p className="text-[9.5px] text-faint mt-1">
            Сохранения набираются в дереве выше: у рома кнопка «▸ сейвы» — раскрой и отметь нужные
            (или галочка рома — возьмёт все сразу). Порядок номеров = порядок в этом списке.
          </p>
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
