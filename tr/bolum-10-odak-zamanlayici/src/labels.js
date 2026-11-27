// labels.js — Ana sürecin ekrana yazdığı metinler (tepsi menüsü, bildirimler).
// Hepsi tek yerde durursa uygulamayı başka bir dile çevirmek kolaylaşır.

export const APP_NAME = 'Odak Zamanlayıcı';

export const PHASE_LABELS = {
  focus: 'Odak',
  shortBreak: 'Kısa mola',
  longBreak: 'Uzun mola',
};

export const TRAY_TEXT = {
  running: 'çalışıyor',
  paused: 'duraklatıldı',
  start: 'Başlat',
  pause: 'Duraklat',
  reset: 'Sıfırla',
  skip: 'Sonraki aşamaya geç',
  showTimer: 'Zamanlayıcıyı göster',
  summary: 'Günlük özet',
  settings: 'Ayarlar…',
  quit: 'Çıkış',
};

export const WINDOW_TITLES = {
  settings: 'Ayarlar',
  summary: 'Günlük özet',
};

// Bir aşama bitince gösterilecek bildirimin başlığı ve metni.
export function phaseEndMessage(finished, next, minutes, autoStarted) {
  const tail = autoStarted ? '' : ' Başlatmak için tıkla.';
  if (finished === 'focus' && next === 'longBreak') {
    return { title: 'Harika, bir tur tamamlandı!', body: `Uzun mola zamanı: ${minutes} dakika.${tail}` };
  }
  if (finished === 'focus') {
    return { title: 'Odak oturumu bitti', body: `Kısa bir mola ver: ${minutes} dakika.${tail}` };
  }
  return { title: 'Mola bitti', body: `Yeni odak oturumu: ${minutes} dakika.${tail}` };
}
