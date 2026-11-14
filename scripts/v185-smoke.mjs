// v0.184 смоук: переключатели джоемыши в Опциях, «Импортировать все» в ряду быстрых
// кнопок (ром в IDB + база замокана), обучение QUIZowo без Quiz.com, версия 0.184.0.
// Перед запуском: npm run build && npx vite preview --port 4173
import { chromium } from 'playwright';

const BASE = 'http://localhost:4173';
let fails = 0;
const ok = (cond, label) => { console.log(`${cond ? '✅' : '❌'} ${label}`); if (!cond) fails++; };

/* --- мок облачной базы сохранений: дерево git + карточки для рома CONTRA.nes --- */
const TREE = { sha: 'deadbeef', tree: [
  { path: 'saves/CONTRA.nes/Уровень 1/card.json' },
  { path: 'saves/CONTRA.nes/Уровень 1/save.state' },
  { path: 'saves/CONTRA.nes/Босс/card.json' },
] };
const cardOf = (p) => ({
  name: decodeURIComponent(p).split('/')[2], kind: 'level', createdAt: 1730000000000,
  game: 'CONTRA', file: 'CONTRA.nes',
  statePath: p.replace('card.json', 'save.state'), files: {},
});

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));

/* ром появляется в IDB до старта приложения */
await page.addInitScript(() => new Promise((done) => {
  const rq = indexedDB.open('retropolia-db', 7);
  rq.onupgradeneeded = () => {
    const db = rq.result;
    for (const s of ['tiles', 'maps', 'roms', 'saves', 'blobs', 'sessions', 'tokens', 'anims',
      'animTiles', 'animGroups', 'sounds', 'bossAnims', 'challenges', 'npcAnims']) {
      if (!db.objectStoreNames.contains(s)) db.createObjectStore(s);
    }
  };
  rq.onsuccess = () => {
    const db = rq.result;
    const rom = { id: 'test-contrа', name: 'CONTRA', fileName: 'CONTRA.nes', ext: 'nes', size: 123456, createdAt: 1730000000000 };
    const tx = db.transaction('roms', 'readwrite');
    tx.objectStore('roms').put(rom, 'test-contra');
    tx.oncomplete = () => done();
  };
  rq.onerror = () => done();
}));

await page.route('**/api.github.com/repos/**', (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(TREE) }));
await page.route('**/raw.githubusercontent.com/**', (r) => {
  const u = decodeURIComponent(r.request().url());
  if (u.includes('card.json')) return r.fulfill({ contentType: 'application/json', body: JSON.stringify(cardOf(u.split('/').slice(4).join('/'))) });
  return r.fulfill({ contentType: 'application/json', body: '{}' });
});

/* --- 1. заставка --- */
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(3000);
let body = await page.evaluate(() => document.body.innerText);
ok(body.includes('0.185'), 'заставка показывает 0.185');
ok(!body.toUpperCase().includes('QUIZ.COM') && !body.toUpperCase().includes('КВИЗ ТОЧКА КОМ'), 'на заставке нет Quiz.com');

/* --- 2. Опции → блок «МЫШЬ С ДЖОЙСТИКА»: переключатели вместо галочек --- */
await page.getByText('Опции', { exact: true }).first().click();
await page.waitForTimeout(1500);
body = await page.evaluate(() => document.body.innerText);
ok(body.includes('МЫШЬ С ДЖОЙСТИКА'), 'блок «Мышь с джойстика» на Опциях');
/* innerText отдаёт ВЕРХНИЙ РЕГИСТР (text-transform uppercase) — сравниваем в верхнем регистре */
const upper = body.toUpperCase();
const labels = ['Мышь с джойстика включена', 'Включать мышь при обнаружении джоя', 'Автоматика задания: при игре выкл, после — вкл'];
for (const l of labels) ok(upper.includes(l.toUpperCase()), `переключатель «${l}» на месте`);
/* общий контейнер трёх переключателей (ищем кнопку «Включать мышь…», поднимаемся до узла,
   который содержит и «Автоматику задания») — внутри ТОЛЬКО он проверяется на чекбоксы */
