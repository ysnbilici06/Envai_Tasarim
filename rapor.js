// Raporlama: iş takvimi süreleri, satış başına kâr/zarar analizi, dönem raporu
// (gelir tablosu + iş / kategori / malzeme / ay bazında tablolar) ve PDF üretimi.
import { para, sayi, yuzde, satisHesap, urunHesap, ayAdi } from './hesap.js';

const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const r2 = n => Math.round(n * 100) / 100;
const AYLAR = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const GUNLER = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

// ---------------------------------------------------------------- zaman
/** İş takvimi aşamaları; satış kaydında s.zaman[anahtar] = "YYYY-MM-DDTHH:MM" (yerel saat). */
export const ASAMALAR = [
  ['alindi', 'Sipariş alındı'],
  ['basladi', 'İşleme başlandı'],
  ['bitti', 'İş bitti'],
  ['teslim', 'Teslim edildi'],
];
const iki = n => String(n).padStart(2, '0');
export const yerelTarih = d => `${d.getFullYear()}-${iki(d.getMonth() + 1)}-${iki(d.getDate())}`;
export const simdi = () => { const d = new Date(); return `${yerelTarih(d)}T${iki(d.getHours())}:${iki(d.getMinutes())}`; };
export const saatSimdi = () => { const d = new Date(); return `${iki(d.getHours())}:${iki(d.getMinutes())}`; };

/** "2026-11-16T14:05" → "16 Kasım 2026 14:05" */
export function tarihSaatYaz(v, yilHep = true) {
  if (!v) return '—';
  const [t, s] = v.split('T');
  const [y, m, g] = t.split('-').map(Number);
  const yil = yilHep || y !== new Date().getFullYear() ? ' ' + y : '';
  return `${g} ${AYLAR[m - 1]}${yil}${s ? ' ' + s.slice(0, 5) : ''}`;
}
export function ustTarihSaat(d = new Date()) {
  return { tarih: `${d.getDate()} ${AYLAR[d.getMonth()]} ${d.getFullYear()} ${GUNLER[d.getDay()]}`, saat: `${iki(d.getHours())}:${iki(d.getMinutes())}` };
}

const ms = v => (v ? new Date(v).getTime() : NaN);
const fark = (a, b) => { const x = ms(b) - ms(a); return Number.isFinite(x) ? x : null; };
/** Aşamalar arası süreler (ms; bilinmiyorsa null). */
export function sureler(s) {
  const z = s.zaman || {};
  return {
    bekleme: fark(z.alindi, z.basladi),          // sipariş → işe başlama
    yapim: fark(z.basladi, z.bitti),             // işe başlama → bitiş
    teslimBekleme: fark(z.bitti, z.teslim),      // bitiş → teslim
    toplam: fark(z.alindi, z.teslim || z.bitti), // sipariş → teslim (yoksa bitiş)
  };
}
/** 93784000 → "1 gün 2 sa 3 dk" (en büyük iki birim) */
export function sureYaz(x) {
  if (x == null) return '—';
  if (x < 0) return 'tarih hatalı';
  const dk = Math.round(x / 60000);
  const g = Math.floor(dk / 1440), s = Math.floor((dk % 1440) / 60), d = dk % 60;
  const p = [];
  if (g) p.push(`${g} gün`);
  if (s) p.push(`${s} sa`);
  if (d && !g) p.push(`${d} dk`);
  return p.slice(0, 2).join(' ') || '0 dk';
}
export const saatYaz = h => (h ? `${sayi(r2(h))} sa` : '—');

// ---------------------------------------------------------------- satış analizi
/** İşin 1 adet için maliyet dökümü; satış kaydına anlık görüntü olarak saklanır
 *  (malzeme fiyatı sonradan değişse de geçmiş rapor bozulmaz). */
export function dokumOlustur(u, st) {
  const h = urunHesap(u, st);
  return {
    malzemeler: h.satirlar.map(k => ({
      malzemeId: k.malzemeId, ad: k.m?.ad || 'Silinmiş malzeme', kategori: k.m?.kategori || '',
      birim: k.m?.birim || '', miktar: k.miktar || 0, birimFiyat: r2(k.bf * 10000) / 10000, tutar: r2(k.tutar),
    })),
    fire: r2(h.fire),
    ekGiderler: [...(u.ekGiderler || []).map(e => ({ ad: e.ad || 'Gider', tutar: e.tutar || 0 })),
      ...(h.nakis ? [{ ad: `Nakış (${u.nakis.dikis.toLocaleString('tr-TR')} dikiş)`, tutar: Math.round(h.nakis * 100) / 100 }] : [])],
  };
}
const dokumBul = (s, st) => s.dokum || (s.urunId && st.urunler[s.urunId] ? dokumOlustur(st.urunler[s.urunId], st) : null);

