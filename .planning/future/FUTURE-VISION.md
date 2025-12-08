# ONE: Future Vision (Post v1.0)

> Beyond voice commands - towards an AI-native operating layer

## Executive Summary

ONE v1.0 establishes voice as a powerful command interface with AI understanding and multi-agent orchestration. The future vision extends this foundation into **four strategic pillars**:

1. **Local-First Processing** - Zero-latency, offline-capable, privacy-respecting
2. **Ecosystem & Community** - Shareable commands, workflows, and integrations
3. **Cross-Platform Expansion** - Linux, Windows, and beyond
4. **Adaptive Intelligence** - AI that evolves with each user uniquely

This document outlines the technical architecture, product strategy, and phased implementation for ONE v2.0 and beyond.

---

## Pillar 1: Local-First Processing

### The Vision

Transform ONE from a cloud-dependent system to a **hybrid-local architecture** where:
- Core voice recognition runs locally (sub-100ms latency)
- Intent resolution uses local models with cloud escalation
- User data never leaves the device by default
- Internet is optional, not required

### Why This Matters

| Current (v1.0) | Future (v2.0+) |
|----------------|----------------|
| Deepgram STT (cloud) | Whisper/Moonshine (local) |
| ~300ms round-trip | <100ms local |
| Requires internet | Works offline |
| Usage-based costs | One-time/free |
| Data leaves device | Privacy-first |

### Technical Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    LOCAL PROCESSING STACK                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────────┐    ┌─────────────────┐                   │
│   │   Audio Input   │───▶│  Voice Activity │                   │
│   │  (CoreAudio)    │    │   Detection     │                   │
│   └─────────────────┘    └────────┬────────┘                   │
│                                   │                             │
│                    ┌──────────────┴──────────────┐              │
│                    ▼                             ▼              │
│         ┌─────────────────┐           ┌─────────────────┐      │
│         │  Whisper.cpp    │           │   Moonshine     │      │
│         │  (accuracy)     │           │   (speed)       │      │
│         └────────┬────────┘           └────────┬────────┘      │
│                  │                              │               │
│                  └──────────────┬───────────────┘               │
│                                 ▼                               │
│                    ┌─────────────────┐                          │
│                    │  Local Intent   │                          │
│                    │  Classifier     │                          │
│                    │  (fine-tuned    │                          │
│                    │   small LLM)    │                          │
│                    └────────┬────────┘                          │
│                             │                                   │
│              ┌──────────────┼──────────────┐                   │
│              │ high conf    │ low conf     │ complex           │
│              ▼              ▼              ▼                   │
│     ┌────────────┐  ┌────────────┐  ┌────────────┐            │
│     │  Execute   │  │  Fallback  │  │  Escalate  │            │
│     │  Locally   │  │  Options   │  │  to Cloud  │            │
│     └────────────┘  └────────────┘  └────────────┘            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### Model Selection Strategy

#### Speech-to-Text Options

| Model | Size | Latency | Accuracy | Use Case |
|-------|------|---------|----------|----------|
| **Whisper tiny** | 39MB | ~50ms | 85% | Quick commands |
| **Whisper base** | 74MB | ~100ms | 90% | General use |
| **Whisper small** | 244MB | ~200ms | 93% | High accuracy |
| **Moonshine tiny** | 27MB | ~30ms | 82% | Ultra-fast |
| **Moonshine base** | 61MB | ~60ms | 88% | Balanced |

**Recommended Default:** Whisper base with Moonshine fallback for ultra-low-latency mode.

#### Intent Classification

| Approach | Model | Size | Latency |
|----------|-------|------|---------|
| Tier 1 | Dictionary lookup | ~1KB | <1ms |
| Tier 2 | Fuzzy matching | ~5KB | <5ms |
| Tier 3 | Local LLM (Phi-3-mini) | ~2GB | ~100ms |
| Tier 4 | Cloud (Claude Haiku) | N/A | ~300ms |

### Hybrid Mode

Users can configure processing preference:

```javascript
// ~/.config/one/processing.json
{
  "mode": "hybrid",  // "local" | "cloud" | "hybrid"
  "local_confidence_threshold": 0.85,
  "escalation_policy": "ask",  // "always" | "never" | "ask"
  "offline_fallback": true,
  "local_models": {
    "stt": "whisper-base",
    "intent": "phi-3-mini"
  }
}
```

