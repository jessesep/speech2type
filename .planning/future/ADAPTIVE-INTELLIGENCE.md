# ONE Adaptive Intelligence

> From static commands to truly intelligent, personalized AI assistance

## Vision Statement

Transform ONE from a **command interpreter** into an **adaptive intelligent assistant** that:
- Learns each user's unique speech patterns and vocabulary
- Predicts intent before the user finishes speaking
- Proactively suggests automations based on observed behavior
- Builds a personalized language model that understands context
- Respects privacy by keeping all learning strictly local

This is the evolution from "voice commands" to "AI companion."

---

## Core Principles

### 1. Privacy-First Learning
**All training data stays on-device. Always.**

```
┌─────────────────────────────────────────────────────────────┐
│                    PRIVACY ARCHITECTURE                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  User Speech                                                 │
│      ↓                                                       │
│  Local STT (Whisper)                                         │
│      ↓                                                       │
│  Local Intent Model                                          │
│      ↓                                                       │
│  Local Storage (~/.config/one/learning/)                     │
│      ↓                                                       │
│  Local Training (on-device only)                             │
│                                                              │
│  ✅ Data never uploaded to cloud                             │
│  ✅ User can delete learning data anytime                    │
│  ✅ Opt-in required for all learning features                │
│  ✅ Transparent data usage (view what's stored)              │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 2. Gradual Intelligence
Start simple, get smarter over time.

```
Week 1:  Static command matching (current ONE behavior)
Week 2:  Learns common synonyms ("focus" = "switch to" = "open")
Month 1: Predicts next command based on time of day
Month 3: Suggests workflow automations
Month 6: Personalized wake word, accent adaptation
Year 1:  Fully personalized voice AI
```

### 3. Explainable AI
Users should understand why ONE behaves the way it does.

```
User: "Why did you open Slack when I said 'message the team'?"

ONE: "I learned that when you say 'message the team,' you usually
      mean Slack (8/10 times). You can say 'no, I meant Discord'
      to correct me."
```

---

## Feature Pillars

### Pillar A: Predictive Intent

**Goal:** Reduce latency by predicting what the user will say.

#### How It Works

```javascript
// Real-time prediction engine
class PredictiveIntent {
  constructor() {
    this.model = null;  // Trained local model
    this.partialInput = '';
    this.predictions = [];
  }

  onPartialTranscript(partial) {
    this.partialInput = partial;

    // Update predictions in real-time as user speaks
    this.predictions = this.model.predict(partial, {
      context: this.getCurrentContext(),
      history: this.getRecentCommands(),
      timeOfDay: new Date().getHours()
    });

    // If high confidence (>90%), preload the action
    const topPrediction = this.predictions[0];
    if (topPrediction.confidence > 0.9) {
      this.preloadAction(topPrediction.action);
    }
  }

  onFinalTranscript(final) {
    // Execute the predicted action if it matches
    const match = this.predictions.find(p => p.matches(final));

    if (match && match.confidence > 0.85) {
      // Fast path - action already preloaded
      return match.execute();
    } else {
      // Slow path - fallback to normal intent resolution
      return this.resolveIntent(final);
    }
  }

  getCurrentContext() {
    return {
      app: getCurrentApp(),
      recentApps: getRecentApps(5),
      timeOfDay: new Date().getHours(),
      dayOfWeek: new Date().getDay(),
      clipboardContent: getClipboard(),  // for context-aware actions
    };
  }
}
```

#### Example: Prediction in Action

```
[9:03 AM - User opens laptop]

User starts speaking: "Can you..."

ONE (internal predictions):
  92% → focus terminal
  87% → focus VS Code
  74% → focus Slack

User continues: "Can you focus..."

ONE (updated predictions):
  95% → focus terminal
  91% → focus VS Code
  23% → focus Slack

User finishes: "Can you focus the terminal"

ONE: *Already preloaded Terminal focus, executes in <50ms*
     "Focused Terminal" (vs ~300ms without prediction)
