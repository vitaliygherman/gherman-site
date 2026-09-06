// Динамічно віддає SEO-сторінку для /listings/<id>.html напряму з бази Supabase.
// Завдяки цьому: щойно рієлтор додає новий об'єкт у CRM — він одразу має свою
// робочу адресу на сайті, без потреби щось перегенеровувати чи заново заливати.
// Якщо об'єкт проданий/видалений з публічного каталогу — сторінка теж одразу
// перестає існувати сама собою (запит просто нічого не знайде).
//
// Написано без жодних npm-залежностей (тільки вбудований fetch) — той самий
// підхід, що і в social-meta.js, який єдиний коректно збирається на Netlify.

const SUPABASE_URL = 'https://yglebmbtdyjyqnmwwsku.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlnbGVibWJ0ZHlqeXFubXd3c2t1Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM5Nzk5NDMsImV4cCI6MjA5OTU1NTk0M30.ncKIY9mFGsBUsvoBr0iJH5cYGZZBdvKKDfMA_3TC2Mg';
const SITE = 'https://gherman.com.ua';

const CAT_LABEL = { flat: 'Квартира', house: 'Будинок', land: 'Земельна ділянка', commerce: 'Комерційна нерухомість' };

function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}
function photoUrl(path) {
  path = (path || '').trim();
  if (!path) return '';
  if (path.indexOf('http') === 0) return path;
  return SUPABASE_URL + '/storage/v1/object/public/object-photos/' + path.split('/').map(encodeURIComponent).join('/');
}
function areaUnit(cat) { return cat === 'land' ? 'соток' : 'м²'; }
function priceFmt(price) {
  const p = Number(price);
  if (!p) return 'Ціна за запитом';
  return p.toLocaleString('uk-UA') + '$';
}

const PAGE_TMPL = (o) => `<!DOCTYPE html>
<html lang="uk">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(o.title)}</title>
<meta name="description" content="${esc(o.desc)}">
<link rel="canonical" href="${o.canonical}">
<meta property="og:type" content="website">
<meta property="og:locale" content="uk_UA">
<meta property="og:site_name" content="GHERMAN — Агенція нерухомості">
<meta property="og:title" content="${esc(o.title)}">
<meta property="og:description" content="${esc(o.desc)}">
<meta property="og:url" content="${o.canonical}">
<meta property="og:image" content="${esc(o.image)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="robots" content="index, follow">
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "RealEstateListing",
  "name": ${JSON.stringify(o.title)},
  "description": ${JSON.stringify(o.desc)},
  "url": "${o.canonical}",
  "image": "${o.image}",
  "offers": { "@type": "Offer", "price": "${o.priceNum}", "priceCurrency": "USD" },
  "address": { "@type": "PostalAddress", "addressLocality": "Чернівці", "addressRegion": "Чернівецька область", "addressCountry": "UA" }
}
</script>
<style>
  :root{--wine:#6E1423;--gold:#C9A961;--cream:#FBF9F5;--ink:#1E1B18;}
  *{box-sizing:border-box;}
  body{margin:0;font-family:'Segoe UI',Arial,sans-serif;background:var(--cream);color:var(--ink);line-height:1.6;}
  header{background:#fff;padding:16px 20px;border-bottom:1px solid #eee;}
  header a{color:var(--wine);text-decoration:none;font-weight:700;font-family:Georgia,serif;font-size:20px;letter-spacing:2px;}
  .wrap{max-width:760px;margin:0 auto;padding:20px;}
  .photo{width:100%;aspect-ratio:4/3;border-radius:12px;overflow:hidden;margin-bottom:16px;background:#eee;}
  .photo img{width:100%;height:100%;display:block;object-fit:cover;}
  h1{font-family:Georgia,serif;color:var(--wine);font-size:26px;margin:0 0 6px;}
  .price{font-size:24px;font-weight:700;color:var(--wine);margin:0 0 16px;}
  .facts{display:flex;flex-wrap:wrap;gap:10px;margin:0 0 20px;}
  .fact{background:#fff;border:1px solid #eee;border-radius:10px;padding:8px 14px;font-size:14px;}
  .desc{background:#fff;border-radius:12px;padding:18px;margin-bottom:20px;}
  .cta{display:block;text-align:center;background:var(--wine);color:#fff;text-decoration:none;padding:16px;border-radius:10px;font-weight:700;}
  .back{display:inline-block;margin-top:16px;color:var(--wine);text-decoration:none;}
  footer{text-align:center;padding:24px;color:#999;font-size:13px;}
</style>
</head>
<body>
<header><a href="${SITE}/">GHERMAN</a></header>
<div class="wrap">
  <div class="photo"><img src="${esc(o.image)}" alt="${esc(o.title)}" loading="lazy"></div>
  <h1>${esc(o.h1)}</h1>
  <p class="price">${esc(o.priceDisp)}</p>
  <div class="facts">${o.factsHtml}</div>
  <div class="desc"><p>${o.noteHtml}</p></div>
  <a class="cta" href="${SITE}/?obj=${o.id}">Дивитись на сайті й зв'язатись з агенцією</a>
  <a class="back" href="${SITE}/">← Усі об'єкти GHERMAN</a>
</div>
<footer>© 2013–2026 GHERMAN · Агенція нерухомості в Чернівцях · вул. Героїв Майдану, 31</footer>
</body>
</html>`;

