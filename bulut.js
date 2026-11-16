// Firebase ile iPhone ⇄ iPad eşitleme.
// Veriler users/{uid}/{malzemeler|urunler|satislar|ayar} altında tutulur.
import { firebaseConfig } from './firebase-config.js';
import * as S from './store.js';

const SURUM = '10.12.2';
const URL = m => `https://www.gstatic.com/firebasejs/${SURUM}/firebase-${m}.js`;

export const durum = { kurulu: !!firebaseConfig, hazir: false, kullanici: null, hata: '', esitleniyor: false };
let fb = null;
let aboneler = [];

export async function baslat() {
  if (!firebaseConfig) return;
  try {
    const [App, A, F] = await Promise.all([import(URL('app')), import(URL('auth')), import(URL('firestore'))]);
    const app = App.initializeApp(firebaseConfig);
    const auth = A.getAuth(app);
    let db;
    try {
      db = F.initializeFirestore(app, { localCache: F.persistentLocalCache({ tabManager: F.persistentMultipleTabManager() }) });
    } catch { db = F.getFirestore(app); }
    fb = { A, F, auth, db };
    durum.hazir = true;
    A.onAuthStateChanged(auth, k => {
      durum.kullanici = k;
      if (k) bagla(k).catch(e => { durum.hata = 'Eşitleme hatası: ' + (e.code || e.message); S.bildir(); });
      else coz();
      S.bildir();
    });
  } catch (e) {
    durum.hata = 'Buluta bağlanılamadı. İnternet bağlantısını kontrol edin.';
    S.bildir();
  }
}

function coz() {
  aboneler.forEach(f => f());
  aboneler = [];
  S.bulutCoz();
}

const temiz = o => JSON.parse(JSON.stringify(o));

async function bagla(k) {
  coz();
  const { F, db } = fb;
  const yol = (...p) => [db, 'users', k.uid, ...p];
  durum.esitleniyor = true; S.bildir();

  // Bu cihaz bu hesaba ilk kez bağlanıyorsa, cihazdaki verileri buluta aktar.
  const bayrak = 'envai_bagli_' + k.uid;
  let ilk = true;
  try { ilk = !localStorage.getItem(bayrak); } catch { }
  if (ilk) {
    const ayarDoc = await F.getDoc(F.doc(...yol('ayar', 'genel')));
    const toplu = F.writeBatch(db);
    let say = 0;
    for (const kol of S.KOLEKSIYONLAR) {
      const bulutta = await F.getDocs(F.collection(...yol(kol)));
      const varOlan = new Set(bulutta.docs.map(d => d.id));
      for (const o of Object.values(S.st[kol])) {
        if (!varOlan.has(o.id)) { toplu.set(F.doc(...yol(kol, o.id)), temiz(o)); say++; }
      }
    }
    if (!ayarDoc.exists()) { toplu.set(F.doc(...yol('ayar', 'genel')), temiz({ id: 'genel', ...S.st.ayar })); say++; }
    if (say) await toplu.commit();
    try { localStorage.setItem(bayrak, '1'); } catch { }
  }

  S.bulutBagla({
    yaz: (kol, o) => F.setDoc(F.doc(...yol(kol, o.id)), temiz(o)).catch(hataGoster),
    sil: (kol, id) => F.deleteDoc(F.doc(...yol(kol, id))).catch(hataGoster),
  });
  for (const kol of S.KOLEKSIYONLAR) {
    aboneler.push(F.onSnapshot(F.collection(...yol(kol)), snap => {
      const o = {};
      snap.forEach(d => { o[d.id] = d.data(); });
      S.disaridan(kol, o);
    }, hataGoster));
  }
  aboneler.push(F.onSnapshot(F.doc(...yol('ayar', 'genel')), d => { if (d.exists()) S.disaridanAyar(d.data()); }, hataGoster));
  durum.esitleniyor = false; durum.hata = ''; S.bildir();
}

function hataGoster(e) {
  durum.hata = 'Eşitleme hatası: ' + (e.code || e.message);
  S.bildir();
}

const MESAJ = {
  'auth/invalid-credential': 'E-posta ya da şifre hatalı.',
  'auth/wrong-password': 'E-posta ya da şifre hatalı.',
  'auth/user-not-found': 'Bu e-postayla hesap yok. "Hesap oluştur"a basın.',
  'auth/email-already-in-use': 'Bu e-postayla zaten hesap var. "Giriş yap"a basın.',
  'auth/weak-password': 'Şifre en az 6 karakter olmalı.',
  'auth/invalid-email': 'E-posta adresi geçersiz.',
  'auth/missing-password': 'Şifreyi yazın.',
  'auth/network-request-failed': 'İnternet bağlantısı yok.',
  'auth/too-many-requests': 'Çok fazla deneme yapıldı, biraz sonra tekrar deneyin.',
};
const turkce = e => MESAJ[e.code] || ('Hata: ' + (e.code || e.message));

export async function girisYap(eposta, sifre) {
  try { await fb.A.signInWithEmailAndPassword(fb.auth, eposta.trim(), sifre); return null; }
  catch (e) { return turkce(e); }
}
export async function hesapOlustur(eposta, sifre) {
  try { await fb.A.createUserWithEmailAndPassword(fb.auth, eposta.trim(), sifre); return null; }
  catch (e) { return turkce(e); }
}
export async function sifreSifirla(eposta) {
  try { await fb.A.sendPasswordResetEmail(fb.auth, eposta.trim()); return null; }
  catch (e) { return turkce(e); }
}
export async function cikisYap() { await fb.A.signOut(fb.auth); }
