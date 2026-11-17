// Büyük dosyalar (ürün fotoğrafları, müşterinin örnek görselleri, .pes nakış dosyaları)
// localStorage'a sığmaz; cihazın IndexedDB deposunda tutulur. Bulutla eşitlenmez.
// Kayıt: { id, sahip: 'satis:<id>' | 'is:<id>', tur: 'urun' | 'ornek' | 'pes' | 'uretilen' | 'video', ad, blob, eklendi, fav? }

const DB_AD = 'envai_dosyalar', DEPO = 'dosyalar';
let dbSoz = null;

function db() {
  return dbSoz ||= new Promise((ok, hata) => {
    const r = indexedDB.open(DB_AD, 1);
    r.onupgradeneeded = () => {
      const d = r.result.createObjectStore(DEPO, { keyPath: 'id' });
      d.createIndex('sahip', 'sahip');
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => hata(r.error);
  });
}
const istek = r => new Promise((ok, hata) => { r.onsuccess = () => ok(r.result); r.onerror = () => hata(r.error); });
async function depo(mod) { return (await db()).transaction(DEPO, mod).objectStore(DEPO); }

const yeniId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export async function ekle(sahip, tur, blob, ad = '') {
  const kayit = { id: yeniId(), sahip, tur, ad, blob, eklendi: Date.now() };
  await istek((await depo('readwrite')).put(kayit));
  return kayit;
}
/** Sahibin dosyaları (eklenme sırasıyla); tur verilirse süzülür. */
export async function liste(sahip, tur) {
  const hepsi = await istek((await depo('readonly')).index('sahip').getAll(sahip));
  return hepsi.filter(x => !tur || x.tur === tur).sort((a, b) => a.eklendi - b.eklendi);
}
export async function sil(id) { await istek((await depo('readwrite')).delete(id)); }
/** AI üretimini favorile / favoriden çıkar (Ürün Galerisi yalnızca favorileri öne çıkarır). Yeni durumu döner. */
export async function favoriYap(id, fav) {
  const d = await depo('readwrite');
  // get → put aynı olay içinde (eski WebKit'te await arası işlem kapanabiliyor)
  return new Promise((ok, hata) => {
    const r = d.get(id);
    r.onerror = () => hata(r.error);
    r.onsuccess = () => {
      const x = r.result;
      if (!x) return ok(false);
      x.fav = fav ?? !x.fav;
      const p = d.put(x);
      p.onsuccess = () => ok(x.fav); p.onerror = () => hata(p.error);
    };
  });
}
export async function sayilar(tur) {
  const say = {};
  for (const x of await istek((await depo('readonly')).getAll())) if (!tur || x.tur === tur) say[x.sahip] = (say[x.sahip] || 0) + 1;
  return say;
}
/** Tüm fotoğraflar (galeri için) */
export async function tumu(tur) {
  return (await istek((await depo('readonly')).getAll())).filter(x => !tur || x.tur === tur).sort((a, b) => b.eklendi - a.eklendi);
}

/** Kamera/galeriden gelen fotoğrafı makul boyuta küçültür (en uzun kenar 1600 px, JPEG). */
export async function fotoHazirla(dosya, enUzun = 1600) {
  const bmp = await createImageBitmap(dosya);
  const o = Math.min(1, enUzun / Math.max(bmp.width, bmp.height));
  const c = document.createElement('canvas');
  c.width = Math.round(bmp.width * o); c.height = Math.round(bmp.height * o);
  c.getContext('2d').drawImage(bmp, 0, 0, c.width, c.height);
  bmp.close?.();
  return await new Promise(ok => c.toBlob(ok, 'image/jpeg', 0.86));
}
