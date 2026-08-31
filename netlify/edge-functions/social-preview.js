// ==== GHERMAN: свій превʼю-запис для кожного об'єкта в соцмережах ====
// Спрацьовує ТІЛЬКИ коли заходить бот соцмережі (Facebook/Telegram/TikTok/WhatsApp/тощо)
// і в посиланні є ?obj=... або ?excl=... — тоді видає HTML з фото саме цього об'єкта.
// Для звичайних людей — сайт працює як завжди, цей файл їх не чіпає.

const SUPABASE_URL = 'https://yglebmbtdyjyqnmwwsku.supabase.co';
const SUPABASE_ANON_KEY = 'sb_publishable_EDstSGvVivigE6YXkY39WA_vmrK4UoF';

const BOT_UA = /facebookexternalhit|Facebot|Twitterbot|TelegramBot|Slackbot|WhatsApp|LinkedInBot|Pinterest|Discordbot|vkShare|Viber|SkypeUriPreview|TikTokBot|Bytespider|Instagram/i;

function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}

function photoUrl(path) {
  if (!path) return '';
  return SUPABASE_URL + '/storage/v1/object/public/object-photos/' + path.split('/').map(encodeURIComponent).join('/');
}

export default async (request, context) => {
  const url = new URL(request.url);
  const ua = request.headers.get('user-agent') || '';

  const objId = url.searchParams.get('obj');
  const exclId = url.searchParams.get('excl');
  const id = objId || exclId;

  // Не бот, або немає id об'єкта — віддаємо звичайний сайт, нічого не міняємо
  if (!BOT_UA.test(ua) || !id) {
    return context.next();
  }

  try {
    const table = exclId ? 'manual_listings' : 'public_site_objects';
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/${table}?id=eq.${encodeURIComponent(id)}&select=*&limit=1`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    if (!res.ok) return context.next();

    const rows = await res.json();
    const obj = rows && rows[0];
    if (!obj) return context.next();

    const catLabel = { flat: 'Квартира', house: 'Будинок', land: 'Земельна ділянка' };
    const category = catLabel[(obj.obj_cat || '').split(',')[0]] || "Об'єкт";
    const district = obj.district || 'Чернівці';
    const price = obj.price ? Number(obj.price).toLocaleString('uk-UA') + '$' : '';

    const title = `${category}${district ? ' · ' + district : ''}${price ? ' · ' + price : ''} | GHERMAN`;
    const description = exclId
      ? `Ексклюзивний об'єкт від агенції GHERMAN у Чернівцях. ${obj.description ? String(obj.description).slice(0, 150) : ''}`
      : `Нерухомість у ${district}, Чернівці. Перевірені документи, реальні фото, супровід угоди від GHERMAN.`;

    const firstPhoto = (obj.photos || '').split(',')[0].trim();
    const image = firstPhoto
      ? (exclId ? photoUrl(firstPhoto) : photoUrl(firstPhoto))
      : 'https://gherman.com.ua/og-cover.jpg';

    const html = `<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="UTF-8">
<title>${esc(title)}</title>
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(description)}">
<meta property="og:image" content="${esc(image)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${esc(url.href)}">
<meta property="og:site_name" content="GHERMAN">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(description)}">
<meta name="twitter:image" content="${esc(image)}">
</head>
<body></body>
</html>`;

    return new Response(html, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=300' }
    });
  } catch (e) {
    return context.next();
  }
};

export const config = { path: '/*' };
