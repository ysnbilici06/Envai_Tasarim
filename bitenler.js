// "Ürün Galerisi": tamamlanan işlerin portfolyo galerisi. Stüdyoda üretilen düzenlenmiş
// ürün görselleri ve tanıtım videoları burada iş iş saklanır, paylaşılır.
import * as S from './store.js';
import * as D from './dosyadepo.js';
import { para, satisHesap, tarihYaz } from './hesap.js';
import { $, $$, esc, bildirim, sayfaAc, dosyaPaylas, dosyaIndir } from './ui.js';
import { tanitimStudyosu } from './studyo.js';

const st = S.st;
let filtre = 'tumu';
const urlOnbellek = new Map();   // dosya id → nesne URL'si (galeride tekrar tekrar kullanılır)
const url = x => { if (!urlOnbellek.has(x.id)) urlOnbellek.set(x.id, URL.createObjectURL(x.blob)); return urlOnbellek.get(x.id); };
const videoMu = x => (x.blob?.type || '').startsWith('video');

/** sahip → { uretilen, video, urun, kapak } */
async function ozetler() {
  const o = {};
  for (const x of await D.tumu()) {
    const k = (o[x.sahip] ||= { uretilen: [], video: [], urun: [], ornek: [] });
    (k[x.tur] ||= []).push(x);
  }
  for (const k of Object.values(o)) {
    for (const l of Object.values(k)) Array.isArray(l) && l.sort((a, b) => a.eklendi - b.eklendi);
    k.kapak = k.uretilen.find(x => /vitrin/.test(x.ad)) || k.uretilen[0] || k.urun.find(x => !videoMu(x)) || null;
  }
  return o;
}

export function bitenlerGorunum() {
  const biten = Object.values(st.satislar).filter(s => s.durum === 'hazir' || s.durum === 'teslim')
    .sort((a, b) => (b.zaman?.bitti || b.tarih || '').localeCompare(a.zaman?.bitti || a.tarih || ''));
  return `
  <div class="baslik"><h1>Ürün Galerisi</h1></div>
  <p class="ipucu" style="margin-top:-8px">Tamamlanan işleriniz ve stüdyoda hazırlanan düzenlenmiş ürün görselleri, tanıtım videoları.</p>
  <div class="cipler">${[['tumu', 'Tümü'], ['gorselli', 'Görselli'], ['gorselsiz', 'Fotoğraf bekleyen']].map(([k, ad]) =>
    `<button class="cip ${filtre === k ? 'aktif' : ''}" data-act="biten-filtre" data-id="${k}">${ad}</button>`).join('')}</div>
  ${biten.length ? `<div class="portfolyo" id="portfolyo">${biten.map(s => `
    <div class="pf-kart" role="button" tabindex="0" data-act="biten" data-id="${s.id}" data-sahip="satis:${s.id}">
      <div class="pf-kapak"><span class="pf-bos">📸<small>Fotoğraf ekle</small></span></div>
      <div class="pf-bilgi"><b>${esc(s.urunAd || 'Özel iş')}</b>
        <small>${esc([s.musteri, tarihYaz((s.zaman?.bitti || s.tarih || '').slice(0, 10))].filter(Boolean).join(' · '))}</small>
        <span class="pf-say" hidden></span></div>
    </div>`).join('')}</div>`
    : `<div class="kart bos"><div class="simge">🏁</div><p>Henüz biten iş yok.<br>Bir siparişi "Bitti" yaptığınızda burada görünür; ürünün fotoğrafını çekip tanıtım görselleri hazırlayabilirsiniz.</p></div>`}`;
}
export const filtreAyarla = f => { filtre = f; };

/** Görünüm çizildikten sonra kapak görsellerini ve sayıları doldurur */
export async function kapaklariDoldur() {
  const kap = $('#portfolyo');
  if (!kap) return;
  const o = await ozetler();
  for (const kart of $$('.pf-kart', kap)) {
    const k = o[kart.dataset.sahip];
    const n = k ? k.uretilen.length + k.video.length + k.urun.length : 0;
    if (filtre === 'gorselli' && !n) { kart.hidden = true; continue; }
    if (filtre === 'gorselsiz' && n) { kart.hidden = true; continue; }
    if (!k) continue;
    if (k.kapak) $('.pf-kapak', kart).innerHTML = `<img src="${url(k.kapak)}" alt="" loading="lazy">`;
    const say = $('.pf-say', kart);
    const p = [k.uretilen.length && `🖼️ ${k.uretilen.length}`, k.video.length && `🎬 ${k.video.length}`, k.urun.length && `📷 ${k.urun.length}`].filter(Boolean);
    if (p.length) { say.textContent = p.join('  '); say.hidden = false; }
  }
}

