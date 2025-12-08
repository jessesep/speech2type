# Agent Voice Control Specification

> Natural language interface for multi-agent orchestration

## Overview

This spec defines how users interact with the multi-agent system through natural speech. Unlike traditional command-line interfaces with rigid syntax, ONE learns command variations and understands context.

## Design Principles

1. **Natural Language First** - "Tell the builder to fix the login" not "/assign builder fix-login"
2. **Context Aware** - ONE knows which agents exist, what they're doing, and what makes sense
3. **Learnable** - Users can teach ONE their own command patterns
4. **Forgiving** - Handles variations, typos (in transcription), incomplete requests
5. **Feedback Rich** - Confirms actions, reports progress, surfaces errors

---

## Command Categories

### 1. System Control

**Intent:** Manage the multi-agent system itself

| User says | Canonical action | Behavior |
|-----------|------------------|----------|
| "Start the agents" | `multiagent.start_all` | Spawn all enabled executors |
| "Wake up the team" | `multiagent.start_all` | Same |
| "Spin up the agents" | `multiagent.start_all` | Same |
| "Stop all agents" | `multiagent.stop_all` | Graceful shutdown all |
| "Shut down the team" | `multiagent.stop_all` | Same |
| "Restart the agents" | `multiagent.restart_all` | Stop → start |
| "Start the builder" | `multiagent.start:builder` | Spawn specific agent |
| "Stop the tester" | `multiagent.stop:tester` | Stop specific agent |

**Response examples:**
```
User: "Start the agents"
ONE: "Starting 5 agents: thinker, builder, tester, dreamer, ui-pro."

[3 seconds later]
ONE: "All agents online."
```

### 2. Status & Monitoring

**Intent:** Query system state

| User says | Action | Returns |
|-----------|--------|---------|
| "Status" | `multiagent.status` | Overview of all agents |
| "What's everyone doing?" | `multiagent.status` | Same |
| "How are the agents?" | `multiagent.health` | Health check |
| "List the agents" | `multiagent.list_agents` | Agent names + status |
| "What's the builder doing?" | `multiagent.agent_status:builder` | Specific agent |
| "Show me the tasks" | `multiagent.list_tasks` | Active task queue |
| "What tasks are running?" | `multiagent.list_tasks` | Same |
| "Check messages" | `multiagent.check_inbox` | Read supervisor inbox |
| "Any updates?" | `multiagent.check_inbox` | Same |

**Response examples:**
```
User: "Status"
ONE: "5 agents online. Builder is working on task 42. Tester idle. 
      Thinker, dreamer, ui-pro idle."

User: "What's the builder doing?"
ONE: "Builder is implementing login flow. Started 2 minutes ago."

User: "Check messages"
ONE: "3 messages. Tester says: Tests complete, all passing. 
      Builder asks: Should I use JWT or sessions?"
```

### 3. Task Assignment

**Intent:** Give work to agents

| User says | Parsed as | Behavior |
|-----------|-----------|----------|
| "Tell the builder to fix the login bug" | agent=builder, task="fix login bug" | Direct assignment |
| "Builder, implement authentication" | Same | Same |
| "Have the tester run the tests" | agent=tester, task="run tests" | Same |
| "Assign the thinker to plan Phase 5" | agent=thinker, task="plan Phase 5" | Same |

**Parsing rules:**
1. Extract agent name: "the [agent]", "[agent],", "assign [agent]"
2. Extract task: everything after "to", "implement", "run", "plan", etc.
3. If ambiguous → ask for clarification

**Response:**
```
User: "Tell the builder to add a search bar"
ONE: "Assigning builder: add a search bar."

[Builder receives message, starts work]
```

### 4. Task Decomposition

**Intent:** High-level requests → break down → assign

| User says | Behavior |
|-----------|----------|
| "Build me a login system" | Decompose into subtasks |
| "Create a user dashboard" | Same |
| "Add dark mode to the app" | Same |
| "Implement the roadmap" | Same |

**Flow:**
1. IntentResolver detects high-level request (no direct command match)
2. TaskDecomposer analyzes request + context
3. Generate task breakdown
4. Confirm with user (optional)
5. Assign tasks to agents
6. Monitor execution
7. Report completion