```

#### Learning Signal

```javascript
// Track prediction accuracy to improve model
{
  predicted: "focus terminal",
  actual: "focus VS Code",
  confidence: 0.95,
  context: { hour: 9, app: "Slack" },
  timestamp: "2025-12-08T09:03:00Z"
}

// If prediction wrong, learn:
// - At 9 AM, after Slack, user usually means VS Code not Terminal
// - Adjust model weights accordingly
```

---

### Pillar B: Behavioral Pattern Learning

**Goal:** Observe user habits and suggest automations.

#### Pattern Detection

```javascript
class BehaviorPatternDetector {
  constructor() {
    this.observations = [];
    this.patterns = [];
  }

  async detectPatterns() {
    // Example: User always opens these 3 apps in sequence
    const appSequences = this.detectSequentialActions('app:open', {
      minOccurrences: 5,
      withinMinutes: 10
    });

    // Example: User says "morning routine" every weekday at 9 AM
    const timePatterns = this.detectTimeBasedPatterns({
      minOccurrences: 10,
      tolerance: 30  // minutes
    });

    // Example: User always focuses Chrome after Terminal
    const triggerPatterns = this.detectTriggerPatterns({
      minOccurrences: 8
    });

    return {
      appSequences,
      timePatterns,
      triggerPatterns
    };
  }

  detectSequentialActions(actionType, options) {
    // Find frequently repeated action sequences
    const sequences = new Map();

    // Sliding window over user's action history
    for (let i = 0; i < this.observations.length - 2; i++) {
      const window = this.observations.slice(i, i + 3);

      // Check if all actions in window match type and time constraints
      if (this.isValidSequence(window, actionType, options)) {
        const key = window.map(a => a.target).join(' → ');
        sequences.set(key, (sequences.get(key) || 0) + 1);
      }
    }

    // Filter by minimum occurrences
    return Array.from(sequences.entries())
      .filter(([_, count]) => count >= options.minOccurrences)
      .map(([sequence, count]) => ({
        pattern: sequence,
        occurrences: count,
        confidence: count / this.observations.length
      }));
  }
}
```

#### Pattern Suggestions

```
ONE detects pattern:
  "User opens Terminal → VS Code → Spotify every morning"

