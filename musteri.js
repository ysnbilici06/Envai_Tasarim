// Müşteri defteri: iletişim bilgileri, beden ölçüleri, geçmiş siparişler ve toplam alışveriş.
import * as S from './store.js';
import { para, sayi, satisHesap, tarihYaz } from './hesap.js';
import { $, esc, trSirala, bildirim, sayfaAc, islemler, telBicim, igAd } from './ui.js';
import { odemeDurumu } from './siparis.js';

const st = S.st;
export const OLCULER = ['Göğüs', 'Bel', 'Basen', 'Omuz', 'Kol boyu', 'Boy (elbise)', 'Paça boyu', 'İç bacak'];
const kucuk = s => (s || '').toLocaleLowerCase('tr').replace(/^@/, '').trim();

/** Satıştaki müşteri yazısına (ad ya da Instagram) uyan kayıtlı müşteri */
export function musteriBul(yazi) {
  const k = kucuk(yazi);
  if (!k) return null;
  return Object.values(st.musteriler).find(m => kucuk(m.ad) === k || (m.instagram && kucuk(m.instagram) === k)) || null;
}
/** Tek geçişte: ad/Instagram → müşteri haritası ve müşteri id → satışları. Liste çizimi O(müşteri + satış) olur
 *  (eskiden her müşteri için her satışta tüm müşteriler taranıyordu; çok kayıtta iPad'de takılıyordu). */
function satisIndeksi() {
  const ad = new Map();
  for (const m of Object.values(st.musteriler)) {   // musteriBul ile aynı öncelik: ilk eşleşen müşteri
    const a = kucuk(m.ad), i = kucuk(m.instagram);
    if (a && !ad.has(a)) ad.set(a, m.id);
    if (i && !ad.has(i)) ad.set(i, m.id);
  }
  const satis = new Map();
  for (const s of Object.values(st.satislar)) {
    const id = st.musteriler[s.musteriId] ? s.musteriId : ad.get(kucuk(s.musteri));
    if (!id) continue;
    if (!satis.has(id)) satis.set(id, []);
    satis.get(id).push(s);
  }
  for (const l of satis.values()) l.sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''));
  return { ad, satis };
}
export function musteriSatislari(m, idx) {
  if (idx) return idx.satis.get(m.id) || [];
  return Object.values(st.satislar)
    .filter(s => s.musteriId === m.id || (!st.musteriler[s.musteriId] && musteriBul(s.musteri)?.id === m.id))
    .sort((a, b) => (b.tarih || '').localeCompare(a.tarih || ''));
}
export function musteriOzet(m, idx) {
  const l = musteriSatislari(m, idx).filter(s => s.durum !== 'iptal');
  return {
    satislar: l, adet: l.length,
    toplam: l.reduce((t, s) => t + satisHesap(s).ciro, 0),
    kalan: l.reduce((t, s) => t + odemeDurumu(s).kalan, 0),
    son: l[0]?.tarih || '',
  };
}

