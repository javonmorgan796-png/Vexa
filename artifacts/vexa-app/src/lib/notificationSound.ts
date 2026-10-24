let notificationAudioContext: AudioContext | null = null;

function soundEnabled() {
  return localStorage.getItem('vexa.notificationSound') !== 'false';
}

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContextConstructor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return null;
  notificationAudioContext ??= new AudioContextConstructor();
  return notificationAudioContext;
}

export function unlockNotificationSound() {
  const context = getAudioContext();
  if (context?.state === 'suspended') void context.resume();
}

/** Plays a short, unobtrusive two-note alert when the preference is enabled. */
export function playNotificationSound() {
  if (!soundEnabled()) return;
  const context = getAudioContext();
  if (!context) return;

  const play = () => {
    const now = context.currentTime;
    const oscillator = context.createOscillator();
    const gain = context.createGain();

    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(740, now);
    oscillator.frequency.setValueAtTime(988, now + 0.09);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.075, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.25);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.25);
  };

  if (context.state === 'suspended') {
    void context.resume().then(play).catch(() => undefined);
  } else {
    play();
  }
}

// Retain the upstream helper name for compatibility with any other callers.
export const playNotificationAlert = playNotificationSound;
