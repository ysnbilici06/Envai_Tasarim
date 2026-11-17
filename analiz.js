// Ücretsiz, cihaz üzerinde fotoğraf analizi: MobileCLIP-S0 görüntü modeli (~23 MB, ilk seferde
// indirilir ve tarayıcıda saklanır) fotoğrafı ai-etiketler.json'daki ürün/motif tariflerine benzetir.
// Sonuca göre Türkçe reklam metinleri (başlık, kanca, özellikler, açıklama) hazırlanır.
// Fotoğraf hiçbir sunucuya gönderilmez.

const KUTUPHANE = 'https://cdn.jsdelivr.net/npm/@huggingface/transformers@3.7.5';
const MODEL = 'Xenova/mobileclip_s0';

let hazirlik = null;
/** Modeli ve etiketleri bir kez yükler. ilerle(oran 0..1) indirme ilerlemesi. */
function hazirla(ilerle) {
  hazirlik ||= (async () => {
    const tf = await import(KUTUPHANE);
    tf.env.allowLocalModels = false;
    const yuk = {};
    const [islemci, model, etiket] = await Promise.all([
      tf.AutoProcessor.from_pretrained(MODEL),
      // fp16: sıkıştırılmış (q8) sürüm ürünleri ayırt edemiyor, fp16 doğru sonuç veriyor
      tf.CLIPVisionModelWithProjection.from_pretrained(MODEL, {
        dtype: 'fp16',
        progress_callback: p => {
          if (p.status === 'progress' && p.total) {
            yuk[p.file] = [p.loaded, p.total];
            const [a, b] = Object.values(yuk).reduce(([x, y], [l, t]) => [x + l, y + t], [0, 0]);
            hazirlik.ilerle?.(a / b);
          }
        },
      }),
      fetch('ai-etiketler.json').then(r => { if (!r.ok) throw new Error('etiketler'); return r.json(); }),
    ]);
    return { tf, islemci, model, etiket };
  })();
  hazirlik.ilerle = ilerle;
  hazirlik.catch(() => { hazirlik = null; });   // hata olursa sonraki denemede yeniden
  return hazirlik;
}

const norm = v => { let s = 0; for (const x of v) s += x * x; s = Math.sqrt(s) || 1; return v.map(x => x / s); };

function tuvale(kaynak, en = 384) {
  const w = kaynak.videoWidth || kaynak.width, h = kaynak.videoHeight || kaynak.height;
  const o = Math.min(1, en / Math.max(w, h));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w * o)); c.height = Math.max(1, Math.round(h * o));
  const g = c.getContext('2d', { willReadFrequently: true });
  g.drawImage(kaynak, 0, 0, c.width, c.height);
  return { c, g };
}

/** Baskın rengi (ortadaki bölgeden) Türkçe ad olarak verir. */
function baskinRenk(g, w, h) {
  const { data } = g.getImageData(Math.round(w * 0.2), Math.round(h * 0.2), Math.round(w * 0.6), Math.round(h * 0.6));
  const kova = {};
  for (let i = 0; i < data.length; i += 16) {
    const r = data[i] / 255, gg = data[i + 1] / 255, b = data[i + 2] / 255;
    const mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), l = (mx + mn) / 2, d = mx - mn;
    const s = d === 0 ? 0 : d / (1 - Math.abs(2 * l - 1));
    let ad;
    if (l < 0.16) ad = 'siyah';
    else if (s < 0.18 || d < 0.08) ad = l > 0.82 ? 'beyaz' : l > 0.6 ? 'krem' : l > 0.35 ? 'gri' : 'antrasit';
    else {
      let hue = mx === r ? ((gg - b) / d) % 6 : mx === gg ? (b - r) / d + 2 : (r - gg) / d + 4;
      hue = (hue * 60 + 360) % 360;
      if (hue < 15 || hue >= 340) ad = l > 0.7 ? 'pembe' : 'kırmızı';
      else if (hue < 40) ad = l < 0.45 ? 'kahverengi' : l > 0.75 ? 'krem' : 'turuncu';
      else if (hue < 65) ad = l > 0.75 ? 'krem' : l < 0.4 ? 'hardal' : 'sarı';
      else if (hue < 165) ad = 'yeşil';
      else if (hue < 200) ad = 'turkuaz';
      else if (hue < 255) ad = l < 0.35 ? 'lacivert' : 'mavi';
      else if (hue < 300) ad = l > 0.65 ? 'lila' : 'mor';
      else ad = l > 0.6 ? 'pembe' : 'fuşya';
    }
    kova[ad] = (kova[ad] || 0) + 1;
  }
  return Object.entries(kova).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
}

