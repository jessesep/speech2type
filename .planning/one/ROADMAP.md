# ONE Development Roadmap

> From Speech2Type to ONE - phased evolution

## Current State: Speech2Type v0.6.0

**Working:**
- Real-time Deepgram transcription
- 30+ hardcoded voice commands
- 3 modes (General, Claude, Music)
- Addon system (Ableton, Planning, MultiAgent)
- Electron menu bar GUI
- Piper TTS for Claude responses
- Audio feedback system

**Limitations:**
- Exact phrase matching only
- Manual command variations
- No learning capability
- Single Claude instance
- No per-app profiles

---

## Phase 1: Foundation (ONE v0.7)

**Goal:** Add AI command understanding with secure API integration

### 1.1 Secure API Key Storage ✅ DONE
- [x] Add `keytar` dependency for macOS Keychain
- [x] Create `src/services/secrets.js`
- [x] GUI: API key input in settings (stored securely)
- [x] Migration from plaintext config.json to Keychain
- [x] Keychain status indicator + delete button in GUI
- [ ] CLI: `one config set anthropic_key` (optional, deferred)

**Files:** `src/services/secrets.js`, `gui/settings.html`, `gui/main.cjs`, `package.json`
**Owner:** builder
**Status:** Completed by builder (2024-12-08)

### 1.2 Personal Command Dictionary ✅ DONE
- [x] Create `~/.config/one/personal_commands.json` structure
- [x] Load/save functions
- [x] Migration from hardcoded GENERAL_COMMANDS
- [x] Fuzzy matching (Fuse.js with 0.3 threshold)
- [x] Tier 1 (exact) + Tier 2 (fuzzy) resolution
- [x] Auto-learning from high-confidence AI results
- [x] Stats tracking (tier1_hits, tier2_hits, tier3_hits)

**Files:** `src/services/commands.js`, `src/data/default_commands.json`
**Owner:** builder
**Status:** Completed by builder (2025-12-08)

### 1.3 Intent Resolver Service ✅ DONE
- [x] Create `src/services/intent-resolver.js`
- [x] Tier 3: Claude Haiku API call (working!)
- [x] Dual-mode: API (fast, ~$0.00005/call) + CLI fallback
- [x] looksLikeCommand() heuristic to avoid unnecessary API calls
- [x] Response caching with 5-min TTL
- [ ] Tier 1: Local dictionary lookup (needs 1.2)
- [ ] Tier 2: Fuzzy matching (needs 1.2)
- [ ] Auto-learning on high confidence (needs 1.2)

**Files:** `src/services/intent-resolver.js`
**Owner:** builder
**Spec:** `.planning/one/AI-COMMAND-SYSTEM.md`
**Status:** Core implemented by builder (2024-12-08)

### 1.4 Hook Into Transcript Pipeline ✅ DONE
- [x] Modify `src/index.js` to use IntentResolver
- [x] Falls back to AI when no exact keyword match
- [x] Only checks short phrases (≤7 words) that look like commands
- [x] 70% confidence threshold
- [x] GUI shows AI status indicator
- [ ] Metrics: track Tier 1/2/3 hit rates (TODO)

**Files:** `src/index.js`
**Owner:** builder
**Status:** Integrated by builder (2024-12-08)

### 1.5 Testing & Validation ✅ DONE
- [x] Unit tests for IntentResolver (35 tests)
- [x] Unit tests for CommandDictionary (46 tests)
- [x] Unit tests for Secrets (26 tests)
- [x] Unit tests for phonetic-variations (12 tests)
- [x] Vitest framework setup
- [x] ESLint configuration fixed
- [ ] Integration tests with mock API (partial)
- [ ] Real-world testing with voice
- [ ] Cost monitoring

**Total: 119 tests passing**
**Owner:** tester
**Status:** Core tests complete (2025-12-08)

### Milestone: ONE v0.7.0 Release
- AI understands natural commands
- Learns from usage automatically
- Secure API key storage
- Backwards compatible with existing commands

---

## Phase 2: Training Mode (ONE v0.8)

**Goal:** Users can explicitly teach ONE new commands

**Specs Created:**
- `.planning/one/TRAINING-MODE.md` - Full training mode spec
- `.planning/one/LEARNING-LOOP.md` - How learning/corrections flow
- `.planning/one/TRAINING-UX.md` - Voice/audio/visual UX design

### 2.1 Learning Loop Integration ✅ DONE
- [x] Create `src/services/learning-loop.js`
- [x] Implicit positive feedback (no correction = success)
- [x] Implicit negative feedback (undo/wrong detection)
- [x] Confidence dynamics (boost/decay)
- [x] Context window for recent activity

**Files:** `src/services/learning-loop.js`, `src/services/context-window.js`
**Owner:** builder
**Spec:** `.planning/one/LEARNING-LOOP.md`
**Status:** Completed by builder (2025-12-08)