/** Bir satışın fiyat ve zaman açısından tam kâr/zarar dökümü. */
export function satisAnaliz(s, st) {
  const h = satisHesap(s);
  const adet = s.adet || 0;
  const d = dokumBul(s, st);
  const u = s.urunId ? st.urunler[s.urunId] : null;
  const malzeme = d ? d.malzemeler.reduce((t, m) => t + m.tutar, 0) * adet : 0;
  const fire = d ? d.fire * adet : 0;
  const diger = h.gider - malzeme - fire; // ek giderler + elle yapılan düzeltme
  const saat = Number.isFinite(s.calismaSaat) ? s.calismaSaat : (u ? (u.iscilikSaat || 0) * adet : 0);
  const planSaat = u && u.iscilikSaat ? u.iscilikSaat * adet : null;
  const saatUcreti = st.ayar.saatUcreti || 0;
  const emek = saat * saatUcreti;
  return {
    ...h, adet, dokum: d, malzeme, fire, diger, saat, planSaat, saatUcreti, emek,
    net: h.kazanc - emek,
    marj: h.ciro > 0 ? h.kazanc / h.ciro * 100 : 0,
    saatlik: saat > 0 ? h.kazanc / saat : 0,
    listeFiyat: u ? u.satisFiyati || 0 : null,
    sure: sureler(s),
  };
}

// ---------------------------------------------------------------- dönem raporu
export const DONEMLER = [['buay', 'Bu ay'], ['gecenay', 'Geçen ay'], ['son3', 'Son 3 ay'], ['buyil', 'Bu yıl'], ['tumu', 'Tümü'], ['ozel', 'Tarih seç']];
export function donemAraligi(d) {
  const b = new Date(), y = b.getFullYear(), m = b.getMonth();
  const ayIlk = (yy, mm) => yerelTarih(new Date(yy, mm, 1));
  const aySon = (yy, mm) => yerelTarih(new Date(yy, mm + 1, 0));
  switch (d.donem) {
    case 'gecenay': return [ayIlk(y, m - 1), aySon(y, m - 1), ayAdi(new Date(y, m - 1, 1))];
    case 'son3': return [ayIlk(y, m - 2), aySon(y, m), `${ayAdi(new Date(y, m - 2, 1))} – ${ayAdi(b)}`];
    case 'buyil': return [`${y}-01-01`, `${y}-12-31`, `${y} yılı`];
    case 'tumu': return ['0000-01-01', '9999-12-31', 'Tüm zamanlar'];
    case 'ozel': {
      let bas = d.bas || ayIlk(y, m), bit = d.bit || aySon(y, m);
      if (bas > bit) [bas, bit] = [bit, bas];   // ters girilen aralık düzeltilir
      return [bas, bit, `${tarihSaatYaz(bas)} – ${tarihSaatYaz(bit)}`];
    }
    default: return [ayIlk(y, m), aySon(y, m), ayAdi(b)];
  }
}

export function raporHesap(st, bas, bit) {
  const hepsi = Object.values(st.satislar).filter(s => s.tarih && s.tarih >= bas && s.tarih <= bit);
  const liste = hepsi.filter(s => s.durum !== 'iptal');
  const T = { ciro: 0, malzeme: 0, fire: 0, diger: 0, gider: 0, kazanc: 0, emek: 0, net: 0, saat: 0, adet: 0 };
  const isler = {}, katlar = {}, malzemeler = {}, aylar = {};
  const topla = (o, a) => { o.adet += a.adet; o.ciro += a.ciro; o.gider += a.gider; o.kazanc += a.kazanc; o.saat += a.saat; o.net += a.net; };
  const yeni = ek => ({ adet: 0, ciro: 0, gider: 0, kazanc: 0, saat: 0, net: 0, satis: 0, yapim: 0, yapimSay: 0, ...ek });
  for (const s of liste) {
    const a = satisAnaliz(s, st);
    for (const k of Object.keys(T)) T[k] += a[k] || 0;
    const ik = s.urunId || 'ozel:' + (s.urunAd || 'Özel iş');
    const is = (isler[ik] ||= yeni({ ad: s.urunAd || 'Özel iş', kategori: s.kategori || '' }));
    topla(is, a); is.satis++;
    if (a.sure.yapim != null && a.sure.yapim >= 0) { is.yapim += a.sure.yapim; is.yapimSay++; }
    topla((katlar[s.kategori || 'Kategorisiz'] ||= yeni({ ad: s.kategori || 'Kategorisiz' })), a);
    const ay = s.tarih.slice(0, 7);
    const ao = (aylar[ay] ||= yeni({ ad: ay })); topla(ao, a); ao.satis++;
    for (const m of a.dokum?.malzemeler || []) {
      const mo = (malzemeler[m.malzemeId || m.ad] ||= { ad: m.ad, kategori: m.kategori, birim: m.birim, miktar: 0, tutar: 0, isler: new Set() });
      mo.miktar += m.miktar * a.adet; mo.tutar += m.tutar * a.adet; mo.isler.add(s.urunAd);
    }
  }
  const marjEkle = o => ({ ...o, marj: o.ciro > 0 ? o.kazanc / o.ciro * 100 : 0, saatlik: o.saat > 0 ? o.kazanc / o.saat : 0 });
  return {
    bas, bit, T: marjEkle(T), satisSay: liste.length,
    iptal: hepsi.length - liste.length,
    acik: liste.filter(s => ['siparis', 'yapiliyor', 'hazir'].includes(s.durum)),
    isler: Object.values(isler).map(marjEkle).sort((a, b) => b.kazanc - a.kazanc),
    katlar: Object.values(katlar).map(marjEkle).sort((a, b) => b.kazanc - a.kazanc),
    malzemeler: Object.values(malzemeler).sort((a, b) => b.tutar - a.tutar),
    aylar: Object.values(aylar).map(marjEkle).sort((a, b) => a.ad.localeCompare(b.ad)),
  };
}

