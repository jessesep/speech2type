# Planning Addon Implementation Guide

> Voice-driven hierarchical project planning for Speech2Type

## Overview

The Planning Addon enables voice-controlled project planning that integrates with Claude Code's `/create-plan` and `/run-plan` commands.

## Installation

### 1. Create Addon Directory

```bash
mkdir -p ~/Downloads/hear-0.7/speech2type/addons/planning
```

### 2. Create Addon File

Create `addons/planning/index.js`:

```javascript
/**
 * Planning Addon for Speech2Type
 * Voice-driven project planning with Claude Code integration
 */

import { execSync, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';

// ============================================================
// METADATA
// ============================================================

export const metadata = {
  name: 'planning',
  displayName: 'Planning Mode',
  version: '1.0.0',
  description: 'Voice-driven project planning with Claude Code',
  author: 'Speech2Type',

  modeCommand: 'planning mode',
  modeAliases: ['plan mode', 'planner mode'],

  pushToTalk: false,
  pushToTalkAutoSubmit: false,
  commandsOnly: true,  // Don't type random text
  ttsEnabled: true,    // Read responses aloud
};

// ============================================================
// STATE
// ============================================================

const state = {
  currentPlan: null,
  currentTask: 0,
  planPath: null,
  projectPath: process.cwd(),
};

const PLANS_DIR = path.join(process.env.HOME, '.claude', 'plans');
const STATUS_FILE = '/tmp/s2t-planning-status.json';

// ============================================================
// COMMANDS
// ============================================================

export const commands = {
  // Plan creation
  'create plan': 'create_plan',
  'new plan': 'create_plan',
  'start planning': 'create_plan',

  // Plan management
  'list plans': 'list_plans',
  'show plans': 'list_plans',
  'open plan': 'open_plan',
  'load plan': 'open_plan',
  'close plan': 'close_plan',
  'delete plan': 'delete_plan',

  // Task navigation
  'next task': 'next_task',
  'previous task': 'previous_task',
  'current task': 'current_task',
  'first task': 'first_task',
  'last task': 'last_task',

  // Task execution
  'run task': 'run_task',
  'execute task': 'run_task',
  'start task': 'start_task',
  'complete task': 'complete_task',
  'skip task': 'skip_task',

  // Status & review
  'check tasks': 'check_tasks',
  'plan status': 'plan_status',
  'show progress': 'plan_status',
  'review plan': 'review_plan',

  // Context handoff
  "what's next": 'whats_next',
  'whats next': 'whats_next',
  'hand off': 'whats_next',
  'handoff': 'whats_next',

  // Quick adds
  'add task': 'add_task',
  'insert task': 'add_task',
  'add note': 'add_note',
};

// ============================================================
// PATTERNS (for parameterized commands)
// ============================================================

export const patterns = [
  // "create plan for [description]"
  {
    pattern: /^create\s+plan\s+(?:for\s+)?(.+)$/i,
    action: 'create_plan_for',
    extract: (match) => match[1].trim(),
  },

  // "task [number]"
  {
    pattern: /^task\s+(\d+)$/i,
    action: 'goto_task',
    extract: (match) => parseInt(match[1], 10),
  },

  // "run task [number]"
  {
    pattern: /^run\s+task\s+(\d+)$/i,
    action: 'run_task_num',
    extract: (match) => parseInt(match[1], 10),
  },

  // "open plan [name]"
  {
    pattern: /^(?:open|load)\s+plan\s+(.+)$/i,
    action: 'open_plan_name',
    extract: (match) => match[1].trim(),
  },

  // "add task [description]"
  {
    pattern: /^add\s+task\s+(.+)$/i,
    action: 'add_task_desc',
    extract: (match) => match[1].trim(),
  },
];

// ============================================================
// INITIALIZATION
// ============================================================

export function init() {
  console.log('[Planning] Addon initialized');

  // Ensure plans directory exists
  if (!fs.existsSync(PLANS_DIR)) {
    fs.mkdirSync(PLANS_DIR, { recursive: true });
  }

  // Load last active plan if exists
  if (fs.existsSync(STATUS_FILE)) {
    try {
      const status = JSON.parse(fs.readFileSync(STATUS_FILE, 'utf8'));
      if (status.planPath && fs.existsSync(status.planPath)) {
        state.planPath = status.planPath;
        state.currentTask = status.currentTask || 0;
        loadPlan(status.planPath);
      }
    } catch (e) {
      console.log('[Planning] No previous state to restore');
    }
  }

  updateStatus();
  return true;
}

export function cleanup() {
  console.log('[Planning] Addon cleanup');
  saveStatus();
}

// ============================================================
// EXECUTE (main action handler)
// ============================================================

export async function execute(action, value) {
  console.log(`[Planning] Execute: ${action}`, value);

  switch (action) {
    // Plan creation
    case 'create_plan':
      return await createPlanInteractive();

    case 'create_plan_for':
      return await createPlanFor(value);

    // Plan management
    case 'list_plans':
      return await listPlans();

    case 'open_plan':
      return await openPlanInteractive();

    case 'open_plan_name':
      return await openPlanByName(value);

    case 'close_plan':
      return closePlan();

    case 'delete_plan':
      return await deletePlanInteractive();

    // Task navigation
    case 'next_task':
      return nextTask();

    case 'previous_task':
      return previousTask();

    case 'current_task':
      return readCurrentTask();

    case 'first_task':
      return gotoTask(1);

    case 'last_task':
      return gotoTask(-1); // -1 means last

    case 'goto_task':
      return gotoTask(value);

    // Task execution
    case 'run_task':
      return await runCurrentTask();

    case 'run_task_num':
      return await runTask(value);

    case 'start_task':
      return startTask();

    case 'complete_task':
      return completeTask();

    case 'skip_task':
      return skipTask();

    // Status & review
    case 'check_tasks':
      return checkTasks();

    case 'plan_status':
      return planStatus();

    case 'review_plan':
      return reviewPlan();

    // Context handoff
    case 'whats_next':
      return await whatsNext();

    // Quick adds
    case 'add_task':
      return await addTaskInteractive();

    case 'add_task_desc':
      return await addTask(value);

    case 'add_note':
      return await addNote();

    default:
      speak(`Unknown planning action: ${action}`);
      return false;
  }
}

// ============================================================
// PLAN OPERATIONS
// ============================================================

async function createPlanInteractive() {
  speak('What would you like to plan? Describe your project.');
  // This will be handled by the next voice input
  state.awaitingInput = 'plan_description';
  return true;
}

async function createPlanFor(description) {
  speak(`Creating plan for: ${description}`);

  // Trigger Claude Code /create-plan command
  const cmd = `cd "${state.projectPath}" && claude "/create-plan ${description}"`;

  try {
    // Run in background, Claude will handle the rest
    spawn('bash', ['-c', cmd], {
      detached: true,
      stdio: 'ignore',
    }).unref();

    return true;
  } catch (e) {
    speak(`Failed to create plan: ${e.message}`);
    return false;
  }
}

async function listPlans() {
  try {
    const files = fs.readdirSync(PLANS_DIR).filter(f => f.endsWith('.md'));

    if (files.length === 0) {
      speak('No plans found. Say "create plan" to start one.');
      return true;
    }

    const planNames = files.map(f => f.replace('.md', '').replace(/-/g, ' '));
    speak(`You have ${files.length} plans: ${planNames.join(', ')}`);
    return true;
  } catch (e) {
    speak('Could not list plans');
    return false;
  }
}

async function openPlanInteractive() {
  const files = fs.readdirSync(PLANS_DIR).filter(f => f.endsWith('.md'));

  if (files.length === 0) {
    speak('No plans available');
    return false;
  }

  if (files.length === 1) {
    return openPlanByName(files[0].replace('.md', ''));
  }

  speak(`Which plan? ${files.map(f => f.replace('.md', '')).join(', ')}`);
  state.awaitingInput = 'plan_name';
  return true;
}

async function openPlanByName(name) {
  const filename = name.toLowerCase().replace(/\s+/g, '-');
  const planPath = path.join(PLANS_DIR, `${filename}.md`);

  if (!fs.existsSync(planPath)) {
    speak(`Plan not found: ${name}`);
    return false;
  }

  loadPlan(planPath);
  speak(`Opened plan: ${name}. ${state.currentPlan.tasks.length} tasks.`);
  return true;
}

function loadPlan(planPath) {
  const content = fs.readFileSync(planPath, 'utf8');
  state.planPath = planPath;
  state.currentPlan = parsePlan(content);
  state.currentTask = findFirstIncompleteTask();
  updateStatus();
}

function parsePlan(content) {
  // Parse markdown plan into structured format
  const lines = content.split('\n');
  const plan = {
    title: '',
    description: '',
    tasks: [],
    notes: [],
  };

  let currentSection = 'header';
  let currentTask = null;

  for (const line of lines) {
    // Title
    if (line.startsWith('# ')) {
      plan.title = line.substring(2).trim();
      continue;
    }

    // Task item (checkbox)
    const taskMatch = line.match(/^[-*]\s+\[([ xX])\]\s+(.+)$/);
    if (taskMatch) {
      if (currentTask) plan.tasks.push(currentTask);
      currentTask = {
        text: taskMatch[2].trim(),
        completed: taskMatch[1].toLowerCase() === 'x',
        subtasks: [],
        notes: [],
      };
      continue;
    }

    // Subtask (indented checkbox)
    const subtaskMatch = line.match(/^\s+[-*]\s+\[([ xX])\]\s+(.+)$/);
    if (subtaskMatch && currentTask) {
      currentTask.subtasks.push({
        text: subtaskMatch[2].trim(),
        completed: subtaskMatch[1].toLowerCase() === 'x',
      });
      continue;
    }

    // Description or notes
    if (line.trim() && !line.startsWith('#')) {
      if (currentTask) {
        currentTask.notes.push(line.trim());
      } else {
        plan.description += line + '\n';
      }
    }
  }

  if (currentTask) plan.tasks.push(currentTask);

  return plan;
}

function closePlan() {
  if (!state.currentPlan) {
    speak('No plan is open');
    return false;
  }

  savePlan();
  state.currentPlan = null;
  state.planPath = null;
  state.currentTask = 0;
  updateStatus();

  speak('Plan closed');
  return true;
}

function savePlan() {
  if (!state.currentPlan || !state.planPath) return;

  const content = serializePlan(state.currentPlan);
  fs.writeFileSync(state.planPath, content);
}

function serializePlan(plan) {
  let content = `# ${plan.title}\n\n`;

  if (plan.description) {
    content += `${plan.description.trim()}\n\n`;
  }

  content += '## Tasks\n\n';

  for (const task of plan.tasks) {
    const checkbox = task.completed ? '[x]' : '[ ]';
    content += `- ${checkbox} ${task.text}\n`;

    for (const subtask of task.subtasks) {
      const subCheckbox = subtask.completed ? '[x]' : '[ ]';
      content += `  - ${subCheckbox} ${subtask.text}\n`;
    }
  }

  return content;
}