function sirala(v, siniflar) {
  const skor = Object.entries(siniflar).map(([k, t]) => [k, t.reduce((a, x, j) => a + x * v[j], 0) * 100]);
  const enb = Math.max(...skor.map(x => x[1]));
  const ex = skor.map(([k, x]) => [k, Math.exp(x - enb)]);
  const top = ex.reduce((a, [, x]) => a + x, 0);
  return ex.map(([k, x]) => ({ k, p: x / top })).sort((a, b) => b.p - a.p);
}

/**
 * kaynaklar: ImageBitmap / HTMLImageElement / canvas / video (en fazla 3 tanesi incelenir).
 * Dönüş: { urun:[{k,p}...], motif:[{k,p}...], renk }
 */
export async function analizEt(kaynaklar, ilerle) {
  const { tf, islemci, model, etiket } = await hazirla(ilerle);
  let toplam = null, renk = '';
  for (const [i, k] of kaynaklar.slice(0, 3).entries()) {
    const { c, g } = tuvale(k);
    if (i === 0) renk = baskinRenk(g, c.width, c.height);
    const id = g.getImageData(0, 0, c.width, c.height);
    const resim = new tf.RawImage(new Uint8ClampedArray(id.data), c.width, c.height, 4).rgb();
    const { image_embeds } = await model(await islemci(resim));
    const v = norm(Array.from(image_embeds.data));
    toplam = toplam ? toplam.map((x, j) => x + v[j]) : v;
    c.width = c.height = 0;
  }
  if (!toplam) throw new Error('fotoğraf yok');
  const v = norm(toplam);
  return { urun: sirala(v, etiket.urun), motif: sirala(v, etiket.motif), renk };
}

/** Model daha önce indirildi mi? (indirme uyarısı için) */
export async function modelHazirMi() {
  try {
    const c = await caches.open('transformers-cache');
    return (await c.keys()).some(r => r.url.includes('mobileclip_s0') && r.url.includes('vision_model_fp16'));
  } catch { return false; }
}