// ---------------------------------------------------------------- tablolar (ekran + PDF ortak)
const kz = n => `<span class="${n < 0 ? 'negatif' : 'pozitif'}">${para(n)}</span>`;
const ayYaz = a => { const [y, m] = a.split('-').map(Number); return `${AYLAR[m - 1]} ${y}`; };

export function raporTablolari(r) {
  const T = r.T;
  const s = (ad, deger, cls = '') => `<tr class="${cls}"><td>${ad}</td><td class="sayi">${deger}</td></tr>`;
  const gelir = `
  <table class="tablo gelir-tablosu">
    <thead><tr><th>Kalem</th><th class="sayi">Tutar</th></tr></thead>
    <tbody>
    ${s(`Satış geliri <small>(${r.satisSay} satış, ${sayi(T.adet)} adet)</small>`, para(T.ciro), 'kalin')}
    ${s('− Malzeme gideri', para(T.malzeme))}
    ${T.fire ? s('− Fire', para(T.fire)) : ''}
    ${s('− Diğer giderler <small>(ambalaj, kargo, özel iş giderleri…)</small>', para(T.diger))}
    ${s('Toplam gider', para(T.gider), 'ara')}
    ${s('Brüt kâr <small>(cebe kalan)</small>', kz(T.kazanc), 'kalin')}
    ${s('Kâr marjı', T.ciro ? yuzde(T.marj) : '—')}
    ${T.saat ? s('Harcanan emek', saatYaz(T.saat)) : ''}
    ${T.saat ? s('Saat başına kazanç', para(T.saatlik)) : ''}
    ${T.emek ? s('− Emek ücreti <small>(saat ücreti × harcanan saat)</small>', para(T.emek)) : ''}
    ${T.emek ? s('Net kâr <small>(emek ücreti çıktıktan sonra)</small>', kz(T.net), 'kalin') : ''}
    </tbody>
  </table>
  ${r.iptal || r.acik.length ? `<p class="ipucu">${r.acik.length ? `${r.acik.length} sipariş henüz teslim edilmedi (${para(r.acik.reduce((t, x) => t + satisHesap(x).ciro, 0))}); tabloya dahildir. ` : ''}${r.iptal ? `${r.iptal} iptal edilen satış hesaba katılmadı.` : ''}</p>` : ''}`;

  const isTablo = r.isler.length ? `
  <h3>İş bazında kâr / zarar</h3>
  <div class="tablo-kap"><table class="tablo">
    <thead><tr><th>İş</th><th class="sayi">Adet</th><th class="sayi">Gelir</th><th class="sayi">Gider</th><th class="sayi">Kâr / zarar</th><th class="sayi">Marj</th><th class="sayi">Emek</th><th class="sayi">₺ / saat</th><th class="sayi">Ort. yapım</th></tr></thead>
    <tbody>${r.isler.map(i => `<tr><td><b>${esc(i.ad)}</b>${i.kategori ? `<br><small>${esc(i.kategori)}</small>` : ''}</td>
      <td class="sayi">${sayi(i.adet)}</td><td class="sayi">${para(i.ciro)}</td><td class="sayi">${para(i.gider)}</td>
      <td class="sayi"><b>${kz(i.kazanc)}</b></td><td class="sayi">${yuzde(i.marj)}</td><td class="sayi">${saatYaz(i.saat)}</td>
      <td class="sayi">${i.saat ? para(i.saatlik) : '—'}</td><td class="sayi">${i.yapimSay ? sureYaz(i.yapim / i.yapimSay) : '—'}</td></tr>`).join('')}
    </tbody>
    <tfoot><tr><td>Toplam</td><td class="sayi">${sayi(T.adet)}</td><td class="sayi">${para(T.ciro)}</td><td class="sayi">${para(T.gider)}</td><td class="sayi">${kz(T.kazanc)}</td><td class="sayi">${T.ciro ? yuzde(T.marj) : '—'}</td><td class="sayi">${saatYaz(T.saat)}</td><td class="sayi">${T.saat ? para(T.saatlik) : '—'}</td><td></td></tr></tfoot>
  </table></div>` : '';

  const katTablo = r.katlar.length > 1 ? `
  <h3>Kategori bazında</h3>
  <div class="tablo-kap"><table class="tablo">
    <thead><tr><th>Kategori</th><th class="sayi">Adet</th><th class="sayi">Gelir</th><th class="sayi">Gider</th><th class="sayi">Kâr / zarar</th><th class="sayi">Marj</th><th class="sayi">Kârdaki payı</th></tr></thead>
    <tbody>${r.katlar.map(k => `<tr><td><b>${esc(k.ad)}</b></td><td class="sayi">${sayi(k.adet)}</td><td class="sayi">${para(k.ciro)}</td><td class="sayi">${para(k.gider)}</td>
      <td class="sayi"><b>${kz(k.kazanc)}</b></td><td class="sayi">${yuzde(k.marj)}</td><td class="sayi">${T.kazanc > 0 ? yuzde(k.kazanc / T.kazanc * 100) : '—'}</td></tr>`).join('')}</tbody>
  </table></div>` : '';

  const malzToplam = r.malzemeler.reduce((t, m) => t + m.tutar, 0);
  const malzTablo = r.malzemeler.length ? `
  <h3>Malzeme gideri</h3>
  <div class="tablo-kap"><table class="tablo">
    <thead><tr><th>Malzeme</th><th class="sayi">Kullanılan</th><th class="sayi">Tutar</th><th class="sayi">Payı</th><th>Kullanıldığı işler</th></tr></thead>
    <tbody>${r.malzemeler.map(m => `<tr><td><b>${esc(m.ad)}</b>${m.kategori ? `<br><small>${esc(m.kategori)}</small>` : ''}</td>
      <td class="sayi">${sayi(r2(m.miktar))} ${esc(m.birim)}</td><td class="sayi">${para(m.tutar)}</td>
      <td class="sayi">${malzToplam ? yuzde(m.tutar / malzToplam * 100) : '—'}</td><td><small>${[...m.isler].map(esc).join(', ')}</small></td></tr>`).join('')}</tbody>
    <tfoot><tr><td>Toplam malzeme</td><td></td><td class="sayi">${para(malzToplam)}</td><td></td><td></td></tr></tfoot>
  </table></div>` : '';

  const ayTablo = r.aylar.length > 1 ? `
  <h3>Aylara göre</h3>
  <div class="tablo-kap"><table class="tablo">
    <thead><tr><th>Ay</th><th class="sayi">Satış</th><th class="sayi">Gelir</th><th class="sayi">Gider</th><th class="sayi">Kâr / zarar</th><th class="sayi">Marj</th></tr></thead>
    <tbody>${r.aylar.map(a => `<tr><td><b>${ayYaz(a.ad)}</b></td><td class="sayi">${a.satis}</td><td class="sayi">${para(a.ciro)}</td><td class="sayi">${para(a.gider)}</td>
      <td class="sayi"><b>${kz(a.kazanc)}</b></td><td class="sayi">${yuzde(a.marj)}</td></tr>`).join('')}</tbody>
  </table></div>` : '';

  return { gelir, isTablo, katTablo, malzTablo, ayTablo };
}

