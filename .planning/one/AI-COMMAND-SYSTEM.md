# AI Command Understanding System

> How ONE learns to understand you

## Overview

The AI Command Understanding system replaces rigid exact-phrase matching with intelligent intent resolution. Instead of coding 50 variations of "play music", ONE understands what you *mean*.

## Three-Tier Architecture

```
User speaks: "crank up the volume"
                 ↓
┌─────────────────────────────────────────────────────────────┐
│  TIER 1: Local Dictionary Lookup (<5ms)                     │
│  Check personal_commands.json for exact/fuzzy match         │
│  ✓ Match found → Execute immediately                        │
│  ✗ No match → Tier 2                                        │
└─────────────────────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────┐
│  TIER 2: Pattern Matching (~10ms)                           │
│  Check regex patterns, synonyms, phonetic similarity        │
│  ✓ High confidence match → Execute                          │
│  ✗ Low confidence → Tier 3                                  │
└─────────────────────────────────────────────────────────────┘
                 ↓
┌─────────────────────────────────────────────────────────────┐
│  TIER 3: Claude Haiku Intent Resolution (~200ms)            │
│  Send phrase + context to Claude Haiku                      │
│  Get intent + confidence                                    │
│  If confident → Execute + optionally learn                  │
│  If uncertain → Ask user to confirm                         │
└─────────────────────────────────────────────────────────────┘
```

## Personal Command Dictionary

Stored at `~/.config/one/personal_commands.json`:

```json
{
  "version": "1.0.0",
  "commands": [
    {
      "id": "cmd_001",
      "phrases": ["crank it up", "louder", "turn it up"],
      "action": "volume_up",
      "context": {
        "apps": ["Spotify", "Music", "any"],
        "modes": ["general", "music"]
      },
      "learned_at": "2024-12-08T21:00:00Z",
      "use_count": 47,
      "last_used": "2024-12-08T20:30:00Z",
      "confidence": 0.98
    },
    {
      "id": "cmd_002",
      "phrases": ["nuke it", "burn it down", "start fresh"],
      "action": "clear_all_reset",
      "context": {
        "apps": ["any"],
        "modes": ["any"]
      },
      "learned_at": "2024-12-08T19:00:00Z",
      "use_count": 5,
      "last_used": "2024-12-08T19:45:00Z",
      "confidence": 0.95
    }
  ],
  "workflows": [
    {
      "id": "wf_001",
      "name": "morning routine",
      "phrases": ["morning routine", "start my day", "good morning"],
      "steps": [
        {"action": "focus_app", "params": {"app": "Slack"}},
        {"action": "focus_app", "params": {"app": "Mail"}},
        {"action": "focus_app", "params": {"app": "Calendar"}},
        {"action": "play_playlist", "params": {"playlist": "lo-fi beats"}}
      ],
      "created_at": "2024-12-08T08:00:00Z",
      "use_count": 12
    }
  ],
  "context_rules": [
    {
      "app": "Ableton Live",
      "command_overrides": {
        "play": "transport_play",
        "stop": "transport_stop",
        "record": "transport_record"
      }
    },
    {
      "app": "VS Code",
      "command_overrides": {
        "run": "npm_start",
        "test": "npm_test",
        "build": "npm_build"
      }
    }
  ]
}
```

## Intent Resolution Prompt

When Tier 3 is triggered, send to Claude Haiku:

```
You are a voice command intent resolver for ONE, a voice control system.

CONTEXT:
- Current app: {focused_app}
- Current mode: {mode}
- Recent commands: {last_5_commands}
- Available actions: {action_list}

USER SAID: "{transcribed_phrase}"

TASK:
1. Determine the most likely intended action
2. Rate your confidence (0.0 - 1.0)
3. If parameters needed, extract them

RESPOND IN JSON:
{
  "intent": "action_name",
  "confidence": 0.85,
  "params": {},
  "reasoning": "brief explanation"
}

If you cannot determine intent with >0.5 confidence, respond:
{
  "intent": null,
  "confidence": 0.0,
  "suggestions": ["possible_action_1", "possible_action_2"],
  "reasoning": "why uncertain"
}
```

## Learning Flow

### Automatic Learning (High Confidence)

```
User: "bump up the volume"
Tier 3: {intent: "volume_up", confidence: 0.92}

ONE: *executes volume_up*
ONE: *adds "bump up the volume" to volume_up phrases*
ONE: "Volume up." (no confirmation needed, confidence high)
```

### Confirmation Learning (Medium Confidence)

```
User: "make it louder mate"
Tier 3: {intent: "volume_up", confidence: 0.71}

ONE: "Did you mean turn up the volume?"
User: "yes" / "affirmative"

ONE: *executes volume_up*
ONE: *adds "make it louder mate" to volume_up phrases*
ONE: *boosts confidence for similar patterns*
```

### Training Mode (Explicit Learning)

