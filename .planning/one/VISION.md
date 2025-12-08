# ONE - One Place to Make Everything

> Voice-first AI operating system for creators

## The Vision

ONE transforms voice from an input method into a **command layer for everything**. It's not about typing with your voice—it's about controlling your entire digital workflow through natural speech, with AI that learns how *you* communicate.

## Core Principles

### 1. Voice-First, Not Voice-Only
- Voice is the primary interface, but keyboard/mouse remain available
- Every action possible via voice should feel *faster* than clicking
- Audio feedback creates a conversational rhythm

### 2. Learn, Don't Configure
- No more adding command variations manually
- Say something once, AI understands intent
- Training mode captures your personal vocabulary
- System gets smarter with every interaction

### 3. Orchestrate, Don't Micromanage
- Spawn multiple AI agents with voice
- Describe what you want, not how to do it
- Agents coordinate automatically
- You supervise, they execute

### 4. Context is Everything
- Knows which app is focused
- Understands your project structure
- Remembers conversation history
- Adapts commands per context

## What ONE Does

### Today (Speech2Type Enhanced)
```
You: "Computer, focus terminal"
ONE: *switches to Terminal*

You: "Affirmative"
ONE: *presses Enter*
```

### Tomorrow (ONE v1.0)
```
You: "Build me a landing page for the app"
ONE: "Got it. I'll spin up two agents—one for design, one for code.
      Want me to show progress as they work?"

You: "Yeah, keep me posted"
ONE: *spawns agents, coordinates work, reports progress*
ONE: "Design agent finished the layout. Code agent is at 60%.
      Should I deploy when ready?"

You: "Ship it when tests pass"
ONE: "Will do. I'll let you know."
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                          ONE                                 │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────┐   │
│  │              VOICE UNDERSTANDING                      │   │
│  │  Speech → Deepgram → Intent Resolution → Action      │   │
│  │            (local)     (Claude Haiku)    (execute)   │   │
│  └─────────────────────────────────────────────────────┘   │
│                            ↓                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              PERSONAL DICTIONARY                      │   │
│  │  • Learned phrases → actions                         │   │
│  │  • Context rules (per-app, per-mode)                │   │
│  │  • Workflow recordings                               │   │
│  └─────────────────────────────────────────────────────┘   │
│                            ↓                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              ORCHESTRATION                            │   │
│  │  • Multi-agent coordination                          │   │
│  │  • Task decomposition                                │   │
│  │  • Progress tracking                                 │   │
│  │  • Conflict resolution                               │   │
│  └─────────────────────────────────────────────────────┘   │
│                            ↓                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              EXECUTION                                │   │
│  │  • Claude Code (coding tasks)                        │   │
│  │  • AppleScript (app control)                         │   │
│  │  • System commands (terminal, files)                 │   │
│  │  • External APIs (Ableton, etc.)                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                            ↓                                │
│  ┌─────────────────────────────────────────────────────┐   │
│  │              FEEDBACK                                 │   │
│  │  • Piper TTS (spoken responses)                      │   │
│  │  • Audio cues (status sounds)                        │   │
│  │  • Menu bar (visual status)                          │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Key Features

### AI Command Understanding
- Natural language → intent mapping
- No exact phrase matching required
- Learns from corrections
- ~$0.00005 per understanding call (Claude Haiku)

### Training Mode
```
You: "Computer, learn"
ONE: "Training mode. What do you want to teach me?"

You: "When I say 'nuke it', delete everything and start over"
ONE: "Got it. 'Nuke it' will clear all and reset. Confirm?"

You: "Affirmative"
ONE: "Learned. Say 'nuke it' anytime."
```

### Dynamic Workflows
```
You: "Computer, create workflow: morning routine"
ONE: "What steps?"

You: "Check Slack, open email, show calendar, play lo-fi"
ONE: "Workflow saved. Say 'morning routine' to run all four."
```

### Multi-Agent Orchestration
```
You: "Spin up three agents for this project"
ONE: *launches alpha, beta, gamma*

You: "Alpha handles backend, beta does frontend, gamma writes tests"
ONE: *assigns scopes, sets up coordination*

You: "Go"
ONE: *agents work in parallel, coordinated, no conflicts*
```

### Per-App Profiles
```
In VS Code:    "run" → npm start
In Ableton:    "run" → play from start
In Figma:      "run" → present prototype
In Terminal:   "run" → execute last command
```

### Voice-First Settings
```
You: "Change my wake word to Jarvis"
ONE: "Wake word updated. I'll respond to 'Jarvis' now."

You: "Jarvis, make your voice deeper"
ONE: *adjusts TTS pitch*
ONE: "How's this?"
```

## Competitive Advantage

| Feature | Siri/Alexa | Talon | ONE |
|---------|------------|-------|-----|
| Custom commands | ❌ | ✅ Manual | ✅ AI-learned |
| Learns your voice | ❌ | ❌ | ✅ |
| Multi-agent | ❌ | ❌ | ✅ |
| Developer-focused | ❌ | ✅ | ✅ |
| Natural language | ✅ Limited | ❌ | ✅ Full |
| Local option | ❌ | ✅ | ✅ Planned |
| Open source | ❌ | ✅ | ✅ |

## Monetization (Future)

- **ONE Core**: Free, open source
- **ONE Pro**: Premium voices, cloud sync, priority support
- **ONE Teams**: Shared workflows, team command libraries
- **Marketplace**: Community addons, workflow templates

## Success Metrics

- Commands understood without exact match: >90%
- Time to learn new command: <10 seconds
- Multi-agent task completion: parallel speedup >2x
- User retention: daily active usage

## The Name

**ONE** = One place to make everything

- One voice to control all apps
- One AI that learns your language
- One system that orchestrates everything
- One interface: your voice

---

*"The best interface is no interface. The second best is your voice."*