// ---------------------------------------------------------------- PDF
const PDF_CSS = `
.rp { width: 794px; padding: 0 44px; box-sizing: border-box; background: transparent; color: #1c1a3a;
  font: 12.5px/1.4 "Inter", "Segoe UI", -apple-system, Helvetica, Arial, sans-serif; font-variant-numeric: normal; }
.rp * { box-sizing: border-box; font-variant-numeric: normal !important; letter-spacing: normal; }
.rp .rp-ust { display: flex; justify-content: space-between; align-items: flex-end; gap: 20px; padding: 4px 0 12px; border-bottom: 3px solid #1b2b52; margin-bottom: 14px; }
.rp .rp-tur { font-size: 10.5px; font-weight: 700; letter-spacing: 1.4px; color: #6d3fe0; text-transform: uppercase; }
.rp .rp-ust h1 { font-size: 22px; margin: 2px 0; line-height: 1.2; color: #1c1a3a; }
.rp .rp-alt { color: #6b6f8c; font-size: 12px; }
.rp .rp-sag { text-align: right; color: #6b6f8c; font-size: 11px; flex-shrink: 0; }
.rp .rp-sag b { display: block; color: #1b2b52; font-size: 15px; }
.rp .rp-logo { display: block; width: 58px; height: auto; margin: 0 0 4px auto; }
.rp h3 { font-size: 14px; margin: 16px 0 6px; padding-left: 8px; border-left: 4px solid #6d3fe0; color: #1c1a3a; }
.rp .rp-kartlar { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.rp .rp-kartlar.bes { grid-template-columns: repeat(5, 1fr); }
.rp .rp-kartcik { border: 1px solid #e2e5f0; border-radius: 9px; padding: 8px 11px; }
.rp .rp-kartcik .e { font-size: 10.5px; color: #6b6f8c; }
.rp .rp-kartcik .d { font-size: 16px; font-weight: 700; margin-top: 1px; }
.rp .tablo { width: 100%; border-collapse: collapse; font-size: 11.5px; }
.rp .tablo th { background: #f1effc; color: #4b3a8c; text-align: left; font-weight: 700; padding: 5px 7px; font-size: 10.5px; border: none; white-space: nowrap; }
.rp .tablo td { padding: 4px 7px; border-bottom: 1px solid #eceef6; vertical-align: top; }
.rp .tablo tfoot td { font-weight: 700; border-top: 2px solid #1c1a3a; border-bottom: none; }
.rp .tablo .sayi { text-align: right; white-space: nowrap; }
.rp .tablo small { color: #6b6f8c; font-weight: 400; font-size: 10.5px; }
.rp .tablo tr.kalin td { font-weight: 700; font-size: 12.5px; }
.rp .tablo tr.ara td { border-top: 1.5px solid #1c1a3a; font-weight: 600; }
.rp .gelir-tablosu { max-width: 520px; }
.rp .tablo-kap { margin: 0; overflow: visible; }
.rp .pozitif { color: #13824b; } .rp .negatif { color: #c62f3a; }
.rp .ipucu { color: #6b6f8c; font-size: 11px; margin: 5px 0 0; }
.rp .rp-sonuc { margin-top: 14px; padding: 11px 14px; border-radius: 9px; font-size: 13px; background: #eaf7f0; color: #0f5c35; }
.rp .rp-sonuc.zarar { background: #fdecee; color: #8f1f29; }
.rp .rp-iki { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.rp .rp-fiyat { display: grid; grid-template-columns: 1fr 300px; gap: 16px; align-items: start; }
.rp .rp-not { background: #f6f7fb; border-radius: 8px; padding: 8px 11px; white-space: pre-wrap; margin: 0; }
`;

