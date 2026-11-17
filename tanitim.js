// Ürün tanıtım videosu: fotoğraflardan logolu, yazılı, hareketli kısa video.
// Çizim tamamen <canvas> ile yapılır; video iPad'in kendi H.264 kodlayıcısıyla (WebCodecs)
// MP4 olarak üretilir — internet ve ücretli servis gerekmez.

export const FORMATLAR = {
  dikey: { ad: 'Dikey · Reels / Hikâye', w: 1080, h: 1920 },
  dort5: { ad: '4:5 · Gönderi', w: 1080, h: 1350 },
  kare: { ad: 'Kare', w: 1080, h: 1080 },
  yatay: { ad: 'Yatay · YouTube / WhatsApp', w: 1920, h: 1080 },
};
// Logodaki renkler: lacivert, turkuaz, mercan, fuşya, altın
export const TEMALAR = {
  zarif: { ad: 'Zarif', bg: ['#fbf8f3', '#f3ece2'], yazi: '#1b2b52', soluk: '#6c6a7a', vurgu: '#c8317a', dikis: '#e0a92e', perde: 'rgba(251,248,243,.8)', logoZemin: null },
  canli: { ad: 'Canlı', bg: ['#2bb3c0', '#c8317a'], yazi: '#ffffff', soluk: 'rgba(255,255,255,.85)', vurgu: '#ffd25e', dikis: '#ffffff', perde: 'rgba(40,20,70,.30)', logoZemin: '#ffffff' },
  koyu: { ad: 'Koyu', bg: ['#14213d', '#22305a'], yazi: '#ffffff', soluk: 'rgba(255,255,255,.75)', vurgu: '#e0a92e', dikis: '#e0a92e', perde: 'rgba(20,33,61,.72)', logoZemin: '#ffffff' },
};

const GIRIS = 2.2, FOTO = 3.2, CIKIS = 3.0, GECIS = 0.5;
const kis = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const yumusak = x => 1 - Math.pow(1 - kis(x), 3);
const zipla = x => { x = kis(x); const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(x - 1, 3) + c1 * Math.pow(x - 1, 2); };

function yuvarlakDikdortgen(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y); g.arcTo(x + w, y, x + w, y + h, r); g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r); g.arcTo(x, y, x + w, y, r); g.closePath();
}
function satirlaraBol(g, metin, genislik, enCok = 2) {
  // sondaki emoji son kelimeye yapışık kalsın (tek başına alt satıra düşmesin)
  const kelimeler = String(metin || '').replace(/ ([^\p{L}\p{N}\s]+)$/u, '\u00a0$1').split(/ +/).filter(Boolean);
  const satirlar = []; let s = '';
  for (const k of kelimeler) {
    const dene = s ? s + ' ' + k : k;
    if (g.measureText(dene).width > genislik && s) { satirlar.push(s); s = k; } else s = dene;
  }
  if (s) satirlar.push(s);
  if (satirlar.length > enCok) { satirlar.length = enCok; satirlar[enCok - 1] += '…'; }
  return satirlar;
}
/** Kaynak fotoğraf (ImageBitmap/canvas) ya da video olabilir */
export const kaynakBoyut = k => (k.videoWidth ? [k.videoWidth, k.videoHeight] : [k.width, k.height]);
const videoMu = k => !!k && k.tagName === 'VIDEO';
/** Yumuşak bulanık arka plan: küçült → 3 geçişli kutu bulanıklığı → 4× büyüt (bloklanmaz). */
function bulaniklastir(img) {
  const [iw, ih] = kaynakBoyut(img);
  const w = 64, h = Math.max(1, Math.round(w * ih / iw));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0, w, h);
  const v = g.getImageData(0, 0, w, h), p = v.data, t = new Float32Array(p.length), R = 3;
  for (let gecis = 0; gecis < 3; gecis++) {
    for (const [dx, dy, n, m] of [[1, 0, w, h], [0, 1, h, w]]) { // yatay sonra dikey
      for (let a = 0; a < m; a++) for (let b = 0; b < n; b++) {
        for (let ch = 0; ch < 3; ch++) {
          let top = 0, say = 0;
          for (let k = -R; k <= R; k++) {
            const bb = b + k; if (bb < 0 || bb >= n) continue;
            const x = dx ? bb : a, y = dx ? a : bb;
            top += p[(y * w + x) * 4 + ch]; say++;
          }
          const x = dx ? b : a, y = dx ? a : b;
          t[(y * w + x) * 4 + ch] = top / say;
        }
      }
      for (let i = 0; i < p.length; i += 4) { p[i] = t[i]; p[i + 1] = t[i + 1]; p[i + 2] = t[i + 2]; }
    }
  }
  g.putImageData(v, 0, 0);
  const b4 = document.createElement('canvas');
  b4.width = w * 4; b4.height = h * 4;
  const g4 = b4.getContext('2d'); g4.imageSmoothingQuality = 'high'; g4.drawImage(c, 0, 0, b4.width, b4.height);
  return b4;
}
function kapla(g, img, x, y, w, h, olcek = 1, kx = 0, ky = 0) {
  const [iw, ih] = kaynakBoyut(img);
  const o = Math.max(w / iw, h / ih) * olcek;
  const dw = iw * o, dh = ih * o;
  g.drawImage(img, x + (w - dw) / 2 + kx * (dw - w) / 2, y + (h - dh) / 2 + ky * (dh - h) / 2, dw, dh);
}

export const resimYukle = src => new Promise((ok, hata) => { const r = new Image(); r.onload = () => ok(r); r.onerror = hata; r.src = src; });

