#!/usr/bin/env node
/* v0.183 пересъёмка кадров обучения play-10 (ZIP для базы) и play-11 (импорт из базы):
   «Забрать» → «⬇ Импорт», новая кнопка «⬇ Импортировать все», свежие тосты.
   Мок: GitHub Trees API + raw.githubusercontent.com (база с 3 сохранениями CONTRA),
   IDB засеяна ромом CONTRA и 4 локальными сохранениями. Playwright, 1280×720.
   Запуск: node scripts/v183-reshoot.mjs (превью :4173 должно работать) */
import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';

const OUT = '/tmp/shots';
fs.mkdirSync(OUT, { recursive: true });

const GAME = 'Contra (U) [!].nes';
const ROM_ID = 'rom-contra';

/* ---------- мок базы: 3 облачных сохранения ---------- */
const d = (day, h, m) => new Date(2025, 10, day, h, m).getTime();
const CLOUD = [
  { folder: 'УРОВЕНЬ 1',        card: { name: 'УРОВЕНЬ 1',        kind: 'level', slot: 1, createdAt: d(7, 13, 47) } },
  { folder: 'УРОВЕНЬ 4 — БАШНЯ', card: { name: 'УРОВЕНЬ 4 — БАШНЯ', kind: 'level', slot: 2, createdAt: d(8, 13, 47) } },
  { folder: 'БОСС 2 — ДРАКОН',   card: { name: 'БОСС 2 — ДРАКОН',   kind: 'boss',  slot: 3, createdAt: d(9, 13, 47) } },
];
const TREE = {
  tree: CLOUD.map((c) => ({ path: `saves/${GAME}/${c.folder}/card.json`, type: 'blob' })),
  truncated: false,
};
const STATE_BIN = new Uint8Array(640).map((_, i) => (i * 37 + 11) & 0xff);

/* ---------- сид IDB: ром + 4 локальных сохранения ---------- */
const mkB64 = (n) => {
  const bytes = new Uint8Array(Math.floor((n / 4) * 3));
  for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 13 + 7) & 0xff;
  let s = Buffer.from(bytes).toString('base64');
  return s.length >= n ? s.slice(0, n) : s + 'A'.repeat(n - s.length);
};
const B64_SRC = `
  const b64 = (n) => {
    const bytes = new Uint8Array(Math.floor((n / 4) * 3));
    for (let i = 0; i < bytes.length; i++) bytes[i] = (i * 13 + 7) & 0xff;
    let s = btoa(String.fromCharCode.apply(null, bytes));
    return s.length >= n ? s.slice(0, n) : s + 'A'.repeat(n - s.length);
  };`;
const SEED = `
(async () => {
  const stores = ['tiles','maps','roms','saves','blobs','sessions','tokens','anims','animTiles','animGroups','sounds','bossAnims','challenges','npcAnims'];
  const open = indexedDB.open('retropolia-db', 7);
  open.onupgradeneeded = (e) => {
    const db = e.target.result;
    for (const s of stores) if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
  };
  const db = await new Promise((res, rej) => { open.onsuccess = () => res(open.result); open.onerror = () => rej(open.error); });
${B64_SRC}
  const ROM = { id: ${JSON.stringify(ROM_ID)}, name: 'CONTRA', fileName: ${JSON.stringify(GAME)}, ext: '.nes', size: 262160, createdAt: ${d(1, 10, 0)} };
  const mk = (id, slot, name, kind, at, n) => ({ id, romId: ${JSON.stringify(ROM_ID)}, slot, name, kind, state: b64(n), stateSize: n, createdAt: at });
  const SAVES = [
    mk('save-seed-1', 1, 'УРОВЕНЬ 1', 'level', ${d(7, 13, 46)}, 3072),
    mk('save-seed-2', 2, 'УРОВЕНЬ 4 — БАШНЯ', 'level', ${d(8, 13, 46)}, 3072),
    mk('save-seed-3', 3, 'БОСС 2 — ДРАКОН', 'boss', ${d(9, 9, 46)}, 3072),
    mk('save-seed-4', 4, 'МОЁ ЗАДАНИЕ', 'mytask', ${d(9, 12, 46)}, 2048),
  ];
  const buf = new ArrayBuffer(262160);
  const u8 = new Uint8Array(buf);
  u8[0] = 0x4e; u8[1] = 0x45; u8[2] = 0x53; u8[3] = 0x1a;
  await new Promise((res, rej) => {
    const tx = db.transaction(['roms','saves','blobs'], 'readwrite');
    tx.objectStore('roms').put(ROM, ${JSON.stringify(ROM_ID)});
    tx.objectStore('blobs').put(buf, 'rom-' + ${JSON.stringify(ROM_ID)});
    for (const s of SAVES) tx.objectStore('saves').put(s, s.id);
    tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
  });
  db.close();
})();
`.replace(/const mkB64 = \(n\) => \{[\s\S]*?\n\};\n/, '');