// ============================================================
// TASK OPERATIONS
// ============================================================

function findFirstIncompleteTask() {
  if (!state.currentPlan) return 0;

  for (let i = 0; i < state.currentPlan.tasks.length; i++) {
    if (!state.currentPlan.tasks[i].completed) {
      return i;
    }
  }
  return 0;
}

function nextTask() {
  if (!state.currentPlan) {
    speak('No plan open');
    return false;
  }

  if (state.currentTask < state.currentPlan.tasks.length - 1) {
    state.currentTask++;
    updateStatus();
    return readCurrentTask();
  } else {
    speak('Already at the last task');
    return true;
  }
}

function previousTask() {
  if (!state.currentPlan) {
    speak('No plan open');
    return false;
  }

  if (state.currentTask > 0) {
    state.currentTask--;
    updateStatus();
    return readCurrentTask();
  } else {
    speak('Already at the first task');
    return true;
  }
}

function gotoTask(num) {
  if (!state.currentPlan) {
    speak('No plan open');
    return false;
  }

  const tasks = state.currentPlan.tasks;

  if (num === -1) {
    state.currentTask = tasks.length - 1;
  } else if (num >= 1 && num <= tasks.length) {
    state.currentTask = num - 1;
  } else {
    speak(`Invalid task number. You have ${tasks.length} tasks.`);
    return false;
  }

  updateStatus();
  return readCurrentTask();
}