// ================================================================ Türkçe reklam metinleri
// nakis: nakış işi mi (motif cümleleri eklenir). ad: başlıkta, cumle: cümle içinde kullanılan ad.
export const URUNLER = {
  yastik: {
    ad: 'Yastık Kılıfı', cumle: 'yastık kılıfı', nakis: true, emoji: '🛋️',
    kancalar: ['Yastık kılıfına kişiye özel nakış 🪡', 'Evinize özel bir dokunuş: nakışlı yastık 🛋️', 'Bu yastık kılıfı tamamen size özel ✨'],
    ozellikler: ['Kişiye özel nakış desen çalışması', 'İsim, tarih ya da motif eklenebilir'],
    aciklama: 'Yastık kılıfı üzerine kişiye özel nakış desen çalışması 🪡 İster isim, ister tarih, ister sevdiğiniz bir motif… Evinize ya da sevdiklerinize anlamlı bir dokunuş 🤍',
    etiket: ['#nakışlıyastık', '#yastıkkılıfı', '#evdekorasyonu', '#dekoratifyastık'],
  },
  havlu: {
    ad: 'Havlu', cumle: 'havlu', nakis: true, emoji: '🛁',
    kancalar: ['İsme özel nakışlı havlu hazır 🛁', 'Banyonuza kişiye özel bir dokunuş ✨', 'Çeyizlik havlular ilmek ilmek işlendi 🪡'],
    ozellikler: ['İsme özel nakış işleme', 'Çeyiz ve hediye için ideal'],
    aciklama: 'Havlu üzerine kişiye özel nakış işleme 🪡 İsim, baş harf ya da sevdiğiniz bir motifle çeyizlik, hediyelik ya da kendinize özel havlular 🤍',
    etiket: ['#isimlihavlu', '#nakışlıhavlu', '#çeyiz', '#çeyizlik'],
  },
  bornoz: {
    ad: 'Bornoz', cumle: 'bornoz', nakis: true, emoji: '🛁',
    kancalar: ['İsme özel nakışlı bornoz 🛁', 'Bornozunuz artık size özel ✨', 'Damat bohçasına en şık dokunuş 🤵'],
    ozellikler: ['İsim / baş harf nakışı', 'Çeyiz ve damat bohçası için ideal'],
    aciklama: 'Bornoz üzerine kişiye özel nakış çalışması 🪡 Çeyiz, damat bohçası ya da sevdiklerinize anlamlı bir hediye 🤍',
    etiket: ['#nakışlıbornoz', '#isimlibornoz', '#çeyiz', '#damatbohçası'],
  },
  bebek: {
    ad: 'Bebek Hediyesi', cumle: 'bebek ürünü', nakis: true, emoji: '👶',
    kancalar: ['Minik bebeğe isme özel nakış 👶', 'En tatlı bebek hediyesi hazır 🎁', 'Hoş geldin bebek! 🍼'],
    ozellikler: ['Bebeğin ismi işlenir', 'Doğum hediyesi için ideal'],
    aciklama: 'Bebeğinize ya da yeni doğan hediyesine kişiye özel nakış çalışması 🪡 İsim, doğum tarihi ve sevimli motiflerle unutulmaz bir hatıra 🤍',
    etiket: ['#bebekhediyesi', '#isimlibebek', '#yenidoğan', '#hoşgeldinbebek'],
  },
  canta_ip: {
    ad: 'Kağıt İp Çanta', baslik: 'El Örgüsü Kağıt İp Çanta', cumle: 'kağıt ip çanta', nakis: false, emoji: '👜',
    kancalar: ['Kağıt ipten bir çanta daha bitti 👜', 'POV: Hayalindeki çantayı elle örüyorum 🧶', 'Bu çanta tamamen el emeği 🤍'],
    ozellikler: ['Kağıt ipten el örgüsü', 'Hafif ve dayanıklı', 'Renk ve model seçeneği'],
    aciklama: 'Kağıt ipten tamamen el örgüsü çanta 🧶 Hafif, dayanıklı ve her kombine yakışan bir tasarım. Dilediğiniz renk ve modelde sipariş verebilirsiniz 👜',
    etiket: ['#kağıtipçanta', '#örgüçanta', '#elyapımıçanta', '#çantamodelleri'],
  },
  canta_bez: {
    ad: 'Bez Çanta', cumle: 'bez çanta', nakis: true, emoji: '👜',
    kancalar: ['Bez çantaya kişiye özel nakış 👜', 'Sadece sana ait bir çanta ✨', 'Günlük çantana el emeği dokunuş 🪡'],
    ozellikler: ['İsim ya da desen işlenir', 'Günlük kullanıma uygun'],
    aciklama: 'Bez çanta üzerine kişiye özel nakış çalışması 🪡 İsim, kısa bir söz ya da sevdiğiniz bir motifle size özel bir çanta 👜',
    etiket: ['#bezçanta', '#nakışlıçanta', '#totebag'],
  },
  elbise: {
    ad: 'Elbise', baslik: 'Ölçüye Özel Elbise Dikimi', cumle: 'elbise', nakis: false, emoji: '👗',
    kancalar: ['Ölçüye özel diktiğim elbise 👗', 'Provadan önce son dokunuşlar 🪡', 'Hayalinizdeki elbise hazır ✨'],
    ozellikler: ['Ölçünüze özel dikim', 'Kumaş ve model seçeneği', 'Özenli işçilik'],
    aciklama: 'Ölçünüze ve zevkinize göre özel elbise dikimi 👗 Model ve kumaş seçiminden son dikişe kadar her aşama özenle hazırlanır ✨',
    etiket: ['#elbisedikimi', '#özeldikim', '#terzi', '#abiye'],
  },
  pantolon: {
    ad: 'Paça / Tadilat', baslik: 'Paça Kısaltma ve Tadilat', cumle: 'paça tadilatı', nakis: false, emoji: '👖',
    kancalar: ['Paçası kısaldı, tam oturdu ✂️', 'Önce / sonra 👖', 'Tadilatı biz yaparız, siz rahat edin ✨'],
    ozellikler: ['Ölçünüze göre', 'Hızlı teslim', 'Özenli dikiş'],
    aciklama: 'Paça kısaltma ve tadilat işleriniz özenle yapılır ✂️ Ölçünüze tam oturan, temiz dikişli bir sonuç için bize yazın 👖',
    etiket: ['#paçakısaltma', '#tadilat', '#terzi'],
  },
  ust_giyim: {
    ad: 'Tişört / Sweatshirt', cumle: 'tişört', nakis: true, emoji: '👕',
    kancalar: ['Tişörtüne kişiye özel nakış 👕', 'Kıyafetine sadece sana ait bir dokunuş ✨', 'İstediğin yazı, istediğin desen 🪡'],
    ozellikler: ['İsim, yazı ya da logo işlenir', 'Yıkamaya dayanıklı nakış'],
    aciklama: 'Tişört, sweatshirt ve gömlek üzerine kişiye özel nakış çalışması 🪡 İsim, kısa bir yazı, logo ya da sevdiğiniz bir figür… Kıyafetiniz artık size özel 👕',
    etiket: ['#nakışlıtişört', '#kişiyeözeltişört', '#nakışlısweat'],
  },
  masa: {
    ad: 'Masa Örtüsü', cumle: 'masa örtüsü', nakis: true, emoji: '🍽️',
    kancalar: ['Sofranıza el emeği bir dokunuş 🍽️', 'Nakışlı masa örtüsü hazır ✨', 'Misafirleriniz bu örtüye bayılacak 🤍'],
    ozellikler: ['El emeği nakış işleme', 'Çeyizlik ve hediyelik'],
    aciklama: 'Masa örtüsü ve runner üzerine nakış işleme 🪡 Sofralarınıza zarif, el emeği bir dokunuş; çeyiz ve hediye için de harika bir seçenek 🤍',
    etiket: ['#masaörtüsü', '#nakışlıörtü', '#runner', '#çeyiz'],
  },
  mendil: {
    ad: 'Mendil', cumle: 'mendil', nakis: true, emoji: '🤍',
    kancalar: ['İsme özel nakışlı mendil 🤍', 'Küçük ama çok anlamlı bir hediye 🎁', 'Söz ve nişan için en zarif detay 💍'],
    ozellikler: ['İsim / baş harf nakışı', 'Söz, nişan ve düğün için ideal'],
    aciklama: 'Mendil üzerine kişiye özel nakış çalışması 🪡 Söz, nişan, düğün ya da anlamlı bir hediye için zarif bir hatıra 🤍',
    etiket: ['#nakışlımendil', '#isimlimendil', '#sözhediyesi', '#nişan'],
  },
  nevresim: {
    ad: 'Nevresim Takımı', cumle: 'nevresim takımı', nakis: true, emoji: '🛏️',
    kancalar: ['Yatak odanıza nakışlı bir dokunuş 🛏️', 'Çeyizlik nakışlı nevresim hazır ✨', 'Her sabah size özel uyanın 🤍'],
    ozellikler: ['İsim / baş harf nakışı', 'Çeyiz için ideal'],
    aciklama: 'Nevresim ve yastık takımları üzerine kişiye özel nakış çalışması 🪡 Çeyizinize ya da yatak odanıza zarif, el emeği bir dokunuş 🤍',
    etiket: ['#nevresim', '#nakışlınevresim', '#çeyiz', '#yatakodası'],
  },
  onluk: {
    ad: 'Önlük', cumle: 'önlük', nakis: true, emoji: '🌷',
    kancalar: ['Öğretmen önlüğünü kişiselleştirdim 🌷', 'Önlüğünüz artık size özel 😍', 'İsme özel nakışlı önlük hazır ✨'],
    ozellikler: ['İsim ya da yazı işlenir', 'Öğretmenlere ve mutfak için ideal'],
    aciklama: 'Önlüğünüzü kişiye özel nakışla eğlenceli hale getiriyorum 🌷 Öğretmen önlüğü, mutfak önlüğü… İsim, figür ya da sevdiğiniz bir motifle size özel 😍',
    etiket: ['#öğretmenönlüğü', '#nakışlıönlük', '#okulöncesi', '#önlük'],
  },
  anahtarlik: {
    ad: 'Anahtarlık / Çanta Charmı', cumle: 'anahtarlık', nakis: true, emoji: '🔑',
    kancalar: ['Çanta charmı ya da anahtarlık, nasıl kullanmak istediğin sana bağlı ❤️', 'Baş harflerinizle anahtarlık hazırladım 🔑', 'Anahtarlık olarak çıktı, çanta charmı oldu 😍'],
    ozellikler: ['Baş harf ya da isim işlenir', 'Anahtarlık, çanta ya da araba süsü'],
    aciklama: 'Kişiye özel nakışlı anahtarlık ve çanta charmı 🔑 Baş harfler, isim ya da sevdiğiniz bir figürle… İster anahtarınıza, ister çantanıza, ister arabanıza asın ❤️ Toplu siparişler de alınır.',
    etiket: ['#anahtarlık', '#çantacharmı', '#isimlianahtarlık', '#toplusipariş'],
  },
  toka: {
    ad: 'Fiyonklu Toka', cumle: 'toka', nakis: true, emoji: '🎀',
    kancalar: ['Nakışlı fiyonklu toka satışta 🎀', 'Fiyonkla taçlandıralım dedim 😍', 'Saçlarınıza el emeği bir dokunuş ✨'],
    ozellikler: ['Nakış işlemeli fiyonk', 'İsteğe göre renk ve desen'],
    aciklama: 'Nakış ile işlenmiş fiyonklu toka 🎀 Müşteri isteğine göre renk ve desen seçeneğiyle hazırlanır. Güzel günlerde kullanılsın ❤️',
    etiket: ['#fiyonktoka', '#nakışlıtoka', '#saçaksesuarı', '#toka'],
  },
  kahve: {
    ad: 'Kahve Sunumu', cumle: 'kahve sunumu', nakis: true, emoji: '☕',
    kancalar: ['Kahve sunumu hazır ☕🌸', 'Kız isteme için en şık sunum 💍', 'Misafirlerinize özel kahve sunumu 🍃'],
    ozellikler: ['İsme / tarihe özel nakış', 'Kız isteme ve söz için ideal'],
    aciklama: 'Kişiye özel nakışlı kahve sunumu ☕🌸 Kız isteme, söz ve nişan gibi özel günleriniz için isim ve tarihle hazırlanır. Güzel günlerde kullanılsın ❤️',
    etiket: ['#kahvesunumu', '#kızisteme', '#söznişan', '#damatkahvesi'],
  },
  kasnak: {
    ad: 'Kasnak Pano', cumle: 'kasnak pano', nakis: true, emoji: '🖼️',
    kancalar: ['İlmek ilmek işlenen kasnak pano 🪡', 'Duvarınıza el emeği bir tablo ✨', 'Bu pano tamamen elde işlendi 🤍'],
    ozellikler: ['El işi nakış', 'Duvar süsü ve hediye için ideal'],
    aciklama: 'Kasnak üzerine el emeği nakış pano 🪡 İsim, tarih ya da sevdiğiniz bir desenle evinize ya da sevdiklerinize anlamlı bir hediye 🤍',
    etiket: ['#kasnakpano', '#elnakışı', '#embroideryhoop', '#duvarsüsü'],
  },
  seccade: {
    ad: 'Seccade', cumle: 'seccade', nakis: true, emoji: '🤲',
    kancalar: ['İsme özel nakışlı seccade 🤲', 'Seccade siparişleri hazırlanmaya devam ediyor ❤️', 'Dualarınıza eşlik edecek özel seccade 🤍'],
    ozellikler: ['İsim nakışı', 'Hac, umre ve özel gün hediyesi'],
    aciklama: 'Seccade üzerine kişiye özel isim nakışı 🪡 Sevdiklerinize ömür boyu kullanacakları, anlamlı bir hediye 🤍',
    etiket: ['#isimliseccade', '#seccade', '#hediyelikseccade'],
  },
  sapka: {
    ad: 'Şapka', cumle: 'şapka', nakis: true, emoji: '🧢',
    kancalar: ['Şapkana kişiye özel nakış 🧢', 'Tarzını şapkana işle ✨', 'İsim, logo, yazı… ne istersen 🪡'],
    ozellikler: ['İsim, logo ya da yazı işlenir', 'Yıkamaya dayanıklı nakış'],
    aciklama: 'Şapka üzerine kişiye özel nakış çalışması 🪡 İsim, logo ya da kısa bir yazıyla tarzınızı yansıtın 🧢',
    etiket: ['#nakışlışapka', '#kişiyeözelşapka'],
  },
  hastane: {
    ad: 'Hastane Çıkışı Seti', baslik: 'İsme Özel Nakışlı Hastane Çıkışı', cumle: 'hastane çıkışı seti', nakis: true, emoji: '👶',
    kancalar: ['Minik bebeğimiz için isimli hastane çıkışı hazır 👶', 'Hoş geldin bebek! 🍼 İsme özel hastane çıkışı', 'Hayatının ilk kıyafeti ona özel olsun 🤍'],
    ozellikler: ['Bebeğin ismi nakışla işlenir', 'Yıkamada solmaz, çıkmaz'],
    aciklama: 'İsme özel nakışlı hastane çıkışı seti 👶 Bebeğinizin ismi ilmek ilmek işlenir; baskı değil nakış olduğu için yıkamada solmaz. Doğum hediyesi için de harika bir seçenek 🤍',
    etiket: ['#hastaneçıkışı', '#isimlihastaneçıkışı', '#bebekhediyesi', '#yenidoğan', '#hoşgeldinbebek'],
    siparis: 'bebeğin ismi, renk tercihi (pembe / mavi / krem) ve doğum tarihi',
  },
  battaniye: {
    ad: 'Battaniye', cumle: 'battaniye', nakis: true, emoji: '🧸',
    kancalar: ['İsme özel nakışlı battaniye hazır 🧸', 'Sıcacık ve tamamen size özel 🤍', 'En tatlı hediye: isimli battaniye 🎁'],
    ozellikler: ['İsim / tarih nakışı', 'Bebek ve çocuk hediyesi için ideal'],
    aciklama: 'Battaniye üzerine kişiye özel nakış çalışması 🧸 Bebeğinize, çocuğunuza ya da sevdiklerinize isim ve sevimli motiflerle sıcacık bir hediye 🤍',
    etiket: ['#isimlibattaniye', '#bebekbattaniyesi', '#nakışlıbattaniye', '#bebekhediyesi'],
  },
  bohca: {
    ad: 'Çeyiz Bohçası', cumle: 'çeyiz bohçası', nakis: true, emoji: '🎀',
    kancalar: ['Çeyiz bohçası hazırlandı 🎀', 'Gelin hanıma özel nakışlı bohça ✨', 'Çeyiziniz el emeğiyle daha da güzel 🤍'],
    ozellikler: ['Gelin ve damat isimleri işlenir', 'Çeyiz ve düğün bohçası için ideal'],
    aciklama: 'Kişiye özel nakışlı çeyiz bohçası ve hurç 🎀 Gelin ve damadın isimleri, düğün tarihiyle birlikte zarif motiflerle işlenir. Çeyizinize el emeği bir dokunuş 🤍',
    etiket: ['#çeyizbohçası', '#bohça', '#hurç', '#çeyiz', '#gelinbohçası'],
    siparis: 'gelin ve damadın isimleri, düğün tarihi ve renk tercihi',
  },
  ibadet: {
    ad: 'Kuran / Tesbih Kesesi', cumle: 'Kuran kesesi', nakis: true, emoji: '📿',
    kancalar: ['İsme özel nakışlı Kuran kesesi 📿', 'Hac, umre ve mevlit için anlamlı hediye 🤲', 'Seccade setinize isimli kese ✨'],
    ozellikler: ['İsim nakışı', 'Hac, umre ve mevlit hediyesi'],
    aciklama: 'Kişiye özel nakışlı Kuran kesesi ve tesbih kesesi 📿 Seccade setleriyle birlikte; hac, umre, mevlit ya da sevdiklerinize anlamlı bir hediye 🤲',
    etiket: ['#kurankesesi', '#tesbihkesesi', '#seccadeseti', '#hacumrehediyesi', '#mevlüthediyesi'],
  },
  kina: {
    ad: 'Kına Aksesuarı', baslik: 'Nakışlı Kına Şalı ve Aksesuarları', cumle: 'kına şalı', nakis: true, emoji: '❤️',
    kancalar: ['Kına gecesine özel nakışlı şal 🔴', 'Gelin hanımın en özel gecesi ✨', 'Kına için isimli eldiven ve şal hazır ❤️'],
    ozellikler: ['İsim / tarih nakışı', 'Kına gecesi için ideal'],
    aciklama: 'Kına gecesine özel nakış işlemeli şal, duvak ve eldiven ❤️ Gelinin ismi ve tarih işlenir; nakış olduğu için yapıştırma süslere göre çok daha dayanıklıdır. Güzel günlerde kullanılsın ✨',
    etiket: ['#kınagecesi', '#kınaşalı', '#kınaaksesuarı', '#gelin', '#kınabohçası'],
    siparis: 'gelinin ismi, kına tarihi ve renk tercihi',
  },
  gelinlik: {
    ad: 'Gelinlik / Abiye', baslik: 'Gelinlik ve Abiye Dikim / Tadilat', cumle: 'gelinlik', nakis: false, emoji: '👰',
    kancalar: ['Gelinliğiniz tam ölçünüze göre 👰', 'Prova günü ✨ son dokunuşlar', 'Abiye ve nişanlık tadilatları özenle yapılır 🪡'],
    ozellikler: ['Daraltma, boy, kol ve askı tadilatı', 'Fermuar değişimi ve detay onarım', 'Özenli işçilik'],
    aciklama: 'Gelinlik, nişanlık, abiye ve kına kıyafetlerinde dikim ve tadilat 👰 Daraltma, boy kısaltma, kol ve askı ayarı, fermuar değişimi… Özel gününüzde kıyafetiniz tam size göre olsun ✨',
    etiket: ['#gelinliktadilatı', '#abiyedikim', '#nişanlık', '#terzi', '#özeldikim'],
    siparis: 'kıyafetin türü, yapılacak işlem ve prova için uygun gün',
  },
  patch: {
    ad: 'Arma / Logo Nakışı', baslik: 'Logo ve Arma Nakışı', cumle: 'logo nakışı', nakis: true, emoji: '🏷️',
    kancalar: ['Logonuz nakışla işlendi 🏷️', 'İş kıyafetlerinize kurumsal dokunuş ✨', 'Takımınıza, okulunuza özel arma 🪡'],
    ozellikler: ['Logo / arma nakışı', 'İş kıyafeti, önlük ve şapkaya uygun', 'Toplu siparişe uygun'],
    aciklama: 'İş yerinize, takımınıza ya da okulunuza özel logo ve arma nakışı 🏷️ Tişört, önlük, şapka ve iş kıyafetlerine işlenir; yıkamaya dayanıklıdır. Toplu siparişler alınır.',
    etiket: ['#logonakışı', '#arma', '#işkıyafeti', '#kurumsalnakış', '#toplusipariş'],
    siparis: 'logo dosyası, ürün türü ve adet',
  },
  koltuk: {
    ad: 'Koltuk Örtüsü', cumle: 'koltuk örtüsü', nakis: true, emoji: '🛋️',
    kancalar: ['Koltuklarınıza el emeği dokunuş 🛋️', 'Salonunuzun havası değişecek ✨', 'Ölçüye özel koltuk örtüsü hazır 🤍'],
    ozellikler: ['Ölçüye göre dikilir', 'Nakış ya da dantel detay eklenebilir'],
    aciklama: 'Ölçüye özel koltuk örtüsü ve şal 🛋️ Dilerseniz nakış ya da dantel detaylarla süslenir; salonunuza zarif, el emeği bir dokunuş 🤍',
    etiket: ['#koltukörtüsü', '#koltukşalı', '#evdekorasyonu', '#çeyiz'],
  },
  makine: {
    ad: 'Nakış Çalışması', baslik: 'Kişiye Özel Nakış Çalışması', cumle: 'nakış çalışması', nakis: true, emoji: '🪡',
    kancalar: ['Nakış makinesinde işleniyor 🪡', 'Siparişiniz ilmek ilmek hazırlanıyor ✨', 'Sizce ne çıkacak? 👀'],
    ozellikler: ['Makine nakışı, temiz işçilik', 'İsim, logo ya da desen işlenir'],
    aciklama: 'Atölyeden bugün: siparişiniz nakış makinesinde ilmek ilmek işleniyor 🪡 İsim, tarih, logo ya da sevdiğiniz bir desen… İstediğiniz ürüne kişiye özel nakış yapılır ✨',
    etiket: ['#nakışmakinesi', '#makinenakışı', '#atölye', '#nakışçalışması'],
  },
  dikis: {
    ad: 'Dikiş / Tadilat', baslik: 'Kişiye Özel Dikim ve Tadilat', cumle: 'dikiş', nakis: false, emoji: '🧵',
    kancalar: ['Atölyeden bugün 🧵', 'Dikiş makinesi durmuyor ✂️', 'Ölçünüze göre dikiyorum 🪡'],
    ozellikler: ['Kişiye özel dikim', 'Tadilat, paça, fermuar değişimi', 'Özenli ve temiz işçilik'],
    aciklama: 'Kişiye özel kıyafet dikimi ve her türlü tadilat 🧵 Paça, daraltma, fermuar değişimi, perde ve nevresim dikimi… Temiz işçilik ve özenle 🪡',
    etiket: ['#dikiş', '#terzi', '#tadilat', '#özeldikim', '#fermuardeğişimi'],
    siparis: 'yapılacak işlem ve ölçüler',
  },
  perde: {
    ad: 'Perde', cumle: 'perde', nakis: true, emoji: '🪟',
    kancalar: ['Perdenize nakışlı bir dokunuş ✨', 'Pencerenize el emeği zarafet 🪟', 'Evinizin havası değişecek 🤍'],
    ozellikler: ['Ölçüye göre hazırlanır', 'El emeği işçilik'],
    aciklama: 'Perde ve tül üzerine nakış işleme 🪡 Evinize ölçüye göre hazırlanan, el emeği zarif bir dokunuş 🤍',
    etiket: ['#perde', '#nakışlıperde', '#evdekorasyonu'],
  },
};

