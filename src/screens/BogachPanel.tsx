/* v0.109 БОГАЧ — панель донатов хоста: статус слушателя, минималка,
   пул ромов/сейвов, ручная форма и шпаргалка для стрима. */
import { useEffect, useMemo, useState } from 'react';
import { useApp } from '../store';
import { Modal, Field, PxBtn, Ic } from '../ui';
import { sfx } from '../sound';
import { DONATE_CHAOS } from '../types';
import { SAVE_KIND_LABEL, saveKindOf } from '../types';
import { loadPool, savePool, setMinimalka, applyDonat, buildShpargalka, subscribeBogach, getBogachStatus, type BogachPool } from '../bogach';

export function BogachPanel({ onClose }: { onClose: () => void }) {
  const { roms, saves, sessionMap, room } = useApp();
  const [, force] = useState(0);
  useEffect(() => subscribeBogach(() => force((n) => n + 1)), []);
  const status = getBogachStatus();
  const [pool, setPool] = useState<BogachPool>(() => loadPool());
  const [min, setMin] = useState<string>(() => String(getBogachStatus().min));
  const [romAdd, setRomAdd] = useState('');
  const [saveAdd, setSaveAdd] = useState('');
  const [fCell, setFCell] = useState('');
  const [fRom, setFRom] = useState('');
  const [fSave, setFSave] = useState('');
  const [fChaos, setFChaos] = useState('0');
  const [formErr, setFormErr] = useState('');
  const [shp, setShp] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const romFolders = useMemo(() => [...new Set(roms.map((r) => r.folder ?? '').filter(Boolean))].sort((a, b) => a.localeCompare(b, 'ru')), [roms]);
  const looseRoms = roms.filter((r) => !r.folder);

  const commitPool = (p: BogachPool) => { setPool(p); savePool(p); };

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
    const txt = buildShpargalka();
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
      a.download = `shpargalka-bogach-${room?.code ?? 'party'}.txt`;
      a.click();
      URL.revokeObjectURL(a.href);
      sfx.click();
    } catch { /* noop */ }
  };

  const doorLabel = status.door === 'open' ? 'СЛУШАТЕЛЬ НА СВЯЗИ' : status.door === 'connecting' ? 'СЛУШАТЕЛЬ НЕ ЗАПУЩЕН (жду…)' : 'ДВЕРЬ ЗАКРЫТА';

  return (
    <Modal title="Богач · донаты" icon={Ic.cart(16)} onClose={onClose} w="max-w-3xl">
      <div className="space-y-4">
        {/* ---------- СТАТУС ---------- */}
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
            {pool.roms.length === 0 && <p className="text-[11px] text-dim">Пусто — добавь игры, которые донатеры смогут ставить на ячейки.</p>}
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
          <select className="field-in w-full px-2 py-2 text-sm mt-1.5" value={romAdd} onChange={(e) => { const id = e.target.value; if (id) { commitPool({ ...pool, roms: [...pool.roms, id] }); setRomAdd(''); sfx.click(); } }}>
            <option value="">＋ добавить ром из библиотеки…</option>
            {romFolders.map((f) => (
              <optgroup key={f} label={`📁 ${f}`}>
                {roms.filter((r) => r.folder === f).map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </optgroup>
            ))}
            {looseRoms.length > 0 && (
              <optgroup label="Без папки">{looseRoms.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</optgroup>
            )}
          </select>
        </Field>

        {/* ---------- ПУЛ СОХРАНЕНИЙ ---------- */}
        <Field label={`Пул сохранений для донатов (${pool.saves.length}) — 0 в донате = с начала игры`}>
          <div className="space-y-1 max-h-32 overflow-y-auto pr-1">
            {pool.saves.length === 0 && <p className="text-[11px] text-dim">Пусто — добавь уровни/боссов/именные сохранения (частные тоже можно: они уедут гостям).</p>}
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
          <select className="field-in w-full px-2 py-2 text-sm mt-1.5" value={saveAdd} onChange={(e) => { const id = e.target.value; if (id) { commitPool({ ...pool, saves: [...pool.saves, id] }); setSaveAdd(''); sfx.click(); } }}>
            <option value="">＋ добавить сохранение из библиотеки…</option>
            {roms.map((r) => {
              const list = saves.filter((x) => x.romId === r.id);
              if (!list.length) return null;
              return (
                <optgroup key={r.id} label={`🎮 ${r.name}`}>
                  {list.map((sv) => <option key={sv.id} value={sv.id}>{sv.name} ({SAVE_KIND_LABEL[saveKindOf(sv)]})</option>)}
                </optgroup>
              );
            })}
          </select>
        </Field>

        {/* ---------- РУЧНАЯ ФОРМА ---------- */}
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

        {sessionMap && (
          <p className="text-[10px] text-faint">
            Карта: «{sessionMap.name}» · комната {room?.code ?? '—'} · донат применяет только хост этой вкладки.
          </p>
        )}
      </div>
    </Modal>
  );
}