function scriptYukle(src) {
  return new Promise((ok, hata) => {
    if (document.querySelector(`script[src="${src}"]`)) return ok();
    const s = document.createElement('script');
    s.src = src; s.onload = ok; s.onerror = () => hata(new Error(src + ' yüklenemedi'));
    document.head.append(s);
  });
}

const FILIGRAN = 'logo/envai-amblem.png';
const resimYukle = src => new Promise((ok, hata) => { const r = new Image(); r.onload = () => ok(r); r.onerror = hata; r.src = src; });

/** HTML'yi A4 sayfalarına bölüp PDF dosyası (File) döndürür. Satırlar ortadan kesilmez;
 *  her sayfanın ortasında soluk logo filigranı bulunur. */
export async function pdfUret(govdeHtml, dosyaAdi) {
  await Promise.all([scriptYukle('lib/jspdf.umd.min.js'), scriptYukle('lib/html2canvas.min.js')]);
  await document.fonts?.ready;
  const kap = document.createElement('div');
  kap.style.cssText = 'position:fixed;left:-10000px;top:0;z-index:-1;';
  kap.innerHTML = `<style>${PDF_CSS}</style><div class="rp">${govdeHtml}</div>`;
  document.body.append(kap);
  try {
    const rp = kap.querySelector('.rp');
    // görseller (logo) yüklenmeden ölçülürse sayfa yüksekliği eksik çıkar, alt kısım kesilir
    await Promise.all([...rp.querySelectorAll('img')].map(i => i.complete ? null : new Promise(ok => { i.onload = i.onerror = ok; })));
    // html2canvas büyük harfe Türkçe kuralla çevirmez ("SIPARIŞ"): metni kendimiz çevirelim
    for (const el of rp.querySelectorAll('*')) {
      if (getComputedStyle(el).textTransform !== 'uppercase') continue;
      el.style.textTransform = 'none';
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n; (n = w.nextNode());) n.nodeValue = n.nodeValue.toLocaleUpperCase('tr');
    }
    const OLCEK = 2, SAYFA_W = 794, SAYFA_H = 1123, UST = 40, ALT = 52;
    const kullanilir = SAYFA_H - UST - ALT;
    const top0 = rp.getBoundingClientRect().top;
    const sinirlar = [...rp.querySelectorAll('tr, h3, .rp-blok, .rp-ust, .rp-sonuc, .rp-kartlar, p')]
      .map(e => Math.ceil(e.getBoundingClientRect().bottom - top0)).sort((a, b) => a - b);
    const toplamH = Math.ceil(rp.scrollHeight);
    // Saydam zeminle çiz: logo filigranı yazıların arkasında kalsın
    const [canvas, filigran] = await Promise.all([
      window.html2canvas(rp, { scale: OLCEK, backgroundColor: null, logging: false, useCORS: true }),
      resimYukle(FILIGRAN).catch(() => null),
    ]);
    // Sayfa kesim noktaları: sayfaya sığan en alttaki eleman sınırı
    const kesimler = [0];
    while (kesimler.at(-1) + kullanilir < toplamH) {
      const bas = kesimler.at(-1);
      const uygun = sinirlar.filter(y => y > bas + 80 && y <= bas + kullanilir);
      kesimler.push(uygun.length ? uygun.at(-1) : bas + kullanilir);
    }
    kesimler.push(toplamH);
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({ unit: 'mm', format: 'a4', compress: true });
    const mm = px => px * 210 / SAYFA_W;
    const sayfaSay = kesimler.length - 1;
    const gorseller = [];   // aynı sayfalar JPG olarak (Instagram DM PDF kabul etmiyor)
    for (let i = 0; i < sayfaSay; i++) {
      const y0 = kesimler[i], h = kesimler[i + 1] - y0;
      const c = document.createElement('canvas');
      c.width = SAYFA_W * OLCEK; c.height = SAYFA_H * OLCEK;
      const g = c.getContext('2d');
      g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height);
      if (filigran) { // sayfanın ortasında soluk logo
        const fw = c.width * 0.62, fh = fw * filigran.naturalHeight / filigran.naturalWidth;
        g.globalAlpha = 0.07;
        g.drawImage(filigran, (c.width - fw) / 2, (c.height - fh) / 2 + 20 * OLCEK, fw, fh);
        g.globalAlpha = 1;
      }
      g.drawImage(canvas, 0, y0 * OLCEK, canvas.width, h * OLCEK, 0, UST * OLCEK, canvas.width, h * OLCEK);
      if (i) pdf.addPage();
      pdf.addImage(c.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, 210, 297);
      // Görsel sürüm: sayfanın boş alt kısmı kırpılır (telefonda sohbet içinde daha büyük görünür)
      const k = document.createElement('canvas');
      k.width = c.width; k.height = Math.min(c.height, (UST + h + 36) * OLCEK);
      k.getContext('2d').drawImage(c, 0, 0);
      gorseller.push(await new Promise(ok => k.toBlob(ok, 'image/jpeg', 0.92)));
      k.width = k.height = 0;
      pdf.setFontSize(8); pdf.setTextColor(150);
      pdf.text(`EnvaiTasarim  -  ${i + 1} / ${sayfaSay}`, 105, 297 - mm(22), { align: 'center' });
    }
    const blob = pdf.output('blob');
    const dosya = new File([blob], dosyaAdi, { type: 'application/pdf' });
    const kok = dosyaAdi.replace(/\.pdf$/i, '');
    dosya.gorseller = gorseller.filter(Boolean).map((b, i, l) => new File([b], `${kok}${l.length > 1 ? '-' + (i + 1) : ''}.jpg`, { type: 'image/jpeg' }));
    return dosya;
  } finally { kap.remove(); }
}

