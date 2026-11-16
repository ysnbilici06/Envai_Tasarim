// Veri katmanı: tüm veri bellekte + localStorage'da tutulur.
// Bulut (Firebase) bağlıysa her değişiklik ayrıca buluta yazılır ve
// buluttan gelen değişiklikler (diğer cihaz) buraya işlenir.

const ANAHTAR = 'envai_v1';
export const KOLEKSIYONLAR = ['malzemeler', 'urunler', 'satislar', 'musteriler', 'giderler'];
export const VARSAYILAN_KATEGORILER = ['Çanta', 'Kişiye Özel Nakış Tasarımları', 'Paça', 'Elbise Dikimi'];
export const VARSAYILAN_MALZEME_KATEGORILERI = ['İp / İplik', 'Kumaş / Astar', 'Sap', 'Fermuar / Çıtçıt', 'Süsleme', 'Etiket / Ambalaj'];

const bos = () => ({
  ayar: {
    saatUcreti: 0, hedefKar: 50, instagram: 'envai_tasarim', whatsapp: '', aylikHedef: 0,
    dikisFiyati: 0, makineHizi: 600,
    kategoriler: [...VARSAYILAN_KATEGORILER],
    malzemeKategorileri: [...VARSAYILAN_MALZEME_KATEGORILERI],
  },
  malzemeler: {}, urunler: {}, satislar: {}, musteriler: {}, giderler: {},
});

function yukle() {
  try {
    const s = JSON.parse(localStorage.getItem(ANAHTAR));
    if (s && typeof s === 'object') {
      const b = bos();
      return { ...b, ...s, ayar: { ...b.ayar, ...(s.ayar || {}) } };
    }
  } catch { /* bozuk ya da erişilemiyor */ }
  return bos();
}

export const st = yukle();
const dinleyiciler = new Set();
let bulut = null; // { yaz(kol, obj), sil(kol, id) }

function kaydetYerel() {
  try { localStorage.setItem(ANAHTAR, JSON.stringify(st)); } catch { /* dolu / kapalı */ }
}
/** Değişiklik dinleyicisi ekler; dönen fonksiyon aboneliği kaldırır. */
export function dinle(fn) { dinleyiciler.add(fn); return () => dinleyiciler.delete(fn); }
export function bildir() { dinleyiciler.forEach(f => f()); }
function degisti() { kaydetYerel(); bildir(); }

export const yeniId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

export function kaydet(kol, obj) {
  obj = { ...obj, id: obj.id || yeniId(), guncel: Date.now() };
  st[kol][obj.id] = obj;
  degisti();
  bulut?.yaz(kol, obj);
  return obj;
}
export function sil(kol, id) {
  delete st[kol][id];
  degisti();
  bulut?.sil(kol, id);
}
export function ayarKaydet(degisiklik) {
  Object.assign(st.ayar, degisiklik);
  degisti();
  bulut?.yaz('ayar', { id: 'genel', ...st.ayar });
}

export const doluMu = () => ['malzemeler', 'urunler', 'satislar'].some(k => Object.keys(st[k]).length > 0);

/** Yedekten ya da örnek veriden tümünü değiştir (buluta da yansıt). */
export function tumunuDegistir(yeni) {
  const b = bos();
  for (const k of KOLEKSIYONLAR) {
    const eski = st[k];
    // eski sürüm yedekte olmayan koleksiyon (ör. müşteriler) mevcut haliyle korunur
    st[k] = { ...(k in yeni ? yeni[k] || {} : eski) };
    if (bulut) {
      for (const id of Object.keys(eski)) if (!st[k][id]) bulut.sil(k, id);
      for (const o of Object.values(st[k])) bulut.yaz(k, o);
    }
  }
  st.ayar = { ...b.ayar, ...(yeni.ayar || {}) };
  bulut?.yaz('ayar', { id: 'genel', ...st.ayar });
  degisti();
}
/** Mevcut veriye ekle (örnek veri için). */
export function ekle(yeni) {
  for (const k of KOLEKSIYONLAR) for (const o of Object.values(yeni[k] || {})) {
    st[k][o.id] = o; bulut?.yaz(k, o);
  }
  degisti();
}

// ---- bulut tarafından çağrılır ----
export function bulutBagla(b) { bulut = b; }
export function bulutCoz() { bulut = null; }
export function disaridan(kol, nesneler) { st[kol] = nesneler; degisti(); }
export function disaridanAyar(a) { const { id, ...r } = a; st.ayar = { ...bos().ayar, ...r }; degisti(); }
