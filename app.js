import * as S from './store.js';
import * as B from './bulut.js';
import { para, sayi, yuzde, oku, yaz, birimFiyat, urunHesap, satisHesap, bugun, ayAnahtar, ayAdi, tarihYaz } from './hesap.js';
import { ornekVeri } from './ornek.js';
import * as R from './rapor.js';
import { tanitimStudyosu, fotoSayisi } from './studyo.js';
import * as O from './siparis.js';
import * as M from './musteri.js';
import * as N from './nakis.js';
import * as G from './giderler.js';
import * as K from './kilit.js';
import * as D from './dosyadepo.js';
import { excelDosyalari } from './disari.js';
import * as BT from './bitenler.js';
import { $, $$, esc, r2, trSirala, bildirim, SVG_KALEM, SVG_COP, SVG_ARTI, islemler, sayfaAc, kisaBirim, dosyaPaylas, dosyaIndir, metinKopyala } from './ui.js';

const st = S.st;

const BIRIMLER = ['adet', 'metre', 'cm', 'gram', 'kg', 'top', 'bobin', 'yumak', 'çile', 'makara', 'rulo', 'paket', 'deste', 'çift', 'takım', 'litre'];
const DURUM = {
  siparis: { ad: 'Sipariş alındı', kisa: 'Sipariş', renk: 'sari', css: 'var(--c2)', zaman: 'alindi', sonraki: 'yapiliyor', dugme: 'İşe başla' },
  yapiliyor: { ad: 'İşleniyor', kisa: 'İşleniyor', renk: 'mor', css: 'var(--c5)', zaman: 'basladi', sonraki: 'hazir', dugme: 'Bitti' },
  hazir: { ad: 'Bitti, teslim bekliyor', kisa: 'Bitti', renk: 'mavi', css: 'var(--c1)', zaman: 'bitti', sonraki: 'teslim', dugme: 'Teslim et' },
  teslim: { ad: 'Teslim edildi', kisa: 'Teslim', renk: 'yesil', css: 'var(--c3)', zaman: 'teslim' },
  iptal: { ad: 'İptal', kisa: 'İptal', renk: 'gri', css: '#8a8daa' },
};
const BEKLEYEN = ['siparis', 'yapiliyor', 'hazir'];
const BITTI = ['hazir', 'teslim'];
const DURUM_ONCEKI = { yapiliyor: 'siparis', hazir: 'yapiliyor', teslim: 'hazir' };
/** Duruma gelinceki aşama zamanlarını doldurur (boşsa "şimdi"); doldurduğu anahtarları döndürür. */
function durumZamanla(s, durum) {
  s.zaman ||= {};
  const k = DURUM[durum]?.zaman;
  if (!k) return [];
  const doldu = [];
  if (!s.zaman.alindi) { s.zaman.alindi = s.tarih ? `${s.tarih}T${s.saat || R.saatSimdi()}` : R.simdi(); doldu.push('alindi'); }
  if (!s.zaman[k]) { s.zaman[k] = R.simdi(); doldu.push(k); }
  return doldu;
}
const ASAMA_SIRA = ['alindi', 'basladi', 'bitti', 'teslim'];

// Her kategoriye kalıcı bir renk ve simge
const RENKLER = ['var(--c5)', 'var(--c4)', 'var(--c1)', 'var(--c2)', 'var(--c3)', 'var(--c6)', 'var(--c7)', 'var(--c8)'];
function katRenk(k) {
  if (!k) return 'var(--c4)';
  let i = st.ayar.kategoriler.indexOf(k);
  if (i < 0) { i = 0; for (const c of k) i = (i * 31 + c.charCodeAt(0)) >>> 0; }
  return RENKLER[i % RENKLER.length];
}
function katEmoji(k = '') {
  const s = k.toLocaleLowerCase('tr');
  const tablo = [[/çanta|cüzdan/, '👜'], [/nakış|işleme/, '🪡'], [/paça|tadilat|kısalt/, '👖'], [/elbise|dikim|abiye/, '👗'],
    [/perde|ev/, '🏠'], [/bebek|çocuk/, '🧸'], [/örgü|tığ|ip/, '🧶'], [/takı|aksesuar|süs/, '💎'], [/hediye/, '🎁']];
  return (tablo.find(([r]) => r.test(s)) || [0, '🧵'])[1];
}
function malzEmoji(k = '') {
  const s = k.toLocaleLowerCase('tr');
  const tablo = [[/ip|iplik/, '🧶'], [/kumaş|astar|tela/, '🧵'], [/sap/, '👜'], [/fermuar|çıtçıt|düğme/, '🔘'],
    [/dantel|kurdele|şerit/, '🎀'], [/süs|boncuk|pul/, '✨'], [/etiket|ambalaj|kutu/, '🏷️']];
  return (tablo.find(([r]) => r.test(s)) || [0, '📦'])[1];
}
const IKON = {
  ciro: '<path d="M3 7h18v12H3z"/><path d="M3 11h18"/><circle cx="16" cy="15" r="1.5"/>',
  gider: '<path d="M6 3h12l-1 18H7L6 3z"/><path d="M9 8h6M9 12h6"/>',
  adet: '<path d="M6 8h12l-1 12H7L6 8z"/><path d="M9 8a3 3 0 0 1 6 0"/>',
  marj: '<path d="M4 20 20 4"/><circle cx="7" cy="7" r="2.5"/><circle cx="17" cy="17" r="2.5"/>',
};
// ---- Kategori listeleri (iş: "kategoriler", malzeme: "malzemeKategorileri")
const kucuk = s => s.toLocaleLowerCase('tr');
/** Listeye ekler; zaten varsa false döner. */
function katEkle(anahtar, ad) {
  const liste = st.ayar[anahtar] || [];
  if (liste.some(x => kucuk(x) === kucuk(ad))) return false;
  S.ayarKaydet({ [anahtar]: [...liste, ad] });
  return true;
}
function katListesi(baslik, anahtar, ornek, simge) {
  const liste = st.ayar[anahtar] || [];
  return `<div class="alt-baslik">${baslik}</div>
    <div class="kart liste">
      ${liste.map((k, i) => `<div class="satir" style="cursor:default">${simge(k)}<div class="orta"><div class="ad">${esc(k)}</div></div>
        <span class="islem"><button class="ikon-btn" data-act="kat-duzenle" data-tur="${anahtar}" data-id="${i}" aria-label="Adını değiştir" title="Adını değiştir">${SVG_KALEM}</button>
        <button class="ikon-btn sil" data-act="kat-sil" data-tur="${anahtar}" data-id="${i}" aria-label="Sil" title="Sil">${SVG_COP}</button></span></div>`).join('')}
      <div class="satir" style="cursor:default;gap:8px"><input data-yeni-kat="${anahtar}" placeholder="Yeni kategori (${ornek})" style="flex:1">
        <button class="btn kucuk ana" data-act="kat-ekle" data-tur="${anahtar}">Ekle</button></div>
    </div>`;
}
const YENI_KAT = '__yeni__';
/** Düzenleme ekranları için: seçim listesi + "Yeni kategori ekle" satırı. */
function katSeciciHtml(anahtar, secili, bosYazi) {
  const tum = [...new Set([...(st.ayar[anahtar] || []), secili].filter(Boolean))];
  return `<div class="alan">Kategori
    <select name="kategori" data-kat-anahtar="${anahtar}">
      ${tum.map(k => `<option value="${esc(k)}" ${k === secili ? 'selected' : ''}>${esc(k)}</option>`).join('')}
      <option value="" ${!secili ? 'selected' : ''}>— ${bosYazi} —</option>
      <option value="${YENI_KAT}">＋ Yeni kategori ekle…</option>
    </select>
    <div class="yeni-kat-satir" hidden><input placeholder="Yeni kategori adı" autocomplete="off"><button type="button" class="btn kucuk ana">Ekle</button></div>
  </div>`;
}
function katSeciciBagla(d, ayarla) {
  const sec = $('select[data-kat-anahtar]', d);
  const anahtar = sec.dataset.katAnahtar;
  const kutu = $('.yeni-kat-satir', d), girdi = $('input', kutu);
  let onceki = sec.value;
  sec.addEventListener('change', () => {
    if (sec.value === YENI_KAT) { sec.value = onceki; kutu.hidden = false; girdi.focus(); return; }
    kutu.hidden = true; onceki = sec.value; ayarla(sec.value);
  });
  const ekle = () => {
    const ad = girdi.value.trim();
    if (!ad) return girdi.focus();
    katEkle(anahtar, ad);
    let o = [...sec.options].find(x => x.value !== YENI_KAT && kucuk(x.value) === kucuk(ad));
    if (!o) { o = new Option(ad, ad); sec.insertBefore(o, sec.querySelector('option[value=""]')); }
    sec.value = o.value; onceki = o.value; ayarla(o.value);
    girdi.value = ''; kutu.hidden = true;
    bildirim(`"${o.value}" kategorisi eklendi`);
  };
  $('button', kutu).addEventListener('click', ekle);
  girdi.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); ekle(); } });
}

const ist = (renk, ikon, e, d) =>`<div class="kart ist" style="--renk:${renk}">
  <div class="simge-k"><svg viewBox="0 0 24 24">${IKON[ikon]}</svg></div><div class="e">${e}</div><div class="d">${d}</div></div>`;



/** Silme işlemleri: düzenleme ekranı ve liste düğmeleri aynı yolu kullanır. true = silindi. */
function kayitSil(kol, id, soru) {
  const eski = st[kol][id];
  if (!eski || !confirm(soru)) return false;
  S.sil(kol, id);
  bildirim('Silindi', () => { S.kaydet(kol, eski); bildirim('Geri alındı'); });
  return true;
}
const isSil = id => kayitSil('urunler', id, `"${st.urunler[id]?.ad}" silinsin mi? (Geçmiş satışlar silinmez.)`);
// Biten satış silinince düşülen malzeme stoğa geri eklenir; "Geri al" yeniden düşer
function satisSil(id) {
  const eski = st.satislar[id];
  if (!eski || !confirm(`"${eski.urunAd || 'Özel iş'}" satışı silinsin mi?`)) return false;
  if (eski.stokDusuldu) O.stokUygula(structuredClone(eski), +1);
  S.sil('satislar', id);
  bildirim('Silindi', () => {
    const k = structuredClone(eski);
    if (k.stokDusuldu) O.stokUygula(k, -1);
    S.kaydet('satislar', k); bildirim('Geri alındı');
  });
  return true;
}
function malzSil(id) {
  const n = Object.values(st.urunler).filter(u => (u.kalemler || []).some(k => k.malzemeId === id)).length;
  const uyari = n ? `Bu malzeme ${n} işte kullanılıyor; silinirse o işlerin maliyetinden düşer. ` : '';
  return kayitSil('malzemeler', id, uyari + `"${st.malzemeler[id]?.ad}" silinsin mi?`);
}

// ---------------------------------------------------------------- görünümler
let ay = new Date(); ay.setDate(1);
let urunAra = '', urunKat = '', malzAra = '';

const GORUNUM = { ozet, urunler, malzemeler, satislar, galeri: () => BT.bitenlerGorunum(), musteriler: () => M.musterilerGorunum(), raporlar, ayarlar };
const rapor = { donem: 'buay', bas: '', bit: '' };

function ciz() {
  let sekme = location.hash.slice(1) || 'ozet';
  if (!GORUNUM[sekme]) sekme = 'ozet';
  $$('#sekmeler a').forEach(a => a.classList.toggle('aktif', a.dataset.tab === sekme));
  const v = $('#view');
  const odak = document.activeElement?.dataset?.ara;
  const konum = document.activeElement?.selectionStart;
  v.innerHTML = GORUNUM[sekme]();
  if (odak) {
    const i = v.querySelector(`[data-ara="${odak}"]`);
    if (i) { i.focus(); try { i.setSelectionRange(konum, konum); } catch { } }
  }
  rozet();
  if (sekme === 'galeri') BT.kapaklariDoldur();
}

function rozet() {
  const r = $('#bulut-rozet');
  const d = B.durum;
  if (!d.kurulu) { r.hidden = true; return; }
  r.hidden = false;
  r.className = 'rozet' + (d.kullanici ? ' ok' : '');
  r.textContent = d.kullanici ? '☁︎ Eşitli' : (d.hata ? 'Çevrimdışı' : 'Giriş yapılmadı');
}

function aySecici() {
  return `<div class="ay-sec">
    <button data-act="ay" data-id="-1" aria-label="Önceki ay">‹</button>
    <span>${ayAdi(ay)}</span>
    <button data-act="ay" data-id="1" aria-label="Sonraki ay">›</button></div>`;
}

function aySatislari() {
  const a = ayAnahtar(ay);
  return Object.values(st.satislar).filter(s => s.tarih?.startsWith(a));
}

