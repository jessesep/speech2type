/**
 * Tests for TrainingMode service (Phase 2.2)
 *
 * Tests the conversational training state machine that allows users
 * to teach ONE new commands through natural conversation.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { TrainingMode, TrainingState, TrainingType } from '../src/services/training-mode.js';

// Mock commandDictionary
vi.mock('../src/services/commands.js', () => ({
  commandDictionary: {
    learn: vi.fn().mockResolvedValue(undefined),
    save: vi.fn().mockResolvedValue(undefined),
    data: {
      workflows: []
    }
  }
}));

describe('TrainingMode', () => {
  let trainingMode;
  let mockCallbacks;

  beforeEach(() => {
    trainingMode = new TrainingMode();
    mockCallbacks = {
      onSpeak: vi.fn().mockResolvedValue(undefined),
      onExecute: vi.fn().mockResolvedValue(undefined),
      onStateChange: vi.fn()
    };
    trainingMode.setCallbacks(mockCallbacks);

    // Clear timers
    vi.clearAllTimers();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with IDLE state', () => {
      const mode = new TrainingMode();
      expect(mode.getState()).toBe(TrainingState.IDLE);
    });

    it('should have null initial session', () => {
      const mode = new TrainingMode();
      expect(mode.getSession()).toBeNull();
    });

    it('should set callbacks correctly', () => {
      const mode = new TrainingMode();
      const callbacks = {
        onSpeak: vi.fn(),
        onExecute: vi.fn(),
        onStateChange: vi.fn()
      };
      mode.setCallbacks(callbacks);
      expect(mode.onSpeak).toBe(callbacks.onSpeak);
      expect(mode.onExecute).toBe(callbacks.onExecute);
      expect(mode.onStateChange).toBe(callbacks.onStateChange);
    });
  });

  describe('State Management', () => {
    it('should change state and call onStateChange callback', () => {
      trainingMode.setState(TrainingState.LISTENING);
      expect(trainingMode.getState()).toBe(TrainingState.LISTENING);
      expect(mockCallbacks.onStateChange).toHaveBeenCalledWith(
        TrainingState.LISTENING,
        TrainingState.IDLE
      );
    });

    it('should track state transitions correctly', () => {
      trainingMode.setState(TrainingState.LISTENING);
      trainingMode.setState(TrainingState.COLLECTING_VARIATIONS);

      expect(mockCallbacks.onStateChange).toHaveBeenCalledTimes(2);
      expect(mockCallbacks.onStateChange).toHaveBeenNthCalledWith(1,
        TrainingState.LISTENING,
        TrainingState.IDLE
      );
      expect(mockCallbacks.onStateChange).toHaveBeenNthCalledWith(2,
        TrainingState.COLLECTING_VARIATIONS,
        TrainingState.LISTENING
      );
    });

    it('should report isActive() as false when IDLE', () => {
      expect(trainingMode.isActive()).toBe(false);
    });

    it('should report isActive() as true when not IDLE', () => {
      trainingMode.setState(TrainingState.LISTENING);
      expect(trainingMode.isActive()).toBe(true);
    });
  });

  describe('enter() - Start Training Mode', () => {
    it('should transition from IDLE to LISTENING', async () => {
      const result = await trainingMode.enter();

      expect(result).toBe(true);
      expect(trainingMode.getState()).toBe(TrainingState.LISTENING);
    });

    it('should create a new session', async () => {
      await trainingMode.enter();

      const session = trainingMode.getSession();
      expect(session).not.toBeNull();
      expect(session).toHaveProperty('id');
      expect(session).toHaveProperty('started_at');
      expect(session).toHaveProperty('type', null);
      expect(session).toHaveProperty('data');
      expect(session).toHaveProperty('history');
    });

    it('should speak welcome message', async () => {
      await trainingMode.enter();

      expect(mockCallbacks.onSpeak).toHaveBeenCalledWith('Training mode. What should I learn?');
    });

    it('should return false if already active', async () => {
      await trainingMode.enter();
      const result = await trainingMode.enter();

      expect(result).toBe(false);
    });

    it('should initialize session with empty trigger_phrases', async () => {
      await trainingMode.enter();

      const session = trainingMode.getSession();
      expect(session.data.trigger_phrases).toEqual([]);
    });

    it('should initialize session with empty steps', async () => {
      await trainingMode.enter();

      const session = trainingMode.getSession();
      expect(session.data.steps).toEqual([]);
    });
  });

  describe('exit() - Exit Training Mode', () => {
    beforeEach(async () => {
      await trainingMode.enter();
    });

    it('should return to IDLE state', async () => {
      await trainingMode.exit(false);

      expect(trainingMode.getState()).toBe(TrainingState.IDLE);
    });

    it('should clear session', async () => {
      await trainingMode.exit(false);

      expect(trainingMode.getSession()).toBeNull();
    });

    it('should speak cancel message when not saving', async () => {
      await trainingMode.exit(false);

      expect(mockCallbacks.onSpeak).toHaveBeenCalledWith('Cancelled. Training mode off.');
    });

    it('should speak learned message when saving', async () => {
      // Add some data to session
      trainingMode.session.data.trigger_phrases.push('test phrase');
      trainingMode.session.type = TrainingType.SIMPLE_COMMAND;

      await trainingMode.exit(true);

      expect(mockCallbacks.onSpeak).toHaveBeenCalledWith('Learned! Training mode off.');
    });

    it('should return false if not active', async () => {
      await trainingMode.exit(false);
      const result = await trainingMode.exit(false);

      expect(result).toBe(false);
    });
  });

  describe('checkExitCommand()', () => {
    it('should detect "cancel"', () => {
      expect(trainingMode.checkExitCommand('cancel')).toBe(true);
    });

    it('should detect "nevermind"', () => {
      expect(trainingMode.checkExitCommand('nevermind')).toBe(true);
    });

    it('should detect "never mind"', () => {
      expect(trainingMode.checkExitCommand('never mind')).toBe(true);
    });

    it('should detect "exit"', () => {
      expect(trainingMode.checkExitCommand('exit')).toBe(true);
    });

    it('should detect "stop"', () => {
      expect(trainingMode.checkExitCommand('stop')).toBe(true);
    });

    it('should be case insensitive', () => {
      expect(trainingMode.checkExitCommand('CANCEL')).toBe(true);
      expect(trainingMode.checkExitCommand('Exit')).toBe(true);
    });

    it('should not detect non-exit commands', () => {
      expect(trainingMode.checkExitCommand('continue')).toBe(false);
      expect(trainingMode.checkExitCommand('yes')).toBe(false);
      expect(trainingMode.checkExitCommand('cancel that')).toBe(false);
    });
  });

  describe('handleTrainingRequest() - LISTENING State', () => {
    beforeEach(async () => {
      await trainingMode.enter();
      mockCallbacks.onSpeak.mockClear();
    });

    it('should extract trigger phrase from quoted text', async () => {
      await trainingMode.handleTrainingRequest('When I say "yeet", delete the selection');

      const session = trainingMode.getSession();
      expect(session.data.trigger_phrases).toContain('yeet');
    });

    it('should set type to SIMPLE_COMMAND', async () => {
      await trainingMode.handleTrainingRequest('When I say "yeet", delete the selection');

      const session = trainingMode.getSession();
      expect(session.type).toBe(TrainingType.SIMPLE_COMMAND);
    });

    it('should transition to COLLECTING_VARIATIONS', async () => {
      await trainingMode.handleTrainingRequest('When I say "yeet", delete the selection');

      expect(trainingMode.getState()).toBe(TrainingState.COLLECTING_VARIATIONS);
    });

    it('should extract action description', async () => {
      await trainingMode.handleTrainingRequest('When I say "yeet", delete the selection');

      const session = trainingMode.getSession();
      expect(session.data.action_description).toBe('delete the selection');
    });

    it('should speak confirmation with extracted phrase and action', async () => {
      await trainingMode.handleTrainingRequest('When I say "yeet", delete the selection');

      expect(mockCallbacks.onSpeak).toHaveBeenCalledWith(
        expect.stringContaining('"yeet"')
      );
      expect(mockCallbacks.onSpeak).toHaveBeenCalledWith(
        expect.stringContaining('delete the selection')
      );
    });

    it('should handle single quotes', async () => {
      await trainingMode.handleTrainingRequest("When I say 'ship it', run the deploy workflow");

      const session = trainingMode.getSession();
      expect(session.data.trigger_phrases).toContain('ship it');
    });

    it('should ask for clarification on invalid format', async () => {
      await trainingMode.handleTrainingRequest('I want to add a new command');

      expect(mockCallbacks.onSpeak).toHaveBeenCalledWith(
        expect.stringContaining('I need you to say')
      );
      expect(trainingMode.getState()).toBe(TrainingState.LISTENING);
    });
  });

  describe('handleVariation() - COLLECTING_VARIATIONS State', () => {
    beforeEach(async () => {
      await trainingMode.enter();
      await trainingMode.handleTrainingRequest('When I say "yeet", delete');
      mockCallbacks.onSpeak.mockClear();
    });

    it('should add variation to trigger_phrases', async () => {
      await trainingMode.handleVariation('also "throw it away"');

      const session = trainingMode.getSession();
      expect(session.data.trigger_phrases).toContain('throw it away');
    });

    it('should extract quoted phrase', async () => {
      await trainingMode.handleVariation('"chuck it"');

      const session = trainingMode.getSession();
      expect(session.data.trigger_phrases).toContain('chuck it');
    });

    it('should use whole text if not quoted', async () => {
      await trainingMode.handleVariation('also discard this');

      const session = trainingMode.getSession();
      expect(session.data.trigger_phrases).toContain('discard this');
    });

    it('should remove "also" prefix', async () => {
      await trainingMode.handleVariation('also chuck it');

      const session = trainingMode.getSession();
      expect(session.data.trigger_phrases).toContain('chuck it');
      expect(session.data.trigger_phrases).not.toContain('also chuck it');
    });

    it('should speak confirmation', async () => {
      await trainingMode.handleVariation('chuck it');

      expect(mockCallbacks.onSpeak).toHaveBeenCalledWith('Added. Anything else?');
    });

    it('should transition to CONFIRMING on "done"', async () => {
      await trainingMode.handleVariation('done');

      expect(trainingMode.getState()).toBe(TrainingState.CONFIRMING);
    });

    it('should transition to CONFIRMING on "no"', async () => {
      await trainingMode.handleVariation('no');

      expect(trainingMode.getState()).toBe(TrainingState.CONFIRMING);
    });

    it('should transition to CONFIRMING on "that\'s it"', async () => {
      await trainingMode.handleVariation("that's it");

      expect(trainingMode.getState()).toBe(TrainingState.CONFIRMING);
    });
  });

  describe('confirm() - Enter CONFIRMING State', () => {
    beforeEach(async () => {
      await trainingMode.enter();
      await trainingMode.handleTrainingRequest('When I say "yeet", delete');
      await trainingMode.handleVariation('chuck it');
      mockCallbacks.onSpeak.mockClear();
    });

    it('should transition to CONFIRMING state', async () => {
      await trainingMode.confirm();

      expect(trainingMode.getState()).toBe(TrainingState.CONFIRMING);
    });

    it('should speak summary for simple command', async () => {
      await trainingMode.confirm();

      expect(mockCallbacks.onSpeak).toHaveBeenCalledWith(
        expect.stringContaining('"yeet"')
      );
      expect(mockCallbacks.onSpeak).toHaveBeenCalledWith(
        expect.stringContaining('confirm')
      );
    });

    it('should include all trigger phrases in summary', async () => {
      await trainingMode.handleVariation('toss it');
      await trainingMode.confirm();

      // Get the last onSpeak call which has the summary
      const calls = mockCallbacks.onSpeak.mock.calls;
      const spokenText = calls[calls.length - 1][0];
      expect(spokenText).toContain('"yeet"');
      expect(spokenText).toContain('"chuck it"');
      expect(spokenText).toContain('"toss it"');
    });
  });

  describe('handleConfirmation() - CONFIRMING State', () => {
    beforeEach(async () => {
      await trainingMode.enter();
      await trainingMode.handleTrainingRequest('When I say "yeet", delete');
      await trainingMode.confirm();
      mockCallbacks.onSpeak.mockClear();
    });

    it('should save and exit on "yes"', async () => {
      await trainingMode.handleConfirmation('yes');

      expect(trainingMode.getState()).toBe(TrainingState.IDLE);
      expect(mockCallbacks.onSpeak).toHaveBeenCalledWith('Learned! Training mode off.');
    });

    it('should save and exit on "confirm"', async () => {
      await trainingMode.handleConfirmation('confirm');

      expect(trainingMode.getState()).toBe(TrainingState.IDLE);
    });

    it('should save and exit on "affirmative"', async () => {
      await trainingMode.handleConfirmation('affirmative');

      expect(trainingMode.getState()).toBe(TrainingState.IDLE);
    });

    it('should cancel and exit on "no"', async () => {
      await trainingMode.handleConfirmation('no');

      expect(trainingMode.getState()).toBe(TrainingState.IDLE);
      expect(mockCallbacks.onSpeak).toHaveBeenCalledWith('Cancelled. Training mode off.');
    });

    it('should cancel and exit on "cancel"', async () => {
      await trainingMode.handleConfirmation('cancel');

      expect(trainingMode.getState()).toBe(TrainingState.IDLE);
    });

    it('should prompt again on unclear response', async () => {
      await trainingMode.handleConfirmation('maybe');

      expect(trainingMode.getState()).toBe(TrainingState.CONFIRMING);
      expect(mockCallbacks.onSpeak).toHaveBeenCalledWith(
        'Say "confirm" to save or "cancel" to discard.'
      );
    });
  });

  describe('handleSpeech() - Main Entry Point', () => {
    it('should return false if not active', async () => {
      const result = await trainingMode.handleSpeech('test');

      expect(result).toBe(false);
    });

    it('should return true if active', async () => {
      await trainingMode.enter();
      const result = await trainingMode.handleSpeech('test');

      expect(result).toBe(true);
    });

    it('should add speech to history', async () => {
      await trainingMode.enter();
      await trainingMode.handleSpeech('test message');

      const session = trainingMode.getSession();
      const userMessages = session.history.filter(h => h.role === 'user');
      expect(userMessages).toHaveLength(1);
      expect(userMessages[0].content).toBe('test message');
    });

    it('should handle exit commands', async () => {
      await trainingMode.enter();
      await trainingMode.handleSpeech('cancel');

      expect(trainingMode.getState()).toBe(TrainingState.IDLE);
    });

    it('should route to correct handler based on state', async () => {
      await trainingMode.enter();

      // LISTENING state
      expect(trainingMode.getState()).toBe(TrainingState.LISTENING);
      await trainingMode.handleSpeech('When I say "test", do something');

      // COLLECTING_VARIATIONS state
      expect(trainingMode.getState()).toBe(TrainingState.COLLECTING_VARIATIONS);
      await trainingMode.handleSpeech('done');

      // CONFIRMING state
      expect(trainingMode.getState()).toBe(TrainingState.CONFIRMING);
    });
  });

  describe('addToHistory()', () => {
    beforeEach(async () => {
      await trainingMode.enter();
    });

    it('should add message to session history', () => {
      trainingMode.addToHistory('user', 'test message');

      const session = trainingMode.getSession();
      expect(session.history).toHaveLength(1);
      expect(session.history[0].role).toBe('user');
      expect(session.history[0].content).toBe('test message');
    });

    it('should add timestamp to history entry', () => {
      trainingMode.addToHistory('one', 'response');

      const session = trainingMode.getSession();
      expect(session.history[0]).toHaveProperty('timestamp');
      expect(session.history[0].timestamp).toBeTruthy();
    });

    it('should support multiple history entries', () => {
      trainingMode.addToHistory('user', 'message 1');
      trainingMode.addToHistory('one', 'response 1');
      trainingMode.addToHistory('user', 'message 2');

      const session = trainingMode.getSession();
      expect(session.history).toHaveLength(3);
    });
  });

  describe('Integration Flows', () => {
    it('should handle full simple command training flow', async () => {
      // 1. Enter training mode
      await trainingMode.enter();
      expect(trainingMode.getState()).toBe(TrainingState.LISTENING);

      // 2. Provide training request
      await trainingMode.handleSpeech('When I say "yeet", delete selection');
      expect(trainingMode.getState()).toBe(TrainingState.COLLECTING_VARIATIONS);

      // 3. Add a variation
      await trainingMode.handleSpeech('"chuck it"');
      expect(trainingMode.getState()).toBe(TrainingState.COLLECTING_VARIATIONS);

      // 4. Say done
      await trainingMode.handleSpeech('done');
      expect(trainingMode.getState()).toBe(TrainingState.CONFIRMING);

      // 5. Confirm
      await trainingMode.handleSpeech('yes');
      expect(trainingMode.getState()).toBe(TrainingState.IDLE);

      // Verify session was populated correctly
      expect(mockCallbacks.onSpeak).toHaveBeenCalledWith('Learned! Training mode off.');
    });

    it('should handle cancellation at any stage', async () => {
      await trainingMode.enter();
      await trainingMode.handleSpeech('When I say "test", do something');

      expect(trainingMode.getState()).toBe(TrainingState.COLLECTING_VARIATIONS);

      await trainingMode.handleSpeech('cancel');
      expect(trainingMode.getState()).toBe(TrainingState.IDLE);
      expect(mockCallbacks.onSpeak).toHaveBeenCalledWith('Cancelled. Training mode off.');
    });

    it('should handle rejection at confirmation', async () => {
      await trainingMode.enter();
      await trainingMode.handleSpeech('When I say "test", do something');
      await trainingMode.handleSpeech('done');

      expect(trainingMode.getState()).toBe(TrainingState.CONFIRMING);

      await trainingMode.handleSpeech('no');
      expect(trainingMode.getState()).toBe(TrainingState.IDLE);
      expect(mockCallbacks.onSpeak).toHaveBeenCalledWith('Cancelled. Training mode off.');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty session gracefully', async () => {
      const mode = new TrainingMode();
      await mode.save();
      // Should not throw
    });

    it('should handle whitespace-only text', async () => {
      await trainingMode.enter();
      await trainingMode.handleSpeech('   ');
      // Should not crash
    });

    it('should be case insensitive for exit commands', async () => {
      await trainingMode.enter();
      await trainingMode.handleSpeech('CANCEL');
      expect(trainingMode.getState()).toBe(TrainingState.IDLE);
    });

    it('should be case insensitive for confirmation', async () => {
      await trainingMode.enter();
      await trainingMode.handleSpeech('When I say "test", do something');
      await trainingMode.handleSpeech('done');
      await trainingMode.handleSpeech('YES');
      expect(trainingMode.getState()).toBe(TrainingState.IDLE);
    });
  });
});
