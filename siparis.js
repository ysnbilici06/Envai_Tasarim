// Sipariş yardımcıları: ödeme / kapora, teslim tarihi, iş kronometresi, sipariş kaynağı,
// fiyat teklifi / sipariş fişi PDF'i ve stoktan düşme.
import * as S from './store.js';
import { para, sayi, satisHesap } from './hesap.js';
import { pdfUret, tarihSaatYaz, ustTarihSaat, yerelTarih, dokumOlustur } from './rapor.js';
import { esc, r2 } from './ui.js';

const st = S.st;

export const KAYNAKLAR = ['Instagram', 'WhatsApp', 'Tavsiye', 'Pazar / fuar', 'Diğer'];
export const ODEME_YONTEM = ['Nakit', 'Havale / EFT', 'Kart', 'Diğer'];

// ---------------------------------------------------------------- ödeme
/** s.odeme = { durum: 'tam' | 'kismi' | 'yok', odemeler: [{ tutar, tarih, yontem }] }
 *  Eski kayıtlar (odeme alanı yok): biten (hazır / teslim) iş ödenmiş sayılır. */
export function odemeDurumu(s) {
  const ciro = satisHesap(s).ciro;
  const o = s.odeme || { durum: s.durum === 'teslim' || s.durum === 'hazir' ? 'tam' : 'yok', odemeler: [] };
  const toplam = (o.odemeler || []).reduce((t, x) => t + (x.tutar || 0), 0);
  const tahsil = o.durum === 'tam' ? ciro : o.durum === 'yok' ? 0 : Math.min(ciro, toplam);
  return { ...o, ciro, tahsil, kalan: s.durum === 'iptal' ? 0 : r2(Math.max(0, ciro - tahsil)) };
}
export function alacaklar() {
  return Object.values(st.satislar).map(s => ({ s, o: odemeDurumu(s) })).filter(x => x.o.kalan > 0)
    .sort((a, b) => (a.s.tarih || '').localeCompare(b.s.tarih || ''));
}

// ---------------------------------------------------------------- teslim tarihi
/** Teslim tarihine göre rozet: { yazi, renk, gun } ya da null */
export function teslimRozeti(s) {
  if (!s.teslimTarihi || s.durum === 'teslim' || s.durum === 'iptal') return null;
  const bugun = new Date(yerelTarih(new Date()) + 'T00:00');
  const hedef = new Date(s.teslimTarihi + 'T00:00');
  const gun = Math.round((hedef - bugun) / 86400000);
  if (gun < 0) return { yazi: `${-gun} gün gecikti`, renk: 'kirmizi', gun };
  if (gun === 0) return { yazi: 'Teslim bugün', renk: 'kirmizi', gun };
  if (gun === 1) return { yazi: 'Teslim yarın', renk: 'sari', gun };
  if (gun <= 3) return { yazi: `${gun} gün kaldı`, renk: 'sari', gun };
  return { yazi: `Teslim ${tarihSaatYaz(s.teslimTarihi, false)}`, renk: 'gri', gun };
}

