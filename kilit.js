// Uygulama kilidi (4–6 haneli PIN) ve yedek hatırlatması.
// PIN yalnızca bu cihazda tutulur (SHA-256 özeti); buluta gönderilmez.
const ANAHTAR = 'envai_pin', YEDEK = 'envai_son_yedek';

async function ozet(pin) {
  const veri = new TextEncoder().encode('envai:' + pin);
  const h = await crypto.subtle.digest('SHA-256', veri);
  return [...new Uint8Array(h)].map(b => b.toString(16).padStart(2, '0')).join('');
}
const oku = k => { try { return localStorage.getItem(k); } catch { return null; } };
const yaz = (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { } };

export const pinVar = () => !!oku(ANAHTAR);
export async function pinKoy(pin) { yaz(ANAHTAR, await ozet(pin)); }
export function pinKaldir() { yaz(ANAHTAR, null); }
export async function pinDogru(pin) { return (await ozet(pin)) === oku(ANAHTAR); }

/** PIN varsa kilit ekranını gösterir; doğru girilince çözülür. */
export function kilitEkrani() {
  if (!pinVar()) return Promise.resolve();
  return new Promise(ok => {
    const k = document.createElement('div');
    k.className = 'kilit';
    k.innerHTML = `<div class="kilit-ic"><img src="icons/marka.png" alt=""><h2>Envai Tasarım</h2><p>PIN girin</p>
      <div class="pin-noktalar">${'<i></i>'.repeat(6)}</div>
      <div class="tus-takimi">${[1, 2, 3, 4, 5, 6, 7, 8, 9, '', 0, '⌫'].map(t => t === '' ? '<span></span>' : `<button type="button" data-t="${t}">${t}</button>`).join('')}</div>
      <p class="kilit-hata" hidden>Yanlış PIN</p></div>`;
    document.body.append(k);
    let pin = '', yanlis = 0, bekleSon = 0;
    const noktalar = [...k.querySelectorAll('.pin-noktalar i')];
    const hataEl = k.querySelector('.kilit-hata');
    const ciz = () => noktalar.forEach((n, i) => n.classList.toggle('dolu', i < pin.length));
    const dene = async () => {
      if (pin.length >= 4 && await pinDogru(pin)) { k.classList.add('acildi'); setTimeout(() => k.remove(), 300); ok(); return; }
      if (pin.length === 6) {
        yanlis++;
        // 5 yanlış denemeden sonra artan bekleme (30 sn, 60 sn, …)
        if (yanlis >= 5) bekleSon = Date.now() + 30000 * (yanlis - 4);
        hataEl.textContent = yanlis >= 5 ? `Yanlış PIN · ${Math.round((bekleSon - Date.now()) / 1000)} sn bekleyin` : 'Yanlış PIN';
        hataEl.hidden = false; k.querySelector('.kilit-ic').classList.add('salla'); setTimeout(() => k.querySelector('.kilit-ic').classList.remove('salla'), 400); pin = ''; ciz();
      }
    };
    k.addEventListener('click', e => {
      const b = e.target.closest('[data-t]');
      if (!b) return;
      if (Date.now() < bekleSon) { hataEl.textContent = `${Math.ceil((bekleSon - Date.now()) / 1000)} sn bekleyin`; hataEl.hidden = false; return; }
      hataEl.hidden = true;
      if (b.dataset.t === '⌫') pin = pin.slice(0, -1); else if (pin.length < 6) pin += b.dataset.t;
      ciz(); dene();
    });
    window.addEventListener('keydown', function tus(e) {
      if (!k.isConnected) return window.removeEventListener('keydown', tus);
      if (Date.now() < bekleSon) return;
      if (/^\d$/.test(e.key) && pin.length < 6) pin += e.key; else if (e.key === 'Backspace') pin = pin.slice(0, -1); else return;
      ciz(); dene();
    });
  });
}

/** Uygulama 3 dakikadan uzun arka planda kalırsa dönüşte yeniden PIN sorulur. */
export function arkaPlanKilidi(dk = 3) {
  let gizlendi = 0;
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { gizlendi = Date.now(); return; }
    if (gizlendi && Date.now() - gizlendi > dk * 60000 && pinVar() && !document.querySelector('.kilit')) kilitEkrani();
    gizlendi = 0;
  });
}

// ---- yedek hatırlatması
export const yedekAlindi = () => yaz(YEDEK, String(Date.now()));
/** Son yedekten bu yana geçen gün (hiç alınmadıysa null) */
export function yedekGun() { const t = Number(oku(YEDEK)); return t ? Math.floor((Date.now() - t) / 86400000) : null; }
