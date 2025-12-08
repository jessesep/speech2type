# Claude Code Hooks Extension Guide

> Extend Claude Code hooks for voice-driven workflows

## Overview

Claude Code hooks are shell scripts that run in response to events. Speech2Type already uses the `Stop` hook for TTS. This guide shows how to extend hooks for planning and meta-prompting.

## Existing Hook: speak-response.sh

Located at `claude-hooks/speak-response.sh`:

```bash
#!/bin/bash
# Triggered when Claude finishes a response
# Reads the response aloud via Piper TTS

# Check if auto-speak is enabled
if [ ! -f /tmp/claude-auto-speak ]; then
  exit 0
fi

# Extract transcript and speak
# ... (existing implementation)
```

## Hook Types

| Hook | Trigger | Use Case |
|------|---------|----------|
| `Stop` | Response complete | TTS, task tracking |
| `PreToolUse` | Before tool runs | Validation, logging |
| `PostToolUse` | After tool runs | Result processing |
| `SessionStart` | Session begins | State initialization |
| `UserPromptSubmit` | User sends message | Input processing |

## Adding Planning Hooks

### 1. Task Tracking Hook

Create `claude-hooks/track-task.sh`:

```bash
#!/bin/bash
# PostToolUse hook: Track task completions
# Triggers when Claude uses TodoWrite or completes tasks

HOOK_DATA="$1"
TOOL_NAME=$(echo "$HOOK_DATA" | jq -r '.tool_name // empty')
STATUS_FILE="/tmp/s2t-task-status.json"

# Only process TodoWrite tool
if [ "$TOOL_NAME" != "TodoWrite" ]; then
  exit 0
fi

# Extract todo status
TODOS=$(echo "$HOOK_DATA" | jq -r '.tool_input.todos // empty')

if [ -n "$TODOS" ]; then
  # Count completed vs pending
  COMPLETED=$(echo "$TODOS" | jq '[.[] | select(.status == "completed")] | length')
  PENDING=$(echo "$TODOS" | jq '[.[] | select(.status == "pending")] | length')
  IN_PROGRESS=$(echo "$TODOS" | jq '[.[] | select(.status == "in_progress")] | length')

  # Write status for Speech2Type to read
  cat > "$STATUS_FILE" << EOF
{
  "completed": $COMPLETED,
  "pending": $PENDING,
  "in_progress": $IN_PROGRESS,
  "timestamp": $(date +%s)
}
EOF

  # Notify if all tasks done
  if [ "$PENDING" -eq 0 ] && [ "$IN_PROGRESS" -eq 0 ]; then
    echo "All tasks completed!" > /tmp/s2t-tts-queue.txt
  fi
fi
```

### 2. Plan Progress Hook

Create `claude-hooks/plan-progress.sh`:

```bash
#!/bin/bash
# Stop hook: Update plan progress after Claude response
# Syncs Claude's work with Speech2Type planning state

TRANSCRIPT_PATH="$1"
PLAN_STATUS="/tmp/s2t-planning-status.json"

# Check if we're in planning mode
if [ ! -f "$PLAN_STATUS" ]; then
  exit 0
fi

# Check if response mentions task completion
if [ -f "$TRANSCRIPT_PATH" ]; then
  LAST_RESPONSE=$(tail -1 "$TRANSCRIPT_PATH" | jq -r '.message // empty')

  # Look for completion indicators
  if echo "$LAST_RESPONSE" | grep -qi "task.*complete\|finished\|done with"; then
    # Update planning status
    CURRENT_TASK=$(jq -r '.currentTask' "$PLAN_STATUS")
    TOTAL_TASKS=$(jq -r '.totalTasks' "$PLAN_STATUS")

    # Increment completed count
    jq '.completedTasks += 1' "$PLAN_STATUS" > /tmp/plan-status-tmp.json
    mv /tmp/plan-status-tmp.json "$PLAN_STATUS"

    # Notify Speech2Type
    echo "Task $((CURRENT_TASK + 1)) marked complete" > /tmp/s2t-tts-queue.txt
  fi
fi
```

### 3. Context Alert Hook

Create `claude-hooks/context-alert.sh`:

```bash
#!/bin/bash
# PreToolUse hook: Alert when context is getting full
# Reminds user to create handoff before context limit

# This would be called by Claude Code with context info
# For now, we estimate based on transcript size

TRANSCRIPT_PATH="${HOME}/.claude/transcript.jsonl"
MAX_LINES=500  # Rough estimate for context limit

if [ -f "$TRANSCRIPT_PATH" ]; then
  LINE_COUNT=$(wc -l < "$TRANSCRIPT_PATH")

  if [ "$LINE_COUNT" -gt "$MAX_LINES" ]; then
    # Check if we already warned
    if [ ! -f /tmp/s2t-context-warned ]; then
      echo "Context getting full. Consider saying 'what's next' for handoff." > /tmp/s2t-tts-queue.txt
      touch /tmp/s2t-context-warned
    fi
  fi
fi
```