let ara = '';
export function musterilerGorunum() {
  const a = kucuk(ara);
  const idx = satisIndeksi();
  const liste = Object.values(st.musteriler)
    .filter(m => !a || `${m.ad} ${m.instagram} ${m.telefon}`.toLocaleLowerCase('tr').includes(a)
      || (a.replace(/\D/g, '').length >= 3 && (m.telefon || '').replace(/\D/g, '').includes(a.replace(/\D/g, ''))))
    .map(m => ({ m, o: musteriOzet(m, idx) }))
    .sort((x, y) => (y.o.son || '').localeCompare(x.o.son || '') || trSirala(x.m.ad || '', y.m.ad || ''));
  // Kayıtlı olmayan ama satışlarda adı geçen müşteriler: tek dokunuşla kaydet
  const kayitsiz = [...new Set(Object.values(st.satislar).filter(s => s.musteri && !st.musteriler[s.musteriId] && !idx.ad.has(kucuk(s.musteri))).map(s => s.musteri.trim()))];
  const toplam = Object.keys(st.musteriler).length;
  return `
  <div class="baslik"><h1>Müşteriler</h1><button class="btn ana kucuk" data-act="mus-yeni">+ Müşteri</button></div>
  ${toplam ? `<input class="arama" type="search" placeholder="İsim, Instagram ya da telefon ara…" data-ara="mus" value="${esc(ara)}">` : ''}
  ${liste.length ? `<div class="kart liste">${liste.map(({ m, o }) => `
    <div class="satir" role="button" tabindex="0" data-act="mus" data-id="${m.id}">
      <span class="avatar" style="--renk:var(--c${(m.ad || 'a').charCodeAt(0) % 8 + 1})">${esc((m.ad || '?').slice(0, 1).toLocaleUpperCase('tr'))}</span>
      <div class="orta"><div class="ad">${esc(m.ad)}</div>
        <div class="ek">${[m.instagram && '@' + m.instagram.replace(/^@/, ''), m.telefon && telBicim(m.telefon), o.adet ? `${o.adet} sipariş` : 'henüz sipariş yok', o.son && 'son: ' + tarihYaz(o.son)].filter(Boolean).map(esc).join(' · ')}</div></div>
      <div class="sag"><div class="b">${para(o.toplam)}</div>${o.kalan ? `<div class="k"><span class="etiket kirmizi">Kalan ${para(o.kalan)}</span></div>` : '<div class="k soluk">toplam</div>'}</div>
      ${islemler('mus', m.id)}
    </div>`).join('')}</div>`
    : `<div class="kart bos"><div class="simge">👥</div><p>${toplam ? 'Aramaya uyan müşteri yok.' : 'Müşterilerinizi kaydedin: telefon, adres ve <b>beden ölçüleri</b> bir kez girilir, her siparişte hazır gelir.'}</p>
       ${toplam ? '' : '<button class="btn ana" data-act="mus-yeni">+ İlk müşteriyi ekle</button>'}</div>`}
  ${kayitsiz.length ? `<div class="alt-baslik">Satışlarda adı geçen, kayıtlı olmayan (${kayitsiz.length})</div>
    <div class="cipler sarili">${kayitsiz.map(k => `<button class="cip" data-act="mus-kaydet" data-id="${esc(k)}">＋ ${esc(k)}</button>`).join('')}</div>` : ''}`;
}
export const musteriAra = v => { ara = v; };