/** Animasyon tanımı. fotolar: ImageBitmap/Image dizisi; m: metinler; logo: Image */
export class Animasyon {
  constructor({ fotolar, logo, format = 'dikey', tema = 'zarif', m }) {
    this.f = FORMATLAR[format]; this.W = this.f.w; this.H = this.f.h; this.B = Math.min(this.W, this.H); this.format = format;
    this.t = TEMALAR[tema]; this.logo = logo; this.m = m;
    this.fotolar = fotolar;
    // Bulanık arka plan: fotoğrafı minik çizip büyütmek = yumuşak bulanıklık (her tarayıcıda çalışır)
    this.bulanik = fotolar.map(img => bulaniklastir(img, 28));
    this.sure = GIRIS + Math.max(1, fotolar.length) * FOTO + CIKIS;
    this.kaynakZamani = t => {
      const n = Math.max(1, fotolar.length), k = Math.max(0, Math.min(n - 1, Math.floor((t - GIRIS) / FOTO)));
      const u = t - GIRIS - k * FOTO;
      return k > 0 && u < GECIS ? [[k, u], [k - 1, FOTO + u]] : [[k, Math.max(0, u)]];
    };
    const W = this.W, H = this.H;
    // Fotoğraf çerçevesi: biçime göre
    const kutu = { dikey: [0.84, 0.58, 0.13], dort5: [0.78, 0.64, 0.08], kare: [0.70, 0.66, 0.07] }[format];
    this.cerceve = format === 'yatay'   // yatay: fotoğraf solda, yazılar sağda
      ? { w: W * 0.46, h: H * 0.78, x: W * 0.06, y: H * 0.11 }
      : { w: W * kutu[0], h: H * kutu[1], x: (W - W * kutu[0]) / 2, y: H * kutu[2] };
  }

  zemin(g) {
    const { W, H, t } = this;
    const gr = g.createLinearGradient(0, 0, W, H);
    gr.addColorStop(0, t.bg[0]); gr.addColorStop(1, t.bg[1]);
    g.fillStyle = gr; g.fillRect(0, 0, W, H);
  }

  logoCiz(g, cx, cy, boy, alfa = 1, donus = 0) {
    if (!this.logo) return;
    g.save(); g.globalAlpha = alfa; g.translate(cx, cy); g.rotate(donus);
    if (this.t.logoZemin) { g.fillStyle = this.t.logoZemin; g.beginPath(); g.arc(0, 0, boy * 0.62, 0, Math.PI * 2); g.fill(); }
    const w = boy, h = boy * this.logo.height / this.logo.width;
    g.drawImage(this.logo, -w / 2, -h / 2, w, h);
    g.restore();
  }

  yazi(g, metin, x, y, boy, renk, kalin = 700, hiza = 'center', aile = 'Poppins') {
    g.font = `${kalin} ${boy}px ${aile}, "Segoe UI", -apple-system, sans-serif`;
    g.fillStyle = renk; g.textAlign = hiza; g.textBaseline = 'alphabetic';
    g.fillText(metin, x, y);
  }

  dikisCercevesi(g, x, y, w, h, r, zaman, ilerleme = 1) {
    const W = this.W, H = this.H, B = this.B;
    g.save();
    g.strokeStyle = this.t.dikis; g.lineWidth = B * 0.0055; g.lineCap = 'round';
    g.setLineDash([B * 0.02, B * 0.013]);
    g.lineDashOffset = -zaman * B * 0.03;
    if (ilerleme < 1) { // dikiş "atılıyor": çerçeve soldan sağa açılır
      g.beginPath(); g.rect(x - 40, y - 40, (w + 80) * ilerleme, h + 80); g.clip();
    }
    yuvarlakDikdortgen(g, x, y, w, h, r); g.stroke();
    g.restore();
  }

  /** t saniyesindeki kareyi çizer */
  ciz(g, t) {
    const { W, H, B } = this;
    g.save();
    this.zemin(g);
    const n = Math.max(1, this.fotolar.length);
    const fotoBas = GIRIS, cikisBas = GIRIS + n * FOTO;
    if (t < fotoBas + GECIS) this.giris(g, t);
    if (t >= fotoBas - 0.01 && t < cikisBas + GECIS) {
      const k = Math.min(n - 1, Math.floor((t - fotoBas) / FOTO));
      const u = t - fotoBas - k * FOTO;
      if (k > 0 && u < GECIS) this.foto(g, k - 1, FOTO + u, 1);
      this.foto(g, k, u, yumusak(u / GECIS));
      if (t > cikisBas - GECIS * 0) { /* çıkışta foto üstüne kapanış gelir */ }
    }
    if (t >= cikisBas) this.cikis(g, t - cikisBas);
    g.restore();
  }

  giris(g, t) {
    const { W, H, B } = this;
    const sonAlfa = 1 - kis((t - GIRIS) / GECIS);           // fotoğraf gelirken kaybol
    const a = yumusak(t / 0.8) * sonAlfa;
    const boy = Math.min(W, H) * 0.42 * (0.7 + 0.3 * zipla(t / 0.9));
    const cy = H * 0.42;
    this.logoCiz(g, W / 2, cy, boy, a, (1 - yumusak(t / 1.2)) * -0.25);
    // logonun etrafında dikiş halkası atılıyor
    g.save(); g.globalAlpha = sonAlfa;
    g.strokeStyle = this.t.dikis; g.lineWidth = B * 0.006; g.lineCap = 'round';
    g.setLineDash([B * 0.018, B * 0.012]);
    g.beginPath(); g.arc(W / 2, cy, boy * 0.72, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * yumusak((t - 0.3) / 1.3)); g.stroke();
    g.restore();
    const ya = yumusak((t - 0.7) / 0.6) * sonAlfa;
    g.save(); g.globalAlpha = ya;
    const ty = cy + boy * 0.72 + H * 0.075 + (1 - ya) * 30;
    this.yazi(g, 'Envai Tasarım', W / 2, ty, B * 0.085, this.t.yazi);
    this.yazi(g, this.m.slogan || 'El yapımı · Kişiye özel', W / 2, ty + B * 0.07, B * 0.04, this.t.soluk, 500, 'center', 'Inter');
    g.restore();
  }