const olusturma = () => { const t = ustTarihSaat(); return `${t.tarih} · ${t.saat}`; };
const dosyaAdiTemizle = s => s.replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-').slice(0, 60);

/** Tek bir iş (satış/sipariş) için zamansal + fiyatsal kâr/zarar raporu. */
export function isRaporuPdf(s, st, durumAd) {
  const a = satisAnaliz(s, st);
  const z = s.zaman || {};
  const kart = (e, d, cls = '') => `<div class="rp-kartcik"><div class="e">${e}</div><div class="d ${cls}">${d}</div></div>`;
  // Zaman çizelgesi
  let onceki = null;
  const zamanSatir = ASAMALAR.map(([k, ad]) => {
    const v = z[k];
    const ara = v && onceki ? sureYaz(fark(onceki, v)) : '—';
    if (v) onceki = v;
    return `<tr><td><b>${ad}</b></td><td>${tarihSaatYaz(v)}</td><td class="sayi">${k === 'alindi' ? '' : ara}</td></tr>`;
  }).join('');
  // Zamansal kâr/zarar
  const zs = [];
  zs.push(['Harcanan emek', saatYaz(a.saat)]);
  if (a.planSaat != null) {
    const f = a.saat - a.planSaat;
    zs.push(['Planlanan emek <small>(iş kartındaki süre × adet)</small>', saatYaz(a.planSaat)]);
    zs.push([f > 0 ? 'Plandan fazla çalışıldı' : f < 0 ? 'Plandan erken bitti' : 'Plan farkı',
      f ? `<span class="${f > 0 ? 'negatif' : 'pozitif'}">${f > 0 ? '+' : '−'}${sayi(r2(Math.abs(f)))} sa</span>` : 'plana uygun']);
    if (f && a.saatUcreti) zs.push([f > 0 ? 'Zaman kaybının bedeli' : 'Zaman kazancının bedeli',
      `<span class="${f > 0 ? 'negatif' : 'pozitif'}">${para(Math.abs(f) * a.saatUcreti)}</span>`]);
  }
  zs.push(['Saat başına kazanç', a.saat ? `<b>${para(a.saatlik)}</b>` : '—']);
  if (a.planSaat && a.saat) zs.push(['Planlanan saat başına kazanç', para(a.kazanc / a.planSaat)]);
  if (a.sure.bekleme != null) zs.push(['Sipariş → işe başlama', sureYaz(a.sure.bekleme)]);
  if (a.sure.yapim != null) zs.push(['İşe başlama → bitiş <small>(takvim süresi)</small>', sureYaz(a.sure.yapim)]);
  if (a.sure.teslimBekleme != null) zs.push(['Bitiş → teslim', sureYaz(a.sure.teslimBekleme)]);
  if (a.sure.toplam != null) zs.push(['<b>Toplam süre</b> <small>(sipariş → ' + (z.teslim ? 'teslim' : 'bitiş') + ')</small>', `<b>${sureYaz(a.sure.toplam)}</b>`]);
  // Fiyatsal döküm
  const d = a.dokum;
  const fiyatSatir = [];
  for (const m of d?.malzemeler || []) fiyatSatir.push(`<tr><td>${esc(m.ad)}</td><td class="sayi">${sayi(r2(m.miktar * a.adet))} ${esc(m.birim)}</td><td class="sayi">${para(m.birimFiyat)}</td><td class="sayi">${para(m.tutar * a.adet)}</td></tr>`);
  if (a.fire) fiyatSatir.push(`<tr><td>Fire payı</td><td></td><td></td><td class="sayi">${para(a.fire)}</td></tr>`);
  const ekler = d?.ekGiderler || [];
  for (const e of ekler) fiyatSatir.push(`<tr><td>${esc(e.ad)}</td><td class="sayi">${sayi(a.adet)} adet</td><td class="sayi">${para(e.tutar)}</td><td class="sayi">${para(e.tutar * a.adet)}</td></tr>`);
  const ekToplam = ekler.reduce((t, e) => t + e.tutar, 0) * a.adet;
  const duzeltme = r2(a.diger - ekToplam);
  if (Math.abs(duzeltme) >= 0.01) fiyatSatir.push(`<tr><td>${d ? 'Elle girilen gider farkı' : 'Gider (elle girilen)'}</td><td></td><td></td><td class="sayi">${para(duzeltme)}</td></tr>`);
  const indirim = a.listeFiyat != null && a.listeFiyat && s.birimFiyat !== a.listeFiyat ? (s.birimFiyat - a.listeFiyat) * a.adet : 0;

  const sonucMetin = a.kazanc >= 0
    ? `Bu iş <b>${para(a.kazanc)}</b> kârla kapandı (marj ${yuzde(a.marj)}).${a.saat ? ` Harcanan ${saatYaz(a.saat)} emek için saat başına <b>${para(a.saatlik)}</b> kazandırdı.` : ''}${a.emek ? ` Emek ücreti (${para(a.emek)}) düşülünce net ${a.net >= 0 ? 'kâr' : 'zarar'}: <b>${para(a.net)}</b>.` : ''}`
    : `Bu iş <b>${para(-a.kazanc)}</b> zararla kapandı: giderler satış tutarını aştı.`;

  const govde = `
  <div class="rp-ust"><div><div class="rp-tur">İş raporu · ${esc(durumAd || '')}</div><h1>${esc(s.urunAd || 'Özel iş')}</h1>
    <div class="rp-alt">${[s.kategori, s.musteri && 'Müşteri: ' + s.musteri, `${sayi(a.adet)} adet`, 'Satış tarihi: ' + tarihSaatYaz(s.tarih + (s.saat ? 'T' + s.saat : ''))].filter(Boolean).map(esc).join(' · ')}</div></div>
    <div class="rp-sag"><img class="rp-logo" src="logo/envai-amblem.png" alt=""><b>Envai Tasarım</b>Oluşturma: ${olusturma()}</div></div>
  <div class="rp-kartlar bes">
    ${kart('Satış tutarı', para(a.ciro))}${kart('Toplam gider', para(a.gider))}
    ${kart(a.kazanc < 0 ? 'Zarar' : 'Kâr', para(a.kazanc), a.kazanc < 0 ? 'negatif' : 'pozitif')}
    ${kart('Kâr marjı', a.ciro ? yuzde(a.marj) : '—')}${kart('Saat başına', a.saat ? para(a.saatlik) : '—')}
  </div>
  <div class="rp-iki">
    <div class="rp-blok"><h3>İş takvimi</h3>
      <table class="tablo"><thead><tr><th>Aşama</th><th>Tarih · saat</th><th class="sayi">Geçen süre</th></tr></thead><tbody>${zamanSatir}</tbody></table></div>
    <div class="rp-blok"><h3>Zamansal kâr / zarar</h3>
      <table class="tablo"><tbody>${zs.map(([x, y]) => `<tr><td>${x}</td><td class="sayi">${y}</td></tr>`).join('')}</tbody></table></div>
  </div>
  <h3>Fiyatsal kâr / zarar</h3>
  <div class="rp-fiyat"><table class="tablo">
    <thead><tr><th>Kalem</th><th class="sayi">Miktar</th><th class="sayi">Birim fiyat</th><th class="sayi">Tutar</th></tr></thead>
    <tbody>${fiyatSatir.join('') || '<tr><td colspan="4"><small>Gider kalemi yok</small></td></tr>'}</tbody>
    <tfoot>
      <tr><td>Toplam gider</td><td></td><td></td><td class="sayi">${para(a.gider)}</td></tr>
    </tfoot>
  </table>
  <table class="tablo">
    <tbody>
      ${a.listeFiyat ? `<tr><td>Liste fiyatı</td><td class="sayi">${para(a.listeFiyat)} × ${sayi(a.adet)}</td></tr>` : ''}
      ${indirim ? `<tr><td>${indirim < 0 ? 'Yapılan indirim' : 'Liste fiyatı üstü'}</td><td class="sayi ${indirim < 0 ? 'negatif' : 'pozitif'}">${para(indirim)}</td></tr>` : ''}
      <tr><td>Satış tutarı</td><td class="sayi">${para(a.ciro)}</td></tr>
      <tr><td>− Toplam gider</td><td class="sayi">${para(a.gider)}</td></tr>
      <tr class="kalin"><td>${a.kazanc < 0 ? 'Zarar' : 'Kâr'}</td><td class="sayi ${a.kazanc < 0 ? 'negatif' : 'pozitif'}">${para(a.kazanc)}</td></tr>
      ${a.emek ? `<tr><td>− Emek ücreti <small>(${saatYaz(a.saat)} × ${para(a.saatUcreti)})</small></td><td class="sayi">${para(a.emek)}</td></tr>
      <tr class="kalin"><td>Net kâr</td><td class="sayi ${a.net < 0 ? 'negatif' : 'pozitif'}">${para(a.net)}</td></tr>` : ''}
    </tbody>
  </table></div>
  <div class="rp-sonuc ${a.kazanc < 0 ? 'zarar' : ''}">${sonucMetin}</div>
  ${s.not ? `<h3>Not</h3><p class="rp-not">${esc(s.not)}</p>` : ''}`;
  return pdfUret(govde, `Is-raporu-${dosyaAdiTemizle(s.urunAd || 'ozel-is')}-${s.tarih || ''}.pdf`);
}

