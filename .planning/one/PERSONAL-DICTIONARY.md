# Personal Command Dictionary (Task 1.2)

> The learning layer that makes ONE get smarter over time

## Overview

The Personal Command Dictionary stores user-specific phrase→action mappings that enable:
1. **Tier 1 matching** - Instant local lookup, no API call
2. **Learning** - New phrases added automatically when AI resolves with high confidence
3. **Fuzzy matching** - Tier 2 handles typos and variations
4. **Personalization** - Each user builds their own vocabulary

## File Location

```
~/.config/one/personal_commands.json
```

## Data Structure

```json
{
  "version": "1.0.0",
  "created_at": "2024-12-08T12:00:00Z",
  "updated_at": "2024-12-08T21:00:00Z",

  "commands": [
    {
      "id": "cmd_001",
      "action": "volume_up",
      "phrases": [
        "turn it up",
        "louder",
        "crank it up",
        "bump the volume"
      ],
      "source": "learned",
      "confidence": 0.95,
      "use_count": 47,
      "last_used": "2024-12-08T20:30:00Z",
      "created_at": "2024-12-01T10:00:00Z"
    },
    {
      "id": "cmd_002",
      "action": "clear_all",
      "phrases": [
        "nuke it",
        "burn it down",
        "start fresh",
        "wipe it"
      ],
      "source": "trained",
      "confidence": 1.0,
      "use_count": 12,
      "last_used": "2024-12-08T19:45:00Z",
      "created_at": "2024-12-05T14:00:00Z"
    }
  ],

  "workflows": [
    {
      "id": "wf_001",
      "name": "morning routine",
      "phrases": ["morning routine", "start my day"],
      "steps": [
        {"action": "focus_app", "params": {"app": "Slack"}},
        {"action": "focus_app", "params": {"app": "Mail"}},
        {"action": "focus_app", "params": {"app": "Calendar"}}
      ],
      "use_count": 8,
      "created_at": "2024-12-07T08:00:00Z"
    }
  ],

  "context_overrides": [
    {
      "app": "Ableton Live",
      "overrides": {
        "play": "transport_play",
        "stop": "transport_stop"
      }
    }
  ],

  "stats": {
    "total_commands": 47,
    "total_phrases": 156,
    "tier1_hits": 1234,
    "tier2_hits": 89,
    "tier3_hits": 23,
    "last_cleanup": "2024-12-08T00:00:00Z"
  }
}
```

## Implementation

### 1. Core Service