function ozet() {
  const liste = aySatislari().filter(s => s.durum !== 'iptal');
  let ciro = 0, gider = 0, kazanc = 0, adet = 0;
  const isBazli = {}, katBazli = {};
  for (const s of liste) {
    const h = satisHesap(s);
    ciro += h.ciro; gider += h.gider; kazanc += h.kazanc; adet += s.adet || 0;
    const ad = s.urunAd || 'Özel iş';
    (isBazli[ad] ||= { ad, adet: 0, kazanc: 0 });
    isBazli[ad].adet += s.adet || 0; isBazli[ad].kazanc += h.kazanc;
    const k = s.kategori || 'Kategorisiz';
    (katBazli[k] ||= { ad: k, adet: 0, kazanc: 0 });
    katBazli[k].adet += s.adet || 0; katBazli[k].kazanc += h.kazanc;
  }
  const bekleyen = Object.values(st.satislar)
    .filter(s => BEKLEYEN.includes(s.durum))
    .sort((a, b) => sirala(b, a));
  const enIyi = Object.values(isBazli).sort((a, b) => b.kazanc - a.kazanc).slice(0, 5);
  const katlar = Object.values(katBazli).sort((a, b) => b.kazanc - a.kazanc);
  const hicVeriYok = !S.doluMu();

  const enCok = Math.max(1, ...enIyi.map(i => i.kazanc));
  const marj = ciro > 0 ? kazanc / ciro * 100 : 0;

  return `
  ${hicVeriYok ? hosgeldin() : ''}
  <section class="hero">
    <div class="hero-ust">
      <div><div class="hero-e">${ayAdi(ay)} · kazanç</div><div class="hero-d">${para(kazanc)}</div></div>
      ${aySecici()}
    </div>
    <div class="hero-alt"><span>${liste.length} satış</span><span>${para(ciro)} satış tutarı</span>${bekleyen.length ? `<span>${bekleyen.length} bekleyen sipariş</span>` : ''}</div>
    ${st.ayar.aylikHedef ? `<div class="hedef"><div class="hedef-ust"><span>Aylık hedef ${para(st.ayar.aylikHedef)}</span><b>${yuzde(Math.max(0, kazanc) / st.ayar.aylikHedef * 100)}</b></div>
      <div class="hedef-cubuk"><i style="width:${Math.min(100, Math.max(0, kazanc) / st.ayar.aylikHedef * 100)}%"></i></div>
      <small>${kazanc >= st.ayar.aylikHedef ? 'Hedefe ulaşıldı 🎉' : `Hedefe ${para(st.ayar.aylikHedef - kazanc)} kaldı`}</small></div>` : ''}
  </section>
  <div class="istatistik">
    ${ist('var(--c1)', 'ciro', 'Satış tutarı', para(ciro))}
    ${ist('var(--c7)', 'gider', 'Malzeme ve gider', para(gider))}
    ${ist('var(--c3)', 'marj', 'Kâr marjı', ciro ? yuzde(marj) : '—')}
    ${ist('var(--c5)', 'adet', 'Satılan', `${sayi(adet)} <small style="font-size:14px;font-weight:500">adet</small>`)}
  </div>
  <div class="hizli">
    <button class="btn ana" data-act="satis-yeni">+ Satış ekle</button>
    <button class="btn" data-act="is-yeni">+ Yeni iş</button>
  </div>

  ${uyarilar()}
  ${bekleyen.length ? `<div class="alt-baslik">Bekleyen siparişler (${bekleyen.length})</div>
  <div class="kart liste">${bekleyen.map(satisSatiri).join('')}</div>` : ''}

  <div class="iki-kolon">
    <div>
      <div class="alt-baslik">En çok kazandıranlar</div>
      ${enIyi.length ? `<div class="kart liste">${enIyi.map((i, n) => `
        <div class="satir" style="cursor:default;--renk:${RENKLER[n % RENKLER.length]}"><span class="sira">${n + 1}</span>
          <div class="orta"><div class="ad">${esc(i.ad)}</div><div class="cubuk"><i style="width:${Math.max(4, i.kazanc / enCok * 100)}%"></i></div></div>
          <div class="sag"><div class="b ${i.kazanc < 0 ? 'negatif' : ''}">${para(i.kazanc)}</div><div class="k soluk">${sayi(i.adet)} adet</div></div></div>`).join('')}</div>`
      : `<div class="kart bos"><div class="simge">📈</div><p>Bu ay henüz satış girilmedi.</p></div>`}
    </div>
    ${katlar.length ? `<div>
      <div class="alt-baslik">Kategoriye göre</div>
      <div class="kart liste">${katlar.map(i => `
        <div class="satir" style="cursor:default;--renk:${katRenk(i.ad)}"><span class="avatar">${katEmoji(i.ad)}</span>
          <div class="orta"><div class="ad">${esc(i.ad)}</div><div class="cubuk"><i style="width:${kazanc > 0 ? Math.max(4, i.kazanc / kazanc * 100) : 0}%"></i></div></div>
          <div class="sag"><div class="b">${para(i.kazanc)}</div><div class="k soluk">${kazanc > 0 ? yuzde(i.kazanc / kazanc * 100) : ''}</div></div></div>`).join('')}</div>
    </div>` : ''}
  </div>`;
}

/** Özet'teki uyarı kartları: yedek hatırlatması, teslim takvimi, tahsil edilmemiş ödemeler */
function uyarilar() {
  const parca = [];
  const yg = K.yedekGun();
  if (S.doluMu() && (yg == null || yg >= 7)) parca.push(`<div class="uyari-serit"><span>💾</span><span>${yg == null ? 'Henüz hiç yedek almadınız.' : `Son yedek ${yg} gün önce alındı.`} Verileriniz yalnızca bu iPad'de; ara sıra yedek alın.</span>
    <button class="btn kucuk" data-act="yedek-al">Yedeği kaydet</button></div>`);
  // Teslim takvimi: gecikenler + 7 gün
  const tarihli = Object.values(st.satislar).map(s => ({ s, r: O.teslimRozeti(s) })).filter(x => x.r && x.r.gun <= 7).sort((a, b) => a.r.gun - b.r.gun);
  if (tarihli.length) {
    const gunAd = g => g < 0 ? 'Geciken' : g === 0 ? 'Bugün' : g === 1 ? 'Yarın' : R.tarihSaatYaz(R.yerelTarih(new Date(Date.now() + g * 86400000)), false);
    const gruplar = {};
    for (const x of tarihli) (gruplar[x.r.gun < 0 ? -1 : x.r.gun] ||= []).push(x.s);
    parca.push(`<div class="alt-baslik">Teslim takvimi</div><div class="takvim-serit">${Object.entries(gruplar).sort((a, b) => a[0] - b[0]).map(([g, l]) => `
      <div class="gun-kart ${g < 0 ? 'gecikti' : g == 0 ? 'bugun' : ''}"><div class="gun-ad">${gunAd(Number(g))}</div>
        ${l.map(s => `<button class="gun-is" data-act="satis" data-id="${s.id}"><b>${esc(s.urunAd || 'Özel iş')}</b><span>${esc(s.musteri || '')}${g < 0 ? ' · ' + esc(O.teslimRozeti(s).yazi) : ''}</span></button>`).join('')}</div>`).join('')}</div>`);
  }
  const al = O.alacaklar();
  if (al.length) {
    const toplam = al.reduce((t, x) => t + x.o.kalan, 0);
    parca.push(`<div class="alt-baslik">Tahsil edilmemiş · ${para(toplam)}</div><div class="kart liste">${al.slice(0, 6).map(({ s, o }) => `
      <div class="satir" role="button" tabindex="0" data-act="satis" data-id="${s.id}"><span class="avatar" style="--renk:var(--kirmizi)">₺</span>
        <div class="orta"><div class="ad">${esc(s.musteri || s.urunAd || 'Müşteri')}</div><div class="ek">${esc(s.urunAd || '')} · ${esc(tarihYaz(s.tarih))}${o.tahsil ? ' · ödenen ' + para(o.tahsil) : ''}</div></div>
        <div class="sag"><div class="b negatif">${para(o.kalan)}</div><div class="k soluk">kalan</div></div>
        <button class="btn kucuk" data-act="odeme-tam" data-id="${s.id}">Ödendi</button></div>`).join('')}</div>`);
  }
  return parca.join('');
}

function hosgeldin() {
  return `<div class="kart ic" style="margin-bottom:16px">
    <h2 style="font-size:19px">Hoş geldiniz 👋</h2>
    <div class="adimlar">
      <div class="adim" style="--renk:var(--c1)"><span class="sira">1</span><span><b>Malzemeler</b>'e toptancıdan aldığınız malzemeleri ve fiyatlarını girin.</span></div>
      <div class="adim" style="--renk:var(--c5)"><span class="sira">2</span><span><b>İşler</b>'e çanta, nakış, paça gibi işlerinizi ekleyin; maliyet ve kazanç kendiliğinden hesaplanır.</span></div>
      <div class="adim" style="--renk:var(--c3)"><span class="sira">3</span><span>Sattıkça <b>Satış ekle</b> ile kaydedin; aylık kazancınız burada görünür.</span></div>
    </div>
    <button class="btn kesik kucuk" data-act="ornek" style="margin-top:12px">✨ Örnek verilerle dene</button>
  </div>`;
}

function urunler() {
  const kats = [...new Set([...st.ayar.kategoriler, ...Object.values(st.urunler).map(u => u.kategori).filter(Boolean)])];
  const ara = urunAra.toLocaleLowerCase('tr');
  const liste = Object.values(st.urunler)
    .filter(u => (!urunKat || u.kategori === urunKat) && (!ara || (u.ad || '').toLocaleLowerCase('tr').includes(ara)))
    .sort((a, b) => trSirala(a.ad || '', b.ad || ''));
  const toplam = Object.keys(st.urunler).length;
  return `
  <div class="baslik"><h1>İşler</h1><button class="btn ana kucuk" data-act="is-yeni">+ Yeni iş</button></div>
  ${toplam ? `<input class="arama" type="search" placeholder="İş ara…" data-ara="urun" value="${esc(urunAra)}">
  <div class="cipler">
    <button class="cip tumu ${!urunKat ? 'aktif' : ''}" data-act="kat" data-id="">Tümü · ${toplam}</button>
    ${kats.map(k => `<button class="cip ${k === urunKat ? 'aktif' : ''}" style="--renk:${katRenk(k)}" data-act="kat" data-id="${esc(k)}"><i></i>${esc(k)}</button>`).join('')}
  </div>` : ''}
  ${liste.length ? `<div class="urun-izgara">${liste.map(urunKarti).join('')}</div>`
    : toplam ? `<div class="kart bos"><div class="simge">🔍</div><p>Uyan iş yok.</p></div>`
      : `<div class="kart bos"><div class="simge">👜</div><p>Henüz iş eklenmedi.<br>Çanta, nakış, paça… yaptığınız her işi ekleyin; maliyetini ve kazancını hemen görün.</p>
         <button class="btn ana" data-act="is-yeni">+ İlk işi ekle</button></div>`}`;
}

function urunKarti(u) {
  const h = urunHesap(u, st);
  const etiket = !h.fiyat ? `<span class="etiket gri">Fiyat yok</span>`
    : `<span class="etiket ${h.cep < 0 ? 'kirmizi' : 'yesil'}">${yuzde(h.marj)}</span>`;
  return `<div class="kart urun-kart" role="button" tabindex="0" data-act="is" data-id="${u.id}" style="--renk:${katRenk(u.kategori)}">
    <div class="gorsel">${u.kategori ? `<span class="kat-rozet">${esc(u.kategori)}</span>` : ''}${u.foto ? `<img src="${u.foto}" alt="" loading="lazy">` : katEmoji(u.kategori)}</div>
    <div class="bilgi">
      <div class="ad">${esc(u.ad)}</div>
      <div class="fiyat"><b>${h.fiyat ? para(h.fiyat) : '—'}</b>${etiket}</div>
      <div class="ek soluk" style="font-size:13px;margin-top:2px">Kazanç <span class="${h.cep < 0 ? 'negatif' : 'pozitif'}">${h.fiyat ? para(h.cep) : '—'}</span></div>
    </div>
    ${islemler('is', u.id, true)}</div>`;
}

function kullanimSayisi() {
  const say = {};
  for (const u of Object.values(st.urunler)) for (const k of u.kalemler || []) say[k.malzemeId] = (say[k.malzemeId] || 0) + 1;
  return say;
}

function malzemeler() {
  const ara = malzAra.toLocaleLowerCase('tr');
  const say = kullanimSayisi();
  const liste = Object.values(st.malzemeler)
    .filter(m => !ara || `${m.ad} ${m.tedarikci} ${m.kategori}`.toLocaleLowerCase('tr').includes(ara));
  const gruplar = {};
  for (const m of liste) (gruplar[m.kategori || 'Diğer'] ||= []).push(m);
  const toplam = Object.keys(st.malzemeler).length;
  const az = Object.values(st.malzemeler).filter(O.stokAzMi);
  return `
  <div class="baslik"><h1>Malzemeler</h1><div class="btn-satir"><button class="btn kucuk" data-act="alisveris">🛒 Alışveriş listesi${az.length ? ` (${az.length})` : ''}</button><button class="btn ana kucuk" data-act="malz-yeni">+ Malzeme</button></div></div>
  ${az.length ? `<div class="uyari-serit kirmizi"><span>⚠️</span><span><b>${az.length} malzeme azaldı:</b> ${az.map(m => esc(m.ad)).join(', ')}</span><button class="btn kucuk" data-act="alisveris">Listeyi aç</button></div>` : ''}
  ${toplam ? `<input class="arama" type="search" placeholder="Malzeme ya da toptancı ara…" data-ara="malz" value="${esc(malzAra)}">` : ''}
  ${Object.keys(gruplar).sort(trSirala).map(g => `
    <div class="alt-baslik">${esc(g)}</div>
    <div class="kart liste">${gruplar[g].sort((a, b) => trSirala(a.ad || '', b.ad || '')).map(m => `
      <div class="satir" role="button" tabindex="0" data-act="malz" data-id="${m.id}" style="--renk:${RENKLER[(Object.keys(gruplar).sort(trSirala).indexOf(g) + 2) % RENKLER.length]}">
        <span class="avatar">${malzEmoji(m.kategori + ' ' + m.ad)}</span>
        <div class="orta"><div class="ad">${esc(m.ad)}</div>
          <div class="ek">${para(m.paketFiyat)} / ${sayi(m.paketMiktar)} ${esc(m.birim)}${m.tedarikci ? ' · ' + esc(m.tedarikci) : ''}</div></div>
        <div class="sag"><div class="b">${para(birimFiyat(m))}</div><div class="k soluk">/ ${esc(m.birim)}${say[m.id] ? ` · ${say[m.id]} işte` : ''}</div>
          ${m.stok != null && m.stok !== '' ? `<div class="k"><span class="etiket ${O.stokAzMi(m) ? 'kirmizi' : 'gri'}">Stok ${sayi(m.stok)} ${esc(kisaBirim(m.birim))}</span></div>` : ''}</div>
        ${islemler('malz', m.id)}
      </div>`).join('')}</div>`).join('')}
  ${!toplam ? `<div class="kart bos"><div class="simge">🧶</div><p>Toptancıdan aldığınız ip, astar, sap, fermuar, süs gibi malzemeleri fiyatlarıyla ekleyin.<br>Fiyat değişince buradan güncelleyin; tüm işlerin maliyeti kendiliğinden güncellenir.</p>
    <button class="btn ana" data-act="malz-yeni">+ İlk malzemeyi ekle</button></div>`
    : !liste.length ? `<div class="kart bos"><p>Aramaya uyan malzeme yok.</p></div>` : ''}`;
}

/** Satışları yeniden eskiye sıralamak için: tarih + saat */
const sirala = (a, b) => `${b.tarih || ''}T${b.saat || ''}`.localeCompare(`${a.tarih || ''}T${a.saat || ''}`) || (b.guncel || 0) - (a.guncel || 0);

