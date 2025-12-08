# Claude-Enhanced Workflows for Speech2Type

> Voice-driven meta-prompting, planning, and agentic workflows

This guide documents how to integrate advanced Claude Code patterns into Speech2Type, enabling voice-controlled planning, meta-prompting, and task execution.

## Overview

Speech2Type already has Claude Code integration via hooks. This documentation extends that foundation with:

1. **Meta-Prompting** - Separate thinking from execution via voice
2. **Planning Mode** - Voice-driven hierarchical project planning
3. **Task Management** - Voice commands for todo tracking
4. **Context Handoffs** - Seamless session transitions

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Voice Input Layer                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │ "plan mode" │  │ "add task"  │  │ "create prompt for" │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
└─────────┼────────────────┼────────────────────┼─────────────┘
          │                │                    │
          ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                  Speech2Type Core (index.js)                 │
│  ┌──────────────────────────────────────────────────────┐   │
│  │ Command Matching: general → addon → patterns         │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
          │                │                    │
          ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                     Addon Layer                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐  │
│  │  Planning   │  │    Tasks    │  │    Meta-Prompt      │  │
│  │   Addon     │  │   Addon     │  │      Addon          │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────┬──────────┘  │
└─────────┼────────────────┼────────────────────┼─────────────┘
          │                │                    │
          ▼                ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                   Claude Code Layer                          │
│  ┌──────────────────────────────────────────────────────┐   │
│  │  ~/.claude/commands/  │  ~/.claude/skills/           │   │
│  │  /create-plan         │  create-plans/               │   │
│  │  /run-prompt          │  create-meta-prompts/        │   │
│  │  /check-todos         │  debug-like-expert/          │   │
│  └──────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

## Quick Start

### 1. Install Claude Code Resources

If you haven't already, install the enhanced Claude Code commands:

```bash
# Clone and install
git clone https://github.com/glittercowboy/taches-cc-resources.git /tmp/taches
cp -r /tmp/taches/commands/* ~/.claude/commands/
cp -r /tmp/taches/skills/* ~/.claude/skills/
cp -r /tmp/taches/agents/* ~/.claude/agents/
```

### 2. Install Planning Addon

Copy the planning addon to your Speech2Type:

```bash
cp -r addons/planning ~/Downloads/hear-0.7/speech2type/addons/
```

### 3. Enable Voice Commands

The planning addon adds these voice commands:

| Voice Command | Action |
|--------------|--------|
| "computer planning mode" | Activate planning mode |
| "computer create plan" | Start new project plan |
| "computer add task [description]" | Add task to current plan |
| "computer next task" | Move to next task |
| "computer check tasks" | Read current tasks via TTS |
| "computer what's next" | Get context handoff summary |

## Documentation

| Guide | Description |
|-------|-------------|
| [Meta-Prompting](./meta-prompting.md) | Separate thinking from execution |
| [Planning Addon](./planning-addon.md) | Voice-driven project planning |
| [Voice Commands](./voice-commands.md) | Complete command reference |
| [Hooks Extension](./hooks-extension.md) | Extend Claude Code hooks |
| [Examples](./examples.md) | Real-world workflow examples |

## Key Concepts

### Meta-Prompting

Instead of asking Claude to do everything at once:

```
"Hey Claude, build me a REST API with auth, database, and tests"
```

Use staged prompting:

```
Voice: "computer create prompt for REST API architecture"
→ Claude researches and creates a detailed prompt

Voice: "computer run prompt 1"
→ Claude executes the prepared prompt with full context
```

### Planning Hierarchies

```
Brief (what & why)
  └── Roadmap (phases)
       └── Phase Plan (tasks)
            └── Task Execution
                 └── Summary (outcomes)
```

### Context Handoffs

When switching sessions or hitting context limits:

```
Voice: "computer what's next"
→ Creates handoff document with:
   - What was accomplished
   - Current state
   - Next steps
   - Key decisions made
```

## Integration Points

Speech2Type integrates with Claude Code via:

1. **File-based IPC** - `/tmp/` files for state sharing
2. **Claude Hooks** - `claude-hooks/speak-response.sh`
3. **Voice Commands** - Mapped to Claude CLI commands
4. **TTS Feedback** - Claude responses read aloud

## File Structure

```
speech2type/
├── addons/
│   └── planning/           # NEW: Planning addon
│       ├── index.js
│       └── README.md
├── claude-hooks/
│   ├── speak-response.sh   # Existing TTS hook
│   └── planning-hook.sh    # NEW: Planning integration
└── docs/
    └── claude-enhanced-workflows/
        ├── README.md       # This file
        ├── meta-prompting.md
        ├── planning-addon.md
        ├── voice-commands.md
        ├── hooks-extension.md
        └── examples.md
```

## Philosophy

> "When you use a tool like Claude Code, it's your responsibility to assume everything is possible."

This integration embraces:

- **Voice-first** - Keyboard optional
- **Staged execution** - Think, then do
- **Context preservation** - Never lose progress
- **Seamless handoffs** - Switch sessions without friction
