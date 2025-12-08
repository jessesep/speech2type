/**
 * Context Window Service (Phase 2.1)
 *
 * Tracks recent activity for smarter corrections and learning.
 * Maintains a sliding window of speech, actions, and feedback events.
 */

/**
 * Entry types for the context window
 * @typedef {'speech' | 'action' | 'feedback' | 'confirmation' | 'correction'} EntryType
 */

/**
 * Context entry structure
 * @typedef {Object} ContextEntry
 * @property {EntryType} type - Type of entry
 * @property {string} [text] - Speech text (for speech entries)
 * @property {string} [action] - Action name (for action entries)
 * @property {number} [confidence] - Confidence level (for action entries)
 * @property {number} [tier] - Resolution tier 1/2/3 (for action entries)
 * @property {string} [feedbackType] - 'positive' | 'negative' (for feedback entries)
 * @property {string} [originalPhrase] - Original phrase being corrected
 * @property {string} [intendedAction] - What user actually wanted
 * @property {number} timestamp - When this entry was added
 */

/**
 * ContextWindow class
 * Maintains a sliding window of recent activity for context-aware learning
 */
export class ContextWindow {
  /**
   * Create a new context window
   * @param {number} windowSize - Maximum number of entries to keep
   */
  constructor(windowSize = 10) {
    this.history = [];
    this.windowSize = windowSize;
  }

  /**
   * Add an entry to the context window
   * @param {Partial<ContextEntry>} entry - Entry to add (timestamp auto-added)
   */
  add(entry) {
    this.history.push({
      ...entry,
      timestamp: Date.now()
    });

    // Keep window size bounded
    if (this.history.length > this.windowSize) {
      this.history.shift();
    }
  }

  /**
   * Record a speech event
   * @param {string} text - What the user said
   */
  addSpeech(text) {
    this.add({ type: 'speech', text });
  }

  /**
   * Record an action execution
   * @param {string} action - Action that was executed
   * @param {number} confidence - Confidence level (0-1)
   * @param {number} [tier] - Which tier resolved this (1, 2, or 3)
   */
  addAction(action, confidence, tier = null) {
    this.add({ type: 'action', action, confidence, tier });
  }

  /**
   * Record feedback (positive or negative)
   * @param {'positive' | 'negative'} feedbackType
   * @param {string} [relatedAction] - Action the feedback is about
   */
  addFeedback(feedbackType, relatedAction = null) {
    this.add({ type: 'feedback', feedbackType, action: relatedAction });
  }

  /**
   * Record a confirmation event
   * @param {string} action - Action that was confirmed
   * @param {boolean} confirmed - Whether user confirmed or rejected
   */
  addConfirmation(action, confirmed) {
    this.add({
      type: 'confirmation',
      action,
      feedbackType: confirmed ? 'positive' : 'negative'
    });
  }

  /**
   * Record a correction event
   * @param {string} originalPhrase - What user originally said
   * @param {string} wrongAction - Action that was incorrectly executed
   * @param {string} intendedAction - What user actually wanted
   */
  addCorrection(originalPhrase, wrongAction, intendedAction) {
    this.add({
      type: 'correction',
      originalPhrase,
      action: wrongAction,
      intendedAction
    });
  }

  /**
   * Get entries from the last N seconds
   * @param {number} seconds - Time window in seconds
   * @returns {ContextEntry[]} - Recent entries
   */
  getRecent(seconds = 5) {
    const cutoff = Date.now() - (seconds * 1000);
    return this.history.filter(e => e.timestamp > cutoff);
  }

  /**
   * Get the last action that was executed
   * @returns {ContextEntry | null}
   */
  getLastAction() {
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i].type === 'action') {
        return this.history[i];
      }
    }
    return null;
  }

  /**
   * Get the last speech entry
   * @returns {ContextEntry | null}
   */
  getLastSpeech() {
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i].type === 'speech') {
        return this.history[i];
      }
    }
    return null;
  }

  /**
   * Check if there was a recent action (within N seconds)
   * @param {number} seconds - Time window
   * @returns {boolean}
   */
  hasRecentAction(seconds = 5) {
    const recent = this.getRecent(seconds);
    return recent.some(e => e.type === 'action');
  }

  /**
   * Check if user has given negative feedback recently
   * @param {number} seconds - Time window
   * @returns {boolean}
   */
  hasRecentNegativeFeedback(seconds = 3) {
    const recent = this.getRecent(seconds);
    return recent.some(e =>
      (e.type === 'feedback' && e.feedbackType === 'negative') ||
      (e.type === 'confirmation' && e.feedbackType === 'negative')
    );
  }

  /**
   * Get speech that came before the last action
   * Useful for determining what phrase triggered an action
   * @returns {string | null}
   */
  getSpeechBeforeLastAction() {
    let foundAction = false;
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i].type === 'action') {
        foundAction = true;
        continue;
      }
      if (foundAction && this.history[i].type === 'speech') {
        return this.history[i].text;
      }
    }
    return null;
  }

  /**
   * Clear all history
   */
  clear() {
    this.history = [];
  }

  /**
   * Get full history
   * @returns {ContextEntry[]}
   */
  getAll() {
    return [...this.history];
  }

  /**
   * Get statistics about recent activity
   * @returns {Object}
   */
  getStats() {
    const actions = this.history.filter(e => e.type === 'action');
    const corrections = this.history.filter(e => e.type === 'correction');
    const negativeFeedback = this.history.filter(e =>
      e.feedbackType === 'negative'
    );

    return {
      totalEntries: this.history.length,
      actions: actions.length,
      corrections: corrections.length,
      negativeFeedback: negativeFeedback.length,
      errorRate: actions.length > 0
        ? (corrections.length / actions.length).toFixed(2)
        : '0.00'
    };
  }
}

// Singleton instance
export const contextWindow = new ContextWindow(10);

export default contextWindow;
