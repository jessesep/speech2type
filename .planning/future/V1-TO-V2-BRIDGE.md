# ONE: v1.0 → v2.0 Bridge

> How today's foundation enables tomorrow's vision

## Overview

This document bridges the tactical roadmap (Phase 1-4, leading to v1.0) with the strategic vision (v2.0+). It shows how architectural decisions and patterns established in v1.0 directly enable the four future pillars.

**Purpose:**
- Help current developers understand how their work sets up future capabilities
- Identify extension points in v1.0 architecture for v2.0 features
- Validate that v1.0 decisions don't block v2.0 goals
- Guide v1.0 API design to support v2.0 use cases

---

## Phase 2 → Adaptive Intelligence

### What Phase 2 Built (v0.8)

**Learning Loop Service** (`src/services/learning-loop.js`):
```javascript
// Confidence-based command resolution with feedback
- CONFIDENCE_ADJUSTMENTS: Dynamic confidence scoring
- THRESHOLDS: Multi-level confidence thresholds
- Implicit feedback: No correction = positive signal
- Explicit feedback: User confirms/denies
- Correction patterns: "no, I meant..." detection
- Context window: Recent command history
```

**Training Mode Service** (`src/services/training-mode.js`):
```javascript
// Conversational command teaching
- State machine: LISTENING → COLLECTING → CONFIRMING
- Session management: Multi-turn conversations
- Voice feedback integration: trainingVoice prompts
- Draft persistence: Survive crashes
```

### How This Enables v2.0 Adaptive Intelligence

| v0.8 Foundation | v2.0 Extension | Value |
|-----------------|----------------|-------|
| **Confidence adjustment** | Predictive intent scoring | User starts "Can you..." → predict top 5 intents with confidence |
| **Context window** | Behavioral pattern detection | Detect sequences like "morning: Slack → Jira → GitHub" |
| **Correction patterns** | Enhanced learning signals | Rich training data for personalized models |
| **Training sessions** | Fine-tuning data collection | User-consented training data for local model personalization |
| **Implicit feedback** | Proactive suggestions | "You always do X after Y. Want a workflow?" |

### Extension Points for v2.0

```javascript
// src/services/learning-loop.js (v2.0 additions)
export class LearningLoop {
  // EXISTING (v0.8)
  observeAction(phrase, action, confidence, tier) { ... }

  // NEW (v2.0)
  predictIntent(partialPhrase) {
    // Use context + partial input → probability distribution
    const context = this.contextWindow.getRecentPatterns();
    const predictions = this.personalizedModel.predict(partialPhrase, context);
    return predictions; // [{ intent, confidence }, ...]
  }

  detectBehavioralPattern() {
    // Analyze commandHistory for repeated sequences
    const patterns = this.patternDetector.findRepeatingSequences(
      this.contextWindow.getHistory(days: 30)
    );
    return patterns.filter(p => p.occurrences >= 3);
  }

  collectTrainingData() {
    // With user consent, export training dataset
    return {
      corrections: this.correctionHistory,
      confirmations: this.confirmationHistory,
      usage_patterns: this.anonymizedUsage
    };
  }
}
```

### Migration Path

1. **v0.8 → v0.9**: Continue using cloud-based confidence scoring
2. **v1.0**: Add hooks for pattern detection observers
3. **v1.5**: Introduce local prediction as optional experiment
4. **v2.0**: Full personalized model with pattern suggestions

---

## Phase 1 → Local Processing

### What Phase 1 Built (v0.7)

**Intent Resolver Service** (`src/services/intent-resolver.js`):
```javascript
// Tiered command resolution
- Tier 1: Exact dictionary lookup
- Tier 2: Fuzzy matching (Fuse.js)
- Tier 3: Claude Haiku API call
- Caching with TTL
- Dual-mode: API + CLI fallback
```

**Personal Dictionary** (`~/.config/one/personal_commands.json`):
```json
{
  "version": "1.0",
  "commands": [
    {
      "triggers": ["yeet", "delete"],
      "action": "delete_selection",
      "confidence": 0.95,
      "learned_at": "2024-12-01",
      "usage_count": 42
    }
  ]
}
```

