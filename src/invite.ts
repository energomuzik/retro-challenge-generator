/* ССЫЛКА-ПРИГЛАШЕНИЕ (v0.82.0): одна ссылка вместо пары «код комнаты + адрес хаба».
   Формат: <адрес сайта>#room=КОД  или  #room=КОД&hub=<urlencode адрес туннеля>.
   Хэш выбран сознательно: сайт — статика на GitHub Pages, хэш не уходит на сервер,
   переживает любые редиректы и никогда не ломает загрузку страницы. Хост копирует
   ссылку одной кнопкой в лобби; гость открывает её — игра сама подставляет адрес
   игрового хаба (если он в ссылке) и стучится в комнату. */

export interface Invite {
  code: string; // код комнаты, 4 символа
  hub: string; // адрес игрового хаба ('' = играть через облако PeerJS)
}

const CODE_RE = /^[A-Z0-9]{4}$/;

/** Собирает полную ссылку-приглашение. hub — адрес игрового хаба
 *  (например https://слово-слово-1234.trycloudflare.com) или пусто. */
export function buildInviteUrl(code: string, hub?: string): string {
  const base = `${location.origin}${location.pathname}`;
  const h = (hub ?? '').trim();
  const c = encodeURIComponent(code.trim().toUpperCase());
  return h ? `${base}#room=${c}&hub=${encodeURIComponent(h)}` : `${base}#room=${c}`;
}

/** Читает приглашение из адресной строки: #room=…&hub=… или ?room=…&hub=…. */
export function readInviteFromUrl(): Invite | null {
  const grab = (s: string): Invite | null => {
    let p: URLSearchParams;
    try {
      p = new URLSearchParams(s);
    } catch {
      return null;
    }
    const code = (p.get('room') ?? '').trim().toUpperCase();
    if (!CODE_RE.test(code)) return null;
    return { code, hub: (p.get('hub') ?? '').trim() };
  };
  if (location.hash.length > 1) {
    const v = grab(location.hash.replace(/^#/, ''));
    if (v) return v;
  }
  if (location.search.length > 1) return grab(location.search.replace(/^\?/, ''));
  return null;
}

/** Приглашение из произвольного текста: игрок мог вставить в поле кода ВСЮ ссылку —
 *  вытаскиваем из неё код и адрес хаба. Обычный «ABCD» возвращается как есть. */
export function parseInviteText(s: string): Invite | null {
  const t = s.trim();
  if (!t) return null;
  const isLink = /https?:\/\//i.test(t) || /room=/i.test(t);
  if (!isLink) {
    const code = t.toUpperCase().replace(/[^A-Z0-9]/g, '');
    return CODE_RE.test(code) ? { code, hub: '' } : null;
  }
  const cm = t.match(/[#?&]room=([^&\s]+)/i) ?? t.match(/room=([^&\s]+)/i);
  if (!cm) return null;
  const code = decodeURIComponent(cm[1]).trim().toUpperCase();
  const hm = t.match(/[#?&]hub=([^&\s]+)/i) ?? t.match(/hub=([^&\s]+)/i);
  const hub = hm ? decodeURIComponent(hm[1]).trim() : '';
  return CODE_RE.test(code) ? { code, hub } : null;
}

/** Убирает приглашение из адресной строки, чтобы F5 не стучался в комнату заново. */
export function clearInviteUrl(): void {
  try {
    history.replaceState(null, '', location.pathname + location.search);
  } catch {
    /* noop */
  }
}
