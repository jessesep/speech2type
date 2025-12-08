/**
 * Training Mode Service (Phase 2.2 + 2.4)
 *
 * Allows users to explicitly teach ONE new commands through conversational training.
 * State machine: IDLE → LISTENING → COLLECTING → CONFIRMING → SAVING → IDLE
 *
 * Phase 2.4: Integrated training-voice for sound effects and natural voice prompts
 */

import { commandDictionary } from './commands.js';
import { trainingVoice } from './training-voice.js';

/**
 * Training mode states
 */
export const TrainingState = {
  IDLE: 'idle',
  LISTENING: 'listening',                  // Waiting for training request
  COLLECTING_VARIATIONS: 'collecting_variations',  // Adding more trigger phrases
  COLLECTING_STEPS: 'collecting_steps',    // Adding workflow steps
  CONFIRMING: 'confirming',                // Asking user to confirm
  SAVING: 'saving'                         // Writing to disk
};

/**
 * Training session types
 */
export const TrainingType = {
  SIMPLE_COMMAND: 'simple_command',        // phrase → action mapping
  WORKFLOW: 'workflow',                    // multi-step sequence
  CONTEXT_RULE: 'context_rule'             // app-specific override
};

/**
 * Timeout durations
 */
const TIMEOUTS = {
  LISTENING: 25000,           // 25s to describe what to learn
  COLLECTING: 15000,          // 15s between variations
  CONFIRMING: 20000,          // 20s to confirm or cancel
  WARNING: 15000              // Warn at 15s before timeout
};

/**
 * TrainingMode class
 * Manages conversational training sessions
 */