### How This Enables v2.0 Local Processing

| v0.7 Foundation | v2.0 Extension | Value |
|-----------------|----------------|-------|
| **Tiered resolution** | Add Tier 2.5 (local LLM) | Tier 1 → Tier 2 → **Tier 2.5 (local Phi-3)** → Tier 3 (cloud) |
| **Cache with TTL** | Extend to local model cache | Pre-compute common intents locally |
| **Personal dictionary** | Local training dataset | Fine-tune local model on user's phrases |
| **Dual-mode (API/CLI)** | Hybrid mode precedent | Established pattern for cloud/local switching |

### Extension Points for v2.0

```javascript
// src/services/intent-resolver.js (v2.0 additions)
export class IntentResolver {
  constructor() {
    // EXISTING (v0.7)
    this.tier1 = new DictionaryLookup();
    this.tier2 = new FuzzyMatcher();
    this.tier3 = new ClaudeAPIResolver();

    // NEW (v2.0)
    this.tier2_5 = new LocalLLMResolver({
      model: 'phi-3-mini',
      confidence_threshold: 0.85
    });

    this.processingMode = 'hybrid'; // 'local' | 'cloud' | 'hybrid'
  }

  async resolve(phrase) {
    // Tier 1: Exact match
    let result = this.tier1.lookup(phrase);
    if (result) return { ...result, tier: 1 };

    // Tier 2: Fuzzy match
    result = this.tier2.match(phrase);
    if (result && result.confidence > 0.7) return { ...result, tier: 2 };

    // NEW: Tier 2.5: Local LLM (v2.0)
    if (this.processingMode !== 'cloud') {
      result = await this.tier2_5.classify(phrase);
      if (result && result.confidence > 0.85) return { ...result, tier: 2.5 };
      if (this.processingMode === 'local') {
        // Don't escalate to cloud in local-only mode
        return { ...result, tier: 2.5 };
      }
    }

    // Tier 3: Cloud AI
    result = await this.tier3.resolve(phrase);
    return { ...result, tier: 3 };
  }

  setProcessingMode(mode) {
    // 'local' | 'cloud' | 'hybrid'
    this.processingMode = mode;
  }
}
```

### Data Flow: Cloud → Hybrid → Local

```
v0.7 (Cloud-First)
User Speech → Deepgram → IntentResolver → Claude API
                                              ↓
                                         ~300ms, $0.00005

v1.5 (Hybrid)
User Speech → Deepgram → Tier 1 → Tier 2 → Tier 2.5 (local) → Tier 3 (cloud)
                           ↓        ↓         ↓                  ↓
                          <1ms     <5ms      ~100ms             ~300ms

v2.0 (Local-First)
User Speech → Whisper (local) → Tier 1 → Tier 2 → Tier 2.5 → [Cloud optional]
                ↓                 ↓        ↓         ↓
              ~80ms              <1ms     <5ms      ~100ms
              Total: ~200ms end-to-end (vs ~600ms cloud)
```

---

## Phase 2 → Ecosystem & Community

### What Phase 2 Built (v0.8)

**Personal Command Dictionary**:
- JSON format for commands
- Versioned schema
- User-specific customizations
- Import/export ready

**Training Mode Conversations**:
- Natural language teaching
- Multi-turn interaction patterns
- Session persistence

### How This Enables v2.0 Ecosystem

| v0.8 Foundation | v2.0 Extension | Value |
|-----------------|----------------|-------|
| **personal_commands.json** | Command packs | Already structured for sharing |
| **Training sessions** | Workflow templates | Session format → shareable workflow format |
| **Confidence tracking** | Community validation | "4.8★ based on 1,200 successful uses" |

### Personal Dictionary → Command Pack

**v0.8 Personal Dictionary:**
```json
{
  "version": "1.0",
  "commands": [
    {
      "triggers": ["ship it", "deploy now"],
      "action": "terminal:npm run deploy",
      "confidence": 0.95,
      "usage_count": 23
    }
  ]
}
```