const run = async () => {
  const browser = await chromium.launch({ headless: true });
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, acceptDownloads: false, deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => console.log('[pageerror]', String(e).slice(0, 200)));
  page.on('download', () => { /* в headless-shell download API недоступен — тост и так покажется */ });

  await page.route('**/api.github.com/**', (route) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(TREE) }));
  await page.route('**/raw.githubusercontent.com/**', async (route) => {
    const url = decodeURIComponent(route.request().url());
    const m = /saves\/(.+)\/([^/]+)\/card\.json$/.exec(url);
    if (m) {
      const c = CLOUD.find((x) => x.folder === m[2]);
      if (!c) return route.fulfill({ status: 404, body: 'no card' });
      const card = { format: 2, game: GAME, name: c.card.name, kind: c.card.kind, slot: c.card.slot, createdAt: c.card.createdAt, exportedAt: c.card.createdAt, app: '0.183.0', file: 'save.state' };
      return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(card) });
    }
    return route.fulfill({ status: 200, contentType: 'application/octet-stream', body: Buffer.from(STATE_BIN) });
  });
  await page.addInitScript(SEED);

  await page.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded' });
  // мини-плеер не должен попадать в кадры обучения — прячем CSS-ом (только в этом браузере)
  await page.addStyleTag({ content: '.fixed.bottom-3.left-1\\/2.z-40{display:none!important}' });
  await page.getByText('Запуск эмулятора', { exact: true }).click();
  await page.getByText('CONTRA', { exact: true }).first().click();
  await page.getByText(/Сохранения «CONTRA» · \d/).first().waitFor({ timeout: 20000 });
  await page.getByText('В базе сохранений для «CONTRA»').first().waitFor({ timeout: 20000 });
  await page.getByText('⬇ Импорт', { exact: true }).first().waitFor({ timeout: 20000 });
  await page.waitForFunction(() => document.querySelectorAll('button').length > 0);
  console.log('панель сохранений открыта, блок базы готов');

  const scrollToHeader = async (y) => {
    await page.evaluate((yy) => {
      const els = [...document.querySelectorAll('div,span,h1,h2,h3')];
      const t = els
        .filter((e) => /^Сохранения «CONTRA» · \d+/.test((e.textContent || '').trim()))
        .sort((a, b) => a.textContent.length - b.textContent.length)[0];
      if (!t) return false;
      let p = t.parentElement;
      while (p && p.scrollHeight <= p.clientHeight + 2) p = p.parentElement;
      if (!p) return false;
      p.scrollTop += t.getBoundingClientRect().top - yy;
      return true;
    }, y);
    await page.waitForTimeout(350);
  };

  const shot = async (name) => {
    await page.screenshot({ path: path.join(OUT, name + '.png') });
    console.log('кадр', name);
  };

  // ---------- слайд play-10: ZIP для базы ----------
  await scrollToHeader(44);
  await shot('play-10-00');

  await scrollToHeader(97);
  await page.getByRole('button', { name: /Сохранить все для базы/ }).click();
  await page.getByText(/ZIP готов/).first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(400);
  await shot('play-10-01');

  await page.getByText(/ZIP готов/).first().waitFor({ state: 'hidden', timeout: 10000 }).catch(() => {});
  await page.waitForTimeout(300);
  await scrollToHeader(44);
  await shot('play-10-02');

  // ---------- слайд play-11: импорт из базы ----------
  await scrollToHeader(44);
  await page.waitForTimeout(150);
  await shot('play-11-00');
  await page.waitForTimeout(150);
  await shot('play-11-01');

  await scrollToHeader(97);
  await page.getByText('⬇ Импорт', { exact: true }).first().click();
  await page.getByText(/импортировано в библиотеку|Не получилось импортировать/).first().waitFor({ timeout: 15000 });
  const toastTxt = await page.locator('text=/импортировано|Не получилось/').first().textContent();
  console.log('тост:', toastTxt);
  await page.getByText(/Сохранения «CONTRA» · 5/).first().waitFor({ timeout: 15000 });
  await page.waitForTimeout(400);
  await shot('play-11-02');

  await browser.close();
  const files = fs.readdirSync(OUT).filter((f) => f.startsWith('play-1'));
  console.log('готово:', files.join(', '));
};

run().catch((e) => { console.error(e); process.exit(1); });
