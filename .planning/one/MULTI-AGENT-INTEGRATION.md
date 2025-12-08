# Multi-Agent Integration Specification

> Native multi-agent orchestration in ONE v1.0

## Overview

Phase 4 transforms ONE from a single-context voice assistant into a voice-controlled multi-agent orchestration platform. Users can decompose complex tasks, assign work to specialized agents, and monitor progress - all through natural speech.

## Current State (v0.9)

**What works:**
- Standalone multiagent system at `~/.claude/multiagent/`
- Basic voice addon for supervisor/executor commands
- 5 executor roles: thinker, builder, tester, dreamer, ui-pro
- File locking, inboxes, state management
- Coordination protocol

**Limitations:**
- Voice addon is basic (hardcoded commands)
- No task decomposition intelligence
- No integration with ONE's AI capabilities
- Manual agent spawning/management
- No visual dashboard

## Architecture

### Core Services

```
src/services/
├── agent-orchestrator.js    # Main orchestration engine
├── task-decomposer.js        # AI-powered task breakdown
├── agent-pool.js             # Agent lifecycle management
├── agent-router.js           # Smart task → agent assignment
└── agent-monitor.js          # Health checks, failover
```

### Integration Points

1. **IntentResolver** - Detect "build me X" requests → trigger decomposition
2. **Training Mode** - Learn task decomposition patterns
3. **Context Detection** - Include current app/mode in task context
4. **TTS System** - Real-time progress narration
5. **GUI** - Optional visual dashboard

---

## 4.1 Native Multi-Agent Support

### Goal
Integrate claude-multiagent deeply into ONE, not just as an addon.

### AgentOrchestrator Service

**File:** `src/services/agent-orchestrator.js`

**Responsibilities:**
- Initialize multiagent infrastructure on startup
- Manage supervisor/executor processes
- Route voice commands to appropriate handlers
- Coordinate with other ONE services

**API:**
```javascript
class AgentOrchestrator {
  constructor(config)
  
  // Lifecycle
  async init()                    // Set up ~/.claude/multiagent/
  async shutdown()                // Clean shutdown all agents
  
  // Status
  getStatus()                     // System overview
  getAgents()                     // List all agents + status
  getTasks()                      // Active tasks across agents
  
  // Control
  async assignTask(agentName, taskDesc, context)
  async broadcastMessage(message)
  async checkHealth()             // Ping all agents
  
  // Events
  on('agent-started', callback)
  on('agent-stopped', callback)
  on('task-assigned', callback)
  on('task-completed', callback)
  on('agent-error', callback)
}
```

**Example usage:**
```javascript
const orchestrator = new AgentOrchestrator(config);
await orchestrator.init();

orchestrator.on('task-completed', ({ agent, task, result }) => {
  speak(`${agent} finished: ${result.summary}`);
});

await orchestrator.assignTask('builder', 'Implement login flow', {
  app: 'VSCode',
  mode: 'general',
  priority: 'high'
});
```

### Voice Commands (Natural Language)

Unlike the current hardcoded addon, use IntentResolver for flexible commands:

| User says | Intent | Action |
|-----------|--------|--------|
| "Spin up the agents" | `multiagent.start` | Start all executors |
| "What are the agents doing?" | `multiagent.status` | Read status |
| "Tell the builder to fix the login bug" | `multiagent.assign` | Assign task |
| "Ask the thinker about the roadmap" | `multiagent.query` | Forward question |
| "Stop all agents" | `multiagent.stop` | Shutdown |
| "How's the builder doing?" | `multiagent.check` | Agent health |

**Implementation:**
- Add to `default_commands.json` as `category: "multiagent"`
- IntentResolver maps variations → canonical action
- Learning mode: "When I say 'wake up the team', spin up the agents"

### Real-Time Progress via TTS