export const MOTIFLER = {
  isim: { ad: 'isim nakışı', sifat: 'İsme Özel Nakışlı', ozellik: 'İsim / tarih tamamen size özel işlenir', cumle: 'İsim ya da tarih tamamen size özel işlenir ✍️' },
  cicek: { ad: 'çiçek nakışı', sifat: 'Çiçek Nakışlı', ozellik: 'Çiçek desenli nakış işleme', cumle: 'Çiçek desenleri tek tek, ilmek ilmek işlendi 🌸' },
  figur: { ad: 'figür nakışı', sifat: 'Figür Nakışlı', ozellik: 'Sevimli figür nakışı', cumle: 'Sevimli figürlerle içinizi ısıtacak bir tasarım 🧸' },
  monogram: { ad: 'harf nakışı', sifat: 'Harf Nakışlı', ozellik: 'Baş harf (monogram) nakışı', cumle: 'Baş harfinizle zarif ve şık bir dokunuş ✨' },
  geleneksel: { ad: 'geleneksel motif', sifat: 'Motif Nakışlı', ozellik: 'Geleneksel motif işleme', cumle: 'Geleneksel motifler modern bir dokunuşla 🧿' },
  kabe: { ad: 'Kabe nakışı', sifat: 'Kabe Nakışlı', ozellik: 'Kabe-i Muazzama nakışı', cumle: 'Kabe nakışlı modelimiz çok sevildi, siparişler hazırlanmaya devam ediyor ❤️' },
  kalp: { ad: 'kalp nakışı', sifat: 'Kalp Nakışlı', ozellik: 'Kalp motifli nakış', cumle: 'Kalp motifiyle sevginizi ilmek ilmek işledik ❤️' },
  logo: { ad: 'logo nakışı', sifat: 'Logo Nakışlı', ozellik: 'Logo / yazı nakışı', cumle: 'Logonuz ya da yazınız birebir işlenir 🏷️' },
  dantel: { ad: 'dantel detay', sifat: 'Dantel Detaylı', ozellik: 'Zarif dantel detaylar', cumle: 'Dantel detaylarıyla zarif bir görünüm 🤍' },
  duz: { ad: '', sifat: 'Kişiye Özel Nakışlı', ozellik: 'Özenle, ilmek ilmek işlendi', cumle: '' },
};