### 2.2 Training Mode State Machine ✅ DONE
- [x] Create `src/services/training-mode.js`
- [x] States: IDLE → LISTENING → COLLECTING → CONFIRMING → SAVING
- [x] Conversation history buffer
- [x] Timeout handling (15s warning, 25s cancel)
- [x] Draft persistence (survive crashes)

**Files:** `src/services/training-mode.js`
**Owner:** builder
**Spec:** `.planning/one/TRAINING-MODE.md`
**Status:** Completed by builder (2025-12-08)

### 2.3 Training Commands ✅ DONE
- [x] "Computer learn" → enter training
- [x] "Confirm" / "Cancel" → save/discard
- [x] "Done" → finish adding variations
- [x] "Forget [phrase]" → remove learned command
- [x] "What does [phrase] do?" → explain mapping
- [x] "What have I taught you?" → list learned

**Files:** `src/index.js` (GENERAL_COMMANDS), `src/data/default_commands.json`
**Owner:** builder
**Status:** Completed by builder (2025-12-08)

### 2.4 Training Voice/Audio Feedback ✅ DONE
- [x] Sound palette (8 distinct sounds using macOS system sounds)
- [x] Voice prompts (natural, concise)
- [x] 150ms pause before speaking (feels natural)
- [x] Interruption handling (killall say)
- [x] TTS lock file to prevent mic pickup during speech
- [x] 16 convenience methods for training scenarios

**Files:** `src/services/training-voice.js`, `src/services/training-mode.js`
**Owner:** builder
**Spec:** `.planning/one/TRAINING-UX.md`
**Status:** Completed by builder (2025-12-08)

### 2.5 Correction Flow ✅ DONE
- [x] Detect correction patterns ("no, I meant...")
- [x] Ask what user meant if just "no/wrong"
- [x] Update both wrong and right mappings
- [x] Confirmation before saving correction
- [x] Automatic resolution of intended action using IntentResolver
- [x] applyCorrection() method for complete correction workflow

**Files:** `src/services/learning-loop.js`, `src/index.js`
**Owner:** builder
**Spec:** `.planning/one/LEARNING-LOOP.md`
**Status:** Completed by builder (2025-12-08)

### 2.6 Workflow Creation
- [ ] Multi-step workflow recording
- [ ] Conditional steps (if previous passed)
- [ ] Workflow playback engine
- [ ] "Create workflow [name]" command

**Files:** `src/services/workflows.js`
**Owner:** builder

### 2.7 Conflict Resolution
- [ ] Detect when new phrase conflicts
- [ ] Offer: replace / context-specific / cancel
- [ ] Handle gracefully in voice UI

**Owner:** builder

### 2.8 Visual Feedback (Menu Bar) ✅ DONE
- [x] Purple/magenta icon during training
- [x] Pulse animation while listening
- [x] Green flash on success
- [x] Red flash on error
- [x] Tooltip shows current training state
- [x] Detailed tooltip showing phrase → action being taught
- [x] IPC handlers for flash triggers and training details

**Files:** `gui/main.cjs`
**Owner:** builder
**Spec:** `.planning/one/TRAINING-UX.md`
**Status:** Completed by builder (2025-12-08)

### Milestone: ONE v0.8.0 Release (🟢 NEAR COMPLETE)

**Completed (2025-12-08):**
- ✅ 2.1 Learning Loop Integration
- ✅ 2.2 Training Mode State Machine
- ✅ 2.3 Training Commands
- ✅ 2.4 Training Voice/Audio Feedback
- ✅ 2.5 Correction Flow

**Remaining:**
- ⏳ 2.6 Workflow Creation (optional - can defer to v0.8.1)
- ⏳ 2.7 Conflict Resolution
- ⏳ 2.8 Visual Feedback (Menu Bar)

**Status:** Phase 2 is 62.5% complete (5/8 tasks done). Core training and correction flows are fully working. Remaining tasks are polish and advanced features.

---

## Phase 3: Context & Profiles (ONE v0.9)

**Goal:** Commands adapt to current app and context

**Specs Created:**
- `.planning/one/CONTEXT-DETECTION.md` - Focus polling, command history, context service
- `.planning/one/APP-PROFILES.md` - Per-app overrides, profile manager, training
- `.planning/one/MODE-SWITCHING.md` - Auto mode switching, rules engine, state machine

### 3.1 Context Detection
- [ ] Create `src/services/context.js`
- [ ] Focus polling via `focus-checker` binary (500ms interval)
- [ ] App name/bundleId/category mapping
- [ ] Command history tracking (last 20 commands)
- [ ] Session context (start time, command count, correction count)
- [ ] Event system for app-changed, mode-changed