**Hybrid Flow:**
1. Always attempt local processing first
2. If confidence < threshold, offer escalation
3. User can say "use cloud" or "stay local"
4. Learn from escalation patterns

### Implementation Phases

#### Phase L1: Local STT Foundation
- [ ] Integrate whisper.cpp via Node native addon
- [ ] CoreAudio → Whisper pipeline
- [ ] Model download/management UI
- [ ] A/B testing: local vs cloud accuracy

#### Phase L2: Local Intent Classification
- [ ] Fine-tune Phi-3-mini on command dataset
- [ ] ONNX Runtime integration
- [ ] Confidence calibration
- [ ] Fallback chain implementation

#### Phase L3: Full Offline Mode
- [ ] Local-only mode toggle
- [ ] Graceful degradation UI
- [ ] Sync learned commands when online
- [ ] Offline training mode

### Hardware Considerations

| Device | Whisper base | Phi-3-mini | Experience |
|--------|--------------|------------|------------|
| M1 Mac | ~80ms | ~90ms | Excellent |
| M2/M3 Mac | ~50ms | ~60ms | Premium |
| Intel Mac (2018+) | ~200ms | ~300ms | Acceptable |
| Intel Mac (<2018) | ~500ms | ~800ms | Cloud recommended |

Auto-detect hardware and recommend appropriate mode.

---

## Pillar 2: Ecosystem & Community

### The Vision

Transform ONE from a personal tool into a **platform ecosystem** where:
- Users share command dictionaries and workflows
- Developers create and publish addons
- Community curates best practices
- Learning accelerates through collective intelligence

### Ecosystem Components

```
┌─────────────────────────────────────────────────────────────────┐
│                      ONE ECOSYSTEM                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │                    MARKETPLACE                            │   │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │   │
│  │  │ Command │  │Workflow │  │  Addon  │  │  Voice  │    │   │
│  │  │  Packs  │  │Templates│  │ Plugins │  │  Packs  │    │   │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘    │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│  ┌───────────────────────────┴─────────────────────────────┐   │
│  │                  DISTRIBUTION                             │   │
│  │  • CLI: `one install developer-pack`                     │   │
│  │  • GUI: Marketplace browser                               │   │
│  │  • Sync: Cloud backup of personal configs                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│  ┌───────────────────────────┴─────────────────────────────┐   │
│  │                  COMMUNITY                                │   │
│  │  • GitHub-based package registry                         │   │
│  │  • User ratings & reviews                                │   │
│  │  • Usage analytics (opt-in)                              │   │
│  │  • Community Discord/forum                               │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Command Packs

Pre-packaged command collections for specific use cases:

```yaml
# developer-pack.yaml
name: Developer Essentials
version: 1.0.0
author: one-community
description: Voice commands for software development
categories: [coding, git, terminal]

commands:
  - phrase: ["ship it", "deploy"]
    action: workflow:deploy
    description: Run tests, commit, and deploy

  - phrase: ["nuke node modules", "fresh install"]
    action: script:rm -rf node_modules && npm install
    description: Clean reinstall dependencies

  - phrase: ["what broke", "show errors"]
    action: terminal:npm run lint && npm test
    description: Show linting and test errors

  - phrase: ["open PR", "create pull request"]
    action: script:gh pr create --web
    description: Create PR in browser

conflicts:
  - phrase: "ship it"
    resolution: "ask"  # ask user which to use
```

### Workflow Templates

Shareable multi-step automations:

```yaml
# morning-standup.yaml
name: Morning Standup Prep
trigger_phrases: ["morning standup", "prep for standup"]

steps:
  - name: Open relevant apps
    parallel:
      - action: app:open Slack
      - action: app:open Jira
      - action: app:open GitHub

  - name: Summarize yesterday
    action: script:git log --oneline --since="yesterday" --author="$(git config user.email)"
    speak: "Yesterday you committed {result.count} changes"

  - name: Check today's calendar
    action: script:icalBuddy -f eventsToday
    speak: "You have {result.count} meetings today"

  - name: Open standup doc
    action: url:open https://docs.google.com/your-standup-doc
