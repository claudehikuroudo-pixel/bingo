// ハロウィンビンゴを「ネットなしでも開ける」ようにする（build_pwa.py が作る。直接直さない）
// 最初に1回ネットありで開くと、全部を端末にしまう。2回目からは しまった物を先に返す（ネットを待たない）
const CACHE = 'halloween-bingo-cf0da4e070';
const SHELL = ["./", "./index.html", "./voice.mp3", "./voice-map.json", "./manifest.json", "./icon-180.png", "./icon-192.png", "./icon-512.png"];
const FONT_CSS = 'https://fonts.googleapis.com/css2?family=Creepster&family=Dela+Gothic+One&family=M+PLUS+Rounded+1c:wght@500;800&display=swap';
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
// このページで使う文字。Google Fonts は文字の範囲ごとに切れ端に分かれているので、この文字が入る切れ端だけしまう
const CHARS = " !\"#$%&'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_abcdefghijklmnopqrstuvwxyz{|}~…→⚠✦⭐、。「」あいうえおかがきくけげこごさざしじすずせそただちっつづてでとなにねのはばひぴふへぼまみむめもゃやゆよらりるれろわをんァアィイウオカガキクグゲコゴザジスセソゾタチッツテデトドナニネハバパビピフブプヘベペボマムメモャュラリルレロンヶ・ー一上丘中人休会体何使個値備光入全内再出分列初別前効動取台右号合同器回地場墓声夜大始子字定実対小屋巣左巨度当待後応成戻手打扱押抽拍描数敷日景書最月期木本来果枯楽機次止残況流消済準演火無然状生用画番目直瞬知短確示種空符等粒素続置背自舞花葉蔵行表要見覧言設話語読調起踊輪込透遠選部重量録長閉開間隣雷電面音類飛高鳴️！（）＋／：＝？🍫🍬🍭🎃👻🕸🦇";
const CPS = Array.from(CHARS, ch => ch.codePointAt(0));

function parseRanges(s) {
  return s.split(',').map(t => t.trim().replace(/^U\+/i, '')).filter(Boolean).map(t => {
    if (t.includes('?')) return [parseInt(t.replace(/\?/g, '0'), 16), parseInt(t.replace(/\?/g, 'F'), 16)];
    const [a, z] = t.split('-');
    return [parseInt(a, 16), parseInt(z || a, 16)];
  });
}

async function cacheFonts(c) {
  const res = await fetch(FONT_CSS, { mode: 'cors' });
  if (!res.ok) throw new Error('css ' + res.status);
  const css = await res.clone().text();
  await c.put(FONT_CSS, res);
  const urls = [];
  for (const block of css.split('@font-face').slice(1)) {
    const u = block.match(/url\((https:[^)]+)\)/);
    if (!u) continue;
    const r = block.match(/unicode-range:\s*([^;}]+)/);
    const ranges = r ? parseRanges(r[1]) : null;
    if (!ranges || CPS.some(cp => ranges.some(([a, z]) => cp >= a && cp <= z))) urls.push(u[1]);
  }
  const got = await Promise.all(urls.map(u => fetch(u, { mode: 'cors' })
    .then(x => (x.ok ? c.put(u, x).then(() => true) : false)).catch(() => false)));
  const n = got.filter(Boolean).length;
  if (n < urls.length) throw new Error('fonts ' + n + '/' + urls.length);
  return n;
}

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(async c => {
    await c.addAll(SHELL);
    // 飾り文字は しまえなくても動く（ふつうの文字で出る）。結果は ./__fonts に書いてページが知らせる
    const mark = await cacheFonts(c).then(n => 'ok ' + n, err => 'ng ' + err.message);
    await c.put('./__fonts', new Response(mark));
  }).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(ks => Promise.all(ks.filter(k => k.startsWith('halloween-bingo-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  const mine = url.origin === location.origin;
  if (!mine && !FONT_HOSTS.includes(url.hostname)) return;
  e.respondWith(caches.open(CACHE).then(async c => {
    const hit = mine && req.mode === 'navigate'
      ? await c.match('./index.html')
      : await c.match(req, { ignoreVary: true });
    if (hit) return hit;
    const res = await fetch(req);
    if (!mine && res.ok) c.put(req, res.clone());
    return res;
  }));
});