  foto(g, k, u, giris) {
    const { W, H, B, cerceve: c } = this;
    const img = this.fotolar[k];
    if (!img) return;
    const p = u / FOTO;                                     // 0..1 bu fotoğrafın süresi
    // Arka plan: aynı fotoğrafın bulanık hali + tema perdesi
    g.save(); g.globalAlpha = giris; g.imageSmoothingQuality = 'high';
    kapla(g, this.bulanik[k], -40, -40, W + 80, H + 80, 1.1);
    g.fillStyle = this.t.perde; g.fillRect(0, 0, W, H);
    g.restore();

    // Çerçeve: aşağıdan kayarak gelir
    const kay = (1 - giris) * H * 0.06;
    const r = B * 0.045;
    g.save(); g.globalAlpha = giris;
    g.shadowColor = 'rgba(0,0,0,.28)'; g.shadowBlur = B * 0.05; g.shadowOffsetY = B * 0.02;
    g.fillStyle = '#fff'; yuvarlakDikdortgen(g, c.x, c.y + kay, c.w, c.h, r); g.fill();
    g.shadowColor = 'transparent';
    yuvarlakDikdortgen(g, c.x, c.y + kay, c.w, c.h, r); g.clip();
    // Ken Burns: yavaş yakınlaşma, fotoğrafa göre yön değiştirir
    const yon = k % 2 ? -1 : 1;
    kapla(g, img, c.x, c.y + kay, c.w, c.h, 1.03 + 0.09 * p, yon * (p - 0.5) * 0.8, (0.5 - p) * 0.4);
    g.restore();

    // Dikiş çerçevesi
    g.save(); g.globalAlpha = giris;
    const bosluk = B * 0.025;
    this.dikisCercevesi(g, c.x - bosluk, c.y - bosluk + kay, c.w + 2 * bosluk, c.h + 2 * bosluk, r + bosluk, u + k, k === 0 ? yumusak(u / 1.2) : 1);
    g.restore();

    // Köşede küçük logo
    this.logoCiz(g, B * 0.1, H * 0.055, B * 0.085, 0.95 * giris);
    g.save(); g.globalAlpha = giris;
    this.yazi(g, 'Envai Tasarım', B * 0.16, H * 0.055 + B * 0.012, B * 0.034, this.t.yazi, 600, 'left');
    g.restore();

    // Yazılar: başlık her fotoğrafta, altında o fotoğrafa ait öne çıkan özellik
    const yatay = this.format === 'yatay';
    const mx = yatay ? W * 0.765 : W / 2, mw = yatay ? W * 0.4 : W * 0.86;
    const altY = yatay ? H * 0.36 : c.y + c.h + B * 0.04;
    const alan = yatay ? H * 0.5 : H - altY;
    const baslikBoy = Math.min(B * 0.075, alan * 0.26);
    g.save();
    const ta = yumusak((u - 0.25) / 0.6);
    g.globalAlpha = ta * giris;
    g.font = `700 ${baslikBoy}px Poppins, "Segoe UI", sans-serif`;
    const satir = satirlaraBol(g, this.m.baslik, mw, this.format === 'kare' ? 1 : yatay ? 3 : 2);
    let y = altY + baslikBoy * 1.05 + (1 - ta) * 24;
    for (const s of satir) { this.yazi(g, s, mx, y, baslikBoy, this.t.yazi); y += baslikBoy * 1.15; }
    const ozellik = this.m.ozellikler?.[k % Math.max(1, this.m.ozellikler.length)] || '';
    if (ozellik) {
      const oa = yumusak((u - 0.6) / 0.6);
      g.globalAlpha = oa * giris;
      const ob = Math.min(B * 0.045, alan * 0.15);
      this.yazi(g, '✦ ' + ozellik, mx, y + ob * 0.5 + (1 - oa) * 18, ob, this.t.soluk, 500, 'center', 'Inter');
    }
    g.restore();

    // Son fotoğrafta fiyat rozeti
    if (this.m.fiyat && k === this.fotolar.length - 1) {
      const s = zipla((u - 0.9) / 0.5);
      if (s > 0) {
        const rx = c.x + c.w - B * 0.03, ry = c.y + B * 0.06 + kay;
        g.save(); g.translate(rx, ry); g.scale(s, s); g.rotate(-0.08);
        g.font = `700 ${B * 0.055}px Poppins, sans-serif`;
        const tw = g.measureText(this.m.fiyat).width + B * 0.07;
        g.fillStyle = this.t.vurgu; yuvarlakDikdortgen(g, -tw, -B * 0.05, tw, B * 0.1, B * 0.05); g.fill();
        g.fillStyle = this.t.vurgu === '#ffd25e' ? '#1b2b52' : '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
        g.fillText(this.m.fiyat, -tw / 2, 0);
        g.restore();
      }
    }
  }

