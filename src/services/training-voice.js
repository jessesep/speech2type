/**
 * Training Voice/Audio Feedback Service (Phase 2.4)
 *
 * Provides voice prompts and sound effects for training mode with:
 * - Sound palette (8 distinct sounds)
 * - Natural voice prompts
 * - 150ms pause before speaking (feels natural)
 * - Interruption handling
 */

import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Sound palette using macOS system sounds
 * Each sound has a specific meaning in training mode
 */
const SOUNDS = {
  ENTER_TRAINING: '/System/Library/Sounds/Glass.aiff',        // Ascending chime
  UNDERSTOOD: '/System/Library/Sounds/Tink.aiff',             // Soft click
  NEED_CLARIFICATION: '/System/Library/Sounds/Pop.aiff',      // Question tone
  ADDED_VARIATION: '/System/Library/Sounds/Pop.aiff',         // Double click (will play twice)
  CONFIRMING: '/System/Library/Sounds/Submarine.aiff',        // Waiting tone
  SAVED: '/System/Library/Sounds/Glass.aiff',                 // Success chime
  CANCELLED: '/System/Library/Sounds/Sosumi.aiff',            // Descending tone
  ERROR: '/System/Library/Sounds/Basso.aiff',                 // Low buzz
  EXIT_TRAINING: '/System/Library/Sounds/Blow.aiff'           // Soft chime
};

/**
 * Pre-speak delay in milliseconds
 * Pause before voice prompts feels more natural
 */
const PRE_SPEAK_DELAY = 150;

/**
 * TTS lock file - prevents transcript pickup during speech
 */
const TTS_LOCK_FILE = '/tmp/claude-tts-speaking';

/**
 * Max speech duration (10 seconds) - prevents zombie processes
 */
const MAX_SPEECH_MS = 10000;

/**
 * Training voice service
 */
export class TrainingVoice {
  constructor() {
    this.speaking = false;
    this.interrupted = false;
    this.speechQueue = Promise.resolve(); // Ensures only one TTS at a time
  }

  /**
   * Play a training sound effect
   * @param {string} soundKey - Key from SOUNDS enum
   * @param {number} count - Number of times to play (for double-click effect)
   */
  async playSound(soundKey, count = 1) {
    const soundPath = SOUNDS[soundKey];
    if (!soundPath) {
      console.error(`[training-voice] Unknown sound: ${soundKey}`);
      return;
    }

    try {
      for (let i = 0; i < count; i++) {
        await execAsync(`afplay "${soundPath}"`);
        if (count > 1 && i < count - 1) {
          // Small delay between repeats
          await this.delay(100);
        }
      }
    } catch (e) {
      console.error(`[training-voice] Failed to play sound:`, e.message);
    }
  }

  /**
   * Speak text with natural delay and TTS lock
   * Queued to ensure only one TTS runs at a time
   * @param {string} text - Text to speak
   * @param {object} options - Options
   * @param {string} options.voice - Voice to use (default: Samantha)
   * @param {number} options.rate - Speaking rate (default: 180)
   * @param {number} options.preDelay - Delay before speaking (default: 150ms)
   * @returns {Promise<void>}
   */
  speak(text, options = {}) {
    // Queue speech to prevent multiple simultaneous TTS
    this.speechQueue = this.speechQueue.then(() => this._doSpeak(text, options)).catch(() => {});
    return this.speechQueue;
  }

  async _doSpeak(text, options = {}) {
    // Kill any existing say process first
    exec('killall say 2>/dev/null', () => {});

    const voice = options.voice || 'Samantha';
    const rate = options.rate || 180;
    const preDelay = options.preDelay !== undefined ? options.preDelay : PRE_SPEAK_DELAY;

    this.speaking = true;
    this.interrupted = false;

    try {
      // Pre-speak delay (feels more natural)
      if (preDelay > 0) {
        await this.delay(preDelay);
      }

      // Check if interrupted during delay
      if (this.interrupted) {
        console.log('[training-voice] Interrupted before speaking');
        return;
      }

      // Use TTS lock to prevent mic pickup
      const command = `touch ${TTS_LOCK_FILE} && say -v ${voice} -r ${rate} "${text}" && rm -f ${TTS_LOCK_FILE}`;

      // Run with timeout to prevent zombie processes
      const promise = execAsync(command);
      const timeout = new Promise((_, reject) =>
        setTimeout(() => reject(new Error('Speech timeout')), MAX_SPEECH_MS)
      );

      // Allow interruption
      const checkInterruption = setInterval(() => {
        if (this.interrupted) {
          exec('killall say', () => {});
          exec(`rm -f ${TTS_LOCK_FILE}`, () => {});
          clearInterval(checkInterruption);
        }
      }, 100);

      try {
        await Promise.race([promise, timeout]);
      } finally {
        clearInterval(checkInterruption);
        exec(`rm -f ${TTS_LOCK_FILE}`, () => {});
      }

    } catch (e) {
      if (!this.interrupted) {
        console.error(`[training-voice] Failed to speak:`, e.message);
      }
    } finally {
      this.speaking = false;
    }
  }

  /**
   * Interrupt current speech
   */
  interrupt() {
    if (this.speaking) {
      this.interrupted = true;
      exec('killall say', () => {});
      exec(`rm -f ${TTS_LOCK_FILE}`, () => {});
      console.log('[training-voice] Speech interrupted');
    }
  }

  /**
   * Check if currently speaking
   * @returns {boolean}
   */
  isSpeaking() {
    return this.speaking;
  }

  /**
   * Delay helper
   * @param {number} ms - Milliseconds to delay
   * @returns {Promise<void>}
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Play sound then speak
   * @param {string} soundKey - Sound to play
   * @param {string} text - Text to speak
   * @param {object} options - Speak options
   */
  async soundThenSpeak(soundKey, text, options = {}) {
    await this.playSound(soundKey);
    await this.speak(text, options);
  }

  // ===== Training Mode Specific Helpers =====

  /**
   * Enter training mode
   */
  async enterTraining() {
    await this.soundThenSpeak('ENTER_TRAINING', 'Training mode. What should I learn?');
  }

  /**
   * Understood the input
   */
  async understood() {
    await this.playSound('UNDERSTOOD');
  }

  /**
   * Need clarification
   */
  async needClarification(message) {
    await this.soundThenSpeak('NEED_CLARIFICATION', message);
  }

  /**
   * Added a variation
   */
  async addedVariation(message) {
    // Double click
    await this.playSound('ADDED_VARIATION', 2);
    await this.speak(message);
  }

  /**
   * Confirming before save
   */
  async confirming(message) {
    await this.soundThenSpeak('CONFIRMING', message);
  }

  /**
   * Successfully saved
   */
  async saved() {
    await this.soundThenSpeak('SAVED', 'Learned!');
  }

  /**
   * Cancelled training
   */
  async cancelled() {
    await this.soundThenSpeak('CANCELLED', 'Cancelled.');
  }

  /**
   * Error occurred
   */
  async error(message) {
    await this.soundThenSpeak('ERROR', message || 'Something went wrong');
  }

  /**
   * Exit training mode
   */
  async exitTraining() {
    await this.soundThenSpeak('EXIT_TRAINING', 'Training off.');
  }

  /**
   * Timeout warning
   */
  async timeoutWarning() {
    await this.soundThenSpeak('NEED_CLARIFICATION', 'Still there?');
  }
}

// Singleton instance
export const trainingVoice = new TrainingVoice();

export default trainingVoice;
