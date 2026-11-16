// Tanıtım stüdyosu: iş bitince ürün fotoğrafı çek → UGC / vitrin tanıtım videosu ve
// farklı kadrajlarda ürün görselleri üret (dikey + yatay) → Instagram / WhatsApp'ta paylaş ya da indir.
import * as S from './store.js';
import * as D from './dosyadepo.js';
import * as T from './tanitim.js';
import { para } from './hesap.js';
import { $, $$, esc, bildirim, sayfaAc, dosyaPaylas, dosyaIndir, metinKopyala, SVG_ARTI } from './ui.js';

const st = S.st;
const slug = s => (s || 'urun').toLocaleLowerCase('tr').replace(/[çğıöşü]/g, c => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' }[c]))
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'urun';

/** s: kayıtlı satış. */
export async function tanitimStudyosu(s) {
  const sahip = 'satis:' + s.id;
  const u = s.urunId ? st.urunler[s.urunId] : null;
  const ayar = st.ayar;
  const durum = {
    stil: ayar.tanitimStil || 'ugc', tema: ayar.tanitimTema || 'zarif', onizFormat: 'dikey',
    formatlar: new Set(ayar.tanitimFormatlar || ['dikey', 'yatay']),
    kanca: T.kancaOner(s.kategori, s.urunAd)[0],
    baslik: s.urunAd || 'El yapımı tasarım',
    ozellikler: T.ozellikOner(s.kategori, s.urunAd),
    fiyatGoster: false, duzenle: ayar.tanitimDuzenle !== false,
    fiyat: para(s.birimFiyat || u?.satisFiyati || 0),
    instagram: ayar.instagram || 'envai_tasarim', whatsapp: ayar.whatsapp || '',
    cagri: "Sipariş için DM'den yaz 📩",
  };
  let fotolar = [];      // { id, blob, url, bmp | video, duzenli }
  let logo = null;
  try { logo = await T.resimYukle('logo/envai-amblem.png'); } catch { }
  T.yaziTipleriHazir();

  const kancalar = T.kancaOner(s.kategori, s.urunAd);
  const d = sayfaAc({
    baslik: 'Tanıtım stüdyosu', vazgec: 'Kapat',
    govde: `
    <div class="studyo">
      <div class="studyo-sol">
        <div class="oniz-kap"><canvas id="oniz"></canvas><div class="oniz-bos" id="oniz-bos">📷<br>Önce ürünün fotoğrafını ekleyin</div></div>
        <div class="segment" id="oniz-format">
          ${Object.entries(T.FORMATLAR).map(([k, f]) => `<button type="button" data-oniz="${k}" class="${k === durum.onizFormat ? 'aktif' : ''}">${f.ad.split(' · ')[0]}</button>`).join('')}
        </div>
      </div>
      <div class="studyo-sag form">
        <div class="bolum" style="margin-top:0"><h3>1. Ürün fotoğrafı / videosu</h3>
          <p class="ipucu">📸 <b>Önden</b>, <b>yandan</b> ve <b>yakından detay</b> fotoğraf çekin ya da ürünü çevirerek kısa bir <b>video</b> (5–15 sn) çekin. Gün ışığında, sade bir zemin üzerinde en güzel sonucu verir.</p>
          <div class="foto-izgara" id="fotolar"></div>
          <label class="btn ana tam" style="margin-top:8px">${SVG_ARTI} Fotoğraf / video çek ya da ekle
            <input type="file" accept="image/*,video/*" multiple hidden id="foto-ekle"></label>
          <label class="alan tik" style="margin-top:8px"><input type="checkbox" name="duzenle" ${durum.duzenle ? 'checked' : ''}> ✨ Fotoğrafları otomatik düzenle <small class="soluk">(ışık, renk, netlik)</small></label>
        </div>
        <div class="bolum"><h3>2. Video</h3>
          <div class="segment" id="stil">${Object.entries(T.STILLER).map(([k, ad]) => `<button type="button" data-stil="${k}" class="${k === durum.stil ? 'aktif' : ''}">${ad.split(' · ')[0]}<small>${ad.split(' · ')[1]}</small></button>`).join('')}</div>
          <div class="alan tema-sec" id="tema-sec" ${durum.stil === 'vitrin' ? '' : 'hidden'}>Renk teması
            <div class="cipler" style="margin:4px 0 0">${Object.entries(T.TEMALAR).map(([k, t]) => `<button type="button" class="cip ${k === durum.tema ? 'aktif' : ''}" data-tema="${k}"><i style="background:linear-gradient(135deg,${t.bg[0]},${t.bg[1]})"></i>${t.ad}</button>`).join('')}</div></div>
          <label class="alan" id="kanca-alan" ${durum.stil === 'ugc' ? '' : 'hidden'}>Açılış cümlesi (kanca)
            <input name="kanca" list="dl-kanca" value="${esc(durum.kanca)}" placeholder="İzleyeni durduracak ilk cümle">
            <datalist id="dl-kanca">${kancalar.map(k => `<option value="${esc(k)}">`).join('')}</datalist></label>
          <label class="alan">Ürün adı<input name="baslik" value="${esc(durum.baslik)}"></label>
          <div class="alan">Öne çıkan özellikler
            ${durum.ozellikler.map((o, i) => `<input data-oz="${i}" value="${esc(o)}" style="margin-top:4px">`).join('')}</div>
          <div class="ikili">
            <label class="alan tik"><input type="checkbox" name="fiyatGoster"> Fiyatı göster</label>
            <label class="alan">Fiyat<input name="fiyat" value="${esc(durum.fiyat)}"></label>
          </div>
          <div class="ikili">
            <label class="alan">Instagram kullanıcı adı<input name="instagram" value="${esc(durum.instagram)}" placeholder="envai_tasarim" autocapitalize="off"></label>
            <label class="alan">WhatsApp<input name="whatsapp" value="${esc(durum.whatsapp)}" placeholder="05xx xxx xx xx" inputmode="tel"></label>
          </div>
          <label class="alan">Kapanış cümlesi<input name="cagri" value="${esc(durum.cagri)}"></label>
        </div>
        <div class="bolum"><h3>3. Oluştur</h3>
          <div class="alan">Biçimler
            <div class="bicimler">${Object.entries(T.FORMATLAR).map(([k, f]) => `<label class="tik"><input type="checkbox" data-format="${k}" ${durum.formatlar.has(k) ? 'checked' : ''}> ${f.ad}</label>`).join('')}</div></div>
          <div class="btn-satir"><button class="btn ana" data-k="video">🎬 Video oluştur</button><button class="btn" data-k="gorsel">🖼️ Ürün görselleri</button></div>
          <div class="ilerleme" id="ilerleme" hidden><i></i><span></span></div>
          ${T.videoDestekli() ? '' : '<p class="ipucu negatif">Bu tarayıcı video üretemiyor; ürün görselleri yine de hazırlanabilir.</p>'}
          <div id="sonuclar"></div>
          <div class="alan" style="margin-top:12px">Paylaşım metni <small class="soluk">Instagram açıklamasına yapıştırın</small>
            <textarea id="metin" rows="7"></textarea>
            <button class="btn kucuk" data-k="kopyala" style="margin-top:6px;align-self:flex-start">📋 Metni kopyala</button></div>
        </div>
      </div>
    </div>`,
  });

  // ---------------------------------------------------------------- fotoğraflar
  async function fotolariYukle() {
    for (const f of fotolar) { URL.revokeObjectURL(f.url); f.bmp?.close?.(); if (f.video) { f.video.pause(); URL.revokeObjectURL(f.video.src); } }
    const kayitlar = await D.liste(sahip, 'urun');
    fotolar = (await Promise.all(kayitlar.map(async k => {
      const f = { id: k.id, blob: k.blob, url: URL.createObjectURL(k.blob) };
      try {
        if ((k.blob.type || '').startsWith('video')) { f.video = await T.videoKaynak(k.blob); f.video.play().catch(() => { }); }
        else f.bmp = await createImageBitmap(k.blob);
        return f;
      } catch { URL.revokeObjectURL(f.url); return null; }
    }))).filter(Boolean);
    $('#fotolar', d).innerHTML = fotolar.map((f, i) => `<div class="foto-kucuk">${f.video
      ? `<video src="${f.url}" muted playsinline autoplay loop></video><span class="vid">▶ video</span>` : `<img src="${f.url}" alt="">`}<span class="no">${i + 1}</span>
      <button type="button" class="sil-x" data-foto-sil="${f.id}" aria-label="Sil">×</button></div>`).join('')
      || '<p class="soluk" style="margin:0;font-size:14px">Henüz fotoğraf ya da video yok.</p>';
    yenidenKur();
  }
  $('#foto-ekle', d).addEventListener('change', async e => {
    const dosyalar = [...e.target.files];
    e.target.value = '';
    if (!dosyalar.length) return;
    bildirim('Hazırlanıyor…');
    try {
      for (const f of dosyalar) {
        if ((f.type || '').startsWith('video')) {
          if (f.size > 400 * 1048576) { bildirim('Video çok büyük; 15 saniyeden kısa çekin'); continue; }
          await D.ekle(sahip, 'urun', f, f.name);
        } else await D.ekle(sahip, 'urun', await D.fotoHazirla(f), f.name);
      }
      await fotolariYukle();
      bildirim(`${dosyalar.length} dosya eklendi`);
    } catch (err) { console.error(err); bildirim('Dosya okunamadı'); }
  });

  // ---------------------------------------------------------------- önizleme
  const tuval = $('#oniz', d);
  let anim = null, bas = performance.now(), kare = 0;
  const metinler = () => ({
    kanca: durum.kanca, baslik: durum.baslik, ozellikler: durum.ozellikler.filter(Boolean),
    fiyat: durum.fiyatGoster ? durum.fiyat : '', instagram: durum.instagram, whatsapp: durum.whatsapp,
    cagri: durum.cagri, slogan: 'El yapımı · Kişiye özel',
  });
  // Kaynaklar: video olduğu gibi; fotoğraf istenirse otomatik düzenlenmiş hali (bir kez hesaplanır)
  const kaynaklar = () => fotolar.map(f => f.video || (durum.duzenle ? (f.duzenli ||= T.iyilestir(f.bmp)) : f.bmp));
  const animYap = format => T.animasyonOlustur(durum.stil, { fotolar: kaynaklar(), logo, format, tema: durum.tema, m: metinler() });
  function yenidenKur() {
    $('#oniz-bos', d).hidden = fotolar.length > 0;
    tuval.hidden = !fotolar.length;
    anim = fotolar.length ? animYap(durum.onizFormat) : null;
    if (anim) { tuval.width = anim.W / 2; tuval.height = anim.H / 2; tuval.dataset.yon = anim.W > anim.H ? 'yatay' : 'dikey'; }
    $('#metin', d).value = T.paylasimMetni({ ...metinler(), kategori: s.kategori || '' });
  }
  const gtx = tuval.getContext('2d', { alpha: false });
  (function dongu() {
    if (!d.isConnected) return;
    if (anim && !tuval.hidden && !mesgul) {   // üretim sırasında önizleme aynı videoları sarmasın
      const t = ((performance.now() - bas) / 1000) % anim.sure;
      gtx.setTransform(0.5, 0, 0, 0.5, 0, 0);
      anim.ciz(gtx, t);
    }
    kare = requestAnimationFrame(dongu);
  })();
  d.addEventListener('close', () => {
    cancelAnimationFrame(kare);
    fotolar.forEach(f => {
      URL.revokeObjectURL(f.url); f.bmp?.close?.();
      if (f.duzenli) { f.duzenli.width = f.duzenli.height = 0; }
      if (f.video) { f.video.pause(); URL.revokeObjectURL(f.video.src); }
    });
  });

  // ---------------------------------------------------------------- girdiler
  let zaman;
  d.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.oz) durum.ozellikler[t.dataset.oz] = t.value;
    else if (t.dataset.format) { t.checked ? durum.formatlar.add(t.dataset.format) : durum.formatlar.delete(t.dataset.format); return; }
    else if (t.name === 'fiyatGoster') durum.fiyatGoster = t.checked;
    else if (t.name === 'duzenle') durum.duzenle = t.checked;
    else if (t.name in durum) durum[t.name] = t.value;
    else return;
    clearTimeout(zaman); zaman = setTimeout(() => { yenidenKur(); bas = performance.now(); }, 250);
  });
  const sec = (grup, deger, ozellik) => $$(`#${grup} [data-${ozellik}]`, d).forEach(b => b.classList.toggle('aktif', b.dataset[ozellik] === deger));
  d.addEventListener('click', async e => {
    const t = e.target.closest('[data-oniz],[data-stil],[data-tema],[data-foto-sil],[data-k]');
    if (!t) return;
    if (t.dataset.oniz) { durum.onizFormat = t.dataset.oniz; sec('oniz-format', t.dataset.oniz, 'oniz'); yenidenKur(); bas = performance.now(); return; }
    if (t.dataset.stil) {
      durum.stil = t.dataset.stil; sec('stil', durum.stil, 'stil');
      $('#tema-sec', d).hidden = durum.stil !== 'vitrin'; $('#kanca-alan', d).hidden = durum.stil !== 'ugc';
      yenidenKur(); bas = performance.now(); return;
    }
    if (t.dataset.tema) { durum.tema = t.dataset.tema; $$('[data-tema]', d).forEach(b => b.classList.toggle('aktif', b === t)); yenidenKur(); return; }
    if (t.dataset.fotoSil) { if (mesgul) return bildirim('Hazırlık bitince silebilirsiniz'); if (confirm('Bu fotoğraf silinsin mi?')) { await D.sil(t.dataset.fotoSil); fotolariYukle(); } return; }
    switch (t.dataset.k) {
      case 'kopyala': if (await metinKopyala($('#metin', d).value)) bildirim('Metin kopyalandı'); break;
      case 'video': await uret('video'); break;
      case 'gorsel': await uret('gorsel'); break;
    }
  });

  // ---------------------------------------------------------------- üretim
  let mesgul = false;
  function ilerlemeGoster(oran, yazi) {
    const el = $('#ilerleme', d);
    el.hidden = oran == null;
    if (oran != null) { $('i', el).style.width = Math.round(oran * 100) + '%'; $('span', el).textContent = yazi; }
  }
  async function uret(tur) {
    if (mesgul) return;
    if (!fotolar.length) return bildirim('Önce ürünün fotoğrafını ya da videosunu ekleyin');
    const formatlar = Object.keys(T.FORMATLAR).filter(f => durum.formatlar.has(f));
    if (!formatlar.length) return bildirim('En az bir biçim seçin');
    S.ayarKaydet({ instagram: durum.instagram.replace(/^@/, ''), whatsapp: durum.whatsapp, tanitimStil: durum.stil, tanitimTema: durum.tema, tanitimFormatlar: formatlar, tanitimDuzenle: durum.duzenle });
    mesgul = true; $$('[data-k=video],[data-k=gorsel]', d).forEach(b => { b.disabled = true; });
    fotolar.forEach(f => f.video?.pause());
    const onek = 'Envai-' + slug(durum.baslik);
    const dosyalar = [];
    try {
      if (tur === 'video') {
        for (const [i, f] of formatlar.entries()) {
          const a = animYap(f);
          const ad = T.FORMATLAR[f].ad.split(' · ')[0];
          dosyalar.push(await T.videoUret(a, `${onek}-${f}`, o => ilerlemeGoster((i + o) / formatlar.length, `${ad} video hazırlanıyor… %${Math.round(o * 100)}`)));
        }
      } else {
        dosyalar.push(...await T.gorselSetiUret({ fotolar: kaynaklar(), logo, formatlar, tema: durum.tema, m: metinler(), adOnek: onek },
          o => ilerlemeGoster(o, `Görseller hazırlanıyor… %${Math.round(o * 100)}`)));
      }
      sonucGoster(tur, dosyalar);
      // Ürün Galerisi'ne kaydet
      for (const f of dosyalar) await D.ekle(sahip, tur === 'video' ? 'video' : 'uretilen', f, f.name);
      bildirim((tur === 'video' ? `${dosyalar.length} video hazır` : `${dosyalar.length} görsel hazır`) + " · Ürün Galerisi'ne eklendi");
    } catch (err) {
      console.error(err);
      bildirim(tur === 'video' ? 'Video oluşturulamadı' : 'Görseller oluşturulamadı');
    } finally {
      mesgul = false; ilerlemeGoster(null); $$('[data-k=video],[data-k=gorsel]', d).forEach(b => { b.disabled = false; });
      fotolar.forEach(f => f.video?.play().catch(() => { }));
    }
  }

  function sonucGoster(tur, dosyalar) {
    const kap = document.createElement('div');
    kap.className = 'kart ic sonuc-kart';
    const urller = dosyalar.map(f => URL.createObjectURL(f));
    d.addEventListener('close', () => urller.forEach(u => URL.revokeObjectURL(u)), { once: true });
    const mb = n => (n / 1048576).toLocaleString('tr-TR', { maximumFractionDigits: 1 }) + ' MB';
    kap.innerHTML = tur === 'video'
      ? `<h3>🎬 Videolar</h3>${dosyalar.map((f, i) => `
        <div class="video-sonuc">
          <video src="${urller[i]}" controls playsinline muted loop></video>
          <div><b>${esc(f.name)}</b><div class="soluk">${mb(f.size)}</div>
            <div class="btn-satir" style="margin-top:8px"><button class="btn ana kucuk" data-paylas="${i}">Paylaş</button><button class="btn kucuk" data-indir="${i}">İndir</button></div></div>
        </div>`).join('')}
        <p class="ipucu">Paylaş → <b>Instagram</b> (Reels / Hikâye / Gönderi), <b>WhatsApp</b> ya da <b>Videoyu Kaydet</b> (Fotoğraflar'a). Müziği Instagram'da ekleyebilirsiniz.</p>`
      : `<h3>🖼️ Ürün görselleri <small class="soluk">${dosyalar.length} adet</small></h3>
        <div class="gorsel-izgara">${dosyalar.map((f, i) => `<button type="button" class="gorsel-k" data-paylas="${i}" title="Paylaş"><img src="${urller[i]}" alt=""></button>`).join('')}</div>
        <div class="btn-satir" style="margin-top:10px"><button class="btn ana kucuk" data-hepsi="paylas">Hepsini paylaş</button><button class="btn kucuk" data-hepsi="indir">Hepsini indir</button></div>
        <p class="ipucu">Bir görsele dokunun → tek tek paylaşın. "Hepsini paylaş" ile Instagram'da çoklu gönderi yapabilir ya da <b>Görüntüleri Kaydet</b> ile Fotoğraflar'a alabilirsiniz.</p>`;
    kap.addEventListener('click', async e => {
      const t = e.target.closest('[data-paylas],[data-indir],[data-hepsi]');
      if (!t) return;
      if (t.dataset.paylas) await dosyaPaylas(dosyalar[t.dataset.paylas]);
      else if (t.dataset.indir) dosyaIndir(dosyalar[t.dataset.indir]);
      else if (t.dataset.hepsi === 'indir') dosyalar.forEach((f, i) => setTimeout(() => dosyaIndir(f), i * 350));
      else if (navigator.canShare?.({ files: dosyalar })) { try { await navigator.share({ files: dosyalar }); } catch { } }
      else dosyalar.forEach((f, i) => setTimeout(() => dosyaIndir(f), i * 350));
    });
    $('#sonuclar', d).prepend(kap);
    kap.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  await fotolariYukle();
  return d;
}

/** Satış formu için: o satışın fotoğraf sayısı */
export async function fotoSayisi(satisId) {
  try { return (await D.liste('satis:' + satisId, 'urun')).length; } catch { return 0; }
}