```javascript
// src/services/commands.js
import fs from 'fs';
import path from 'path';
import Fuse from 'fuse.js';  // For fuzzy search

const COMMANDS_PATH = path.join(
  process.env.HOME,
  '.config/one/personal_commands.json'
);

const DEFAULT_COMMANDS = {
  version: '1.0.0',
  commands: [],
  workflows: [],
  context_overrides: [],
  stats: {
    total_commands: 0,
    total_phrases: 0,
    tier1_hits: 0,
    tier2_hits: 0,
    tier3_hits: 0
  }
};

export class CommandDictionary {
  constructor() {
    this.data = null;
    this.fuse = null;  // Fuzzy search index
    this.phraseIndex = new Map();  // phrase → command for O(1) lookup
  }

  async load() {
    try {
      if (fs.existsSync(COMMANDS_PATH)) {
        this.data = JSON.parse(fs.readFileSync(COMMANDS_PATH, 'utf8'));
      } else {
        this.data = { ...DEFAULT_COMMANDS, created_at: new Date().toISOString() };
        await this.save();
      }

      this.buildIndexes();
      console.log(`[Commands] Loaded ${this.data.commands.length} commands, ${this.phraseIndex.size} phrases`);

    } catch (e) {
      console.error('[Commands] Failed to load:', e);
      this.data = { ...DEFAULT_COMMANDS };
    }
  }

  buildIndexes() {
    // Build exact match index
    this.phraseIndex.clear();
    for (const cmd of this.data.commands) {
      for (const phrase of cmd.phrases) {
        this.phraseIndex.set(this.normalize(phrase), cmd);
      }
    }

    // Build fuzzy search index
    const allPhrases = this.data.commands.flatMap(cmd =>
      cmd.phrases.map(phrase => ({
        phrase: this.normalize(phrase),
        action: cmd.action,
        commandId: cmd.id
      }))
    );

    this.fuse = new Fuse(allPhrases, {
      keys: ['phrase'],
      threshold: 0.3,  // 0 = exact, 1 = match anything
      distance: 100,
      includeScore: true
    });
  }

  normalize(phrase) {
    return phrase
      .toLowerCase()
      .trim()
      .replace(/[^\w\s]/g, '')  // Remove punctuation
      .replace(/\s+/g, ' ');     // Normalize whitespace
  }

  // TIER 1: Exact match
  lookupExact(phrase) {
    const normalized = this.normalize(phrase);
    const cmd = this.phraseIndex.get(normalized);

    if (cmd) {
      this.data.stats.tier1_hits++;
      this.recordUsage(cmd.id);
      return {
        action: cmd.action,
        confidence: 1.0,
        tier: 1,
        source: 'exact'
      };
    }

    return null;
  }

  // TIER 2: Fuzzy match
  lookupFuzzy(phrase) {
    const normalized = this.normalize(phrase);
    const results = this.fuse.search(normalized);

    if (results.length > 0 && results[0].score < 0.3) {
      const match = results[0].item;
      const confidence = 1 - results[0].score;

      this.data.stats.tier2_hits++;
      this.recordUsage(match.commandId);

      return {
        action: match.action,
        confidence,
        tier: 2,
        source: 'fuzzy',
        matchedPhrase: match.phrase
      };
    }

    return null;
  }

  // Combined lookup (Tier 1 + 2)
  lookup(phrase) {
    // Try exact first
    const exact = this.lookupExact(phrase);
    if (exact) return exact;

    // Fall back to fuzzy
    const fuzzy = this.lookupFuzzy(phrase);
    if (fuzzy && fuzzy.confidence > 0.7) return fuzzy;

    return null;
  }

  // Learn a new phrase for an action
  async learn(phrase, action, source = 'learned') {
    const normalized = this.normalize(phrase);

    // Check if already exists
    if (this.phraseIndex.has(normalized)) {
      console.log(`[Commands] Phrase already known: "${phrase}"`);
      return false;
    }

    // Find or create command entry
    let cmd = this.data.commands.find(c => c.action === action);

    if (cmd) {
      // Add phrase to existing command
      cmd.phrases.push(phrase);
      cmd.updated_at = new Date().toISOString();
    } else {
      // Create new command entry
      cmd = {
        id: `cmd_${Date.now()}`,
        action,
        phrases: [phrase],
        source,
        confidence: source === 'trained' ? 1.0 : 0.8,
        use_count: 0,
        created_at: new Date().toISOString()
      };
      this.data.commands.push(cmd);
    }

    // Update indexes
    this.phraseIndex.set(normalized, cmd);
    this.data.stats.total_phrases++;
    this.data.updated_at = new Date().toISOString();

    await this.save();
    this.buildIndexes();  // Rebuild fuzzy index

    console.log(`[Commands] Learned: "${phrase}" → ${action}`);
    return true;
  }

  // Forget a phrase
  async forget(phrase) {
    const normalized = this.normalize(phrase);
    const cmd = this.phraseIndex.get(normalized);

    if (!cmd) return false;

    // Remove phrase from command
    cmd.phrases = cmd.phrases.filter(p => this.normalize(p) !== normalized);

    // If no phrases left, remove the command
    if (cmd.phrases.length === 0) {
      this.data.commands = this.data.commands.filter(c => c.id !== cmd.id);
    }

    this.phraseIndex.delete(normalized);
    this.data.stats.total_phrases--;
    this.data.updated_at = new Date().toISOString();

    await this.save();
    this.buildIndexes();

    console.log(`[Commands] Forgot: "${phrase}"`);
    return true;
  }

  recordUsage(commandId) {
    const cmd = this.data.commands.find(c => c.id === commandId);
    if (cmd) {
      cmd.use_count++;
      cmd.last_used = new Date().toISOString();
    }
  }

  async save() {
    const dir = path.dirname(COMMANDS_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(COMMANDS_PATH, JSON.stringify(this.data, null, 2));
  }

  // Get stats for monitoring
  getStats() {
    return {
      ...this.data.stats,
      total_commands: this.data.commands.length,
      total_phrases: this.phraseIndex.size
    };
  }
}

// Singleton
export const commandDictionary = new CommandDictionary();
```

### 2. Integrate with IntentResolver

```javascript
// src/services/intent-resolver.js
import { commandDictionary } from './commands.js';

export class IntentResolver {
  async init() {
    await commandDictionary.load();
    // ... existing init code
  }

  async resolve(phrase, context) {
    // TIER 1 + 2: Check personal dictionary first
    const localMatch = commandDictionary.lookup(phrase);
    if (localMatch && localMatch.confidence > 0.7) {
      return localMatch;
    }

    // TIER 3: Fall back to Claude Haiku
    const aiResult = await this.askClaude(phrase, context);

    // Learn if confident
    if (aiResult.confidence > 0.8 && aiResult.action) {
      await commandDictionary.learn(phrase, aiResult.action, 'learned');
    }

    commandDictionary.data.stats.tier3_hits++;
    return { ...aiResult, tier: 3 };
  }
}
```

### 3. Migration from GENERAL_COMMANDS

Create initial dictionary from hardcoded commands:

```javascript
// src/data/default_commands.json
{
  "commands": [
    {
      "action": "enter",
      "phrases": ["affirmative", "computer affirmative", "affirm", "confirmed"]
    },
    {
      "action": "undo",
      "phrases": ["retract", "computer retract", "undo that", "take it back"]
    },
    {
      "action": "clear_all",
      "phrases": ["computer scratch", "scratch that", "clear all", "delete all"]
    },
    // ... migrate all from GENERAL_COMMANDS
  ]
}
```

