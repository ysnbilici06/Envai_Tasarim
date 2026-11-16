// Tüm hesaplamalar burada: malzeme birim fiyatı, ürün maliyeti/kârı, satış kazancı.

const f0 = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 });
const f2 = new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY', minimumFractionDigits: 2, maximumFractionDigits: 2 });
const n2 = new Intl.NumberFormat('tr-TR', { maximumFractionDigits: 2 });

export function para(n) {
  n = Math.round((Number(n) || 0) * 100) / 100;
  return (Number.isInteger(n) ? f0 : f2).format(n);
}
export const sayi = n => n2.format(Number(n) || 0);
export const yuzde = n => '%' + n2.format(Math.round((Number(n) || 0) * 10) / 10);

/** "1.250,50" / "1250.5" / "12,5" → sayı */
export function oku(v) {
  let s = String(v ?? '').trim().replace(/\s|₺|%/g, '');
  if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
  else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');   // "1.000" / "12.500" = binlik ayraç
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}
/** Sayıyı input içine yazmak için: 12.5 → "12,5", 0 → "" */
export const yaz = n => (Number(n) ? String(Math.round(n * 10000) / 10000).replace('.', ',') : '');

export function birimFiyat(m) {
  return m && m.paketMiktar > 0 ? (m.paketFiyat || 0) / m.paketMiktar : 0;
}

/** Fiyatı yukarı doğru güzel bir sayıya yuvarlar (5 / 10 TL katları). */
export function yuvarlaFiyat(n) {
  if (n <= 0) return 0;
  const adim = n < 100 ? 5 : 10;
  return Math.ceil(n / adim) * adim;
}

/**
 * Ürünün maliyet dökümü.
 *  gider   = malzeme + fire + diğer giderler (cebinizden çıkan para)
 *  toplam  = gider + işçilik (emeğinizin karşılığı)
 *  cep     = satış − gider  → "Kazanç": cebe kalan para
 *  kar     = satış − toplam → emek ücreti (ayarlardaki saat ücreti) çıktıktan sonra kalan
 *  marj    = kazanç / satış fiyatı
 */
export function urunHesap(u, st) {
  const satirlar = [];
  let malzeme = 0, eksik = 0;
  for (const k of u.kalemler || []) {
    const m = st.malzemeler[k.malzemeId];
    if (!m) eksik++;
    const bf = birimFiyat(m);
    const tutar = bf * (k.miktar || 0);
    malzeme += tutar;
    satirlar.push({ ...k, m, bf, tutar });
  }
  const fire = malzeme * (u.fire || 0) / 100;
  const ek = (u.ekGiderler || []).reduce((t, e) => t + (e.tutar || 0), 0);
  // Nakış: 1000 dikiş başına maliyet (iplik, tela, makine aşınması) — Ayarlar'dan
  const nakis = (u.nakis?.dikis || 0) / 1000 * (st.ayar.dikisFiyati || 0);
  const saatUcreti = st.ayar.saatUcreti || 0;
  const iscilik = (u.iscilikSaat || 0) * saatUcreti;
  const gider = malzeme + fire + ek + nakis;
  const toplam = gider + iscilik;
  const fiyat = u.satisFiyati || 0;
  const kar = fiyat - toplam;
  const hedef = st.ayar.hedefKar ?? 50;
  return {
    satirlar, malzeme, fire, ek, nakis, iscilik, saatUcreti, gider, toplam, fiyat, eksik,
    cep: fiyat - gider,
    kar,
    marj: fiyat > 0 ? (fiyat - gider) / fiyat * 100 : 0,
    saatlik: u.iscilikSaat > 0 ? (fiyat - gider) / u.iscilikSaat : 0,
    hedef,
    onerilen: yuvarlaFiyat(toplam * (1 + hedef / 100)),
  };
}

export function satisHesap(s) {
  const adet = s.adet || 0;
  const ciro = adet * (s.birimFiyat || 0);
  const gider = adet * (s.maliyet || 0);
  return { ciro, gider, kazanc: ciro - gider, iscilik: adet * (s.iscilik || 0) };
}

export function bugun() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export const ayAnahtar = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
export const ayAdi = d => `${AYLAR[d.getMonth()]} ${d.getFullYear()}`;
export function tarihYaz(s) {
  if (!s) return '';
  const [y, m, g] = s.split('-').map(Number);
  return `${g} ${AYLAR[m - 1]}${y !== new Date().getFullYear() ? ' ' + y : ''}`;
}
