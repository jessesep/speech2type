# Learning Loop Architecture

> How ONE continuously learns from usage and corrections

## Overview

The Learning Loop is the core mechanism that makes ONE smarter over time. It connects:
- **Intent Resolution** → tries to understand
- **Execution** → acts on understanding
- **Feedback** → user confirms or corrects
- **Dictionary Update** → learns for next time

## The Loop

```
┌─────────────────────────────────────────────────────────────────┐
│                      LEARNING LOOP                               │
└─────────────────────────────────────────────────────────────────┘

     User speaks
          │
          ▼
    ┌───────────┐
    │  Resolve  │ ← IntentResolver (Tier 1→2→3)
    │  Intent   │
    └─────┬─────┘
          │
          ▼
    ┌───────────┐     Low confidence
    │ Confident?│────────────────────────┐
    │  (>70%)   │                        │
    └─────┬─────┘                        ▼
          │                     ┌────────────────┐
          │ Yes                 │ Ask for        │
          ▼                     │ Confirmation   │
    ┌───────────┐               │ "Did you mean  │
    │  Execute  │               │  [action]?"    │
    │  Action   │               └───────┬────────┘
    └─────┬─────┘                       │
          │                      ┌──────┴──────┐
          ▼                      │             │
    ┌───────────┐          "yes"/"no"   "no, I meant..."
    │  Observe  │                │             │
    │  Result   │                ▼             ▼
    └─────┬─────┘          ┌─────────┐   ┌─────────────┐
          │                │ Execute │   │ Correction  │
          ▼                │& Learn  │   │ Flow        │
    ┌───────────┐          └────┬────┘   └──────┬──────┘
    │ Implicit  │               │               │
    │ Feedback  │               ▼               ▼
    └─────┬─────┘         ┌─────────────────────────┐
          │               │   Update Dictionary     │
          └──────────────►│   - Add phrase          │
                          │   - Adjust confidence   │
                          │   - Record usage        │
                          └─────────────────────────┘
```

## Feedback Types

### 1. Implicit Positive Feedback

User doesn't correct → action was probably right.

```javascript
// After successful execution without correction
async recordImplicitPositive(phrase, action) {
  const cmd = this.findCommand(action);
  if (cmd) {
    // Boost confidence slightly
    cmd.confidence = Math.min(1.0, cmd.confidence + 0.02);
    cmd.use_count++;
    cmd.last_used = new Date().toISOString();
  }
}
```

**Triggers:**
- User continues speaking normally after action
- No "no" or "wrong" or "undo" within 5 seconds
- User explicitly says "yes" or "affirmative"

### 2. Implicit Negative Feedback

User immediately corrects or undoes.

```javascript
async recordImplicitNegative(phrase, action) {
  const cmd = this.findCommand(action);
  if (cmd) {
    // Decrease confidence
    cmd.confidence = Math.max(0.3, cmd.confidence - 0.1);

    // If phrase was recently learned, maybe remove it
    if (cmd.source === 'learned' && cmd.confidence < 0.5) {
      await this.forgetPhrase(phrase);
    }
  }
}
```

**Triggers:**
- "No" within 3 seconds of action
- "Wrong" or "that's wrong"
- "Undo" or "retract" immediately after
- "Computer scratch" right after

### 3. Explicit Correction

User tells ONE what they meant.

```
User: "zoom in"
ONE: *increases volume* (wrong)
User: "No, I meant make the text bigger"
ONE: "Got it. 'Zoom in' now means increase font size. Confirm?"
User: "Yes"
ONE: *saves mapping, adjusts old mapping confidence*
```

```javascript
async handleCorrection(originalPhrase, intendedAction) {
  // Decrease confidence on wrong mapping
  const wrongCmd = this.findCommandByPhrase(originalPhrase);
  if (wrongCmd) {
    wrongCmd.confidence -= 0.2;
    // Remove phrase from wrong action if confidence too low
    if (wrongCmd.confidence < 0.4) {
      this.removePhraseFromCommand(originalPhrase, wrongCmd);
    }
  }

  // Add to correct action
  await this.learn(originalPhrase, intendedAction, 'corrected');
}
```