**Files:** `src/services/context.js`, `src/data/context_defaults.json`
**Owner:** builder
**Spec:** `.planning/one/CONTEXT-DETECTION.md`

### 3.2 Per-App Command Profiles
- [ ] Create `src/services/profiles.js` (ProfileManager)
- [ ] Add `context_rules` to personal_commands.json
- [ ] Add `app_profiles` section for per-app overrides
- [ ] Resolution priority: app-specific > category > global
- [ ] Context rule matching (bundleId, category, mode, url)
- [ ] "In [app], [phrase] means [action]" training pattern

**Files:** `src/services/profiles.js`, `src/data/default_profiles.json`
**Owner:** builder
**Spec:** `.planning/one/APP-PROFILES.md`

### 3.3 Mode Auto-Switching
- [ ] Create `src/services/mode-switcher.js`
- [ ] Default rules: DAW→music, Terminal→claude, Editor→general
- [ ] User custom rules in `~/.config/one/mode_settings.json`
- [ ] Debounced switching (500ms delay)
- [ ] Manual override with temporary auto-disable (30s)
- [ ] Notify on switch (configurable)
- [ ] Mode stack for revert-on-return

**Files:** `src/services/mode-switcher.js`, `src/data/mode_rules.json`
**Owner:** builder
**Spec:** `.planning/one/MODE-SWITCHING.md`

### 3.4 Context-Aware IntentResolver
- [ ] Modify IntentResolver to check profiles first (Tier 0)
- [ ] Include context in AI prompt (app name, category, recent commands)
- [ ] Context-specific suggestions when uncertain
- [ ] "Did you mean [X]? (common in [app])"

**Files:** `src/services/intent-resolver.js`
**Owner:** builder

### 3.5 Context UI
- [ ] Mode indicator in tray (color per mode)
- [ ] Auto-switch notification (subtle)
- [ ] Profile manager in settings panel
- [ ] Mode rules configuration UI

**Files:** `gui/main.cjs`, `gui/settings.html`
**Owner:** ui-pro / builder

### Milestone: ONE v0.9.0 Release
- Per-app profiles working
- Context-aware resolution
- Auto mode switching
- Profile import/export
- Smarter suggestions

---

## Phase 4: Multi-Agent Integration (ONE v1.0)

**Goal:** Voice-controlled multi-agent orchestration

**Specs Created:**
- `.planning/one/MULTI-AGENT-INTEGRATION.md` - Full architecture, services, integration
- `.planning/one/AGENT-VOICE-CONTROL.md` - Natural language interface, command parsing

### 4.1 AgentOrchestrator Service
- [ ] Create `src/services/agent-orchestrator.js`
- [ ] Initialize multiagent infrastructure on startup
- [ ] Manage supervisor/executor processes
- [ ] Route voice commands to handlers
- [ ] Event system (agent-started, task-assigned, task-completed, agent-error)
- [ ] Status queries (getStatus, getAgents, getTasks)
- [ ] Control methods (assignTask, broadcastMessage, checkHealth)

**Files:** `src/services/agent-orchestrator.js`
**Owner:** builder
**Spec:** `.planning/one/MULTI-AGENT-INTEGRATION.md` (4.1)

### 4.2 Voice Command Integration
- [ ] Add multiagent commands to `default_commands.json`
- [ ] Natural language parsing (agent name + task extraction)
- [ ] Context-aware command interpretation
- [ ] Fuzzy agent name matching (handle transcription errors)
- [ ] Multi-agent assignments (parallel/sequential)
- [ ] Custom command learning via training mode

**Voice commands:**
- System: "start the agents", "stop all", "status"
- Assignment: "tell builder to fix login", "assign tester to run tests"
- Monitoring: "what's everyone doing?", "how's the builder?"
- Emergency: "stop everything!", "cancel all tasks"

**Files:** `src/data/default_commands.json`, `src/services/intent-resolver.js`
**Owner:** builder
**Spec:** `.planning/one/AGENT-VOICE-CONTROL.md` (all sections)

### 4.3 Real-Time TTS Feedback
- [ ] Non-blocking progress updates
- [ ] Configurable verbosity (silent/milestones/verbose)
- [ ] TTS queue for simultaneous updates
- [ ] Agent completion notifications
- [ ] Error announcements
- [ ] Update interval configuration (default: 30s)

**Files:** `src/services/agent-orchestrator.js`, `src/index.js`
**Owner:** builder
**Spec:** `.planning/one/MULTI-AGENT-INTEGRATION.md` (4.1)

### 4.4 Task Decomposition Engine
- [ ] Create `src/services/task-decomposer.js`
- [ ] Detect high-level requests ("Build me X")
- [ ] Claude API integration for task breakdown
- [ ] Dependency graph generation
- [ ] Context-aware decomposition (current app, project type, existing files)
- [ ] Parallel task execution
- [ ] Learn decomposition patterns (store successful patterns)
- [ ] User confirmation flow (auto/confirm/manual modes)

