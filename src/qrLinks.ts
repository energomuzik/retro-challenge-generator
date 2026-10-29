/* v0.149: QR-КОДЫ НА ГЛАВНОМ ЭКРАНЕ (заказчик: «на главном экране пора поставить кваркоды
   по бокам панелей — по две с каждой стороны от панелей кнопок. Под каждым кваркодом слово
   „ссылка“, нажатие на которое переводит туда же, куда и кваркод»):
   СЛЕВА от панелей — каналы: YouTube (@ENERGOMUZHIK) и VK Video Live (energomuzhik);
   СПРАВА — донаты: CloudTips и DonatePay.
   PNG-коды лежат в assets/qr/ (чёрное на белой плашке — сканируется с любого экрана);
   клик по картинке или по слову «Ссылка» открывает адрес в новой вкладке. */
const QR = import.meta.glob('./assets/qr/*.png', { eager: true, import: 'default', query: '?url' }) as Record<string, string>;

export interface QrLink {
  key: string;
  /** маленькая подпись НАД кодом (что это) */
  label: string;
  url: string;
  img: string;
}

const byName = (n: string): string => QR[`./assets/qr/${n}`] ?? '';

/** СЛЕВА от панелей кнопок: YouTube, VK Video Live. */
export const QR_LINKS_LEFT: QrLink[] = [
  { key: 'youtube', label: 'YOUTUBE', url: 'https://www.youtube.com/@ENERGOMUZHIK', img: byName('qr-youtube.png') },
  { key: 'vk', label: 'VK ВИДЕО', url: 'https://live.vkvideo.ru/energomuzhik', img: byName('qr-vk.png') },
];

/** СПРАВА от панелей кнопок: донаты CloudTips, DonatePay. */
export const QR_LINKS_RIGHT: QrLink[] = [
  { key: 'cloudtips', label: 'CLOUDTIPS', url: 'https://pay.cloudtips.ru/p/614db848', img: byName('qr-cloudtips.png') },
  { key: 'donatepay', label: 'DONATEPAY', url: 'https://donatepay.ru/don/ENERGOMUZHIK', img: byName('qr-donatepay.png') },
];