**v2.0 Command Pack (Shareable):**
```yaml
# developer-pack.yaml
name: Developer Essentials
version: 1.0.0
author: one-community
one_version: ">=2.0.0"

commands:
  - triggers: ["ship it", "deploy now"]
    action: terminal:npm run deploy
    description: Deploy current project
    categories: [git, deployment]
    dependencies: [npm]

  # ... more commands ...

installation:
  # Conflict resolution when importing
  on_conflict: ask  # ask | skip | replace

community:
  downloads: 1250
  rating: 4.8
  reviews: 43
```

### Extension Points for v2.0

```javascript
// NEW: src/services/package-manager.js (v2.0)
export class PackageManager {
  async install(packageName) {
    // Fetch from GitHub registry
    const manifest = await this.fetchManifest(packageName);

    // Check version compatibility
    if (!this.isCompatible(manifest.one_version)) {
      throw new Error('Incompatible ONE version');
    }

    // Load user's personal dictionary
    const userDict = await commandDictionary.load();

    // Detect conflicts
    const conflicts = this.detectConflicts(manifest.commands, userDict);

    if (conflicts.length > 0) {
      // Resolve based on policy
      const resolution = await this.resolveConflicts(
        conflicts,
        manifest.installation.on_conflict
      );
    }

    // Merge and save
    await commandDictionary.merge(manifest.commands);

    return { installed: true, conflicts_resolved: conflicts.length };
  }

  detectConflicts(newCommands, existingDict) {
    const conflicts = [];
    for (const cmd of newCommands) {
      const existing = existingDict.commands.find(c =>
        c.triggers.some(t => cmd.triggers.includes(t))
      );
      if (existing) {
        conflicts.push({ new: cmd, existing });
      }
    }
    return conflicts;
  }
}
```

### CLI for Package Management

```bash
# Install a command pack
one install developer-pack

# Search marketplace
one search git

# List installed packs
one list

# Update all packs
one update

# Remove a pack
one uninstall developer-pack
```

---

## Phase 4 → Multi-Agent Integration

### What Phase 4 Will Build (v1.0)

**AgentOrchestrator Service** (planned):
- Spawn and manage multiple Claude agents
- Route voice commands to agents
- Task decomposition
- Real-time TTS feedback

### How This Extends in v2.0+

The multi-agent foundation built in v1.0 becomes the **execution layer** for v2.0's more intelligent features:

```
v1.0: Voice → Agent Assignment → Task Execution
      ↓
      "Tell builder to fix login bug"

v2.0: Voice → Intent Prediction → Auto-Decomposition → Parallel Execution
      ↓
      "Build me a login system"
      ↓
      [Detects high-level request]
      ↓
      TaskDecomposer:
        - thinker: spec the auth flow
        - builder: implement backend
        - builder: implement frontend
        - tester: write tests
        - ui-pro: polish the UI
      ↓
      [All execute in parallel/sequence based on dependencies]
```

### Extension: Adaptive Task Decomposition

```javascript
// v2.0: src/services/task-decomposer.js (enhanced)
export class TaskDecomposer {
  async decompose(request, context) {
    // EXISTING (v1.0): Basic decomposition
    const basicPlan = await this.llmDecompose(request);

    // NEW (v2.0): Learn from past decompositions
    const similarPast = this.findSimilarRequests(request);
    if (similarPast.success_rate > 0.8) {
      // Reuse proven decomposition pattern
      return this.adaptPattern(similarPast.pattern, request);
    }

    // NEW (v2.0): Context-aware decomposition
    const appContext = await this.detectCurrentProject();
    // Example: detects "this is a React project" → suggests frontend agent

    // NEW (v2.0): Proactive optimization
    const optimized = this.optimizeForParallelism(basicPlan);

    return optimized;
  }

  // Learn successful patterns
  async recordDecomposition(request, plan, outcome) {
    if (outcome.success) {
      this.patternLibrary.save({
        request_type: this.categorize(request),
        pattern: plan,
        success_rate: this.calculateSuccessRate(),
        avg_completion_time: outcome.duration
      });
    }
  }
}
```

---

## Cross-Cutting Themes

### 1. Privacy & Local-First