```

### Addon SDK

Enable developers to extend ONE:

```javascript
// one-addon-sdk example
import { OneAddon, registerCommand, onContext } from '@one/sdk';

export default class SpotifyAddon extends OneAddon {
  name = 'spotify-control';
  version = '1.0.0';

  async onLoad() {
    // Register custom commands
    registerCommand({
      phrases: ['play some music', 'music time'],
      action: () => this.playMusic(),
      context: { app: '*' }  // works in any app
    });

    // Context-aware behavior
    onContext('app:Spotify', () => {
      registerCommand({
        phrases: ['next', 'skip'],
        action: () => this.nextTrack()
      });
    });
  }

  async playMusic() {
    // Spotify API integration
  }
}
```

### Voice Packs

Custom TTS voices and personas:

```yaml
# jarvis-voice.yaml
name: Jarvis
voice_engine: piper
model: en_GB-semaine-medium
personality:
  tone: formal_british
  humor: dry_wit

responses:
  greeting: "Good morning, sir. How may I assist you today?"
  confirmation: "Very good, sir. Consider it done."
  error: "I'm afraid there's been a complication, sir."

custom_phrases:
  - trigger: "weather"
    response: "Allow me to check the atmospheric conditions, sir."
```

### Implementation Phases

#### Phase E1: Export/Import Foundation
- [ ] Command dictionary export (JSON/YAML)
- [ ] Import with conflict resolution
- [ ] Version tracking for dictionaries
- [ ] Diff/merge capabilities

#### Phase E2: Package Format & Registry
- [ ] Define package manifest format
- [ ] GitHub-based registry (like Homebrew)
- [ ] CLI: `one install`, `one search`, `one update`
- [ ] Dependency resolution

#### Phase E3: Marketplace UI
- [ ] GUI marketplace browser
- [ ] Categories, search, ratings
- [ ] One-click install
- [ ] Usage analytics (opt-in)

#### Phase E4: Addon SDK
- [ ] SDK design and documentation
- [ ] Sandboxed addon runtime
- [ ] Example addons (Spotify, Notion, Linear)
- [ ] Developer portal

---

## Pillar 3: Cross-Platform Expansion

### The Vision

Bring ONE's voice-first experience to **every major platform**:
- Native Linux support (not just "works on Linux")
- Windows as first-class citizen
- Consideration for mobile/tablet interfaces
- Web-based settings and configuration

### Platform Strategy

```
                         ┌─────────────────┐
                         │   ONE Core      │
                         │  (TypeScript)   │
                         └────────┬────────┘
                                  │
         ┌────────────────────────┼────────────────────────┐
         │                        │                        │
         ▼                        ▼                        ▼
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   macOS (v1.0)  │    │    Linux (v2.1) │    │   Windows (v2.2)│
│                 │    │                 │    │                 │
│ • Electron GUI  │    │ • GTK/Qt GUI    │    │ • WinUI 3 GUI   │
│ • CoreAudio     │    │ • PipeWire      │    │ • WASAPI        │
│ • AppleScript   │    │ • D-Bus control │    │ • PowerShell    │
│ • Accessibility │    │ • AT-SPI        │    │ • UI Automation │
│ • Keychain      │    │ • libsecret     │    │ • Credential Mgr│
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

### Linux Support

#### Audio Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    LINUX AUDIO STACK                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│    ┌─────────────┐                                          │
│    │ Microphone  │                                          │
│    └──────┬──────┘                                          │
│           │                                                  │
│           ▼                                                  │
│    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐   │
│    │  PipeWire   │───▶│ ONE Audio   │───▶│   Whisper   │   │
│    │  (modern)   │    │   Module    │    │    STT      │   │
│    └─────────────┘    └─────────────┘    └─────────────┘   │
│           │                                                  │
│    ┌──────┴──────┐                                          │
│    │  PulseAudio │ (fallback for older systems)             │
│    │   compat    │                                          │
│    └─────────────┘                                          │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

#### App Control via D-Bus