const padContainerClean = await page.evaluate(() => {
  const btns = [...document.querySelectorAll('button')].filter((b) => /Включать мышь при обнаружении/i.test(b.textContent || ''));
  for (const b of btns) {
    let p = b.parentElement;
    for (let i = 0; i < 10 && p; i++) {
      if (/Автоматика задания/i.test(p.textContent || '') && /Мышь с джойстика включена/i.test(p.textContent || '')) {
        return !p.querySelector('input[type="checkbox"]');
      }
      p = p.parentElement;
    }
  }
  return null; // не нашли контейнер
});
ok(padContainerClean !== false, 'в контейнере трёх переключателей чекбоксов нет');
/* клики по переключателям: главный off → два других задизейблены */
const mainToggle = page.locator('button', { hasText: 'Мышь с джойстика включена' }).first();
await mainToggle.click();
await page.waitForTimeout(400);
const disabledCount = await page.evaluate(() =>
  [...document.querySelectorAll('button[disabled]')].filter((b) => /Включать мышь при обнаружении|Автоматика задания/.test(b.textContent || '')).length);
ok(disabledCount === 2, 'главный снят → два подчинённых недоступны');
await mainToggle.click(); // вернуть как было
await page.waitForTimeout(300);
await page.screenshot({ path: '/tmp/v184-options.png' });

/* --- 3. Запуск эмулятора → «Импортировать все» в ряду быстрых кнопок (свежая загрузка вместо Escape) --- */
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
await page.getByText('Запуск эмулятора', { exact: true }).first().click();
await page.waitForTimeout(1500);
await page.getByText('CONTRA', { exact: true }).first().click();
await page.waitForTimeout(2500);
body = await page.evaluate(() => document.body.innerText);
ok(body.toUpperCase().includes('СОХРАНЕНИЯ «CONTRA»'), 'панель «Сохранения» открыта');
const bigBtn = page.locator('button.btn-sky', { hasText: 'Импортировать все' });
ok(await bigBtn.count() === 1, 'большая кнопка «⬇ Импортировать все (2)» в ряду быстрых кнопок');
const headAll = await page.evaluate(() => {
  const els = [...document.querySelectorAll('button, span')].filter((e) => /⬇ Импортировать все/i.test(e.textContent || ''));
  return els.length;
});
ok(headAll === 1, 'в заголовке блока базы дублирующей кнопки нет');
await bigBtn.click(); // проверяем проводку ref → grabAll (мок: карточки без state → «не получилось»)
/* тост живёт ~3 с — поллим */
let toastHit = false; let savesGrew = false;
for (let i = 0; i < 30; i++) {
  const t = (await page.evaluate(() => document.body.innerText)).toUpperCase();
  if (/ИМПОРТИРОВАНО: \d+ ИЗ \d+|НЕ ПОЛУЧИЛОСЬ ИМПОРТИРОВАТЬ/.test(t)) { toastHit = true; }
  if (/СОХРАНЕНИЯ «CONTRA» · [1-9]/.test(t)) { savesGrew = true; }
  if (toastHit) break;
  await page.waitForTimeout(300);
}
ok(toastHit || savesGrew, `клик запустил массовый импорт (тост: ${toastHit}, записи в библиотеке: ${savesGrew})`);
await page.screenshot({ path: '/tmp/v184-launcher.png' });

/* --- 4. Обучение → QUIZowo без Quiz.com (свежая загрузка) --- */
await page.goto(BASE, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(2500);
const edu = page.getByText('ПОМОЩЬ - ОБУЧЕНИЕ', { exact: true }).first();
if (await edu.count()) {
  await edu.click();
  await page.waitForTimeout(1500);
  const qItem = page.locator('text=QUIZowo').last();
  if (await qItem.count()) { await qItem.click(); await page.waitForTimeout(2000); }
  const t = (await page.evaluate(() => document.body.innerText)).toUpperCase();
  ok(!t.includes('QUIZ.COM') && !t.includes('КВИЗ ТОЧКА КОМ'), 'обучение QUIZowo без Quiz.com и «Квиз точка ком»');
  await page.screenshot({ path: '/tmp/v184-training.png' });
} else ok(false, 'кнопка «Обучение» найдена в меню');

ok(errors.length === 0, `на странице нет JS-ошибок${errors.length ? ': ' + errors[0] : ''}`);
await browser.close();
console.log(fails ? `SMOKE FAILED: ${fails}` : 'SMOKE OK');
process.exit(fails ? 1 : 0);