  cikis(g, u) {
    const { W, H, B } = this;
    const a = yumusak(u / GECIS);
    g.save(); g.globalAlpha = a;
    this.zemin(g);
    const boy = Math.min(W, H) * 0.26 * (0.85 + 0.15 * zipla(u / 0.8));
    const cy = H * (this.format === 'kare' || this.format === 'yatay' ? 0.27 : 0.3);
    this.logoCiz(g, W / 2, cy, boy, 1);
    let y = cy + boy * 0.75 + B * 0.06;
    this.yazi(g, 'Envai Tasarım', W / 2, y, B * 0.07, this.t.yazi);
    y += B * 0.1;
    const satirlar = [
      [this.m.cagri || 'Sipariş ve bilgi için yazın', B * 0.05, this.t.vurgu === '#ffd25e' ? this.t.yazi : this.t.vurgu, 700],
      this.m.instagram && ['Instagram  @' + this.m.instagram.replace(/^@/, ''), B * 0.045, this.t.yazi, 600],
      this.m.whatsapp && ['WhatsApp  ' + this.m.whatsapp, B * 0.045, this.t.yazi, 600],
    ].filter(Boolean);
    satirlar.forEach(([m, b, renk, k], i) => {
      const sa = yumusak((u - 0.35 - i * 0.25) / 0.5);
      g.save(); g.globalAlpha = a * sa;
      this.yazi(g, m, W / 2, y + (1 - sa) * 20, b, renk, k, 'center', i ? 'Inter' : 'Poppins');
      g.restore();
      y += b * 1.8;
    });
    // alt tarafta dikiş çizgisi
    g.strokeStyle = this.t.dikis; g.lineWidth = B * 0.005; g.setLineDash([B * 0.02, B * 0.013]);
    g.lineDashOffset = -u * B * 0.04;
    g.beginPath(); g.moveTo(W * 0.2, y + B * 0.02); g.lineTo(W * 0.2 + W * 0.6 * yumusak((u - 0.5) / 1), y + B * 0.02); g.stroke();
    g.restore();
  }
}

function scriptYukle(src) {
  return new Promise((ok, hata) => {
    if (document.querySelector(`script[src="${src}"]`)) return ok();
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = () => hata(new Error(src + ' yüklenemedi'));
    document.head.append(s);
  });
}

export async function yaziTipleriHazir() {
  try {
    await Promise.all(['700 60px Poppins', '600 60px Poppins', '500 40px Inter', '600 40px Inter']
      .map(f => document.fonts.load(f, 'ĞÜŞİÖÇğüşıöç₺')));
  } catch { /* çevrimdışı: sistem yazı tipi */ }
}

export const videoDestekli = () => 'VideoEncoder' in window || ('MediaRecorder' in window && 'captureStream' in HTMLCanvasElement.prototype);

/** Animasyonu MP4 dosyasına çevirir. ilerleme(0..1) */
export async function videoUret(anim, dosyaAdi, ilerleme = () => { }, fps = 30) {
  const c = document.createElement('canvas');
  c.width = anim.W; c.height = anim.H;
  const g = c.getContext('2d', { alpha: false });
  if ('VideoEncoder' in window) {
    try { return await webcodecs(anim, c, g, dosyaAdi, ilerleme, fps); }
    catch (e) { console.warn('WebCodecs olmadı, gerçek zamanlı kayda geçiliyor', e); }
  }
  return await kaydedici(anim, c, g, dosyaAdi, ilerleme, fps);
}

/** Video kaynakları istenen ana sarar (kare kare doğru görüntü için). */
export async function kaynaklariHazirla(anim, t) {
  for (const [k, z] of anim.kaynakZamani?.(t) || []) {
    const v = anim.fotolar[k];
    if (!videoMu(v) || !v.duration) continue;
    const hedef = z % Math.max(0.1, v.duration - 0.05);
    if (Math.abs(v.currentTime - hedef) < 0.5 / 30) continue;
    await new Promise(ok => {
      const zm = setTimeout(ok, 800);
      v.addEventListener('seeked', () => { clearTimeout(zm); ok(); }, { once: true });
      v.currentTime = hedef;
    });
  }
}

/** Video dosyasından oynatılabilir (sessiz) video öğesi */
export function videoKaynak(blob) {
  return new Promise((ok, hata) => {
    const v = document.createElement('video');
    v.muted = true; v.playsInline = true; v.loop = true; v.preload = 'auto';
    v.setAttribute('playsinline', ''); v.setAttribute('muted', '');
    v.src = URL.createObjectURL(blob);
    v.addEventListener('loadeddata', () => ok(v), { once: true });
    v.addEventListener('error', () => hata(new Error('Video okunamadı')), { once: true });
    v.load();
  });
}

// ---------------------------------------------------------------- otomatik fotoğraf düzenleme
/** Işık, beyaz dengesi, kontrast, canlılık ve netlik düzeltmesi (cihaz üzerinde, ücretsiz). */
export function iyilestir(img) {
  const [iw, ih] = kaynakBoyut(img);
  const c = document.createElement('canvas');
  c.width = iw; c.height = ih;
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(img, 0, 0);
  const veri = g.getImageData(0, 0, iw, ih), p = veri.data;
  // 1) Kanal histogramları (seyrek örnekleme) → %0,5 ve %99,5 sınırları
  const hist = [new Uint32Array(256), new Uint32Array(256), new Uint32Array(256)];
  let ornek = 0;
  for (let i = 0; i < p.length; i += 4 * 7) { hist[0][p[i]]++; hist[1][p[i + 1]]++; hist[2][p[i + 2]]++; ornek++; }
  const sinir = (h, oran) => { let t = 0; const hedef = ornek * oran; for (let v = 0; v < 256; v++) { t += h[v]; if (t >= hedef) return v; } return 255; };
  const alt = hist.map(h => sinir(h, 0.005)), ust = hist.map(h => sinir(h, 0.995));
  // beyaz dengesi yarı güçte: kanalları ortak aralığa yaklaştır
  const altO = (alt[0] + alt[1] + alt[2]) / 3, ustO = (ust[0] + ust[1] + ust[2]) / 3;
  const lut = [0, 1, 2].map(ch => {
    const a = (alt[ch] + altO) / 2, b = Math.max(a + 20, (ust[ch] + ustO) / 2);
    const l = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) {
      let x = Math.min(1, Math.max(0, (v - a) / (b - a)));
      x = x + 0.5 * x * (1 - x) * (x - 0.5) * 0.6 + 0.025;        // hafif S eğrisi + biraz aydınlatma
      l[v] = Math.round(Math.min(1, Math.max(0, x)) * 255);
    }
    return l;
  });
  for (let i = 0; i < p.length; i += 4) {
    const r = lut[0][p[i]], gg = lut[1][p[i + 1]], b = lut[2][p[i + 2]];
    const gri = 0.3 * r + 0.59 * gg + 0.11 * b, cl = 1.14;           // canlılık %14
    p[i] = gri + (r - gri) * cl; p[i + 1] = gri + (gg - gri) * cl; p[i + 2] = gri + (b - gri) * cl;
  }
  g.putImageData(veri, 0, 0);
  // 2) Netlik: bulanık kopyayı çıkararak hafif keskinleştirme (unsharp mask)
  const k = document.createElement('canvas');
  k.width = Math.max(1, Math.round(iw / 3)); k.height = Math.max(1, Math.round(ih / 3));
  k.getContext('2d').drawImage(c, 0, 0, k.width, k.height);
  const bul = document.createElement('canvas'); bul.width = iw; bul.height = ih;
  const bg = bul.getContext('2d', { willReadFrequently: true }); bg.imageSmoothingQuality = 'high'; bg.drawImage(k, 0, 0, iw, ih);
  const b2 = bg.getImageData(0, 0, iw, ih).data, son = g.getImageData(0, 0, iw, ih), q = son.data;
  for (let i = 0; i < q.length; i += 4) for (let ch = 0; ch < 3; ch++) q[i + ch] = q[i + ch] + (q[i + ch] - b2[i + ch]) * 0.35;
  g.putImageData(son, 0, 0);
  return c;
}