```javascript
// Linux app control
class LinuxAppController {
  async focusApp(appName) {
    // Use wmctrl or xdotool
    await exec(`wmctrl -a "${appName}"`);
  }

  async sendKeys(keys) {
    // Use xdotool
    await exec(`xdotool key ${keys}`);
  }

  async getActiveWindow() {
    // Query via D-Bus
    const result = await dbus.call('org.gnome.Shell', '/org/gnome/Shell',
      'org.gnome.Shell', 'Eval',
      ['global.display.focus_window.get_title()']);
    return result;
  }
}
```

#### Desktop Environment Support

| DE | Status | App Control | Notes |
|----|--------|-------------|-------|
| GNOME | Priority | D-Bus + Shell extensions | Most popular |
| KDE | Planned | KWin scripts | Second priority |
| XFCE | Planned | xdotool | Lightweight |
| Hyprland | Community | hyprctl | Growing tiling WM |
| Sway | Community | swaymsg | Wayland tiling |

### Windows Support

#### Key Components

```javascript
// Windows-specific implementations needed
const windowsComponents = {
  audio: 'WASAPI',           // Windows Audio Session API
  secrets: 'CredentialManager',  // Windows Credential Store
  appControl: 'UIAutomation',    // Windows UI Automation
  scripts: 'PowerShell',         // Automation scripts
  tray: 'NotifyIcon'             // System tray
};
```

#### PowerShell Integration

```powershell
# Example: Focus application on Windows
function Focus-Application {
    param([string]$AppName)

    $process = Get-Process | Where-Object { $_.MainWindowTitle -like "*$AppName*" }
    if ($process) {
        [Microsoft.VisualBasic.Interaction]::AppActivate($process.Id)
    }
}
```

### Web Settings Interface

Browser-based configuration for all platforms:

```
┌─────────────────────────────────────────────────────────────┐
│  ONE Settings (localhost:7890)                               │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  [General] [Commands] [Workflows] [Addons] [Voice]   │   │
│  └──────────────────────────────────────────────────────┘   │
│                                                              │
│  ┌────────────────────┐  ┌──────────────────────────────┐  │
│  │ Quick Settings     │  │ Command Editor               │  │
│  │                    │  │                              │  │
│  │ Wake Word: [____]  │  │ [Edit] [Delete] [Test]       │  │
│  │ Voice: [dropdown]  │  │                              │  │
│  │ Mode: [hybrid   ]  │  │ ┌──────────────────────────┐ │  │
│  │                    │  │ │ "yeet"                   │ │  │
│  │ [x] Audio feedback │  │ │ → delete_selection       │ │  │
│  │ [ ] Local only     │  │ │ Confidence: 95%          │ │  │
│  │ [x] Learn from use │  │ └──────────────────────────┘ │  │
│  └────────────────────┘  └──────────────────────────────┘  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Phases

#### Phase P1: Linux Alpha
- [ ] PipeWire audio integration
- [ ] Basic GTK system tray
- [ ] xdotool key simulation
- [ ] wmctrl app focus
- [ ] Test on Ubuntu 22.04+

#### Phase P2: Linux Polish
- [ ] GNOME Shell extension (optional)
- [ ] KDE Plasma integration
- [ ] Package formats (deb, rpm, AppImage, Flatpak)
- [ ] Auto-start configuration

#### Phase P3: Windows Alpha
- [ ] WASAPI audio capture
- [ ] WinUI 3 system tray
- [ ] UI Automation for app control
- [ ] Windows Credential Manager

#### Phase P4: Windows Polish
- [ ] Windows installer (MSI/MSIX)
- [ ] Windows Terminal integration
- [ ] WSL awareness
- [ ] Microsoft Store consideration

#### Phase P5: Web Settings
- [ ] Local web server for settings
- [ ] React-based settings UI
- [ ] Real-time preview
- [ ] Import/export via browser

---

## Pillar 4: Adaptive Intelligence

### The Vision

Move beyond static command matching to **truly adaptive AI** that:
- Learns each user's unique communication patterns
- Predicts intent before user finishes speaking
- Proactively suggests automations based on behavior
- Builds personalized language models

### Adaptive Features

#### 1. Predictive Intent

```
User starts: "Can you..."
ONE (internally): [
  { "open Chrome": 0.3 },
  { "focus terminal": 0.25 },
  { "play music": 0.2 },
  { "show calendar": 0.15 },
  ...
]

