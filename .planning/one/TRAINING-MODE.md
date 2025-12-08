# Training Mode Specification

> How users teach ONE new commands

## Overview

Training mode is an explicit learning session where users teach ONE custom commands, workflows, and context rules through natural conversation.

## Activation

```
User: "Computer, learn"
   or "Computer, training mode"
   or "Computer, teach you something"

ONE: *chime sound*
ONE: "Training mode. What should I learn?"
```

## Training Types

### 1. Simple Command Mapping

**User wants to map a phrase to an existing action.**

```
User: "When I say 'yeet', delete the selection"

ONE: *parses: phrase="yeet", action=delete_selection*
ONE: "Got it. 'Yeet' will delete the selected text.
      Want to add any other ways to say this?"

User: "Also 'get rid of this'"

ONE: *adds variation*
ONE: "Added. Anything else?"

User: "No"

ONE: "Okay. 'Yeet' or 'get rid of this' will delete selection.
      Say 'confirm' to save or 'cancel' to discard."

User: "Confirm"

ONE: *saves to personal_commands.json*
ONE: *chime sound*
ONE: "Learned! Training mode off."
```

### 2. Workflow Creation

**User wants to create a multi-step sequence.**

```
User: "Create a workflow called 'deploy'"

ONE: "New workflow: 'deploy'. What's the first step?"

User: "Run the tests"

ONE: "Step 1: Run tests. Next step? Say 'done' when finished."

User: "If tests pass, push to git"

ONE: "Step 2: Git push (conditional on step 1). Next?"

User: "Then open the deployment dashboard"

ONE: "Step 3: Open deployment dashboard. Next?"

User: "Done"

ONE: "Workflow 'deploy' has 3 steps:
      1. Run tests
      2. Git push (if tests pass)
      3. Open deployment dashboard

      Trigger phrases: 'deploy', 'run deploy'. Add more?"

User: "Also 'ship it'"

ONE: "Added 'ship it'. Confirm to save?"

User: "Confirm"

ONE: *saves workflow*
ONE: "Workflow saved. Say 'deploy' or 'ship it' to run."
```

### 3. Context Rules

**User wants different behavior per app.**

```
User: "In Photoshop, 'bigger' should zoom in"

ONE: "Got it. In Photoshop, 'bigger' will zoom in.
      Should this also work in other image editors?"

User: "Yes, also Figma and Sketch"

ONE: "Added for Photoshop, Figma, and Sketch.
      Outside these apps, 'bigger' will still mean increase font size.
      Confirm?"

User: "Confirm"

ONE: *saves context rule*
ONE: "Context rule saved."
```

### 4. Correction Mode

**ONE got something wrong, user corrects it.**

```
ONE: *executes wrong action*

User: "No, that's wrong"

ONE: "Sorry! What should I have done?"

User: "I wanted to zoom in, not increase volume"

ONE: "Got it. When you said '{original_phrase}', you meant zoom in.
      Should I remember this?"

User: "Yes"

ONE: *updates mapping, decreases confidence on old mapping*
ONE: "Learned. I'll get it right next time."
```

## Training Mode State Machine

```
                    ┌─────────────────┐
                    │     IDLE        │
                    │  (normal mode)  │
                    └────────┬────────┘
                             │ "computer learn"
                             ▼
                    ┌─────────────────┐
                    │   LISTENING     │
                    │ "What should I  │
                    │    learn?"      │
                    └────────┬────────┘
                             │ user describes
                             ▼
              ┌──────────────┴──────────────┐
              │                             │
              ▼                             ▼
    ┌─────────────────┐           ┌─────────────────┐
    │ SIMPLE_COMMAND  │           │    WORKFLOW     │
    │  (phrase→action)│           │ (multi-step)    │
    └────────┬────────┘           └────────┬────────┘
             │                              │
             ▼                              ▼
    ┌─────────────────┐           ┌─────────────────┐
    │ COLLECTING      │           │ COLLECTING      │
    │  VARIATIONS     │           │    STEPS        │
    └────────┬────────┘           └────────┬────────┘
             │ "done" / "no"               │ "done"
             ▼                              ▼
    ┌─────────────────────────────────────────────┐
    │              CONFIRMING                      │
    │  "Confirm to save or cancel to discard"     │
    └────────────────────┬────────────────────────┘
                         │
           ┌─────────────┴─────────────┐
           │ "confirm"                 │ "cancel"
           ▼                           ▼
    ┌─────────────────┐       ┌─────────────────┐
    │     SAVING      │       │   DISCARDING    │
    │  (write file)   │       │  (no changes)   │
    └────────┬────────┘       └────────┬────────┘
             │                          │
             └──────────┬───────────────┘
                        ▼
               ┌─────────────────┐
               │      IDLE       │
               │  "Training off" │
               └─────────────────┘
```

