# AI-Powered Command Understanding

## Vision

Transform Speech2Type from a keyword-matching voice control system into an intelligent, self-learning voice assistant that understands user intent and adapts to individual speech patterns.

**Core Principle:** Users shouldn't need to memorize commands or manually configure variations. The app learns from them naturally through voice interaction.

## Current State

Today, Speech2Type uses exact keyword matching with manually defined variations:

```javascript
// Current approach - rigid, requires manual configuration
const COMMANDS = {
  'computer enter': 'enter',
  'computer submit': 'enter',
  'computer send': 'enter',
  'computer go': 'enter',
  // ... many variations needed
};
```

**Limitations:**
- Users must learn specific phrases
- Every variation needs manual coding
- No understanding of intent, only keywords
- Can't handle natural speech patterns
- No learning from user behavior

## Proposed Architecture

### Three-Tier Command System

```
┌─────────────────────────────────────────────────────────────┐
│                     USER SPEAKS                              │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  TIER 1: Fast Keyword Matching (Existing System)            │
│  - Instant response (<10ms)                                 │
│  - Known commands, learned phrases                          │
│  - No API calls needed                                      │
└─────────────────────────────────────────────────────────────┘
                            │
                    (No match found)
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  TIER 2: Local Intent Classification                        │
│  - Small local model (e.g., distilled BERT, TinyLlama)     │
│  - Classifies into known action categories                  │
│  - ~50-100ms response time                                  │
│  - Works offline                                            │
└─────────────────────────────────────────────────────────────┘
                            │
                    (Low confidence)
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  TIER 3: Claude API Understanding (Training Mode)           │
│  - Full natural language understanding                      │
│  - Asks user for confirmation                               │
│  - Learns new command patterns                              │
│  - Adds to Tier 1/2 for future use                         │
└─────────────────────────────────────────────────────────────┘
```

### Training Mode Flow

```
User: "computer, make this bigger"
                │
                ▼
┌─────────────────────────────────────┐
│  No exact match found               │
│  Entering training mode...          │
└─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│  Claude Haiku analyzes:             │
│  - Current app context              │
│  - User's words                     │
│  - Available actions                │
└─────────────────────────────────────┘
                │
                ▼
┌─────────────────────────────────────┐
│  "I think you want to zoom in.     │
│   Should I do that?"                │
│                                     │
│   [Yes] [No] [Different action]     │
└─────────────────────────────────────┘
                │
          User: "Yes"
                │
                ▼
┌─────────────────────────────────────┐
│  Action executed + learned:         │
│  "make this bigger" → zoom_in       │
│  Added to personal command list     │
└─────────────────────────────────────┘
```

## Implementation Phases

### Phase 1: Smart Mode Foundation (Current)
- [x] Focus detection (text field vs not)
- [x] Commands-only mode when not in text input
- [x] Visual indicator in menu bar
- [ ] Context awareness (which app is focused)

### Phase 2: Command Learning System
- [ ] Personal command dictionary (JSON file)
- [ ] "Computer learn" voice command to enter training mode
- [ ] Simple confirmation via voice ("yes"/"no"/"cancel")
- [ ] Command suggestion based on context
- [ ] Export/import learned commands

### Phase 3: Local Intent Classification
- [ ] Evaluate local models (TinyLlama, DistilBERT, Phi-2)
- [ ] Train intent classifier on common command patterns
- [ ] Fuzzy matching for similar phrases
- [ ] Confidence scoring system
- [ ] Fallback to API when confidence low

### Phase 4: Claude API Integration
- [ ] Haiku integration for understanding unclear commands
- [ ] Context-aware command suggestions
- [ ] Action confirmation workflow
- [ ] Rate limiting and caching
- [ ] Offline fallback behavior

