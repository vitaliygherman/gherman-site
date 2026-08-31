// ==== GHERMAN: генератор красивої картки для соцмереж (колаж 1 велике + 2 малих фото) ====
// Приймає до трьох фото + текст, малює преміальну картку 1200x630:
// тонка золота рамка, велике фото зліва, два менших справа, скляна плашка з ціною.
// Якщо щось піде не так — тихо віддає перше фото, сайт ніколи не ламається.

import satori from 'npm:satori@0.33.4';
import { Resvg, initWasm } from 'npm:@resvg/resvg-wasm@2.6.2';

const PLAYFAIR_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/playfairdisplay/PlayfairDisplay%5Bwght%5D.ttf';
const INTER_URL = 'https://raw.githubusercontent.com/google/fonts/main/ofl/inter/Inter%5Bopsz,wght%5D.ttf';
const RESVG_WASM_URL = 'https://unpkg.com/@resvg/resvg-wasm@2.6.2/index_bg.wasm';

const GOLD = '#C9A961';
const INK = '#1E1B18';

let fontCache = null;
let wasmReady = false;

async function getFonts() {
  if (fontCache) return fontCache;
  const [playfairBuf, interBuf] = await Promise.all([
    fetch(PLAYFAIR_URL).then((r) => r.arrayBuffer()),
    fetch(INTER_URL).then((r) => r.arrayBuffer()),
  ]);
  fontCache = [
    { name: 'Playfair', data: playfairBuf, weight: 800, style: 'normal' },
    { name: 'Inter', data: interBuf, weight: 500, style: 'normal' },
    { name: 'Inter', data: interBuf, weight: 700, style: 'normal' },
  ];
  return fontCache;
}

async function ensureWasm() {
  if (wasmReady) return;
  const buf = await fetch(RESVG_WASM_URL).then((r) => r.arrayBuffer());
  await initWasm(buf);
  wasmReady = true;
}

async function photoToDataUri(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('photo fetch failed: ' + res.status);
  const bytes = new Uint8Array(await res.arrayBuffer());
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  const b64 = btoa(binary);
  const type = res.headers.get('content-type') || 'image/jpeg';
  return `data:${type};base64,${b64}`;
}

// Хелпер, щоб будувати дерево елементів без JSX (satori приймає звичайні об'єкти)
function h(type, props, ...children) {
  const flat = children.flat(Infinity).filter((c) => c !== null && c !== undefined && c !== false);
  return { type, props: { ...props, children: flat.length === 1 ? flat[0] : flat } };
}

function photoPanel(dataUri, { flex, radius }) {
  return h(
    'div',
    { style: { display: 'flex', flex, position: 'relative', borderRadius: radius, overflow: 'hidden' } },
    h('img', { src: dataUri, style: { width: '100%', height: '100%', objectFit: 'cover' } })
  );
}

function buildTree({ photos, price, district, cat, isExclusive }) {
  const [p1, p2, p3] = photos;

  const heroPanel = h(
    'div',
    { style: { display: 'flex', flex: '1.65', position: 'relative', borderRadius: '10px', overflow: 'hidden' } },
    h('img', { src: p1, style: { width: '100%', height: '100%', objectFit: 'cover' } }),
    // затемнення знизу для читабельності
    h('div', {
      style: {
        position: 'absolute',
        inset: 0,
        display: 'flex',
        backgroundImage:
          'linear-gradient(to top, rgba(15,10,8,0.92) 0%, rgba(15,10,8,0.45) 34%, rgba(15,10,8,0.02) 60%, rgba(15,10,8,0) 100%)',
      },
    }),
    // логотип зверху зліва
    h(
      'div',
      { style: { position: 'absolute', top: '32px', left: '32px', display: 'flex', flexDirection: 'column' } },
      h(
        'div',
        {
          style: {
            display: 'flex',
            fontFamily: 'Playfair',
            fontWeight: 800,
            fontSize: '27px',
            color: '#FFFFFF',
            letterSpacing: '5px',
          },
        },
        'GHERMAN'
      ),
      h('div', { style: { display: 'flex', width: '46px', height: '2px', backgroundColor: GOLD, marginTop: '9px' } })
    ),
    // бейдж ЕКСКЛЮЗИВ зверху справа
    isExclusive
      ? h(
          'div',
          {
            style: {
              position: 'absolute',
              top: '32px',
              right: '32px',
              display: 'flex',
              backgroundColor: GOLD,
              color: INK,
              fontFamily: 'Inter',
              fontWeight: 700,
              fontSize: '17px',
              padding: '9px 20px',
              borderRadius: '30px',
              letterSpacing: '1px',
            },
          },
          'ЕКСКЛЮЗИВ'
        )
      : null,
    // скляна плашка з ціною знизу зліва
    h(
      'div',
      {
        style: {
          position: 'absolute',
          left: '32px',
          bottom: '32px',
          right: '32px',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'rgba(15,10,8,0.38)',
          border: '1px solid rgba(201,169,97,0.55)',
          borderRadius: '14px',
          padding: '22px 26px',
        },
      },
      h(
        'div',
        { style: { display: 'flex', fontFamily: 'Playfair', fontWeight: 800, fontSize: '52px', color: GOLD, lineHeight: 1 } },
        price
      ),
      h(
        'div',
        {
          style: {
            display: 'flex',
            fontFamily: 'Inter',
            fontWeight: 500,
            fontSize: '24px',
            color: '#FFFFFF',
            opacity: 0.92,
            marginTop: '10px',
          },
        },
        cat + (district ? '  ·  ' + district : '')
      )
    )
  );

  const sidePhotos = h(
    'div',
    { style: { display: 'flex', flex: '1', flexDirection: 'column', gap: '8px' } },
    photoPanel(p2, { flex: '1', radius: '10px' }),
    photoPanel(p3, { flex: '1', radius: '10px' })
  );

  return h(
    'div',
    {
      style: {
        display: 'flex',
        width: '1200px',
        height: '630px',
        backgroundColor: GOLD,
        padding: '3px',
      },
    },
    h(
      'div',
      {
        style: {
          display: 'flex',
          width: '100%',
          height: '100%',
          backgroundColor: INK,
          padding: '7px',
          gap: '8px',
        },
      },
      heroPanel,
      sidePhotos
    )
  );
}

export default async (request) => {
  const url = new URL(request.url);
  const img1 = url.searchParams.get('img1') || url.searchParams.get('img');
  const img2 = url.searchParams.get('img2') || img1;
  const img3 = url.searchParams.get('img3') || img2;
  const price = url.searchParams.get('price') || 'Ціна за запитом';
  const district = url.searchParams.get('district') || '';
  const cat = url.searchParams.get('cat') || "Об'єкт";
  const isExclusive = url.searchParams.get('excl') === '1';

  if (!img1) {
    return new Response('missing img param', { status: 400 });
  }

  try {
    const [fonts, p1, p2, p3] = await Promise.all([
      getFonts(),
      photoToDataUri(img1),
      photoToDataUri(img2),
      photoToDataUri(img3),
    ]);
    await ensureWasm();

    const tree = buildTree({ photos: [p1, p2, p3], price, district, cat, isExclusive });
    const svg = await satori(tree, { width: 1200, height: 630, fonts });

    const resvg = new Resvg(svg, { fitTo: { mode: 'width', value: 1200 } });
    const png = resvg.render().asPng();

    return new Response(png, {
      status: 200,
      headers: { 'content-type': 'image/png', 'cache-control': 'public, max-age=86400' },
    });
  } catch (e) {
    return Response.redirect(img1, 302);
  }
};

export const config = { path: '/api/og-image' };