ONE suggests (via notification):
  "I notice you open these apps every morning.
   Want me to create a 'morning setup' workflow?"

  [Yes, create workflow]  [Not now]  [Don't ask again]

If user accepts:
  → Creates workflow with trigger phrase "morning setup"
  → User can now say "morning setup" to open all 3 apps
```

#### Example Patterns

```yaml
patterns:
  - type: sequential_apps
    name: "Morning Dev Setup"
    sequence:
      - app:open Terminal
      - app:open "Visual Studio Code"
      - app:open Spotify
    occurrences: 12
    suggested_trigger: "morning setup"
    status: "suggested"

  - type: time_based
    name: "9 AM Standup Prep"
    time: "09:00"
    days: [1, 2, 3, 4, 5]  # Monday-Friday
    actions:
      - app:open Slack
      - url:open "https://meet.google.com/standup"
    occurrences: 23
    suggested_trigger: "standup time"
    status: "accepted"

  - type: trigger
    name: "After committing, always push"
    trigger: "terminal:git commit"
    followup: "terminal:git push"
    delay: 2000  # ms
    occurrences: 18
    suggested: "Automatically push after commit?"
    status: "dismissed"

  - type: context_switch
    name: "Coding mode"
    pattern:
      - User focuses VS Code
      - User sets Slack to DND
      - User starts music
    occurrences: 8
    suggested_trigger: "focus mode"
    status: "pending"
```

---

### Pillar C: Personalized Language Model

**Goal:** Fine-tune a local small LLM on user's vocabulary and style.

#### Training Data Collection

```javascript
// ~/.config/one/learning/training_data.jsonl
// User's spoken commands (with consent)

{"text": "focus the terminal", "intent": "app_focus", "target": "Terminal", "confidence": 1.0}
{"text": "switch to my code editor", "intent": "app_focus", "target": "VS Code", "confidence": 1.0}
{"text": "play some tunes", "intent": "media_play", "confidence": 0.9}
{"text": "bigger", "intent": "zoom_in", "app": "Figma", "confidence": 1.0}
{"text": "bigger", "intent": "font_size_increase", "app": "VS Code", "confidence": 1.0}
// Note: "bigger" has different meanings in different apps
```

#### Model Fine-Tuning

```python
# scripts/train-personal-model.py
# Runs locally on user's machine (optional, compute-intensive)

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

def train_personal_model(user_data_path):
    # Start with a small base model (Phi-3-mini: 2GB)
    base_model = "microsoft/Phi-3-mini-4k-instruct"
    tokenizer = AutoTokenizer.from_pretrained(base_model)
    model = AutoModelForSequenceClassification.from_pretrained(
        base_model,
        num_labels=NUM_INTENT_CLASSES
    )

    # Load user's training data
    training_data = load_jsonl(user_data_path)

    # Fine-tune on user's specific commands and corrections
    # (LoRA fine-tuning for efficiency - only trains small adapter)
    from peft import LoraConfig, get_peft_model

    lora_config = LoraConfig(
        r=8,  # Low rank
        lora_alpha=32,
        target_modules=["q_proj", "v_proj"],
        lora_dropout=0.05,
        bias="none"
    )

    model = get_peft_model(model, lora_config)

    # Train for a few epochs
    trainer = Trainer(
        model=model,
        args=training_args,
        train_dataset=training_data,
    )

    trainer.train()

    # Save personalized model
    model.save_pretrained("~/.config/one/models/personal/")

    return {
        "model_size": "2.1 GB",
        "training_samples": len(training_data),
        "accuracy": evaluate_model(model, test_data)
    }
```

#### Benefits of Personal Model

```
Generic Intent Model:
  User: "focus the thing I was coding in"
  → Unclear, needs clarification

Personalized Intent Model (trained on user's history):
  User: "focus the thing I was coding in"
  → Knows user calls VS Code "the thing I was coding in"
  → Executes: focus VS Code
  → Latency: ~50ms (local inference)
```

---

### Pillar D: Proactive Assistance

**Goal:** ONE suggests actions before being asked.

#### Proactive Triggers

```javascript
class ProactiveAssistant {
  constructor() {
    this.triggers = [
      new TimeBasedTrigger(),
      new ContextSwitchTrigger(),
      new ErrorDetectionTrigger(),
      new HabitReminderTrigger()
    ];
  }

  async monitor() {
    // Continuously monitor system state
    setInterval(async () => {
      for (const trigger of this.triggers) {
        const suggestion = await trigger.check();

        if (suggestion && suggestion.confidence > 0.7) {
          this.suggestAction(suggestion);
        }
      }
    }, 5000);  // Check every 5 seconds
  }

  suggestAction(suggestion) {
    // Show subtle notification (not intrusive)
    this.showSuggestion({
      message: suggestion.message,
      action: suggestion.action,
      dismissable: true,
      timeout: 10000  // Auto-dismiss after 10s
    });
  }
}

class TimeBasedTrigger {
  async check() {
    const now = new Date();
    const hour = now.getHours();
    const day = now.getDay();

    // Check learned patterns for this time
    const patterns = await getTimeBasedPatterns(hour, day);

    if (patterns.length > 0) {
      const pattern = patterns[0];

      // Only suggest if user hasn't already done it
      if (!pattern.alreadyExecutedToday()) {
        return {
          message: pattern.suggestion,
          action: pattern.action,
          confidence: pattern.confidence
        };
      }
    }

    return null;
  }
}

class ErrorDetectionTrigger {
  async check() {
    // Monitor terminal output for errors
    const activeApp = await getCurrentApp();

    if (activeApp.name === 'Terminal') {
      const output = await getRecentTerminalOutput();

      // Detect common error patterns
      if (output.includes('npm ERR!')) {
        return {
          message: "npm install failed. Want me to try 'npm cache clean'?",
          action: "terminal:npm cache clean --force && npm install",
          confidence: 0.8
        };
      }

      if (output.includes('command not found')) {
        const command = extractMissingCommand(output);
        return {
          message: `'${command}' not found. Should I search for install instructions?`,
          action: `url:open https://www.google.com/search?q=install+${command}`,
          confidence: 0.75
        };
      }
    }

    return null;
  }
}
```

#### Example Proactive Suggestions

```
[9:00 AM - User logs in]
ONE: "Good morning. You have a standup in 30 minutes.
      Want me to run your morning prep workflow?"
      [Yes] [No] [Remind me in 15 min]

---

[User has been coding for 2 hours straight]
ONE: "You've been focused for a while. Want me to enable
      Do Not Disturb for another hour?"
      [Yes] [No]

---

[Build fails with "Module not found" error]
ONE: "Build failed. Looks like a missing dependency.
      Should I run 'npm install'?"
      [Yes] [No] [Show error]

---

[User says "ugh" after a failed git push]
ONE: "Push failed. Want me to pull first and try again?"
      [Yes] [No] [Show error]

---

[User opens Chrome → Gmail → Calendar every morning]
ONE: "I notice you always open these 3 apps in the morning.
      Want to create a 'morning routine' command?"
      [Yes, create it] [Not now] [Stop suggesting this]
```

---

## Technical Implementation

### On-Device Learning Pipeline

```
┌─────────────────────────────────────────────────────────────┐
│               LEARNING PIPELINE (ALL LOCAL)                  │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Data Collection                                          │
│     ↓                                                        │
│     User's voice commands (with consent)                     │
│     Corrections ("no, I meant...")                           │
│     Workflow executions                                      │
│     Context (time, app, recent actions)                      │
│                                                              │
│  2. Pattern Detection (daily)                                │
│     ↓                                                        │
│     Sequential patterns                                      │
│     Time-based patterns                                      │
│     Context-based patterns                                   │
│                                                              │
│  3. Model Training (weekly, overnight)                       │
│     ↓                                                        │
│     Fine-tune intent classifier                              │
│     Update prediction weights                                │
│     Retrain voice adaptation layer                           │
│                                                              │
│  4. Deployment (automatic)                                   │
│     ↓                                                        │
│     Hot-swap updated model                                   │
│     A/B test (old vs new model)                              │
│     Rollback if accuracy drops                               │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Data Storage

```
~/.config/one/learning/
├── training_data.jsonl        # Collected commands
├── corrections.jsonl          # User corrections
├── patterns.json              # Detected patterns
├── personal_model/            # Fine-tuned model
│   ├── model.onnx            # Optimized for inference
│   └── metadata.json
└── stats.json                 # Learning metrics
```

### Privacy Controls

```javascript
// User controls in settings
const learningSettings = {
  enabled: true,  // Master switch

  collect: {
    transcripts: true,      // Store what user says
    corrections: true,      // Store "no, I meant..." corrections
    context: true,          // Store time, app, etc.
    clipboard: false        // Don't store clipboard data
  },

  training: {
    enabled: true,          // Allow local model training
    schedule: 'overnight',  // When to train (daily/weekly)
    gpu: true               // Use GPU if available
  },

  proactive: {
    enabled: true,          // Allow proactive suggestions
    frequency: 'moderate',  // low/moderate/high
    areas: {
      timeBased: true,      // Morning routine suggestions
      errorDetection: true, // Build error assistance
      habitReminders: false // Don't remind about habits
    }
  },

  dataRetention: {
    keepDays: 90,           // Auto-delete old training data
    exportable: true        // User can export their data
  }
};
```

### Transparency Dashboard

```
┌─────────────────────────────────────────────────────────────┐
│  ONE Learning Dashboard                                      │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  📊 Your Personal Model                                      │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  Training data: 1,247 commands                         │ │
│  │  Model size: 2.1 GB                                    │ │
│  │  Accuracy: 94.2% (↑2.3% this week)                     │ │
│  │  Last trained: 2 days ago                              │ │
│  │                                                        │ │
│  │  [View Training Data] [Retrain Now] [Delete All Data] │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  🎯 Detected Patterns (12)                                   │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  ✅ Morning dev setup (accepted)                       │ │
│  │     Terminal → VS Code → Spotify                       │ │
│  │     Triggered 23 times                                 │ │
│  │                                                        │ │
│  │  💭 After git commit, always push (suggested)          │ │
│  │     Detected 18 times                                  │ │
│  │     [Accept] [Dismiss]                                 │ │
│  │                                                        │ │
│  │  [View All Patterns]                                   │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
│  🔒 Privacy                                                  │
│  ┌────────────────────────────────────────────────────────┐ │
│  │  ✅ All learning happens on-device                     │ │
│  │  ✅ No data sent to cloud                              │ │
│  │  ✅ You can delete all data anytime                    │ │
│  │                                                        │ │
│  │  [Export My Data] [Delete All Learning Data]           │ │
│  └────────────────────────────────────────────────────────┘ │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## User Experience

### Onboarding

```
First launch after upgrading to v2.0:

┌─────────────────────────────────────────────────────────────┐
│  Welcome to ONE 2.0 - Now with Adaptive Intelligence!       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ONE can now learn from your usage to become more helpful:  │
│                                                              │
│  ✓ Predict what you'll say (faster response)                │
│  ✓ Suggest workflow automations                             │
│  ✓ Adapt to your vocabulary and accent                      │
│  ✓ Proactively help with errors                             │
│                                                              │
│  🔒 Privacy Promise:                                         │
│     • All learning happens on YOUR device                   │
│     • NO data is uploaded to the cloud                      │
│     • You control what's collected                          │
│     • Delete your data anytime                              │
│                                                              │
│  [Enable Adaptive Intelligence]  [Maybe Later]  [Learn More] │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Learning in Action

```
Week 1:
  User: "focus the terminal"
  ONE: [executes normally]

Week 2:
  User: "focus the term..."
  ONE: [predicts and focuses Terminal before user finishes]

Week 3:
  ONE detects morning pattern, suggests workflow

Week 4:
  User: "start my morning"
  ONE: "Opening Terminal, VS Code, and Spotify" (learned workflow)

Month 2:
  User: "focus the thing I code in"
  ONE: [focuses VS Code - learned user's nickname for it]

Month 3:
  [9:00 AM]
  ONE: "Morning standup in 30 min. Run your prep workflow?" (proactive)
```

---

## Success Metrics

### User Satisfaction
- User enables adaptive features: >70%
- User keeps adaptive features enabled after 1 month: >85%
- User satisfaction with predictions: >4.5/5 stars

### Performance
- Prediction accuracy: >90%
- Latency reduction with prediction: 50%+ (300ms → <150ms)
- Pattern detection precision: >85%

### Engagement
- Patterns suggested per user: 5-10 (first month)
- Pattern acceptance rate: >40%
- Workflows created from patterns: 2+ per user

### Privacy
- Users who review their training data: >10%
- Users who export their data: >5%
- Data deletion requests: <2% (low = trust)

---

## Implementation Phases

### Phase AI-1: Foundation (v2.0)
**Timeline:** 3 months

**Goals:**
- Data collection infrastructure
- Basic pattern detection (sequential apps)
- Privacy controls and dashboard

**Deliverables:**
- Learning data storage
- Transparent data viewer
- Simple pattern suggestions (app sequences)

### Phase AI-2: Prediction (v2.1)
**Timeline:** 3 months

**Goals:**
- Real-time intent prediction
- Preloading for faster execution
- Feedback loop for improving accuracy

**Deliverables:**
- Predictive engine
- 50% latency reduction for common commands
- Prediction accuracy dashboard

### Phase AI-3: Personalization (v2.2)
**Timeline:** 4 months

**Goals:**
- Personal model fine-tuning
- Vocabulary and accent adaptation
- Context-aware intent resolution

**Deliverables:**
- Local fine-tuning pipeline
- Personal model (Phi-3-mini + LoRA)
- 95%+ accuracy on user's vocabulary

### Phase AI-4: Proactive (v2.3)
**Timeline:** 3 months

**Goals:**
- Proactive suggestions
- Error detection and assistance
- Time-based automation

**Deliverables:**
- Proactive assistant engine
- Error detection for common tools (npm, git, etc.)
- Habit reminders

---

## Advanced Features (Post v2.5)

### Voice Biometrics (Security)

```javascript
// Verify it's actually the authorized user speaking
class VoiceBiometrics {
  async enrollUser() {
    // User reads 5 sentences to create voiceprint
    const voiceprint = await this.createVoiceprint(recordings);

    // Store locally (encrypted)
    await this.storeVoiceprint(voiceprint);
  }

  async verifyUser(audioSample) {
    const userVoiceprint = await this.loadVoiceprint();
    const similarity = await this.compareVoiceprints(audioSample, userVoiceprint);

    return similarity > 0.85;  // Threshold
  }
}

// Usage:
if (!await voiceBiometrics.verifyUser(audioSample)) {
  return "Voice not recognized. Authentication required.";
}
```

### Emotion Detection

```javascript
// Detect user's emotional state from voice
class EmotionDetection {
  async detectEmotion(audioSample) {
    // Analyze prosody, pitch, speaking rate
    const features = await this.extractFeatures(audioSample);
    const emotion = await this.classifyEmotion(features);

    return emotion;  // 'neutral', 'frustrated', 'happy', etc.
  }
}

// Adapt behavior based on emotion:
if (emotion === 'frustrated') {
  // User struggling - offer more help
  this.enableProactiveMode();
} else if (emotion === 'focused') {
  // User in flow - minimize interruptions
  this.disableProactiveMode();
}
```

### Multi-User Support

```javascript
// Support multiple users on same machine
class MultiUserSupport {
  async identifyUser(audioSample) {
    // Voice biometrics to identify which user is speaking
    const voiceprint = await this.extractVoiceprint(audioSample);

    for (const user of this.registeredUsers) {
      if (await this.matchesVoiceprint(voiceprint, user.voiceprint)) {
        // Load this user's personal model and preferences
        await this.loadUserContext(user);
        return user;
      }
    }

    return null;  // Unknown user
  }
}
```

---

## Open Questions

1. **Training Frequency**
   - How often should we retrain the personal model?
   - Daily (high compute) vs weekly (delayed learning)?

2. **Model Size Tradeoffs**
   - Phi-3-mini (2GB) vs Phi-3-small (7GB)?
   - Better accuracy vs more storage/compute?

3. **Proactive Aggressiveness**
   - How many suggestions before it's annoying?
   - Should we adapt based on user acceptance rate?

4. **Cross-Device Learning**
   - Should learned patterns sync between user's machines?
   - How to maintain privacy if syncing?

5. **Error Recovery**
   - What if personal model becomes less accurate?
   - Auto-rollback mechanism?

---

## Competitive Analysis

### vs Siri/Alexa/Google Assistant

| Feature | ONE (Adaptive) | Siri/Alexa/Google |
|---------|----------------|-------------------|
| Privacy | 100% local | Cloud-based |
| Personalization | Deep (personal model) | Limited |
| Developer focus | Yes | General consumer |
| Latency | <100ms (local) | 300-500ms (cloud) |
| Offline | Full capability | Limited |
| Learning | On-device | Cloud ML |

### vs Talon Voice

| Feature | ONE (Adaptive) | Talon |
|---------|----------------|-------|
| Learning curve | Easy | Steep |
| Personalization | Automatic | Manual |
| Use case | General + dev | Accessibility + dev |
| Price | Free/Pro | $15/month |

---

*Last updated: 2025-12-08 by dreamer*