async function webcodecs(anim, c, g, dosyaAdi, ilerleme, fps) {
  await scriptYukle('lib/mp4-muxer.min.js');
  const { Muxer, ArrayBufferTarget } = window.Mp4Muxer;
  const temel = { width: anim.W, height: anim.H, bitrate: 7_000_000, framerate: fps };
  let codec = null;
  for (const k of ['avc1.640028', 'avc1.4d0028', 'avc1.42002a', 'avc1.420028']) {
    try { if ((await VideoEncoder.isConfigSupported({ ...temel, codec: k })).supported) { codec = k; break; } } catch { }
  }
  if (!codec) throw new Error('H.264 kodlayıcı yok');
  // Sessiz AAC ses izi: bazı oynatıcılar ve Instagram müzik ekleme sessiz izle daha uyumlu. Desteklenmezse sessiz devam.
  const SES = { codec: 'mp4a.40.2', sampleRate: 48000, numberOfChannels: 2, bitrate: 64000 };
  let sesVar = false;
  try { sesVar = 'AudioEncoder' in window && (await AudioEncoder.isConfigSupported(SES)).supported; } catch { }
  const muxer = new Muxer({
    target: new ArrayBufferTarget(), video: { codec: 'avc', width: anim.W, height: anim.H }, fastStart: 'in-memory',
    ...(sesVar ? { audio: { codec: 'aac', numberOfChannels: 2, sampleRate: 48000 } } : {}),
  });
  let hata = null;
  const enc = new VideoEncoder({ output: (ch, meta) => muxer.addVideoChunk(ch, meta), error: e => { hata = e; } });
  if (sesVar) {
    try {
      const aenc = new AudioEncoder({ output: (ch, meta) => muxer.addAudioChunk(ch, meta), error: () => { } });
      aenc.configure(SES);
      const parca = 1024, adet = Math.ceil(anim.sure * 48000 / parca), bos = new Float32Array(parca * 2);
      for (let i = 0; i < adet; i++) {
        const a = new AudioData({ format: 'f32-planar', sampleRate: 48000, numberOfFrames: parca, numberOfChannels: 2, timestamp: Math.round(i * parca / 48000 * 1e6), data: bos });
        aenc.encode(a); a.close();
      }
      await aenc.flush(); aenc.close();
    } catch { }
  }
  enc.configure({ ...temel, codec, avc: { format: 'avc' } });
  const N = Math.ceil(anim.sure * fps);
  for (let i = 0; i < N; i++) {
    if (hata) throw hata;
    await kaynaklariHazirla(anim, i / fps);
    anim.ciz(g, i / fps);
    const kare = new VideoFrame(c, { timestamp: Math.round(i * 1e6 / fps), duration: Math.round(1e6 / fps) });
    enc.encode(kare, { keyFrame: i % (fps * 2) === 0 });
    kare.close();
    while (enc.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 4));
    if (i % 5 === 0) { ilerleme(i / N); await new Promise(r => setTimeout(r, 0)); }
  }
  await enc.flush();
  if (hata) throw hata;
  muxer.finalize();
  ilerleme(1);
  return new File([muxer.target.buffer], dosyaAdi + '.mp4', { type: 'video/mp4' });
}

async function kaydedici(anim, c, g, dosyaAdi, ilerleme, fps) {
  const tur = ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find(x => MediaRecorder.isTypeSupported(x));
  const akis = c.captureStream(fps);
  const kayit = new MediaRecorder(akis, { mimeType: tur, videoBitsPerSecond: 7_000_000 });
  const parcalar = [];
  kayit.ondataavailable = e => e.data.size && parcalar.push(e.data);
  const bitti = new Promise(ok => { kayit.onstop = ok; });
  anim.ciz(g, 0);
  kayit.start(250);
  const bas = performance.now();
  await new Promise(ok => {
    const adim = () => {
      const t = (performance.now() - bas) / 1000;
      anim.ciz(g, Math.min(t, anim.sure));
      ilerleme(t / anim.sure);
      if (t < anim.sure) requestAnimationFrame(adim); else ok();
    };
    requestAnimationFrame(adim);
  });
  kayit.stop(); await bitti;
  const uzanti = tur.includes('mp4') ? 'mp4' : 'webm';
  return new File(parcalar, `${dosyaAdi}.${uzanti}`, { type: tur.split(';')[0] });
}