// ---------------------------------------------------------------- kronometre
/** s.krono = { bas: ms | null (çalışıyorsa başlangıç), toplam: ms } */
export const kronoMs = s => (s.krono?.toplam || 0) + (s.krono?.bas ? Date.now() - s.krono.bas : 0);
export const kronoCalisiyor = s => !!s.krono?.bas;
export function kronoYaz(ms) {
  const sn = Math.floor(ms / 1000), sa = Math.floor(sn / 3600), dk = Math.floor((sn % 3600) / 60), s = sn % 60;
  return `${String(sa).padStart(2, '0')}:${String(dk).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
/** Kronometreyi başlatır/durdurur ve kaydeder. Durunca harcanan emek ölçülen süreye eşitlenir. */
export function kronoDegistir(id) {
  const s = structuredClone(st.satislar[id]);
  s.krono ||= { bas: null, toplam: 0 };
  if (s.krono.bas) {
    s.krono.toplam += Date.now() - s.krono.bas; s.krono.bas = null;
    s.calismaSaat = r2(s.krono.toplam / 3600000);
  } else {
    s.krono.bas = Date.now();
    if (s.durum === 'siparis') {            // işe başlandı
      s.durum = 'yapiliyor';
      s.zaman ||= {}; if (!s.zaman.basladi) s.zaman.basladi = simdiYerel();
    }
  }
  return S.kaydet('satislar', s);
}
export function kronoSifirla(id) {
  const s = structuredClone(st.satislar[id]);
  s.krono = { bas: null, toplam: 0 };
  return S.kaydet('satislar', s);
}
function simdiYerel() { const d = new Date(), i = n => String(n).padStart(2, '0'); return `${yerelTarih(d)}T${i(d.getHours())}:${i(d.getMinutes())}`; }

// ---------------------------------------------------------------- stok
const stokTakipte = m => m && m.stok != null && m.stok !== '';
function stokIhtiyaci(s) {
  const adet = s.adet || 0;
  // eski kayıtlarda döküm yoksa işin güncel malzeme listesi kullanılır
  const dokum = s.dokum || (s.urunId && st.urunler[s.urunId] ? dokumOlustur(st.urunler[s.urunId], st) : null);
  return (dokum?.malzemeler || []).map(k => ({ malzemeId: k.malzemeId, miktar: r2(k.miktar * adet) }))
    .filter(h => h.miktar && stokTakipte(st.malzemeler[h.malzemeId]));
}
/** İş bitince kullanılan malzemeyi stoktan düşer; yon: -1 düş, +1 geri ekle.
 *  Düşülen miktarlar s.stokHareket'e yazılır; geri eklemede birebir bu liste kullanılır (s'yi değiştirir). */
export function stokUygula(s, yon = -1) {
  const hareket = yon < 0 ? stokIhtiyaci(s) : (s.stokHareket || stokIhtiyaci(s));
  if (yon < 0) s.stokHareket = hareket; else delete s.stokHareket;
  for (const h of hareket) {
    const m = st.malzemeler[h.malzemeId];
    if (!stokTakipte(m)) continue;   // stok takibi açık olmayan malzeme
    S.kaydet('malzemeler', { ...m, stok: r2((Number(m.stok) || 0) + yon * h.miktar) });
  }
  return hareket.length;
}
export const stokAzMi = m => m.stok != null && m.stok !== '' && m.kritik != null && m.kritik !== '' && Number(m.stok) <= Number(m.kritik);

// ---------------------------------------------------------------- teklif / sipariş fişi PDF
export function fisPdf(s, tur = 'fis') {
  const m = s.musteriId ? st.musteriler[s.musteriId] : null;
  const o = odemeDurumu(s);
  const h = satisHesap(s);
  const teklif = tur === 'teklif';
  const t = ustTarihSaat();
  const iletisim = [st.ayar.instagram && 'Instagram: @' + st.ayar.instagram.replace(/^@/, ''), st.ayar.whatsapp && 'WhatsApp: ' + st.ayar.whatsapp].filter(Boolean);
  const olculer = m?.olculer ? Object.entries(m.olculer).filter(([, v]) => v !== '' && v != null) : [];
  const no = (s.id || '').slice(-6).toUpperCase();
  const govde = `
  <div class="rp-ust"><div><div class="rp-tur">${teklif ? 'Fiyat teklifi' : 'Sipariş fişi'}${no ? ' · No ' + esc(no) : ''}</div>
    <h1>${esc(s.urunAd || 'Özel iş')}</h1>
    <div class="rp-alt">Tarih: ${t.tarih}${s.teslimTarihi ? ' · Teslim: ' + tarihSaatYaz(s.teslimTarihi) : ''}</div></div>
    <div class="rp-sag"><img class="rp-logo" src="logo/envai-amblem.png" alt=""><b>Envai Tasarım</b>${iletisim.map(esc).join('<br>')}</div></div>
  <div class="rp-iki">
    <div class="rp-blok"><h3>Müşteri</h3>
      <table class="tablo"><tbody>
        <tr><td>Ad</td><td><b>${esc(m?.ad || s.musteri || '—')}</b></td></tr>
        ${m?.telefon ? `<tr><td>Telefon</td><td>${esc(m.telefon)}</td></tr>` : ''}
        ${m?.instagram ? `<tr><td>Instagram</td><td>@${esc(m.instagram.replace(/^@/, ''))}</td></tr>` : ''}
        ${m?.adres ? `<tr><td>Adres</td><td>${esc(m.adres)}</td></tr>` : ''}
      </tbody></table></div>
    ${olculer.length ? `<div class="rp-blok"><h3>Ölçüler</h3><table class="tablo"><tbody>
      ${olculer.map(([k, v]) => `<tr><td>${esc(k)}</td><td class="sayi">${esc(v)} cm</td></tr>`).join('')}</tbody></table></div>` : '<div></div>'}
  </div>
  <h3>${teklif ? 'Teklif' : 'Sipariş'} detayı</h3>
  <table class="tablo">
    <thead><tr><th>Ürün / hizmet</th><th class="sayi">Adet</th><th class="sayi">Birim fiyat</th><th class="sayi">Tutar</th></tr></thead>
    <tbody><tr><td><b>${esc(s.urunAd || 'Özel iş')}</b>${s.kategori ? `<br><small>${esc(s.kategori)}</small>` : ''}</td>
      <td class="sayi">${sayi(s.adet || 0)}</td><td class="sayi">${para(s.birimFiyat || 0)}</td><td class="sayi">${para(h.ciro)}</td></tr></tbody>
    <tfoot><tr><td>Toplam</td><td></td><td></td><td class="sayi">${para(h.ciro)}</td></tr></tfoot>
  </table>
  ${!teklif ? `<table class="tablo" style="margin-top:10px;max-width:360px;margin-left:auto"><tbody>
    ${(o.odemeler || []).map(x => `<tr><td>${x.tutar === o.ciro ? 'Ödeme' : 'Kapora / ödeme'} <small>${esc(x.yontem || '')} ${x.tarih ? tarihSaatYaz(x.tarih) : ''}</small></td><td class="sayi">${para(x.tutar)}</td></tr>`).join('')}
    <tr class="kalin"><td>Ödenen</td><td class="sayi pozitif">${para(o.tahsil)}</td></tr>
    <tr class="kalin"><td>Kalan</td><td class="sayi ${o.kalan > 0 ? 'negatif' : ''}">${para(o.kalan)}</td></tr>
  </tbody></table>` : `<p class="ipucu">Bu teklif 7 gün geçerlidir. Siparişi onaylamak için bize yazmanız yeterli.</p>`}
  ${s.not ? `<h3>Not</h3><p class="rp-not">${esc(s.not)}</p>` : ''}
  <div class="rp-sonuc">${teklif ? 'İlginiz için teşekkür ederiz. El yapımı ürünlerimiz siparişe özel hazırlanır.' : 'Siparişiniz için teşekkür ederiz! Ürününüz özenle, elde hazırlanmaktadır.'}</div>`;
  const ad = (teklif ? 'Teklif-' : 'Siparis-fisi-') + (m?.ad || s.musteri || s.urunAd || 'musteri').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-').slice(0, 40);
  return pdfUret(govde, ad + '.pdf');
}