/** sonra(kayit|null) */
export function musteriDuzenle(id, sonra, onAd = '') {
  const eski = id ? st.musteriler[id] : null;
  const m = structuredClone(eski || { ad: onAd.replace(/^@/, ''), instagram: onAd.startsWith('@') ? onAd.slice(1) : '', telefon: '', adres: '', not: '', olculer: {} });
  m.olculer ||= {};
  if (m.telefon) m.telefon = telBicim(m.telefon);   // eski kayıtlar da "0555 123 12 12" biçimine gelsin
  const ekOlcu = Object.keys(m.olculer).filter(k => !OLCULER.includes(k));
  const o = eski ? musteriOzet(eski) : null;
  const d = sayfaAc({
    baslik: eski ? 'Müşteri' : 'Yeni müşteri',
    govde: `<div class="form">
      <label class="alan">Ad soyad<input name="ad" value="${esc(m.ad)}" autocomplete="off"></label>
      <div class="ikili">
        <label class="alan">Instagram <small class="soluk">paylaşımda etiketlenir</small><div class="birimli on-ek"><span class="b">@</span><input name="instagram" value="${esc(igAd(m.instagram))}" placeholder="kullanici_adi" autocapitalize="off" autocorrect="off" spellcheck="false" maxlength="60"></div>
          <a class="ig-kontrol" id="ig-kontrol" target="_blank" rel="noopener" ${m.instagram ? `href="https://www.instagram.com/${esc(igAd(m.instagram))}/"` : 'hidden'}>Profili kontrol et ↗</a></label>
        <label class="alan">Telefon<input name="telefon" value="${esc(m.telefon ? telBicim(m.telefon) : '')}" inputmode="tel" maxlength="17" autocomplete="tel" placeholder="0555 123 12 12"></label>
      </div>
      <label class="alan">Adres<textarea name="adres" rows="2" placeholder="Kargo / teslim adresi">${esc(m.adres)}</textarea></label>
      <label class="alan">Diğer sosyal medya<input name="sosyal" value="${esc(m.sosyal || '')}" placeholder="Örn. TikTok @kullanici · Facebook adı" autocapitalize="off"></label>
    </div>
    <div class="bolum"><h3>Beden ölçüleri <small>cm</small></h3>
      <div class="olcu-izgara">${[...OLCULER, ...ekOlcu].map(k => `<label class="alan">${esc(k)}<div class="birimli"><input data-olcu="${esc(k)}" inputmode="decimal" value="${esc(m.olculer[k] ?? '')}"><span class="b">cm</span></div></label>`).join('')}</div>
      <button class="btn kesik kucuk" data-k="olcu-ekle" style="margin-top:8px">+ Başka ölçü</button></div>
    <div class="bolum"><label class="alan">Not<textarea name="not" placeholder="Tercihleri, beden notları…">${esc(m.not)}</textarea></label></div>
    ${o ? `<div class="bolum"><h3>Siparişleri <small>${o.adet} sipariş · ${para(o.toplam)}${o.kalan ? ` · <span class="negatif">kalan ${para(o.kalan)}</span>` : ''}</small></h3>
      ${o.satislar.length ? `<div class="kart liste">${o.satislar.map(s => `<div class="satir" style="cursor:default"><div class="orta"><div class="ad">${esc(s.urunAd || 'Özel iş')}</div>
        <div class="ek">${esc(tarihYaz(s.tarih))}${(s.adet || 0) > 1 ? ' · ' + sayi(s.adet) + ' adet' : ''}</div></div><div class="sag"><div class="b">${para(satisHesap(s).ciro)}</div></div></div>`).join('')}</div>` : '<p class="ipucu">Henüz sipariş yok.</p>'}
      ${m.telefon ? `<div class="btn-satir" style="margin-top:10px"><a class="btn kucuk" href="https://wa.me/${esc(waNo(m.telefon))}" target="_blank" rel="noopener">💬 WhatsApp'tan yaz</a><a class="btn kucuk" href="tel:${esc(m.telefon.replace(/\s/g, ''))}">📞 Ara</a></div>` : ''}</div>
      <div class="bolum"><button class="btn tehlike tam" data-k="sil">Müşteriyi sil</button></div>` : ''}`,
    kaydet: () => {
      m.ad = (m.ad || '').trim(); m.instagram = igAd(m.instagram);
      if (!m.ad) { bildirim('Müşterinin adını yazın'); return false; }
      for (const k of Object.keys(m.olculer)) if (m.olculer[k] === '') delete m.olculer[k];
      const kayit = S.kaydet('musteriler', m);
      bildirim('Müşteri kaydedildi');
      sonra?.(kayit);
    },
  });
  d.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.olcu) m.olculer[t.dataset.olcu] = t.value.trim();
    else if (t.name === 'instagram') {
      // @, boşluk, büyük harf, Türkçe harf ve yapıştırılan profil linki kendiliğinden temizlenir
      const ad = igAd(t.value);
      if (ad !== t.value) t.value = ad;
      m.instagram = ad;
      const k = $('#ig-kontrol', d);
      k.hidden = !ad; if (ad) k.href = `https://www.instagram.com/${ad}/`;
    }
    else if (t.name) m[t.name] = t.value;
  });
  d.addEventListener('click', e => {
    const t = e.target.closest('[data-k]');
    if (!t) return;
    if (t.dataset.k === 'olcu-ekle') {
      const ad = (prompt('Ölçünün adı (örn. Etek boyu):') || '').trim();
      if (!ad || ad in m.olculer || OLCULER.includes(ad)) return;
      m.olculer[ad] = '';
      const l = document.createElement('label'); l.className = 'alan';
      l.innerHTML = `${esc(ad)}<div class="birimli"><input data-olcu="${esc(ad)}" inputmode="decimal"><span class="b">cm</span></div>`;
      $('.olcu-izgara', d).append(l); $('input', l).focus();
    }
    if (t.dataset.k === 'sil' && musteriSil(id)) { d.close(); sonra?.(null); }
  });
  if (!eski) setTimeout(() => $('[name=ad]', d).focus(), 50);
  return d;
}

export function musteriSil(id) {
  const m = st.musteriler[id];
  if (!m || !confirm(`"${m.ad}" müşteri kaydı silinsin mi? (Siparişleri silinmez.)`)) return false;
  S.sil('musteriler', id);
  bildirim('Silindi', () => { S.kaydet('musteriler', m); bildirim('Geri alındı'); });
  return true;
}

/** WhatsApp bağlantısı için numara: 0532… → 90532… */
export function waNo(tel) {
  let n = String(tel || '').replace(/\D/g, '');
  if (n.startsWith('0')) n = '90' + n.slice(1);
  else if (n.length === 10) n = '90' + n;
  return n;
}
/** Ölçülerin kısa özeti (satış formunda gösterilir) */
export const olcuOzeti = m => Object.entries(m?.olculer || {}).filter(([, v]) => v !== '').map(([k, v]) => `${k} ${v}`).join(' · ');
