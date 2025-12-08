# Meta-Prompting Integration

> Separate thinking from execution using voice commands

## What is Meta-Prompting?

Meta-prompting separates the **analysis phase** from the **execution phase**:

1. **Create Prompt** - Claude researches, analyzes, and prepares a detailed prompt
2. **Run Prompt** - Execute the prepared prompt with full context

This prevents Claude from rushing into implementation without proper understanding.

## Why Use Meta-Prompting?

### Without Meta-Prompting
```
You: "Build a voice command system"
Claude: *immediately starts coding*
→ Misses edge cases, makes assumptions, needs multiple revisions
```

### With Meta-Prompting
```
You: "Create a prompt for building a voice command system"
Claude: *researches codebase, identifies patterns, prepares detailed prompt*

You: "Run prompt 1"
Claude: *executes with full context, proper architecture*
→ Better first-attempt quality, fewer revisions
```

## Voice Commands

### Create Prompts

| Voice Command | Action |
|--------------|--------|
| "computer create prompt" | Start prompt creation wizard |
| "computer create prompt for [task]" | Create prompt for specific task |
| "computer meta prompt [description]" | Alias for create prompt |

### Manage Prompts

| Voice Command | Action |
|--------------|--------|
| "computer list prompts" | Read available prompts via TTS |
| "computer show prompt [number]" | Read specific prompt content |
| "computer run prompt [number]" | Execute a prompt |
| "computer delete prompt [number]" | Remove a prompt |

## Implementation

### Adding to Speech2Type

Add these commands to `src/index.js` in `GENERAL_COMMANDS`:

```javascript
// Meta-prompting commands
'computer create prompt': 'meta_create_prompt',
'computer meta prompt': 'meta_create_prompt',
'computer list prompts': 'meta_list_prompts',
'computer run prompt': 'meta_run_prompt',
'computer show prompt': 'meta_show_prompt',
```

Add pattern matching for parameterized commands:

```javascript
// In processTranscript(), add pattern:
const createPromptPattern = /^(?:computer\s+)?(?:create|meta)\s+prompt\s+(?:for\s+)?(.+)$/i;
const runPromptPattern = /^(?:computer\s+)?run\s+prompt\s+(\d+)$/i;
const showPromptPattern = /^(?:computer\s+)?show\s+prompt\s+(\d+)$/i;

const createMatch = normalizedText.match(createPromptPattern);
if (createMatch) {
  const taskDescription = createMatch[1];
  await executeMetaPrompt('create', taskDescription);
  return;
}
```

### Action Handler

```javascript
async function executeMetaPrompt(action, param) {
  const claudePath = process.env.HOME + '/.claude';

  switch (action) {
    case 'create':
      // Write task to temp file for Claude
      const taskFile = '/tmp/s2t-meta-task.txt';
      await fs.writeFile(taskFile, param);

      // Trigger Claude command via osascript
      await typerService.executeInTerminal(
        `cd ${process.cwd()} && claude "/create-prompt ${param}"`
      );
      break;

    case 'list':
      // Read prompts directory
      const promptsDir = `${claudePath}/prompts`;
      const prompts = await fs.readdir(promptsDir);
      await speakText(`You have ${prompts.length} prompts: ${prompts.join(', ')}`);
      break;

    case 'run':
      await typerService.executeInTerminal(
        `cd ${process.cwd()} && claude "/run-prompt ${param}"`
      );
      break;
  }
}
```

## Prompt Storage

Prompts are stored in `~/.claude/prompts/`:

```
~/.claude/prompts/
├── 001-api-architecture.md
├── 002-test-coverage.md
└── 003-refactor-auth.md
```

### Prompt Format

```markdown
# Prompt: API Architecture Design

## Context
- Project: speech2type
- Current state: Basic REST endpoints exist
- Goal: Design scalable API architecture

## Research Summary
- Found 12 existing endpoints in src/api/
- Using Express with middleware pattern
- No versioning currently implemented

## Prepared Prompt
Design a scalable API architecture for the speech2type project that:
1. Implements API versioning (/v1/, /v2/)
2. Adds rate limiting middleware
3. Includes proper error handling
4. Supports future webhook integrations

Consider the existing patterns in src/api/ and maintain compatibility.

## Execution Notes
- Run in project root
- Estimated changes: 5-8 files
- Dependencies: express-rate-limit
```

## Workflow Example

### Voice-Driven Meta-Prompting Session

```
You: "Computer, Claude mode"
S2T: *activates Claude mode with TTS*

You: "Create prompt for adding WebSocket support"
Claude: *researches codebase*
Claude: "I've analyzed your project and created prompt 4.
        It covers real-time event architecture,
        client reconnection handling, and
        integration with your existing addon system.
        Say 'run prompt 4' when ready."

You: "Show prompt 4"
Claude: *reads prompt summary via TTS*

You: "Run prompt 4"
Claude: *executes with full context*
```

## Integration with Planning

Meta-prompting works alongside planning:

```
/create-plan voice-controlled-home-automation
  └── Phase 1: Research
       └── /create-prompt device-discovery-patterns
       └── /create-prompt protocol-selection
  └── Phase 2: Implementation
       └── /run-prompt 1
       └── /run-prompt 2
```

## Best Practices

### When to Use Meta-Prompting

**Use for:**
- Complex features with multiple approaches
- Architectural decisions
- Refactoring large sections
- Tasks requiring codebase understanding

**Skip for:**
- Simple bug fixes
- Adding single functions
- Documentation updates
- One-liner changes

### Prompt Quality

Good prompts include:
- **Context** - What exists now
- **Goal** - What we want to achieve
- **Constraints** - What to preserve/avoid
- **Success criteria** - How to verify completion

### Voice Tips

- Speak clearly when dictating task descriptions
- Use "computer" prefix to ensure command recognition
- Wait for TTS confirmation before next command
- Say "silence" to stop TTS if needed

## Troubleshooting

### "Prompt not created"
- Check Claude is in Claude mode
- Verify `~/.claude/commands/create-prompt.md` exists
- Check terminal output for errors

### "Can't find prompt"
- Prompts stored in `~/.claude/prompts/`
- Use "list prompts" to see available
- Numbers are assigned sequentially

### TTS not reading prompts
- Check TTS is enabled (Cmd+')
- Verify `/tmp/claude-auto-speak` exists
- Check Piper TTS installation
