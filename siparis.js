// Sipariş yardımcıları: ödeme / kapora, teslim tarihi, iş kronometresi, sipariş kaynağı,
// fiyat teklifi / sipariş fişi PDF'i ve stoktan düşme.
import * as S from './store.js';
import { para, sayi, satisHesap } from './hesap.js';
import { pdfUret, tarihSaatYaz, ustTarihSaat, yerelTarih, dokumOlustur } from './rapor.js';
import { esc, r2 } from './ui.js';
import * as D from './dosyadepo.js';

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
  <div class="rp-sonuc">${teklif ? 'İlginiz için teşekkür ederiz. Ürünlerimiz siparişe özel, size göre hazırlanır.' : 'Siparişiniz için teşekkür ederiz! Ürününüz size özel olarak, özenle hazırlanmaktadır.'}</div>`;
  const ad = (teklif ? 'Teklif-' : 'Siparis-fisi-') + (m?.ad || s.musteri || s.urunAd || 'musteri').replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-').slice(0, 40);
  return pdfUret(govde, ad + '.pdf');
}

// ---------------------------------------------------------------- müşteri teslim raporu PDF
/** Raporun ortasına konacak ürün görseli: SADE ürün fotoğrafı (kullanıcı isteği: yazılı/çerçeveli
 *  tanıtım görseli değil). Çekilen fotoğraf yoksa üretilenlerden en sadesi (vitrin olmayan).
 *  data URL döner (html2canvas güvenle çizsin). */
async function urunGorseli(satisId) {
  const sahip = 'satis:' + satisId;
  const resim = x => !(x.blob?.type || '').startsWith('video');
  const puan = x => (x.fav ? 8 : 0) + (/vitrin/.test(x.ad) ? -4 : 0) + (/-kare-/.test(x.ad) ? 2 : /-dikey-/.test(x.ad) ? 1 : 0);
  const sec = (await D.liste(sahip, 'urun').catch(() => [])).filter(resim)[0]
    || (await D.liste(sahip, 'uretilen').catch(() => [])).filter(resim).sort((a, b) => puan(b) - puan(a) || a.eklendi - b.eklendi)[0];
  if (!sec) return null;
  const url = await new Promise((ok, hata) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = hata; r.readAsDataURL(sec.blob); });
  const img = await new Promise((ok, hata) => { const i = new Image(); i.onload = () => ok(i); i.onerror = hata; i.src = url; });
  return { url, w: img.naturalWidth, h: img.naturalHeight };
}

/** Sipariş bitince müşteriye gönderilecek bilgilendirme raporu: ürün görseli ortada,
 *  fiyat, sipariş / teslim tarihi, müşteri bilgileri. */
export async function musteriRaporuPdf(s) {
  const m = (s.musteriId && st.musteriler[s.musteriId]) || Object.values(st.musteriler).find(x => x.ad && x.ad === s.musteri) || null;
  const h = satisHesap(s), o = odemeDurumu(s), z = s.zaman || {};
  const gorsel = await urunGorseli(s.id);
  // Görseli sayfanın ortasına sığdır (html2canvas object-fit desteklemiyor: ölçü elle)
  let resimHtml = '';
  if (gorsel) {
    const enW = 660, enH = 415, o2 = Math.min(enW / gorsel.w, enH / gorsel.h);
    resimHtml = `<div class="rp-blok mr-gorsel"><img data-sigdir src="${gorsel.url}" width="${Math.round(gorsel.w * o2)}" height="${Math.round(gorsel.h * o2)}" alt=""></div>`;
  }
  const siparisT = z.alindi || (s.tarih ? s.tarih + (s.saat ? 'T' + s.saat : '') : '');
  const teslimT = z.teslim || z.bitti || s.teslimTarihi || '';
  const ig = m?.instagram ? '@' + m.instagram.replace(/^@/, '') : (/^@/.test(s.musteri || '') ? s.musteri : '');
  const musteriSatir = [
    ['Ad soyad', m?.ad || (s.musteri || '').replace(/^@/, '')], ['Telefon', m?.telefon], ['Adres', m?.adres],
    ['Instagram', ig], ['Sosyal medya', m?.sosyal],
  ].filter(([, v]) => v && String(v).trim());
  const dukkan = [st.ayar.instagram && 'Instagram: @' + st.ayar.instagram.replace(/^@/, ''), st.ayar.whatsapp && 'WhatsApp: ' + st.ayar.whatsapp].filter(Boolean);
  const kart = (e, d, alt = '') => `<div class="rp-kartcik"><div class="e">${e}</div><div class="d">${d}</div>${alt ? `<div class="e">${alt}</div>` : ''}</div>`;
  const ad = m?.ad || (s.musteri || '').replace(/^@/, '');
  const no = (s.id || '').slice(-6).toUpperCase();
  const igDukkan = st.ayar.instagram ? '@' + st.ayar.instagram.replace(/^@/, '') : '@envai_tasarim';
  // Kurumsal görünüm: amblem + ENVAİ TASARIM yazısı (lacivert, logodaki gibi), logo renklerinde ince şerit
  const govde = `
  <style>
    .rp .mr-antet { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 2px 0 12px; }
    .rp .mr-marka { display: flex; align-items: center; gap: 14px; }
    .rp .mr-marka img { width: 66px; height: 66px; display: block; }
    .rp .mr-ad { font-family: "Poppins", "Inter", sans-serif; color: #1b2b52; line-height: 1; }
    .rp .mr-ad b { display: block; font-size: 30px; font-weight: 700; letter-spacing: 4px; }
    .rp .mr-ad span { display: block; font-size: 13px; font-weight: 500; letter-spacing: 9.5px; margin-top: 5px; }
    .rp .mr-ad small { display: block; font-family: "Inter", sans-serif; font-size: 10.5px; letter-spacing: .4px; color: #6b6f8c; margin-top: 7px; font-weight: 500; }
    .rp .mr-belge { text-align: right; }
    .rp .mr-belge .t { font-family: "Poppins", sans-serif; font-size: 15px; font-weight: 700; color: #6d3fe0; letter-spacing: 2px; }
    .rp .mr-belge div { font-size: 11px; color: #6b6f8c; margin-top: 3px; }
    .rp .mr-serit { height: 5px; border-radius: 3px; margin-bottom: 16px;
      background: linear-gradient(90deg, #2bb3c0 0%, #2bb3c0 20%, #e2457a 20%, #e2457a 40%, #f08a4b 40%, #f08a4b 60%, #e3a82b 60%, #e3a82b 80%, #1b2b52 80%, #1b2b52 100%); }
    .rp .mr-baslik { display: flex; justify-content: space-between; align-items: baseline; gap: 12px; margin-bottom: 8px; }
    .rp .mr-baslik h1 { font-size: 21px; margin: 0; color: #1c1a3a; }
    .rp .mr-baslik span { color: #6b6f8c; font-size: 12px; }
    .rp .mr-selam { margin: 0 0 12px; padding: 10px 14px; border-radius: 10px; background: #f1effc; color: #3b2a7a; font-size: 13px; }
    .rp .mr-gorsel { display: flex; justify-content: center; margin: 2px 0 14px; }
    .rp .mr-gorsel img { border-radius: 8px; display: block; }
    .rp .mr-tanim { margin: -4px 0 10px; font-size: 12.5px; color: #4a4766; }
    .rp .mr-musteri { display: grid; grid-template-columns: 1fr 1fr; gap: 0 22px; }
    .rp .mr-musteri div { display: flex; gap: 10px; padding: 6px 0; border-bottom: 1px solid #ece9f8; font-size: 12.5px; }
    .rp .mr-musteri span { color: #6b6f8c; width: 92px; flex-shrink: 0; }
    .rp .mr-musteri b { color: #1c1a3a; }
    .rp .rp-kartcik .d { font-size: 14px; }
    .rp .mr-tesekkur { margin-top: 16px; display: flex; gap: 16px; align-items: center; padding: 14px 18px; border-radius: 12px;
      background: linear-gradient(135deg, #f4f0ff, #fdf2f6); border: 1px solid #e6defa; }
    .rp .mr-tesekkur img { width: 54px; height: 54px; flex-shrink: 0; }
    .rp .mr-tesekkur h4 { margin: 0 0 4px; font-family: "Poppins", sans-serif; font-size: 15px; color: #1b2b52; }
    .rp .mr-tesekkur p { margin: 0; font-size: 12px; color: #3d3a5c; line-height: 1.5; }
    .rp .mr-imza { margin-top: 6px !important; font-style: italic; color: #6d3fe0 !important; font-weight: 600; }
    .rp .mr-alt { margin-top: 8px; padding-top: 7px; border-top: 1px solid #e6defa; display: flex; gap: 18px; font-size: 11px; color: #6b6f8c; }
    .rp .mr-alt b { color: #1b2b52; }
  </style>
  <div class="mr-antet rp-blok">
    <div class="mr-marka"><img src="logo/envai-amblem.png" alt="">
      <div class="mr-ad"><b>ENVAİ</b><span>TASARIM</span><small>Kişiye özel nakış ve dikiş</small></div></div>
    <div class="mr-belge"><div class="t">TESLİM RAPORU</div>${no ? `<div>Sipariş no: <b>${esc(no)}</b></div>` : ''}<div>Düzenlenme: ${ustTarihSaat().tarih}</div></div>
  </div>
  <div class="mr-serit"></div>
  <div class="mr-baslik rp-blok"><h1>${esc(s.urunAd || 'Özel iş')}</h1><span>${esc([s.kategori, `${sayi(s.adet || 1)} adet`].filter(Boolean).join(' · '))}</span></div>
  ${s.urunTanim ? `<div class="mr-tanim">${esc(s.urunTanim)}</div>` : ''}
  <div class="mr-selam">${ad ? `Sayın <b>${esc(ad)}</b>, ` : ''}siparişiniz özenle hazırlandı${s.durum === 'teslim' ? ' ve teslim edildi' : ' ve teslime hazır'}. Bilgileri aşağıda bulabilirsiniz.</div>
  ${resimHtml}
  <div class="rp-kartlar">
    ${kart('Ürün fiyatı', para(h.ciro), (s.adet || 1) > 1 ? `${sayi(s.adet)} × ${para(s.birimFiyat || 0)}` : '')}
    ${kart('Sipariş tarihi', esc(tarihSaatYaz(siparisT)))}
    ${kart(z.teslim ? 'Teslim tarihi' : 'Teslim (planlanan)', esc(tarihSaatYaz(teslimT)))}
    ${kart('Ödeme', o.kalan > 0 ? `<span class="negatif">Kalan ${para(o.kalan)}</span>` : '<span class="pozitif">Ödendi</span>', o.kalan > 0 && o.tahsil ? 'Ödenen ' + para(o.tahsil) : '')}
  </div>
  <div class="rp-blok"><h3>Müşteri bilgileri</h3>
    ${musteriSatir.length ? `<div class="mr-musteri">${musteriSatir.map(([k, v]) => `<div><span>${k}</span><b>${esc(v)}</b></div>`).join('')}</div>` : '<p class="soluk" style="margin:0;font-size:12px">Müşteri bilgisi girilmemiş</p>'}</div>
  <div class="mr-tesekkur rp-blok"><img src="logo/envai-amblem.png" alt="">
    <div><h4>Bizi tercih ettiğiniz için teşekkür ederiz!</h4>
      <p>Ürününüz size özel olarak, büyük bir özen ve titizlikle hazırlandı; güzel günlerde kullanmanızı dileriz. Memnuniyetiniz bizim için en büyük ödül:
        görüşlerinizi bizimle paylaşır, ürününüzün fotoğrafını Instagram'da <b>${esc(igDukkan)}</b> etiketiyle paylaşırsanız çok mutlu oluruz.</p>
      <p class="mr-imza">Sevgiyle, Envai Tasarım</p>
      <div class="mr-alt">${dukkan.map(x => { const [k, v] = x.split(': '); return `<span>${esc(k)}: <b>${esc(v)}</b></span>`; }).join('')}<span>Yeni siparişleriniz için bize her zaman yazabilirsiniz</span></div></div></div>`;
  const dosya = 'Teslim-raporu-' + (ad || s.urunAd || 'musteri').replace(/[\/:*?"<>|@]+/g, '').replace(/\s+/g, '-').slice(0, 40);
  const pdf = await pdfUret(govde, dosya + '.pdf');
  // Paylaşırken link yerine giden kısa mesaj (WhatsApp'ta dosyanın yanında görünür)
  pdf.paylasMetni = [
    `${ad ? `Merhaba ${ad} 🌸 ` : ''}${s.urunAd ? s.urunAd + ' siparişiniz' : 'Siparişiniz'} ${s.durum === 'teslim' ? 'teslim edildi' : 'teslime hazır'}.`,
    [no && `Sipariş no: ${no}`, `Tutar: ${para(h.ciro)}`, teslimT && `Teslim: ${tarihSaatYaz(teslimT)}`].filter(Boolean).join(' · '),
    'Teslim raporunuz ektedir. Bizi tercih ettiğiniz için teşekkür ederiz. Envai Tasarım',
  ].join('\n');
  return pdf;
}