// Проста сторінка-заглушка, якщо об'єкт вже продано/прибрано з каталогу —
// щоб той, хто перейшов зі старого посилання з Google, не бачив голу помилку,
// а одразу отримав шлях до актуального каталогу.
const GONE_TMPL = () => `<!DOCTYPE html>
<html lang="uk"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Цей об'єкт вже продано | GHERMAN</title>
<meta name="robots" content="noindex, follow">
<style>body{font-family:'Segoe UI',Arial,sans-serif;background:#FBF9F5;color:#1E1B18;text-align:center;padding:60px 20px;}
a{display:inline-block;margin-top:20px;background:#6E1423;color:#fff;text-decoration:none;padding:14px 24px;border-radius:10px;font-weight:700;}</style>
</head><body>
<h1>Цей об'єкт вже продано або знятий з продажу</h1>
<p>Але в каталозі GHERMAN є багато інших актуальних варіантів.</p>
<a href="${SITE}/">Переглянути актуальний каталог</a>
</body></html>`;

export default async (request, context) => {
  const url = new URL(request.url);
  const m = url.pathname.match(/^\/listings\/([a-zA-Z0-9-]+)\.html$/);
  if (!m) return context.next();
  const id = m[1];

  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/public_site_objects?select=*&id=eq.${encodeURIComponent(id)}&deal_type=eq.sell`,
      { headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` } }
    );
    const data = await res.json();
    if (!Array.isArray(data) || !data.length) {
      return new Response(GONE_TMPL(), { status: 404, headers: { 'content-type': 'text/html; charset=utf-8' } });
    }
    const r = data[0];
    const cat = (r.obj_cat || 'flat').split(',')[0].trim();
    const label = CAT_LABEL[cat] || "Об'єкт";
    const district = (r.district || 'Чернівці').split(',')[0].trim();
    const photos = (r.photos || '').split(',').map(p => p.trim()).filter(Boolean);
    const image = photos.length ? photoUrl(photos[0]) : `${SITE}/og-cover.jpg`;
    const roomsWord = (r.rooms && cat === 'flat') ? `${r.rooms}-кімнатна ` : '';
    const streetPart = r.street ? `, ${r.street}` : '';
    const title = `${roomsWord}${label} — ${priceFmt(r.price)} · ${district}${streetPart} | GHERMAN`;
    const note = (r.note || '').trim();
    const descSrc = note ? note.slice(0, 150) : `${label} у районі ${district}, Чернівці.`;
    const desc = (descSrc + " Фото, ціна та деталі — на сайті агенції GHERMAN.").slice(0, 300);
    const canonical = `${SITE}/listings/${id}.html`;

    const facts = [];
    if (r.area) facts.push(`<span class="fact">${esc(r.area)} ${areaUnit(cat)}</span>`);
    if (r.rooms && cat !== 'land') facts.push(`<span class="fact">${esc(r.rooms)} кімн.</span>`);
    if (r.floor) facts.push(`<span class="fact">поверх ${esc(r.floor)}${r.floor_total ? '/' + esc(r.floor_total) : ''}</span>`);
    if (r.street) facts.push(`<span class="fact">${esc(r.street)}</span>`);

    const html = PAGE_TMPL({
      id, title, desc, canonical, image,
      priceNum: r.price || '0', priceDisp: priceFmt(r.price),
      h1: `${label} — ${district}`,
      factsHtml: facts.join(''),
      noteHtml: (note ? esc(note) : `${label} у районі ${esc(district)}. Деталі уточнюйте у менеджера агенції GHERMAN.`).replace(/\n/g, '<br>')
    });

    return new Response(html, {
      status: 200,
      headers: { 'content-type': 'text/html; charset=utf-8', 'Cache-Control': 'public, max-age=3600' }
    });
  } catch (e) {
    // Supabase недоступний — не ламаємо сторінку, віддаємо статичний файл, якщо він є
    return context.next();
  }
};

export const config = { path: '/listings/*' };