### 4. Explicit Training

User enters training mode intentionally.

```
User: "Computer, learn"
ONE: "Training mode. What should I learn?"
User: "When I say 'ship it', deploy to production"
ONE: "'Ship it' will deploy to production. Confirm?"
User: "Yes"
ONE: *saves with confidence 1.0*
```

Training mode commands have highest confidence (1.0).

## Confirmation Flow

When confidence is between 50-70%:

```javascript
async resolveWithConfirmation(phrase, context) {
  const result = await this.resolve(phrase, context);

  if (result.confidence >= 0.5 && result.confidence < 0.7) {
    // Ask for confirmation
    this.pendingConfirmation = {
      phrase,
      suggestedAction: result.action,
      timestamp: Date.now()
    };

    await speak(`Did you mean ${this.describeAction(result.action)}?`);
    this.awaitingConfirmation = true;
    return { action: 'await_confirmation', ...result };
  }

  return result;
}

async handleConfirmationResponse(response) {
  if (!this.pendingConfirmation) return;

  const { phrase, suggestedAction } = this.pendingConfirmation;

  if (this.isAffirmative(response)) {
    // User confirmed - execute and learn
    await this.execute(suggestedAction);
    await this.learn(phrase, suggestedAction, 'confirmed');
    await speak('Got it.');
  } else if (this.isNegative(response)) {
    // User rejected - ask what they meant
    await speak("What did you mean?");
    this.awaitingCorrection = true;
    this.correctionContext = { phrase };
  } else {
    // Response might be the correction itself
    await this.handlePotentialCorrection(response);
  }

  this.pendingConfirmation = null;
  this.awaitingConfirmation = false;
}
```

## Confidence Dynamics

### Confidence Sources

| Source | Initial Confidence |
|--------|-------------------|
| `default` (built-in) | 1.0 |
| `trained` (explicit) | 1.0 |
| `confirmed` (user said yes) | 0.9 |
| `learned` (auto from Tier 3) | 0.8 |
| `corrected` | 0.85 |

### Confidence Adjustments

| Event | Adjustment |
|-------|------------|
| Used successfully (no correction) | +0.02 (max 1.0) |
| User said "yes" to confirmation | +0.1 |
| User said "no" to confirmation | -0.15 |
| Immediate "undo" after | -0.1 |
| Explicit correction | -0.2 on wrong, +0.85 on right |
| Not used for 30 days | -0.05 |

### Confidence Thresholds

| Range | Behavior |
|-------|----------|
| ≥0.9 | Execute immediately, no confirmation |
| 0.7-0.9 | Execute, but listen for correction |
| 0.5-0.7 | Ask for confirmation first |
| <0.5 | Don't suggest, use Tier 3 |

## Correction Detection

How to detect when user is correcting:

```javascript
const CORRECTION_PATTERNS = [
  /^no[,.]?\s+(?:i\s+)?(?:meant?|want(?:ed)?)\s+(.+)/i,
  /^(?:that's\s+)?wrong[,.]?\s+(?:i\s+)?(?:meant?|want(?:ed)?)\s+(.+)/i,
  /^not\s+that[,.]?\s+(.+)/i,
  /^i\s+said\s+(.+)/i,
  /^(?:actually|instead)[,.]?\s+(.+)/i
];

function parseCorrection(text) {
  for (const pattern of CORRECTION_PATTERNS) {
    const match = text.match(pattern);
    if (match) {
      return {
        isCorrection: true,
        intendedPhrase: match[1].trim()
      };
    }
  }

  // Check if it's just "no" or "wrong"
  if (/^(no|nope|wrong|that's wrong|not that)$/i.test(text.trim())) {
    return {
      isCorrection: true,
      intendedPhrase: null  // Need to ask what they meant
    };
  }

  return { isCorrection: false };
}
```

## Context Window

Track recent activity for smarter corrections:

