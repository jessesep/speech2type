# Planning Addon

Voice-driven project planning for Speech2Type with Claude Code integration.

## Activation

```
"Computer planning mode"
```

Aliases: "plan mode", "planner mode", "project mode"

## Features

- Voice-controlled task management
- Integration with Claude Code `/create-plan` and `/run-plan`
- Automatic plan persistence
- Context handoff for session continuity
- Mental framework shortcuts

## Commands

### Plan Management

| Voice Command | Action |
|--------------|--------|
| "create plan" | Start new plan with Claude |
| "create plan for [desc]" | Create plan for specific project |
| "list plans" | Show available plans |
| "open plan" | Open most recent plan |
| "open plan [name]" | Open specific plan |
| "close plan" | Close current plan |

### Task Navigation

| Voice Command | Action |
|--------------|--------|
| "task [number]" | Jump to specific task |
| "next task" | Move forward |
| "previous task" | Move backward |
| "first task" | Go to start |
| "last task" | Go to end |
| "current task" | Read current task |

### Task Execution

| Voice Command | Action |
|--------------|--------|
| "run task" | Execute current task with Claude |
| "run task [number]" | Execute specific task |
| "complete task" / "done" | Mark task complete |
| "skip task" | Skip to next |

### Status

| Voice Command | Action |
|--------------|--------|
| "check tasks" | Hear progress summary |
| "plan status" / "status" | Full status report |
| "review plan" | Read all tasks |
| "what's next" | Create handoff document |

### Meta-Prompting

| Voice Command | Action |
|--------------|--------|
| "create prompt" | Start prompt creation |
| "create prompt for [task]" | Create prompt for task |
| "list prompts" | Show available prompts |
| "run prompt [number]" | Execute a prompt |

### Mental Frameworks

| Voice Command | Action |
|--------------|--------|
| "consider pareto" | 80/20 analysis |
| "consider first principles" | Break down fundamentals |
| "consider inversion" | Think backwards |
| "consider five whys" | Root cause analysis |
| "consider second order" | Consequence thinking |

## File Locations

| File | Purpose |
|------|---------|
| `~/.claude/plans/` | Stored plan files |
| `/tmp/s2t-planning-status.json` | Current state |
| `/tmp/s2t-tts-queue.txt` | TTS output queue |

## Integration

This addon integrates with Claude Code commands installed from taches-cc-resources:

- `/create-plan` - Hierarchical planning
- `/run-plan` - Execute plan files
- `/whats-next` - Context handoff
- `/consider:*` - Mental frameworks

## Example Session

```
You: "Computer planning mode"
S2T: "Planning mode activated"

You: "Create plan for authentication system"
Claude: *creates hierarchical plan*

You: "Check tasks"
S2T: "6 tasks. Next: Research auth libraries"

You: "Run task"
Claude: *executes research*

You: "Complete task"
S2T: "Task 1 completed. Next: Design token schema"

You: "What's next"
S2T: "Creating handoff document"
```

## Configuration

Add to `~/.config/speech2type/addons.json`:

```json
{
  "enabled": {
    "planning": true
  },
  "settings": {
    "planning": {
      "ttsEnabled": true,
      "commandsOnly": true
    }
  }
}
```
