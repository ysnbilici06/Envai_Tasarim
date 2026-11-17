// Ortak arayüz yardımcıları: tüm ekran modülleri bunları kullanır.
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const r2 = n => Math.round(n * 100) / 100;
export const trSirala = (a, b) => a.localeCompare(b, 'tr');

/** Kısa uyarı. Açık bir alt sayfa (dialog) varsa onun içinde gösterilir; yoksa
 *  dialog üst katmanda kaldığı için uyarı arkada görünmez kalıyordu.
 *  geriAl verilirse yanında "Geri al" düğmesi çıkar. */
export function bildirim(mesaj, eylem, etiket = 'Geri al') {
  const b = $('#bildirim');
  const ust = [...document.querySelectorAll('dialog[open]')].at(-1);
  (ust || document.body).append(b);
  b.textContent = mesaj;
  if (eylem) {
    const btn = document.createElement('button');
    btn.textContent = etiket;
    btn.onclick = () => { b.hidden = true; eylem(); };
    b.append(btn);
  }
  b.hidden = false;
  clearTimeout(bildirim.t);
  bildirim.t = setTimeout(() => { b.hidden = true; }, eylem ? 7000 : 2400);
}

// ---- Düzenle / sil düğmeleri (listelerdeki her kayıt için)
export const SVG_KALEM = '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16v4z"/><path d="M13.5 6.5l4 4"/></svg>';
export const SVG_COP = '<svg viewBox="0 0 24 24"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';
export function islemler(tur, id, yazili = false) {
  const y = t => yazili ? `<span>${t}</span>` : '';
  return `<span class="islem${yazili ? ' yazili' : ''}">
    <button class="ikon-btn" data-act="${tur}" data-id="${esc(id)}" aria-label="Düzenle" title="Düzenle">${SVG_KALEM}${y('Düzenle')}</button>
    <button class="ikon-btn sil" data-act="${tur}-sil" data-id="${esc(id)}" aria-label="Sil" title="Sil">${SVG_COP}${y('Sil')}</button></span>`;
}
export const SVG_ARTI = '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>';

/** Tam ekran alt sayfa (dialog). kaydet() false dönerse kapanmaz. */
export function sayfaAc({ baslik, govde, kaydet, vazgec = 'Vazgeç' }) {
  const d = document.createElement('dialog');
  d.className = 'sayfa';
  d.innerHTML = `<div class="sayfa-ic">
    <div class="sayfa-ust"><button class="btn metin" data-k="vazgec">${vazgec}</button><h2>${esc(baslik)}</h2>
    ${kaydet ? `<button class="btn ana kucuk" data-k="kaydet">Kaydet</button>` : '<span style="min-width:84px"></span>'}</div>
    <div class="sayfa-govde">${govde}</div></div>`;
  document.body.append(d);
  d.addEventListener('close', () => {
    const b = $('#bildirim', d);
    if (b) document.body.append(b); // uyarı kutusu dialogla birlikte silinmesin
    d.remove();
  });
  d.querySelector('[data-k=vazgec]').addEventListener('click', () => d.close());
  if (kaydet) d.querySelector('[data-k=kaydet]').addEventListener('click', () => { if (kaydet() !== false) d.close(); });
  d.showModal();
  d.querySelector('.sayfa-govde').scrollTop = 0;
  return d;
}

export const kisaBirim = b => ({ metre: 'm', gram: 'g', adet: 'ad.' }[b] || b || '');

/** Dosyayı iPad paylaş menüsüyle paylaşır (Instagram, WhatsApp, Kaydet…); olmazsa indirir. */
export async function dosyaPaylas(dosya, baslik) {
  if (navigator.canShare?.({ files: [dosya] })) {
    try { await navigator.share({ files: [dosya], title: baslik || dosya.name }); return true; }
    catch (e) { if (e.name === 'AbortError') return false; }
  }
  dosyaIndir(dosya); return true;
}
export function dosyaIndir(dosya) {
  const url = URL.createObjectURL(dosya);
  const a = document.createElement('a');
  a.href = url; a.download = dosya.name;
  document.body.append(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
export async function metinKopyala(metin) {
  try { await navigator.clipboard.writeText(metin); return true; }
  catch {
    const t = document.createElement('textarea'); t.value = metin; document.body.append(t); t.select();
    const ok = document.execCommand('copy'); t.remove(); return ok;
  }
}

/**
 * Tam ekran önizleme: ogeler = [{ url, video?: bool, dosya?: File }], i = açılacak sıra.
 * Görseller arasında oklarla ya da kaydırarak geçilir; Paylaş / İndir düğmeleri seçili dosyaya uygulanır.
 */
export function medyaGoster(ogeler, i = 0) {
  const d = document.createElement('dialog');
  d.className = 'medya-bak';
  const coklu = ogeler.length > 1;
  d.innerHTML = `<div class="mb-sahne"></div>
    <button type="button" class="mb-kapat" data-mb="kapat" aria-label="Kapat">×</button>
    ${coklu ? '<button type="button" class="mb-ok sol" data-mb="geri" aria-label="Önceki">‹</button><button type="button" class="mb-ok sag" data-mb="ileri" aria-label="Sonraki">›</button>' : ''}
    <div class="mb-alt"><span class="mb-sira"></span>
      <button type="button" class="btn ana kucuk" data-mb="paylas">Paylaş</button><button type="button" class="btn kucuk" data-mb="indir">İndir</button></div>`;
  const sahne = d.querySelector('.mb-sahne');
  const goster = () => {
    const o = ogeler[i];
    sahne.innerHTML = o.video ? `<video src="${o.url}" controls autoplay playsinline loop></video>` : `<img src="${o.url}" alt="">`;
    d.querySelector('.mb-sira').textContent = coklu ? `${i + 1} / ${ogeler.length}` : '';
    d.querySelectorAll('[data-mb=paylas],[data-mb=indir]').forEach(b => { b.hidden = !o.dosya; });
  };
  const git = n => { i = (i + n + ogeler.length) % ogeler.length; goster(); };
  d.addEventListener('click', async e => {
    const t = e.target.closest('[data-mb]');
    if (!t) { if (e.target === d || e.target === sahne) d.close(); return; }
    const o = ogeler[i];
    if (t.dataset.mb === 'kapat') d.close();
    else if (t.dataset.mb === 'geri') git(-1);
    else if (t.dataset.mb === 'ileri') git(1);
    else if (t.dataset.mb === 'paylas') await dosyaPaylas(o.dosya);
    else if (t.dataset.mb === 'indir') dosyaIndir(o.dosya);
  });
  let x0 = null;
  sahne.addEventListener('touchstart', e => { x0 = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
  sahne.addEventListener('touchend', e => {
    if (x0 == null || !coklu || ogeler[i].video) return;
    const dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) git(dx < 0 ? 1 : -1);
  });
  d.addEventListener('keydown', e => { if (coklu && e.key === 'ArrowRight') git(1); if (coklu && e.key === 'ArrowLeft') git(-1); });
  d.addEventListener('close', () => { sahne.querySelector('video')?.pause(); d.remove(); });
  document.body.append(d);
  goster();
  d.showModal();
  return d;
}