function satisSatiri(s) {
  const h = satisHesap(s);
  const d = DURUM[s.durum] || DURUM.teslim;
  const ek = [tarihYaz(s.tarih) + (s.saat ? ' ' + s.saat : ''), s.musteri, (s.adet || 0) > 1 ? `${sayi(s.adet)} adet` : ''].filter(Boolean).map(esc).join(' · ');
  const ilerlet = d.sonraki ? `<button class="btn kucuk ilerlet" data-act="satis-ilerlet" data-id="${s.id}" style="--renk:${DURUM[d.sonraki].css}">${d.dugme}</button>` : '';
  const tr = O.teslimRozeti(s), od = O.odemeDurumu(s);
  const rozetler = [tr && `<span class="etiket ${tr.renk}">${esc(tr.yazi)}</span>`, od.kalan > 0 && s.durum !== 'iptal' && `<span class="etiket kirmizi">Kalan ${para(od.kalan)}</span>`].filter(Boolean).join('');
  const krono = ['siparis', 'yapiliyor'].includes(s.durum)
    ? `<button class="btn kucuk krono ${O.kronoCalisiyor(s) ? 'calisiyor' : ''}" data-act="krono" data-id="${s.id}" title="İş kronometresi">${O.kronoCalisiyor(s) ? '⏸' : '▶'} <span data-krono="${s.id}">${O.kronoYaz(O.kronoMs(s))}</span></button>` : '';
  return `<div class="satir" role="button" tabindex="0" data-act="satis" data-id="${s.id}" style="--renk:${katRenk(s.kategori)}">
    <span class="avatar">${katEmoji(s.kategori)}</span>
    <div class="orta"><div class="ad">${esc(s.urunAd || 'Özel iş')}</div><div class="ek">${ek}</div>${rozetler ? `<div class="rozetler">${rozetler}</div>` : ''}</div>
    <div class="sag"><div class="b">${para(h.ciro)}</div>
      <div class="k">${s.durum && s.durum !== 'teslim' ? `<span class="etiket ${d.renk}">${d.kisa}</span>` : `<span class="${h.kazanc < 0 ? 'negatif' : 'pozitif'}">+${para(h.kazanc)}</span>`}</div></div>
    ${krono}${ilerlet}${islemler('satis', s.id)}
  </div>`;
}

function satislar() {
  const liste = aySatislari().sort(sirala);
  const gecerli = liste.filter(s => s.durum !== 'iptal');
  const ciro = gecerli.reduce((t, s) => t + satisHesap(s).ciro, 0);
  const kazanc = gecerli.reduce((t, s) => t + satisHesap(s).kazanc, 0);
  return `
  <div class="baslik"><h1>Satışlar</h1><div class="btn-satir"><button class="btn kucuk" data-act="galeri">🖼️ Galeri</button><button class="btn ana kucuk" data-act="satis-yeni">+ Satış</button></div></div>
  <div style="margin-bottom:12px">${aySecici()}</div>
  <div class="ozet-serit">
    <div class="kart" style="border-top:4px solid var(--c1)"><div class="e">Satış</div><div class="d">${gecerli.length}</div></div>
    <div class="kart" style="border-top:4px solid var(--c4)"><div class="e">Tutar</div><div class="d">${para(ciro)}</div></div>
    <div class="kart" style="border-top:4px solid var(--c3)"><div class="e">Kazanç</div><div class="d pozitif">${para(kazanc)}</div></div>
  </div>
  ${liste.length ? `<div class="kart liste">${liste.map(satisSatiri).join('')}</div>`
    : `<div class="kart bos"><div class="simge">🧾</div><p>${ayAdi(ay)} ayında satış yok.</p><button class="btn ana" data-act="satis-yeni">+ Satış ekle</button></div>`}`;
}

function raporlar() {
  const [bas, bit, baslik] = R.donemAraligi(rapor);
  const r = R.raporHesap(st, bas, bit);
  const T = r.T;
  const t = R.raporTablolari(r);
  const ek = raporEkleri(bas, bit, r);
  return `
  <div class="baslik"><h1>Raporlar</h1><div class="btn-satir">
    <button class="btn kucuk" data-act="giderler">💸 Genel giderler</button>
    <button class="btn kucuk" data-act="excel" ${r.satisSay ? '' : 'disabled'}>📊 Excel</button>
    <button class="btn ana kucuk" data-act="rapor-pdf" ${r.satisSay ? '' : 'disabled'}>PDF olarak al</button></div></div>
  <div class="cipler">${R.DONEMLER.map(([k, ad]) => `<button class="cip ${rapor.donem === k ? 'aktif' : ''}" data-act="rapor-donem" data-id="${k}">${ad}</button>`).join('')}</div>
  ${rapor.donem === 'ozel' ? `<div class="ikili" style="margin-bottom:16px">
    <label class="alan">Başlangıç<input type="date" data-rapor="bas" value="${bas}"></label>
    <label class="alan">Bitiş<input type="date" data-rapor="bit" value="${bit}"></label></div>` : ''}
  <p class="donem-baslik">${esc(baslik)}</p>
  ${r.satisSay ? `
  <div class="istatistik">
    ${ist('var(--c1)', 'ciro', 'Satış geliri', para(T.ciro))}
    ${ist('var(--c7)', 'gider', 'Toplam gider', para(T.gider))}
    ${ist(T.kazanc < 0 ? 'var(--kirmizi)' : 'var(--c3)', 'marj', T.kazanc < 0 ? 'Zarar' : 'Kâr', para(T.kazanc))}
    ${ist('var(--c5)', 'adet', 'Kâr marjı', T.ciro ? yuzde(T.marj) : '—')}
  </div>
  <div class="kart ic rapor-bolum"><h3>Son 12 ay · aylık kâr</h3>${aylikGrafik()}</div>
  <div class="iki-kolon"><div class="kart ic rapor-bolum"><h3>Gelir tablosu</h3>${t.gelir}</div>
    <div class="kart ic rapor-bolum">${ek.net}${ek.tahsilat}</div></div>
  ${ek.kanal ? `<div class="kart ic rapor-bolum">${ek.kanal}</div>` : ''}
  ${t.isTablo ? `<div class="kart ic rapor-bolum">${t.isTablo}</div>` : ''}
  ${t.katTablo ? `<div class="kart ic rapor-bolum">${t.katTablo}</div>` : ''}
  ${t.malzTablo ? `<div class="kart ic rapor-bolum">${t.malzTablo}</div>` : ''}
  ${t.ayTablo ? `<div class="kart ic rapor-bolum">${t.ayTablo}</div>` : ''}`
  : `<div class="kart bos"><div class="simge">📊</div><p>Bu dönemde satış yok.<br>Başka bir dönem seçin ya da satış ekleyin.</p></div>`}`;
}

/** Raporun ek bölümleri: genel giderler + net kâr, tahsilat, sipariş kaynakları (ekran + PDF ortak) */
function raporEkleri(bas, bit, r) {
  const gg = G.giderOzeti(bas, bit);
  const T = r.T;
  const net = T.kazanc - gg.toplam;
  const sat = Object.values(st.satislar).filter(s => s.tarih >= bas && s.tarih <= bit && s.durum !== 'iptal');
  let tahsil = 0, kalan = 0;
  for (const s of sat) { const o = O.odemeDurumu(s); tahsil += o.tahsil; kalan += o.kalan; }
  const kanallar = {};
  for (const s of sat) {
    const k = s.kaynak || 'Belirtilmemiş', h = satisHesap(s);
    const o = (kanallar[k] ||= { ad: k, adet: 0, ciro: 0, kazanc: 0 });
    o.adet++; o.ciro += h.ciro; o.kazanc += h.kazanc;
  }
  const kl = Object.values(kanallar).sort((a, b) => b.ciro - a.ciro);
  const satir = (a, b, c = '') => `<tr class="${c}"><td>${a}</td><td class="sayi">${b}</td></tr>`;
  return {
    genel: gg.toplam,
    net: `<h3>Genel giderler ve net kâr</h3><table class="tablo"><tbody>
      ${satir('Brüt kâr <small>(satışlardan)</small>', para(T.kazanc))}
      ${Object.entries(gg.turler).map(([k, v]) => satir(`− ${esc(k)}`, para(v))).join('')}
      ${gg.toplam ? '' : satir('− Genel gider <small>(girilmedi)</small>', para(0))}
      ${satir('Net kâr', `<span class="${net < 0 ? 'negatif' : 'pozitif'}">${para(net)}</span>`, 'kalin ara')}
    </tbody></table>`,
    tahsilat: `<h3 style="margin-top:18px">Tahsilat</h3><table class="tablo"><tbody>
      ${satir('Tahsil edilen', `<span class="pozitif">${para(tahsil)}</span>`)}
      ${satir('Alacak (henüz ödenmedi)', `<span class="${kalan ? 'negatif' : ''}">${para(kalan)}</span>`)}</tbody></table>`,
    kanal: kl.length > 1 || (kl[0] && kl[0].ad !== 'Belirtilmemiş') ? `<h3>Sipariş kaynakları</h3><div class="tablo-kap"><table class="tablo">
      <thead><tr><th>Kaynak</th><th class="sayi">Sipariş</th><th class="sayi">Gelir</th><th class="sayi">Kâr</th><th class="sayi">Gelirdeki payı</th></tr></thead>
      <tbody>${kl.map(k => `<tr><td><b>${esc(k.ad)}</b></td><td class="sayi">${k.adet}</td><td class="sayi">${para(k.ciro)}</td><td class="sayi">${para(k.kazanc)}</td><td class="sayi">${T.ciro ? yuzde(k.ciro / T.ciro * 100) : '—'}</td></tr>`).join('')}</tbody></table></div>` : '',
  };
}

/** Son 12 ayın kârı: tek seri sütun grafik (negatif aylar kırmızı), dokununca değer */
function aylikGrafik() {
  const b = new Date(), aylar = [];
  for (let i = 11; i >= 0; i--) { const d = new Date(b.getFullYear(), b.getMonth() - i, 1); aylar.push(ayAnahtar(d)); }
  const r = R.raporHesap(st, aylar[0] + '-01', R.yerelTarih(new Date(b.getFullYear(), b.getMonth() + 1, 0)));
  const deger = Object.fromEntries(r.aylar.map(a => [a.ad, a.kazanc]));
  const v = aylar.map(a => deger[a] || 0);
  if (!v.some(Boolean)) return '<p class="ipucu">Grafik için henüz yeterli satış yok.</p>';
  const W = 720, H = 210, ust = 22, alt = 26, sol = 4, gen = (W - sol * 2) / 12, bosluk = 2;
  const enB = Math.max(...v, 0), enK = Math.min(...v, 0), aralik = (enB - enK) || 1;
  const y = x => ust + (enB - x) / aralik * (H - ust - alt);
  const sifir = y(0), enYuksek = v.indexOf(Math.max(...v));
  const AY = ['Oca', 'Şub', 'Mar', 'Nis', 'May', 'Haz', 'Tem', 'Ağu', 'Eyl', 'Eki', 'Kas', 'Ara'];
  const cubuk = (x, y1, y2, r) => { // veri ucu 4px yuvarlak, taban düz
    const h = Math.abs(y2 - y1), w = gen - bosluk * 2 - 10, yuk = y2 < y1; const rr = Math.min(r, h, w / 2);
    if (h < 0.5) return '';
    const t = yuk ? y2 : y1, bt = yuk ? y1 : y2;
    return yuk ? `M${x} ${bt}V${t + rr}Q${x} ${t} ${x + rr} ${t}H${x + w - rr}Q${x + w} ${t} ${x + w} ${t + rr}V${bt}Z`
      : `M${x} ${t}H${x + w}V${bt - rr}Q${x + w} ${bt} ${x + w - rr} ${bt}H${x + rr}Q${x} ${bt} ${x} ${bt - rr}Z`;
  };
  return `<div class="grafik"><div class="grafik-ipucu" id="grafik-ipucu">Bir aya dokunun</div>
  <svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Son 12 ayın aylık kârı">
    <line x1="0" x2="${W}" y1="${sifir}" y2="${sifir}" class="taban"/>
    ${v.map((x, i) => {
      const xx = sol + i * gen + bosluk + 5, [yy, mm] = aylar[i].split('-').map(Number);
      const etiket = i === 11 || i === enYuksek ? `<text x="${xx + (gen - bosluk * 2 - 10) / 2}" y="${x >= 0 ? y(x) - 6 : y(x) + 14}" class="deger">${esc(para(x))}</text>` : '';
      return `<g class="grafik-cubuk" data-ipucu="${AY[mm - 1]} ${yy}: ${esc(para(x))} kâr">
        <rect x="${sol + i * gen}" y="0" width="${gen}" height="${H}" fill="transparent"/>
        <path d="${cubuk(xx, sifir, y(x), 4)}" class="${x < 0 ? 'eksi' : 'arti'}"/>${etiket}
        <text x="${xx + (gen - bosluk * 2 - 10) / 2}" y="${H - 8}" class="ay">${AY[mm - 1]}</text></g>`;
    }).join('')}
  </svg></div>`;
}

// ---- PDF: hazırla → "Paylaş / Dosyalara kaydet" ekranı
async function pdfVer(uret) {
  bildirim('PDF hazırlanıyor…');
  let dosya;
  try { dosya = await uret(); } catch (e) { console.error(e); bildirim('PDF hazırlanamadı'); return; }
  $('#bildirim').hidden = true;
  const url = URL.createObjectURL(dosya);
  const d = sayfaAc({
    baslik: 'PDF hazır', vazgec: 'Kapat',
    govde: `<div class="kart ic pdf-hazir">
      <div class="pdf-simge">PDF</div>
      <div><b>${esc(dosya.name)}</b><div class="soluk">${sayi(Math.round(dosya.size / 1024))} KB</div></div>
      <div class="btn-satir" style="margin-top:14px"><button class="btn ana" data-k="paylas">Paylaş / Dosyalara kaydet</button>
        <a class="btn" href="${url}" target="_blank" rel="noopener">Görüntüle</a></div>
      <p class="ipucu" style="margin-top:10px">Paylaş menüsünden <b>Dosyalara Kaydet</b>, <b>Yazdır</b> ya da WhatsApp'ı seçebilirsiniz.</p></div>`,
  });
  d.addEventListener('close', () => setTimeout(() => URL.revokeObjectURL(url), 60000));
  $('[data-k=paylas]', d).addEventListener('click', async () => {
    if (navigator.canShare?.({ files: [dosya] })) {
      try { await navigator.share({ files: [dosya], title: dosya.name }); return; } catch (e) { if (e.name === 'AbortError') return; }
    }
    const a = document.createElement('a');
    a.href = url; a.download = dosya.name;
    document.body.append(a); a.click(); a.remove();
  });
}
/** İş bitince: fotoğraf/video çek → tanıtım; ya da iş raporu */
function isBittiSor(s) {
  const d = sayfaAc({
    baslik: 'İş bitti 🎉', vazgec: 'Kapat',
    govde: `<div class="is-bitti">
      <div class="is-bitti-ust"><div class="konfeti">🎉</div><h2>${esc(s.urunAd || 'İş')} tamamlandı</h2>
        <p class="soluk">${esc(s.musteri || '')}${s.musteri ? ' · ' : ''}${para(satisHesap(s).ciro)}</p></div>
      <button class="secenek ana" data-k="studyo"><span class="s-simge">📸</span><span><b>Ürünün fotoğrafını / videosunu çek</b>
        <small>Instagram ve WhatsApp için tanıtım videosu ve ürün görselleri hazırlansın</small></span></button>
      <button class="secenek" data-k="pdf"><span class="s-simge">📄</span><span><b>İş raporu (PDF)</b>
        <small>Zaman ve fiyat açısından kâr / zarar</small></span></button>
    </div>`,
  });
  d.addEventListener('click', e => {
    const t = e.target.closest('[data-k=studyo],[data-k=pdf]');
    if (!t) return;
    d.close();
    if (t.dataset.k === 'studyo') tanitimStudyosu(st.satislar[s.id] || s); else isRaporu(st.satislar[s.id] || s);
  });
}
const isRaporu = s => pdfVer(() => R.isRaporuPdf(s, st, (DURUM[s.durum] || DURUM.teslim).ad));