## Natural Language Parsing

To understand what the user wants to teach, use Claude Haiku:

```
SYSTEM: You are parsing a training request for a voice command system.

USER REQUEST: "When I say 'nuke it', delete everything and start over"

Extract:
1. trigger_phrases: What phrases should trigger this?
2. action_type: Is this a single action, workflow, or context rule?
3. action_description: What should happen?
4. parameters: Any specific parameters?
5. context: Any app/mode restrictions?

RESPOND IN JSON:
{
  "trigger_phrases": ["nuke it"],
  "action_type": "single",
  "action_description": "delete all content and reset",
  "action_mapping": "clear_all_reset",
  "parameters": {},
  "context": null,
  "needs_clarification": false
}
```

## Voice Feedback During Training

Training mode should feel conversational:

| State | ONE Says | Sound |
|-------|----------|-------|
| Enter training | "Training mode. What should I learn?" | ascending chime |
| Understood | "Got it." | soft click |
| Adding variation | "Added." | soft click |
| Need clarification | "I'm not sure what action that maps to. Can you describe it differently?" | question tone |
| Confirming | "Confirm to save?" | waiting tone |
| Saved | "Learned!" | success chime |
| Cancelled | "Cancelled. Training mode off." | descending tone |
| Exit training | "Training mode off." | soft chime |

## Conflict Resolution

What if new phrase conflicts with existing?

```
User: "When I say 'play', open Spotify"

ONE: "'Play' is already mapped to media playback.
      Options:
      1. Replace it (say 'replace')
      2. Make this specific to an app (say 'only in [app]')
      3. Cancel (say 'cancel')

      What would you like?"

User: "Only in Finder"

ONE: "Got it. In Finder, 'play' opens Spotify.
      Everywhere else, 'play' still controls media.
      Confirm?"
```

## Data Structure

```json
// Training session in progress
{
  "session_id": "train_001",
  "started_at": "2024-12-08T21:00:00Z",
  "state": "COLLECTING_VARIATIONS",
  "type": "simple_command",
  "data": {
    "trigger_phrases": ["yeet", "get rid of this"],
    "action": "delete_selection",
    "context": null
  },
  "history": [
    {"role": "user", "content": "When I say 'yeet', delete the selection"},
    {"role": "one", "content": "Got it. 'Yeet' will delete selected text..."},
    {"role": "user", "content": "Also 'get rid of this'"},
    {"role": "one", "content": "Added. Anything else?"}
  ]
}
```

## Exit Conditions

Training mode exits when:
- User says "confirm" → save and exit
- User says "cancel" / "nevermind" → discard and exit
- User says "exit" / "stop" / "done" → prompt to save or discard
- 60 seconds of silence → prompt to save or discard
- User says unrelated command → ask if they want to exit training first

## Undo/Edit Learned Commands

```
User: "Computer, forget 'yeet'"

ONE: "'Yeet' is mapped to delete selection. Remove it?"

User: "Yes"

ONE: *removes from dictionary*
ONE: "Removed. I won't respond to 'yeet' anymore."
```

```
User: "Computer, what does 'ship it' do?"

ONE: "'Ship it' runs your deploy workflow:
      1. Run tests
      2. Git push
      3. Open dashboard

      Say 'edit ship it' to modify or 'forget ship it' to remove."
```

## Implementation Notes

### Files Modified
- `src/services/training-mode.js` (new)
- `src/services/intent-resolver.js` (add training hooks)
- `src/index.js` (state machine integration)

### Key Dependencies
- State machine library (xstate or custom)
- Conversation history buffer
- Claude Haiku for parsing
- File I/O for personal_commands.json

### Builder Tasks
When implementing, builder should:
1. Create TrainingMode class with state machine
2. Add training mode commands to GENERAL_COMMANDS
3. Hook into transcript pipeline
4. Create audio feedback for training states
5. Test with real voice input