**Example:**
```
User: "Build me a login system"

ONE: "Breaking down task..."

[2 seconds - Claude API call]

ONE: "I'll have the thinker plan the architecture, builder implement 
      the backend, ui-pro create the UI, and tester validate. 
      Sound good?"

User: "Yes"

ONE: "Starting. Thinker working on architecture plan."

[Execution happens]

[5 minutes later]
ONE: "Login system complete. Authentication working, UI ready, 
      tests passing."
```

**Confirmation modes:**
- **Auto** - Execute without asking (default for simple tasks)
- **Confirm** - Ask before starting (complex tasks, >3 subtasks)
- **Manual** - User explicitly says "yes" to proceed

### 5. Broadcasting

**Intent:** Send message to all agents

| User says | Action |
|-----------|--------|
| "Tell everyone to take a break" | Broadcast message |
| "Broadcast: pause work" | Same |
| "Announce: new priority is security" | Same |

**Response:**
```
User: "Tell everyone to focus on performance"
ONE: "Broadcasting to 5 agents: focus on performance."
```

### 6. Coordination

**Intent:** Manage file locks, conflicts, handoffs

| User says | Action |
|-----------|--------|
| "Release all locks" | Clear file locks |
| "Clear locks" | Same |
| "Who has the lock on index.js?" | Query lock holder |
| "Tell the builder to hand off to tester" | Initiate handoff |

**Response:**
```
User: "Who has the lock on index.js?"
ONE: "Builder has locked index.js since 2 minutes ago."

User: "Tell builder to release it"
ONE: "Asking builder to release index.js lock."
```

### 7. Emergency Controls

**Intent:** Stop runaway work, handle errors

| User says | Action |
|-----------|--------|
| "Stop everything!" | Emergency stop all agents |
| "Cancel all tasks" | Clear task queue |
| "Emergency shutdown" | Stop + save state |
| "Kill the builder" | Force terminate agent |

**Response:**
```
User: "Stop everything!"
ONE: "Emergency stop. Stopping 5 agents, saving state..."

[2 seconds]

ONE: "All agents stopped. State saved."
```

---

## Intelligent Parsing

### Agent Name Extraction

**Patterns:**
- "the [agent]" → "the builder"
- "[agent]," → "builder,"
- "assign [agent]" → "assign tester"
- "have [agent]" → "have thinker"
- "tell [agent]" → "tell ui-pro"

**Validation:**
- Check against known agents: thinker, builder, tester, dreamer, ui-pro
- Fuzzy match: "biilder" → builder (transcription errors)
- Handle plurals: "the builders" → builder

**Ambiguity handling:**
```
User: "Tell them to implement login"

ONE: "Which agent? Builder, ui-pro, or someone else?"

User: "Builder"

ONE: "Got it. Assigning builder."
```

### Task Extraction

**Indicators:**
- "to [task]" → "to fix the bug"
- "implement [task]"
- "work on [task]"
- "create [task]"
- "plan [task]"
- Everything after agent name (if delimiter clear)

**Context enrichment:**
- Current app: "add search" + VSCode context → "add search to current project"
- Recent commands: "fix it" + last mentioned bug → "fix login bug"
- Mode: In music mode → music-related tasks preferred

**Examples:**
```
User: "Builder, add authentication"
→ agent=builder, task="add authentication"

User: "Have the thinker plan Phase 5"
→ agent=thinker, task="plan Phase 5"

User: "Tell tester to run the tests in src/"
→ agent=tester, task="run tests in src/"
```

### Multi-Agent Assignments

**Parallel:**
```
User: "Builder and ui-pro, work on the dashboard"

→ Assign both agents the same task
→ They coordinate via file locking
```

**Sequential:**
```
User: "Thinker plan it, then builder implement it"

→ Assign thinker first
→ When thinker completes, assign builder with thinker's output as context
```

**Role-based:**
```
User: "Everyone, review the codebase"

→ thinker reviews architecture
→ builder reviews implementation
→ tester reviews test coverage
→ ui-pro reviews UI/UX
→ dreamer reviews long-term vision
```

---

## Learning Custom Commands

### Training Mode Integration

Users can teach ONE their own agent commands:

```
User: "Computer, learn"
ONE: "Training mode. What should I learn?"

User: "When I say 'deploy the team', start all agents"
ONE: "Got it. 'Deploy the team' will start all agents. 
      Any other ways to say this?"

User: "Also 'wake everyone up'"
ONE: "Added. Anything else?"

User: "No"
ONE: "Okay. 'Deploy the team' or 'wake everyone up' will start all agents.
      Say confirm to save."

User: "Confirm"
ONE: "Learned!"
```

**Stored as:**
```json
{
  "phrase": "deploy the team",
  "variations": ["wake everyone up"],
  "action": "multiagent.start_all",
  "category": "multiagent",
  "confidence": 1.0
}
```

### Learning from Corrections

```
User: "Tell the builder to add login"
ONE: "Assigning builder: add login"

User: "No, I meant the ui-pro"
ONE: "Oh, switching to ui-pro. Canceling builder's task."

[Learning: "add login" → likely UI task → ui-pro preferred]
```

---

## Context-Aware Behavior

### Project Context

**ONE knows:**
- What project is in focus (via app detection)
- What files were recently edited
- What commands were recently run

**Example:**
```
[User just edited src/auth.js in VSCode]

User: "Builder, fix the bug here"

ONE interprets:
- "here" = src/auth.js (from context)
- Sends to builder: "Fix bug in src/auth.js"
```

### Task History

**ONE remembers:**
- Last 20 commands
- Last 10 agent assignments
- Recent completions

**Example:**
```
User: "What's the status?"
ONE: "Builder finished login UI. Tester running validation."

User: "How's that going?"
ONE: [knows "that" = tester's validation]
      "Tester is 50% done. 12 tests passing so far."
```

### Mode Context

**In different modes:**
- **Claude mode** → "Ask the agent" = ask Claude directly (not multiagent)
- **Multiagent mode** → "Ask the agent" = query multiagent system
- **General mode** → Ambiguous → ask for clarification

---

## Voice Feedback Design

### Confirmation Messages

**Keep it brief:**
- ✅ "Assigned to builder."
- ❌ "I have successfully assigned the task to the builder agent."

**For complex tasks:**
- ✅ "Breaking into 5 tasks. Thinker, builder, ui-pro, tester."
- ❌ "I am now decomposing your request into five subtasks which will be assigned to the following agents: thinker for planning, builder for implementation..."

### Progress Updates

**Milestone-based (default):**
```
[Agent starts] → "Builder started implementing auth."
[Agent 50% done] → (silent)
[Agent completes] → "Builder finished auth service."
```

**Verbose mode (optional):**
```
[Every major step] → "Builder created auth.js"
                  → "Builder added login endpoint"
                  → "Builder wrote tests"
                  → "Builder done."
```

**Silent mode (optional):**
```
[Only speak on completion or errors]
```

### Error Handling

**Agent crashes:**
```
ONE: "Builder crashed. Restarting..."
[3 seconds]
ONE: "Builder back online. Resuming task."
```

**Task fails:**
```
ONE: "Builder says: Can't find auth.js. Need help?"
```

**Timeout:**
```
ONE: "Builder hasn't responded in 5 minutes. Check on it?"
```

---

## Dashboard Voice Integration

**Opening dashboard:**
```
User: "Show me the dashboard"
ONE: Opens GUI panel
```

**Querying dashboard elements:**
```
User: "What's task 42?"
ONE: Reads from dashboard
     "Task 42: Implement login. Assigned to builder. 75% complete."
```

**Voice + GUI sync:**
- User assigns task via voice → dashboard updates
- User clicks agent in dashboard → ONE speaks status
- Bidirectional: voice ↔ GUI

---

## Command Examples (Comprehensive)

### Startup Flow
```
User: "Computer, supervisor mode"
ONE: "Supervisor mode active."

User: "Start the agents"
ONE: "Starting 5 agents..."
[3s]
ONE: "All agents online."

User: "Status"
ONE: "5 agents idle. No active tasks."
```

### Simple Assignment
```
User: "Builder, add a search bar to the UI"
ONE: "Assigned to builder."

[Builder works]

[30s later]
ONE: "Builder finished. Search bar added."
```