function ayarlar() {
  const d = B.durum;
  let bulutHtml;
  if (!d.kurulu) {
    bulutHtml = `<p class="ipucu">Bulut eşitleme henüz açılmadı. Açıldığında iPhone ve iPad'de girilen her şey otomatik olarak iki cihazda da görünür. Şimdilik veriler yalnızca bu cihazda saklanıyor.</p>`;
  } else if (d.kullanici) {
    bulutHtml = `<p style="margin:0 0 10px"><span class="etiket yesil">✓ Bağlı</span> <b>${esc(d.kullanici.email)}</b></p>
      <p class="ipucu">Bu cihazda yaptığınız her değişiklik, aynı hesapla giriş yapılan diğer cihazlarda (iPhone / iPad) birkaç saniye içinde görünür. İnternet yokken de çalışır; bağlantı gelince eşitlenir.</p>
      ${d.hata ? `<p class="ipucu negatif">${esc(d.hata)}</p>` : ''}
      <button class="btn kucuk" data-act="cikis" style="margin-top:10px">Çıkış yap</button>`;
  } else if (!d.hazir) {
    bulutHtml = `<p class="ipucu">${esc(d.hata || 'Buluta bağlanılıyor…')}</p>`;
  } else {
    bulutHtml = `<p class="ipucu" style="margin-bottom:10px">iPhone ve iPad'de <b>aynı e-posta ve şifreyle</b> giriş yapın; veriler iki cihazda eşit olsun. İlk kez kullanıyorsanız "Hesap oluştur"a basın.</p>
      <div class="form">
        <input id="eposta" type="email" autocomplete="username" placeholder="E-posta" inputmode="email">
        <input id="sifre" type="password" autocomplete="current-password" placeholder="Şifre (en az 6 karakter)">
        <div class="btn-satir"><button class="btn ana" data-act="giris">Giriş yap</button><button class="btn" data-act="kayit">Hesap oluştur</button></div>
        <button class="btn metin" data-act="sifre-unuttum" style="align-self:flex-start">Şifremi unuttum</button>
        <p class="ipucu negatif" id="giris-hata"></p>
      </div>`;
  }
  const ornekVar = Object.keys(st.urunler).some(id => id.startsWith('ornek_')) || Object.keys(st.malzemeler).some(id => id.startsWith('ornek_'));
  return `
  <div class="baslik"><h1>Ayarlar</h1></div>
  <div class="iki-kolon">
  <div>
    <div class="alt-baslik">Hesaplama</div>
    <div class="kart ic form">
      <label class="alan">Emeğinizin saat ücreti
        <div class="birimli"><input data-ayar="saatUcreti" inputmode="decimal" value="${yaz(st.ayar.saatUcreti)}" placeholder="0"><span class="b">₺/saat</span></div></label>
      <p class="ipucu">Girerseniz, işlerde harcadığınız saat kadar emek ücreti maliyete eklenir ve önerilen fiyat buna göre hesaplanır. Boş bırakabilirsiniz.</p>
      <label class="alan">Hedef kâr oranı
        <div class="birimli"><input data-ayar="hedefKar" inputmode="decimal" value="${yaz(st.ayar.hedefKar)}" placeholder="50"><span class="b">%</span></div></label>
      <p class="ipucu">Önerilen satış fiyatı = maliyet + bu oran kadar kâr.</p>
    </div>

    <div class="alt-baslik">İşletme</div>
    <div class="kart ic form">
      <div class="ikili">
        <label class="alan">Instagram<input data-ayar-metin="instagram" value="${esc(st.ayar.instagram || '')}" placeholder="envai_tasarim" autocapitalize="off"></label>
        <label class="alan">WhatsApp<input data-ayar-metin="whatsapp" value="${esc(st.ayar.whatsapp || '')}" placeholder="05xx xxx xx xx" inputmode="tel"></label>
      </div>
      <label class="alan">Aylık kazanç hedefi
        <div class="birimli"><input data-ayar="aylikHedef" inputmode="decimal" value="${yaz(st.ayar.aylikHedef)}" placeholder="Örn. 15000"><span class="b">₺</span></div></label>
      <p class="ipucu">Instagram ve WhatsApp; tanıtım videoları, sipariş fişleri ve tekliflerde kullanılır. Hedef, Özet'te ilerleme çubuğu olarak görünür.</p>
      ${st.ayar.instagram ? `<a class="btn kucuk" href="https://www.instagram.com/${esc(st.ayar.instagram.replace(/^@/, ''))}" target="_blank" rel="noopener" style="align-self:flex-start">Instagram sayfasını aç ↗</a>` : ''}
    </div>

    <div class="alt-baslik">Nakış</div>
    <div class="kart ic form">
      <div class="ikili">
        <label class="alan">1000 dikiş maliyeti<div class="birimli"><input data-ayar="dikisFiyati" inputmode="decimal" value="${yaz(st.ayar.dikisFiyati)}" placeholder="Örn. 2"><span class="b">₺</span></div></label>
        <label class="alan">Makine hızı<div class="birimli"><input data-ayar="makineHizi" inputmode="decimal" value="${yaz(st.ayar.makineHizi)}" placeholder="600"><span class="b">dikiş/dk</span></div></label>
      </div>
      <p class="ipucu">İş kartına <b>.pes</b> dosyası (Nakış Çizim'den) yüklediğinizde dikiş sayısı okunur; nakışın iplik/tela/makine maliyeti ve makine süresi bu değerlerle hesaplanır.</p>
    </div>

    ${katListesi('İş kategorileri', 'kategoriler', 'örn. Perde', k => `<span class="avatar" style="--renk:${katRenk(k)}">${katEmoji(k)}</span>`)}
    ${katListesi('Malzeme kategorileri', 'malzemeKategorileri', 'örn. Dantel', k => `<span class="avatar" style="--renk:var(--c6)">${malzEmoji(k)}</span>`)}
  </div>
  <div>
    ${d.kurulu ? `<div class="alt-baslik">iPhone ⇄ iPad eşitleme</div>
    <div class="kart ic">${bulutHtml}</div>` : ''}

    <div class="alt-baslik">Uygulama kilidi</div>
    <div class="kart ic">
      <p class="ipucu" style="margin-bottom:10px">${K.pinVar() ? '🔒 Kilit açık: uygulama her açılışta PIN soruyor.' : 'Uygulama açılırken 4–6 haneli PIN sorulsun (PIN yalnızca bu iPad\'de saklanır).'} 3 dakikadan uzun arka planda kalınca yeniden sorulur. PIN göz gezdirmeyi engeller, verileri şifrelemez; asıl koruma iPad'in kendi şifresidir.</p>
      <div class="btn-satir">${K.pinVar() ? '<button class="btn kucuk" data-act="pin-koy">PIN\'i değiştir</button><button class="btn tehlike kucuk" data-act="pin-kaldir">Kilidi kaldır</button>' : '<button class="btn kucuk" data-act="pin-koy">PIN belirle</button>'}</div>
    </div>

    <div class="alt-baslik">Yedek</div>
    <div class="kart ic">
      <p class="ipucu" style="margin-bottom:10px">Tüm verilerinizi tek dosya olarak saklayın (örneğin iCloud Drive'a) ya da yedekten geri yükleyin. ${K.yedekGun() == null ? '<b>Henüz yedek alınmadı.</b>' : `Son yedek: <b>${K.yedekGun() === 0 ? 'bugün' : K.yedekGun() + ' gün önce'}</b>.`} Fotoğraf ve videolar yedeğe dahil değildir.</p>
      <div class="btn-satir"><button class="btn" data-act="yedek-al">Yedeği kaydet</button>
        <label class="btn">Yedekten yükle<input type="file" accept=".json,application/json" hidden data-act-change="yedek-yukle"></label></div>
    </div>

    <div class="alt-baslik">Örnek veriler</div>
    <div class="kart ic">
      ${ornekVar ? `<p class="ipucu" style="margin-bottom:10px">Örnek veriler yüklü. Kendi verilerinize geçince kaldırabilirsiniz.</p>
        <button class="btn tehlike kucuk" data-act="ornek-sil">Örnek verileri kaldır</button>`
      : `<p class="ipucu" style="margin-bottom:10px">Uygulamayı denemek için örnek bir kağıt ip çanta, paça ve nakış işi ekler.</p>
        <button class="btn kucuk" data-act="ornek">Örnek verileri ekle</button>`}
    </div>
    <p class="ipucu" style="text-align:center;margin-top:24px">EnvaiTasarim · maliyet ve kazanç defteri</p>
  </div></div>`;
}

// ---------------------------------------------------------------- olaylar
const EYLEM = {
  'ay': d => { ay.setMonth(ay.getMonth() + Number(d)); ciz(); },
  'kat': d => { urunKat = d; ciz(); },
  'is-yeni': () => isDuzenle(null),
  'is': id => isDuzenle(id),
  'malz-yeni': () => malzemeDuzenle(null),
  'malz': id => malzemeDuzenle(id),
  'satis-yeni': () => satisDuzenle(null),
  'satis': id => satisDuzenle(id),
  'is-sil': id => isSil(id),
  'krono': id => { const s = O.kronoDegistir(id); bildirim(O.kronoCalisiyor(s) ? `⏱ "${s.urunAd}" için süre tutuluyor` : `⏸ Durdu · toplam ${O.kronoYaz(O.kronoMs(s))}`); },
  'odeme-tam': id => {
    const s = structuredClone(st.satislar[id]), o = O.odemeDurumu(s);
    const onceki = o.durum === 'yok' ? [] : (o.odemeler || []);
    s.odeme = { durum: 'tam', odemeler: [...onceki, { tutar: o.kalan, tarih: bugun(), yontem: 'Nakit' }] };
    S.kaydet('satislar', s); bildirim(`${para(o.kalan)} tahsil edildi`);
  },
  'mus-yeni': () => M.musteriDuzenle(null),
  'mus': id => M.musteriDuzenle(id),
  'mus-sil': id => M.musteriSil(id),
  'mus-kaydet': ad => M.musteriDuzenle(null, m => {
    if (!m) return; // aynı addaki satışları bu müşteriye bağla
    for (const s of Object.values(st.satislar)) if (!s.musteriId && (s.musteri || '').trim() === ad) S.kaydet('satislar', { ...s, musteriId: m.id });
  }, ad),
  'alisveris': () => alisverisListesi(),
  'galeri': () => { location.hash = '#galeri'; },
  'biten': id => BT.bitenDetay(id),
  'biten-filtre': f => { BT.filtreAyarla(f); ciz(); },
  'giderler': () => { const [bas, bit, baslik] = R.donemAraligi(rapor); G.giderlerSayfasi(bas, bit, baslik); },
  'excel': async () => {
    const [bas, bit, baslik] = R.donemAraligi(rapor);
    const dosyalar = excelDosyalari(bas, bit, '-' + baslik.replace(/[^\p{L}\p{N}]+/gu, '-'));
    if (navigator.canShare?.({ files: dosyalar })) { try { await navigator.share({ files: dosyalar, title: 'Envai Tasarım · ' + baslik }); return; } catch (e) { if (e.name === 'AbortError') return; } }
    dosyalar.forEach((f, i) => setTimeout(() => dosyaIndir(f), i * 400));
  },
  'pin-koy': async () => {
    const p1 = (prompt('Yeni PIN (4–6 rakam):') || '').trim();
    if (!/^\d{4,6}$/.test(p1)) return p1 && bildirim('PIN 4–6 rakam olmalı');
    if ((prompt('PIN\'i tekrar yazın:') || '').trim() !== p1) return bildirim('PIN\'ler aynı değil');
    await K.pinKoy(p1); ciz(); bildirim('🔒 Kilit açıldı: uygulama her açılışta PIN soracak');
  },
  'pin-kaldir': () => { if (confirm('Uygulama kilidi kaldırılsın mı?')) { K.pinKaldir(); ciz(); bildirim('Kilit kaldırıldı'); } },
  'satis-ilerlet': id => {
    const s = structuredClone(st.satislar[id]);
    const once = s.durum, yeni = DURUM[s.durum]?.sonraki;
    if (!yeni) return;
    s.durum = yeni;
    durumZamanla(s, yeni);
    if (yeni === 'hazir' && !Number.isFinite(s.calismaSaat)) s.calismaSaat = R.satisAnaliz(s, st).saat;
    if (s.krono?.bas) { s.krono.toplam += Date.now() - s.krono.bas; s.krono.bas = null; s.calismaSaat = r2(s.krono.toplam / 3600000); }
    // stok yalnızca bekleyen → biten geçişinde düşülür (eski hazır/teslim kayıtlarda tekrar düşmesin)
    if (BITTI.includes(yeni) && !BITTI.includes(once) && !s.stokDusuldu) { O.stokUygula(s, -1); s.stokDusuldu = true; }
    const kayit = S.kaydet('satislar', s);
    if (BITTI.includes(yeni) && !BITTI.includes(DURUM_ONCEKI[yeni])) isBittiSor(kayit);
    else if (BITTI.includes(yeni)) bildirim(`"${s.urunAd}" teslim edildi`, () => isBittiSor(kayit), 'Tanıtım / rapor');
    else bildirim(`"${s.urunAd}" işleme alındı`);
  },
  'rapor-donem': d => { rapor.donem = d; ciz(); },
  'rapor-pdf': () => {
    const [bas, bit, baslik] = R.donemAraligi(rapor);
    const r = R.raporHesap(st, bas, bit), ek = raporEkleri(bas, bit, r);
    pdfVer(() => R.donemRaporuPdf(r, baslik, `<div class="rp-iki"><div class="rp-blok">${ek.net}</div><div class="rp-blok">${ek.tahsilat}</div></div>${ek.kanal}`));
  },
  'malz-sil': id => malzSil(id),
  'satis-sil': id => satisSil(id),
  'gider': id => G.giderDuzenle(id),
  'gider-sil': id => G.giderSil(id),
  'kat-duzenle': (i, t) => {
    const anahtar = t.dataset.tur;
    const eski = st.ayar[anahtar][i];
    const yeni = (prompt('Kategorinin yeni adı:', eski) || '').trim();
    if (!yeni || yeni === eski) return;
    if (st.ayar[anahtar].some((x, j) => j !== Number(i) && kucuk(x) === kucuk(yeni))) return bildirim('Bu kategori zaten var');
    // Bu kategoriyi kullanan kayıtlar da yeni adı alsın
    const kollar = anahtar === 'kategoriler' ? ['urunler', 'satislar'] : ['malzemeler'];
    for (const kol of kollar) for (const o of Object.values(st[kol])) if (o.kategori === eski) S.kaydet(kol, { ...o, kategori: yeni });
    if (anahtar === 'kategoriler' && urunKat === eski) urunKat = yeni;
    S.ayarKaydet({ [anahtar]: st.ayar[anahtar].map((x, j) => j === Number(i) ? yeni : x) });
    bildirim(`"${eski}" → "${yeni}"`);
  },
  'ornek': () => { S.ekle(ornekVeri()); bildirim('Örnek veriler eklendi'); },
  'ornek-sil': () => {
    if (!confirm('Örnek veriler (ornek) silinsin mi? Sizin girdiğiniz veriler kalır.')) return;
    for (const k of S.KOLEKSIYONLAR) for (const id of Object.keys(st[k])) if (id.startsWith('ornek_')) S.sil(k, id);
    bildirim('Örnek veriler kaldırıldı');
  },
  'kat-sil': (i, t) => {
    const anahtar = t.dataset.tur;
    const k = st.ayar[anahtar][i];
    const ne = anahtar === 'kategoriler' ? 'işler' : 'malzemeler';
    if (!confirm(`"${k}" kategorisi listeden kaldırılsın mı? (Bu kategorideki ${ne} silinmez.)`)) return;
    S.ayarKaydet({ [anahtar]: st.ayar[anahtar].filter((_, j) => j !== Number(i)) });
  },
  'kat-ekle': (_, t) => {
    const anahtar = t.dataset.tur;
    const girdi = $(`[data-yeni-kat="${anahtar}"]`);
    const ad = girdi.value.trim();
    if (!ad) return girdi.focus();
    if (!katEkle(anahtar, ad)) return bildirim('Bu kategori zaten var');
    bildirim(`"${ad}" eklendi`);
  },
  'yedek-al': yedekAl,
  'giris': () => girisIslem(B.girisYap),
  'kayit': () => girisIslem(B.hesapOlustur),
  'sifre-unuttum': async () => {
    const e = $('#eposta').value;
    if (!e) return ($('#giris-hata').textContent = 'Önce e-posta adresinizi yazın.');
    const h = await B.sifreSifirla(e);
    $('#giris-hata').textContent = h || 'Şifre sıfırlama bağlantısı e-postanıza gönderildi.';
  },
  'cikis': async () => { if (confirm('Çıkış yapılsın mı? Veriler bu cihazda kalır ama artık eşitlenmez.')) await B.cikisYap(); },
};

