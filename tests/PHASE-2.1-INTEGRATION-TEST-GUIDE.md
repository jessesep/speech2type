# Phase 2.1 Learning Loop Integration - Manual Testing Guide

## Overview
Builder completed Phase 2.1 learning loop integration in `src/index.js`. This guide validates the integration.

## Integration Points

### 1. Callbacks Initialization (Line 346)
**Location:** `initializeIntentResolver()` function
**Code:**
```javascript
learningLoop.setCallbacks({
  onSpeak: async (text) => { /* TTS via macOS say */ },
  onExecute: async (action) => { /* Execute confirmed actions */ },
  onStateChange: (newState, oldState) => { /* Track state */ }
});
```

**Test:**
1. Start the app
2. Check logs for: `[learning] State: idle -> *` messages
3. Verify callbacks are initialized before first use

**Expected:** No errors, learning loop ready

---

### 2. Correction Detection (Line 932)
**Location:** `onTranscript()` function, early in transcript processing
**Code:**
```javascript
const correctionHandled = await learningLoop.handleSpeech(cleanText);
if (correctionHandled) {
  console.log('[learning] Handled as correction/feedback');
  return;
}
```

**Test:**
1. Execute a command (e.g., "computer save")
2. Within 3 seconds, say: "no, I meant open"
3. Check logs for: `[learning] Handled as correction/feedback`

**Expected:**
- Correction detected and logged
- Original action gets negative feedback
- System prompts "What did you mean?"

---

### 3. Immediate Undo Tracking (Line 1059)
**Location:** After undo command execution
**Code:**
```javascript
await learningLoop.handleImmediateUndo();
```

**Test:**
1. Execute a command: "computer save"
2. Immediately say: "computer undo" or "retract"
3. Check for implicit negative feedback in logs

**Expected:**
- Command undone
- Confidence decreased for that phrase
- If learned phrase drops too low, it's removed

---

### 4. Confirmation Flow (Line 1213)
**Location:** AI resolution with 50-70% confidence
**Code:**
```javascript
if (result.confidence >= 0.5 && result.confidence < 0.7) {
  await learningLoop.askForConfirmation(cleanText, result.action, result.confidence, actionDescription);
  return;
}
```

**Test:**
1. Say a phrase that gets 50-70% confidence (check logs for confidence score)
2. System should speak: "Did you mean [action]?"
3. Respond with "yes" or "no"

**Expected (Yes):**
- Action executes
- Phrase learned with boosted confidence
- System says: "Got it."

**Expected (No):**
- Action not executed
- System asks: "What did you mean?"
- Confidence decreased

---

### 5. Implicit Feedback (Line 1249)
**Location:** After successful action execution (>=70% confidence)
**Code:**
```javascript
await learningLoop.observeAction(cleanText, result.action, result.confidence, result.tier || 3);
```

**Test:**
1. Execute a command with >70% confidence: "computer save"
2. Wait 5 seconds without correction
3. Check logs for implicit positive feedback

**Expected:**
- After 5 seconds, confidence increased by +0.02
- use_count incremented
- last_used timestamp updated
- Logged: `[LearningLoop] Implicit positive: "..." -> ACTION (conf: X.XX)`

---

## Integration Verification Checklist

- [ ] Learning loop initializes without errors
- [ ] Callbacks are set before first transcript
- [ ] Correction detection works (handleSpeech called first)
- [ ] Undo tracking provides negative feedback
- [ ] Confirmation flow works for medium confidence
- [ ] Implicit positive feedback after 5 seconds
- [ ] State transitions logged correctly
- [ ] No race conditions or timing issues

---

## Test Scenarios

### Scenario 1: Learn from Correction
1. Say: "computer save" (executes)
2. Say: "no, I meant close" (within 3s)
3. System asks what you meant
4. Say: "close window"
5. System learns the correction

**Expected:** Future "computer save" has lower confidence, correction learned

### Scenario 2: Confirmation Accepted
1. Say a phrase with ~60% confidence
2. System asks: "Did you mean [action]?"
3. Say: "yes"
4. Action executes, phrase learned

**Expected:** Next time, phrase has higher confidence

### Scenario 3: Confirmation Rejected
1. Say a phrase with ~60% confidence
2. System asks: "Did you mean [action]?"
3. Say: "no"
4. System asks what you meant

**Expected:** Confidence decreased, correction flow activated

### Scenario 4: Immediate Undo
1. Say: "computer open browser"
2. Say: "retract" (within 3s)
3. Undo happens, negative feedback applied

**Expected:** "open browser" confidence decreased

### Scenario 5: Implicit Positive
1. Say: "computer close tab"
2. Wait 5+ seconds without correction
3. Check confidence increase

**Expected:** Confidence +0.02, use_count +1

---

## Coverage Note

**Learning Loop Module:** 97.39% coverage (63 automated tests)
**Integration:** Manual testing required due to index.js complexity

The learning loop itself is thoroughly tested. This guide validates that builder's integration follows the specification correctly.

---

## Files Modified by Builder

- `src/index.js` (5 integration points)
- Import added: `import { learningLoop } from './services/learning-loop.js';`

## Spec Reference

See `.planning/one/LEARNING-LOOP.md` for detailed specification.