/** Dönem finans raporu PDF'i. */
export function donemRaporuPdf(r, baslik, ekHtml = '') {
  const t = raporTablolari(r);
  const T = r.T;
  const kart = (e, d, cls = '') => `<div class="rp-kartcik"><div class="e">${e}</div><div class="d ${cls}">${d}</div></div>`;
  const govde = `
  <div class="rp-ust"><div><div class="rp-tur">Finans raporu</div><h1>${esc(baslik)}</h1>
    <div class="rp-alt">${r.satisSay} satış · ${sayi(T.adet)} adet</div></div>
    <div class="rp-sag"><img class="rp-logo" src="logo/envai-amblem.png" alt=""><b>Envai Tasarım</b>Oluşturma: ${olusturma()}</div></div>
  <div class="rp-kartlar">
    ${kart('Satış geliri', para(T.ciro))}${kart('Toplam gider', para(T.gider))}
    ${kart(T.kazanc < 0 ? 'Zarar' : 'Kâr', para(T.kazanc), T.kazanc < 0 ? 'negatif' : 'pozitif')}${kart('Kâr marjı', T.ciro ? yuzde(T.marj) : '—')}
  </div>
  <h3>Gelir tablosu</h3>${t.gelir}${ekHtml}${t.isTablo}${t.katTablo}${t.malzTablo}${t.ayTablo}`;
  return pdfUret(govde, `Finans-raporu-${dosyaAdiTemizle(baslik)}.pdf`);
}