function readCurrentTask() {
  if (!state.currentPlan) {
    speak('No plan open');
    return false;
  }

  const task = state.currentPlan.tasks[state.currentTask];
  if (!task) {
    speak('No current task');
    return false;
  }

  const status = task.completed ? 'completed' : 'pending';
  const taskNum = state.currentTask + 1;
  const total = state.currentPlan.tasks.length;

  speak(`Task ${taskNum} of ${total}, ${status}: ${task.text}`);
  return true;
}

function checkTasks() {
  if (!state.currentPlan) {
    speak('No plan open');
    return false;
  }

  const tasks = state.currentPlan.tasks;
  const completed = tasks.filter(t => t.completed).length;
  const pending = tasks.length - completed;

  speak(`${completed} of ${tasks.length} tasks completed. ${pending} remaining.`);

  // Read pending tasks
  const pendingTasks = tasks
    .map((t, i) => ({ ...t, num: i + 1 }))
    .filter(t => !t.completed)
    .slice(0, 3);

  if (pendingTasks.length > 0) {
    const taskList = pendingTasks.map(t => `${t.num}: ${t.text}`).join('. ');
    speak(`Next tasks: ${taskList}`);
  }

  return true;
}

async function runCurrentTask() {
  if (!state.currentPlan) {
    speak('No plan open');
    return false;
  }

  const task = state.currentPlan.tasks[state.currentTask];
  if (!task) {
    speak('No current task');
    return false;
  }

  speak(`Running task: ${task.text}`);

  // Send to Claude Code
  const cmd = `cd "${state.projectPath}" && claude "Execute this task: ${task.text}"`;

  spawn('bash', ['-c', cmd], {
    detached: true,
    stdio: 'ignore',
  }).unref();

  return true;
}