**Example:** "Build me a login system" → 5 tasks (plan, backend, frontend, test, docs)

**Files:** `src/services/task-decomposer.js`
**Owner:** builder
**Spec:** `.planning/one/MULTI-AGENT-INTEGRATION.md` (4.2)

### 4.5 Agent Pool Management
- [ ] Create `src/services/agent-pool.js`
- [ ] Spawn executors on demand
- [ ] Health monitoring (heartbeat, timeouts)
- [ ] Automatic restart on crash
- [ ] Graceful shutdown
- [ ] Resource limits (max agents)
- [ ] Failover (reassign task if agent crashes)

**Monitoring:**
- Heartbeat interval: 10s
- Timeout: 30s
- Auto-restart on crash
- Task reassignment on failure

**Files:** `src/services/agent-pool.js`
**Owner:** builder
**Spec:** `.planning/one/MULTI-AGENT-INTEGRATION.md` (4.3)

### 4.6 Configuration & Settings
- [ ] Create `~/.config/one/multiagent_settings.json`
- [ ] Per-agent enable/disable
- [ ] Pool settings (max agents, heartbeat interval)
- [ ] TTS settings (mode, interrupt, update interval)
- [ ] Decomposition settings (threshold, max tasks, learning)
- [ ] Migration from addon settings

**Files:** `src/services/agent-orchestrator.js`
**Owner:** builder
**Spec:** `.planning/one/MULTI-AGENT-INTEGRATION.md` (Configuration)

### 4.7 Supervisor Dashboard (Optional)
- [ ] Create `gui/supervisor.html`
- [ ] Agent grid (status, current task, health)
- [ ] Task queue view
- [ ] Real-time message log
- [ ] Quick actions (spawn all, shutdown, broadcast)
- [ ] WebSocket integration for live updates
- [ ] Voice + GUI sync (bidirectional)

**Files:** `gui/supervisor.html`, `gui/main.cjs`
**Owner:** ui-pro / builder
**Spec:** `.planning/one/MULTI-AGENT-INTEGRATION.md` (4.4)

### 4.8 Testing & Validation
- [ ] Unit tests for AgentOrchestrator
- [ ] Unit tests for TaskDecomposer
- [ ] Unit tests for AgentPool
- [ ] Voice command parsing tests
- [ ] Integration test: full voice → execute → report flow
- [ ] Crash recovery test
- [ ] Multi-agent coordination test

**Files:** `tests/agent-orchestrator.test.js`, `tests/task-decomposer.test.js`, `tests/agent-pool.test.js`
**Owner:** tester
**Spec:** `.planning/one/MULTI-AGENT-INTEGRATION.md` (Testing)

### Milestone: ONE v1.0.0 Release
- Voice-controlled agent orchestration
- Task decomposition ("Build me X")
- Auto agent management (spawn/health/failover)
- Real-time TTS progress
- 5+ agents working in parallel
- Dashboard (optional)
- Production ready

---

## Future Phases (Post v1.0)

### Local Processing
- [ ] Local STT (Whisper/Moonshine)
- [ ] Local intent classification (fine-tuned small LLM)
- [ ] Zero-latency, offline capable

### Voice-First Everything
- [ ] All settings via voice
- [ ] "What can you do?" help system
- [ ] Voice-guided onboarding

### Community & Sharing
- [ ] Export/import command dictionaries
- [ ] Workflow marketplace
- [ ] Addon discovery

### Cross-Platform
- [ ] Linux support (PipeWire audio)
- [ ] Windows consideration
- [ ] Web interface for settings

---

## Development Coordination

### Agent Roles

| Agent | Scope | Responsibilities |
|-------|-------|------------------|
| **thinker** | `.planning/`, `docs/` | Vision, specs, roadmap |
| **builder** | `src/`, `gui/`, `addons/` | Implementation |
| **user** | Supervisor | Direction, testing, feedback |

### Communication
- Check `~/.claude/multiagent/inbox/[your-name].jsonl` for messages
- Send updates to `inbox/supervisor.jsonl`
- Coordinate on shared decisions via messages

### File Locks
- Lock files before major edits
- Check `locks/current.json` before editing
- Release locks when done

---

## Success Criteria

| Version | Key Metric |
|---------|------------|
| v0.7 | >80% commands understood without exact match |
| v0.8 | <10 seconds to teach new command |
| v0.9 | Per-app profiles working in 5+ apps |
| v1.0 | Multi-agent task completion in parallel |

---

*Last updated: 2025-12-08 23:59 UTC by thinker*
*Phase 2.1-2.5 marked complete - correction flow now working!*
