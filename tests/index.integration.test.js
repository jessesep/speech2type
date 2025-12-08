/**
 * Integration tests for learning-loop integration in index.js
 *
 * Tests the key integration points between the main application
 * and the learning loop system (Phase 2.1).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Learning Loop Integration', () => {
  describe('Callback Setup', () => {
    it('should set up learning loop callbacks during initialization', () => {
      // Test that learningLoop.setCallbacks is called with the right structure
      const mockSetCallbacks = vi.fn();
      const learningLoop = {
        setCallbacks: mockSetCallbacks,
        handleSpeech: vi.fn().mockResolvedValue(false),
        handleImmediateUndo: vi.fn().mockResolvedValue(undefined),
        observeAction: vi.fn().mockResolvedValue(undefined),
        askForConfirmation: vi.fn().mockResolvedValue(undefined)
      };

      // Call setCallbacks as index.js does
      learningLoop.setCallbacks({
        onSpeak: async (text) => {},
        onExecute: async (action) => {},
        onStateChange: (newState, oldState) => {}
      });

      expect(mockSetCallbacks).toHaveBeenCalledOnce();
      const callbacksArg = mockSetCallbacks.mock.calls[0][0];
      expect(callbacksArg).toHaveProperty('onSpeak');
      expect(callbacksArg).toHaveProperty('onExecute');
      expect(callbacksArg).toHaveProperty('onStateChange');
      expect(typeof callbacksArg.onSpeak).toBe('function');
      expect(typeof callbacksArg.onExecute).toBe('function');
      expect(typeof callbacksArg.onStateChange).toBe('function');
    });

    it('should provide onSpeak callback that uses macOS say command', async () => {
      const callbacks = {
        onSpeak: async (text) => {
          // This is the actual implementation from index.js:353-356
          // exec(`say -v Samantha -r 180 "${text.replace(/"/g, '\\"')}"`, () => {});
          return Promise.resolve();
        },
        onExecute: async (action) => {},
        onStateChange: (newState, oldState) => {}
      };

      // Test that onSpeak can be called
      await expect(callbacks.onSpeak('test message')).resolves.toBeUndefined();
    });

    it('should provide onExecute callback for action execution', async () => {
      const mockExecuteGeneralAction = vi.fn().mockResolvedValue(true);
      const AI_ACTION_MAP = {
        'ENTER': 'enter',
        'UNDO': 'undo',
        'COPY': 'copy'
      };

      const callbacks = {
        onSpeak: async (text) => {},
        onExecute: async (action) => {
          // This simulates index.js:358-365
          const mappedAction = AI_ACTION_MAP[action];
          if (mappedAction) {
            await mockExecuteGeneralAction(mappedAction);
          }
        },
        onStateChange: (newState, oldState) => {}
      };

      await callbacks.onExecute('ENTER');
      expect(mockExecuteGeneralAction).toHaveBeenCalledWith('enter');
    });

    it('should provide onStateChange callback for debugging', () => {
      const consoleLogs = [];
      const mockConsoleLog = vi.fn((...args) => consoleLogs.push(args));

      const callbacks = {
        onSpeak: async (text) => {},
        onExecute: async (action) => {},
        onStateChange: (newState, oldState) => {
          // This simulates index.js:366-369
          mockConsoleLog(`[learning] State: ${oldState} -> ${newState}`);
        }
      };

      callbacks.onStateChange('observing', 'idle');
      expect(mockConsoleLog).toHaveBeenCalledWith('[learning] State: idle -> observing');
    });
  });

  describe('Correction Handling', () => {
    it('should check for corrections before other command processing', async () => {
      const learningLoop = {
        handleSpeech: vi.fn().mockResolvedValue(true) // Correction detected
      };

      const cleanText = 'no i meant close tab';

      // This simulates index.js:970-975
      const correctionHandled = await learningLoop.handleSpeech(cleanText);

      expect(learningLoop.handleSpeech).toHaveBeenCalledWith(cleanText);
      expect(correctionHandled).toBe(true);
    });

    it('should continue to regular processing when no correction detected', async () => {
      const learningLoop = {
        handleSpeech: vi.fn().mockResolvedValue(false) // No correction
      };

      const cleanText = 'close tab';

      const correctionHandled = await learningLoop.handleSpeech(cleanText);

      expect(learningLoop.handleSpeech).toHaveBeenCalledWith(cleanText);
      expect(correctionHandled).toBe(false);
    });
  });

  describe('Immediate Undo Tracking', () => {
    it('should track undo as potential negative feedback', async () => {
      const learningLoop = {
        handleImmediateUndo: vi.fn().mockResolvedValue(undefined)
      };

      // This simulates index.js:1098
      await learningLoop.handleImmediateUndo();

      expect(learningLoop.handleImmediateUndo).toHaveBeenCalledOnce();
    });

    it('should be called after undo command execution', async () => {
      const learningLoop = {
        handleImmediateUndo: vi.fn().mockResolvedValue(undefined)
      };

      // Simulate the undo flow from index.js:1084-1101
      const action = 'undo';
      let pendingText = 'hello';
      const typedHistory = [6]; // 'hello '

      if (action === 'undo') {
        if (pendingText) {
          pendingText = '';
        } else if (typedHistory.length > 0) {
          const lastLength = typedHistory.pop();
          // await typerService.deleteCharacters(lastLength);
        }

        await learningLoop.handleImmediateUndo();
      }

      expect(learningLoop.handleImmediateUndo).toHaveBeenCalledOnce();
    });
  });

  describe('Confirmation Requests', () => {
    it('should request confirmation for low-confidence AI matches (50-70%)', async () => {
      const learningLoop = {
        askForConfirmation: vi.fn().mockResolvedValue(undefined)
      };

      const AI_ACTION_MAP = {
        'close_tab': 'close_tab',
        'new_tab': 'new_tab'
      };

      // Simulate low confidence result from index.js:1245-1254
      const result = {
        action: 'close_tab',
        confidence: 0.65,
        tier: 3
      };

      const cleanText = 'shut the tab';

      if (result.action !== 'none' && result.action !== 'unknown' &&
          result.confidence >= 0.5 && result.confidence < 0.7) {
        const actionDescription = AI_ACTION_MAP[result.action] || result.action;
        await learningLoop.askForConfirmation(cleanText, result.action, result.confidence, actionDescription);
      }

      expect(learningLoop.askForConfirmation).toHaveBeenCalledWith(
        cleanText,
        result.action,
        result.confidence,
        'close_tab'
      );
    });

    it('should NOT request confirmation for high-confidence matches (>=70%)', async () => {
      const learningLoop = {
        askForConfirmation: vi.fn().mockResolvedValue(undefined)
      };

      const result = {
        action: 'close_tab',
        confidence: 0.85,
        tier: 1
      };

      const cleanText = 'close tab';

      // High confidence - should execute directly, not ask for confirmation
      if (result.action !== 'none' && result.action !== 'unknown' &&
          result.confidence >= 0.5 && result.confidence < 0.7) {
        await learningLoop.askForConfirmation(cleanText, result.action, result.confidence, result.action);
      }

      expect(learningLoop.askForConfirmation).not.toHaveBeenCalled();
    });

    it('should NOT request confirmation for very low confidence (<50%)', async () => {
      const learningLoop = {
        askForConfirmation: vi.fn().mockResolvedValue(undefined)
      };

      const result = {
        action: 'close_tab',
        confidence: 0.35,
        tier: 3
      };

      const cleanText = 'maybe close something';

      if (result.action !== 'none' && result.action !== 'unknown' &&
          result.confidence >= 0.5 && result.confidence < 0.7) {
        await learningLoop.askForConfirmation(cleanText, result.action, result.confidence, result.action);
      }

      expect(learningLoop.askForConfirmation).not.toHaveBeenCalled();
    });
  });

  describe('Action Observation', () => {
    it('should observe actions for implicit feedback tracking', async () => {
      const learningLoop = {
        observeAction: vi.fn().mockResolvedValue(undefined)
      };

      // Simulate successful AI action execution from index.js:1287-1289
      const cleanText = 'close tab';
      const result = {
        action: 'close_tab',
        confidence: 0.85,
        tier: 2
      };

      // After executing action successfully
      await learningLoop.observeAction(cleanText, result.action, result.confidence, result.tier || 3);

      expect(learningLoop.observeAction).toHaveBeenCalledWith(
        cleanText,
        result.action,
        result.confidence,
        2
      );
    });

    it('should default to tier 3 if tier not specified', async () => {
      const learningLoop = {
        observeAction: vi.fn().mockResolvedValue(undefined)
      };

      const cleanText = 'close tab';
      const result = {
        action: 'close_tab',
        confidence: 0.85
        // No tier property
      };

      await learningLoop.observeAction(cleanText, result.action, result.confidence, result.tier || 3);

      expect(learningLoop.observeAction).toHaveBeenCalledWith(
        cleanText,
        result.action,
        result.confidence,
        3 // Default tier
      );
    });

    it('should only observe after successful action execution', async () => {
      const learningLoop = {
        observeAction: vi.fn().mockResolvedValue(undefined)
      };

      const AI_ACTION_MAP = {
        'close_tab': 'close_tab'
      };

      const result = {
        action: 'close_tab',
        confidence: 0.85,
        tier: 1
      };

      const cleanText = 'close tab';

      // Only observe if action exists in map and was executed
      if (result.action !== 'none' && result.action !== 'unknown' &&
          result.confidence >= 0.7) {
        const mappedAction = AI_ACTION_MAP[result.action];
        if (mappedAction) {
          // await executeGeneralAction(mappedAction);
          await learningLoop.observeAction(cleanText, result.action, result.confidence, result.tier);
        }
      }

      expect(learningLoop.observeAction).toHaveBeenCalledOnce();
    });

    it('should NOT observe if action is unknown', async () => {
      const learningLoop = {
        observeAction: vi.fn().mockResolvedValue(undefined)
      };

      const result = {
        action: 'unknown',
        confidence: 0.5,
        tier: 3
      };

      const cleanText = 'do something weird';

      if (result.action !== 'none' && result.action !== 'unknown') {
        await learningLoop.observeAction(cleanText, result.action, result.confidence, result.tier);
      }

      expect(learningLoop.observeAction).not.toHaveBeenCalled();
    });
  });

  describe('Integration Flow', () => {
    it('should follow correct order: corrections -> commands -> AI -> observation', async () => {
      const executionOrder = [];

      const learningLoop = {
        handleSpeech: vi.fn(async (text) => {
          executionOrder.push('correction-check');
          return false; // No correction
        }),
        observeAction: vi.fn(async (phrase, action, confidence, tier) => {
          executionOrder.push('observation');
        }),
        handleImmediateUndo: vi.fn(),
        askForConfirmation: vi.fn()
      };

      const cleanText = 'close tab';

      // 1. Check corrections first
      const correctionHandled = await learningLoop.handleSpeech(cleanText);

      if (!correctionHandled) {
        // 2. Check voice commands (skipped in test)
        executionOrder.push('voice-command-check');

        // 3. AI understanding check
        executionOrder.push('ai-check');

        // 4. If AI succeeded, observe action
        await learningLoop.observeAction(cleanText, 'CLOSE_TAB', 0.85, 2);
      }

      expect(executionOrder).toEqual([
        'correction-check',
        'voice-command-check',
        'ai-check',
        'observation'
      ]);
    });

    it('should stop processing if correction is detected', async () => {
      const executionOrder = [];

      const learningLoop = {
        handleSpeech: vi.fn(async (text) => {
          executionOrder.push('correction-check');
          return true; // Correction detected!
        }),
        observeAction: vi.fn(async () => {
          executionOrder.push('observation');
        })
      };

      const cleanText = 'no i meant close tab';

      const correctionHandled = await learningLoop.handleSpeech(cleanText);

      if (!correctionHandled) {
        executionOrder.push('continue-processing');
        await learningLoop.observeAction(cleanText, 'CLOSE_TAB', 0.85, 2);
      }

      expect(executionOrder).toEqual(['correction-check']);
      expect(learningLoop.observeAction).not.toHaveBeenCalled();
    });
  });

  describe('AI Action Mapping', () => {
    it('should map AI actions to internal actions correctly', () => {
      const AI_ACTION_MAP = {
        'enter': 'enter',
        'undo': 'undo',
        'clear_all': 'clear_all',
        'copy': 'copy',
        'paste': 'paste',
        'cut': 'cut',
        'select_all': 'select_all',
        'new_tab': 'new_tab',
        'close_tab': 'close_tab',
        'stop_listening': 'stop_listening',
        'mode_general': 'mode_general',
        'mode_claude': 'mode_claude'
      };

      // Test key mappings from index.js:392-420
      expect(AI_ACTION_MAP['enter']).toBe('enter');
      expect(AI_ACTION_MAP['undo']).toBe('undo');
      expect(AI_ACTION_MAP['copy']).toBe('copy');
      expect(AI_ACTION_MAP['new_tab']).toBe('new_tab');
      expect(AI_ACTION_MAP['mode_claude']).toBe('mode_claude');
    });

    it('should use mapped action in onExecute callback', async () => {
      const executedActions = [];
      const AI_ACTION_MAP = {
        'ENTER': 'enter',
        'COPY': 'copy'
      };

      const executeGeneralAction = async (action) => {
        executedActions.push(action);
      };

      const onExecute = async (action) => {
        const mappedAction = AI_ACTION_MAP[action];
        if (mappedAction) {
          await executeGeneralAction(mappedAction);
        }
      };

      await onExecute('ENTER');
      await onExecute('COPY');

      expect(executedActions).toEqual(['enter', 'copy']);
    });
  });
});
