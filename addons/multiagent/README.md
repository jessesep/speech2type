# Multi-Agent Voice Control Addon

Optional voice interface for the Claude multi-agent orchestration system.

**Note**: This addon is a convenience layer. The multi-agent system works standalone without Speech2Type.

## Activation

```
"Computer supervisor mode"
```

Aliases: "multiagent mode", "orchestrator mode"

## Prerequisites

The multi-agent system must be installed at `~/.claude/multiagent/`. See the main multiagent documentation.

## Voice Commands

### Supervisor Commands

| Voice | Action |
|-------|--------|
| "status" | System overview |
| "list agents" | Who is online |
| "list tasks" | What's being worked on |
| "assign alpha to [task]" | Give work |
| "broadcast [message]" | Tell everyone |
| "check messages" | Read inbox |
| "release locks" | Clear stale locks |
| "check on [agent]" | Agent status |

### Executor Commands

First switch to executor mode:
```
"executor alpha"
```

Then:

| Voice | Action |
|-------|--------|
| "my task" | Current assignment |
| "done" | Mark task complete |
| "ask [question]" | Ask supervisor |

## Example Session

### As Supervisor

```
You: "Computer supervisor mode"
S2T: "Supervisor mode active"

You: "list agents"
S2T: "2 executors: alpha ready, beta working"

You: "assign alpha to implement login in src auth"
S2T: "Assigning alpha to implement login..."

You: "check messages"
S2T: "3 messages. From beta: need help with tests..."

You: "broadcast take a 10 minute break"
S2T: "Broadcast sent to 2 agents"
```

### As Executor

```
You: "Computer supervisor mode"
You: "executor alpha"
S2T: "Now executor alpha"

You: "my task"
S2T: "Your task: Implement login. Status: assigned"

You: "ask should I use JWT or sessions"
S2T: "Question sent to supervisor"

[... work on task ...]

You: "done"
S2T: "Marking task complete"
```

## Configuration

Add to `~/.config/speech2type/addons.json`:

```json
{
  "enabled": {
    "multiagent": true
  }
}
```
