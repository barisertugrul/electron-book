// timer.js — Pomodoro zamanlayıcısının kalbi.
//
// Bu dosyada Electron yok; düz JavaScript. Bu sayede zamanlayıcıyı
// uygulamayı açmadan, `npm test` ile test edebiliyoruz.
//
// Çalışma düzeni: odak → kısa mola → odak → kısa mola → ... → uzun mola.
// Kaç odak oturumundan sonra uzun mola verileceği ayarlardan gelir.

import { EventEmitter } from 'node:events';

// Aşamaların kod içindeki adları. Ekranda görünen adlar arayüz dosyalarında.
export const PHASES = ['focus', 'shortBreak', 'longBreak'];

const MINUTE = 60 * 1000;

export class FocusTimer extends EventEmitter {
  // now: "şu an kaç milisaniye?" sorusunu cevaplayan fonksiyon.
  // Uygulamada Date.now kullanılır; testlerde saati biz ilerletiriz.
  constructor(settings, { now = Date.now } = {}) {
    super();
    this.now = now;
    this.settings = settings;
    this.phase = 'focus';
    this.completedFocus = 0; // Bu turda biten odak oturumu sayısı
    this.running = false;
    this.endsAt = null; // Çalışırken: aşamanın biteceği an (ms)
    this.remainingMs = this.phaseDuration('focus');
  }

  // Bir aşamanın ayarlardaki süresi (milisaniye).
  phaseDuration(phase) {
    const minutes = {
      focus: this.settings.focusMinutes,
      shortBreak: this.settings.shortBreakMinutes,
      longBreak: this.settings.longBreakMinutes,
    }[phase];
    return minutes * MINUTE;
  }

  // Arayüze ve tepsiye gönderdiğimiz anlık durum. Düz bir nesne olduğu için
  // IPC ile sorunsuz gönderilir.
  getState() {
    return {
      phase: this.phase,
      running: this.running,
      remainingMs: this.getRemainingMs(),
      durationMs: this.phaseDuration(this.phase),
      completedFocus: this.completedFocus,
      sessionsBeforeLongBreak: this.settings.sessionsBeforeLongBreak,
    };
  }

  // Kalan süreyi saymıyoruz, HESAPLIYORUZ: bitiş anından şimdiyi çıkarırız.
  // setInterval tam zamanında çalışmayabilir (bilgisayar uykuya geçebilir,
  // işlemci meşgul olabilir); bu yöntemle süre yine de doğru kalır.
  getRemainingMs() {
    if (!this.running) return this.remainingMs;
    return Math.max(0, this.endsAt - this.now());
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.endsAt = this.now() + this.remainingMs;
    this.emitChange();
  }

  pause() {
    if (!this.running) return;
    this.remainingMs = this.getRemainingMs();
    this.running = false;
    this.endsAt = null;
    this.emitChange();
  }

  toggle() {
    if (this.running) this.pause();
    else this.start();
  }

  // Şu anki aşamayı baştan başlatır (durdurulmuş hâlde).
  reset() {
    this.running = false;
    this.endsAt = null;
    this.remainingMs = this.phaseDuration(this.phase);
    this.emitChange();
  }

  // Aşamayı bitirmeden sonrakine geçer. Atlanan odak oturumu sayılmaz.
  skip() {
    this.moveToNextPhase({ countFocus: false });
  }

  // Ayarlar değişince çağrılır. Çalışmayan bir aşamanın süresi yeni ayara uyar.
  updateSettings(settings) {
    this.settings = settings;
    if (!this.running) this.remainingMs = this.phaseDuration(this.phase);
    this.emitChange();
  }

  // Ana süreç bunu saniyede birkaç kez çağırır.
  tick() {
    if (!this.running) return;
    if (this.getRemainingMs() > 0) {
      this.emit('tick', this.getState());
      return;
    }
    // Süre doldu.
    const finished = this.phase;
    this.moveToNextPhase({ countFocus: true });
    this.emit('phase-end', { finished, next: this.phase });
  }

  // Sıradaki aşamayı belirler. Yeni aşama durdurulmuş başlar; ayarlarda
  // "otomatik başlat" açıksa hemen çalışır.
  moveToNextPhase({ countFocus }) {
    const wasFocus = this.phase === 'focus';
    if (wasFocus && countFocus) this.completedFocus += 1;

    if (wasFocus) {
      const timeForLongBreak = countFocus &&
        this.completedFocus >= this.settings.sessionsBeforeLongBreak;
      this.phase = timeForLongBreak ? 'longBreak' : 'shortBreak';
    } else {
      // Uzun moladan sonra yeni tur başlar.
      if (this.phase === 'longBreak') this.completedFocus = 0;
      this.phase = 'focus';
    }

    this.running = false;
    this.endsAt = null;
    this.remainingMs = this.phaseDuration(this.phase);
    if (this.settings.autoStartNext) this.start();
    else this.emitChange();
  }

  emitChange() {
    this.emit('change', this.getState());
  }
}

// 1500000 ms -> "25:00"
export function formatTime(ms) {
  const totalSeconds = Math.ceil(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}
