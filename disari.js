// Excel'e aktarma: Türkçe Excel'in doğrudan açtığı CSV (noktalı virgül ayraçlı, UTF-8 BOM'lu).
import * as S from './store.js';
import { satisHesap } from './hesap.js';
import { satisAnaliz } from './rapor.js';
import { odemeDurumu } from './siparis.js';

const st = S.st;
const sayiTR = n => (Math.round((Number(n) || 0) * 100) / 100).toString().replace('.', ',');
const hucre = v => {
  let s = typeof v === 'number' ? sayiTR(v) : String(v ?? '');
  if (typeof v !== 'number' && /^[=+\-@\t\r]/.test(s)) s = "'" + s;   // Excel formül olarak çalıştırmasın
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};
function csv(baslik, satirlar, ad) {
  const metin = '﻿' + [baslik, ...satirlar].map(r => r.map(hucre).join(';')).join('\r\n');
  return new File([metin], ad, { type: 'text/csv;charset=utf-8' });
}
const DURUM_AD = { siparis: 'Sipariş alındı', yapiliyor: 'İşleniyor', hazir: 'Bitti', teslim: 'Teslim edildi', iptal: 'İptal' };

export function excelDosyalari(bas, bit, ek = '') {
  const satislar = Object.values(st.satislar).filter(s => s.tarih >= bas && s.tarih <= bit).sort((a, b) => (a.tarih || '').localeCompare(b.tarih || ''));
  const f1 = csv(
    ['Tarih', 'Saat', 'İş', 'Kategori', 'Müşteri', 'Kaynak', 'Durum', 'Adet', 'Birim fiyat', 'Satış tutarı', 'Gider', 'Kâr', 'Emek (saat)', 'Ödenen', 'Kalan', 'Teslim tarihi', 'Not'],
    satislar.map(s => {
      const h = satisHesap(s), a = satisAnaliz(s, st), o = odemeDurumu(s);
      return [s.tarih, s.saat || '', s.urunAd, s.kategori, s.musteri, s.kaynak || '', DURUM_AD[s.durum] || '', s.adet || 0, s.birimFiyat || 0,
        h.ciro, h.gider, h.kazanc, a.saat || 0, o.tahsil, o.kalan, s.teslimTarihi || '', s.not || ''];
    }), `Satislar${ek}.csv`);
  const giderler = Object.values(st.giderler).filter(g => g.tarih >= bas && g.tarih <= bit).sort((a, b) => a.tarih.localeCompare(b.tarih));
  const f2 = csv(['Tarih', 'Tür', 'Açıklama', 'Tutar', 'Not'], giderler.map(g => [g.tarih, g.tur, g.ad, g.tutar, g.not || '']), `Genel-giderler${ek}.csv`);
  const f3 = csv(['Malzeme', 'Kategori', 'Birim', 'Paket fiyatı', 'Paket miktarı', 'Birim fiyat', 'Stok', 'Kritik seviye', 'Toptancı'],
    Object.values(st.malzemeler).map(m => [m.ad, m.kategori, m.birim, m.paketFiyat, m.paketMiktar, m.paketMiktar ? m.paketFiyat / m.paketMiktar : 0, m.stok ?? '', m.kritik ?? '', m.tedarikci || '']),
    'Malzemeler.csv');
  return [f1, f2, f3];
}