/** Bir biten işin galerisi */
export async function bitenDetay(id) {
  const s = st.satislar[id];
  if (!s) return;
  const d = sayfaAc({ baslik: s.urunAd || 'Biten iş', vazgec: 'Kapat', govde: '<div id="bd-ic"><p class="soluk">Yükleniyor…</p></div>' });
  const ciz = async () => {
    const k = (await ozetler())['satis:' + id] || { uretilen: [], video: [], urun: [], ornek: [] };
    const izgara = (l, tur) => l.length ? `<div class="galeri-izgara ${tur === 'video' ? 'video' : ''}">${l.map(x => `
      <div class="galeri-k">${videoMu(x) ? `<video src="${url(x)}" muted playsinline loop preload="metadata"></video><span class="vid">▶</span>` : `<img src="${url(x)}" alt="" loading="lazy">`}
        <div class="galeri-islem"><button class="ikon-btn" data-paylas="${x.id}" title="Paylaş">↗</button><button class="ikon-btn" data-indir="${x.id}" title="İndir">⤓</button><button class="ikon-btn sil" data-sil="${x.id}" title="Sil">×</button></div></div>`).join('')}</div>` : '';
    const hepsi = [...k.uretilen, ...k.video, ...k.urun, ...k.ornek];
    $('#bd-ic', d).innerHTML = `
      <div class="bd-ust"><div><div class="soluk">${esc([s.kategori, s.musteri, tarihYaz((s.zaman?.bitti || s.tarih || '').slice(0, 10))].filter(Boolean).join(' · '))}</div>
        <b class="bd-fiyat">${para(satisHesap(s).ciro)}</b></div>
        <div class="btn-satir"><button class="btn ana" data-k="studyo">🎬 Tanıtım stüdyosu</button>${hepsi.length ? '<button class="btn" data-k="hepsi">Hepsini paylaş</button>' : ''}</div></div>
      ${k.uretilen.length ? `<h3>Düzenlenmiş ürün görselleri <small>${k.uretilen.length}</small></h3>${izgara(k.uretilen)}` : ''}
      ${k.video.length ? `<h3>Tanıtım videoları <small>${k.video.length}</small></h3>${izgara(k.video, 'video')}` : ''}
      ${k.urun.length ? `<h3>Çekilen fotoğraf / video <small>${k.urun.length}</small></h3>${izgara(k.urun)}` : ''}
      ${k.ornek.length ? `<h3>Müşterinin örnek görseli</h3>${izgara(k.ornek)}` : ''}
      ${!hepsi.length ? `<div class="kart bos"><div class="simge">📸</div><p>Bu işin henüz fotoğrafı yok.<br>Stüdyoda biten ürünün fotoğrafını ya da videosunu ekleyin; düzenlenmiş görseller ve tanıtım videosu hazırlansın.</p></div>` : ''}`;
    d._hepsi = hepsi;
  };
  await ciz();
  d.addEventListener('click', async e => {
    const t = e.target.closest('[data-paylas],[data-indir],[data-sil],[data-k]');
    if (!t) return;
    const bul = i => d._hepsi.find(x => x.id === i);
    const dosya = x => new File([x.blob], x.ad || ('envai-' + x.id + (videoMu(x) ? '.mp4' : '.jpg')), { type: x.blob.type });
    if (t.dataset.paylas) dosyaPaylas(dosya(bul(t.dataset.paylas)));
    else if (t.dataset.indir) dosyaIndir(dosya(bul(t.dataset.indir)));
    else if (t.dataset.sil) {
      if (confirm('Bu dosya silinsin mi?')) {
        await D.sil(t.dataset.sil);
        const u = urlOnbellek.get(t.dataset.sil); if (u) { URL.revokeObjectURL(u); urlOnbellek.delete(t.dataset.sil); }
        ciz(); bildirim('Silindi');
      }
    }
    else if (t.dataset.k === 'studyo') { const st2 = await tanitimStudyosu(s); st2?.addEventListener('close', () => d.isConnected && ciz()); }
    else if (t.dataset.k === 'hepsi') {
      const l = d._hepsi.filter(x => x.tur !== 'ornek').map(dosya);
      if (navigator.canShare?.({ files: l })) { try { await navigator.share({ files: l }); } catch { } } else l.forEach((f, i) => setTimeout(() => dosyaIndir(f), i * 350));
    }
  });
}