### Complex Decomposition
```
User: "Build me a complete user authentication system"
ONE: "Breaking down task..."
[2s]
ONE: "5 tasks: planning, backend, frontend, testing, docs. 
      Using thinker, builder, ui-pro, tester. Proceed?"

User: "Yes"
ONE: "Starting. Thinker planning architecture."

[5 min]
ONE: "All done. Auth system ready. 15 tests passing."
```

### Health Check
```
User: "How are the agents?"
ONE: "All healthy. Builder working on task 42, others idle."

User: "What's task 42?"
ONE: "Task 42: Implement login. Started 2 minutes ago."
```

### Emergency Stop
```
User: "Stop everything!"
ONE: "Emergency stop. All agents stopped."
```

### Broadcasting
```
User: "Tell everyone to focus on security"
ONE: "Broadcast sent to 5 agents."
```

### File Lock Query
```
User: "Who has the lock on index.js?"
ONE: "Builder locked it 3 minutes ago."

User: "Ask builder to release it"
ONE: "Message sent to builder."
```

---

## Configuration

**File:** `~/.config/one/voice_control.json`

```json
{
  "multiagent_voice": {
    "enabled": true,
    
    "feedback": {
      "mode": "milestones",      // silent | milestones | verbose
      "confirm_assignments": false,
      "confirm_complex_tasks": true,
      "update_interval": 30
    },
    
    "parsing": {
      "fuzzy_agent_names": true,
      "context_aware": true,
      "learn_from_corrections": true
    },
    
    "shortcuts": {
      "my_team": ["thinker", "builder", "tester"],
      "core_agents": ["builder", "tester"]
    }
  }
}
```

**Custom shortcuts:**
```
User: "Start my team"
→ Starts only: thinker, builder, tester (from shortcuts.my_team)
```

---

## Implementation Notes

### Integration with IntentResolver

All multiagent voice commands go through IntentResolver:

```javascript
// In default_commands.json
{
  "phrase": "start the agents",
  "action": "multiagent.start_all",
  "category": "multiagent"
}

// In intent-resolver.js
if (intent.category === 'multiagent') {
  return AgentOrchestrator.handleIntent(intent);
}
```

### Parsing Pipeline

1. **Transcription** → "tell the builder to fix the login bug"
2. **IntentResolver** → category=multiagent, action=assign
3. **AgentVoiceParser** → Extract: agent=builder, task="fix the login bug"
4. **ContextEnricher** → Add current app, recent commands
5. **AgentOrchestrator** → Execute assignment
6. **TTS** → Confirm action

### Error Handling

```javascript
try {
  await orchestrator.assignTask(agent, task);
  speak(`Assigned to ${agent}.`);
} catch (error) {
  if (error.code === 'AGENT_OFFLINE') {
    speak(`${agent} is offline. Start it first?`);
  } else if (error.code === 'INVALID_AGENT') {
    speak(`I don't know an agent called ${agent}.`);
  } else {
    speak(`Error assigning task: ${error.message}`);
  }
}
```

---

## Testing

### Unit Tests
- Agent name extraction (with typos, variations)
- Task extraction (with context)
- Multi-agent parsing
- Shortcut expansion

### Integration Tests
- Full voice → assignment flow
- Decomposition → execution → feedback
- Error scenarios (offline agent, invalid task)
- Dashboard sync

### User Testing
- Natural language variations
- Ambiguous commands (does ONE ask for clarification?)
- Complex decompositions (accurate breakdown?)
- Feedback timing (not too verbose, not too quiet)

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Agent name recognition | >95% accuracy |
| Task extraction accuracy | >90% |
| Command variation coverage | >80% variations recognized |
| Feedback clarity (user rating) | >4.5/5 |
| Error recovery rate | >90% graceful handling |

---

## Future Enhancements

### Natural Conversation
```
User: "I need help with authentication"
ONE: "Should I assign someone to work on it?"
User: "Yes, the builder"
ONE: "What should builder do exactly?"
User: "Implement JWT tokens"
ONE: "Got it. Assigning builder to implement JWT tokens."
```

### Agent Personas
```
User: "Ask the thinker about our architecture"
ONE: [Uses thinker's voice] "Our architecture is based on..."
```

### Proactive Suggestions
```
ONE: "Builder finished login. Should I have tester validate it?"
User: "Yes"
ONE: "Assigning tester."
```

---

*Spec created by thinker - 2025-12-08*