// ---------------------------------------------------------------- paylaşım metni
const ETIKETLER = [
  [/çanta|cüzdan/i, ['#kağıtipçanta', '#örgüçanta', '#elyapımıçanta', '#çantamodelleri']],
  [/nakış|işleme/i, ['#nakış', '#isimnakışı', '#kişiyeözel', '#nakışmakinesi', '#hediye']],
  [/bebek|havlu/i, ['#bebekhediyesi', '#bebekodası', '#isimlihavlu']],
  [/paça|tadilat/i, ['#terzi', '#paçakısaltma', '#tadilat']],
  [/elbise|dikim|abiye/i, ['#elbisedikimi', '#terzi', '#özeldikim', '#abiye']],
];
export const OZELLIK_ONERI = [
  [/çanta/i, ['Kağıt ipten el örgüsü', 'Hafif ve dayanıklı', 'Renk seçeneği mevcut']],
  [/nakış/i, ['İsme / tarihe özel nakış', 'Hediye için ideal', 'Özenle işlendi']],
  [/paça|tadilat/i, ['Ölçünüze göre', 'Hızlı teslim', 'Özenli dikiş']],
  [/elbise|dikim/i, ['Ölçünüze özel dikim', 'Kumaş seçeneği', 'Özenli işçilik']],
];
export function ozellikOner(kategori = '', ad = '') {
  const m = OZELLIK_ONERI.find(([r]) => r.test(kategori + ' ' + ad));
  return m ? [...m[1]] : ['El yapımı', 'Kişiye özel', 'Özenle hazırlandı'];
}

/** Kategoriye göre 5 hashtag (AI sonucu yokken kullanılır). */
export function etiketlerOner(kategori = '', baslik = '') {
  const etiket = new Set();
  for (const [r, e] of ETIKETLER) if (r.test(kategori + ' ' + baslik)) e.forEach(x => etiket.add(x));
  ['#elyapımı', '#kişiyeözel', '#handmade', '#elemeği'].forEach(x => etiket.add(x));
  return [...etiket].slice(0, 5).join(' ');
}

export function paylasimMetni({ baslik, kategori = '', ozellikler = [], fiyat, instagram, whatsapp, aciklama = '', etiketler = '' }) {
  const etiket = (etiketler || etiketlerOner(kategori, baslik)).split(/\s+/).filter(Boolean)
    .map(x => x.startsWith('#') ? x : '#' + x);
  return [
    `✨ ${baslik} ✨`,
    '',
    aciklama.trim(),
    '',
    ...ozellikler.filter(Boolean).map(o => `🧵 ${o}`),
    fiyat ? `💰 ${fiyat}` : '',
    '',
    `💬 Sipariş ve bilgi için DM${whatsapp ? ` ya da WhatsApp: ${whatsapp}` : ''}`,
    instagram ? `📍 @${instagram.replace(/^@/, '')}` : '',
    '',
    [...etiket].join(' '),
  ].filter((x, i, a) => !(x === '' && a[i - 1] === '')).join('\n').trim();
}

// ================================================================ UGC (doğal sosyal medya) videosu
// Sosyal medya tarzı: tam ekran fotoğraf/video, yumuşak yaklaşma ve geçişler,
// TikTok tarzı beyaz kutulu altyazılar (kelime kelime), emoji çıkartmaları, üstte hikâye çubukları,
// sonda "Sipariş için DM" kartı. Tek fotoğraf bile farklı kadrajlarla çok çekimli görünür.

export const STILLER = { ugc: 'UGC · doğal, sosyal medya', vitrin: 'Vitrin · logolu, şık' };

export function kancaOner(kategori = '', ad = '') {
  const k = (kategori + ' ' + ad).toLocaleLowerCase('tr');
  const genel = ['Teslim etmeden önce son hali 😍', 'Siparişiniz hazır! ✨', 'Bunu tamamen elle yaptım 🤍'];
  if (/çanta/.test(k)) return ['POV: Hayalindeki çantayı elle örüyorum 🧶', 'Kağıt ipten bir çanta daha bitti 👜', ...genel];
  if (/nakış|havlu|isim/.test(k)) return ['İsme özel nakış böyle yapılıyor 🪡', 'En tatlı hediye hazır 🎁', ...genel];
  if (/paça|tadilat/.test(k)) return ['Paçası kısaldı, tam oturdu ✂️', 'Önce / sonra 👖', ...genel];
  if (/elbise|dikim|abiye/.test(k)) return ['Ölçüye özel diktiğim elbise 👗', 'Provadan önce son dokunuşlar 🪡', ...genel];
  return genel;
}

const EMOJI = ['✨', '🧵', '💖', '🪡', '😍', '🤍'];
// Tek fotoğrafta bile farklı çekimler: [yakınlık, odak x, odak y]
// yakınlık en fazla %28: ürün kadrajdan taşmasın
const KADRAJ = [[1.04, 0, 0], [1.2, -0.5, -0.3], [1.14, 0.55, 0.35], [1.28, 0.2, -0.55], [1.1, -0.35, 0.5]];
const SEGMENT = 2.4, KAPANIS = 2.8, UGC_GECIS = 0.4;