**Requirements:**
- Non-blocking progress updates (don't interrupt user)
- Configurable verbosity (silent / milestones / verbose)
- Queue system for simultaneous updates
- Voice persona per agent type (optional)

**Example flow:**
```
User: "Build me a login system"
ONE: "Breaking down task... assigning to builder and tester."

[5 seconds later]
ONE: "Builder started implementing auth service."

[30 seconds later]
ONE: "Builder completed auth service. Tester running validation."

[20 seconds later]
ONE: "All done. Login system ready. 2 files changed, 15 tests passing."
```

**Configuration:**
```json
{
  "multiagent": {
    "tts_mode": "milestones",  // silent | milestones | verbose
    "agent_voices": {
      "builder": "default",
      "tester": "default",
      "thinker": "thoughtful"   // future: voice customization
    },
    "update_interval": 30        // seconds between auto-updates
  }
}
```

---

## 4.2 Task Decomposition

### Goal
"Build me X" → intelligently break down into subtasks → assign to agents

### TaskDecomposer Service

**File:** `src/services/task-decomposer.js`

**How it works:**
1. User says: "Build me a user authentication system"
2. IntentResolver detects high-level request (no direct command match)
3. TaskDecomposer uses Claude API to analyze:
   - What subtasks are needed?
   - Which agent handles each subtask?
   - What's the dependency order?
4. Creates task graph
5. Assigns to agent pool

**API:**
```javascript
class TaskDecomposer {
  constructor(orchestrator, intentResolver)
  
  async decompose(request, context) {
    // Returns: { tasks: [...], dependencies: [...] }
  }
  
  async execute(plan) {
    // Assign tasks respecting dependencies
    // Monitor completion
    // Return final result
  }
}
```

**Example decomposition:**
```
Input: "Build me a login system"

Output:
{
  tasks: [
    { id: 1, desc: "Plan authentication architecture", agent: "thinker", deps: [] },
    { id: 2, desc: "Implement auth service", agent: "builder", deps: [1] },
    { id: 3, desc: "Create login UI", agent: "ui-pro", deps: [1] },
    { id: 4, desc: "Write auth tests", agent: "tester", deps: [2, 3] },
    { id: 5, desc: "Integration testing", agent: "tester", deps: [4] }
  ],
  dependencies: [[1,2], [1,3], [2,4], [3,4], [4,5]]
}
```

**Execution:**
- Start tasks 1 (no deps)
- When 1 completes → start 2 and 3 in parallel
- When 2 and 3 complete → start 4
- When 4 completes → start 5

### Context-Aware Decomposition

Include ONE's context in decomposition prompt:

```javascript
const context = {
  currentApp: 'VSCode',
  recentCommands: ['open file', 'search for auth'],
  projectType: 'Node.js + React',  // detected from files
  existingModules: ['src/services/', 'src/components/'],
  mode: 'general'
};

await taskDecomposer.decompose("add user login", context);
```

Claude considers:
- Is this a frontend or backend request?
- What files already exist?
- What's the project tech stack?

### Learning from Decompositions

Store successful decompositions in personal dictionary:

```json
{
  "decomposition_patterns": [
    {
      "phrase": "build me a login system",
      "template": "auth-flow",
      "tasks": ["plan", "implement", "ui", "test"],
      "confidence": 0.95,
      "uses": 3
    }
  ]
}
```

Next time: "Build me a signup flow" → similar to login → reuse pattern

---

## 4.3 Agent Pool Management

### Goal
Spawn, monitor, and manage agent lifecycles via voice

### AgentPool Service

**File:** `src/services/agent-pool.js`

**Responsibilities:**
- Spawn executor processes on demand
- Monitor health (heartbeat, timeouts)
- Automatic restart on crash
- Resource limits (max agents, CPU/memory)
- Graceful shutdown

**API:**
```javascript
class AgentPool {
  constructor(config)
  
  // Lifecycle
  async spawn(agentName)          // Start new executor
  async terminate(agentName)      // Stop executor
  async restart(agentName)        // Restart crashed agent
  
  // Health
  async healthCheck(agentName)    // Ping agent
  getHealth()                     // All agents health status
  
  // Auto-management
  enableAutoRestart()
  setMaxAgents(n)
  
  // Events
  on('agent-spawned', callback)
  on('agent-crashed', callback)
  on('agent-unresponsive', callback)
}
```

### Voice Commands

| User says | Action |
|-----------|--------|
| "Start the builder" | Spawn builder executor |
| "Stop the tester" | Terminate tester |
| "Restart all agents" | Restart entire pool |
| "How healthy are the agents?" | Health check |
| "Limit to 3 agents" | Set max pool size |

### Health Monitoring

**Metrics:**
- Last heartbeat timestamp
- Task completion rate
- Average response time
- Error count
- Memory usage (if detectable)

**Failover:**
- If agent doesn't respond to ping (30s timeout) → mark unhealthy
- Retry ping 2 more times (exponential backoff)
- If still unresponsive → terminate and restart
- Reassign current task to another agent (if same role exists)

**Example:**
```
Builder crashes while working on task-42.

AgentPool detects:
1. Builder hasn't sent heartbeat in 35 seconds
2. Ping builder → no response
3. Terminate zombie process
4. Spawn new builder instance
5. Check if task-42 was assigned → yes
6. Reassign task-42 to new builder
7. Speak: "Builder restarted. Resuming task."
```

### Resource Limits

**Configuration:**
```json
{
  "agent_pool": {
    "max_agents": 5,
    "auto_restart": true,
    "heartbeat_timeout": 30,
    "max_retries": 3,
    "spawn_delay": 2  // seconds between spawns (avoid overwhelming)
  }
}
```

---

## 4.4 Supervisor Dashboard (Optional)

### Goal
Visual representation of multi-agent system state

### GUI Panel

**Location:** `gui/supervisor.html` (new panel in Electron app)

**Components:**

1. **Agent Grid**
   - Card for each agent (thinker, builder, tester, dreamer, ui-pro)
   - Status: online/offline/working/idle
   - Current task (if any)
   - Health indicator (green/yellow/red)
   - Heartbeat timestamp

2. **Task Queue**
   - List of active tasks
   - Assigned agent
   - Progress (if trackable)
   - Dependencies (graph view)

3. **Message Log**
   - Real-time message stream
   - Filter by agent, type
   - Expandable details

4. **Quick Actions**
   - "Spawn All" button
   - "Shutdown All" button
   - "Clear Locks" button
   - "Broadcast Message" input

**Mockup:**
```
┌─────────────────────────────────────────────────────┐
│  Supervisor Dashboard                        [X]     │
├─────────────────────────────────────────────────────┤
│                                                      │
│  Agents                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐            │
│  │ thinker  │ │ builder  │ │ tester   │            │
│  │  online  │ │ working  │ │  idle    │            │
│  │    💚    │ │    💛    │ │    💚    │            │
│  │          │ │ Task: #42│ │          │            │
│  └──────────┘ └──────────┘ └──────────┘            │
│                                                      │
│  Active Tasks                                        │
│  • #42: Implement login  [builder]  75%             │
│  • #43: Write tests      [tester]   Queued          │
│                                                      │
│  Messages (last 10)                                  │
│  [23:15] builder → supervisor: Task #42 progress... │
│  [23:14] supervisor → builder: Assigned task #42    │
│                                                      │
│  [Broadcast Message]  [Spawn All]  [Shutdown]       │
└─────────────────────────────────────────────────────┘
```

### Integration with Voice

- Dashboard updates in real-time as voice commands execute
- Click agent card → speak status
- Click task → speak progress
- Voice command: "Show me the dashboard" → open GUI panel

**Optional:** Minimal mode (menu bar only)
- Agent count in menu bar: "👥 3/5"
- Dropdown shows agent status
- Click to open full dashboard

---

## Voice Integration Examples

### Scenario 1: Simple Task Assignment

```
User: "Tell the builder to add a search bar to the UI"

ONE:
1. IntentResolver → multiagent.assign
2. Extract: agent=builder, task="add search bar to UI"
3. AgentOrchestrator.assignTask('builder', ...)
4. Write to builder inbox
5. Speak: "Assigned to builder."

[Later]
Builder completes task → sends message

ONE: "Builder finished. Search bar added."
```

### Scenario 2: Complex Decomposition

```
User: "Build me a complete authentication system"

ONE:
1. IntentResolver → no direct match → high-level request
2. TaskDecomposer.decompose(...)
3. Claude API call:
   - Analyze request
   - Generate task breakdown
   - Assign agents
4. Speak: "Breaking into 5 tasks. Assigning thinker, builder, ui-pro, and tester."

[Execution]
Task 1 (thinker) starts
→ Completes
→ Task 2 (builder) + Task 3 (ui-pro) start in parallel
→ Both complete
→ Task 4 (tester) starts
→ Completes

ONE: "Authentication system complete. All tests passing."
```

### Scenario 3: Health Check

```
User: "How are the agents doing?"

ONE:
1. IntentResolver → multiagent.health
2. AgentPool.getHealth()
3. Parse results
4. Speak: "4 agents online. Builder is working on task 42. All healthy."
```

### Scenario 4: Emergency Stop

```
User: "Stop everything!"

ONE:
1. IntentResolver → multiagent.emergency_stop
2. AgentPool.terminate(all)
3. Save state
4. Speak: "All agents stopped."
```

---

## Configuration

### Main Config

**File:** `~/.config/one/multiagent_settings.json`

```json
{
  "enabled": true,
  "auto_start": false,           // Start agents on ONE startup
  
  "agents": {
    "thinker": { "enabled": true },
    "builder": { "enabled": true },
    "tester": { "enabled": true },
    "dreamer": { "enabled": false },
    "ui-pro": { "enabled": false }
  },
  
  "pool": {
    "max_agents": 5,
    "auto_restart": true,
    "heartbeat_interval": 10,
    "heartbeat_timeout": 30
  },
  
  "tts": {
    "mode": "milestones",         // silent | milestones | verbose
    "interrupt_on_error": true,
    "update_interval": 30
  },
  
  "decomposition": {
    "enabled": true,
    "confidence_threshold": 0.7,
    "max_tasks": 10,
    "learn_patterns": true
  },
  
  "dashboard": {
    "enabled": true,
    "auto_open": false,
    "refresh_interval": 5         // seconds
  }
}
```

### Per-Agent Profiles

Agents can have custom settings:

```json
{
  "agents": {
    "builder": {
      "scope": ["src/", "gui/"],
      "model": "sonnet",
      "max_task_time": 600,        // seconds
      "priority": 1
    }
  }
}
```

---

## Migration from Addon

**Current:** Standalone addon at `addons/multiagent/`

**Phase 4:** Integrated into core

**Migration plan:**
1. Keep addon functional for v0.9 users
2. Add deprecation warning in v1.0
3. Auto-migrate settings to new format
4. Remove addon in v1.1

**Backward compatibility:**
- Existing `~/.claude/multiagent/` structure stays same
- Voice commands still work (via IntentResolver)
- No breaking changes to multi-agent protocol

---

## Dependencies

### New packages
```json
{
  "dependencies": {
    "ws": "^8.14.2"           // WebSocket for dashboard (optional)
  }
}
```

### Existing
- IntentResolver (Phase 1)
- Personal dictionary (Phase 1)
- Context detection (Phase 3)
- TTS system (existing)

---

## Testing Strategy

### Unit Tests
- AgentOrchestrator: spawn, terminate, assign, broadcast
- TaskDecomposer: decomposition logic, dependency resolution
- AgentPool: health checks, failover, restart
- Voice command mapping (IntentResolver integration)

### Integration Tests
- Full flow: voice → decompose → assign → execute → report
- Multi-agent coordination (file locking, inboxes)
- Crash recovery (agent dies mid-task)
- Dashboard updates (WebSocket events)

### Manual Testing
- Voice control end-to-end
- Real Claude executor instances
- Error scenarios (network issues, API limits, crashes)

---

## Success Criteria

| Metric | Target |
|--------|--------|
| Task decomposition accuracy | >80% correct breakdown |
| Voice command recognition | >90% intent match |
| Agent spawn time | <5 seconds |
| Failover recovery time | <10 seconds |
| Dashboard update latency | <1 second |
| Multi-task parallelization | 2-3 agents working simultaneously |

---

## Future Enhancements (Post v1.0)

### Smart Routing
- Learn which agents are best at which tasks
- Auto-assign based on past performance
- Load balancing (distribute work evenly)

### Agent Personas
- Custom agent personalities (formal vs casual)
- Different TTS voices per agent
- Agent-specific command styles

### Remote Agents
- Agents running on different machines
- Distributed task execution
- Cloud-based agent pool

### Workflow Recording
- "Remember this decomposition pattern"
- Reusable task templates
- Community workflow sharing

---

*Spec created by thinker - 2025-12-08*
