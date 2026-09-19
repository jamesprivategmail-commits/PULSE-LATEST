// Web Audio API Ringtone & Dial-Tone Synthesizer for Real-Time Calling

class CallSoundManager {
  private ctx: AudioContext | null = null;
  private ringtoneInterval: any = null;
  private isRinging: boolean = false;

  private getContext(): AudioContext {
    if (!this.ctx || this.ctx.state === 'closed') {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtxClass();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  // Play outgoing ringing dial pulse (soft pleasant double pulse)
  public startOutgoingRing() {
    this.stop();
    this.isRinging = true;

    const playPulse = () => {
      if (!this.isRinging) return;
      try {
        const ctx = this.getContext();
        const now = ctx.currentTime;

        // Dual frequency dial tone: 440Hz + 480Hz
        [440, 480].forEach(freq => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);

          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.08, now + 0.05);
          gain.gain.setValueAtTime(0.08, now + 1.2);
          gain.gain.linearRampToValueAtTime(0, now + 1.4);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now);
          osc.stop(now + 1.4);
        });
      } catch (e) {}
    };

    playPulse();
    this.ringtoneInterval = setInterval(playPulse, 3500);
  }

  // Play incoming ringtone (melodic modern crystal chime chord)
  public startIncomingRing() {
    this.stop();
    this.isRinging = true;

    const playChime = () => {
      if (!this.isRinging) return;
      try {
        const ctx = this.getContext();
        const now = ctx.currentTime;

        // Melodic notes sequence: C5 (523.25Hz), E5 (659.25Hz), G5 (783.99Hz), B5 (987.77Hz)
        const notes = [
          { freq: 523.25, time: 0 },
          { freq: 659.25, time: 0.15 },
          { freq: 783.99, time: 0.3 },
          { freq: 1046.50, time: 0.45 },
          { freq: 783.99, time: 0.7 },
          { freq: 1046.50, time: 0.85 }
        ];

        notes.forEach(({ freq, time }) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + time);

          gain.gain.setValueAtTime(0, now + time);
          gain.gain.linearRampToValueAtTime(0.12, now + time + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.001, now + time + 0.5);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + time);
          osc.stop(now + time + 0.5);
        });
      } catch (e) {}
    };

    playChime();
    this.ringtoneInterval = setInterval(playChime, 2500);
  }

  // Play connected sound (rising pleasant chime)
  public playConnectedChime() {
    this.stop();
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      [587.33, 880].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(freq, now + i * 0.12);

        gain.gain.setValueAtTime(0, now + i * 0.12);
        gain.gain.linearRampToValueAtTime(0.15, now + i * 0.12 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.4);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.4);
      });
    } catch (e) {}
  }

  // Play end / decline tone (descending soft tone)
  public playEndTone() {
    this.stop();
    try {
      const ctx = this.getContext();
      const now = ctx.currentTime;
      [659.25, 440].forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, now + i * 0.15);

        gain.gain.setValueAtTime(0, now + i * 0.15);
        gain.gain.linearRampToValueAtTime(0.12, now + i * 0.15 + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + i * 0.15);
        osc.stop(now + i * 0.15 + 0.35);
      });
    } catch (e) {}
  }

  public stop() {
    this.isRinging = false;
    if (this.ringtoneInterval) {
      clearInterval(this.ringtoneInterval);
      this.ringtoneInterval = null;
    }
  }
}

export const callSounds = new CallSoundManager();