export class UgcAnimasyon {
  constructor({ fotolar, logo, format = 'dikey', m }) {
    this.f = FORMATLAR[format]; this.W = this.f.w; this.H = this.f.h; this.B = Math.min(this.W, this.H); this.format = format;
    this.fotolar = fotolar; this.logo = logo; this.m = m;
    this.bulanik = fotolar.map(img => bulaniklastir(img, 24));
    // Altyazılar: kanca → özellikler → fiyat
    const yazilar = [m.kanca || 'Teslim etmeden önce son hali 😍', ...(m.ozellikler || []).filter(Boolean)];
    if (m.fiyat) yazilar.push(`Fiyatı: ${m.fiyat} 💸`);
    const n = Math.max(3, fotolar.length, Math.min(yazilar.length, 5));
    this.segmentler = Array.from({ length: n }, (_, i) => ({
      foto: i % fotolar.length,
      kadraj: KADRAJ[(i + Math.floor(i / fotolar.length)) % KADRAJ.length],
      yazi: yazilar[i] || '',
      emoji: EMOJI[(i * 2 + 1) % EMOJI.length],
    }));
    this.sure = n * SEGMENT + KAPANIS;
    // aynı video birden çok çekimde kullanılırsa farklı anlarından başlasın
    const say = {};
    this.segmentler.forEach(sg => { sg.bas = (say[sg.foto] = (say[sg.foto] ?? -1) + 1) * SEGMENT; });
  }
  /** t anında gereken video kaynakları ve videonun içindeki zamanı */
  kaynakZamani(t) {
    const n = this.segmentler.length, i = Math.min(n - 1, Math.floor(t / SEGMENT)), u = t - i * SEGMENT;
    if (t >= n * SEGMENT) { const s = this.segmentler.at(-1); return [[s.foto, s.bas + SEGMENT]]; }
    const l = [[this.segmentler[i].foto, this.segmentler[i].bas + u]];
    if (i > 0 && u < UGC_GECIS) l.push([this.segmentler[i - 1].foto, this.segmentler[i - 1].bas + SEGMENT + u]);
    return l;
  }

  // Beyaz kutulu altyazı; kelimeler sırayla belirir
  altyazi(g, metin, cy, u) {
    const { W, H, B } = this;
    const boy = B * 0.062;
    g.font = `700 ${boy}px Poppins, "Segoe UI", sans-serif`;
    const satirlar = satirlaraBol(g, metin, Math.min(W * 0.78, H * 0.95), 3);
    const tumKelime = satirlar.join(' ').split(' ').length;
    const gorunen = Math.ceil(tumKelime * kis(u / 0.55));
    let sayac = 0;
    const satirH = boy * 1.32, pad = boy * 0.38;
    let y = cy - (satirlar.length * satirH) / 2;
    for (const s of satirlar) {
      const kel = s.split(' ');
      const goster = kel.slice(0, Math.max(0, gorunen - sayac)).join(' ');
      sayac += kel.length;
      const tamW = g.measureText(s).width;
      if (goster) {
        g.fillStyle = 'rgba(255,255,255,.96)';
        yuvarlakDikdortgen(g, W / 2 - tamW / 2 - pad, y, tamW + pad * 2, satirH, boy * 0.32); g.fill();
        g.fillStyle = '#111'; g.textAlign = 'left'; g.textBaseline = 'middle';
        g.fillText(goster, W / 2 - tamW / 2, y + satirH / 2 + boy * 0.04);
      }
      y += satirH - 2;
    }
  }

  hikayeCubuklari(g, t) {
    const { W, H, B } = this;
    const n = this.segmentler.length + 1, bosluk = B * 0.008, x0 = B * 0.04, gen = (W * 0.92 - bosluk * (n - 1)) / n, y = B * 0.035;
    for (let i = 0; i < n; i++) {
      const bas = i * SEGMENT, sure = i < n - 1 ? SEGMENT : KAPANIS;
      const dolu = kis((t - bas) / sure);
      const x = x0 + i * (gen + bosluk);
      g.fillStyle = 'rgba(255,255,255,.4)'; yuvarlakDikdortgen(g, x, y, gen, B * 0.006, B * 0.003); g.fill();
      if (dolu > 0) { g.fillStyle = '#fff'; yuvarlakDikdortgen(g, x, y, Math.max(B * 0.006, gen * dolu), B * 0.006, B * 0.003); g.fill(); }
    }
  }

  ust(g) { // profil satırı: logo + kullanıcı adı (Instagram hikâyesi gibi)
    const { W, H, B } = this;
    const r = B * 0.04, cx = B * 0.04 + r, cy = B * 0.035 + B * 0.06;
    g.save();
    g.fillStyle = '#fff'; g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.fill();
    if (this.logo) { const s = r * 1.6, h = s * this.logo.height / this.logo.width; g.drawImage(this.logo, cx - s / 2, cy - h / 2, s, h); }
    g.shadowColor = 'rgba(0,0,0,.45)'; g.shadowBlur = 8;
    g.font = `600 ${B * 0.034}px Inter, "Segoe UI", sans-serif`; g.fillStyle = '#fff'; g.textAlign = 'left'; g.textBaseline = 'middle';
    g.fillText(this.m.instagram ? this.m.instagram.replace(/^@/, '') : 'envai_tasarim', cx + r * 1.4, cy);
    g.restore();
  }