async function runTask(num) {
  if (gotoTask(num)) {
    return await runCurrentTask();
  }
  return false;
}

function startTask() {
  speak(`Starting task ${state.currentTask + 1}`);
  // Mark as in progress (future enhancement)
  return true;
}

function completeTask() {
  if (!state.currentPlan) {
    speak('No plan open');
    return false;
  }

  const task = state.currentPlan.tasks[state.currentTask];
  if (!task) {
    speak('No current task');
    return false;
  }

  task.completed = true;
  savePlan();
  updateStatus();

  speak(`Task ${state.currentTask + 1} completed`);

  // Auto-advance to next incomplete task
  const nextIncomplete = state.currentPlan.tasks.findIndex(
    (t, i) => i > state.currentTask && !t.completed
  );

  if (nextIncomplete !== -1) {
    state.currentTask = nextIncomplete;
    updateStatus();
    speak(`Next: ${state.currentPlan.tasks[nextIncomplete].text}`);
  } else if (state.currentPlan.tasks.every(t => t.completed)) {
    speak('All tasks completed! Plan finished.');
  }

  return true;
}

function skipTask() {
  speak(`Skipping task ${state.currentTask + 1}`);
  return nextTask();
}

async function addTask(description) {
  if (!state.currentPlan) {
    speak('No plan open. Create a plan first.');
    return false;
  }

  state.currentPlan.tasks.push({
    text: description,
    completed: false,
    subtasks: [],
    notes: [],
  });

  savePlan();
  speak(`Added task: ${description}`);
  return true;
}

async function addTaskInteractive() {
  speak('What task would you like to add?');
  state.awaitingInput = 'task_description';
  return true;
}

// ============================================================
// STATUS & CONTEXT
// ============================================================