```javascript
class ContextWindow {
  constructor(windowSize = 10) {
    this.history = [];
    this.windowSize = windowSize;
  }

  add(entry) {
    this.history.push({
      ...entry,
      timestamp: Date.now()
    });

    if (this.history.length > this.windowSize) {
      this.history.shift();
    }
  }

  getRecent(seconds = 5) {
    const cutoff = Date.now() - (seconds * 1000);
    return this.history.filter(e => e.timestamp > cutoff);
  }

  getLastAction() {
    for (let i = this.history.length - 1; i >= 0; i--) {
      if (this.history[i].type === 'action') {
        return this.history[i];
      }
    }
    return null;
  }
}

// Usage
context.add({ type: 'speech', text: 'zoom in' });
context.add({ type: 'action', action: 'volume_up' });  // Wrong!
context.add({ type: 'speech', text: 'no that\'s wrong' });

// Detect: last action was volume_up, user said wrong → correction needed
```

## Learning Quality Controls

### Prevent Bad Learning

```javascript
async learn(phrase, action, source) {
  // Don't learn very short phrases (too ambiguous)
  if (phrase.split(' ').length < 2 && source !== 'trained') {
    console.log('[Learn] Skipping short phrase:', phrase);
    return false;
  }

  // Don't learn phrases that look like commands for different actions
  if (this.looksLikeOtherCommand(phrase, action)) {
    console.log('[Learn] Phrase conflicts with existing command');
    return false;
  }

  // Don't learn if we've seen this phrase fail before
  if (this.failedPhrases.has(phrase)) {
    console.log('[Learn] Phrase has failed before, skipping');
    return false;
  }

  // Proceed with learning
  return await this._learn(phrase, action, source);
}
```

### Decay Unused Mappings

```javascript
async cleanupUnused() {
  const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);

  for (const cmd of this.data.commands) {
    if (cmd.source === 'learned') {
      const lastUsed = new Date(cmd.last_used).getTime();

      if (lastUsed < thirtyDaysAgo) {
        // Decay confidence
        cmd.confidence -= 0.05;

        // Remove if too low
        if (cmd.confidence < 0.3) {
          await this.removeCommand(cmd.id);
          console.log('[Cleanup] Removed unused learned command:', cmd.action);
        }
      }
    }
  }
}
```

## State Machine

```
                         ┌─────────────┐
                         │   IDLE      │
                         │ (listening) │
                         └──────┬──────┘
                                │ speech detected
                                ▼
                         ┌─────────────┐
                         │  RESOLVING  │
                         └──────┬──────┘
                    ┌───────────┼───────────┐
                    │           │           │
              high conf    med conf    low conf
                    │           │           │
                    ▼           ▼           ▼
             ┌──────────┐ ┌──────────┐ ┌──────────┐
             │ EXECUTING│ │CONFIRMING│ │ FALLBACK │
             │          │ │          │ │ (Tier 3) │
             └────┬─────┘ └────┬─────┘ └────┬─────┘
                  │            │            │
                  ▼            ▼            ▼
             ┌──────────────────────────────────┐
             │        OBSERVING (5 sec)         │
             │  Listening for correction        │
             └──────────────┬───────────────────┘
                    ┌───────┴───────┐
                    │               │
              no correction    correction detected
                    │               │
                    ▼               ▼
             ┌───────────┐   ┌─────────────┐
             │ LEARNING  │   │ CORRECTING  │
             │ (positive)│   │             │
             └─────┬─────┘   └──────┬──────┘
                   │                │
                   └────────┬───────┘
                            ▼
                     ┌─────────────┐
                     │   IDLE      │
                     └─────────────┘
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/services/learning-loop.js` | CREATE - main loop logic |
| `src/services/commands.js` | MODIFY - add confidence methods |
| `src/services/context-window.js` | CREATE - track recent activity |
| `src/services/intent-resolver.js` | MODIFY - integrate loop |
| `src/index.js` | MODIFY - wire up state machine |

---

*Spec by thinker | Phase 2 Planning | 2024-12-08*
