// Genel giderler: belirli bir işe bağlı olmayan masraflar (reklam, kargo kutusu, makine bakımı…).
// Raporlarda "net kâr" bu giderler düşülerek hesaplanır.
import * as S from './store.js';
import { para, oku, yaz, bugun, tarihYaz } from './hesap.js';
import { $, esc, bildirim, sayfaAc, islemler } from './ui.js';

const st = S.st;
export const GIDER_TURLERI = ['Instagram reklamı', 'Kargo / paketleme', 'Makine bakım / parça', 'Elektrik', 'Kira', 'Alet / ekipman', 'Diğer'];

export function donemGiderleri(bas, bit) {
  return Object.values(st.giderler).filter(g => g.tarih >= bas && g.tarih <= bit).sort((a, b) => b.tarih.localeCompare(a.tarih));
}
export function giderOzeti(bas, bit) {
  const l = donemGiderleri(bas, bit);
  const turler = {};
  for (const g of l) turler[g.tur || 'Diğer'] = (turler[g.tur || 'Diğer'] || 0) + (g.tutar || 0);
  return { liste: l, toplam: l.reduce((t, g) => t + (g.tutar || 0), 0), turler };
}

/** Dönem giderleri listesi (Raporlar'dan açılır) */
export function giderlerSayfasi(bas, bit, baslik) {
  const d = sayfaAc({ baslik: 'Genel giderler', vazgec: 'Kapat', govde: '<div id="gider-icerik"></div>' });
  const ciz = () => {
    const o = giderOzeti(bas, bit);
    $('#gider-icerik', d).innerHTML = `
      <p class="ipucu" style="margin-top:0">${esc(baslik)} · İşlere bağlı olmayan masraflar. Raporda net kârdan düşülür.</p>
      <button class="btn ana tam" data-k="yeni" style="margin:8px 0 14px">+ Gider ekle</button>
      ${o.liste.length ? `<div class="kart liste">${o.liste.map(g => `
        <div class="satir" style="cursor:default"><div class="orta"><div class="ad">${esc(g.ad || g.tur)}</div>
          <div class="ek">${esc(tarihYaz(g.tarih))} · ${esc(g.tur || 'Diğer')}</div></div>
          <div class="sag"><div class="b">${para(g.tutar)}</div></div>${islemler('gider', g.id)}</div>`).join('')}
        <div class="satir" style="cursor:default"><div class="orta"><div class="ad">Toplam</div></div><div class="sag"><div class="b">${para(o.toplam)}</div></div></div></div>`
      : '<div class="kart bos"><p>Bu dönemde genel gider yok.</p></div>'}`;
  };
  ciz();
  const dinle = () => d.isConnected && ciz();
  const birak = S.dinle(dinle);
  d.addEventListener('close', birak, { once: true });
  d.addEventListener('click', e => {
    const t = e.target.closest('[data-k=yeni],[data-act=gider],[data-act=gider-sil]');
    if (!t) return;
    e.stopPropagation();
    if (t.dataset.k === 'yeni') giderDuzenle(null);
    else if (t.dataset.act === 'gider') giderDuzenle(t.dataset.id);
    else giderSil(t.dataset.id);
  });
}

export function giderDuzenle(id) {
  const eski = id ? st.giderler[id] : null;
  const g = structuredClone(eski || { tarih: bugun(), tur: GIDER_TURLERI[0], ad: '', tutar: 0, not: '' });
  const d = sayfaAc({
    baslik: eski ? 'Gideri düzenle' : 'Yeni gider',
    govde: `<div class="form">
      <label class="alan">Tür<select name="tur">${GIDER_TURLERI.map(t => `<option ${t === g.tur ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <label class="alan">Açıklama<input name="ad" value="${esc(g.ad)}" placeholder="Örn. Kasım reklamı"></label>
      <div class="ikili">
        <label class="alan">Tutar<div class="birimli"><input name="tutar" inputmode="decimal" value="${yaz(g.tutar)}" placeholder="0"><span class="b">₺</span></div></label>
        <label class="alan">Tarih<input name="tarih" type="date" value="${esc(g.tarih)}"></label>
      </div>
      <label class="alan">Not<textarea name="not">${esc(g.not)}</textarea></label></div>`,
    kaydet: () => {
      if (!(g.tutar > 0)) { bildirim('Tutarı yazın'); return false; }
      S.kaydet('giderler', g); bildirim('Gider kaydedildi');
    },
  });
  d.addEventListener('input', e => { const t = e.target; if (t.name) g[t.name] = t.name === 'tutar' ? oku(t.value) : t.value; });
  setTimeout(() => $('[name=tutar]', d)?.focus(), 50);
}
export function giderSil(id) {
  const g = st.giderler[id];
  if (!g || !confirm(`"${g.ad || g.tur}" gideri silinsin mi?`)) return;
  S.sil('giderler', id);
  bildirim('Silindi', () => { S.kaydet('giderler', g); bildirim('Geri alındı'); });
}