```
User: "Computer, learn"
ONE: "Training mode. What should I learn?"

User: "When I say 'yeet', delete the selected text"
ONE: "Got it. 'Yeet' will delete selection. Want to add variations?"

User: "Also 'get rid of it'"
ONE: "Added. 'Yeet' or 'get rid of it' will delete selection. Confirm?"

User: "Affirmative"
ONE: "Learned. Training mode off."
```

## API Integration

### Secure Key Storage

```javascript
// src/services/secrets.js
import keytar from 'keytar';

const SERVICE_NAME = 'one-voice';

export async function getAnthropicKey() {
  return await keytar.getPassword(SERVICE_NAME, 'anthropic_api_key');
}

export async function setAnthropicKey(key) {
  await keytar.setPassword(SERVICE_NAME, 'anthropic_api_key', key);
}
```

Uses macOS Keychain - never stored in plain text files.

### Intent Resolver Service

```javascript
// src/services/intent-resolver.js
import Anthropic from '@anthropic-ai/sdk';
import { getAnthropicKey } from './secrets.js';
import { loadPersonalCommands, savePersonalCommands } from './commands.js';

const HAIKU_MODEL = 'claude-3-haiku-20240307';

export class IntentResolver {
  constructor() {
    this.client = null;
    this.commands = null;
  }

  async init() {
    const apiKey = await getAnthropicKey();
    if (!apiKey) throw new Error('Anthropic API key not configured');

    this.client = new Anthropic({ apiKey });
    this.commands = await loadPersonalCommands();
  }

  async resolve(phrase, context) {
    // Tier 1: Exact/fuzzy match in personal dictionary
    const tier1 = this.lookupLocal(phrase);
    if (tier1.confidence > 0.9) return tier1;

    // Tier 2: Pattern matching
    const tier2 = this.matchPatterns(phrase, context);
    if (tier2.confidence > 0.85) return tier2;

    // Tier 3: Claude Haiku
    const tier3 = await this.askClaude(phrase, context);

    // Learn if confident
    if (tier3.confidence > 0.7) {
      await this.learnPhrase(phrase, tier3.intent);
    }

    return tier3;
  }

  lookupLocal(phrase) {
    const normalized = phrase.toLowerCase().trim();

    for (const cmd of this.commands.commands) {
      for (const p of cmd.phrases) {
        if (p.toLowerCase() === normalized) {
          return { intent: cmd.action, confidence: 1.0, source: 'exact' };
        }
        // Fuzzy match (Levenshtein distance < 2)
        if (this.fuzzyMatch(p, normalized)) {
          return { intent: cmd.action, confidence: 0.92, source: 'fuzzy' };
        }
      }
    }

    return { intent: null, confidence: 0, source: 'none' };
  }

  async askClaude(phrase, context) {
    const response = await this.client.messages.create({
      model: HAIKU_MODEL,
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: this.buildPrompt(phrase, context)
      }]
    });

    return JSON.parse(response.content[0].text);
  }

  async learnPhrase(phrase, intent) {
    const cmd = this.commands.commands.find(c => c.action === intent);
    if (cmd && !cmd.phrases.includes(phrase)) {
      cmd.phrases.push(phrase);
      cmd.use_count++;
      cmd.last_used = new Date().toISOString();
      await savePersonalCommands(this.commands);
    }
  }
}
```

## Cost Analysis

### Claude Haiku Pricing (as of Dec 2024)
- Input: $0.25 / 1M tokens
- Output: $0.125 / 1M tokens

### Per-Command Cost
- Average prompt: ~200 tokens input
- Average response: ~50 tokens output
- **Cost per resolution: ~$0.00005** (1/20th of a cent)

### Monthly Estimates
| Usage | Tier 3 Calls | Cost |
|-------|--------------|------|
| Light (50/day) | 1,500/month | $0.08 |
| Medium (200/day) | 6,000/month | $0.30 |
| Heavy (500/day) | 15,000/month | $0.75 |

As dictionary grows, Tier 3 calls decrease (more Tier 1 hits).

## Privacy Considerations

1. **Local-first**: Personal dictionary stored locally only
2. **Minimal context**: Only send necessary context to Claude
3. **No logging**: Anthropic doesn't train on API calls
4. **Opt-in**: User explicitly enables AI understanding
5. **Offline fallback**: Tier 1+2 work without internet

## Configuration

```json
// ~/.config/one/settings.json
{
  "intent_resolution": {
    "enabled": true,
    "tier3_enabled": true,
    "auto_learn": true,
    "learn_threshold": 0.7,
    "confirm_threshold": 0.5,
    "max_tier3_per_minute": 10
  }
}
```

## Future: Local Intent Resolution

Replace Tier 3 with local model:
- Fine-tuned small LLM (Phi-3, Llama-3 8B)
- Trained on your personal command history
- Zero latency, zero cost, full privacy
- Export personal dictionary as training data
