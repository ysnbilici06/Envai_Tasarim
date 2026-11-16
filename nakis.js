// Nakış bağlantısı: .pes dosyasından dikiş ve renk sayısını okur (Nakış Çizim'in ve
// Brother/bernette makinelerin kullandığı biçim), nakış maliyetini ve makine süresini hesaplar.

/** PES dosyasını çözümler → { dikis, renk, atlama, genislikMm, yukseklikMm } */
export function pesOku(buf) {
  const v = new DataView(buf);
  const b = new Uint8Array(buf);
  const imza = String.fromCharCode(...b.slice(0, 4));
  if (imza !== '#PES' && imza !== '#PEC') throw new Error('Bu bir PES dosyası değil');
  const pec = imza === '#PEC' ? 0 : v.getUint32(8, true);   // PEC bölümünün başı
  if (pec <= 0 || pec + 532 > b.length) throw new Error('PES dosyası bozuk');
  const renkDegisim = b[pec + 48];
  let i = pec + 528;                                        // dikiş verisi başlangıcı
  let dikis = 0, atlama = 0, renk = renkDegisim + 1, x = 0, y = 0;
  let minX = 0, maxX = 0, minY = 0, maxY = 0;
  const oku = () => (i < b.length ? b[i++] : null);
  while (i < b.length) {
    const v1 = oku(); let v2 = oku();
    if (v1 == null || v2 == null) break;
    if (v1 === 0xff && v2 === 0x00) break;                  // bitiş
    if (v1 === 0xfe && v2 === 0xb0) { oku(); continue; }    // renk değişimi
    let dx, dy, zipla = false;
    if (v1 & 0x80) {
      if (v1 & 0x30) zipla = true;
      dx = ((v1 & 0x0f) << 8) + v2; if (dx & 0x800) dx -= 0x1000;
      v2 = oku(); if (v2 == null) break;
    } else { dx = v1 > 0x3f ? v1 - 0x80 : v1; }
    if (v2 & 0x80) {
      if (v2 & 0x30) zipla = true;
      const v3 = oku(); if (v3 == null) break;
      dy = ((v2 & 0x0f) << 8) + v3; if (dy & 0x800) dy -= 0x1000;
    } else { dy = v2 > 0x3f ? v2 - 0x80 : v2; }
    x += dx; y += dy;
    minX = Math.min(minX, x); maxX = Math.max(maxX, x); minY = Math.min(minY, y); maxY = Math.max(maxY, y);
    if (zipla) atlama++; else dikis++;
  }
  return { dikis, renk, atlama, genislikMm: Math.round((maxX - minX) / 10), yukseklikMm: Math.round((maxY - minY) / 10) };
}

/** Nakış maliyeti ve süresi. ayar.dikisFiyati: 1000 dikiş başına ₺ (iplik + tela + makine aşınması),
 *  ayar.makineHizi: dakikada dikiş. Renk değişimi başına ~1 dk iplik değiştirme payı. */
export function nakisHesap(n, ayar) {
  if (!n?.dikis) return { maliyet: 0, dakika: 0 };
  const maliyet = n.dikis / 1000 * (ayar.dikisFiyati || 0);
  const dakika = n.dikis / Math.max(50, ayar.makineHizi || 600) + Math.max(0, (n.renk || 1) - 1) * 1;
  return { maliyet, dakika };
}
