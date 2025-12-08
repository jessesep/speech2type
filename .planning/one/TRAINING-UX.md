# Training Mode UI/UX Design

> Voice-first interface for teaching ONE new commands

## Design Principles

1. **Voice-First** - Everything done by voice, no keyboard needed
2. **Conversational** - Feels like talking to a person, not a machine
3. **Forgiving** - Easy to correct mistakes, cancel, redo
4. **Confirming** - Always verify before saving
5. **Audible** - Distinct sounds for each state

## Audio Design

### Sound Palette

| State | Sound | Character |
|-------|-------|-----------|
| Enter training | Ascending chime (C→E→G) | "I'm ready to learn" |
| Understood | Soft click | Acknowledgment |
| Need clarification | Question tone (rising) | "Tell me more" |
| Adding variation | Double click | "Added" |
| Confirming | Waiting tone (gentle pulse) | "Are you sure?" |
| Saved | Success chime (G→C high) | "Got it!" |
| Cancelled | Descending tone (G→E→C) | "Okay, nevermind" |
| Error | Low buzz | "Something's wrong" |
| Exit training | Soft chime | "Back to normal" |

### Voice Prompts

Natural, concise responses:

| Situation | ONE Says |
|-----------|----------|
| Enter training | "Training mode. What should I learn?" |
| Understood phrase | "Got it." |
| Need action | "What should that do?" |
| Unknown action | "I don't have an action for that. Can you describe it differently?" |
| Adding variation | "Added. Any other ways to say it?" |
| Confirming | "[summary]. Sound right?" |
| Saved | "Learned!" |
| Cancelled | "Cancelled." |
| Exit | "Training off." |
| Timeout warning | "Still there?" |
| Conflict detected | "[phrase] already does [action]. Replace it, or make this specific to [app]?" |

## Conversation Flows

### Flow 1: Simple Command Mapping

```
User: "Computer, learn"
ONE:  *ascending chime*
ONE:  "Training mode. What should I learn?"

User: "When I say 'yeet', delete the selection"
ONE:  *click*
ONE:  "Got it. 'Yeet' deletes selection. Any other ways to say it?"

User: "Also 'get rid of this'"
ONE:  *double click*
ONE:  "Added. Anything else?"

User: "No"
ONE:  *waiting tone*
ONE:  "'Yeet' or 'get rid of this' will delete selection. Sound right?"

User: "Yes"
ONE:  *success chime*
ONE:  "Learned!"
ONE:  *soft chime*
ONE:  "Training off."
```

### Flow 2: Workflow Creation

```
User: "Computer, learn"
ONE:  *ascending chime*
ONE:  "Training mode. What should I learn?"

User: "Create a workflow called 'deploy'"
ONE:  *click*
ONE:  "New workflow: deploy. First step?"

User: "Run the tests"
ONE:  *click*
ONE:  "Step one: run tests. Next?"

User: "Push to git"
ONE:  *click*
ONE:  "Step two: git push. Next?"

User: "Open the browser to our site"
ONE:  *click*
ONE:  "Step three: open browser. Next?"

User: "Done"
ONE:  *waiting tone*
ONE:  "Workflow 'deploy': run tests, git push, open browser. Three steps. Sound right?"

User: "Yes"
ONE:  *success chime*
ONE:  "Learned! Say 'deploy' to run it."
```

### Flow 3: Correction After Error

```
User: "Zoom in"
ONE:  *turns up volume* (wrong action)

User: "No, that's wrong"
ONE:  *question tone*
ONE:  "Sorry! What should 'zoom in' do?"

User: "Make the text bigger"
ONE:  *click*
ONE:  "'Zoom in' will increase font size. Save this?"

User: "Yes"
ONE:  *success chime*
ONE:  "Updated."
```

### Flow 4: Conflict Resolution

```
User: "Computer, learn"
ONE:  "Training mode. What should I learn?"

User: "When I say 'play', open Spotify"
ONE:  *question tone*
ONE:  "'Play' already controls media playback. Replace it, or only in Finder?"

User: "Only in Finder"
ONE:  *click*
ONE:  "In Finder, 'play' opens Spotify. Everywhere else, it controls media. Sound right?"

User: "Yes"
ONE:  *success chime*
ONE:  "Learned!"
```

### Flow 5: Cancel/Undo

```
User: "Computer, learn"
ONE:  "Training mode. What should I learn?"

User: "When I say... actually, never mind"
ONE:  *descending tone*
ONE:  "Cancelled. Training off."
```

Or mid-training:

