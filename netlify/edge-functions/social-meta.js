// Підставляє в og:/twitter: мета-теги РЕАЛЬНЕ фото, ціну й адресу конкретного
// об'єкта/ексклюзиву, коли хтось ділиться прямим посиланням (?obj=<id> або ?excl=<id>).
// Соцмережі (Facebook, Instagram, TikTok, Telegram) не виконують JS сторінки —
// вони читають лише мета-теги з початкового HTML. Тому це має статись ДО того,
// як HTML піде до краулера, а не в браузері користувача.
//
// ВАЖЛИВО (урок з попередньої спроби): тут НЕ використовується жодних npm-пакетів
// (satori/resvg тощо) — тільки вбудований fetch(). Це навмисно: минулого разу
// Netlify не зміг зібрати edge-функцію саме через npm-залежності всередині неї,
// і білд мовчки падав, а сайт продовжував віддавати стару версію без жодного
// видимого попередження. Ця функція — лише текстова підміна в HTML, без збірки
// зображень, тож той самий клас поломки тут неможливий.

const SUPABASE_URL = 'https://yglebmbtdyjyqnmwwsku.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnbGVibWJ0ZHlqeXFubXd3c2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5Nzk5NDMsImV4cCI6MjA5OTU1NTk0M30.ncKIY9mFGsBUsvoBr0iJH5cYGZZBdvKKDfMA_3TC2Mg';

const CAT_LABEL = {
  flat: 'Квартира', house: 'Будинок', land: 'Земельна ділянка',
  newbuild: 'Новобудова', rental: 'Оренда', commerce: 'Комерційна нерухомість'
};

function photoUrl(path, bucket) {
  path = (path || '').trim();
  if (!path) return '';
  if (path.indexOf('http') === 0) return path;
  return SUPABASE_URL + '/storage/v1/object/public/' + (bucket || 'object-photos') + '/' +
    path.split('/').map(encodeURIComponent).join('/');
}

function currencySymbol(obj) {
  const c = ((obj && obj.currency) || '').toString().trim().toUpperCase();
  if (c === 'EUR' || c === '€') return '€';
  if (c === 'UAH' || c === 'ГРН' || c === '₴') return '₴';
  return '$';
}

function escapeHtml(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;')
    .replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function replaceMeta(html, selectorRegex, value) {
  return html.replace(selectorRegex, (full) => full.replace(/content="[^"]*"/, `content="${escapeHtml(value)}"`));
}

export default async (request, context) => {
  const url = new URL(request.url);
  const objId = url.searchParams.get('obj');
  const exclId = url.searchParams.get('excl');

  // Немає прямого посилання на об'єкт — лишаємо сторінку такою, як є
  // (стандартні og-теги з index.html, нічого не чіпаємо).
  if (!objId && !exclId) return context.next();

  const response = await context.next();

  let obj = null;
  try {
    if (objId) {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/public_site_objects?select=*&id=eq.${encodeURIComponent(objId)}`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      const data = await res.json();
      if (Array.isArray(data) && data.length) obj = data[0];
    } else if (exclId) {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/manual_listings?select=*&id=eq.${encodeURIComponent(exclId)}&listing_type=eq.exclusive&active=eq.true`,
        { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
      );
      const data = await res.json();
      if (Array.isArray(data) && data.length) obj = data[0];
    }
  } catch (e) {
    // Supabase недоступний чи ще щось пішло не так — просто повертаємо
    // сторінку без змін, зі стандартною обкладинкою. Головне — сайт не падає.
    return response;
  }

  if (!obj) return response;

  try {
    let html = await response.text();

    const photos = (obj.photos || '').split(',').map(p => photoUrl(p, 'object-photos')).filter(Boolean);
    const image = photos[0] || (url.origin + '/og-cover.jpg');
    const isExclusive = !!exclId;
    const cat = isExclusive ? 'Ексклюзив' : (CAT_LABEL[(obj.obj_cat || '').split(',')[0]] || "Об'єкт");
    const price = obj.price
      ? Number(obj.price).toLocaleString('uk-UA') + currencySymbol(obj)
      : 'Ціна за запитом';
    const roomsPart = obj.rooms ? `${obj.rooms}-кімнатна ` : '';
    const district = obj.district || 'Чернівці';
    const title = `${roomsPart}${cat} — ${price} · ${district} | GHERMAN`;
    // manual_listings (exclusives) has no street/obj_cat columns — use its own
    // description text instead; public_site_objects (обj) still uses street.
    const descSource = isExclusive
      ? (obj.description || '').replace(/\s+/g, ' ').trim().slice(0, 140)
      : (obj.street ? 'вул. ' + obj.street + '.' : '');
    const desc = `${descSource ? descSource + ' ' : ''}Фото, ціна та деталі об'єкта — на сайті агенції GHERMAN.`;
    const pageUrl = url.href;

    html = html.replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`);
    html = replaceMeta(html, /<meta property="og:title" content="[^"]*">/, title);
    html = replaceMeta(html, /<meta property="og:description" content="[^"]*">/, desc);
    html = replaceMeta(html, /<meta property="og:image" content="[^"]*">/, image);
    html = replaceMeta(html, /<meta property="og:url" content="[^"]*">/, pageUrl);
    html = replaceMeta(html, /<meta name="twitter:title" content="[^"]*">/, title);
    html = replaceMeta(html, /<meta name="twitter:description" content="[^"]*">/, desc);
    html = replaceMeta(html, /<meta name="twitter:image" content="[^"]*">/, image);

    const headers = new Headers(response.headers);
    headers.delete('content-length');
    return new Response(html, { status: response.status, headers });
  } catch (e) {
    return response;
  }
};

export const config = { path: '/' };