## Registering Hooks

Add to `~/.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/speech2type/claude-hooks/speak-response.sh"
          },
          {
            "type": "command",
            "command": "/path/to/speech2type/claude-hooks/plan-progress.sh"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "TodoWrite",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/speech2type/claude-hooks/track-task.sh"
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "/path/to/speech2type/claude-hooks/session-init.sh"
          }
        ]
      }
    ]
  }
}
```

## Session Initialization Hook

Create `claude-hooks/session-init.sh`:

```bash
#!/bin/bash
# SessionStart hook: Initialize Speech2Type integration

# Clear stale files
rm -f /tmp/s2t-context-warned
rm -f /tmp/s2t-task-status.json

# Check if Speech2Type is running
if pgrep -f "speech2type" > /dev/null; then
  echo "Speech2Type connected" > /tmp/s2t-tts-queue.txt
fi

# Restore planning state if exists
PLAN_STATUS="/tmp/s2t-planning-status.json"
if [ -f "$PLAN_STATUS" ]; then
  PLAN_TITLE=$(jq -r '.planTitle // "unnamed"' "$PLAN_STATUS")
  COMPLETED=$(jq -r '.completedTasks // 0' "$PLAN_STATUS")
  TOTAL=$(jq -r '.totalTasks // 0' "$PLAN_STATUS")

  if [ "$TOTAL" -gt 0 ]; then
    echo "Resuming plan: $PLAN_TITLE. $COMPLETED of $TOTAL tasks done." > /tmp/s2t-tts-queue.txt
  fi
fi
```

## Integration with Planning Addon

The hooks communicate with Speech2Type via files:

| File | Purpose | Writer | Reader |
|------|---------|--------|--------|
| `/tmp/s2t-tts-queue.txt` | TTS messages | Hooks | Speech2Type |
| `/tmp/s2t-planning-status.json` | Plan state | Addon | Hooks |
| `/tmp/s2t-task-status.json` | Task counts | Hooks | Addon/GUI |
| `/tmp/s2t-command` | Commands | GUI | Speech2Type |

### Reading Hook Output in Speech2Type

Add to `src/index.js`:

```javascript
import { watch } from 'fs';

// Watch for TTS queue messages from hooks
const ttsQueuePath = '/tmp/s2t-tts-queue.txt';

watch(ttsQueuePath, async (eventType) => {
  if (eventType === 'change') {
    try {
      const message = await fs.readFile(ttsQueuePath, 'utf8');
      if (message.trim()) {
        await speakText(message.trim());
        await fs.writeFile(ttsQueuePath, ''); // Clear after reading
      }
    } catch (e) {
      // File might not exist yet
    }
  }
});
```

## Meta-Prompt Hook

Create `claude-hooks/meta-prompt-complete.sh`:

```bash
#!/bin/bash
# Stop hook: Detect when meta-prompt creation is complete

TRANSCRIPT_PATH="$1"
PROMPTS_DIR="${HOME}/.claude/prompts"

if [ -f "$TRANSCRIPT_PATH" ]; then
  LAST_RESPONSE=$(tail -1 "$TRANSCRIPT_PATH" | jq -r '.message // empty')

  # Check if a prompt was created
  if echo "$LAST_RESPONSE" | grep -qi "created prompt\|prompt saved\|ready to run"; then
    # Count prompts
    PROMPT_COUNT=$(ls -1 "$PROMPTS_DIR"/*.md 2>/dev/null | wc -l)

    echo "Prompt created. You now have $PROMPT_COUNT prompts. Say 'run prompt' when ready." > /tmp/s2t-tts-queue.txt
  fi
fi
```

## Debugging Hooks

### Test a hook manually:

```bash
# Simulate Stop hook
echo '{"message": "Task completed"}' > /tmp/test-transcript.jsonl
./claude-hooks/plan-progress.sh /tmp/test-transcript.jsonl
```

### Check hook output:

```bash
# Watch TTS queue
tail -f /tmp/s2t-tts-queue.txt

# Check planning status
cat /tmp/s2t-planning-status.json | jq .
```

### Enable hook logging:

```bash
# Add to top of hook scripts:
exec 2>/tmp/hook-debug.log
set -x
```

## Best Practices

1. **Keep hooks fast** - They block Claude's response
2. **Use file-based IPC** - Reliable across processes
3. **Handle missing files** - Check existence before reading
4. **Clear state files** - Prevent stale data
5. **Log errors** - Redirect stderr for debugging
6. **Test independently** - Run hooks manually first

## Hook Development Workflow

1. Create hook script in `claude-hooks/`
2. Make executable: `chmod +x hook-name.sh`
3. Test manually with sample data
4. Register in `~/.claude/settings.json`
5. Restart Claude Code
6. Test with voice commands
7. Check `/tmp/` files for output
