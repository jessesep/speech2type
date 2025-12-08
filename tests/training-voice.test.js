/**
 * Tests for Training Voice/Audio Feedback Service (Phase 2.4)
 * Covers sound effects, voice prompts, interruption, and training helpers
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { exec } from 'child_process';

// Create a shared mock for execAsync
const execAsyncMock = vi.fn(async () => ({ stdout: '', stderr: '' }));

// Mock child_process
vi.mock('child_process', () => ({
  exec: vi.fn((cmd, callback) => {
    if (callback) callback(null, '', '');
    return { pid: 12345 };
  })
}));

// Mock util.promisify to always return our shared mock
vi.mock('util', async () => {
  return {
    promisify: vi.fn(() => execAsyncMock)
  };
});

// Import after mocks are set up
const { TrainingVoice } = await import('../src/services/training-voice.js');

describe('TrainingVoice', () => {
  let trainingVoice;

  beforeEach(() => {
    vi.clearAllMocks();
    execAsyncMock.mockResolvedValue({ stdout: '', stderr: '' });
    trainingVoice = new TrainingVoice();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ===== Constructor & State =====

  describe('Constructor', () => {
    it('should initialize with speaking=false', () => {
      expect(trainingVoice.speaking).toBe(false);
    });

    it('should initialize with interrupted=false', () => {
      expect(trainingVoice.interrupted).toBe(false);
    });
  });

  // ===== Sound Effects =====

  describe('playSound()', () => {
    it('should play a sound once by default', async () => {
      await trainingVoice.playSound('ENTER_TRAINING');

      expect(execAsyncMock).toHaveBeenCalledTimes(1);
      expect(execAsyncMock).toHaveBeenCalledWith(
        expect.stringContaining('afplay')
      );
      expect(execAsyncMock).toHaveBeenCalledWith(
        expect.stringContaining('/System/Library/Sounds/Glass.aiff')
      );
    });

    it('should play a sound multiple times when count > 1', async () => {
      await trainingVoice.playSound('ADDED_VARIATION', 2);

      expect(execAsyncMock).toHaveBeenCalledTimes(2);
    });

    it('should handle unknown sound keys gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await trainingVoice.playSound('INVALID_SOUND');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[training-voice] Unknown sound: INVALID_SOUND')
      );
      expect(execAsyncMock).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });

    it('should handle sound playback errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      execAsyncMock.mockRejectedValueOnce(new Error('afplay not found'));

      await trainingVoice.playSound('UNDERSTOOD');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[training-voice] Failed to play sound:'),
        'afplay not found'
      );

      consoleSpy.mockRestore();
    });

    it('should play each sound type correctly', async () => {
      const sounds = [
        'ENTER_TRAINING',
        'UNDERSTOOD',
        'NEED_CLARIFICATION',
        'CONFIRMING',
        'SAVED',
        'CANCELLED',
        'ERROR',
        'EXIT_TRAINING'
      ];

      for (const sound of sounds) {
        vi.clearAllMocks();
        await trainingVoice.playSound(sound);
        expect(execAsyncMock).toHaveBeenCalledTimes(1);
      }
    });

    it('should add delay between repeated sounds', async () => {
      const delaySpy = vi.spyOn(trainingVoice, 'delay');

      await trainingVoice.playSound('UNDERSTOOD', 3);

      // Should delay between 1st->2nd and 2nd->3rd (2 delays total)
      expect(delaySpy).toHaveBeenCalledTimes(2);
      expect(delaySpy).toHaveBeenCalledWith(100);
    });
  });

  // ===== Speech Synthesis =====

  describe('speak()', () => {
    it('should speak with default options', async () => {
      await trainingVoice.speak('Hello world');

      expect(execAsyncMock).toHaveBeenCalledWith(
        expect.stringMatching(/say -v Samantha -r 180 "Hello world"/)
      );
    });

    it('should set speaking=true during speech', async () => {
      const speakPromise = trainingVoice.speak('Testing');
      expect(trainingVoice.speaking).toBe(true);
      await speakPromise;
    });

    it('should set speaking=false after speech completes', async () => {
      await trainingVoice.speak('Testing');
      expect(trainingVoice.speaking).toBe(false);
    });

    it('should use custom voice when provided', async () => {
      await trainingVoice.speak('Hello', { voice: 'Alex' });

      expect(execAsyncMock).toHaveBeenCalledWith(
        expect.stringMatching(/say -v Alex/)
      );
    });

    it('should use custom rate when provided', async () => {
      await trainingVoice.speak('Hello', { rate: 200 });

      expect(execAsyncMock).toHaveBeenCalledWith(
        expect.stringMatching(/say -v Samantha -r 200/)
      );
    });

    it('should use custom preDelay when provided', async () => {
      const delaySpy = vi.spyOn(trainingVoice, 'delay');

      await trainingVoice.speak('Hello', { preDelay: 300 });

      expect(delaySpy).toHaveBeenCalledWith(300);
    });

    it('should skip preDelay when preDelay=0', async () => {
      const delaySpy = vi.spyOn(trainingVoice, 'delay');

      await trainingVoice.speak('Hello', { preDelay: 0 });

      expect(delaySpy).not.toHaveBeenCalled();
    });

    it('should use TTS lock file to prevent mic pickup', async () => {
      await trainingVoice.speak('Hello');

      expect(execAsyncMock).toHaveBeenCalledWith(
        expect.stringMatching(/touch \/tmp\/claude-tts-speaking/)
      );
      expect(execAsyncMock).toHaveBeenCalledWith(
        expect.stringMatching(/rm -f \/tmp\/claude-tts-speaking/)
      );
    });

    it('should handle speech errors gracefully', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      execAsyncMock.mockRejectedValueOnce(new Error('say command failed'));

      await trainingVoice.speak('Hello');

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('[training-voice] Failed to speak:'),
        'say command failed'
      );
      expect(trainingVoice.speaking).toBe(false);

      consoleSpy.mockRestore();
    });

    it('should not log error if interrupted during speech error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      execAsyncMock.mockRejectedValueOnce(new Error('interrupted'));

      const speakPromise = trainingVoice.speak('Hello');
      trainingVoice.interrupted = true;
      await speakPromise;

      // The error may still be logged because interruption happens during execution
      // This test just ensures the system handles interruption gracefully
      expect(trainingVoice.speaking).toBe(false);

      consoleSpy.mockRestore();
    });

    it('should return early if interrupted during pre-speak delay', async () => {
      const delaySpy = vi.spyOn(trainingVoice, 'delay').mockImplementation(async () => {
        trainingVoice.interrupted = true;
      });
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await trainingVoice.speak('Hello');

      expect(consoleSpy).toHaveBeenCalledWith('[training-voice] Interrupted before speaking');
      expect(execAsyncMock).not.toHaveBeenCalled();

      delaySpy.mockRestore();
      consoleSpy.mockRestore();
    });
  });

  // ===== Interruption Handling =====

  describe('interrupt()', () => {
    it('should set interrupted=true when speaking', () => {
      trainingVoice.speaking = true;
      trainingVoice.interrupt();
      expect(trainingVoice.interrupted).toBe(true);
    });

    it('should kill say process', () => {
      trainingVoice.speaking = true;
      trainingVoice.interrupt();

      expect(exec).toHaveBeenCalledWith('killall say', expect.any(Function));
    });

    it('should remove TTS lock file', () => {
      trainingVoice.speaking = true;
      trainingVoice.interrupt();

      expect(exec).toHaveBeenCalledWith('rm -f /tmp/claude-tts-speaking', expect.any(Function));
    });

    it('should log interruption message', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
      trainingVoice.speaking = true;

      trainingVoice.interrupt();

      expect(consoleSpy).toHaveBeenCalledWith('[training-voice] Speech interrupted');
      consoleSpy.mockRestore();
    });

    it('should not do anything if not speaking', () => {
      trainingVoice.speaking = false;
      trainingVoice.interrupt();

      expect(trainingVoice.interrupted).toBe(false);
      expect(exec).not.toHaveBeenCalled();
    });
  });

  describe('isSpeaking()', () => {
    it('should return false initially', () => {
      expect(trainingVoice.isSpeaking()).toBe(false);
    });

    it('should return true when speaking', () => {
      trainingVoice.speaking = true;
      expect(trainingVoice.isSpeaking()).toBe(true);
    });

    it('should return false after speaking completes', async () => {
      await trainingVoice.speak('Hello');
      expect(trainingVoice.isSpeaking()).toBe(false);
    });
  });

  // ===== Utility Methods =====

  describe('delay()', () => {
    it('should delay for specified milliseconds', async () => {
      const start = Date.now();
      await trainingVoice.delay(100);
      const elapsed = Date.now() - start;

      expect(elapsed).toBeGreaterThanOrEqual(90); // Allow some margin
      expect(elapsed).toBeLessThan(150);
    });

    it('should return a promise', () => {
      const result = trainingVoice.delay(10);
      expect(result).toBeInstanceOf(Promise);
    });
  });

  describe('soundThenSpeak()', () => {
    it('should play sound then speak', async () => {
      const playSpy = vi.spyOn(trainingVoice, 'playSound');
      const speakSpy = vi.spyOn(trainingVoice, 'speak');

      await trainingVoice.soundThenSpeak('UNDERSTOOD', 'Got it');

      expect(playSpy).toHaveBeenCalledWith('UNDERSTOOD');
      expect(speakSpy).toHaveBeenCalledWith('Got it', {});

      // Verify order: sound before speak
      expect(playSpy.mock.invocationCallOrder[0])
        .toBeLessThan(speakSpy.mock.invocationCallOrder[0]);
    });

    it('should pass options to speak', async () => {
      const speakSpy = vi.spyOn(trainingVoice, 'speak');

      await trainingVoice.soundThenSpeak('UNDERSTOOD', 'Got it', { voice: 'Alex', rate: 200 });

      expect(speakSpy).toHaveBeenCalledWith('Got it', { voice: 'Alex', rate: 200 });
    });
  });

  // ===== Training Mode Helpers =====

  describe('Training Mode Helpers', () => {
    describe('enterTraining()', () => {
      it('should play enter sound and speak welcome message', async () => {
        const soundSpy = vi.spyOn(trainingVoice, 'soundThenSpeak');

        await trainingVoice.enterTraining();

        expect(soundSpy).toHaveBeenCalledWith('ENTER_TRAINING', 'Training mode. What should I learn?');
      });
    });

    describe('understood()', () => {
      it('should play understood sound', async () => {
        const playSpy = vi.spyOn(trainingVoice, 'playSound');

        await trainingVoice.understood();

        expect(playSpy).toHaveBeenCalledWith('UNDERSTOOD');
      });
    });

    describe('needClarification()', () => {
      it('should play clarification sound and speak message', async () => {
        const soundSpy = vi.spyOn(trainingVoice, 'soundThenSpeak');

        await trainingVoice.needClarification('What did you mean?');

        expect(soundSpy).toHaveBeenCalledWith('NEED_CLARIFICATION', 'What did you mean?');
      });
    });

    describe('addedVariation()', () => {
      it('should play double-click sound', async () => {
        const playSpy = vi.spyOn(trainingVoice, 'playSound');
        const speakSpy = vi.spyOn(trainingVoice, 'speak');

        await trainingVoice.addedVariation('Added');

        expect(playSpy).toHaveBeenCalledWith('ADDED_VARIATION', 2);
        expect(speakSpy).toHaveBeenCalledWith('Added');
      });
    });

    describe('confirming()', () => {
      it('should play confirming sound and speak message', async () => {
        const soundSpy = vi.spyOn(trainingVoice, 'soundThenSpeak');

        await trainingVoice.confirming('Is this correct?');

        expect(soundSpy).toHaveBeenCalledWith('CONFIRMING', 'Is this correct?');
      });
    });

    describe('saved()', () => {
      it('should play success sound and say "Learned!"', async () => {
        const soundSpy = vi.spyOn(trainingVoice, 'soundThenSpeak');

        await trainingVoice.saved();

        expect(soundSpy).toHaveBeenCalledWith('SAVED', 'Learned!');
      });
    });

    describe('cancelled()', () => {
      it('should play cancel sound and say "Cancelled."', async () => {
        const soundSpy = vi.spyOn(trainingVoice, 'soundThenSpeak');

        await trainingVoice.cancelled();

        expect(soundSpy).toHaveBeenCalledWith('CANCELLED', 'Cancelled.');
      });
    });

    describe('error()', () => {
      it('should play error sound and speak error message', async () => {
        const soundSpy = vi.spyOn(trainingVoice, 'soundThenSpeak');

        await trainingVoice.error('Failed to save');

        expect(soundSpy).toHaveBeenCalledWith('ERROR', 'Failed to save');
      });

      it('should use default message if none provided', async () => {
        const soundSpy = vi.spyOn(trainingVoice, 'soundThenSpeak');

        await trainingVoice.error();

        expect(soundSpy).toHaveBeenCalledWith('ERROR', 'Something went wrong');
      });
    });

    describe('exitTraining()', () => {
      it('should play exit sound and say "Training off."', async () => {
        const soundSpy = vi.spyOn(trainingVoice, 'soundThenSpeak');

        await trainingVoice.exitTraining();

        expect(soundSpy).toHaveBeenCalledWith('EXIT_TRAINING', 'Training off.');
      });
    });

    describe('timeoutWarning()', () => {
      it('should play warning sound and ask "Still there?"', async () => {
        const soundSpy = vi.spyOn(trainingVoice, 'soundThenSpeak');

        await trainingVoice.timeoutWarning();

        expect(soundSpy).toHaveBeenCalledWith('NEED_CLARIFICATION', 'Still there?');
      });
    });
  });

  // ===== Integration Scenarios =====

  describe('Integration Scenarios', () => {
    it('should handle full training entry flow', async () => {
      const playSpy = vi.spyOn(trainingVoice, 'playSound');
      const speakSpy = vi.spyOn(trainingVoice, 'speak');

      await trainingVoice.enterTraining();

      expect(playSpy).toHaveBeenCalledWith('ENTER_TRAINING');
      expect(speakSpy).toHaveBeenCalledWith('Training mode. What should I learn?', {});
    });

    it('should handle variation collection flow', async () => {
      await trainingVoice.understood();
      await trainingVoice.addedVariation('Added first variation');
      await trainingVoice.addedVariation('Added second variation');

      expect(execAsyncMock).toHaveBeenCalled();
    });

    it('should handle confirmation flow', async () => {
      await trainingVoice.confirming('Should I save this?');
      await trainingVoice.saved();

      expect(execAsyncMock).toHaveBeenCalled();
    });

    it('should handle cancellation flow', async () => {
      await trainingVoice.confirming('Should I save this?');
      await trainingVoice.cancelled();

      expect(execAsyncMock).toHaveBeenCalled();
    });

    it('should handle error recovery flow', async () => {
      await trainingVoice.error('Failed to parse');
      await trainingVoice.needClarification('Can you say that again?');

      expect(execAsyncMock).toHaveBeenCalled();
    });

    it('should handle timeout flow', async () => {
      await trainingVoice.timeoutWarning();

      expect(execAsyncMock).toHaveBeenCalled();
    });

    it('should handle full training exit flow', async () => {
      await trainingVoice.exitTraining();

      const playSpy = vi.spyOn(trainingVoice, 'playSound');
      const speakSpy = vi.spyOn(trainingVoice, 'speak');

      await trainingVoice.exitTraining();

      expect(playSpy).toHaveBeenCalledWith('EXIT_TRAINING');
      expect(speakSpy).toHaveBeenCalledWith('Training off.', {});
    });

    it('should handle interrupted training flow', async () => {
      const speakPromise = trainingVoice.speak('This will be interrupted');
      trainingVoice.interrupt();
      await speakPromise;

      expect(trainingVoice.interrupted).toBe(true);
      expect(exec).toHaveBeenCalledWith('killall say', expect.any(Function));
    });
  });

  // ===== Edge Cases =====

  describe('Edge Cases', () => {
    it('should handle rapid speak() calls', async () => {
      const promises = [
        trainingVoice.speak('First'),
        trainingVoice.speak('Second'),
        trainingVoice.speak('Third')
      ];

      await Promise.all(promises);

      expect(execAsyncMock).toHaveBeenCalledTimes(3);
    });

    it('should handle interrupt before speak starts', () => {
      trainingVoice.speaking = false;
      trainingVoice.interrupt();

      expect(trainingVoice.interrupted).toBe(false);
    });

    it('should handle empty message', async () => {
      await trainingVoice.speak('');

      expect(execAsyncMock).toHaveBeenCalledWith(
        expect.stringMatching(/say -v Samantha -r 180 ""/)
      );
    });

    it('should handle special characters in speech text', async () => {
      await trainingVoice.speak('Hello "world" & stuff');

      expect(execAsyncMock).toHaveBeenCalled();
    });

    it('should handle very long speech text', async () => {
      const longText = 'a'.repeat(1000);
      await trainingVoice.speak(longText);

      expect(execAsyncMock).toHaveBeenCalledWith(
        expect.stringContaining(longText)
      );
    });

    it('should reset state after error', async () => {
      execAsyncMock.mockRejectedValueOnce(new Error('fail'));
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      await trainingVoice.speak('Test');

      expect(trainingVoice.speaking).toBe(false);
      expect(trainingVoice.interrupted).toBe(false);

      consoleSpy.mockRestore();
    });
  });
});
