// Denemek için örnek veriler. Kimlikleri "ornek_" ile başlar; Ayarlar'dan tek tuşla kaldırılabilir.
// Fiyatlar yalnızca örnektir.
import { urunHesap } from './hesap.js';

export function ornekVeri() {
  const m = (id, ad, kategori, birim, paketFiyat, paketMiktar, tedarikci = 'Toptancı') =>
    ({ id: 'ornek_' + id, ad, kategori, birim, paketFiyat, paketMiktar, tedarikci, not: '', guncel: Date.now() });
  const malzemeler = [
    m('ip', 'Kağıt ip – bej', 'İp / İplik', 'bobin', 180, 1),
    m('sap', 'Deri çanta sapı', 'Sap', 'çift', 85, 1),
    m('astar', 'Astar kumaşı', 'Kumaş / Astar', 'metre', 600, 50),
    m('fermuar', 'Fermuar 20 cm', 'Fermuar / Çıtçıt', 'adet', 150, 10),
    m('citcit', 'Mıknatıslı çıtçıt', 'Fermuar / Çıtçıt', 'adet', 70, 10),
    m('boncuk', 'Ahşap boncuk', 'Süsleme', 'adet', 60, 100),
    m('etiket', 'Marka etiketi', 'Etiket / Ambalaj', 'adet', 150, 100),
    m('nakisip', 'Nakış ipliği (polyester)', 'İp / İplik', 'makara', 45, 1),
    m('telalar', 'Nakış telası', 'Kumaş / Astar', 'metre', 400, 25),
    m('pacaip', 'Dikiş ipliği', 'İp / İplik', 'makara', 25, 1),
  ];
  const k = (id, miktar) => ({ malzemeId: 'ornek_' + id, miktar });
  const urunler = [
    { id: 'ornek_canta', ad: 'Kağıt ip omuz çantası', kategori: 'Çanta', foto: '',
      kalemler: [k('ip', 1.5), k('sap', 1), k('astar', 0.5), k('fermuar', 1), k('citcit', 1), k('boncuk', 20), k('etiket', 1)],
      ekGiderler: [{ ad: 'Ambalaj', tutar: 25 }], fire: 5, iscilikSaat: 5, satisFiyati: 850, not: '' },
    { id: 'ornek_havlu', ad: 'İsim nakışlı bebek havlusu', kategori: 'Kişiye Özel Nakış Tasarımları', foto: '',
      kalemler: [k('nakisip', 0.2), k('telalar', 0.3)],
      ekGiderler: [{ ad: 'Havlu', tutar: 120 }, { ad: 'Kurdele + kutu', tutar: 30 }], fire: 0, iscilikSaat: 1, satisFiyati: 350, not: '' },
    { id: 'ornek_paca', ad: 'Pantolon paça kısaltma', kategori: 'Paça', foto: '',
      kalemler: [k('pacaip', 0.05)], ekGiderler: [], fire: 0, iscilikSaat: 0.5, satisFiyati: 150, not: '' },
  ].map(u => ({ ...u, guncel: Date.now() }));

  const st = { ayar: { saatUcreti: 0 }, malzemeler: Object.fromEntries(malzemeler.map(x => [x.id, x])) };
  const d = new Date();
  const gun = g => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(Math.max(1, Math.min(g, d.getDate()))).padStart(2, '0')}`;
  // Zaman çizelgesi: sipariş tarihinden itibaren saat kaydırmalı aşamalar
  const zt = (tarih, saat) => { const x = new Date(`${tarih}T10:00`); x.setHours(x.getHours() + saat);
    const p = n => String(n).padStart(2, '0');
    return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}T${p(x.getHours())}:${p(x.getMinutes())}`; };
  const satis = (id, uid, adet, tarih, musteri, durum = 'teslim', emekCarpan = 1) => {
    const u = urunler.find(x => x.id === uid);
    const sira = ['siparis', 'yapiliyor', 'hazir', 'teslim'].indexOf(durum);
    const zaman = { alindi: zt(tarih, 0) };
    if (sira >= 1) zaman.basladi = zt(tarih, 20);
    if (sira >= 2) zaman.bitti = zt(tarih, 20 + Math.max(2, u.iscilikSaat * adet * 3));
    if (sira >= 3) zaman.teslim = zt(tarih, 50 + u.iscilikSaat * adet * 3);
    return { id: 'ornek_s' + id, urunId: uid, urunAd: u.ad, kategori: u.kategori, adet, birimFiyat: u.satisFiyati,
      maliyet: Math.round(urunHesap(u, st).gider * 100) / 100, iscilik: 0, tarih, saat: '10:00', musteri, durum, not: '',
      zaman, ...(sira >= 2 ? { calismaSaat: Math.round(u.iscilikSaat * adet * emekCarpan * 10) / 10 } : {}), guncel: Date.now() };
  };
  const satislar = [
    satis(1, 'ornek_canta', 1, gun(2), '@ayse.k', 'teslim', 1.3),
    satis(2, 'ornek_paca', 3, gun(4), 'Komşu Fatma Hn.'),
    satis(3, 'ornek_havlu', 2, gun(6), '@zeynep_bebek'),
    satis(4, 'ornek_canta', 1, gun(d.getDate()), '@elif.tasarim', 'siparis'),
    satis(5, 'ornek_havlu', 1, gun(d.getDate() - 1), '@merve.anne', 'yapiliyor'),
  ];
  const obj = a => Object.fromEntries(a.map(x => [x.id, x]));
  return { malzemeler: obj(malzemeler), urunler: obj(urunler), satislar: obj(satislar) };
}