const buyukHarf = s => s.charAt(0).toLocaleUpperCase('tr') + s.slice(1);

/**
 * Analiz sonucuna göre hazır metinler.
 * urunK/motifK: seçilen anahtarlar; renk: 'krem' gibi (boş olabilir)
 */
export function metinOner(urunK, motifK, renk = '') {
  const u = URUNLER[urunK];
  if (!u) return null;
  const m = u.nakis ? (MOTIFLER[motifK] || MOTIFLER.duz) : null;
  const baslik = u.baslik || (m ? `${m.sifat} ${u.ad}` : u.ad);
  const kancalar = [...u.kancalar];
  if (m?.ad) kancalar.splice(1, 0, `${buyukHarf(u.cumle)} üzerine ${m.ad} 🪡`);
  if (renk) kancalar.push(`${buyukHarf(renk)} tonlarında ${u.cumle} ${u.emoji}`);
  kancalar.push('Teslim etmeden önce son hali 😍', 'Siparişiniz hazır! ✨');
  const ozellikler = u.nakis ? [u.ozellikler[0], m.ozellik, u.ozellikler[1]] : u.ozellikler.slice(0, 3);
  // Siparişte müşteriden istenecek bilgi (araştırma: ilanlar kişiselleştirmeyi açıkça yazıyor)
  const siparis = u.siparis || (u.nakis ? 'isim, renk ve tarih' : 'ölçüler ve yapılacak işlem');
  // Instagram açıklamada ilk ~125 karakter görünür: en güçlü cümle başta
  const aciklama = [u.aciklama, m?.cumle].filter(Boolean).join(' ') + `\n\n📝 Sipariş için ${siparis} bilgisini DM'den iletmeniz yeterli.`;
  // Kısa reklam cümleleri (tek dokunuşla kopyalanır)
  const reklam = [
    aciklama,
    u.nakis ? `${buyukHarf(u.cumle)} üzerine kişiye özel nakış desen çalışması. Siparişleriniz için DM 📩` : `El emeği ${u.cumle}. Siparişleriniz için DM 📩`,
    `${baslik} ✨ Tamamen el emeği, tamamen size özel. ${renk ? buyukHarf(renk) + ' ve dilediğiniz renklerde' : 'Dilediğiniz renk ve desende'} hazırlanır 🤍`,
    u.nakis ? 'Sevdiklerinize unutulmayacak bir hediye: isim, tarih ya da motifle kişiye özel nakış 🎁' : 'Ölçünüze ve zevkinize göre, özenle hazırlanır ✂️',
    `Müşteri isteği üzerine hazırladım 😍 ${baslik} ${u.emoji} Güzel günlerde kullanılsın ❤️ Siparişleriniz ve bilgi için DM 📩`,
    u.nakis ? 'Baskı değil, nakış! 🪡 İlmek ilmek işlendiği için yıkamada solmaz, çıkmaz; yıllarca ilk günkü gibi kalır ✨' : 'Temiz işçilik, zamanında teslim ✂️ Atölyemizde her iş tek tek, özenle hazırlanır 🤍',
  ];
  return { baslik, kancalar: [...new Set(kancalar)], ozellikler, aciklama, reklam, etiket: u.etiket };
}
