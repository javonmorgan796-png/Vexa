let audioContext: AudioContext | null = null;

function soundEnabled() {
  return localStorage.getItem('vexa.notificationSound') !== 'false';
}

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContextClass = window.AudioContext
    ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  audioContext ??= new AudioContextClass();
  return audioContext;
}

export function unlockNotificationSound() {
  const context = getAudioContext();
  if (context?.state === 'suspended') void context.resume();
}

export function playNotificationSound() {
  if (!soundEnabled()) return;
  const context = getAudioContext();
  if (!context) return;

  const play = () => {
    const now = context.currentTime;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.075, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    gain.connect(context.destination);

    const oscillator = context.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(740, now);
    oscillator.frequency.setValueAtTime(988, now + 0.13);
    oscillator.connect(gain);
    oscillator.start(now);
    oscillator.stop(now + 0.32);
  };

  if (context.state === 'suspended') {
    void context.resume().then(play).catch(() => undefined);
  } else {
    play();
  }
}