Every phase respects local-first principles:

| Phase | Privacy Win |
|-------|-------------|
| Phase 1 | Secure keychain storage (not plaintext) |
| Phase 2 | Personal dictionary stays local |
| Phase 3 | Context detection is local polling |
| Phase 4 | Agents run on user's machine |
| **v2.0** | **All learning stays local unless user opts in** |

### 2. Progressive Enhancement

Each phase adds capability without breaking previous work:

```
v0.6: Hardcoded commands
  ↓
v0.7: + AI understanding (Tier 3)
  ↓
v0.8: + Learning & training (confidence system)
  ↓
v0.9: + Context awareness (app profiles)
  ↓
v1.0: + Multi-agent (task decomposition)
  ↓
v1.5: + Local STT (hybrid mode)
  ↓
v2.0: + Local intent + Ecosystem + Adaptive
```

Each tier builds on the previous without requiring rewrites.

### 3. Data Architecture Evolution

```
v0.6: Hardcoded arrays in source code
v0.7: personal_commands.json (user data separated)
v0.8: + confidence, usage_count, learned_at (metadata)
v0.9: + context_rules, app_profiles (context)
v1.0: + workflows (multi-step)
v2.0: + personalized_model.onnx (ML artifacts)
```

The data model grows incrementally, always backwards compatible.

---

## Architecture Validation

### Does v1.0 Enable v2.0?

| v2.0 Pillar | v1.0 Foundation | Status |
|-------------|-----------------|--------|
| **Local Processing** | Tiered resolution, dictionary format | ✅ Extensible |
| **Ecosystem** | JSON commands, training format | ✅ Shareable |
| **Cross-Platform** | Abstracted audio/app control | ✅ Portable |
| **Adaptive Intelligence** | Confidence system, learning loop | ✅ ML-ready |

**Verdict:** v1.0 architecture does NOT block v2.0 goals. The tiered approach and data-driven design create natural extension points.

---

## Open Questions

### For v1.0 Development (Inform Today's Decisions)

1. **Should personal_commands.json include a `source` field?**
   - Enables tracking which commands came from which pack
   - Example: `"source": "one-community/developer-pack@1.0.0"`

2. **Should confidence adjustments be pluggable?**
   - v2.0 might want custom confidence models
   - Consider: `learningLoop.setConfidenceStrategy(myStrategy)`

3. **Should we add telemetry hooks now (disabled by default)?**
   - v2.0 needs opt-in analytics for pattern detection
   - Better to design the hook points now than retrofit

### For v2.0 Planning (Defer These Decisions)

1. **What's the package registry infrastructure?** (GitHub-based vs custom)
2. **How do we handle malicious packages?** (sandboxing, review process)
3. **Which local LLM is best for Tier 2.5?** (Phi-3, Gemma, Llama)

---

## Recommendations for Current Development

### For Thinker (Specs)
- Add `source` field to personal_commands.json schema
- Design telemetry hooks (disabled by default)
- Spec out conflict resolution for future package imports

### For Builder (Implementation)
- Keep IntentResolver extensible (easy to add Tier 2.5)
- Make LearningLoop confidence logic pluggable
- Add hooks for external pattern detectors

### For Dreamer (That's Me!)
- Research local LLM options for Tier 2.5
- Draft Addon SDK spec
- Design package manifest format

---

## Conclusion

**The v1.0 foundation is solid for v2.0 evolution.**

Key successes:
- ✅ Tiered architecture allows inserting local processing
- ✅ Data format is shareable (ecosystem-ready)
- ✅ Learning loop is observation-based (ML-ready)
- ✅ Service architecture is modular (cross-platform ready)

The bridge from v1.0 to v2.0 is not a leap—it's a **natural extension** of patterns already established. Each v1.0 service becomes more capable in v2.0 without requiring rewrites.

**Next Steps:**
1. Validate these extension points with builder
2. Identify any v1.0 blockers for v2.0
3. Add future-proofing to v1.0 specs where low-cost

---

*This document should be updated as Phase 1-4 implementation reveals new insights or constraints.*

*Last updated: 2025-12-09 by dreamer*