  ciz(g, t) {
    const { W, H, B } = this;
    g.save();
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    const n = this.segmentler.length;
    const i = Math.min(n - 1, Math.floor(t / SEGMENT));
    if (t >= n * SEGMENT && t - n * SEGMENT < UGC_GECIS) {   // son çekimden kapanış kartına yumuşak geçiş (boş kare olmasın)
      const u = t - n * SEGMENT;
      this.segment(g, this.segmentler[n - 1], SEGMENT + u, t, n - 1, true);
      g.save(); g.globalAlpha = yumusak(u / UGC_GECIS); this.kapanis(g, u); g.restore();
    } else if (t < n * SEGMENT) {
      const u = t - i * SEGMENT;
      if (i > 0 && u < UGC_GECIS) {          // yumuşak geçiş: önceki çekim altta, yenisi belirerek
        this.segment(g, this.segmentler[i - 1], SEGMENT + u, t, i - 1, true);
        g.save(); g.globalAlpha = yumusak(u / UGC_GECIS);
        this.segment(g, this.segmentler[i], u, t, i);
        g.restore();
      } else this.segment(g, this.segmentler[i], u, t, i);
    }
    else this.kapanis(g, t - n * SEGMENT);
    const gr = g.createLinearGradient(0, 0, 0, H * 0.2); // üst karartma: çubuklar okunsun
    gr.addColorStop(0, 'rgba(0,0,0,.45)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = gr; g.fillRect(0, 0, W, H * 0.2);
    if (!this.durgun && this.format !== 'yatay') this.hikayeCubuklari(g, t);
    this.ust(g);
    g.restore();
  }

  segment(g, s, u, t, i, yaziYok = false) {
    const { W, H, B } = this;
    const img = this.fotolar[s.foto];
    let [z, fx, fy] = s.kadraj;
    if (videoMu(img)) z = 1 + (z - 1) * 0.3;         // video zaten hareketli: hafif kadraj
    const olcek = z + 0.06 * kis(u / SEGMENT);        // sabit, yumuşak yaklaşma (titreme yok)
    g.save();
    kapla(g, this.bulanik[s.foto], -50, -50, W + 100, H + 100, 1.1);
    kapla(g, img, 0, 0, W, H, olcek, fx, fy);
    g.restore();
    if (yaziYok) return;
    if (s.yazi) {   // altyazı alt şeritte: hafif karartma üstünde, ürünün üstüne binmesin
      const ust = H * 0.7, gr = g.createLinearGradient(0, ust, 0, H);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(1, 'rgba(0,0,0,.4)');
      g.fillStyle = gr; g.fillRect(0, ust, W, H - ust);
      this.altyazi(g, s.yazi, H * (this.format === 'dikey' ? 0.8 : this.format === 'yatay' ? 0.84 : 0.83), u - 0.12);
    }
    const e = zipla((u - 0.45) / 0.4);
    if (e > 0) {
      g.save();
      g.translate(i % 2 ? W * 0.8 : W * 0.2, H * 0.55); g.rotate((i % 2 ? 1 : -1) * 0.25); g.scale(e, e);
      g.font = `${B * 0.11}px "Apple Color Emoji", "Segoe UI Emoji", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle';
      g.fillText(s.emoji, 0, 0);
      g.restore();
    }
  }

  kapanis(g, u) {
    const { W, H, B } = this;
    const son = this.segmentler.at(-1);
    g.save();
    kapla(g, this.bulanik[son.foto], -50, -50, W + 100, H + 100, 1.1);
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, 0, W, H);
    const a = yumusak(u / 0.4);
    const kucuk = this.format === 'kare' || this.format === 'yatay';
    const kw = B * (kucuk ? 0.36 : 0.5), kh = kw * 1.2, kx = (W - kw) / 2, ky = H * (kucuk ? 0.1 : 0.2) + (1 - a) * 40;
    g.globalAlpha = a;
    g.save(); g.translate(W / 2, ky + kh / 2); g.rotate(-0.04); g.translate(-W / 2, -(ky + kh / 2));
    g.fillStyle = '#fff'; yuvarlakDikdortgen(g, kx - 14, ky - 14, kw + 28, kh + 28, B * 0.03); g.fill();
    g.save(); yuvarlakDikdortgen(g, kx, ky, kw, kh, B * 0.02); g.clip(); kapla(g, this.fotolar[son.foto], kx, ky, kw, kh, 1.05); g.restore();
    g.restore();
    let y = ky + kh + B * 0.12;
    this.altyazi(g, this.m.cagri || "Sipariş için DM'den yaz 📩", y, u - 0.3);
    y += B * 0.13;
    g.globalAlpha = yumusak((u - 0.9) / 0.4);
    g.font = `600 ${B * 0.042}px Inter, "Segoe UI", sans-serif`; g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
    g.shadowColor = 'rgba(0,0,0,.5)'; g.shadowBlur = 10;
    if (this.m.instagram) { g.fillText('@' + this.m.instagram.replace(/^@/, ''), W / 2, y); y += B * 0.065; }
    if (this.m.whatsapp) g.fillText('WhatsApp ' + this.m.whatsapp, W / 2, y);
    g.restore();
  }
}

/** Stile göre animasyon nesnesi */
export function animasyonOlustur(stil, opt) {
  return stil === 'vitrin' ? new Animasyon(opt) : new UgcAnimasyon(opt);
}

// ================================================================ ürün görselleri (fotoğraf seti)
const GIRIS_S = 2.2, FOTO_S = 3.2;
/** Fotoğraflardan paylaşıma hazır görseller: her fotoğraf için logolu vitrin kartı +
 *  farklı kadrajlarda (genel, yakın plan, detay) UGC tarzı yazılı kareler. */
export async function gorselSetiUret({ fotolar, logo, formatlar, tema, m, adOnek }, ilerleme = () => { }) {
  const sonuc = [];
  const isler = [];
  for (const format of formatlar) {
    const v = new Animasyon({ fotolar, logo, format, tema, m });
    fotolar.forEach((_, k) => isler.push({ anim: v, t: GIRIS_S + k * FOTO_S + 2.4, ad: `${adOnek}-${format}-vitrin-${k + 1}` }));
    const u = new UgcAnimasyon({ fotolar, logo, format, m });
    u.durgun = true;
    u.segmentler.forEach((_, i) => isler.push({ anim: u, t: i * 2.4 + 1.9, ad: `${adOnek}-${format}-kadraj-${i + 1}` }));
  }
  for (const [n, is] of isler.entries()) {
    const c = document.createElement('canvas');
    c.width = is.anim.W; c.height = is.anim.H;
    await kaynaklariHazirla(is.anim, is.t);
    is.anim.ciz(c.getContext('2d', { alpha: false }), is.t);
    const blob = await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.9));
    sonuc.push(new File([blob], is.ad + '.jpg', { type: 'image/jpeg' }));
    ilerleme((n + 1) / isler.length);
    await new Promise(r => setTimeout(r, 0));
  }
  return sonuc;
}
