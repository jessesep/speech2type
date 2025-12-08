/**
 * Learning Loop Service (Phase 2.1)
 *
 * The core mechanism that makes ONE smarter over time by:
 * - Tracking implicit feedback (no correction = success)
 * - Detecting and handling corrections
 * - Adjusting confidence based on usage
 * - Managing confirmation flow for uncertain matches
 */

import { commandDictionary } from './commands.js';
import { contextWindow } from './context-window.js';

/**
 * Correction detection patterns
 * Match phrases like "no, I meant...", "wrong, I wanted...", etc.
 */
const CORRECTION_PATTERNS = [
  /^no[,.]?\s+(?:i\s+)?(?:meant?|want(?:ed)?)\s+(.+)/i,
  /^(?:that's\s+)?wrong[,.]?\s+(?:i\s+)?(?:meant?|want(?:ed)?)\s+(.+)/i,
  /^not\s+that[,.]?\s+(.+)/i,
  /^i\s+said\s+(.+)/i,
  /^(?:actually|instead)[,.]?\s+(.+)/i
];

/**
 * Simple negative responses (need to ask what they meant)
 */
const SIMPLE_NEGATIVE = /^(no|nope|wrong|that's wrong|not that|nah)$/i;

/**
 * Affirmative responses
 */
const AFFIRMATIVE = /^(yes|yeah|yep|correct|right|affirmative|confirm|that's right|exactly)$/i;

/**
 * Confidence adjustments for various events
 */
const CONFIDENCE_ADJUSTMENTS = {
  IMPLICIT_POSITIVE: 0.02,      // Used successfully, no correction
  EXPLICIT_POSITIVE: 0.1,       // User said "yes" to confirmation
  EXPLICIT_NEGATIVE: -0.15,     // User said "no" to confirmation
  IMMEDIATE_UNDO: -0.1,         // Undo/retract right after
  CORRECTION_WRONG: -0.2,       // Phrase was wrong
  CORRECTION_RIGHT: 0.85,       // Initial confidence for corrected mapping
  UNUSED_DECAY: -0.05           // Not used for 30 days
};

/**
 * Confidence thresholds
 */
const THRESHOLDS = {
  EXECUTE_IMMEDIATE: 0.9,       // Execute without confirmation
  EXECUTE_OBSERVE: 0.7,         // Execute but listen for correction
  ASK_CONFIRMATION: 0.5,        // Ask for confirmation first
  TOO_LOW: 0.5,                 // Don't suggest, use Tier 3
  REMOVE_LEARNED: 0.3           // Remove learned phrase if drops below
};

/**
 * Time windows
 */
const TIME_WINDOWS = {
  IMPLICIT_FEEDBACK_MS: 5000,   // 5 seconds for implicit positive
  CORRECTION_WINDOW_MS: 3000,   // 3 seconds to detect immediate correction
  CONFIRMATION_TIMEOUT_MS: 10000 // 10 seconds to respond to confirmation
};

/**
 * Learning Loop state
 */
const LearningState = {
  IDLE: 'idle',
  OBSERVING: 'observing',           // After action, watching for correction
  AWAITING_CONFIRMATION: 'awaiting_confirmation',
  AWAITING_CORRECTION: 'awaiting_correction'
};

/**
 * LearningLoop class
 * Manages the feedback loop for continuous learning
 */
export class LearningLoop {
  constructor() {
    this.state = LearningState.IDLE;
    this.pendingConfirmation = null;
    this.correctionContext = null;
    this.observationTimer = null;
    this.confirmationTimer = null;

    // Callbacks for speaking/feedback
    this.onSpeak = null;           // Function to speak text
    this.onExecute = null;         // Function to execute action
    this.onStateChange = null;     // Function called on state change
  }

  /**
   * Set callbacks for integration
   */
  setCallbacks({ onSpeak, onExecute, onStateChange }) {
    this.onSpeak = onSpeak;
    this.onExecute = onExecute;
    this.onStateChange = onStateChange;
  }

  /**
   * Get current state
   */
  getState() {
    return this.state;
  }

  /**
   * Change state and notify
   */
  setState(newState) {
    const oldState = this.state;
    this.state = newState;
    console.log(`[LearningLoop] State: ${oldState} -> ${newState}`);
    if (this.onStateChange) {
      this.onStateChange(newState, oldState);
    }
  }

  /**
   * Record and observe an action execution
   * Start observation window for implicit feedback
   * @param {string} phrase - What user said
   * @param {string} action - Action that was executed
   * @param {number} confidence - Confidence level
   * @param {number} tier - Resolution tier (1, 2, or 3)
   */
  async observeAction(phrase, action, confidence, tier) {
    // Add to context
    contextWindow.addSpeech(phrase);
    contextWindow.addAction(action, confidence, tier);

    // Clear any existing observation timer
    if (this.observationTimer) {
      clearTimeout(this.observationTimer);
    }

    // Store for potential correction
    this.correctionContext = {
      phrase,
      action,
      confidence,
      tier,
      timestamp: Date.now()
    };

    // Enter observation state
    this.setState(LearningState.OBSERVING);

    // Set timer for implicit positive feedback
    this.observationTimer = setTimeout(() => {
      if (this.state === LearningState.OBSERVING) {
        this.recordImplicitPositive(phrase, action);
        this.setState(LearningState.IDLE);
        this.correctionContext = null;
      }
    }, TIME_WINDOWS.IMPLICIT_FEEDBACK_MS);
  }

  /**
   * Record implicit positive feedback (no correction within time window)
   * @param {string} phrase - Original phrase
   * @param {string} action - Action that was executed
   */
  async recordImplicitPositive(phrase, action) {
    const cmd = commandDictionary.data.commands.find(c => c.action === action);
    if (cmd) {
      cmd.confidence = Math.min(1.0, cmd.confidence + CONFIDENCE_ADJUSTMENTS.IMPLICIT_POSITIVE);
      cmd.use_count = (cmd.use_count || 0) + 1;
      cmd.last_used = new Date().toISOString();
      await commandDictionary.save();
      console.log(`[LearningLoop] Implicit positive: "${phrase}" -> ${action} (conf: ${cmd.confidence.toFixed(2)})`);
    }

    // Record in context
    contextWindow.addFeedback('positive', action);
  }

  /**
   * Record implicit negative feedback (immediate undo/correction)
   * @param {string} phrase - Original phrase
   * @param {string} action - Action that was wrong
   */
  async recordImplicitNegative(phrase, action) {
    const cmd = commandDictionary.data.commands.find(c => c.action === action);
    if (cmd) {
      cmd.confidence = Math.max(THRESHOLDS.REMOVE_LEARNED, cmd.confidence + CONFIDENCE_ADJUSTMENTS.IMMEDIATE_UNDO);

      // If learned phrase confidence drops too low, remove it
      if (cmd.source === 'learned' && cmd.confidence < THRESHOLDS.TOO_LOW) {
        await commandDictionary.forget(phrase);
        console.log(`[LearningLoop] Removed low-confidence learned phrase: "${phrase}"`);
      } else {
        await commandDictionary.save();
      }
      console.log(`[LearningLoop] Implicit negative: "${phrase}" -> ${action} (conf: ${cmd.confidence.toFixed(2)})`);
    }

    // Record in context
    contextWindow.addFeedback('negative', action);
  }

  /**
   * Handle incoming speech - check for corrections
   * @param {string} text - What user just said
   * @returns {Object} - { isCorrection: boolean, handled: boolean, intendedPhrase?: string }
   */
  async handleSpeech(text) {
    const trimmed = text.trim().toLowerCase();

    // Check if we're awaiting confirmation
    if (this.state === LearningState.AWAITING_CONFIRMATION) {
      return await this.handleConfirmationResponse(trimmed);
    }

    // Check if we're awaiting correction details
    if (this.state === LearningState.AWAITING_CORRECTION) {
      return await this.handleCorrectionDetails(trimmed);
    }

    // Check if we're observing and this is a correction
    if (this.state === LearningState.OBSERVING) {
      // Check for immediate undo
      if (/^(undo|retract|oops)$/i.test(trimmed) || /^computer\s+(undo|retract)$/i.test(trimmed)) {
        await this.handleImmediateUndo();
        return { isCorrection: true, handled: true };
      }

      // Check for correction patterns
      const correction = this.parseCorrection(trimmed);
      if (correction.isCorrection) {
        return await this.handleCorrection(correction);
      }
    }

    return { isCorrection: false, handled: false };
  }

  /**
   * Handle immediate undo after action
   */
  async handleImmediateUndo() {
    if (!this.correctionContext) return;

    // Clear observation timer
    if (this.observationTimer) {
      clearTimeout(this.observationTimer);
      this.observationTimer = null;
    }

    const { phrase, action } = this.correctionContext;
    await this.recordImplicitNegative(phrase, action);

    this.setState(LearningState.IDLE);
    this.correctionContext = null;
    console.log(`[LearningLoop] Immediate undo detected for: "${phrase}" -> ${action}`);
  }

  /**
   * Parse text to check if it's a correction
   * @param {string} text
   * @returns {{ isCorrection: boolean, intendedPhrase?: string }}
   */
  parseCorrection(text) {
    // Check for correction patterns
    for (const pattern of CORRECTION_PATTERNS) {
      const match = text.match(pattern);
      if (match) {
        return {
          isCorrection: true,
          intendedPhrase: match[1].trim()
        };
      }
    }

    // Check for simple negative
    if (SIMPLE_NEGATIVE.test(text.trim())) {
      return {
        isCorrection: true,
        intendedPhrase: null  // Need to ask what they meant
      };
    }

    return { isCorrection: false };
  }

  /**
   * Handle a detected correction
   * @param {{ isCorrection: boolean, intendedPhrase?: string }} correction
   */
  async handleCorrection(correction) {
    if (!this.correctionContext) {
      return { isCorrection: true, handled: false };
    }

    // Clear observation timer
    if (this.observationTimer) {
      clearTimeout(this.observationTimer);
      this.observationTimer = null;
    }

    const { phrase, action } = this.correctionContext;

    // Record negative feedback on wrong action
    await this.recordImplicitNegative(phrase, action);

    if (correction.intendedPhrase) {
      // User told us what they meant - try to resolve it
      contextWindow.addCorrection(phrase, action, correction.intendedPhrase);

      // TODO: Resolve the intended phrase to an action
      // For now, just record and speak
      if (this.onSpeak) {
        await this.onSpeak(`Got it. What action should "${phrase}" perform?`);
      }
      this.setState(LearningState.AWAITING_CORRECTION);
      return { isCorrection: true, handled: true };
    } else {
      // Simple "no" - ask what they meant
      if (this.onSpeak) {
        await this.onSpeak("What did you mean?");
      }
      this.setState(LearningState.AWAITING_CORRECTION);
      return { isCorrection: true, handled: true };
    }
  }

  /**
   * Handle response during confirmation flow
   * @param {string} response
   */
  async handleConfirmationResponse(response) {
    if (!this.pendingConfirmation) {
      this.setState(LearningState.IDLE);
      return { isCorrection: false, handled: false };
    }

    // Clear confirmation timer
    if (this.confirmationTimer) {
      clearTimeout(this.confirmationTimer);
      this.confirmationTimer = null;
    }

    const { phrase, suggestedAction } = this.pendingConfirmation;

    if (AFFIRMATIVE.test(response)) {
      // User confirmed - execute and learn
      if (this.onExecute) {
        await this.onExecute(suggestedAction);
      }
      await commandDictionary.learn(phrase, suggestedAction, 'confirmed');

      // Boost confidence
      const cmd = commandDictionary.data.commands.find(c => c.action === suggestedAction);
      if (cmd) {
        cmd.confidence = Math.min(1.0, cmd.confidence + CONFIDENCE_ADJUSTMENTS.EXPLICIT_POSITIVE);
        await commandDictionary.save();
      }

      contextWindow.addConfirmation(suggestedAction, true);
      if (this.onSpeak) {
        await this.onSpeak("Got it.");
      }
      this.setState(LearningState.IDLE);
      this.pendingConfirmation = null;
      return { isCorrection: false, handled: true };
    }

    if (SIMPLE_NEGATIVE.test(response)) {
      // User rejected
      contextWindow.addConfirmation(suggestedAction, false);

      // Decrease confidence
      const cmd = commandDictionary.data.commands.find(c => c.action === suggestedAction);
      if (cmd) {
        cmd.confidence = Math.max(THRESHOLDS.REMOVE_LEARNED, cmd.confidence + CONFIDENCE_ADJUSTMENTS.EXPLICIT_NEGATIVE);
        await commandDictionary.save();
      }

      // Ask what they meant
      if (this.onSpeak) {
        await this.onSpeak("What did you mean?");
      }
      this.correctionContext = { phrase, action: suggestedAction };
      this.setState(LearningState.AWAITING_CORRECTION);
      this.pendingConfirmation = null;
      return { isCorrection: true, handled: true };
    }

    // Response might be the intended action itself
    // Treat it as a correction
    this.correctionContext = { phrase, action: suggestedAction };
    return await this.handleCorrectionDetails(response);
  }

  /**
   * Handle correction details (what user actually wanted)
   * @param {string} response
   */
  async handleCorrectionDetails(response) {
    if (!this.correctionContext) {
      this.setState(LearningState.IDLE);
      return { isCorrection: false, handled: false };
    }

    const { phrase, action: wrongAction } = this.correctionContext;

    // TODO: Resolve the response to an action
    // For now, just log and reset
    console.log(`[LearningLoop] Correction: "${phrase}" was ${wrongAction}, user said "${response}"`);

    if (this.onSpeak) {
      await this.onSpeak(`I'll remember that.`);
    }

    this.setState(LearningState.IDLE);
    this.correctionContext = null;
    return { isCorrection: true, handled: true };
  }

  /**
   * Start confirmation flow for medium-confidence match
   * @param {string} phrase - What user said
   * @param {string} suggestedAction - Our best guess
   * @param {number} confidence - Confidence level
   * @param {string} actionDescription - Human-readable description
   */
  async askForConfirmation(phrase, suggestedAction, confidence, actionDescription) {
    this.pendingConfirmation = {
      phrase,
      suggestedAction,
      confidence,
      timestamp: Date.now()
    };

    this.setState(LearningState.AWAITING_CONFIRMATION);

    // Speak the confirmation request
    if (this.onSpeak) {
      await this.onSpeak(`Did you mean ${actionDescription}?`);
    }

    // Set timeout
    this.confirmationTimer = setTimeout(() => {
      if (this.state === LearningState.AWAITING_CONFIRMATION) {
        console.log('[LearningLoop] Confirmation timeout');
        this.setState(LearningState.IDLE);
        this.pendingConfirmation = null;
      }
    }, TIME_WINDOWS.CONFIRMATION_TIMEOUT_MS);
  }

  /**
   * Should we ask for confirmation based on confidence?
   * @param {number} confidence
   * @returns {boolean}
   */
  shouldAskConfirmation(confidence) {
    return confidence >= THRESHOLDS.ASK_CONFIRMATION && confidence < THRESHOLDS.EXECUTE_OBSERVE;
  }

  /**
   * Should we execute immediately without confirmation?
   * @param {number} confidence
   * @returns {boolean}
   */
  shouldExecuteImmediately(confidence) {
    return confidence >= THRESHOLDS.EXECUTE_OBSERVE;
  }

  /**
   * Reset state (e.g., when session ends)
   */
  reset() {
    if (this.observationTimer) {
      clearTimeout(this.observationTimer);
      this.observationTimer = null;
    }
    if (this.confirmationTimer) {
      clearTimeout(this.confirmationTimer);
      this.confirmationTimer = null;
    }
    this.setState(LearningState.IDLE);
    this.pendingConfirmation = null;
    this.correctionContext = null;
  }

  /**
   * Cleanup unused learned mappings (call periodically)
   */
  async cleanupUnused() {
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    let removed = 0;

    const commands = commandDictionary.data.commands;
    for (let i = commands.length - 1; i >= 0; i--) {
      const cmd = commands[i];
      if (cmd.source === 'learned') {
        const lastUsed = cmd.last_used ? new Date(cmd.last_used).getTime() : 0;

        if (lastUsed < thirtyDaysAgo) {
          cmd.confidence += CONFIDENCE_ADJUSTMENTS.UNUSED_DECAY;

          if (cmd.confidence < THRESHOLDS.REMOVE_LEARNED) {
            // Remove the command
            commands.splice(i, 1);
            removed++;
            console.log(`[LearningLoop] Cleanup: removed unused "${cmd.action}"`);
          }
        }
      }
    }

    if (removed > 0) {
      await commandDictionary.save();
      commandDictionary.buildIndexes();
    }

    return removed;
  }

  /**
   * Check if text looks like a correction attempt
   * @param {string} text
   * @returns {boolean}
   */
  looksLikeCorrection(text) {
    const trimmed = text.trim().toLowerCase();
    return CORRECTION_PATTERNS.some(p => p.test(trimmed)) ||
           SIMPLE_NEGATIVE.test(trimmed);
  }

  /**
   * Check if text is an affirmative response
   * @param {string} text
   * @returns {boolean}
   */
  isAffirmative(text) {
    return AFFIRMATIVE.test(text.trim());
  }

  /**
   * Check if text is a negative response
   * @param {string} text
   * @returns {boolean}
   */
  isNegative(text) {
    return SIMPLE_NEGATIVE.test(text.trim());
  }
}

// Export singleton and class
export const learningLoop = new LearningLoop();
export { LearningState, THRESHOLDS, CONFIDENCE_ADJUSTMENTS };
export default learningLoop;
