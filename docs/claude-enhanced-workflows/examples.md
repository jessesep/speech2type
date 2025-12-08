# Workflow Examples

> Real-world examples of voice-driven Claude workflows

## Example 1: Starting a New Feature

### Scenario
You want to add WebSocket support to Speech2Type for real-time status updates.

### Voice Workflow

```
You: "Computer claude mode"
S2T: *activates Claude mode*

You: "Computer planning mode"
S2T: "Planning mode activated"

You: "Create plan for adding WebSocket support to Speech2Type"
S2T: "Creating plan..."

Claude: *researches codebase, creates plan*
Claude: "I've created a plan with 6 tasks:
         1. Research WebSocket libraries
         2. Design message protocol
         3. Implement WebSocket server
         4. Update GUI to connect
         5. Add real-time status events
         6. Test and document

         Say 'check tasks' to review or 'run task' to start."

You: "Check tasks"
S2T: "6 tasks total. First task: Research WebSocket libraries"

You: "Run task"
S2T: "Running task 1..."
Claude: *researches ws, socket.io, uWebSockets*
Claude: "Research complete. Recommending 'ws' library for its
         simplicity and native feel. Shall I proceed to task 2?"

You: "Affirmative"
S2T: *submits, pauses listening*
Claude: *designs message protocol*
```

## Example 2: Debugging with Meta-Prompts

### Scenario
The TTS is cutting off mid-sentence. You want systematic debugging.

### Voice Workflow

```
You: "Computer debug TTS cutting off mid-sentence"
S2T: *activates debug mode*

Claude: "Starting systematic debug investigation.

         Phase 1: Evidence Gathering
         - Checking speak-response.sh
         - Reviewing TTS lock file handling
         - Examining audio playback code

         I found 3 potential issues. Creating debug prompt..."

You: "Show prompt 1"
Claude: "Debug Prompt: TTS Cutoff Issue

         Hypothesis 1: Race condition in lock file
         - Evidence: Lock file removed before playback completes
         - Test: Add completion callback

         Hypothesis 2: Buffer underrun
         - Evidence: Fast speech rate setting
         - Test: Increase buffer size

         Hypothesis 3: Process termination
         - Evidence: Multiple afplay processes
         - Test: Add process management"

You: "Run prompt 1"
Claude: *executes debug plan*
Claude: "Fixed! The issue was hypothesis 1 - the lock file
         was being removed in a finally block before afplay
         finished. Added completion callback."

You: "Computer complete task"
S2T: "Debug task completed"
```

## Example 3: Context Handoff

### Scenario
You've been working for an hour and want to continue tomorrow.

### Voice Workflow

```
You: "Computer what's next"
S2T: "Creating context handoff..."

Claude: *generates handoff document*

Claude: "Handoff document created at .claude/handoffs/2024-01-15.md

         Summary:
         - Implemented WebSocket server (tasks 1-3 complete)
         - GUI connection working but needs error handling
         - Discovered bug in reconnection logic

         Next session:
         1. Fix reconnection bug (line 245 in gui/main.cjs)
         2. Add connection status indicator
         3. Test with poor network conditions

         Key decisions made:
         - Using 'ws' library (not socket.io)
         - Binary protocol for efficiency
         - Heartbeat every 30 seconds"

You: "Computer general mode"
S2T: "General mode. Goodbye!"
```

### Next Day

```
You: "Computer claude mode"
You: "Load yesterday's handoff"

Claude: *reads handoff document*
Claude: "Welcome back! Yesterday you completed WebSocket
         implementation tasks 1-3. You have 3 remaining items:

         1. Fix reconnection bug at gui/main.cjs:245
         2. Add connection status indicator
         3. Network testing

         Shall I start with the reconnection bug?"

You: "Affirmative"
```

## Example 4: Mental Framework Decision

### Scenario
Choosing between SQLite and JSON files for addon settings storage.

### Voice Workflow