User continues: "Can you focus..."
ONE (internally): [
  { "focus terminal": 0.7 },
  { "focus Chrome": 0.15 },
  { "focus Slack": 0.1 },
  ...
]

User finishes: "Can you focus the thing I was coding in"
ONE: *focuses VS Code* (understood from context)
```

#### 2. Behavioral Pattern Learning

```javascript
// ONE learns patterns like:
const learnedPatterns = [
  {
    observation: "User always says 'morning routine' after 'good morning'",
    suggestion: "Shall I run your morning routine?"
  },
  {
    observation: "User opens Slack → Jira → GitHub every morning",
    suggestion: "I notice you open these three apps each morning. Want me to create a workflow?"
  },
  {
    observation: "User says 'bigger' in design apps but 'zoom' in code editors",
    suggestion: "I've learned 'bigger' means zoom in Figma but font-size elsewhere"
  }
];
```

#### 3. Personalized Language Model

Fine-tune a small local model on user's vocabulary:

```
Training data (collected with consent):
- User's spoken commands (transcript history)
- User's corrections ("no, I meant...")
- User's custom command names
- User's workflow triggers

Result: personalized_intent_model.onnx
- Understands user's specific vocabulary
- Handles user's accent/speech patterns
- Predicts user's common intents
```

#### 4. Proactive Assistance

```
[9:00 AM - User opens laptop]
ONE: "Good morning. You have a standup in 30 minutes.
      Want me to run your morning prep workflow?"

[User has been coding for 2 hours]
ONE: "You've been focused for a while.
      Want me to hold notifications for another hour?"

[User says "ugh" after a failed build]
ONE: "Build failed. Want me to show you the error output?"
```

### Privacy-First Adaptive Learning

All learning happens locally:

```
┌─────────────────────────────────────────────────────────────┐
│                PRIVACY-FIRST LEARNING                        │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  [User Speech] ──▶ [Local Transcription] ──▶ [Local Model]  │
│                           │                       │          │
│                           ▼                       ▼          │
│                   [Local Storage]         [Local Training]   │
│                                                              │
│  ┌─────────────────────────────────────────────────────┐    │
│  │  DATA NEVER LEAVES DEVICE UNLESS:                    │    │
│  │  • User explicitly shares feedback                   │    │
│  │  • User opts into cloud features                     │    │
│  │  • User exports for backup                           │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                              │
│  User controls:                                              │
│  • [x] Learn from my commands                               │
│  • [ ] Send anonymized usage data                           │
│  • [ ] Cloud sync my dictionary                             │
│  • [x] Auto-delete history after 30 days                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### Implementation Phases

#### Phase A1: Pattern Detection
- [ ] Track command sequences
- [ ] Identify repeated patterns
- [ ] Surface pattern suggestions
- [ ] User feedback loop

#### Phase A2: Predictive Input
- [ ] Streaming transcription analysis
- [ ] Intent probability distribution
- [ ] Configurable prediction display
- [ ] Accuracy metrics

#### Phase A3: Personal Model Fine-tuning
- [ ] Collect training data (with consent)
- [ ] On-device fine-tuning pipeline
- [ ] Model versioning
- [ ] Rollback capability

#### Phase A4: Proactive Features
- [ ] Time-based triggers
- [ ] Context-aware suggestions
- [ ] "Do not disturb" awareness
- [ ] User preference learning

---

## Monetization Strategy

### Core Philosophy

> ONE Core is free and open source forever. Premium features provide convenience, not capability.

### Tiers

