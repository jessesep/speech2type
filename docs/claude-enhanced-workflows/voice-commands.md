# Voice Commands Reference

> Complete reference for Claude-enhanced voice commands

## Command Structure

All commands follow the pattern:

```
"computer [command] [optional parameters]"
```

The "computer" prefix ensures commands aren't triggered by regular speech.

## General Mode Commands

These work in any mode:

### Mode Switching

| Command | Action |
|---------|--------|
| "computer planning mode" | Activate planning addon |
| "computer claude mode" | Activate Claude mode with TTS |
| "computer power mode" | Alias for Claude mode |
| "computer general mode" | Return to general mode |
| "computer music mode" | Activate Ableton addon |

### Basic Controls

| Command | Action |
|---------|--------|
| "affirmative" | Press Enter (submit) |
| "retract" | Undo last typed text |
| "computer scratch" | Clear all text |
| "computer copy" | Copy selection |
| "computer paste" | Paste clipboard |
| "computer save" | Save file (Cmd+S) |
| "computer find" | Open find dialog |
| "silence" | Stop TTS playback |

### Navigation

| Command | Action |
|---------|--------|
| "computer focus [app]" | Switch to app |
| "computer switch to [app]" | Switch to app |
| "terminal [number]" | Focus terminal window |
| "terminal claude" | Focus terminal named "claude" |
| "computer new tab" | Open new tab |
| "computer close tab" | Close current tab |

## Planning Mode Commands

Activated with "computer planning mode":

### Plan Management

| Command | Action |
|---------|--------|
| "create plan" | Start interactive plan creation |
| "create plan for [description]" | Create plan with description |
| "list plans" | Read available plans |
| "open plan [name]" | Load specific plan |
| "close plan" | Close current plan |
| "delete plan" | Delete a plan |

### Task Navigation

| Command | Action |
|---------|--------|
| "task [number]" | Jump to specific task |
| "next task" | Move to next task |
| "previous task" | Move to previous task |
| "first task" | Go to first task |
| "last task" | Go to last task |
| "current task" | Read current task |

### Task Execution

| Command | Action |
|---------|--------|
| "run task" | Execute current task with Claude |
| "run task [number]" | Execute specific task |
| "start task" | Mark task as started |
| "complete task" | Mark task as done |
| "skip task" | Skip to next task |

### Status & Review

| Command | Action |
|---------|--------|
| "check tasks" | Hear progress summary |
| "plan status" | Full plan status |
| "review plan" | Read all tasks |
| "what's next" | Create handoff document |

### Quick Adds

| Command | Action |
|---------|--------|
| "add task [description]" | Add new task |
| "add note" | Add note to current task |

## Meta-Prompting Commands

Work in Claude mode or general mode:

### Prompt Creation

| Command | Action |
|---------|--------|
| "create prompt" | Interactive prompt creation |
| "create prompt for [task]" | Create prompt for task |
| "meta prompt [description]" | Alias for create prompt |

### Prompt Management

| Command | Action |
|---------|--------|
| "list prompts" | Show available prompts |
| "show prompt [number]" | Read prompt content |
| "run prompt [number]" | Execute prompt |
| "delete prompt [number]" | Remove prompt |

## Claude Mode Commands

Activated with "computer claude mode" or "computer power mode":

| Command | Action |
|---------|--------|
| "affirmative" | Submit and auto-pause |
| Cmd+' (hotkey) | Toggle TTS |
| "silence" | Stop current TTS |

Claude mode features:
- Auto-pause listening after submit
- Auto-resume when Claude finishes
- TTS enabled by default

## Mental Framework Commands

Quick thinking tools (work in any mode):

| Command | Claude Slash Command |
|---------|---------------------|
| "consider pareto" | `/consider:pareto` |
| "consider first principles" | `/consider:first-principles` |
| "consider inversion" | `/consider:inversion` |
| "consider second order" | `/consider:second-order` |
| "consider five whys" | `/consider:5-whys` |
| "consider occams razor" | `/consider:occams-razor` |
| "consider one thing" | `/consider:one-thing` |
| "consider swot" | `/consider:swot` |
| "consider eisenhower" | `/consider:eisenhower-matrix` |
| "consider ten ten ten" | `/consider:10-10-10` |
| "consider opportunity cost" | `/consider:opportunity-cost` |
| "consider via negativa" | `/consider:via-negativa` |

## Pattern Matching

Some commands use pattern matching for flexibility:

### Numbers
```
"task 1" → goto_task(1)
"task 5" → goto_task(5)
"run prompt 3" → run_prompt(3)
```

### App Names
```
"focus chrome" → focusApp('chrome')
"switch to terminal" → focusApp('terminal')
"go to slack" → focusApp('slack')
```

### Descriptions
```
"create plan for REST API" → createPlan('REST API')
"add task implement login" → addTask('implement login')
```

## Hotkeys

| Hotkey | Action |
|--------|--------|
| Cmd+; | Toggle listening |
| Cmd+' | Toggle TTS |
| Cmd+Option (hold) | Push-to-talk (addon modes) |
| Spacebar | Stop TTS |
| Ctrl (tap) | Submit and stop (addon modes) |

## Command Aliases

Many commands have aliases for natural speech variations:

| Primary | Aliases |
|---------|---------|
| "planning mode" | "plan mode", "planner mode" |
| "create plan" | "new plan", "start planning" |
| "what's next" | "whats next", "hand off", "handoff" |
| "check tasks" | "show tasks", "list tasks" |
| "run task" | "execute task", "do task" |

## Adding Custom Commands

### In General Mode

Edit `src/index.js`, add to `GENERAL_COMMANDS`:

```javascript
'computer my command': 'my_action',
```

### In Planning Addon

Edit `addons/planning/index.js`, add to `commands`:

```javascript
'my command': 'my_action',
```

Then handle in `execute()`:

```javascript
case 'my_action':
  return myActionHandler();
```

### Pattern Commands

Add to `patterns` array:

```javascript
{
  pattern: /^my\s+command\s+(.+)$/i,
  action: 'my_parameterized_action',
  extract: (match) => match[1].trim(),
}
```

## Tips for Voice Commands

1. **Speak clearly** - Pause briefly before command words
2. **Use "computer" prefix** - Prevents accidental triggers
3. **Wait for confirmation** - TTS will confirm actions
4. **Say "silence"** - Stop TTS anytime
5. **Numbers work** - "task 3", "prompt 2", etc.
6. **App names are flexible** - "chrome", "Google Chrome", etc.

## Troubleshooting

### Command not recognized
- Check spelling in transcription
- Add aliases for common mishearings
- Verify mode is correct (planning vs general)

### Wrong action triggered
- Make command more specific
- Add "computer" prefix if missing
- Check for similar commands

### TTS not responding
- Check Cmd+' toggle state
- Verify `/tmp/claude-auto-speak` exists
- Check Piper TTS installation