export class TrainingMode {
  constructor() {
    this.state = TrainingState.IDLE;
    this.session = null;
    this.timeoutTimer = null;
    this.warningTimer = null;

    // Callbacks for integration
    this.onSpeak = null;       // Function to speak text
    this.onExecute = null;     // Function to execute action
    this.onStateChange = null; // Function called on state change
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
   * Is training mode active?
   */
  isActive() {
    return this.state !== TrainingState.IDLE;
  }

  /**
   * Change state and notify
   */
  setState(newState) {
    const oldState = this.state;
    this.state = newState;
    console.log(`[Training] State: ${oldState} -> ${newState}`);

    if (this.onStateChange) {
      this.onStateChange(newState, oldState);
    }
  }

  /**
   * Start training mode
   */
  async enter() {
    if (this.isActive()) {
      console.log('[Training] Already in training mode');
      return false;
    }

    // Initialize new session
    this.session = {
      id: `train_${Date.now()}`,
      started_at: new Date().toISOString(),
      type: null,  // Determined from first input
      data: {
        trigger_phrases: [],
        action: null,
        steps: [],
        context: null
      },
      history: []
    };

    this.setState(TrainingState.LISTENING);

    // Play sound and speak (Phase 2.4)
    await trainingVoice.enterTraining();

    // Start timeout
    this.startTimeout(TIMEOUTS.LISTENING);

    return true;
  }

  /**
   * Exit training mode (save or discard)
   */
  async exit(save = false) {
    if (!this.isActive()) {
      return false;
    }

    this.clearTimeouts();

    if (save && this.session) {
      await this.save();
      await trainingVoice.saved();
      await trainingVoice.exitTraining();
    } else {
      await trainingVoice.cancelled();
      // Exit sound already included in cancelled()
    }

    this.session = null;
    this.setState(TrainingState.IDLE);
    return true;
  }

  /**
   * Handle user speech during training
   * @param {string} text - User's spoken text
   * @returns {boolean} - True if handled by training mode
   */
  async handleSpeech(text) {
    if (!this.isActive()) {
      return false;
    }

    // Reset timeout on any speech
    this.clearTimeouts();

    // Add to conversation history
    this.addToHistory('user', text);

    const lowerText = text.toLowerCase().trim();

    // Check for exit commands
    if (this.checkExitCommand(lowerText)) {
      await this.handleExit(lowerText);
      return true;
    }

    // Handle based on current state
    switch (this.state) {
      case TrainingState.LISTENING:
        await this.handleTrainingRequest(text);
        break;

      case TrainingState.COLLECTING_VARIATIONS:
        await this.handleVariation(text);
        break;

      case TrainingState.COLLECTING_STEPS:
        await this.handleStep(text);
        break;

      case TrainingState.CONFIRMING:
        await this.handleConfirmation(text);
        break;

      default:
        console.log(`[Training] Unexpected state: ${this.state}`);
    }

    return true;
  }

  /**
   * Check if text is an exit command
   */
  checkExitCommand(text) {
    return /^(cancel|nevermind|never mind|exit|stop)$/i.test(text);
  }

  /**
   * Handle exit command
   */
  async handleExit(text) {
    if (/^cancel|nevermind|never mind/i.test(text)) {
      await this.exit(false);  // Discard
    } else {
      // Ask to confirm
      if (this.session && (this.session.data.trigger_phrases.length > 0 || this.session.data.steps.length > 0)) {
        this.setState(TrainingState.CONFIRMING);
        await this.confirm();
      } else {
        await this.exit(false);  // Nothing to save
      }
    }
  }

  /**
   * Handle training request (first input after "computer learn")
   */
  async handleTrainingRequest(text) {
    // Simple parsing for now - just extract quoted phrases
    // Example: "When I say 'yeet', delete the selection"
    const quoteMatch = text.match(/['"]([^'"]+)['"]/);

    if (quoteMatch) {
      const phrase = quoteMatch[1];
      this.session.data.trigger_phrases.push(phrase);
      this.session.type = TrainingType.SIMPLE_COMMAND;

      // Try to extract action description
      const actionMatch = text.match(/,\s*(.+)$/);
      if (actionMatch) {
        this.session.data.action_description = actionMatch[1];
      }

      this.setState(TrainingState.COLLECTING_VARIATIONS);

      const response = `Got it. "${phrase}" will ${this.session.data.action_description || 'perform that action'}. Want to add other ways to say this?`;
      this.addToHistory('one', response);

      await trainingVoice.understood();
      await trainingVoice.speak(response);

      this.startTimeout(TIMEOUTS.COLLECTING);
    } else {
      // Couldn't parse - ask for clarification
      const response = "I need you to say: 'When I say [phrase], do [action]'. For example: 'When I say ship it, run the deploy workflow'.";
      this.addToHistory('one', response);

      await trainingVoice.needClarification(response);

      this.startTimeout(TIMEOUTS.LISTENING);
    }
  }

  /**
   * Handle adding variation
   */
  async handleVariation(text) {
    const lowerText = text.toLowerCase().trim();

    // Check if done
    if (/^(no|nope|done|that's it|that's all)$/i.test(lowerText)) {
      await this.confirm();
      return;
    }

    // Extract phrase if quoted, or use whole text
    const quoteMatch = text.match(/['"]([^'"]+)['"]/);
    const phrase = quoteMatch ? quoteMatch[1] : text.replace(/^also\s+/, '').trim();

    this.session.data.trigger_phrases.push(phrase);

    const response = 'Added. Anything else?';
    this.addToHistory('one', response);

    await trainingVoice.addedVariation(response);

    this.startTimeout(TIMEOUTS.COLLECTING);
  }

  /**
   * Handle adding workflow step
   */
  async handleStep(text) {
    const lowerText = text.toLowerCase().trim();

    // Check if done
    if (/^done$/i.test(lowerText)) {
      await this.confirm();
      return;
    }

    this.session.data.steps.push({
      description: text,
      conditional: text.toLowerCase().includes('if ')
    });

    const stepNum = this.session.data.steps.length;
    const response = `Step ${stepNum}: ${text}. Next step? Say "done" when finished.`;
    this.addToHistory('one', response);

    await trainingVoice.understood();
    await trainingVoice.speak(response);

    this.startTimeout(TIMEOUTS.COLLECTING);
  }

  /**
   * Enter confirmation state
   */
  async confirm() {
    this.setState(TrainingState.CONFIRMING);

    let summary;
    if (this.session.type === TrainingType.SIMPLE_COMMAND) {
      const phrases = this.session.data.trigger_phrases.map(p => `"${p}"`).join(' or ');
      summary = `${phrases} will ${this.session.data.action_description}. Say "confirm" to save or "cancel" to discard.`;
    } else if (this.session.type === TrainingType.WORKFLOW) {
      const stepsList = this.session.data.steps.map((s, i) => `${i + 1}. ${s.description}`).join(', ');
      summary = `Workflow with ${this.session.data.steps.length} steps: ${stepsList}. Confirm to save?`;
    }

    this.addToHistory('one', summary);

    await trainingVoice.confirming(summary);

    this.startTimeout(TIMEOUTS.CONFIRMING);
  }

  /**
   * Handle confirmation response
   */
  async handleConfirmation(text) {
    const lowerText = text.toLowerCase().trim();

    if (/^(yes|yeah|yep|confirm|affirmative|save)$/i.test(lowerText)) {
      await this.exit(true);  // Save
    } else if (/^(no|nope|cancel|nevermind)$/i.test(lowerText)) {
      await this.exit(false);  // Discard
    } else {
      // Not a clear yes/no
      const response = 'Say "confirm" to save or "cancel" to discard.';
      this.addToHistory('one', response);

      await trainingVoice.needClarification(response);

      this.startTimeout(TIMEOUTS.CONFIRMING);
    }
  }

  /**
   * Save training session to command dictionary
   */
  async save() {
    if (!this.session) {
      return;
    }

    this.setState(TrainingState.SAVING);

    if (this.session.type === TrainingType.SIMPLE_COMMAND) {
      // For now, just add phrases to dictionary with a generic action
      // In full implementation, would parse action_description to actual action
      for (const phrase of this.session.data.trigger_phrases) {
        await commandDictionary.learn(phrase, 'CUSTOM_ACTION', 'trained');
      }
      console.log(`[Training] Saved ${this.session.data.trigger_phrases.length} phrase(s)`);
    } else if (this.session.type === TrainingType.WORKFLOW) {
      // Add to workflows array
      commandDictionary.data.workflows.push({
        id: this.session.id,
        name: this.session.data.name || 'unnamed workflow',
        phrases: this.session.data.trigger_phrases,
        steps: this.session.data.steps,
        created_at: this.session.started_at
      });
      await commandDictionary.save();
      console.log(`[Training] Saved workflow: ${this.session.data.name}`);
    }
  }

  /**
   * Add message to conversation history
   */
  addToHistory(role, content) {
    if (this.session) {
      this.session.history.push({
        role,
        content,
        timestamp: new Date().toISOString()
      });
    }
  }

  /**
   * Start timeout timer
   */
  startTimeout(duration) {
    this.clearTimeouts();

    // Warning at duration - 10s
    if (duration > 10000) {
      this.warningTimer = setTimeout(async () => {
        await trainingVoice.timeoutWarning();
      }, duration - 10000);
    }

    // Actual timeout
    this.timeoutTimer = setTimeout(() => {
      console.log('[Training] Timeout - prompting to save');
      if (this.session && (this.session.data.trigger_phrases.length > 0 || this.session.data.steps.length > 0)) {
        this.confirm();
      } else {
        this.exit(false);
      }
    }, duration);
  }

  /**
   * Clear all timers
   */
  clearTimeouts() {
    if (this.timeoutTimer) {
      clearTimeout(this.timeoutTimer);
      this.timeoutTimer = null;
    }
    if (this.warningTimer) {
      clearTimeout(this.warningTimer);
      this.warningTimer = null;
    }
  }

  /**
   * Get current session info (for debugging)
   */
  getSession() {
    return this.session;
  }
}

// Singleton
export const trainingMode = new TrainingMode();
