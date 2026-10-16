// Web Audio API Chime & Speech Synthesis Announcer

const DIGIT_WORDS: Record<string, string> = {
  '0': 'zero',
  '1': 'one',
  '2': 'two',
  '3': 'three',
  '4': 'four',
  '5': 'five',
  '6': 'six',
  '7': 'seven',
  '8': 'eight',
  '9': 'nine',
};

/**
 * Converts numbers/digits into individual spoken words separated by periods (e.g. "104" -> "one. zero. four.")
 * This guarantees the Web Speech API pronounces digits 1 by 1 instead of grouping into thousands or hundreds.
 */
export function formatDigitsForSpeech(text: string): string {
  if (!text) return '';
  // Clean prefixes like '#', 'No.', 'Body', 'Unit'
  const cleaned = text
    .replace(/^#+/, '')
    .replace(/^(body|unit|no|num|ticket)[\s.:#-]*/i, '')
    .trim();

  const words: string[] = [];
  for (const char of cleaned) {
    if (DIGIT_WORDS[char]) {
      words.push(DIGIT_WORDS[char]);
    } else if (/[a-zA-Z]/.test(char)) {
      words.push(char.toUpperCase());
    } else if (char === ' ' || char === '-' || char === '/' || char === '_') {
      // separator pause
    }
  }

  if (words.length === 0) {
    return text;
  }

  // Each digit has its own period so the speech engine pronounces each as an individual distinct token
  return words.map((w) => `${w}.`).join(' ');
}

class SoundManager {

  private audioCtx: AudioContext | null = null;
  private soundEnabled: boolean = true;
  private voiceEnabled: boolean = true;
  private audioUnlocked: boolean = false;

  constructor() {
    // Auto-unlock audio on user's first click, touch, or keydown
    if (typeof window !== 'undefined') {
      const unlock = () => {
        this.unlockAudio();
        window.removeEventListener('click', unlock);
        window.removeEventListener('touchstart', unlock);
        window.removeEventListener('keydown', unlock);
      };
      window.addEventListener('click', unlock, { passive: true });
      window.addEventListener('touchstart', unlock, { passive: true });
      window.addEventListener('keydown', unlock, { passive: true });
    }
  }

  public isAudioUnlocked(): boolean {
    return this.audioUnlocked && (!this.audioCtx || this.audioCtx.state === 'running');
  }

  public unlockAudio() {
    this.initAudio();
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().then(() => {
        this.audioUnlocked = true;
      }).catch(() => {});
    } else if (this.audioCtx && this.audioCtx.state === 'running') {
      this.audioUnlocked = true;
    }

    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      try {
        window.speechSynthesis.resume();
      } catch {}
    }
  }

  private initAudio() {
    if (!this.audioCtx && typeof window !== 'undefined') {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().then(() => {
        this.audioUnlocked = true;
      }).catch(() => {});
    } else if (this.audioCtx && this.audioCtx.state === 'running') {
      this.audioUnlocked = true;
    }
  }

  public setSoundEnabled(_enabled: boolean) {
    // Sound is permanently forced to enabled per municipal directive
    this.soundEnabled = true;
  }

  public setVoiceEnabled(_enabled: boolean) {
    // Voice announcements are permanently forced to enabled per municipal directive
    this.voiceEnabled = true;
  }

  public isSoundEnabled() {
    return this.soundEnabled;
  }

  public isVoiceEnabled() {
    return this.voiceEnabled;
  }

  /**
   * Plays a crisp double-tone chime: First tone then higher resolve tone
   */
  public playChime(): Promise<void> {
    if (!this.soundEnabled) return Promise.resolve();

    return new Promise((resolve) => {
      try {
        this.initAudio();
        if (!this.audioCtx) {
          resolve();
          return;
        }

        const now = this.audioCtx.currentTime;

        // Tone 1: 587.33 Hz (D5)
        const osc1 = this.audioCtx.createOscillator();
        const gain1 = this.audioCtx.createGain();
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(587.33, now);
        gain1.gain.setValueAtTime(0, now);
        gain1.gain.linearRampToValueAtTime(0.35, now + 0.05);
        gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.55);

        osc1.connect(gain1);
        gain1.connect(this.audioCtx.destination);
        osc1.start(now);
        osc1.stop(now + 0.6);

        // Tone 2: 880 Hz (A5) with slight harmonics
        const osc2 = this.audioCtx.createOscillator();
        const gain2 = this.audioCtx.createGain();
        osc2.type = 'sine';
        osc2.frequency.setValueAtTime(880, now + 0.22);
        gain2.gain.setValueAtTime(0, now + 0.22);
        gain2.gain.linearRampToValueAtTime(0.4, now + 0.27);
        gain2.gain.exponentialRampToValueAtTime(0.0008, now + 0.95);

        osc2.connect(gain2);
        gain2.connect(this.audioCtx.destination);
        osc2.start(now + 0.22);
        osc2.stop(now + 1.0);

        setTimeout(() => {
          resolve();
        }, 850);
      } catch (err) {
        console.warn('Audio chime playback notice:', err);
        resolve();
      }
    });
  }

  /**
   * Announces ticket call via Web Speech API
   * Pronounces body number digits 1 by 1 (e.g. 1 2 4 8 -> "one, two, four, eight")
   * strictly preventing text-to-speech from grouping digits into thousands or hundreds.
   */
  public announceTicket(ticketNumber: string, counterName: string, serviceType?: string, bodyNumber?: string) {
    if (!this.voiceEnabled || typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return;
    }

    try {
      window.speechSynthesis.cancel(); // Stop any pending speech
      window.speechSynthesis.resume(); // Resume if paused by browser inactivity

      const cleanBody = bodyNumber && bodyNumber.trim() ? bodyNumber.trim() : '';
      const spokenBody = cleanBody ? formatDigitsForSpeech(cleanBody) : '';
      const spokenTicket = formatDigitsForSpeech(ticketNumber);

      let text = '';
      if (spokenBody) {
        text = `Calling Body Number, ${spokenBody} Please proceed to ${counterName}.`;
      } else {
        text = `Calling Body Number, ${spokenTicket} Please proceed to ${counterName}.`;
      }

      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.84; // Calm, steady pacing so each digit is distinctly articulated 1 by 1
      utterance.pitch = 1.0;
      utterance.volume = 1.0;

      utterance.onend = () => {
        // Clear any stuck state
      };
      utterance.onerror = (e) => {
        console.warn('SpeechSynthesis error:', e);
      };

      const speakWithBestVoice = () => {
        try {
          window.speechSynthesis.resume();
          const voices = window.speechSynthesis.getVoices();
          const preferredVoice =
            voices.find((v) => (v.lang.startsWith('en') || v.lang.includes('US')) && v.name.includes('Natural')) ||
            voices.find((v) => v.lang.startsWith('en') && !v.localService) ||
            voices.find((v) => v.lang.startsWith('en'));

          if (preferredVoice) {
            utterance.voice = preferredVoice;
          }
          window.speechSynthesis.speak(utterance);
        } catch (err) {
          console.warn('Speech speak error:', err);
        }
      };

      if (window.speechSynthesis.getVoices().length === 0) {
        window.speechSynthesis.onvoiceschanged = () => {
          speakWithBestVoice();
          window.speechSynthesis.onvoiceschanged = null;
        };
      } else {
        speakWithBestVoice();
      }
    } catch (e) {
      console.warn('Speech synthesis notice:', e);
    }
  }

  /**
   * Plays an urgent 3-tone acoustic bell chime for mobile devices
   */
  public playUrgentCallingChime(): Promise<void> {
    if (!this.soundEnabled) return Promise.resolve();

    return new Promise((resolve) => {
      try {
        this.unlockAudio();
        if (!this.audioCtx) {
          resolve();
          return;
        }

        const now = this.audioCtx.currentTime;

        // Sequence of 3 ringing acoustic tones: F5 (698.46Hz), A5 (880Hz), C6 (1046.5Hz)
        const notes = [
          { freq: 698.46, time: 0, duration: 0.35, gain: 0.45 },
          { freq: 880.0, time: 0.2, duration: 0.38, gain: 0.5 },
          { freq: 1046.5, time: 0.42, duration: 0.65, gain: 0.55 },
        ];

        notes.forEach(({ freq, time, duration, gain: peakGain }) => {
          if (!this.audioCtx) return;
          const osc = this.audioCtx.createOscillator();
          const gain = this.audioCtx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + time);
          gain.gain.setValueAtTime(0, now + time);
          gain.gain.linearRampToValueAtTime(peakGain, now + time + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.0008, now + time + duration);

          osc.connect(gain);
          gain.connect(this.audioCtx.destination);
          osc.start(now + time);
          osc.stop(now + time + duration + 0.05);
        });

        setTimeout(() => {
          resolve();
        }, 1100);
      } catch (err) {
        console.warn('Urgent chime error:', err);
        resolve();
      }
    });
  }

  /**
   * Combined call: chime first, then voice with 1-by-1 digit calling
   */
  public async playCallingAlert(ticketNumber: string, counterName: string, serviceType?: string, bodyNumber?: string) {
    await this.playChime();
    this.announceTicket(ticketNumber, counterName, serviceType, bodyNumber);
  }

  /**
   * Dedicated Mobile Caller Alert: Urgent repeating chime + voice announcement
   */
  public async playMobileCallingAlert(ticketNumber: string, counterName: string, serviceType?: string, bodyNumber?: string) {
    this.unlockAudio();
    await this.playUrgentCallingChime();
    this.announceTicket(ticketNumber, counterName, serviceType, bodyNumber);
  }

  /**
   * Plays a pleasant success confirmation chime on task completion / transfer
   */
  public playSuccess(): void {
    if (!this.soundEnabled) return;
    try {
      this.initAudio();
      if (!this.audioCtx) return;
      const now = this.audioCtx.currentTime;
      [523.25, 783.99].forEach((freq, idx) => {
        if (!this.audioCtx) return;
        const osc = this.audioCtx.createOscillator();
        const gain = this.audioCtx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + idx * 0.12);
        gain.gain.setValueAtTime(0, now + idx * 0.12);
        gain.gain.linearRampToValueAtTime(0.28, now + idx * 0.12 + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + idx * 0.12 + 0.4);
        osc.connect(gain);
        gain.connect(this.audioCtx.destination);
        osc.start(now + idx * 0.12);
        osc.stop(now + idx * 0.12 + 0.45);
      });
    } catch (err) {
      console.warn('Success sound playback notice:', err);
    }
  }

  /**
   * Plays a distinct redirect chime and vocal redirect announcement for client transfer
   */
  public async playTransferChime(ticketNumber?: string, nextCounterName?: string, prevCounterName?: string): Promise<void> {
    this.unlockAudio();
    this.playSuccess();

    if (this.voiceEnabled && typeof window !== 'undefined' && 'speechSynthesis' in window && ticketNumber && nextCounterName) {
      try {
        const cleanDigits = ticketNumber.replace(/[^0-9]/g, '').split('').join(' ');
        const prefix = ticketNumber.replace(/[0-9]/g, '').replace(/[-_]/g, '');
        const formattedTicket = prefix ? `${prefix} ${cleanDigits}` : ticketNumber;
        
        const text = prevCounterName
          ? `Ticket number ${formattedTicket}, completed at ${prevCounterName}. Please proceed to ${nextCounterName}.`
          : `Ticket number ${formattedTicket}, you have been transferred to ${nextCounterName}. Please proceed to the waiting area.`;
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.rate = 0.92;
        utterance.pitch = 1.05;
        window.speechSynthesis.speak(utterance);
      } catch (e) {
        console.warn('Transfer voice announcement notice:', e);
      }
    }
  }
}

export const soundManager = new SoundManager();
