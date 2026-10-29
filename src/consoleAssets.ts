import consoleImgDendy from './assets/consoles/dendy-classic.png';
import consoleImgFamicom from './assets/consoles/famicom.png';
import consoleImgNes from './assets/consoles/nes.png';
import type { CartRegion } from './types';

/* ---------- v0.144 FRENDY: ПРИСТАВКИ ВМЕСТО ЯЧЕЕК ----------
   Фото-ассеты настоящих приставок (материал заказчика, Яндекс.Диск):
   • Dendy Classic (Steeler) — легендарная белая приставка;
   • Famicom — японская красно-белая;
   • NES — серая «коробка».
   Каждая ячейка-задание в режиме FRENDY — теперь ПРИСТАВКА: рисуется одной из
   этих картинок (выбор детерминирован индексом ячейки — одна и та же приставка
   всегда выглядит одинаково, и у клиентов, и у хоста). Ассеты живут отдельным
   модулем, чтобы движок (engine.ts) не тянул картинки в node-контексты. */

export const FRENDY_CONSOLE_IMGS: string[] = [consoleImgDendy, consoleImgFamicom, consoleImgNes];

/** Картинка приставки для ячейки с индексом idx — детерминированно по индексу. */
export const frendyConsoleImg = (idx: number): string =>
  FRENDY_CONSOLE_IMGS[((idx % FRENDY_CONSOLE_IMGS.length) + FRENDY_CONSOLE_IMGS.length) % FRENDY_CONSOLE_IMGS.length];

/* v0.145: ФОТО ПРИСТАВКИ ПО РЕГИОНУ КАРТРИДЖА (заказчик: «картинка приставки должна
   меняться смотря какой ром был применен»): Dendy-ром → Dendy Classic, Famicom-ром →
   Famicom, NES-ром → NES. null/не-NES ром (универсальные картриджи и старые карты) —
   вызывающий код откатывается к детерминированной картинке по индексу ячейки. */
const REGION_IMG: Record<CartRegion, string> = {
  dendy: consoleImgDendy,
  famicom: consoleImgFamicom,
  nes: consoleImgNes,
};
export const frendyConsoleImgOfRegion = (region: CartRegion | null | undefined): string | null =>
  region ? REGION_IMG[region] ?? null : null;
