// Tanıtım stüdyosu: iş bitince ürün fotoğrafı çek → UGC / vitrin tanıtım videosu ve
// farklı kadrajlarda ürün görselleri üret (dikey + yatay) → Instagram / WhatsApp'ta paylaş ya da indir.
import * as S from './store.js';
import * as D from './dosyadepo.js';
import * as T from './tanitim.js';
import * as AI from './analiz.js';
import { para } from './hesap.js';
import { $, $$, esc, bildirim, sayfaAc, dosyaPaylas, dosyaIndir, metinKopyala, medyaGoster, SVG_ARTI } from './ui.js';

const st = S.st;
const slug = s => (s || 'urun').toLocaleLowerCase('tr').replace(/[çğıöşü]/g, c => ({ ç: 'c', ğ: 'g', ı: 'i', ö: 'o', ş: 's', ü: 'u' }[c]))
  .replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'urun';

/** s: kayıtlı satış. */
export async function tanitimStudyosu(s) {
  const sahip = 'satis:' + s.id;
  const u = s.urunId ? st.urunler[s.urunId] : null;
  const ayar = st.ayar;
  // Ürün adından ipucu ("yastık üzerine nakış" → yastık kılıfı): fotoğraf analizinden önce de doğru metinler
  // Satışta "Ürün ne?" alanına yazılan tanım da kullanılır (özellikler ondan çıkarılır)
  let tanim = s.urunTanim || '';
  const ipucuBul = () => {
    const a = AI.adTahmin(s.urunAd || ''), b = AI.adTahmin(tanim);
    return { urun: b.urun || a.urun, motif: b.motif || a.motif };
  };
  let adIpucu = ipucuBul();
  const ilk = adIpucu.urun ? AI.metinOner(adIpucu.urun, adIpucu.motif || 'duz', '', tanim) : null;
  const durum = {
    stil: ayar.tanitimStil || 'ugc', tema: ayar.tanitimTema || 'zarif', onizFormat: 'dikey',
    formatlar: new Set(ayar.tanitimFormatlar || ['dikey', 'yatay']),
    kanca: ilk ? ilk.kancalar[0] : T.kancaOner(s.kategori, s.urunAd)[0],
    baslik: s.urunAd || 'El yapımı tasarım',
    ozellikler: ilk ? ilk.ozellikler : T.ozellikOner(s.kategori, s.urunAd),
    fiyatGoster: false, duzenle: ayar.tanitimDuzenle !== false,
    fiyat: para(s.birimFiyat || u?.satisFiyati || 0),
    instagram: ayar.instagram || 'envai_tasarim', whatsapp: ayar.whatsapp || '',
    cagri: "Sipariş için DM'den yaz 📩",
    aciklama: ilk ? ilk.aciklama : '',
    etiketler: ilk ? ilk.etiket.join(' ') : T.etiketlerOner(s.kategori, s.urunAd),
  };
  // Fotoğraf analizi (analiz.js): degisen = kullanıcının elle değiştirdiği alanlar (AI bunların üzerine yazmaz)
  const ai = { hal: 'bos', oran: 0, sonuc: null, urunK: adIpucu.urun, motifK: adIpucu.motif || 'duz', degisen: new Set(), sira: 0, imza: '' };
  let fotolar = [];      // { id, blob, url, bmp | video, duzenli }
  let logo = null;
  try { logo = await T.resimYukle('logo/envai-amblem.png'); } catch { }
  T.yaziTipleriHazir();

  const kancalar = [...new Set([...(ilk?.kancalar || []), ...T.kancaOner(s.kategori, s.urunAd)])];
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
          <label class="alan" style="margin-top:10px">Ürün ne? <small class="soluk">kısaca anlatın · AI özellikleri ve yazıları buna göre hazırlar</small>
            <textarea name="tanim" rows="2" placeholder="Örn. Bebek odası için pembe, isim ve çiçek nakışlı pamuklu yastık kılıfı">${esc(tanim)}</textarea></label>
          <div class="ai-kart" id="ai-kart" hidden></div>
        </div>
        <div class="bolum"><h3>2. Video</h3>
          <div class="segment" id="stil">${Object.entries(T.STILLER).map(([k, ad]) => `<button type="button" data-stil="${k}" class="${k === durum.stil ? 'aktif' : ''}">${ad.split(' · ')[0]}<small>${ad.split(' · ')[1]}</small></button>`).join('')}</div>
          <div class="alan tema-sec" id="tema-sec" ${durum.stil === 'vitrin' ? '' : 'hidden'}>Renk teması
            <div class="cipler" style="margin:4px 0 0">${Object.entries(T.TEMALAR).map(([k, t]) => `<button type="button" class="cip ${k === durum.tema ? 'aktif' : ''}" data-tema="${k}"><i style="background:linear-gradient(135deg,${t.bg[0]},${t.bg[1]})"></i>${t.ad}</button>`).join('')}</div></div>
          <label class="alan" id="kanca-alan" ${durum.stil === 'ugc' ? '' : 'hidden'}>Açılış cümlesi (kanca)
            <input name="kanca" list="dl-kanca" value="${esc(durum.kanca)}" placeholder="İzleyeni durduracak ilk cümle">
            <datalist id="dl-kanca">${kancalar.map(k => `<option value="${esc(k)}">`).join('')}</datalist></label>
          <label class="alan">Ürün adı<input name="baslik" value="${esc(durum.baslik)}"></label>
          <div class="alan" id="oz-alan">Öne çıkan özellikler
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
          <label class="alan">Reklam açıklaması <small class="soluk">paylaşım metninin başına eklenir</small>
            <textarea name="aciklama" rows="3" placeholder="Fotoğraf eklenince AI burayı doldurur; dilediğiniz gibi değiştirin">${esc(durum.aciklama)}</textarea></label>
          <label class="alan">Hashtag'ler <small class="soluk">ürüne göre 5 adet · dilediğiniz gibi değiştirin</small>
            <input name="etiketler" value="${esc(durum.etiketler)}" autocapitalize="off" autocorrect="off" spellcheck="false"></label>
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
    // Fotoğraflar değiştiyse yeniden analiz et (ilk 3 fotoğrafa bakılır)
    const imza = fotolar.slice(0, 3).map(f => f.id).join(',');
    if (imza !== ai.imza) { ai.imza = imza; if (fotolar.length) aiAnaliz(); else { ai.hal = 'bos'; aiCiz(); } }
  }

  // ---------------------------------------------------------------- AI fotoğraf analizi
  async function aiAnaliz() {
    const sira = ++ai.sira;
    const indirilecek = !(await AI.modelHazirMi());
    ai.hal = 'yukleniyor'; ai.oran = 0; ai.indir = indirilecek; aiCiz();
    try {
      const kaynak = fotolar.map(f => f.video || f.bmp).filter(k => (k.videoWidth || k.width) > 0);
      const sonuc = await AI.analizEt(kaynak, o => { if (sira === ai.sira) { ai.oran = o; aiCiz(); } });
      if (sira !== ai.sira || !d.isConnected) return;
      ai.sonuc = sonuc; ai.hal = 'hazir';
      // Ürün adı bir ürünü açıkça söylüyorsa o seçilir; fotoğraf sonucu çiplerde kalır
      ai.urunK = adIpucu.urun || sonuc.urun[0].k;
      ai.motifK = adIpucu.motif || sonuc.motif[0].k;
      aiUygula();
    } catch (err) {
      console.error(err);
      if (sira === ai.sira) { ai.hal = 'hata'; aiCiz(); }
    }
  }
  /** AI metinlerini forma yazar. zorla değilse kullanıcının elle değiştirdiği alanlara dokunmaz. */
  function aiUygula(zorla = false) {
    const o = AI.metinOner(ai.urunK, ai.motifK, ai.sonuc?.renk, tanim);
    if (!o) return;
    if (zorla) ai.degisen.clear();
    const yaz = a => !ai.degisen.has(a);
    ai.reklam = null;   // yeni ürün/desen → reklam yazıları yeniden hazırlanır
    if (yaz('baslik')) { durum.baslik = o.baslik; $('[name=baslik]', d).value = o.baslik; }
    if (yaz('aciklama')) { durum.aciklama = o.aciklama; $('[name=aciklama]', d).value = o.aciklama; }
    if (yaz('kanca')) { durum.kanca = o.kancalar[0]; $('[name=kanca]', d).value = o.kancalar[0]; }
    if (yaz('etiketler')) { durum.etiketler = o.etiket.join(' '); $('[name=etiketler]', d).value = durum.etiketler; }
    $('#dl-kanca', d).innerHTML = [...new Set([...o.kancalar, ...kancalar])].map(k => `<option value="${esc(k)}">`).join('');
    if (yaz('oz')) {
      durum.ozellikler = [...o.ozellikler];
      $('#oz-alan', d).innerHTML = 'Öne çıkan özellikler' + o.ozellikler.map((x, i) => `<input data-oz="${i}" value="${esc(x)}" style="margin-top:4px">`).join('');
    }
    aiCiz(); yenidenKur(); bas = performance.now();
  }
  function aiCiz() {
    const el = $('#ai-kart', d);
    if (!el) return;
    el.hidden = ai.hal === 'bos';
    if (ai.hal === 'yukleniyor') {
      el.innerHTML = `<div class="ai-baslik">🤖 <b>${ai.indir ? 'AI modeli indiriliyor' : 'Fotoğraf analiz ediliyor…'}</b></div>
        ${ai.indir ? `<p class="ipucu" style="margin:4px 0">İlk sefere özel (~23 MB, Wi-Fi önerilir). Sonra internetsiz ve anında çalışır. Fotoğraf hiçbir yere gönderilmez.</p>` : ''}
        <div class="ilerleme"><i style="width:${Math.round((ai.indir ? ai.oran : 0.6) * 100)}%"></i><span>${ai.indir ? '%' + Math.round(ai.oran * 100) : 'Ürün ve desen tanınıyor…'}</span></div>`;
    } else if (ai.hal === 'hata') {
      el.innerHTML = `<div class="ai-baslik">🤖 <b>AI analizi yapılamadı</b></div>
        <p class="ipucu" style="margin:4px 0">İlk analiz için internet gerekir. Metinleri yine de elle yazabilirsiniz.</p>
        <button type="button" class="btn kucuk" data-ai="tekrar">↻ Tekrar dene</button>`;
    } else if (ai.hal === 'hazir') {
      const s = ai.sonuc, u = AI.URUNLER[ai.urunK], o = AI.metinOner(ai.urunK, ai.motifK, s.renk, tanim);
      const p = s.urun.find(x => x.k === ai.urunK)?.p || 0;
      const emin = s.urun[0].p >= 0.45 || !!adIpucu.urun;
      const adFarkli = adIpucu.urun && adIpucu.urun !== s.urun[0].k && ai.urunK === adIpucu.urun;
      const motif = u.nakis && AI.MOTIFLER[ai.motifK]?.ad;
      const urunCip = [...new Set([ai.urunK, ...s.urun.slice(0, 4).map(x => x.k)])].slice(0, 5);
      el.innerHTML = `<div class="ai-baslik">🤖 <b>${adFarkli ? 'Seçilen ürün' : 'AI fotoğrafta gördü'}:</b> ${u.emoji} ${esc(u.ad)}${motif ? ' · ' + esc(motif) : ''}${s.renk ? ' · ' + esc(s.renk) + ' tonları' : ''}
          ${adFarkli ? '' : `<small class="soluk">%${Math.round(p * 100)}</small>`}</div>
        ${adFarkli ? `<p class="ipucu" style="margin:4px 0">Ürün adına göre <b>${esc(u.ad)}</b> seçildi (fotoğrafta ${esc(AI.URUNLER[s.urun[0].k].ad.toLocaleLowerCase('tr'))} gibi görünüyor). Yanlışsa aşağıdan değiştirin.</p>` : ''}
        ${emin ? '' : '<p class="ipucu" style="margin:4px 0">Emin olamadım; doğru olanı aşağıdan seçin 👇</p>'}
        <div class="ai-satir"><span class="soluk">Ürün</span><div class="cipler">${urunCip.map(k => `<button type="button" class="cip ${k === ai.urunK ? 'aktif' : ''}" data-ai-urun="${k}">${AI.URUNLER[k].emoji} ${esc(AI.URUNLER[k].ad)}</button>`).join('')}
          <select data-ai-diger aria-label="Diğer ürün"><option value="">Diğer…</option>${Object.entries(AI.URUNLER).filter(([k]) => !urunCip.includes(k)).map(([k, x]) => `<option value="${k}">${esc(x.ad)}</option>`).join('')}</select></div></div>
        ${u.nakis ? `<div class="ai-satir"><span class="soluk">Desen</span><div class="cipler">${[...new Set([ai.motifK, ...s.motif.slice(0, 3).map(x => x.k)])].map(k => `<button type="button" class="cip ${k === ai.motifK ? 'aktif' : ''}" data-ai-motif="${k}">${esc(AI.MOTIFLER[k].ad || 'belirgin desen yok')}</button>`).join('')}</div></div>` : ''}
        <div class="alan" style="margin-top:6px">Hazır reklam yazıları <small class="soluk">istediğiniz gibi düzenleyebilirsiniz</small>
          ${(ai.reklam ||= o.reklam).map((r, i) => `<div class="ai-reklam"><textarea rows="2" data-ai-reklam="${i}">${esc(r)}</textarea>
            <div class="btn-satir"><button type="button" class="btn kucuk" data-ai-kopya="${i}">📋 Kopyala</button><button type="button" class="btn kucuk" data-ai-aciklama="${i}">⬇️ Açıklamaya yaz</button></div></div>`).join('')}</div>
        <div class="btn-satir" style="margin-top:8px"><button type="button" class="btn ana kucuk" data-ai="uygula">✨ Metinleri forma yaz</button><button type="button" class="btn kucuk" data-ai="tekrar">↻ Yeniden analiz</button></div>
        ${ai.degisen.size ? '<p class="ipucu" style="margin:6px 0 0">Elle değiştirdiğiniz alanlara dokunulmadı. Hepsini yenilemek için "Metinleri forma yaz"a basın.</p>' : ''}`;
      $$('[data-ai-reklam]', el).forEach(boyutla);
    }
  }
  // Yazı kutusu içeriği kadar uzasın
  function boyutla(t) { t.style.height = 'auto'; t.style.height = t.scrollHeight + 2 + 'px'; }
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
    cagri: durum.cagri, slogan: 'El yapımı · Kişiye özel', aciklama: durum.aciklama, etiketler: durum.etiketler,
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
  let zaman, tanimZaman;
  d.addEventListener('input', e => {
    const t = e.target;
    if (t.dataset.aiReklam) { if (ai.reklam) ai.reklam[t.dataset.aiReklam] = t.value; boyutla(t); return; }
    if (t.dataset.aiDiger !== undefined) { if (t.value) { ai.urunK = t.value; aiUygula(); } return; }
    if (t.name === 'tanim') {
      tanim = t.value;
      clearTimeout(tanimZaman);
      tanimZaman = setTimeout(() => {
        // Tanım bir ürün söylüyorsa o seçilir; özellikler ve yazılar yeniden hazırlanır, satışa da kaydedilir
        const onceki = adIpucu.urun;
        adIpucu = ipucuBul();
        if (adIpucu.urun && adIpucu.urun !== onceki) ai.urunK = adIpucu.urun;
        if (adIpucu.motif) ai.motifK = adIpucu.motif;
        ai.urunK ||= adIpucu.urun;
        if (ai.urunK) aiUygula();
        const kayit = st.satislar[s.id];
        if (kayit && (kayit.urunTanim || '') !== tanim) { S.kaydet('satislar', { ...kayit, urunTanim: tanim }); s.urunTanim = tanim; }
      }, 700);
      return;
    }
    if (t.dataset.oz) ai.degisen.add('oz');
    else if (['kanca', 'baslik', 'aciklama', 'etiketler'].includes(t.name)) ai.degisen.add(t.name);
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
    const t = e.target.closest('[data-oniz],[data-stil],[data-tema],[data-foto-sil],[data-k],[data-ai],[data-ai-urun],[data-ai-motif],[data-ai-kopya],[data-ai-aciklama]');
    if (!t) return;
    if (t.dataset.aiUrun) { ai.urunK = t.dataset.aiUrun; return aiUygula(); }
    if (t.dataset.aiMotif) { ai.motifK = t.dataset.aiMotif; return aiUygula(); }
    if (t.dataset.aiKopya) { if (await metinKopyala(ai.reklam?.[t.dataset.aiKopya] || '')) bildirim('Reklam yazısı kopyalandı'); return; }
    if (t.dataset.aiAciklama) {
      durum.aciklama = ai.reklam?.[t.dataset.aiAciklama] || ''; $('[name=aciklama]', d).value = durum.aciklama; ai.degisen.add('aciklama');
      yenidenKur(); bildirim('Reklam açıklamasına yazıldı'); return;
    }
    if (t.dataset.ai === 'uygula') {
      if (ai.degisen.size && !confirm('Elle yaptığınız değişikliklerin yerine AI metinleri yazılsın mı?')) return;
      return aiUygula(true);
    }
    if (t.dataset.ai === 'tekrar') return aiAnaliz();
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
          <button type="button" class="video-k" data-buyut="${i}" aria-label="Büyük izle"><video src="${urller[i]}" playsinline muted loop autoplay></video><span class="buyut">⤢ Büyüt</span></button>
          <div><b>${esc(f.name)}</b><div class="soluk">${mb(f.size)}</div>
            <div class="btn-satir" style="margin-top:8px"><button class="btn ana kucuk" data-paylas="${i}">Paylaş</button><button class="btn kucuk" data-indir="${i}">İndir</button></div></div>
        </div>`).join('')}
        <p class="ipucu">Videoya dokunun → büyük önizleme. Paylaş → <b>Instagram</b> (Reels / Hikâye / Gönderi), <b>WhatsApp</b> ya da <b>Videoyu Kaydet</b> (Fotoğraflar'a). Müziği Instagram'da ekleyebilirsiniz.</p>`
      : `<h3>🖼️ Ürün görselleri <small class="soluk">${dosyalar.length} adet</small></h3>
        <div class="gorsel-izgara">${dosyalar.map((f, i) => `<button type="button" class="gorsel-k" data-buyut="${i}" title="Büyük göster"><img src="${urller[i]}" alt=""><span class="buyut">⤢</span></button>`).join('')}</div>
        <div class="btn-satir" style="margin-top:10px"><button class="btn ana kucuk" data-hepsi="paylas">Hepsini paylaş</button><button class="btn kucuk" data-hepsi="indir">Hepsini indir</button></div>
        <p class="ipucu">Bir görsele dokunun → büyük önizleme (oradan tek tek paylaşabilirsiniz). "Hepsini paylaş" ile Instagram'da çoklu gönderi yapabilir ya da <b>Görüntüleri Kaydet</b> ile Fotoğraflar'a alabilirsiniz.</p>`;
    kap.addEventListener('click', async e => {
      const t = e.target.closest('[data-paylas],[data-indir],[data-hepsi],[data-buyut]');
      if (!t) return;
      if (t.dataset.buyut) medyaGoster(dosyalar.map((f, j) => ({ url: urller[j], video: tur === 'video', dosya: f })), +t.dataset.buyut);
      else if (t.dataset.paylas) await dosyaPaylas(dosyalar[t.dataset.paylas]);
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
