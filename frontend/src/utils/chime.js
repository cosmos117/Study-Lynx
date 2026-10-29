// A short two-note chime made with the Web Audio API, so no sound file is needed.
// Browsers only allow audio after a user gesture, so `unlockChime()` is called from the Start click.

let context = null;

export function unlockChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    context ||= new AudioContext();
    if (context.state === 'suspended') context.resume();
  } catch {
    context = null;
  }
}

export function playChime() {
  try {
    unlockChime();
    if (!context) return;
    const start = context.currentTime;
    [[660, 0], [880, 0.22]].forEach(([frequency, offset]) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start + offset);
      gain.gain.exponentialRampToValueAtTime(0.25, start + offset + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + offset + 0.6);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(start + offset);
      oscillator.stop(start + offset + 0.65);
    });
  } catch {
    // Sound is a nicety; the popup still tells the student.
  }
}