```
User: "Computer, learn"
ONE:  "Training mode. What should I learn?"

User: "When I say 'foo', do bar"
ONE:  "Got it. 'Foo' does bar. Any other ways to say it?"

User: "Cancel"
ONE:  *descending tone*
ONE:  "Cancelled. Nothing saved. Training off."
```

## Visual Feedback (Menu Bar)

### Icon States During Training

| State | Icon | Animation |
|-------|------|-----------|
| Training active | Purple/magenta | Gentle pulse |
| Listening for phrase | Purple + waves | Wave animation |
| Processing | Purple + dots | Thinking dots |
| Confirming | Purple + check | Blinking |
| Saved | Green flash → purple | Flash then settle |
| Error | Red flash → purple | Flash then settle |

### Menu Bar Tooltip

During training, tooltip shows:
```
ONE - Training Mode
Teaching: "yeet" → delete_selection
Say a variation or "done" to finish
```

## Keyboard Shortcuts (Optional)

For users who want hybrid input:

| Key | Action |
|-----|--------|
| Esc | Cancel training |
| Enter | Confirm/Done |
| ⌘Z | Undo last addition |

## Error Handling

### Unrecognized Action

```
User: "When I say 'foo', do the impossible thing"
ONE:  "I don't have an action for 'the impossible thing'.
       Try: 'copy', 'paste', 'volume up', 'focus [app]'..."
```

### Unclear Phrase

```
User: "Make it do the thing"
ONE:  "What phrase triggers this? Start with 'when I say...'"
```

### Timeout

```
[15 seconds of silence]
ONE:  "Still there?"

[10 more seconds]
ONE:  *descending tone*
ONE:  "Training cancelled due to timeout."
```

## Entry Points

### 1. Explicit Command
```
"Computer, learn"
"Computer, training mode"
"Computer, teach you something"
```

### 2. After Correction
```
User: "No, that's wrong"
ONE:  "Sorry! What should I have done?"
User: [describes correct action]
ONE:  "Want me to remember this?"
User: "Yes"
```

### 3. Help Request
```
User: "How do I make you do X?"
ONE:  "I don't know how to do X yet. Want to teach me?"
```

## Forgetting/Editing

### Forget a Phrase
```
User: "Computer, forget 'yeet'"
ONE:  "'Yeet' currently deletes selection. Remove it?"
User: "Yes"
ONE:  *success chime*
ONE:  "Removed. I won't respond to 'yeet' anymore."
```

### What Does X Do?
```
User: "Computer, what does 'ship it' do?"
ONE:  "'Ship it' runs your deploy workflow: run tests, git push, open browser.
       Say 'edit ship it' to modify, or 'forget ship it' to remove."
```

### List Learned Commands
```
User: "Computer, what have I taught you?"
ONE:  "You've taught me 12 custom commands. Most used: 'ship it', 'yeet', 'nuke it'.
       Say 'show all learned' for the full list."
```

## Implementation Notes

### Voice Response Timing

```javascript
// Don't speak immediately - feels more natural with tiny pause
async speak(text) {
  await delay(150);  // 150ms pause
  await tts.speak(text);
}

// Faster acknowledgments
async acknowledge() {
  await delay(50);
  await playSound('click');
}
```

### Interruption Handling

```javascript
// User can interrupt at any time
onSpeechDetected(text) {
  if (this.isSpeaking) {
    this.stopSpeaking();
  }
  // Process new input
  this.processTrainingInput(text);
}
```

### State Persistence

If app crashes during training, don't lose partial work:

```javascript
// Save draft state every step
this.trainingDraft = {
  phrases: ['yeet', 'get rid of this'],
  action: 'delete_selection',
  step: 'confirming'
};
localStorage.setItem('training_draft', JSON.stringify(this.trainingDraft));

// On startup, check for draft
const draft = localStorage.getItem('training_draft');
if (draft) {
  speak("You were teaching me something. Want to continue or start fresh?");
}
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/services/training-mode.js` | CREATE - full training logic |
| `src/services/training-voice.js` | CREATE - voice prompts |
| `src/data/training-sounds/` | ADD - sound effects |
| `gui/main.cjs` | MODIFY - training icon states |
| `gui/settings.html` | MODIFY - learned commands viewer |

## Success Metrics

| Metric | Target |
|--------|--------|
| Training completion rate | >90% (not cancelled) |
| Time to teach command | <15 seconds |
| Commands taught per user | >5 in first week |
| Training mode re-entries | <2 per command (gets it right) |

---

*Spec by thinker | Phase 2 Planning | 2024-12-08*