### Phase 5: Advanced Features
- [ ] Multi-step command sequences ("computer, copy this and paste in notes")
- [ ] Conditional commands ("if in browser, open new tab")
- [ ] Command macros ("computer morning routine")
- [ ] Voice-based command editing ("computer, change zoom in to make bigger")
- [ ] Shared command libraries (community commands)

## Technical Components

### Personal Command Dictionary

```json
{
  "version": 1,
  "learned_commands": [
    {
      "phrase": "make this bigger",
      "variations": ["zoom in", "enlarge", "make bigger"],
      "action": "zoom_in",
      "context": "any",
      "learned_at": "2024-12-08T17:00:00Z",
      "use_count": 15,
      "confidence": 0.95
    }
  ],
  "pending_commands": [
    {
      "phrase": "do the thing",
      "suggested_action": "unknown",
      "context": "terminal",
      "status": "needs_training",
      "created_at": "2024-12-08T17:30:00Z"
    }
  ]
}
```

### Intent Classification Categories

```
NAVIGATION
├── scroll_up, scroll_down
├── page_up, page_down
├── go_back, go_forward
└── focus_next, focus_previous

TEXT_EDITING
├── select_all, select_word, select_line
├── copy, paste, cut
├── undo, redo
└── delete, backspace

SYSTEM
├── volume_up, volume_down, mute
├── brightness_up, brightness_down
├── screenshot
└── lock_screen

APP_CONTROL
├── new_window, close_window
├── new_tab, close_tab
├── minimize, maximize
└── switch_app

CUSTOM
├── user_defined_actions
└── app_specific_commands
```

### Confirmation Voice Commands

```
Positive: "yes", "yeah", "correct", "do it", "go ahead", "affirmative"
Negative: "no", "nope", "cancel", "nevermind", "stop"
Clarify: "what?", "repeat", "say again", "explain"
Different: "something else", "different", "not that"
```

## User Experience Goals

1. **Zero Configuration Start**
   - Works out of the box with common commands
   - No setup required for basic use

2. **Natural Learning Curve**
   - Start with simple commands
   - App suggests when it doesn't understand
   - Learning happens through normal use

3. **Voice-First Configuration**
   - "Computer, learn new command"
   - "Computer, what can you do?"
   - "Computer, forget that command"

4. **Transparent Intelligence**
   - Show when AI is being used
   - Explain why actions are taken
   - Allow easy correction

5. **Privacy Conscious**
   - Local processing when possible
   - Clear indication when using cloud API
   - Option for fully offline mode

## API Cost Considerations

Using Claude Haiku for command understanding:
- ~$0.25 per million input tokens
- ~$1.25 per million output tokens
- Average command: ~50 tokens in, ~30 tokens out
- Cost per command: ~$0.00005 (0.005 cents)
- 1000 training interactions: ~$0.05

**Optimization Strategies:**
- Cache common patterns locally
- Batch similar unclear commands
- Progressive learning reduces API calls over time
- Local model handles 80%+ after training

## Files to Create

```
src/
├── services/
│   ├── intent-classifier.js    # Local intent classification
│   ├── command-learner.js      # Learning system
│   └── claude-understander.js  # API integration
├── data/
│   └── default-intents.json    # Pre-trained intents
~/.config/speech2type/
├── learned-commands.json       # User's learned commands
└── command-history.json        # Usage analytics (local only)
```

## Success Metrics

- **Recognition Rate**: % of commands understood without training
- **Learning Efficiency**: Commands needed before automatic recognition
- **Response Time**: Time from speech to action
- **User Satisfaction**: Reduced "computer, what?" moments
- **API Efficiency**: Decreasing API calls over time

## Open Questions

1. Should training mode be opt-in or default?
2. How to handle ambiguous commands with multiple possible actions?
3. Should learned commands sync across devices?
4. How to prevent accidental command learning?
5. What's the right balance between local and cloud processing?

---

*This document outlines the vision for AI-powered command understanding in Speech2Type. Implementation will be iterative, starting with Phase 2 (Command Learning System).*