async function girisIslem(fn) {
  const e = $('#eposta').value, s = $('#sifre').value;
  if (!e || !s) return ($('#giris-hata').textContent = 'E-posta ve şifreyi yazın.');
  $('#giris-hata').textContent = 'Bekleyin…';
  const h = await fn(e, s);
  const el = $('#giris-hata');
  if (el) el.textContent = h || '';
  if (!h) bildirim('Giriş yapıldı, veriler eşitleniyor');
}

const view = $('#view');
view.addEventListener('click', e => {
  const g = e.target.closest('.grafik-cubuk');   // grafikte dokunulan ayın değeri
  if (g) {
    document.querySelectorAll('.grafik-cubuk.secili').forEach(x => x.classList.remove('secili'));
    g.classList.add('secili');
    const ip = document.getElementById('grafik-ipucu'); if (ip) ip.textContent = g.dataset.ipucu;
    return;
  }
  const t = e.target.closest('[data-act]');
  if (t) EYLEM[t.dataset.act]?.(t.dataset.id, t);
});
view.addEventListener('input', e => {
  const a = e.target.dataset.ara;
  if (a === 'urun') { urunAra = e.target.value; ciz(); }
  if (a === 'malz') { malzAra = e.target.value; ciz(); }
  if (a === 'mus') { M.musteriAra(e.target.value); ciz(); }
});
view.addEventListener('change', e => {
  const t = e.target;
  if (t.dataset.ayar) S.ayarKaydet({ [t.dataset.ayar]: oku(t.value) });
  if (t.dataset.ayarMetin) S.ayarKaydet({ [t.dataset.ayarMetin]: t.value.trim().replace(/^@/, '') });
  if (t.dataset.rapor) { rapor[t.dataset.rapor] = t.value; ciz(); }
  if (t.dataset.actChange === 'yedek-yukle' && t.files[0]) yedekYukle(t.files[0]);
});
view.addEventListener('keydown', e => {
  // role="button" satırlar klavyeyle de açılsın
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role=button][data-act]')) {
    e.preventDefault(); EYLEM[e.target.dataset.act]?.(e.target.dataset.id, e.target); return;
  }
  const tur = e.target.dataset.yeniKat;
  if (e.key === 'Enter' && tur) EYLEM['kat-ekle'](null, { dataset: { tur } });
});

// ---------------------------------------------------------------- alt sayfalar


// ---- İş (ürün / hizmet) düzenleme
/** sonra(kayit|null): kaydedilince kayıtla, silinince null ile çağrılır (satış ekranı için). */
function isDuzenle(id, taslak, sonra) {
  const eski = id ? st.urunler[id] : null;
  const u = structuredClone(eski || taslak || {
    ad: '', kategori: urunKat || st.ayar.kategoriler[0] || '', foto: '',
    kalemler: [], ekGiderler: [], fire: 0, iscilikSaat: 0, satisFiyati: 0, not: '',
  });
  u.kalemler ||= []; u.ekGiderler ||= [];

  const d = sayfaAc({
    baslik: eski ? 'İşi düzenle' : 'Yeni iş',
    govde: `
    <div class="foto-satir">
      <label class="foto-sec"><span id="foto-ic">${u.foto ? `<img src="${u.foto}" alt="">` : '📷<br>Fotoğraf<br>ekle'}</span><input type="file" accept="image/*" hidden id="foto-girdi"></label>
      <div class="form">
        <label class="alan">İşin adı<input name="ad" value="${esc(u.ad)}" placeholder="Örn. Kağıt ip omuz çantası" autocomplete="off"></label>
        ${katSeciciHtml('kategoriler', u.kategori, 'Kategorisiz')}
      </div>
    </div>
    <div class="bolum"><h3>Kullanılan malzemeler <small>toptan fiyatıyla</small></h3>
      <div class="kart liste" id="kalemler"></div>
      <button class="btn kesik tam" data-k="kalem-ekle" style="margin-top:8px">+ Malzeme ekle</button></div>
    <div class="bolum"><h3>Diğer giderler <small>ambalaj, kargo…</small></h3>
      <div class="kart liste" id="ekler"></div>
      <button class="btn kesik tam" data-k="ek-ekle" style="margin-top:8px">+ Gider ekle</button></div>
    <div class="bolum"><h3>Nakış <small>Nakış Çizim'den .pes dosyası</small></h3>
      <div class="kart ic nakis-kutu">
        <div class="ikili">
          <label class="alan">Dikiş sayısı<input data-nakis="dikis" inputmode="numeric" value="${u.nakis?.dikis || ''}" placeholder="0"></label>
          <label class="alan">Renk sayısı<input data-nakis="renk" inputmode="numeric" value="${u.nakis?.renk || ''}" placeholder="0"></label>
        </div>
        <div id="nakis-bilgi" class="ipucu"></div>
        <label class="btn kesik tam" style="margin-top:8px">🪡 .pes dosyası yükle<input type="file" accept=".pes,.PES" hidden id="pes-girdi"></label>
      </div></div>
    <div class="bolum ikili">
      <label class="alan">Fire payı<div class="birimli"><input name="fire" inputmode="decimal" value="${yaz(u.fire)}" placeholder="0"><span class="b">%</span></div></label>
      <label class="alan">Harcanan emek<div class="birimli"><input name="iscilikSaat" inputmode="decimal" value="${yaz(u.iscilikSaat)}" placeholder="0"><span class="b">saat</span></div></label>
    </div>
    <p class="ipucu" style="margin-top:6px">Fire: kesimde boşa giden malzeme payı (örn. %10).</p>
    <div class="bolum"><label class="alan">Satış fiyatı<div class="birimli"><input name="satisFiyati" inputmode="decimal" value="${yaz(u.satisFiyati)}" placeholder="0"><span class="b">₺</span></div></label></div>
    <div class="bolum"><div class="kart hesap" id="hesap"></div></div>
    <div class="bolum"><label class="alan">Not<textarea name="not" placeholder="Ölçü, renk, model notları…">${esc(u.not)}</textarea></label></div>
    ${eski ? `<div class="bolum btn-satir">${sonra ? '' : '<button class="btn" data-k="satis">Satış ekle</button><button class="btn" data-k="kopya">Kopyala</button>'}<button class="btn tehlike" data-k="sil">Sil</button></div>` : ''}`,
    kaydet: () => {
      u.ad = u.ad.trim();
      if (!u.ad) { bildirim('İşin adını yazın'); $('[name=ad]', d).focus(); return false; }
      const kayit = S.kaydet('urunler', u);
      bildirim('Kaydedildi');
      sonra?.(kayit);
    },
  });

  function kalemCiz() {
    const h = urunHesap(u, st);
    $('#kalemler', d).innerHTML = h.satirlar.length ? h.satirlar.map((k, i) => `
      <div class="kalem">
        <div><div class="ad">${esc(k.m?.ad || 'Silinmiş malzeme')}</div>
          <div class="ek">${para(k.bf)}/${esc(kisaBirim(k.m?.birim))} · <b data-tutar="${i}">${para(k.tutar)}</b></div></div>
        <div class="birimli"><input data-kalem="${i}" inputmode="decimal" value="${yaz(k.miktar)}" aria-label="Miktar"><span class="b">${esc(kisaBirim(k.m?.birim))}</span></div>
        <button class="sil-x" data-sil-kalem="${i}" aria-label="Kaldır">×</button>
      </div>`).join('')
      : `<div class="satir soluk" style="cursor:default">Malzeme eklenmedi${/paça|tadilat/i.test(u.kategori) ? ' (paça gibi işlerde gerekmeyebilir)' : ''}</div>`;
  }
  function ekCiz() {
    $('#ekler', d).innerHTML = u.ekGiderler.length ? u.ekGiderler.map((e, i) => `
      <div class="kalem ek-gider">
        <input data-ek-ad="${i}" value="${esc(e.ad)}" placeholder="Gider adı" style="text-align:left;padding-right:9px">
        <div class="birimli"><input data-ek-tutar="${i}" inputmode="decimal" value="${yaz(e.tutar)}" placeholder="0"><span class="b">₺</span></div>
        <button class="sil-x" data-sil-ek="${i}" aria-label="Kaldır">×</button>
      </div>`).join('')
      : `<div class="satir soluk" style="cursor:default">Ek gider yok</div>`;
  }
  function hesapCiz() {
    const h = urunHesap(u, st);
    h.satirlar.forEach((k, i) => { const el = $(`[data-tutar="${i}"]`, d); if (el) el.textContent = para(k.tutar); });
    const satir = (a, b, cls = '') => `<div class="s ${cls}"><span>${a}</span><span>${b}</span></div>`;
    let html = satir('Malzeme', para(h.malzeme));
    if (h.fire) html += satir(`Fire (%${sayi(u.fire)})`, para(h.fire));
    if (h.ek) html += satir('Diğer giderler', para(h.ek));
    if (h.nakis) html += satir(`Nakış (${sayi(u.nakis.dikis)} dikiş)`, para(h.nakis));
    html += satir('Toplam gider', para(h.gider), 'toplam');
    html += satir('Satış fiyatı', h.fiyat ? para(h.fiyat) : '—');
    if (h.fiyat) {
      html += `<div class="buyuk ${h.cep < 0 ? 'zarar' : ''}"><span>${h.cep < 0 ? 'Zarar' : 'Kazancınız'}<br><small>kâr marjı ${yuzde(h.marj)}</small></span><b>${para(h.cep)}</b></div>`;
      if (h.saatlik) html += satir('Saat başına kazanç', para(h.saatlik));
      if (h.iscilik) {
        html += satir(`Emek ücreti (${sayi(u.iscilikSaat)} sa × ${para(h.saatUcreti)})`, '− ' + para(h.iscilik));
        html += satir('Emek ücreti çıktıktan sonra', `<b class="${h.kar < 0 ? 'negatif' : 'pozitif'}">${para(h.kar)}</b>`);
      }
    } else {
      html += `<p class="ipucu" style="margin-top:8px">Satış fiyatını girince kazancınızı göreceksiniz.</p>`;
    }
    if (h.toplam > 0) html += `<div class="oneri"><span>Önerilen fiyat<br><small class="soluk">maliyet${h.iscilik ? ' + emek' : ''} + %${sayi(h.hedef)} kâr</small></span>
      <span style="display:flex;align-items:center;gap:8px"><b>${para(h.onerilen)}</b>${h.onerilen !== h.fiyat ? `<button class="btn kucuk" data-k="uygula">Uygula</button>` : ''}</span></div>`;
    else if (!st.ayar.saatUcreti && u.iscilikSaat) html += `<p class="ipucu">Ayarlar'dan saat ücretinizi girerseniz emeğiniz de maliyete katılır.</p>`;
    $('#hesap', d).innerHTML = html;
  }
  function nakisCiz() {
    const n = u.nakis;
    const el = $('#nakis-bilgi', d);
    if (!n?.dikis) { el.innerHTML = 'Nakışlı işlerde dikiş sayısını girin ya da .pes dosyasını yükleyin; nakışın maliyeti ve makine süresi hesaplansın.'; return; }
    const h = N.nakisHesap(n, st.ayar);
    el.innerHTML = `${n.ad ? `📄 <b>${esc(n.ad)}</b>${n.genislikMm ? ` · ${n.genislikMm}×${n.yukseklikMm} mm` : ''}<br>` : ''}
      Makine süresi ≈ <b>${sayi(Math.round(h.dakika))} dk</b> · nakış maliyeti <b>${para(h.maliyet)}</b>${st.ayar.dikisFiyati ? '' : ' <span class="negatif">(Ayarlar → Nakış\'tan 1000 dikiş maliyetini girin)</span>'}
      <button type="button" class="btn kucuk" data-k="nakis-emek" style="margin-left:6px">Süreyi emeğe ekle</button>`;
  }
  kalemCiz(); ekCiz(); hesapCiz(); nakisCiz();
  $('#pes-girdi', d).addEventListener('change', async e => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try {
      const r = N.pesOku(await f.arrayBuffer());
      u.nakis = { ...r, ad: f.name };
      $('[data-nakis=dikis]', d).value = r.dikis; $('[data-nakis=renk]', d).value = r.renk;
      if (u.id) D.ekle('is:' + u.id, 'pes', f, f.name).catch(() => { });
      nakisCiz(); hesapCiz();
      bildirim(`${sayi(r.dikis)} dikiş, ${r.renk} renk okundu`);
    } catch (err) { bildirim(err.message || 'PES okunamadı'); }
  });

  d.addEventListener('input', e => {
    const t = e.target;
    if (t.name === 'kategori') return; // katSeciciBagla yönetir
    if (t.dataset.nakis) { u.nakis = { ...(u.nakis || {}), [t.dataset.nakis]: Math.round(oku(t.value)) }; nakisCiz(); hesapCiz(); return; }
    if (t.name) u[t.name] = ['fire', 'iscilikSaat', 'satisFiyati'].includes(t.name) ? oku(t.value) : t.value;
    else if (t.dataset.kalem) u.kalemler[t.dataset.kalem].miktar = oku(t.value);
    else if (t.dataset.ekAd) u.ekGiderler[t.dataset.ekAd].ad = t.value;
    else if (t.dataset.ekTutar) u.ekGiderler[t.dataset.ekTutar].tutar = oku(t.value);
    else return;
    hesapCiz();
  });
  katSeciciBagla(d, v => { u.kategori = v; kalemCiz(); });
  $('#foto-girdi', d).addEventListener('change', async e => {
    const f = e.target.files[0];
    if (!f) return;
    try { u.foto = await fotoKucult(f); $('#foto-ic', d).innerHTML = `<img src="${u.foto}" alt="">`; }
    catch { bildirim('Fotoğraf okunamadı'); }
  });
  d.addEventListener('click', e => {
    const t = e.target.closest('[data-k],[data-sil-kalem],[data-sil-ek]');
    if (!t) return;
    if (t.dataset.silKalem) { u.kalemler.splice(Number(t.dataset.silKalem), 1); kalemCiz(); hesapCiz(); return; }
    if (t.dataset.silEk) { u.ekGiderler.splice(Number(t.dataset.silEk), 1); ekCiz(); hesapCiz(); return; }
    switch (t.dataset.k) {
      case 'kalem-ekle':
        malzemeSec(u.kalemler.map(k => k.malzemeId), mid => {
          const var_ = u.kalemler.find(k => k.malzemeId === mid);
          if (var_) bildirim('Bu malzeme zaten listede, miktarını değiştirin');
          else u.kalemler.push({ malzemeId: mid, miktar: 1 });
          kalemCiz(); hesapCiz();
          const son = $$('[data-kalem]', d).at(-1);
          if (!var_ && son) { son.focus(); son.select(); }
        });
        break;
      case 'ek-ekle':
        u.ekGiderler.push({ ad: u.ekGiderler.length ? '' : 'Ambalaj', tutar: 0 });
        ekCiz(); $$('[data-ek-tutar]', d).at(-1)?.focus();
        break;
      case 'nakis-emek': {
        const dk = N.nakisHesap(u.nakis, st.ayar).dakika;
        u.iscilikSaat = Math.round(((u.iscilikSaat || 0) + dk / 60) * 100) / 100;
        $('[name=iscilikSaat]', d).value = yaz(u.iscilikSaat); hesapCiz();
        bildirim(`${sayi(Math.round(dk))} dk emeğe eklendi`);
        break;
      }
      case 'uygula': {
        const h = urunHesap(u, st);
        u.satisFiyati = h.onerilen;
        $('[name=satisFiyati]', d).value = yaz(h.onerilen);
        hesapCiz();
        break;
      }
      case 'satis':
        satisDuzenle(null, { urunId: id });
        break;
      case 'kopya': {
        const { id: _, guncel, ...kopya } = structuredClone(u);
        kopya.ad = u.ad + ' (kopya)';
        d.close();
        isDuzenle(null, kopya);
        break;
      }
      case 'sil':
        if (isSil(id)) { d.close(); sonra?.(null); }
        break;
    }
  });
}