```javascript
// src/services/commands.js - add migration
import DEFAULT_COMMANDS_DATA from '../data/default_commands.json';

async migrateDefaults() {
  if (this.data.commands.length > 0) return;  // Already have data

  console.log('[Commands] Migrating default commands...');

  for (const cmd of DEFAULT_COMMANDS_DATA.commands) {
    this.data.commands.push({
      id: `cmd_default_${cmd.action}`,
      action: cmd.action,
      phrases: cmd.phrases,
      source: 'default',
      confidence: 1.0,
      use_count: 0,
      created_at: new Date().toISOString()
    });
  }

  this.data.stats.total_commands = this.data.commands.length;
  await this.save();
  this.buildIndexes();

  console.log(`[Commands] Migrated ${this.data.commands.length} default commands`);
}
```

### 4. Phonetic Matching (Optional Enhancement)

For handling speech recognition errors:

```javascript
import { metaphone } from 'metaphone';  // npm install metaphone

// Add phonetic index
buildIndexes() {
  // ... existing code ...

  // Build phonetic index
  this.phoneticIndex = new Map();
  for (const cmd of this.data.commands) {
    for (const phrase of cmd.phrases) {
      const phonetic = this.getPhonetic(phrase);
      if (!this.phoneticIndex.has(phonetic)) {
        this.phoneticIndex.set(phonetic, []);
      }
      this.phoneticIndex.get(phonetic).push({ phrase, cmd });
    }
  }
}

getPhonetic(phrase) {
  return phrase
    .toLowerCase()
    .split(' ')
    .map(word => metaphone(word))
    .join(' ');
}

lookupPhonetic(phrase) {
  const phonetic = this.getPhonetic(phrase);
  const matches = this.phoneticIndex.get(phonetic);

  if (matches && matches.length > 0) {
    const best = matches[0];
    return {
      action: best.cmd.action,
      confidence: 0.85,
      tier: 2,
      source: 'phonetic',
      matchedPhrase: best.phrase
    };
  }

  return null;
}
```

## Dependencies

```bash
npm install fuse.js   # Fuzzy search
npm install metaphone # Phonetic matching (optional)
```

## Files to Create/Modify

| File | Action |
|------|--------|
| `src/services/commands.js` | CREATE |
| `src/data/default_commands.json` | CREATE |
| `src/services/intent-resolver.js` | MODIFY |
| `src/index.js` | MODIFY - init commands |
| `package.json` | MODIFY - add fuse.js |

## Usage Flow

```
User says: "crank up the volume"
                    ↓
    ┌───────────────────────────────┐
    │ Tier 1: Exact Lookup          │
    │ phraseIndex.get("crank up...") │
    │ Result: null (not exact match) │
    └───────────────────────────────┘
                    ↓
    ┌───────────────────────────────┐
    │ Tier 2: Fuzzy Search          │
    │ fuse.search("crank up...")    │
    │ Matches: "turn it up" (0.25)  │
    │ Confidence: 0.75              │
    └───────────────────────────────┘
                    ↓
    ┌───────────────────────────────┐
    │ Execute: volume_up            │
    │ Learn: "crank up the volume"  │
    │        added to volume_up     │
    └───────────────────────────────┘
                    ↓
    Next time: Tier 1 instant match!
```

## Metrics to Track

```javascript
getStats() {
  const total = this.data.stats.tier1_hits +
                this.data.stats.tier2_hits +
                this.data.stats.tier3_hits;

  return {
    tier1_rate: this.data.stats.tier1_hits / total,  // Goal: >80%
    tier2_rate: this.data.stats.tier2_hits / total,  // Goal: <15%
    tier3_rate: this.data.stats.tier3_hits / total,  // Goal: <5%
    total_lookups: total,
    phrases_learned: this.data.stats.total_phrases,
    avg_confidence: this.calculateAvgConfidence()
  };
}
```

## Testing

```javascript
describe('CommandDictionary', () => {
  let dict;

  beforeEach(async () => {
    dict = new CommandDictionary();
    await dict.load();
  });

  test('exact lookup works', async () => {
    await dict.learn('test phrase', 'test_action');
    const result = dict.lookupExact('test phrase');
    expect(result.action).toBe('test_action');
    expect(result.tier).toBe(1);
  });

  test('fuzzy lookup finds close matches', async () => {
    await dict.learn('turn up the volume', 'volume_up');
    const result = dict.lookupFuzzy('turn up volume');
    expect(result.action).toBe('volume_up');
    expect(result.tier).toBe(2);
  });

  test('learning adds new phrases', async () => {
    await dict.learn('yeet', 'delete');
    expect(dict.phraseIndex.has('yeet')).toBe(true);
  });

  test('forget removes phrases', async () => {
    await dict.learn('temp', 'test');
    await dict.forget('temp');
    expect(dict.phraseIndex.has('temp')).toBe(false);
  });
});
```

---

*Spec by thinker | 2024-12-08*
