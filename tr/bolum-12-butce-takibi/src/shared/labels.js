// labels.js — Uygulamanın dile bağlı her şeyi: metinler, para birimi, CSV
// biçimi ve ilk açılışta oluşturulan kategoriler.
//
// Ana süreç de işleyici de bu dosyayı kullanır. Kitabın İngilizce baskısında
// yalnızca bu dosyanın içeriği farklıdır.

export const APP_NAME = 'Bütçe Takibi';
export const LOCALE = 'tr-TR';
export const CURRENCY = 'TRY';

// Tutar yazarken ondalık ayırıcı: Türkçede virgül (1.250,50).
export const DECIMAL_SEPARATOR = ',';

export const TYPE_LABELS = { income: 'Gelir', expense: 'Gider' };

// İlk açılışta oluşturulan kategoriler.
export const DEFAULT_CATEGORIES = [
  { name: 'Maaş', type: 'income', color: '#2f9e6b' },
  { name: 'Ek gelir', type: 'income', color: '#4cb5a3' },
  { name: 'Kira', type: 'expense', color: '#7c5cd6' },
  { name: 'Market', type: 'expense', color: '#e07a3f' },
  { name: 'Faturalar', type: 'expense', color: '#3b82c4' },
  { name: 'Ulaşım', type: 'expense', color: '#d4a42c' },
  { name: 'Yeme-içme', type: 'expense', color: '#d9534f' },
  { name: 'Sağlık', type: 'expense', color: '#3fa7d6' },
  { name: 'Eğlence', type: 'expense', color: '#c2569b' },
  { name: 'Diğer', type: 'expense', color: '#8a8f98' },
];

// CSV dosyası: Türkçe Excel noktalı virgülle ayrılmış dosyayı doğrudan açar.
export const CSV = {
  separator: ';',
  headers: { date: 'Tarih', type: 'Tür', category: 'Kategori', amount: 'Tutar', note: 'Not' },
};

export const DIALOG_TEXT = {
  exportCsv: 'İşlemleri CSV olarak kaydet',
  importCsv: 'CSV dosyasından işlem al',
  csvFiles: 'CSV dosyaları',
  savePdf: 'Raporu PDF olarak kaydet',
  pdfFiles: 'PDF dosyaları',
  deleteTitle: 'İşlemi sil',
  deleteMessage: 'Bu işlem silinsin mi?',
  deleteButtons: ['Sil', 'Vazgeç'],
  csvFileName: 'butce',
  pdfFileName: 'butce-raporu',
};

export const ERRORS = {
  invalidDate: 'Geçerli bir tarih girin.',
  invalidType: 'İşlem türü gelir ya da gider olmalı.',
  invalidAmount: 'Tutar sıfırdan büyük bir sayı olmalı (en çok iki ondalık).',
  invalidCategory: 'Bu türe uygun bir kategori seçin.',
  noteTooLong: 'Not en çok 200 karakter olabilir.',
  categoryName: 'Kategori adı boş olamaz.',
  categoryExists: 'Bu adda bir kategori zaten var.',
  categoryInUse: 'Bu kategoride işlem var; önce işlemleri başka kategoriye taşıyın.',
  notFound: 'Kayıt bulunamadı.',
  csvEmpty: 'Dosyada işlem bulunamadı.',
  csvHeader: 'İlk satırda Tarih, Tür, Kategori ve Tutar sütunları olmalı.',
  csvLine: (line, message) => `${line}. satır: ${message}`,
};