async function fotoKucult(file) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise((ok, hata) => { img.onload = ok; img.onerror = hata; img.src = url; });
    const o = Math.min(1, 520 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * o); c.height = Math.round(img.naturalHeight * o);
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL('image/jpeg', 0.72);
  } finally { URL.revokeObjectURL(url); }
}

// ---- Malzeme seçici
function malzemeSec(secili, secildi) {
  let ara = '';
  const d = sayfaAc({
    baslik: 'Malzeme seç', vazgec: 'Kapat',
    govde: `<input class="arama" type="search" placeholder="Malzeme ara…" id="m-ara">
      <button class="btn ana tam" data-k="yeni" style="margin-bottom:12px">+ Yeni malzeme tanımla</button>
      <div class="kart liste" id="m-liste"></div>`,
  });
  function listele() {
    const a = ara.toLocaleLowerCase('tr');
    const liste = Object.values(st.malzemeler)
      .filter(m => !a || `${m.ad} ${m.kategori}`.toLocaleLowerCase('tr').includes(a))
      .sort((x, y) => trSirala(x.kategori || '', y.kategori || '') || trSirala(x.ad || '', y.ad || ''));
    $('#m-liste', d).innerHTML = liste.length ? liste.map(m => `
      <button class="satir" data-mid="${m.id}">
        <div class="orta"><div class="ad">${esc(m.ad)} ${secili.includes(m.id) ? '<span class="etiket gri">ekli</span>' : ''}</div><div class="ek">${esc(m.kategori || '')}</div></div>
        <div class="sag"><div class="b">${para(birimFiyat(m))}</div><div class="k soluk">/ ${esc(m.birim)}</div></div>
      </button>`).join('')
      : `<div class="bos"><p>${Object.keys(st.malzemeler).length ? 'Aramaya uyan malzeme yok.' : 'Henüz malzeme yok. Yukarıdan yeni malzeme tanımlayın.'}</p></div>`;
  }
  listele();
  $('#m-ara', d).addEventListener('input', e => { ara = e.target.value; listele(); });
  d.addEventListener('click', e => {
    const s = e.target.closest('[data-mid]');
    if (s) { d.close(); secildi(s.dataset.mid); return; }
    if (e.target.closest('[data-k=yeni]')) malzemeDuzenle(null, m => { d.close(); secildi(m.id); }, ara);
  });
}

// ---- Malzeme düzenleme
function malzemeDuzenle(id, sonra, onAd = '') {
  const eski = id ? st.malzemeler[id] : null;
  const m = structuredClone(eski || { ad: onAd, kategori: '', birim: 'adet', paketFiyat: 0, paketMiktar: 1, tedarikci: '', not: '' });
  const kullanan = id ? Object.values(st.urunler).filter(u => (u.kalemler || []).some(k => k.malzemeId === id)) : [];
  const tedarikciler = [...new Set(Object.values(st.malzemeler).map(x => x.tedarikci).filter(Boolean))];

  const d = sayfaAc({
    baslik: eski ? 'Malzemeyi düzenle' : 'Yeni malzeme',
    govde: `<div class="form">
      <label class="alan">Malzeme adı<input name="ad" value="${esc(m.ad)}" placeholder="Örn. Kağıt ip – bej" autocomplete="off"></label>
      ${katSeciciHtml('malzemeKategorileri', m.kategori, 'Diğer')}
      <label class="alan">Birim<select name="birim">
        ${[...new Set([...BIRIMLER, m.birim].filter(Boolean))].map(b => `<option ${b === m.birim ? 'selected' : ''}>${esc(b)}</option>`).join('')}
      </select></label>
      <datalist id="dl-birim">${BIRIMLER.map(k => `<option value="${esc(k)}">`).join('')}</datalist>
      <datalist id="dl-ted">${tedarikciler.map(k => `<option value="${esc(k)}">`).join('')}</datalist>
    </div>
    <div class="bolum"><h3>Toptancıdan alış</h3>
      <div class="kart ic form">
        <div class="ikili">
          <label class="alan">Ödediğiniz fiyat<div class="birimli"><input name="paketFiyat" inputmode="decimal" value="${yaz(m.paketFiyat)}" placeholder="0"><span class="b">₺</span></div></label>
          <label class="alan">Aldığınız miktar<div class="birimli"><input name="paketMiktar" inputmode="decimal" value="${yaz(m.paketMiktar)}" placeholder="1"><span class="b" id="b-birim">${esc(kisaBirim(m.birim))}</span></div></label>
        </div>
        <p class="ipucu">Örnek: 50 metrelik astarı 600 ₺'ye aldıysanız → 600 ₺ ve 50 metre. 100'lü boncuk paketi 60 ₺ ise → 60 ₺ ve 100 adet.</p>
        <div class="hesap" style="padding:0"><div class="s toplam"><span id="bf-ad"></span><span id="bf"></span></div></div>
      </div></div>
    <div class="bolum"><h3>Stok <small>isteğe bağlı</small></h3>
      <div class="kart ic form">
        <div class="ikili">
          <label class="alan">Elde kalan<div class="birimli"><input name="stok" inputmode="decimal" value="${m.stok ?? ''}" placeholder="Takip yok"><span class="b" data-birim>${esc(kisaBirim(m.birim))}</span></div></label>
          <label class="alan">Kritik seviye<div class="birimli"><input name="kritik" inputmode="decimal" value="${m.kritik ?? ''}" placeholder="Örn. 1"><span class="b" data-birim>${esc(kisaBirim(m.birim))}</span></div></label>
        </div>
        <button type="button" class="btn kucuk" data-k="paket" style="align-self:flex-start">+1 paket aldım</button>
        <p class="ipucu">İş bitince kullanılan miktar stoktan düşer; kritik seviyeye inince Alışveriş listesinde görünür.</p>
      </div></div>
    <div class="bolum form">
      <label class="alan">Toptancı / nereden alındı<input name="tedarikci" list="dl-ted" value="${esc(m.tedarikci)}" placeholder="İsteğe bağlı"></label>
      <label class="alan">Not<textarea name="not" placeholder="Renk kodu, kalınlık…">${esc(m.not)}</textarea></label>
    </div>
    ${kullanan.length ? `<div class="bolum"><h3>Kullanıldığı işler <small>${kullanan.length} iş</small></h3>
      <p class="ipucu" style="margin-bottom:8px">Fiyatı değiştirirseniz bu işlerin maliyeti de kendiliğinden güncellenir.</p>
      <div class="kart liste">${kullanan.map(u => `<div class="satir" style="cursor:default"><div class="orta"><div class="ad">${esc(u.ad)}</div></div></div>`).join('')}</div></div>` : ''}
    ${eski ? `<div class="bolum"><button class="btn tehlike tam" data-k="sil">Malzemeyi sil</button></div>` : ''}`,
    kaydet: () => {
      m.ad = m.ad.trim(); m.birim = (m.birim || '').trim() || 'adet'; m.kategori = (m.kategori || '').trim();
      if (!m.ad) { bildirim('Malzeme adını yazın'); return false; }
      if (!(m.paketMiktar > 0)) { bildirim('Aldığınız miktar 0 olamaz'); return false; }
      const kayit = S.kaydet('malzemeler', m);
      bildirim('Kaydedildi');
      sonra?.(kayit);
    },
  });
  function bfCiz() {
    $('#b-birim', d).textContent = kisaBirim(m.birim);
    $('#bf-ad', d).textContent = `1 ${m.birim || 'birim'} fiyatı`;
    $('#bf', d).textContent = para(birimFiyat(m));
  }
  bfCiz();
  d.addEventListener('input', e => {
    const t = e.target;
    if (!t.name || t.name === 'kategori') return;
    m[t.name] = ['paketFiyat', 'paketMiktar'].includes(t.name) ? oku(t.value) : ['stok', 'kritik'].includes(t.name) ? (t.value.trim() === '' ? null : oku(t.value)) : t.value;
    bfCiz();
  });
  katSeciciBagla(d, v => { m.kategori = v; });
  d.addEventListener('click', e => {
    if (e.target.closest('[data-k=sil]') && malzSil(id)) d.close();
    if (e.target.closest('[data-k=paket]')) {
      m.stok = r2((Number(m.stok) || 0) + (m.paketMiktar || 1));
      $('[name=stok]', d).value = yaz(m.stok) || '0';
      bildirim(`Stok: ${sayi(m.stok)} ${m.birim}`);
    }
  });
  if (!eski) setTimeout(() => $('[name=ad]', d).focus(), 50);
}

// ---- Satış düzenleme
function urunuUygula(s, uid) {
  const u = st.urunler[uid];
  if (!u) return;
  const h = urunHesap(u, st);
  Object.assign(s, {
    urunId: uid, urunAd: u.ad, kategori: u.kategori || '', birimFiyat: u.satisFiyati || 0,
    maliyet: r2(h.gider), iscilik: r2(h.iscilik), dokum: R.dokumOlustur(u, st),
    calismaSaat: r2((u.iscilikSaat || 0) * (s.adet || 1)),
  });
}


