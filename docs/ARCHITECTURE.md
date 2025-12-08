# ONE System Architecture

> Technical overview of the ONE voice-first AI operating layer

## Table of Contents

1. [System Overview](#system-overview)
2. [Core Services](#core-services)
3. [Data Flow](#data-flow)
4. [Integration Architecture](#integration-architecture)
5. [Storage & Configuration](#storage--configuration)
6. [Technology Stack](#technology-stack)

---

## System Overview

ONE (formerly Speech2Type Enhanced) is a voice-first AI operating layer for macOS that transforms natural speech into commands, text, and multi-agent orchestration.

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                         USER INTERFACE                               │
├──────────────────┬──────────────────────────────────────────────────┤
│  Voice Input     │  Electron Menu Bar GUI    │  Keyboard Hotkeys    │
│  (Microphone)    │  (Settings, Status, Icons) │  (Cmd+;, PTT)       │
└────────┬─────────┴──────────────────┬───────────────────────────────┘
         │                            │
         ▼                            ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      MAIN PROCESS (src/index.js)                     │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌────────────┐   │
│  │ Transcriber│  │ Intent     │  │ Command    │  │ Mode       │   │
│  │ (Deepgram) │──▶│ Resolver   │──▶│ Executor   │  │ Manager    │   │
│  └────────────┘  └────────────┘  └────────────┘  └────────────┘   │
└────────┬────────────────────────────┬──────────────────────────────┘
         │                            │
         ▼                            ▼
┌─────────────────────┐   ┌──────────────────────────────────────────┐
│   SERVICE LAYER     │   │        OUTPUT SYSTEMS                     │
├─────────────────────┤   ├──────────────────────────────────────────┤
│ • IntentResolver    │   │ • Typer (text insertion)                 │
│ • CommandDictionary │   │ • AppleScript (app control)              │
│ • ContextDetection  │   │ • TTS (Piper voice synthesis)            │
│ • TrainingMode      │   │ • Audio Feedback (sounds)                │
│ • AgentOrchestrator │   │ • GUI Updates (IPC)                      │
│ • Secrets           │   │ • Multi-Agent (inboxes, locks)           │
└─────────────────────┘   └──────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────────────┐
│                    PERSISTENT STORAGE                                │
│  ~/.config/one/              ~/.claude/multiagent/                  │
│  • personal_commands.json    • state.json                           │
│  • mode_settings.json        • inbox/*.jsonl                        │
│  • context_defaults.json     • locks/*.lock                         │
│  • multiagent_settings.json  • tasks/*.json                         │
│                                                                      │
│  Keychain (macOS)            /tmp/                                  │
│  • Anthropic API key         • s2t-tts-queue.txt                    │
└─────────────────────────────────────────────────────────────────────┘
```

### Versioned Evolution

| Version | Capabilities |
|---------|--------------|
| **v0.6** | Basic voice typing + hardcoded commands |
| **v0.7** | AI intent resolution + personal dictionary + secure storage |
| **v0.8** | Training mode + learning loop + workflow creation |
| **v0.9** | Context detection + per-app profiles + auto mode switching |
| **v1.0** | Multi-agent orchestration + task decomposition + voice control |
| **v2.0+** | Local processing + offline mode + ecosystem |

---

## Core Services

### 1. Transcriber (`src/services/transcriber.js`)

**Purpose:** Convert audio → text in real-time

**Implementation:**
- Uses Deepgram Streaming API
- WebSocket connection for low-latency
- Interim results for instant feedback
- VAD (Voice Activity Detection) integration
- Supports 40+ languages

**Flow:**
```
Microphone → CoreAudio → Audio chunks (100ms) → Deepgram → Partial transcript
                                                          ↓
                                              Final transcript → IntentResolver
```

**Configuration:**
- Model: `nova-2` (accuracy) or `base` (speed)
- Language: auto-detect or explicit
- Punctuation: enabled
- Smart formatting: enabled

---

### 2. IntentResolver (`src/services/intent-resolver.js`)

**Purpose:** Understand what user means (command vs text)

**3-Tier Resolution:**

```
Transcript → Tier 1: Personal Dictionary (exact/fuzzy)
                 ↓ no match
             Tier 2: Phonetic Variations
                 ↓ no match
             Tier 3: Claude Haiku API (AI understanding)
                 ↓
             Canonical Action
```

**Tier 1: Personal Dictionary**
- Exact match: `O(1)` hash lookup
- Fuzzy match: Fuse.js with 0.3 threshold
- User-learned commands
- Default command mappings

**Tier 2: Phonetic Variations**
- Pre-computed phonetic patterns
- Fast lookup: `Map<phonetic, canonical>`
- Handles transcription errors
- Example: "new line" vs "newly" → "new line"

**Tier 3: AI Resolution**
- Claude Haiku API (~$0.00005/call)
- Dual-mode: API (fast) or CLI (uses login)
- looksLikeCommand() heuristic (avoids calls for prose)
- 5-minute response cache
- Only for short phrases (≤7 words)

**Learning Loop:**
- High-confidence AI results (>0.85) → auto-add to personal dictionary
- Tier 1/2/3 hit rates tracked
- Improves over time

---

### 3. CommandDictionary (`src/services/commands.js`)

**Purpose:** Load, manage, and persist user commands

**Data Structure:**
```javascript
{
  "commands": [
    {
      "phrase": "affirmative",
      "variations": ["yes", "yeah", "yep"],
      "action": "confirm",
      "category": "navigation",
      "confidence": 1.0,
      "uses": 142,
      "last_used": "2025-12-08T12:30:00Z",
      "learned_at": null,  // null = default, timestamp = user-taught
      "context_rules": []  // v0.9: per-app/mode overrides
    }
  ],
  "stats": {
    "tier1_hits": 1240,
    "tier2_hits": 85,
    "tier3_hits": 23
  }
}
```

**Operations:**
- `load()` - Load from `~/.config/one/personal_commands.json`
- `save()` - Persist to disk
- `add(phrase, action, variations)` - Add new command
- `remove(phrase)` - Delete command
- `fuzzyMatch(phrase, threshold)` - Find similar commands
- `getStats()` - Resolution metrics

**Default Commands:**
- Loaded from `src/data/default_commands.json`
- Merged with user commands (user takes precedence)
- Categories: navigation, editing, claude, music, multiagent

---

### 4. Secrets (`src/services/secrets.js`)

**Purpose:** Secure API key storage

**Implementation:**
- Uses `keytar` npm package
- Stores in macOS Keychain
- Service name: `one-voice-assistant`
- Account name: `anthropic_api_key`

**API:**
```javascript
await secrets.setApiKey(key)      // Store in Keychain
const key = await secrets.getApiKey()  // Retrieve
await secrets.deleteApiKey()      // Remove

const migrated = await secrets.migrateFromConfig()  // One-time migration
```

**Migration:**
- On first run: check `config.json` for plaintext key
- If found → move to Keychain → remove from config
- GUI shows Keychain status indicator

---

### 5. ContextDetection (`src/services/context.js`)

**Purpose:** Know what app user is in and what they're doing (v0.9)

**Tracked Context:**
```javascript
{
  app: {
    name: "Visual Studio Code",
    bundleId: "com.microsoft.VSCode",
    category: "development"  // mapped from bundleId
  },
  mode: "general",  // or "claude", "music", "multiagent"
  history: {
    lastCommands: [/* last 20 commands */],
    lastSpeech: [/* last 20 transcripts */],
    sessionStart: "2025-12-08T10:00:00Z",
    commandCount: 142
  },
  project: {
    path: "/Users/me/projects/myapp",
    type: "Node.js",  // detected from package.json
    files: [/* recently edited */]
  }
}
```

**Focus Polling:**
- Swift binary: `focus-checker`
- Poll interval: 500ms
- Detects: app name, bundleId, window title
- Emits `app-changed` event

**Integration:**
- IntentResolver uses context for disambiguation
- ProfileManager uses for per-app command overrides
- TaskDecomposer uses for intelligent task breakdown

---

### 6. ProfileManager (`src/services/profiles.js`)

**Purpose:** Per-app command overrides (v0.9)

**Example:**
```javascript
// In VSCode: "search" → "open search panel"
// In Chrome: "search" → "focus omnibar"
// Global fallback: "search" → general search
```

**Resolution Priority:**
1. App-specific (bundleId match)
2. Category-specific (development, browser, music)
3. Mode-specific (claude mode, music mode)
4. Global default

**Configuration:**
```json
{
  "app_profiles": {
    "com.microsoft.VSCode": {
      "commands": {
        "search": "workbench.action.findInFiles",
        "run": "workbench.action.debug.start"
      }
    },
    "com.google.Chrome": {
      "commands": {
        "search": "focus_omnibar"
      }
    }
  },
  "category_profiles": {
    "development": {
      "commands": {
        "save all": "save_all_files"
      }
    }
  }
}
```

---

### 7. TrainingMode (`src/services/training-mode.js`)

**Purpose:** Teach ONE new commands (v0.8)

**State Machine:**
```
IDLE → "Computer learn" → LISTENING
                              ↓
                          User teaches
                              ↓
                         COLLECTING (gather variations)
                              ↓
                         CONFIRMING
                              ↓
                     "Confirm" → SAVING → IDLE
                     "Cancel"  → IDLE
```

**Conversation Buffer:**
- Stores last 10 exchanges
- Persists to disk (survives crashes)
- Timeout: 15s warning, 25s auto-cancel

**Voice UX:**
- Sound palette: 8 distinct sounds (chime, success, error, etc.)
- Natural voice prompts (concise, not robotic)
- 150ms pause before speaking
- Interruption handling

**Learning Patterns:**
1. **Simple mapping:** "When I say X, do Y"
2. **Workflow:** "Learn workflow: step 1... step 2..."
3. **Context-specific:** "In VSCode, X means Y"

---

### 8. AgentOrchestrator (`src/services/agent-orchestrator.js`)

**Purpose:** Multi-agent coordination (v1.0)

**Manages:**
- 5 executor agents: thinker, builder, tester, dreamer, ui-pro
- Supervisor process
- Task assignment
- Health monitoring
- Real-time TTS updates

**Architecture:**
```
Voice → IntentResolver → AgentOrchestrator → Assign task
                                                  ↓
                                          Builder inbox
                                                  ↓
                                          Builder executes
                                                  ↓
                                          Builder reports
                                                  ↓
                                          TTS: "Builder done"
```

**Health Monitoring:**
- Heartbeat interval: 10s
- Timeout: 30s
- Auto-restart on crash
- Task reassignment on failure

**Integration:**
- Uses existing `~/.claude/multiagent/` infrastructure
- File locking via `~/.claude/multiagent/locks/`
- Message passing via `~/.claude/multiagent/inbox/*.jsonl`
- State tracking via `~/.claude/multiagent/state.json`

---

### 9. TaskDecomposer (`src/services/task-decomposer.js`)

**Purpose:** "Build me X" → subtasks (v1.0)

**Flow:**
```
User: "Build me a login system"
    ↓
IntentResolver detects high-level request
    ↓
TaskDecomposer.decompose(request, context)
    ↓
Claude API call:
  - Analyze request
  - Current app context (VSCode)
  - Project type (Node.js + React)
  - Existing files (src/services/, src/components/)
  - Break into tasks
    ↓
    ↓ Returns:
    {
      tasks: [
        { id: 1, desc: "Plan auth architecture", agent: "thinker" },
        { id: 2, desc: "Implement backend", agent: "builder", deps: [1] },
        { id: 3, desc: "Create login UI", agent: "ui-pro", deps: [1] },
        { id: 4, desc: "Write tests", agent: "tester", deps: [2,3] }
      ],
      dependencies: [[1,2], [1,3], [2,4], [3,4]]
    }
    ↓
Execute tasks respecting dependencies
    ↓
Task 1 starts → completes → Tasks 2 & 3 start (parallel) → etc.
```

**Context Enrichment:**
- Current app
- Recent commands
- Project structure (detected)
- Existing modules
- Tech stack (package.json, requirements.txt, etc.)

**Learning:**
- Store successful decompositions
- Reuse patterns for similar requests
- Improve over time

---

## Data Flow

### Transcription → Command Execution

```
┌──────────────┐
│ Microphone   │
└──────┬───────┘
       │ Audio chunks (100ms)
       ▼
┌──────────────┐
│ Deepgram     │
│ Streaming    │
└──────┬───────┘
       │ Interim transcripts
       ▼
┌──────────────┐
│ Transcriber  │
│ Service      │
└──────┬───────┘
       │ Final transcript: "new line"
       ▼
┌──────────────────────┐
│ looksLikeCommand()?  │ ← Heuristic check
└──────┬───────────────┘
       │ Yes (short phrase, imperative tone)
       ▼
┌────────────────────────┐
│ IntentResolver         │
│ Tier 1: Personal Dict  │ ← O(1) exact match
│ Tier 2: Phonetic       │ ← Fuzzy phonetic
│ Tier 3: Claude AI      │ ← API fallback
└──────┬─────────────────┘
       │ Canonical action: "insert_newline"
       ▼
┌──────────────────────┐
│ Command Executor     │
└──────┬───────────────┘
       │
       ├─→ Typer: Insert "\n"
       ├─→ Audio: Play "success.wav"
       └─→ GUI: Flash icon green
```

### Training Mode Flow

```
User: "Computer learn"
    ↓
┌────────────────────┐
│ TrainingMode       │
│ State: LISTENING   │
└────────┬───────────┘
         │
User: "When I say 'yeet', delete the selection"
         │
         ▼
┌────────────────────┐
│ Parse teaching     │
│ phrase = "yeet"    │
│ action = "delete"  │
└────────┬───────────┘
         │
         ▼
┌────────────────────┐
│ State: COLLECTING  │
│ "Any variations?"  │
└────────┬───────────┘
         │
User: "Also 'get rid of this'"
         │
         ▼
┌────────────────────┐
│ Add variation      │
└────────┬───────────┘
         │
User: "No"
         │
         ▼
┌────────────────────┐
│ State: CONFIRMING  │
│ "Say confirm"      │
└────────┬───────────┘
         │
User: "Confirm"
         │
         ▼
┌────────────────────────────────┐
│ CommandDictionary.add()        │
│ Save to personal_commands.json │
└────────────────────────────────┘
```

### Multi-Agent Task Assignment

```
User: "Tell the builder to fix the login bug"
    ↓
IntentResolver → multiagent.assign
    ↓
AgentOrchestrator.parseAssignment()
  - agent = "builder"
  - task = "fix the login bug"
    ↓
AgentOrchestrator.assignTask('builder', ...)
    ↓
Write to ~/.claude/multiagent/inbox/builder.jsonl:
  {
    "from": "supervisor",
    "type": "assignment",
    "task_id": "task-123",
    "content": "Fix the login bug",
    "context": { app: "VSCode", ... }
  }
    ↓
Builder agent reads inbox → starts work
    ↓
Builder sends progress messages
    ↓
AgentOrchestrator listens to builder inbox
    ↓
TTS: "Builder finished fixing login bug"
```

---

## Integration Architecture

### Electron GUI ↔ Node.js Main Process

**IPC Channels:**

```javascript
// Main → Renderer
mainWindow.webContents.send('status-update', { mode: 'general', listening: true })
mainWindow.webContents.send('agent-update', { agents: [...], tasks: [...] })

// Renderer → Main
ipcMain.handle('get-api-key', async () => await secrets.getApiKey())
ipcMain.handle('set-api-key', async (_, key) => await secrets.setApiKey(key))
ipcMain.handle('toggle-listening', () => toggleListening())
ipcMain.handle('switch-mode', (_, mode) => switchMode(mode))
```

**Shared State:**
- Main process = source of truth
- Renderer = view layer
- All updates flow: Main → Renderer
- User actions flow: Renderer → Main → Execute → Update

### Claude Code Integration

**Modes:**
1. **General Mode:** ONE types for user, Claude Code receives text
2. **Claude Mode:** ONE auto-pauses when Claude responds, resumes when done
3. **Voice Commands for Claude:** "continue", "regenerate", "explain"

**Piper TTS Integration:**
- Monitors Claude Code output (via clipboard or focus detection)
- Queues text to `/tmp/s2t-tts-queue.txt`
- Piper reads queue → speaks
- Spacebar stops TTS (global hotkey)

### Addon System

**Addon Structure:**
```javascript
// addons/my-addon/index.js
export const metadata = {
  name: 'my-addon',
  displayName: 'My Addon',
  modeCommand: 'my mode',
  modeAliases: ['custom mode'],
  commandsOnly: false  // true = only recognize commands, no prose
}

export const commands = {
  'do thing': 'my_action',
  'other thing': 'other_action'
}

export async function init(context) {
  // Setup code
}

export async function handleCommand(action, transcript, context) {
  // Execute action
}

export async function onActivate() {
  // Mode entered
}

export async function onDeactivate() {
  // Mode exited
}
```

**Hot Reload:**
- Watch `addons/` directory
- On file change → re-import → reload commands
- No restart needed

---

## Storage & Configuration

### File Locations

```
~/.config/one/
├── personal_commands.json     # User-learned commands
├── mode_settings.json          # Per-mode configuration
├── context_defaults.json       # App category mappings
├── multiagent_settings.json    # Agent pool config
└── app_profiles.json           # Per-app command overrides (v0.9)

~/.claude/multiagent/
├── state.json                  # Multi-agent system state
├── inbox/
│   ├── supervisor.jsonl        # Supervisor messages
│   ├── thinker.jsonl
│   ├── builder.jsonl
│   ├── tester.jsonl
│   ├── dreamer.jsonl
│   └── ui-pro.jsonl
├── locks/
│   ├── *.lock                  # File locks (agent, file, timestamp)
│   └── current.json            # Active locks summary
└── tasks/
    └── active.json             # Current task queue

/tmp/
└── s2t-tts-queue.txt          # TTS text queue (ephemeral)

Keychain (macOS Keychain Access)
└── one-voice-assistant
    └── anthropic_api_key       # Encrypted API key
```

### Configuration Files

**personal_commands.json:**
```json
{
  "commands": [
    {
      "phrase": "new line",
      "variations": ["line break", "next line"],
      "action": "insert_newline",
      "category": "editing",
      "confidence": 1.0,
      "uses": 142,
      "last_used": "2025-12-08T12:30:00Z",
      "learned_at": null
    }
  ],
  "stats": {
    "tier1_hits": 1240,
    "tier2_hits": 85,
    "tier3_hits": 23,
    "total_commands": 1348
  }
}
```

**mode_settings.json:**
```json
{
  "current_mode": "general",
  "auto_switch": {
    "enabled": true,
    "rules": [
      { "bundleId": "com.cycling74.Live", "mode": "music" },
      { "bundleId": "com.microsoft.VSCode", "mode": "general" },
      { "category": "terminal", "mode": "claude" }
    ],
    "debounce": 500,
    "notify": true
  }
}
```

**multiagent_settings.json:**
```json
{
  "enabled": true,
  "auto_start": false,
  "agents": {
    "thinker": { "enabled": true },
    "builder": { "enabled": true },
    "tester": { "enabled": true },
    "dreamer": { "enabled": false },
    "ui-pro": { "enabled": false }
  },
  "pool": {
    "max_agents": 5,
    "auto_restart": true,
    "heartbeat_interval": 10,
    "heartbeat_timeout": 30
  },
  "tts": {
    "mode": "milestones",
    "interrupt_on_error": true,
    "update_interval": 30
  }
}
```

---

## Technology Stack

### Core Dependencies

| Package | Purpose | Version |
|---------|---------|---------|
| `@deepgram/sdk` | Real-time speech-to-text | 3.x |
| `electron` | Menu bar GUI, IPC | 27.x |
| `keytar` | Secure API key storage (Keychain) | 7.x |
| `fuse.js` | Fuzzy command matching | 7.x |
| `@anthropic-ai/sdk` | Claude API (intent resolution) | Latest |

### Development Dependencies

| Package | Purpose |
|---------|---------|
| `vitest` | Testing framework |
| `eslint` | Code linting |
| `@swc/core` | Fast transpilation |

### System Requirements

- **OS:** macOS 13+ (Ventura or later)
- **Node.js:** 18+ (ESM modules)
- **APIs:**
  - Deepgram API (free tier: 45,000 min/year)
  - Anthropic Claude API (optional for AI intent resolution)

### Platform-Specific

**macOS:**
- `CoreAudio` for microphone input
- `AppleScript` for app control (`osascript`)
- `Accessibility API` for text insertion
- Swift binaries: `focus-checker`, `typer`

**Future (Linux):**
- `PipeWire` for audio
- `xdotool` for text insertion
- `wmctrl` for window detection

**Future (Windows):**
- `Windows Audio Session API`
- `SendInput` for typing
- `UI Automation` for app control

---

## Performance Characteristics

### Latency

| Stage | Latency | Notes |
|-------|---------|-------|
| Microphone → Deepgram | ~100ms | Network + processing |
| Deepgram → Transcript | ~50ms | Interim results faster |
| Tier 1 resolution | <1ms | Hash lookup |
| Tier 2 resolution | <5ms | Fuzzy match |
| Tier 3 resolution | 200-500ms | Claude API call |
| Command → Execution | <10ms | AppleScript/typer |
| **Total (Tier 1)** | **~150ms** | Feels instant |
| **Total (Tier 3)** | **~400ms** | Acceptable |

### Throughput

- **Concurrent users:** Single-user app
- **Commands/minute:** ~30-60 (typical usage)
- **API costs:** $0.001-0.01/day (with caching)

### Resource Usage

- **Memory:** 80-120 MB (main process)
- **CPU:** <5% idle, 15-25% while listening
- **Network:** ~50 KB/s while transcribing

---

## Security Architecture

### API Key Protection

1. **Storage:** macOS Keychain (encrypted at rest)
2. **Access:** Only ONE app can read (via `keytar`)
3. **Migration:** Auto-moves from plaintext config.json
4. **GUI:** Visual indicator (🔒 Keychain | ⚠️ Not set)

### Data Privacy

**What stays local:**
- Personal commands
- Command usage history
- Context data (apps, files)
- Agent messages

**What goes to cloud:**
- Audio → Deepgram (transcription)
- Transcripts → Claude (if Tier 3 resolution)
- Deepgram: Retains 0 seconds (not stored)
- Claude: Standard API data handling

**Future (v2.0):**
- Local STT (Whisper)
- Local intent classification
- 100% offline capable

---

## Testing Strategy

### Unit Tests (`tests/*.test.js`)

- **IntentResolver:** Tier 1/2/3 resolution, caching, confidence
- **CommandDictionary:** Add, remove, fuzzy match, stats
- **Secrets:** Get, set, delete, migration
- **PhoneticVariations:** Phonetic matching, lookup
- **ContextWindow:** Add events, time-based filtering
- **TrainingMode:** State machine, conversation buffer
- **AgentOrchestrator:** Assign, health, broadcast
- **TaskDecomposer:** Decomposition, dependencies

**Current:** 155 tests passing, 32% coverage

### Integration Tests

- Full voice → command flow
- Multi-agent coordination
- Training mode end-to-end
- Crash recovery

### Manual Testing

- Voice recognition accuracy (40+ languages)
- Command execution reliability
- GUI responsiveness
- TTS quality

---

## Deployment

### Installation

```bash
npm install -g speech2type-enhanced
one start
```

### Development

```bash
git clone https://github.com/jessesep/speech2type
cd speech2type
npm install
npm run dev        # Start with hot-reload
npm test           # Run tests
npm run lint       # Check code quality
```

### Release Process

1. Update version in `package.json`
2. Run tests: `npm test`
3. Build binaries: `npm run build-swift`
4. Tag release: `git tag v0.7.0`
5. Publish: `npm publish`
6. GitHub release with changelog

---

## Extensibility Points

### 1. Custom Addons

Create custom modes with hot-reload:

```javascript
// addons/my-addon/index.js
export const metadata = { ... }
export const commands = { ... }
export async function handleCommand(action, transcript, context) {
  // Your logic here
}
```

### 2. Custom Commands

Via training mode:
```
"Computer learn"
"When I say 'deploy', run the deploy script"
```

Or via config:
```json
{
  "phrase": "deploy",
  "action": "run_script",
  "script": "npm run deploy"
}
```

### 3. Custom Agents

Add new executors to multi-agent system:

```bash
mkdir ~/.claude/multiagent/inbox/my-agent.jsonl
```

Update state.json:
```json
{
  "executors": [
    {
      "name": "my-agent",
      "scope": ["custom/"],
      "description": "My custom agent"
    }
  ]
}
```

### 4. Custom Context Detection

```javascript
// src/services/context.js
context.on('app-changed', ({ app, bundleId }) => {
  if (bundleId === 'com.myapp.MyApp') {
    // Custom logic
  }
})
```

---

## Future Architecture (v2.0+)

### Local Processing Stack

```
Microphone → Whisper.cpp (local STT) → Local Intent Classifier
                                              ↓
                                        (85% confidence)
                                              ↓
                                         Execute locally
                                              
                                        (Low confidence)
                                              ↓
                                        Cloud escalation (Claude)
```

**Benefits:**
- Sub-100ms latency
- Offline capable
- Privacy-first
- Zero API costs

### Ecosystem Platform

- **Workflow Marketplace:** Share command packs
- **Plugin System:** Community-built integrations
- **Voice Personas:** Custom TTS voices
- **Cross-Platform:** Linux, Windows support

---

*Last updated: 2025-12-08 by thinker*
*Version: ONE v0.7 architecture*