function planStatus() {
  if (!state.currentPlan) {
    speak('No plan open. Say "list plans" or "create plan".');
    return true;
  }

  const tasks = state.currentPlan.tasks;
  const completed = tasks.filter(t => t.completed).length;
  const percent = Math.round((completed / tasks.length) * 100);

  speak(
    `Plan: ${state.currentPlan.title}. ` +
    `Progress: ${percent}%. ` +
    `${completed} of ${tasks.length} tasks done. ` +
    `Currently on task ${state.currentTask + 1}.`
  );

  return true;
}

function reviewPlan() {
  if (!state.currentPlan) {
    speak('No plan open');
    return false;
  }

  speak(`Reviewing: ${state.currentPlan.title}`);

  // Read all tasks
  state.currentPlan.tasks.forEach((task, i) => {
    const status = task.completed ? 'done' : 'pending';
    speak(`${i + 1}. ${status}: ${task.text}`);
  });

  return true;
}

async function whatsNext() {
  speak('Creating context handoff document');

  // Trigger Claude Code /whats-next command
  const cmd = `cd "${state.projectPath}" && claude "/whats-next"`;

  spawn('bash', ['-c', cmd], {
    detached: true,
    stdio: 'ignore',
  }).unref();

  return true;
}

// ============================================================
// HELPERS
// ============================================================

function speak(text) {
  // Write to TTS queue file
  const ttsFile = '/tmp/s2t-tts-queue.txt';
  fs.appendFileSync(ttsFile, text + '\n');

  // Also log
  console.log(`[Planning TTS] ${text}`);
}

function updateStatus() {
  const status = {
    planPath: state.planPath,
    currentTask: state.currentTask,
    planTitle: state.currentPlan?.title || null,
    totalTasks: state.currentPlan?.tasks.length || 0,
    completedTasks: state.currentPlan?.tasks.filter(t => t.completed).length || 0,
    timestamp: Date.now(),
  };

  fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
}

function saveStatus() {
  updateStatus();
}
```

### 3. Create Addon README

Create `addons/planning/README.md`:

```markdown
# Planning Addon

Voice-driven project planning for Speech2Type.

## Activation

Say: "Computer planning mode"

## Commands

| Command | Action |
|---------|--------|
| "create plan for [desc]" | Start new plan |
| "list plans" | Show available plans |
| "open plan [name]" | Load a plan |
| "next task" | Go to next task |
| "task [number]" | Jump to task |
| "complete task" | Mark current done |
| "check tasks" | Hear progress |
| "what's next" | Create handoff doc |

## Integration

Works with Claude Code commands:
- `/create-plan` - Detailed planning
- `/run-plan` - Execute plan
- `/whats-next` - Context handoff
```

### 4. Enable the Addon

Add to `~/.config/speech2type/addons.json`:

```json
{
  "enabled": {
    "planning": true
  }
}
```

## Usage Flow

### Starting a New Project

```
You: "Computer planning mode"
S2T: *activates planning mode*

You: "Create plan for voice-controlled smart home"
S2T: "Creating plan for voice-controlled smart home"
Claude: *generates hierarchical plan*

You: "Check tasks"
S2T: "5 tasks. Next: Research smart home protocols"

You: "Run task"
S2T: "Running task: Research smart home protocols"
Claude: *executes research task*
```

### Continuing Work

```
You: "Computer planning mode"
You: "Plan status"
S2T: "Plan: Smart Home. Progress: 40%. 2 of 5 tasks done."

You: "Next task"
S2T: "Task 3: Implement device discovery"

You: "Complete task"
S2T: "Task 3 completed. Next: Build control interface"
```

### Session Handoff

```
You: "What's next"
S2T: "Creating context handoff document"
Claude: *generates handoff with progress, decisions, next steps*
```

## File Locations

| File | Purpose |
|------|---------|
| `addons/planning/index.js` | Addon logic |
| `~/.claude/plans/` | Stored plans |
| `/tmp/s2t-planning-status.json` | Current state |
| `/tmp/s2t-tts-queue.txt` | TTS output queue |