function satisDuzenle(id, on = {}) {
  const eski = id ? st.satislar[id] : null;
  const s = structuredClone(eski || {
    tarih: bugun(), saat: R.saatSimdi(), urunId: '', urunAd: '', kategori: '', adet: 1, birimFiyat: 0, maliyet: 0, iscilik: 0,
    musteri: '', durum: 'teslim', not: '', zaman: {}, kaynak: '', teslimTarihi: '', urunTanim: '', ...on,
  });
  s.urunTanim ??= '';
  s.zaman ||= {};
  s.odeme ||= structuredClone(O.odemeDurumu(s));   // { durum, odemeler }
  delete s.odeme.ciro; delete s.odeme.tahsil; delete s.odeme.kalan;
  s.odeme.odemeler ||= [];
  if (!eski && s.urunId) urunuUygula(s, s.urunId);
  // Kendiliğinden doldurulan zamanlar: daha önceki bir duruma dönülürse silinir
  const oto = new Set(eski ? [] : durumZamanla(s, s.durum));
  const eskiDurum = eski?.durum;
  const musteriler = [...new Set([...Object.values(st.musteriler).map(m => m.ad), ...Object.values(st.satislar).map(x => x.musteri)].filter(Boolean))];
  const isSecenekleri = () => `<option value="">— Listede olmayan / özel iş —</option>
    ${Object.values(st.urunler).sort((a, b) => trSirala(a.ad || '', b.ad || '')).map(u => `<option value="${u.id}" ${u.id === s.urunId ? 'selected' : ''}>${esc(u.ad)}${u.satisFiyati ? ' · ' + para(u.satisFiyati) : ''}</option>`).join('')}
    ${s.urunId && !st.urunler[s.urunId] ? `<option value="${esc(s.urunId)}" selected>${esc(s.urunAd)} (silinmiş)</option>` : ''}`;

  const d = sayfaAc({
    baslik: eski ? 'Satışı düzenle' : 'Yeni satış',
    govde: `<div class="form">
      <div class="alan">Satılan iş
        <div class="is-sec">
          <select name="urunId">${isSecenekleri()}</select>
          <button type="button" class="ikon-btn ekle" data-k="is-yeni" title="Yeni iş ekle" aria-label="Yeni iş ekle">${SVG_ARTI}<span>Yeni</span></button>
          <button type="button" class="ikon-btn" data-k="is-duzenle" title="Seçili işi düzenle" aria-label="Seçili işi düzenle">${SVG_KALEM}</button>
          <button type="button" class="ikon-btn sil" data-k="is-sil" title="Seçili işi sil" aria-label="Seçili işi sil">${SVG_COP}</button>
        </div></div>
      <label class="alan" id="ozel-ad" ${s.urunId ? 'hidden' : ''}>İşin adı<input name="urunAd" value="${esc(s.urunAd)}" placeholder="Örn. Gelinlik paça kısaltma"></label>
      <label class="alan">Ürün ne? <small class="soluk">kısaca anlatın · AI tanıtım yazılarını buna göre hazırlar</small>
        <textarea name="urunTanim" rows="2" placeholder="Örn. Bebek odası için pembe, isim ve çiçek nakışlı pamuklu yastık kılıfı">${esc(s.urunTanim || '')}</textarea></label>
      <div class="uclu">
        <label class="alan">Adet<input name="adet" inputmode="decimal" value="${yaz(s.adet)}"></label>
        <label class="alan">Tarih<input name="tarih" type="date" value="${esc(s.tarih)}"></label>
        <label class="alan">Saat<input name="saat" type="time" value="${esc(s.saat || '')}"></label>
      </div>
      <div class="uclu">
        <label class="alan">Satış fiyatı (1 adet)<div class="birimli"><input name="birimFiyat" inputmode="decimal" value="${yaz(s.birimFiyat)}" placeholder="0"><span class="b">₺</span></div></label>
        <label class="alan">Gider (1 adet)<div class="birimli"><input name="maliyet" inputmode="decimal" value="${yaz(s.maliyet)}" placeholder="0"><span class="b">₺</span></div></label>
        <label class="alan">Harcanan emek (toplam)<div class="birimli"><input name="calismaSaat" inputmode="decimal" value="${yaz(s.calismaSaat)}" placeholder="0"><span class="b">saat</span></div></label>
      </div>
      <p class="ipucu">Gider ve emek, seçtiğiniz işin kartından kendiliğinden gelir; bu satışa özel değiştirebilirsiniz.</p>
      <div class="alan">Müşteri
        <div class="is-sec"><input name="musteri" list="dl-mus" value="${esc(s.musteri)}" placeholder="İsim ya da Instagram kullanıcı adı" autocomplete="off">
          <button type="button" class="ikon-btn ekle" data-k="musteri-kart" title="Müşteri kartı">👤<span id="mus-dugme">Kaydet</span></button></div>
        <div class="mus-bilgi" id="mus-bilgi" hidden></div></div>
      <datalist id="dl-mus">${musteriler.map(k => `<option value="${esc(k)}">`).join('')}</datalist>
      <div class="ikili">
        <label class="alan">Söz verilen teslim tarihi<input name="teslimTarihi" type="date" value="${esc(s.teslimTarihi || '')}"></label>
        <label class="alan">Sipariş nereden geldi?<select name="kaynak"><option value="">— Seçin —</option>${O.KAYNAKLAR.map(k => `<option ${k === s.kaynak ? 'selected' : ''}>${k}</option>`).join('')}</select></label>
      </div>
      <div class="alan" style="font-size:14px;color:var(--soluk)">Durum
        <div class="durum-sec">${Object.entries(DURUM).map(([k, v]) => `<label style="--renk:${v.css}"><input type="radio" name="durum" value="${k}" ${s.durum === k ? 'checked' : ''}><span>${v.kisa}</span></label>`).join('')}</div></div>
    </div>
    <div class="bolum"><h3>Ödeme <small>kapora ve kalan</small></h3>
      <div class="segment" id="odeme-durum">${[['tam', 'Ödendi'], ['kismi', 'Kapora / kısmi'], ['yok', 'Ödenmedi']].map(([k, ad]) => `<button type="button" data-odeme="${k}" class="${s.odeme.durum === k ? 'aktif' : ''}">${ad}</button>`).join('')}</div>
      <div id="odemeler"></div>
      <div class="odeme-ozet" id="odeme-ozet"></div></div>
    ${eski && BEKLEYEN.includes(s.durum) ? `<div class="bolum"><h3>İş kronometresi <small>çalışırken başlatın, ara verince durdurun</small></h3>
      <div class="kart ic krono-kutu"><span class="krono-sure" data-krono="${id}">${O.kronoYaz(O.kronoMs(s))}</span>
        <button type="button" class="btn ${O.kronoCalisiyor(s) ? '' : 'ana'}" data-k="krono">${O.kronoCalisiyor(s) ? '⏸ Durdur' : '▶ Başlat'}</button>
        <button type="button" class="btn metin" data-k="krono-sifirla">Sıfırla</button></div>
      <p class="ipucu">Durdurunca ölçülen süre "Harcanan emek" alanına yazılır.</p></div>` : ''}
    <div class="bolum"><h3>İş takvimi <small>ne zaman alındı, başladı, bitti</small></h3>
      <div class="kart liste takvim">${R.ASAMALAR.map(([k, ad], i) => `
        <div class="takvim-satir" style="--renk:${Object.values(DURUM)[i].css}">
          <span class="nokta"></span><span class="ad">${ad}</span>
          <input type="datetime-local" data-zaman="${k}" value="${esc(s.zaman[k] || '')}" aria-label="${ad}">
          <button type="button" class="btn kucuk" data-simdi="${k}">Şimdi</button>
          <button type="button" class="sil-x" data-zaman-sil="${k}" aria-label="Temizle">×</button>
        </div>`).join('')}</div>
      <div class="sure-ozet" id="sureler"></div></div>
    <div class="bolum"><label class="alan">Not<textarea name="not" placeholder="Ölçü, renk, kapora, teslim notu…">${esc(s.not)}</textarea></label></div>
    <div class="bolum"><div class="kart hesap" id="s-hesap"></div></div>
    ${eski ? `<div class="bolum"><h3>Müşterinin örnek görseli <small>istediği model / renk</small></h3>
      <div class="foto-izgara" id="ornekler"></div>
      <label class="btn kesik tam" style="margin-top:8px">${SVG_ARTI} Örnek görsel ekle<input type="file" accept="image/*" multiple hidden id="ornek-ekle"></label></div>` : ''}
    <div class="bolum"><h3>Ürün fotoğrafı ve tanıtım videosu</h3>
      ${eski ? `<div class="kart ic tanitim-kutu"><span class="tanitim-simge">🎬</span>
        <div style="flex:1"><b>Tanıtım stüdyosu</b><div class="soluk" id="foto-say" style="font-size:13px">Biten ürünün fotoğrafını ya da videosunu ekleyin; Instagram / WhatsApp için video ve görseller hazırlansın.</div></div>
        <button class="btn ana kucuk" data-k="studyo">Aç</button></div>`
      : '<p class="ipucu">Satışı kaydettikten sonra ürün fotoğrafı ekleyip tanıtım videosu hazırlayabilirsiniz.</p>'}</div>
    <div class="bolum btn-satir"><button class="btn" data-k="teklif">🧾 Fiyat teklifi</button><button class="btn" data-k="fis">🧾 Sipariş fişi</button><button class="btn" data-k="pdf">📄 İş raporu (PDF)</button>
      ${eski ? `<button class="btn tehlike" data-k="sil">Satışı sil</button>` : ''}</div>`,
    kaydet: () => {
      s.urunAd = (s.urunAd || '').trim();
      if (!s.urunAd) { bildirim('Satılan işi seçin ya da adını yazın'); return false; }
      if (!s.tarih) s.tarih = bugun();
      if (!(s.adet > 0)) { bildirim('Adet 0\'dan büyük olmalı'); return false; }
      if (s.birimFiyat < 0 || s.maliyet < 0 || s.calismaSaat < 0) { bildirim('Fiyat, gider ve emek eksi olamaz'); return false; }
      // fazla ödeme: kapora toplamı satış tutarını geçiyorsa sor; tamamı ödendiyse "Ödendi" say
      if (s.odeme.durum === 'kismi') {
        const top = s.odeme.odemeler.reduce((t, x) => t + (x.tutar > 0 ? x.tutar : 0), 0), ciro = satisHesap(s).ciro;
        if (top > ciro + 0.009 && !confirm(`Ödemeler toplamı (${para(top)}) satış tutarından (${para(ciro)}) fazla. Yine de kaydedilsin mi?`)) return false;
        if (ciro > 0 && top >= ciro) { s.odeme.durum = 'tam'; odemeDokunuldu = true; }
      }
      durumZamanla(s, s.durum);
      for (const [k] of R.ASAMALAR) if (!s.zaman[k]) delete s.zaman[k];
      s.odeme.odemeler = s.odeme.odemeler.filter(x => x.tutar > 0);
      if (s.odeme.durum === 'kismi' && !s.odeme.odemeler.length) s.odeme.durum = 'yok';
      if (s.odeme.durum === 'yok') s.odeme.odemeler = [];
      // ödeme bilgisi olmayan eski kayıt: kullanıcı ödemeye dokunmadıysa tahmini değer kalıcı yazılmasın
      if (eski && !eski.odeme && !odemeDokunuldu) delete s.odeme;
      // müşteri kaydı varsa bağla
      // ad değişmediyse mevcut bağ korunur (aynı adlı iki müşteri olabilir)
      const bagli = st.musteriler[s.musteriId];
      if (!(bagli && eski && eski.musteri === s.musteri)) s.musteriId = M.musteriBul(s.musteri)?.id || '';
      // Stok: iş bekleyen → biten olunca düş; iptal edilirse birebir geri ekle; adet/iş değişirse farkı uygula
      const yeniBitti = BITTI.includes(s.durum) && !(eski && BITTI.includes(eskiDurum));
      if (yeniBitti && !s.stokDusuldu) { O.stokUygula(s, -1); s.stokDusuldu = true; }
      else if (s.durum === 'iptal' && s.stokDusuldu) { O.stokUygula(s, +1); s.stokDusuldu = false; }
      else if (BITTI.includes(s.durum) && s.stokDusuldu && eski && (eski.adet !== s.adet || eski.urunId !== s.urunId)) { O.stokUygula(structuredClone(eski), +1); O.stokUygula(s, -1); }
      if (s.krono?.bas && !BEKLEYEN.includes(s.durum)) { s.krono.toplam += Date.now() - s.krono.bas; s.krono.bas = null; s.calismaSaat = r2(s.krono.toplam / 3600000); }
      const kayit = S.kaydet('satislar', s);
      // İş yeni bittiyse: fotoğraf + tanıtım videosu + rapor penceresi
      // (devam eden sipariş bittiyse pencere; doğrudan "teslim" girilen satışta küçük bildirim)
      if (BITTI.includes(s.durum) && eski && !BITTI.includes(eskiDurum)) setTimeout(() => isBittiSor(kayit), 0);
      else if (BITTI.includes(s.durum) && !eski) setTimeout(() => bildirim('Satış kaydedildi', () => isBittiSor(kayit), 'Tanıtım / rapor'), 0);
      else bildirim('Satış kaydedildi');
    },
  });

  function hesapCiz() {
    const h = satisHesap(s);
    const saat = s.calismaSaat || 0;
    $('#s-hesap', d).innerHTML = `
      <div class="s"><span>Satış tutarı</span><span>${para(h.ciro)}</span></div>
      <div class="s"><span>Gider</span><span>− ${para(h.gider)}</span></div>
      <div class="buyuk ${h.kazanc < 0 ? 'zarar' : ''}"><span>${h.kazanc < 0 ? 'Zarar' : 'Kazanç'}</span><b>${para(h.kazanc)}</b></div>
      ${saat ? `<div class="s"><span>Saat başına kazanç (${sayi(saat)} sa)</span><span>${para(h.kazanc / saat)}</span></div>` : ''}`;
  }
  function sureCiz() {
    const x = R.sureler(s);
    const p = [['Sipariş → başlama', x.bekleme], ['Yapım süresi', x.yapim], ['Bitiş → teslim', x.teslimBekleme], ['Toplam', x.toplam]]
      .filter(([, v]) => v != null && Math.abs(v) >= 60000).map(([a, v]) => `<span><small>${a}</small><b>${R.sureYaz(v)}</b></span>`);
    $('#sureler', d).innerHTML = p.join('') || '<span class="soluk" style="font-size:13px">Aşama zamanlarını girdikçe süreler burada hesaplanır.</span>';
  }
  function alanlariYenile() {
    $('[name=urunId]', d).innerHTML = isSecenekleri();
    $('[name=urunId]', d).value = s.urunId || '';
    $('#ozel-ad', d).hidden = !!s.urunId;
    $('[name=urunAd]', d).value = s.urunAd || '';
    $('[name=birimFiyat]', d).value = yaz(s.birimFiyat);
    $('[name=maliyet]', d).value = yaz(s.maliyet);
    $('[name=calismaSaat]', d).value = yaz(s.calismaSaat);
    $('[data-k=is-duzenle]', d).disabled = $('[data-k=is-sil]', d).disabled = !st.urunler[s.urunId];
    hesapCiz();
  }
  function zamanAlani(k) { $(`[data-zaman="${k}"]`, d).value = s.zaman[k] || ''; }
  let odemeDokunuldu = false;
  function odemeCiz() {
    const o = s.odeme;
    $$('[data-odeme]', d).forEach(b => b.classList.toggle('aktif', b.dataset.odeme === o.durum));
    $('#odemeler', d).innerHTML = o.durum === 'kismi' ? `<div class="kart liste" style="margin-top:8px">${o.odemeler.map((x, i) => `
      <div class="odeme-satir"><div class="birimli"><input data-od-tutar="${i}" inputmode="decimal" value="${yaz(x.tutar)}" placeholder="0"><span class="b">₺</span></div>
        <select data-od-yontem="${i}">${O.ODEME_YONTEM.map(y => `<option ${y === x.yontem ? 'selected' : ''}>${y}</option>`).join('')}</select>
        <input type="date" data-od-tarih="${i}" value="${esc(x.tarih || '')}">
        <button type="button" class="sil-x" data-od-sil="${i}" aria-label="Kaldır">×</button></div>`).join('')}</div>
      <button type="button" class="btn kesik tam" data-k="odeme-ekle" style="margin-top:8px">+ Ödeme / kapora ekle</button>` : '';
    const od = O.odemeDurumu(s);
    $('#odeme-ozet', d).innerHTML = `<span>Tutar <b>${para(od.ciro)}</b></span><span>Ödenen <b class="pozitif">${para(od.tahsil)}</b></span><span>Kalan <b class="${od.kalan ? 'negatif' : ''}">${para(od.kalan)}</b></span>`;
  }
  function musteriCiz() {
    const m = M.musteriBul(s.musteri);
    $('#mus-dugme', d).textContent = m ? 'Kart' : 'Kaydet';
    const el = $('#mus-bilgi', d);
    const oz = m && M.olcuOzeti(m);
    el.hidden = !m;
    if (m) el.innerHTML = `<b>${esc(m.ad)}</b>${m.telefon ? ' · ' + esc(m.telefon) : ''}${oz ? `<br><span class="soluk">📏 ${esc(oz)}</span>` : ''}`;
  }
  let ornekUrl = [];
  d.addEventListener('close', () => ornekUrl.forEach(u => URL.revokeObjectURL(u)));
  async function ornekCiz() {
    const kap = $('#ornekler', d);
    if (!kap) return;
    const l = await D.liste('satis:' + id, 'ornek');
    ornekUrl.forEach(u => URL.revokeObjectURL(u)); ornekUrl = l.map(x => URL.createObjectURL(x.blob));
    kap.innerHTML = l.map((x, i) => `<div class="foto-kucuk"><img src="${ornekUrl[i]}" alt=""><button type="button" class="sil-x" data-ornek-sil="${x.id}" aria-label="Sil">×</button></div>`).join('')
      || '<p class="soluk" style="margin:0;font-size:14px">Müşterinin gönderdiği örnek / ilham görselini burada saklayın.</p>';
  }
  alanlariYenile(); sureCiz(); odemeCiz(); musteriCiz(); ornekCiz();
  $('#ornek-ekle', d)?.addEventListener('change', async e => {
    for (const f of [...e.target.files]) await D.ekle('satis:' + id, 'ornek', await D.fotoHazirla(f, 1400), f.name);
    e.target.value = ''; ornekCiz();
  });
  if (eski) fotoSayisi(id).then(n => { const el = $('#foto-say', d); if (n && el) el.textContent = `${n} fotoğraf / video eklendi · video ve görselleri buradan hazırlayın`; });

  d.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.zaman) { s.zaman[t.dataset.zaman] = t.value; oto.delete(t.dataset.zaman); sureCiz(); return; }
    if (t.dataset.odTutar) { s.odeme.odemeler[t.dataset.odTutar].tutar = oku(t.value); odemeCiz(); return; }
    if (t.dataset.odYontem) { s.odeme.odemeler[t.dataset.odYontem].yontem = t.value; return; }
    if (t.dataset.odTarih) { s.odeme.odemeler[t.dataset.odTarih].tarih = t.value; return; }
    if (t.name === 'musteri') { s.musteri = t.value; musteriCiz(); return; }
    if (!t.name || t.name === 'urunId') return;
    s[t.name] = ['adet', 'birimFiyat', 'maliyet', 'calismaSaat'].includes(t.name) ? oku(t.value) : t.value;
    if (t.name === 'durum' && !eski && !odemeDokunuldu) { s.odeme.durum = t.value === 'teslim' || t.value === 'hazir' ? 'tam' : 'yok'; odemeCiz(); }
    if (t.name === 'durum' && DURUM[t.value].zaman) {
      const sinir = ASAMA_SIRA.indexOf(DURUM[t.value].zaman);
      for (const k of [...oto]) if (ASAMA_SIRA.indexOf(k) > sinir) { delete s.zaman[k]; oto.delete(k); }
      durumZamanla(s, t.value).forEach(k => oto.add(k));
      R.ASAMALAR.forEach(([k]) => zamanAlani(k)); sureCiz();
    }
    if (t.name === 'adet' && st.urunler[s.urunId]?.iscilikSaat) {
      s.calismaSaat = r2(st.urunler[s.urunId].iscilikSaat * (s.adet || 0));
      $('[name=calismaSaat]', d).value = yaz(s.calismaSaat);
    }
    hesapCiz(); odemeCiz();
  });
  $('[name=urunId]', d).addEventListener('change', e => {
    const v = e.target.value;
    if (v) urunuUygula(s, v);
    else Object.assign(s, { urunId: '', urunAd: '', kategori: '', maliyet: 0, iscilik: 0, dokum: null, calismaSaat: 0 });
    alanlariYenile();
  });
  d.addEventListener('click', async e => {
    const t = e.target.closest('[data-k],[data-simdi],[data-zaman-sil],[data-odeme],[data-od-sil],[data-ornek-sil]');
    if (!t) return;
    if (t.dataset.odeme) {
      s.odeme.durum = t.dataset.odeme; odemeDokunuldu = true;
      if (s.odeme.durum === 'kismi' && !s.odeme.odemeler.length) s.odeme.odemeler.push({ tutar: 0, tarih: bugun(), yontem: 'Nakit' });
      odemeCiz(); if (s.odeme.durum === 'kismi') $('[data-od-tutar]', d)?.focus(); return;
    }
    if (t.dataset.odSil) { s.odeme.odemeler.splice(Number(t.dataset.odSil), 1); odemeCiz(); return; }
    if (t.dataset.ornekSil) { if (confirm('Örnek görsel silinsin mi?')) { await D.sil(t.dataset.ornekSil); ornekCiz(); } return; }
    if (t.dataset.simdi) { s.zaman[t.dataset.simdi] = R.simdi(); oto.delete(t.dataset.simdi); zamanAlani(t.dataset.simdi); sureCiz(); return; }
    if (t.dataset.zamanSil) { delete s.zaman[t.dataset.zamanSil]; zamanAlani(t.dataset.zamanSil); sureCiz(); return; }
    switch (t.dataset.k) {
      case 'is-yeni':
        isDuzenle(null, null, u => { if (u) { urunuUygula(s, u.id); alanlariYenile(); } });
        break;
      case 'is-duzenle':
        if (st.urunler[s.urunId]) isDuzenle(s.urunId, null, u => {
          if (u) {
            if (confirm('İşteki yeni fiyat ve giderler bu satışa da uygulansın mı?')) urunuUygula(s, u.id);
            else s.urunAd = u.ad;
          } else s.urunId = ''; // iş silindi: satış "özel iş" olarak adıyla kalır
          alanlariYenile();
        });
        break;
      case 'is-sil':
        if (st.urunler[s.urunId] && isSil(s.urunId)) { s.urunId = ''; alanlariYenile(); }
        break;
      case 'studyo':
        if (eski) tanitimStudyosu(st.satislar[id] || s);
        break;
      case 'odeme-ekle':
        s.odeme.odemeler.push({ tutar: O.odemeDurumu(s).kalan, tarih: bugun(), yontem: 'Nakit' }); odemeCiz();
        break;
      case 'musteri-kart': {
        const m = M.musteriBul(s.musteri);
        M.musteriDuzenle(m?.id || null, k => { if (k) { s.musteri = k.ad; $('[name=musteri]', d).value = k.ad; } musteriCiz(); }, m ? '' : s.musteri || '');
        break;
      }
      case 'krono': {
        const k = O.kronoDegistir(id);
        // formdaki zamanlar korunur; yalnızca ilk başlatmada "başladı" eklenir
        Object.assign(s, { krono: k.krono, durum: k.durum, calismaSaat: k.calismaSaat });
        if (k.zaman?.basladi && !s.zaman.basladi) s.zaman.basladi = k.zaman.basladi;
        t.textContent = O.kronoCalisiyor(k) ? '⏸ Durdur' : '▶ Başlat'; t.classList.toggle('ana', !O.kronoCalisiyor(k));
        $('[name=calismaSaat]', d).value = yaz(s.calismaSaat); hesapCiz();
        $$('[name=durum]', d).forEach(r => { r.checked = r.value === s.durum; }); R.ASAMALAR.forEach(([z]) => zamanAlani(z)); sureCiz();
        break;
      }
      case 'krono-sifirla':
        if (confirm('Kronometre sıfırlansın mı?')) { const k = O.kronoSifirla(id); s.krono = k.krono; $('[data-krono]', d).textContent = O.kronoYaz(0); }
        break;
      case 'teklif': case 'fis': {
        s.musteriId = M.musteriBul(s.musteri)?.id || '';
        pdfVer(() => O.fisPdf(s, t.dataset.k));
        break;
      }
      case 'pdf':
        isRaporu(s);
        break;
      case 'sil':
        if (satisSil(id)) d.close();
        break;
    }
  });
}

