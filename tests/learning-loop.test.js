/**
 * Tests for Learning Loop Service (Phase 2.1)
 * Comprehensive coverage of feedback detection, confidence adjustments, and state management
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { LearningLoop, LearningState, THRESHOLDS, CONFIDENCE_ADJUSTMENTS } from '../src/services/learning-loop.js';

// Mock dependencies
vi.mock('../src/services/commands.js', () => ({
  commandDictionary: {
    data: {
      commands: []
    },
    save: vi.fn().mockResolvedValue(undefined),
    forget: vi.fn().mockResolvedValue(undefined),
    learn: vi.fn().mockResolvedValue(undefined),
    buildIndexes: vi.fn()
  }
}));

vi.mock('../src/services/context-window.js', () => ({
  contextWindow: {
    addSpeech: vi.fn(),
    addAction: vi.fn(),
    addFeedback: vi.fn(),
    addCorrection: vi.fn(),
    addConfirmation: vi.fn()
  }
}));

import { commandDictionary } from '../src/services/commands.js';
import { contextWindow } from '../src/services/context-window.js';

describe('LearningLoop', () => {
  let loop;
  let mockOnSpeak;
  let mockOnExecute;
  let mockOnStateChange;

  beforeEach(() => {
    loop = new LearningLoop();

    // Reset mocks
    vi.clearAllMocks();
    commandDictionary.data.commands = [];

    // Setup callbacks
    mockOnSpeak = vi.fn().mockResolvedValue(undefined);
    mockOnExecute = vi.fn().mockResolvedValue(undefined);
    mockOnStateChange = vi.fn();

    loop.setCallbacks({
      onSpeak: mockOnSpeak,
      onExecute: mockOnExecute,
      onStateChange: mockOnStateChange
    });
  });

  afterEach(() => {
    // Clear any pending timers
    loop.reset();
  });

  describe('Constructor and Initialization', () => {
    it('should initialize with IDLE state', () => {
      const newLoop = new LearningLoop();
      expect(newLoop.getState()).toBe(LearningState.IDLE);
    });

    it('should have null initial values', () => {
      const newLoop = new LearningLoop();
      expect(newLoop.pendingConfirmation).toBeNull();
      expect(newLoop.correctionContext).toBeNull();
      expect(newLoop.observationTimer).toBeNull();
      expect(newLoop.confirmationTimer).toBeNull();
    });

    it('should set callbacks correctly', () => {
      const newLoop = new LearningLoop();
      const callbacks = {
        onSpeak: vi.fn(),
        onExecute: vi.fn(),
        onStateChange: vi.fn()
      };
      newLoop.setCallbacks(callbacks);
      expect(newLoop.onSpeak).toBe(callbacks.onSpeak);
      expect(newLoop.onExecute).toBe(callbacks.onExecute);
      expect(newLoop.onStateChange).toBe(callbacks.onStateChange);
    });
  });

  describe('State Management', () => {
    it('should change state and call onStateChange callback', () => {
      loop.setState(LearningState.OBSERVING);
      expect(loop.getState()).toBe(LearningState.OBSERVING);
      expect(mockOnStateChange).toHaveBeenCalledWith(LearningState.OBSERVING, LearningState.IDLE);
    });

    it('should track state transitions correctly', () => {
      loop.setState(LearningState.OBSERVING);
      loop.setState(LearningState.AWAITING_CONFIRMATION);
      expect(mockOnStateChange).toHaveBeenNthCalledWith(1, LearningState.OBSERVING, LearningState.IDLE);
      expect(mockOnStateChange).toHaveBeenNthCalledWith(2, LearningState.AWAITING_CONFIRMATION, LearningState.OBSERVING);
    });
  });

  describe('observeAction()', () => {
    it('should record action to context and enter OBSERVING state', async () => {
      await loop.observeAction('save file', 'SAVE_FILE', 0.95, 1);

      expect(contextWindow.addSpeech).toHaveBeenCalledWith('save file');
      expect(contextWindow.addAction).toHaveBeenCalledWith('SAVE_FILE', 0.95, 1);
      expect(loop.getState()).toBe(LearningState.OBSERVING);
    });

    it('should store correction context', async () => {
      await loop.observeAction('save file', 'SAVE_FILE', 0.95, 1);

      expect(loop.correctionContext).toMatchObject({
        phrase: 'save file',
        action: 'SAVE_FILE',
        confidence: 0.95,
        tier: 1
      });
      expect(loop.correctionContext.timestamp).toBeGreaterThan(0);
    });

    it('should set implicit positive timer', async () => {
      vi.useFakeTimers();
      commandDictionary.data.commands = [{
        action: 'SAVE_FILE',
        confidence: 0.9,
        use_count: 0,
        last_used: null
      }];

      await loop.observeAction('save file', 'SAVE_FILE', 0.95, 1);

      // Fast forward past implicit feedback window (5 seconds)
      vi.advanceTimersByTime(5100);

      expect(loop.getState()).toBe(LearningState.IDLE);
      expect(commandDictionary.save).toHaveBeenCalled();

      vi.useRealTimers();
    });

    it('should clear previous observation timer', async () => {
      await loop.observeAction('save file', 'SAVE_FILE', 0.95, 1);
      const firstTimer = loop.observationTimer;

      await loop.observeAction('open browser', 'OPEN_BROWSER', 0.92, 1);

      expect(loop.observationTimer).not.toBe(firstTimer);
    });
  });

  describe('recordImplicitPositive()', () => {
    it('should increase confidence and update use count', async () => {
      const command = {
        action: 'SAVE_FILE',
        confidence: 0.8,
        use_count: 5,
        last_used: null
      };
      commandDictionary.data.commands = [command];

      await loop.recordImplicitPositive('save file', 'SAVE_FILE');

      expect(command.confidence).toBe(0.8 + CONFIDENCE_ADJUSTMENTS.IMPLICIT_POSITIVE);
      expect(command.use_count).toBe(6);
      expect(command.last_used).toBeTruthy();
      expect(commandDictionary.save).toHaveBeenCalled();
      expect(contextWindow.addFeedback).toHaveBeenCalledWith('positive', 'SAVE_FILE');
    });

    it('should cap confidence at 1.0', async () => {
      const command = {
        action: 'SAVE_FILE',
        confidence: 0.99,
        use_count: 10
      };
      commandDictionary.data.commands = [command];

      await loop.recordImplicitPositive('save file', 'SAVE_FILE');

      expect(command.confidence).toBe(1.0);
    });

    it('should handle missing command gracefully', async () => {
      commandDictionary.data.commands = [];

      await expect(loop.recordImplicitPositive('unknown', 'UNKNOWN')).resolves.not.toThrow();
      expect(contextWindow.addFeedback).toHaveBeenCalledWith('positive', 'UNKNOWN');
    });
  });

  describe('recordImplicitNegative()', () => {
    it('should decrease confidence', async () => {
      const command = {
        action: 'SAVE_FILE',
        confidence: 0.8,
        source: 'default'
      };
      commandDictionary.data.commands = [command];

      await loop.recordImplicitNegative('save file', 'SAVE_FILE');

      expect(command.confidence).toBe(0.8 + CONFIDENCE_ADJUSTMENTS.IMMEDIATE_UNDO);
      expect(commandDictionary.save).toHaveBeenCalled();
      expect(contextWindow.addFeedback).toHaveBeenCalledWith('negative', 'SAVE_FILE');
    });

    it('should remove learned phrase if confidence drops too low', async () => {
      const command = {
        action: 'SAVE_FILE',
        confidence: 0.45,
        source: 'learned'
      };
      commandDictionary.data.commands = [command];

      await loop.recordImplicitNegative('save file', 'SAVE_FILE');

      expect(commandDictionary.forget).toHaveBeenCalledWith('save file');
    });

    it('should not go below REMOVE_LEARNED threshold', async () => {
      const command = {
        action: 'SAVE_FILE',
        confidence: 0.25,
        source: 'default'
      };
      commandDictionary.data.commands = [command];

      await loop.recordImplicitNegative('save file', 'SAVE_FILE');

      expect(command.confidence).toBeGreaterThanOrEqual(THRESHOLDS.REMOVE_LEARNED);
    });
  });

  describe('parseCorrection()', () => {
    it('should detect "no, I meant..." pattern', () => {
      const result = loop.parseCorrection('no, I meant save file');
      expect(result.isCorrection).toBe(true);
      expect(result.intendedPhrase).toBe('save file');
    });

    it('should detect "wrong, I wanted..." pattern', () => {
      const result = loop.parseCorrection('wrong, I wanted to close tab');
      expect(result.isCorrection).toBe(true);
      expect(result.intendedPhrase).toBe('to close tab');
    });

    it('should detect "not that..." pattern', () => {
      const result = loop.parseCorrection('not that, open browser');
      expect(result.isCorrection).toBe(true);
      expect(result.intendedPhrase).toBe('open browser');
    });

    it('should detect "I said..." pattern', () => {
      const result = loop.parseCorrection('i said switch tab');
      expect(result.isCorrection).toBe(true);
      expect(result.intendedPhrase).toBe('switch tab');
    });

    it('should detect "actually..." pattern', () => {
      const result = loop.parseCorrection('actually, close window');
      expect(result.isCorrection).toBe(true);
      expect(result.intendedPhrase).toBe('close window');
    });

    it('should detect simple "no"', () => {
      const result = loop.parseCorrection('no');
      expect(result.isCorrection).toBe(true);
      expect(result.intendedPhrase).toBeNull();
    });

    it('should detect simple "wrong"', () => {
      const result = loop.parseCorrection('wrong');
      expect(result.isCorrection).toBe(true);
      expect(result.intendedPhrase).toBeNull();
    });

    it('should return false for normal speech', () => {
      const result = loop.parseCorrection('save the current file');
      expect(result.isCorrection).toBe(false);
    });

    it('should be case insensitive', () => {
      const result = loop.parseCorrection('NO, I MEANT save file');
      expect(result.isCorrection).toBe(true);
      expect(result.intendedPhrase).toBe('save file');
    });
  });

  describe('handleImmediateUndo()', () => {
    beforeEach(async () => {
      commandDictionary.data.commands = [{
        action: 'SAVE_FILE',
        confidence: 0.8,
        source: 'default'
      }];
      await loop.observeAction('save file', 'SAVE_FILE', 0.95, 1);
    });

    it('should record negative feedback and return to IDLE', async () => {
      await loop.handleImmediateUndo();

      expect(loop.getState()).toBe(LearningState.IDLE);
      expect(loop.correctionContext).toBeNull();
      expect(contextWindow.addFeedback).toHaveBeenCalledWith('negative', 'SAVE_FILE');
    });

    it('should clear observation timer', async () => {
      await loop.handleImmediateUndo();
      expect(loop.observationTimer).toBeNull();
    });

    it('should handle no correction context gracefully', async () => {
      loop.correctionContext = null;
      await expect(loop.handleImmediateUndo()).resolves.not.toThrow();
    });
  });

  describe('handleSpeech()', () => {
    it('should detect and handle immediate undo', async () => {
      commandDictionary.data.commands = [{
        action: 'SAVE_FILE',
        confidence: 0.8,
        source: 'default'
      }];
      await loop.observeAction('save file', 'SAVE_FILE', 0.95, 1);

      const result = await loop.handleSpeech('undo');

      expect(result.isCorrection).toBe(true);
      expect(result.handled).toBe(true);
      expect(loop.getState()).toBe(LearningState.IDLE);
    });

    it('should detect and handle "computer undo"', async () => {
      commandDictionary.data.commands = [{
        action: 'SAVE_FILE',
        confidence: 0.8,
        source: 'default'
      }];
      await loop.observeAction('save file', 'SAVE_FILE', 0.95, 1);

      const result = await loop.handleSpeech('computer undo');

      expect(result.isCorrection).toBe(true);
      expect(result.handled).toBe(true);
    });

    it('should handle correction with intended phrase', async () => {
      commandDictionary.data.commands = [{
        action: 'CLOSE_TAB',
        confidence: 0.8,
        source: 'default'
      }];
      await loop.observeAction('close tab', 'CLOSE_TAB', 0.75, 2);

      const result = await loop.handleSpeech('no, I meant close window');

      expect(result.isCorrection).toBe(true);
      expect(result.handled).toBe(true);
      expect(loop.getState()).toBe(LearningState.AWAITING_CORRECTION);
      expect(mockOnSpeak).toHaveBeenCalled();
    });

    it('should handle simple "no" correction', async () => {
      commandDictionary.data.commands = [{
        action: 'SAVE_FILE',
        confidence: 0.8,
        source: 'default'
      }];
      await loop.observeAction('save file', 'SAVE_FILE', 0.75, 2);

      const result = await loop.handleSpeech('no');

      expect(result.isCorrection).toBe(true);
      expect(result.handled).toBe(true);
      expect(loop.getState()).toBe(LearningState.AWAITING_CORRECTION);
      expect(mockOnSpeak).toHaveBeenCalledWith('What did you mean?');
    });

    it('should return false for normal speech when IDLE', async () => {
      const result = await loop.handleSpeech('save the file');

      expect(result.isCorrection).toBe(false);
      expect(result.handled).toBe(false);
    });

    it('should return false for normal speech when OBSERVING', async () => {
      await loop.observeAction('save file', 'SAVE_FILE', 0.95, 1);

      const result = await loop.handleSpeech('this is a normal phrase');

      expect(result.isCorrection).toBe(false);
      expect(result.handled).toBe(false);
    });
  });

  describe('askForConfirmation()', () => {
    it('should enter AWAITING_CONFIRMATION state', async () => {
      await loop.askForConfirmation('save file', 'SAVE_FILE', 0.65, 'save the current file');

      expect(loop.getState()).toBe(LearningState.AWAITING_CONFIRMATION);
      expect(mockOnSpeak).toHaveBeenCalledWith('Did you mean save the current file?');
    });

    it('should store pending confirmation', async () => {
      await loop.askForConfirmation('save file', 'SAVE_FILE', 0.65, 'save the current file');

      expect(loop.pendingConfirmation).toMatchObject({
        phrase: 'save file',
        suggestedAction: 'SAVE_FILE',
        confidence: 0.65
      });
      expect(loop.pendingConfirmation.timestamp).toBeGreaterThan(0);
    });

    it('should set confirmation timeout', async () => {
      vi.useFakeTimers();

      await loop.askForConfirmation('save file', 'SAVE_FILE', 0.65, 'save the current file');

      vi.advanceTimersByTime(10100); // Past 10 second timeout

      expect(loop.getState()).toBe(LearningState.IDLE);
      expect(loop.pendingConfirmation).toBeNull();

      vi.useRealTimers();
    });
  });

  describe('handleConfirmationResponse()', () => {
    beforeEach(async () => {
      await loop.askForConfirmation('save file', 'SAVE_FILE', 0.65, 'save the current file');
    });

    it('should handle affirmative response', async () => {
      const result = await loop.handleSpeech('yes');

      expect(result.handled).toBe(true);
      expect(mockOnExecute).toHaveBeenCalledWith('SAVE_FILE');
      expect(commandDictionary.learn).toHaveBeenCalledWith('save file', 'SAVE_FILE', 'confirmed');
      expect(loop.getState()).toBe(LearningState.IDLE);
      expect(mockOnSpeak).toHaveBeenCalledWith('Got it.');
    });

    it('should handle "yeah" as affirmative', async () => {
      const result = await loop.handleSpeech('yeah');
      expect(result.handled).toBe(true);
      expect(mockOnExecute).toHaveBeenCalledWith('SAVE_FILE');
    });

    it('should handle "correct" as affirmative', async () => {
      const result = await loop.handleSpeech('correct');
      expect(result.handled).toBe(true);
      expect(mockOnExecute).toHaveBeenCalled();
    });

    it('should handle negative response', async () => {
      const result = await loop.handleSpeech('no');

      expect(result.handled).toBe(true);
      expect(loop.getState()).toBe(LearningState.AWAITING_CORRECTION);
      expect(mockOnSpeak).toHaveBeenCalledWith('What did you mean?');
    });

    it('should boost confidence on affirmative', async () => {
      commandDictionary.data.commands = [{
        action: 'SAVE_FILE',
        confidence: 0.65
      }];

      await loop.handleSpeech('yes');

      const cmd = commandDictionary.data.commands[0];
      expect(cmd.confidence).toBeGreaterThan(0.65);
      expect(commandDictionary.save).toHaveBeenCalled();
    });

    it('should decrease confidence on negative', async () => {
      commandDictionary.data.commands = [{
        action: 'SAVE_FILE',
        confidence: 0.65
      }];

      await loop.handleSpeech('no');

      const cmd = commandDictionary.data.commands[0];
      expect(cmd.confidence).toBeLessThan(0.65);
    });

    it('should clear confirmation timer on response', async () => {
      await loop.handleSpeech('yes');
      expect(loop.confirmationTimer).toBeNull();
    });
  });

  describe('handleCorrectionDetails()', () => {
    beforeEach(() => {
      loop.correctionContext = {
        phrase: 'save file',
        action: 'CLOSE_TAB'
      };
      loop.setState(LearningState.AWAITING_CORRECTION);
    });

    it('should handle correction and reset to IDLE', async () => {
      const result = await loop.handleSpeech('open browser');

      expect(result.handled).toBe(true);
      expect(loop.getState()).toBe(LearningState.IDLE);
      expect(loop.correctionContext).toBeNull();
      expect(mockOnSpeak).toHaveBeenCalledWith("I'll remember that.");
    });

    it('should handle no correction context gracefully', async () => {
      loop.correctionContext = null;

      const result = await loop.handleSpeech('anything');

      expect(result.handled).toBe(false);
      expect(loop.getState()).toBe(LearningState.IDLE);
    });
  });

  describe('Confidence Thresholds', () => {
    it('shouldExecuteImmediately() for high confidence', () => {
      expect(loop.shouldExecuteImmediately(0.95)).toBe(true);
      expect(loop.shouldExecuteImmediately(0.7)).toBe(true);
      expect(loop.shouldExecuteImmediately(0.65)).toBe(false);
    });

    it('shouldAskConfirmation() for medium confidence', () => {
      expect(loop.shouldAskConfirmation(0.65)).toBe(true);
      expect(loop.shouldAskConfirmation(0.5)).toBe(true);
      expect(loop.shouldAskConfirmation(0.75)).toBe(false);
      expect(loop.shouldAskConfirmation(0.4)).toBe(false);
    });
  });

  describe('Helper Methods', () => {
    it('looksLikeCorrection() should detect corrections', () => {
      expect(loop.looksLikeCorrection('no, I meant save')).toBe(true);
      expect(loop.looksLikeCorrection('wrong')).toBe(true);
      expect(loop.looksLikeCorrection('save file')).toBe(false);
    });

    it('isAffirmative() should detect affirmatives', () => {
      expect(loop.isAffirmative('yes')).toBe(true);
      expect(loop.isAffirmative('yeah')).toBe(true);
      expect(loop.isAffirmative('correct')).toBe(true);
      expect(loop.isAffirmative('no')).toBe(false);
    });

    it('isNegative() should detect negatives', () => {
      expect(loop.isNegative('no')).toBe(true);
      expect(loop.isNegative('wrong')).toBe(true);
      expect(loop.isNegative('nope')).toBe(true);
      expect(loop.isNegative('yes')).toBe(false);
    });
  });

  describe('reset()', () => {
    it('should clear all timers and reset state', async () => {
      await loop.observeAction('save file', 'SAVE_FILE', 0.95, 1);
      await loop.askForConfirmation('open browser', 'OPEN_BROWSER', 0.65, 'open browser');

      loop.reset();

      expect(loop.getState()).toBe(LearningState.IDLE);
      expect(loop.observationTimer).toBeNull();
      expect(loop.confirmationTimer).toBeNull();
      expect(loop.pendingConfirmation).toBeNull();
      expect(loop.correctionContext).toBeNull();
    });
  });

  describe('cleanupUnused()', () => {
    it('should remove unused learned commands after 30 days', async () => {
      const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();

      commandDictionary.data.commands = [
        {
          action: 'OLD_COMMAND',
          confidence: 0.34, // After decay (-0.05), becomes 0.29 < 0.3 threshold
          source: 'learned',
          last_used: thirtyOneDaysAgo
        },
        {
          action: 'RECENT_COMMAND',
          confidence: 0.6,
          source: 'learned',
          last_used: new Date().toISOString()
        }
      ];

      const removed = await loop.cleanupUnused();

      expect(removed).toBeGreaterThan(0);
      expect(commandDictionary.data.commands).toHaveLength(1);
      expect(commandDictionary.data.commands[0].action).toBe('RECENT_COMMAND');
    });

    it('should decay confidence for unused commands', async () => {
      const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();

      commandDictionary.data.commands = [{
        action: 'OLD_COMMAND',
        confidence: 0.7,
        source: 'learned',
        last_used: thirtyOneDaysAgo
      }];

      await loop.cleanupUnused();

      const cmd = commandDictionary.data.commands.find(c => c.action === 'OLD_COMMAND');
      expect(cmd.confidence).toBeLessThan(0.7);
    });

    it('should not remove default commands', async () => {
      const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();

      commandDictionary.data.commands = [{
        action: 'DEFAULT_COMMAND',
        confidence: 0.2,
        source: 'default',
        last_used: thirtyOneDaysAgo
      }];

      await loop.cleanupUnused();

      expect(commandDictionary.data.commands).toHaveLength(1);
    });

    it('should rebuild indexes after cleanup', async () => {
      const thirtyOneDaysAgo = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();

      commandDictionary.data.commands = [{
        action: 'OLD_COMMAND',
        confidence: 0.3,
        source: 'learned',
        last_used: thirtyOneDaysAgo
      }];

      await loop.cleanupUnused();

      expect(commandDictionary.buildIndexes).toHaveBeenCalled();
    });

    it('should return 0 when nothing removed', async () => {
      commandDictionary.data.commands = [];

      const removed = await loop.cleanupUnused();

      expect(removed).toBe(0);
      expect(commandDictionary.save).not.toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle callbacks being null', async () => {
      loop.onSpeak = null;
      loop.onExecute = null;

      await expect(loop.askForConfirmation('test', 'TEST', 0.6, 'test action')).resolves.not.toThrow();
    });

    it('should handle empty text in parseCorrection', () => {
      const result = loop.parseCorrection('');
      expect(result.isCorrection).toBe(false);
    });

    it('should handle whitespace-only text', () => {
      const result = loop.parseCorrection('   ');
      expect(result.isCorrection).toBe(false);
    });

    it('should handle case variations in affirmative/negative', () => {
      expect(loop.isAffirmative('YES')).toBe(true);
      expect(loop.isAffirmative('YeAh')).toBe(true);
      expect(loop.isNegative('NO')).toBe(true);
      expect(loop.isNegative('NOPE')).toBe(true);
    });
  });

  describe('Integration Flows', () => {
    it('should handle full correction flow', async () => {
      commandDictionary.data.commands = [{
        action: 'CLOSE_TAB',
        confidence: 0.75,
        source: 'default'
      }];

      // Step 1: Execute action
      await loop.observeAction('close tab', 'CLOSE_TAB', 0.75, 2);
      expect(loop.getState()).toBe(LearningState.OBSERVING);

      // Step 2: User corrects
      await loop.handleSpeech('no, I meant close window');
      expect(loop.getState()).toBe(LearningState.AWAITING_CORRECTION);
      expect(contextWindow.addFeedback).toHaveBeenCalledWith('negative', 'CLOSE_TAB');

      // Step 3: Provide correction details
      await loop.handleSpeech('close all windows');
      expect(loop.getState()).toBe(LearningState.IDLE);
    });

    it('should handle full confirmation flow - accepted', async () => {
      commandDictionary.data.commands = [{
        action: 'SAVE_FILE',
        confidence: 0.65
      }];

      // Step 1: Ask for confirmation
      await loop.askForConfirmation('save file', 'SAVE_FILE', 0.65, 'save the current file');
      expect(loop.getState()).toBe(LearningState.AWAITING_CONFIRMATION);

      // Step 2: User confirms
      await loop.handleSpeech('yes');
      expect(loop.getState()).toBe(LearningState.IDLE);
      expect(mockOnExecute).toHaveBeenCalledWith('SAVE_FILE');
      expect(commandDictionary.learn).toHaveBeenCalled();
    });

    it('should handle full confirmation flow - rejected', async () => {
      commandDictionary.data.commands = [{
        action: 'SAVE_FILE',
        confidence: 0.65
      }];

      // Step 1: Ask for confirmation
      await loop.askForConfirmation('save file', 'SAVE_FILE', 0.65, 'save the current file');

      // Step 2: User rejects
      await loop.handleSpeech('no');
      expect(loop.getState()).toBe(LearningState.AWAITING_CORRECTION);

      // Step 3: Provide what they meant
      await loop.handleSpeech('open file');
      expect(loop.getState()).toBe(LearningState.IDLE);
    });
  });
});
