let notificationAudioContext: AudioContext | null = null;

function getAudioContext() {
  if (typeof window === 'undefined') return null;
  const AudioContextConstructor =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return null;
  notificationAudioContext ??= new AudioContextConstructor();
  return notificationAudioContext;
}

/**
 * Plays a short, unobtrusive two-note alert. Browsers may defer playback until
 * the user has interacted with the page; that restriction is intentionally
 * handled by ignoring the rejected resume promise.
 */
export function playNotificationAlert() {
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
    gain.gain.exponentialRampToValueAtTime(1.20, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);

    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(now);
    oscillator.stop(now + 0.25);
  };

  if (context.state === 'suspended') {
    void context.resume().then(play).catch(() => {});
  } else {
    play();
  }
}