// ---------------------------------------------------------------- yedek
async function yedekAl() {
  const veri = JSON.stringify({ uygulama: 'EnvaiTasarim', surum: 2, tarih: new Date().toISOString(),
    ayar: st.ayar, ...Object.fromEntries(S.KOLEKSIYONLAR.map(k => [k, st[k]])) });
  const ad = `EnvaiTasarim-yedek-${bugun()}.json`;
  const dosya = new File([veri], ad, { type: 'application/json' });
  // "yedek alındı" yalnızca paylaşım/indirme gerçekten yapılınca işaretlenir
  if (navigator.canShare?.({ files: [dosya] })) {
    try { await navigator.share({ files: [dosya], title: ad }); K.yedekAlindi(); ciz(); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  K.yedekAlindi(); ciz();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(dosya); a.download = ad;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

async function yedekYukle(dosya) {
  try {
    const v = JSON.parse(await dosya.text());
    if (v.uygulama !== 'EnvaiTasarim' || !v.malzemeler) throw new Error();
    // kayıt kimlikleri ekrana yazıldığı için yalnızca güvenli karakterlere izin ver
    for (const kol of S.KOLEKSIYONLAR) for (const [k, x] of Object.entries(v[kol] || {}))
      if (!/^[\w-]+$/.test(k) || (x && x.id != null && x.id !== k)) throw new Error();
    const n = k => Object.keys(v[k] || {}).length;
    const say = `${n('urunler')} iş, ${n('malzemeler')} malzeme, ${n('satislar')} satış` +
      ('musteriler' in v ? `, ${n('musteriler')} müşteri` : '') + ('giderler' in v ? `, ${n('giderler')} gider` : '');
    const korunan = S.KOLEKSIYONLAR.filter(k => !(k in v)).map(k => ({ musteriler: 'müşteriler', giderler: 'genel giderler' }[k] || k));
    if (!confirm(`Yedek (${say}) yüklensin mi?\nŞu anki verilerin YERİNE geçecek.` +
      (korunan.length ? `\n(Eski yedek: ${korunan.join(', ')} bu yedekte yok, mevcut halleri korunacak.)` : ''))) return;
    S.tumunuDegistir(v);
    bildirim('Yedek yüklendi');
  } catch { alert('Bu dosya bir EnvaiTasarim yedeği değil ya da bozuk.'); }
}

// ---------------------------------------------------------------- başlat
// Üst çubukta tarih ve saat
function saatCiz() {
  const t = R.ustTarihSaat();
  $('#saat').innerHTML = `<b>${t.saat}</b><span>${t.tarih}</span>`;
}
saatCiz();
setInterval(saatCiz, 15000);
// Çalışan kronometreler her saniye güncellensin (sayfayı yeniden çizmeden)
setInterval(() => {
  for (const el of document.querySelectorAll('[data-krono]')) {
    const s = st.satislar[el.dataset.krono];
    if (s && O.kronoCalisiyor(s)) el.textContent = O.kronoYaz(O.kronoMs(s));
  }
}, 1000);
K.kilitEkrani();
K.arkaPlanKilidi();
// Tarayıcıdan verileri kalıcı saklamasını iste (iPad'de yer azalınca silinmesin)
try { navigator.storage?.persist?.().catch(() => { }); } catch { }

/** Azalan malzemeler: toptancıya göre gruplu alışveriş listesi (WhatsApp'tan gönderilebilir) */
function alisverisListesi() {
  const az = Object.values(st.malzemeler).filter(O.stokAzMi);
  const takipte = Object.values(st.malzemeler).filter(m => m.stok != null && m.stok !== '');
  const gruplar = {};
  for (const m of az) (gruplar[m.tedarikci || 'Toptancı belirtilmemiş'] ||= []).push(m);
  const metin = Object.entries(gruplar).map(([t, l]) => `${t}:\n` + l.map(m => `- ${m.ad} (${sayi(m.paketMiktar)} ${m.birim}lik paket)`).join('\n')).join('\n\n');
  const d = sayfaAc({
    baslik: 'Alışveriş listesi', vazgec: 'Kapat',
    govde: az.length ? `<p class="ipucu" style="margin-top:0">Stoğu kritik seviyeye inen malzemeler, toptancıya göre:</p>
      ${Object.entries(gruplar).map(([t, l]) => `<div class="alt-baslik">${esc(t)}</div><div class="kart liste">${l.map(m => `
        <div class="satir" style="cursor:default"><div class="orta"><div class="ad">${esc(m.ad)}</div><div class="ek">Stok ${sayi(m.stok)} ${esc(m.birim)} · kritik ${sayi(m.kritik)}</div></div>
          <button class="btn kucuk" data-paket="${m.id}">+1 paket aldım</button></div>`).join('')}</div>`).join('')}
      <div class="btn-satir" style="margin-top:14px"><button class="btn ana" data-k="paylas">Listeyi paylaş (WhatsApp…)</button><button class="btn" data-k="kopyala">Kopyala</button></div>`
      : `<div class="kart bos"><div class="simge">🛒</div><p>${takipte.length ? 'Azalan malzeme yok 👍' : 'Henüz stok takibi yapılan malzeme yok.<br>Malzeme kartında <b>Stok</b> ve <b>Kritik seviye</b> girin; iş bitince kullanılan miktar stoktan kendiliğinden düşer.'}</p></div>`,
  });
  d.addEventListener('click', async e => {
    const t = e.target.closest('[data-paket],[data-k=paylas],[data-k=kopyala]');
    if (!t) return;
    if (t.dataset.paket) {
      const m = st.malzemeler[t.dataset.paket];
      S.kaydet('malzemeler', { ...m, stok: r2((Number(m.stok) || 0) + (m.paketMiktar || 1)) });
      bildirim(`${m.ad}: stok ${sayi(r2((Number(m.stok) || 0) + (m.paketMiktar || 1)))} ${m.birim}`);
      t.closest('.satir').remove();
    } else if (t.dataset.k === 'kopyala') { if (await metinKopyala(metin)) bildirim('Liste kopyalandı'); }
    else if (navigator.share) { try { await navigator.share({ text: 'Alışveriş listesi\n\n' + metin }); } catch { } }
    else if (await metinKopyala(metin)) bildirim('Liste kopyalandı');
  });
}


// Açılış logosu: en az ~1 sn görünsün, sonra yumuşakça kaybolsun
{
  const ac = $('#acilis');
  const bas = performance.now();
  const kapat = () => setTimeout(() => { ac.classList.add('gizlen'); setTimeout(() => ac.remove(), 450); },
    Math.max(0, 1100 - (performance.now() - bas)));
  if (document.readyState === 'complete') kapat(); else window.addEventListener('load', kapat, { once: true });
}

S.dinle(ciz);
window.addEventListener('hashchange', () => { ciz(); window.scrollTo(0, 0); });
ciz();
B.baslat();

if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').then(kayit => {
    // iPad'de uygulama arka planda açık kalır: öne gelince yeni sürüm var mı bak
    document.addEventListener('visibilitychange', () => { if (!document.hidden) kayit.update().catch(() => { }); });
  }).catch(() => { });
  // Yeni sürüm devreye girdi: açık pencere yoksa hemen yenile, varsa sor (yarım iş kaybolmasın)
  const eskiVardi = !!navigator.serviceWorker.controller;
  let yenilendi = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!eskiVardi || yenilendi) return;
    if (!document.querySelector('dialog[open]')) { yenilendi = true; location.reload(); }
    else bildirim('Uygulamanın yeni sürümü hazır', () => { yenilendi = true; location.reload(); }, 'Yenile');
  });
}