```
You: "Consider first principles for addon settings storage"
S2T: *triggers mental framework*

Claude: "Breaking down to first principles:

         What do we actually need?
         - Persist key-value pairs
         - Read on startup
         - Write on settings change
         - Human-editable (for debugging)

         What constraints exist?
         - Single user (no concurrency)
         - Small data (<100KB typically)
         - Already using JSON for config

         First principles answer:
         JSON files. SQLite adds complexity without benefit.
         You don't need queries, transactions, or scaling.
         JSON is human-readable and consistent with existing
         config.json approach.

         Recommendation: Keep using JSON files."

You: "Consider pareto for addon settings"
Claude: "80/20 analysis:

         20% of settings cause 80% of problems:
         - API keys (security, validation)
         - Hotkey conflicts (user frustration)
         - Audio device selection (hardware variance)

         Focus validation and UX on these three areas.
         Other settings rarely cause issues."
```

## Example 5: Full Project Planning

### Scenario
Building a new "dictation mode" addon from scratch.

### Voice Workflow

```
You: "Computer planning mode"
You: "Create plan for dictation mode addon"

Claude: "Analyzing addon architecture...

         Created hierarchical plan:

         Phase 1: Foundation
         - [ ] Create addon directory structure
         - [ ] Define metadata and activation phrase
         - [ ] Implement basic command set

         Phase 2: Core Features
         - [ ] Add punctuation by voice
         - [ ] Implement formatting commands
         - [ ] Create undo/redo stack

         Phase 3: Polish
         - [ ] Add voice feedback sounds
         - [ ] Create documentation
         - [ ] Test with real documents

         9 tasks total. Say 'task 1' to start."

You: "Task 1"
S2T: "Task 1: Create addon directory structure"

You: "Run task"
Claude: *creates addons/dictation/index.js and README.md*
Claude: "Created addon structure. Basic skeleton ready.
         Task 1 complete. Next: Define metadata."

You: "Complete task"
S2T: "Task 1 completed. Moving to task 2."

You: "Run task"
Claude: *implements metadata with mode command "dictation mode"*

[... continues through all tasks ...]

You: "Plan status"
S2T: "Dictation Mode addon. 100% complete. 9 of 9 tasks done."
```

## Example 6: Quick Thinking Tools

### Scenario
Deciding whether to refactor the command matching system.

```
You: "Consider via negativa for command matching refactor"

Claude: "Via Negativa - improve by removing:

         Current command matching has:
         - 3 levels (general → addon → patterns)
         - 80+ command variations
         - Fuzzy matching attempts
         - Multiple regex passes

         What can we remove?
         - Fuzzy matching: Causes more mis-triggers than helps
         - Duplicate aliases: 'affirmative'/'computer affirmative'
         - Dead code: Unused pattern branches

         Don't add new matching logic. Remove the fuzzy
         matching and consolidate aliases. Simpler = better."

You: "Consider second order effects"

Claude: "Second-order thinking on refactor:

         First order: Cleaner code, faster matching

         Second order:
         - Users with muscle memory will stumble
         - Existing tutorials/docs become wrong
         - Addons using internal APIs may break
         - You'll want to add features back later

         Third order:
         - Breaking changes erode trust
         - Docs update takes time from features

         Recommendation: If it works, don't refactor.
         Only fix specific bugs. Total rewrites rarely
         deliver promised benefits."
```

## Example 7: Multi-Session Project

### Day 1: Research

```
You: "Create plan for voice shortcuts feature"
Claude: *creates 12-task plan across 4 phases*

You: "Run task 1"
Claude: *researches existing shortcut systems*

You: "Run task 2"
Claude: *analyzes user needs*

You: "What's next"
Claude: *creates handoff: "Completed research phase..."*
```

### Day 2: Design

```
You: "Load handoff"
You: "Check tasks"
S2T: "2 of 12 complete. Next: Design shortcut schema"

You: "Run task"
Claude: *designs JSON schema for shortcuts*

You: "Consider pareto for shortcuts"
Claude: *identifies top 20% of shortcuts to implement first*
```

### Day 3: Implementation

```
You: "Plan status"
S2T: "Voice Shortcuts. 40% complete. 5 of 12 tasks."

You: "Task 6"
S2T: "Task 6: Implement shortcut parser"

You: "Create prompt for shortcut parser"
Claude: *creates detailed implementation prompt*

You: "Run prompt 1"
Claude: *implements parser with full context*
```

## Tips from Examples

1. **Start with planning mode** for any multi-step work
2. **Use meta-prompts** for complex implementations
3. **Check tasks frequently** to maintain context
4. **Create handoffs** before ending sessions
5. **Apply mental frameworks** when stuck on decisions
6. **Complete tasks explicitly** to track progress
7. **Run one task at a time** for best results