```
┌─────────────────────────────────────────────────────────────┐
│                    ONE PRICING TIERS                         │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  ┌─────────────────┐                                        │
│  │   ONE CORE      │  FREE / Open Source                    │
│  │                 │                                        │
│  │  • All voice commands                                    │
│  │  • Local processing                                      │
│  │  • Training mode                                         │
│  │  • Personal dictionary                                   │
│  │  • Community addons                                      │
│  │  • Basic TTS voices                                      │
│  └─────────────────┘                                        │
│                                                              │
│  ┌─────────────────┐                                        │
│  │   ONE PRO       │  $9/month or $79/year                  │
│  │                 │                                        │
│  │  Everything in Core, plus:                               │
│  │  • Cloud backup & sync                                   │
│  │  • Premium TTS voices (20+)                              │
│  │  • Priority cloud processing                             │
│  │  • Advanced analytics dashboard                          │
│  │  • Email support                                         │
│  └─────────────────┘                                        │
│                                                              │
│  ┌─────────────────┐                                        │
│  │   ONE TEAMS     │  $19/user/month                        │
│  │                 │                                        │
│  │  Everything in Pro, plus:                                │
│  │  • Shared team command libraries                         │
│  │  • Admin dashboard                                       │
│  │  • SSO integration                                       │
│  │  • Usage reporting                                       │
│  │  • Dedicated support                                     │
│  └─────────────────┘                                        │
│                                                              │
│  ┌─────────────────┐                                        │
│  │   MARKETPLACE   │  Revenue share (70/30)                 │
│  │                 │                                        │
│  │  • Sell premium addons                                   │
│  │  • Sell voice packs                                      │
│  │  • Sell workflow templates                               │
│  │  • Developer payouts                                     │
│  └─────────────────┘                                        │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

---

## Success Metrics

### Technical Metrics

| Metric | v1.0 Target | v2.0 Target |
|--------|-------------|-------------|
| Command recognition accuracy | >85% | >95% |
| Intent resolution latency (local) | N/A | <100ms |
| Intent resolution latency (cloud) | <500ms | <300ms |
| Offline capability | None | Full |
| Supported platforms | 1 (macOS) | 3 (macOS, Linux, Windows) |

### User Metrics

| Metric | v1.0 Target | v2.0 Target |
|--------|-------------|-------------|
| Daily active users | 100 | 10,000 |
| Commands per user per day | 20 | 50 |
| User retention (30-day) | 40% | 60% |
| Community addons | 0 | 50+ |
| Marketplace revenue | $0 | $10k/month |

### Quality Metrics

| Metric | v1.0 Target | v2.0 Target |
|--------|-------------|-------------|
| Time to teach new command | <30s | <10s |
| Learning curve to productivity | 1 hour | 15 minutes |
| Support tickets per 100 users | <5 | <2 |
| GitHub stars | 100 | 5,000 |

---

## Implementation Timeline

### Phase Overview

```
2025 Q1-Q2: ONE v1.0 (Foundation)
├── AI command understanding
├── Training mode
├── Personal dictionary
└── Multi-agent orchestration

2025 Q3-Q4: ONE v1.5 (Local)
├── Whisper integration
├── Local intent classification
├── Hybrid mode
└── Offline capability

2026 Q1-Q2: ONE v2.0 (Ecosystem)
├── Marketplace launch
├── Addon SDK
├── Community features
└── Linux alpha

2026 Q3-Q4: ONE v2.5 (Expansion)
├── Windows support
├── Web settings
├── Adaptive features
└── Teams tier

2027+: ONE v3.0 (Intelligence)
├── Predictive intent
├── Proactive assistance
├── Personal model fine-tuning
└── Platform partnerships
```

---

## Open Questions

### Technical
1. Should we build whisper.cpp bindings or use existing node-whisper?
2. How to handle model updates without breaking user's personalized data?
3. What's the minimum viable local LLM for intent classification?

### Product
1. How much should we charge for Pro? Should there be a lifetime option?
2. Should marketplace addons be curated or open?
3. How do we prevent low-quality addons from harming the brand?

### Community
1. Should we build our own forum or use Discord?
2. How do we incentivize quality community contributions?
3. What governance model for the open source project?

---

## Next Steps (For Dreamer)

1. **Research local STT options** - Deep dive on Whisper vs Moonshine vs alternatives
2. **Draft Addon SDK spec** - Define the API surface for third-party extensions
3. **Design marketplace UX** - Wireframes for discovery and installation
4. **Community strategy** - Plan for building and nurturing the community

---

*This document represents the strategic vision for ONE beyond v1.0. It will evolve as we learn from users and the market.*

*Last updated: 2025-12-08 by dreamer*
