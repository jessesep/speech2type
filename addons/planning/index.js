/**
 * Planning Addon for Speech2Type
 * Voice-driven project planning with Claude Code integration
 *
 * Activation: "computer planning mode"
 *
 * Integrates with:
 * - ~/.claude/commands/create-plan.md
 * - ~/.claude/commands/run-plan.md
 * - ~/.claude/commands/whats-next.md
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
  modeAliases: ['plan mode', 'planner mode', 'project mode'],

  pushToTalk: false,
  pushToTalkAutoSubmit: false,
  commandsOnly: true, // Don't type random text in planning mode
  ttsEnabled: true, // Read responses aloud
};

// ============================================================
// STATE
// ============================================================

const state = {
  currentPlan: null,
  currentTask: 0,
  planPath: null,
  projectPath: process.cwd(),
  awaitingInput: null,
};

const PLANS_DIR = path.join(process.env.HOME, '.claude', 'plans');
const STATUS_FILE = '/tmp/s2t-planning-status.json';
const TTS_QUEUE = '/tmp/s2t-tts-queue.txt';

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
  'done': 'complete_task',
  'skip task': 'skip_task',

  // Status & review
  'check tasks': 'check_tasks',
  'show tasks': 'check_tasks',
  'plan status': 'plan_status',
  'status': 'plan_status',
  'show progress': 'plan_status',
  'review plan': 'review_plan',

  // Context handoff
  "what's next": 'whats_next',
  'whats next': 'whats_next',
  'hand off': 'whats_next',
  'handoff': 'whats_next',
  'save progress': 'whats_next',

  // Quick adds
  'add task': 'add_task',
  'insert task': 'add_task',

  // Meta-prompting (cross-feature)
  'create prompt': 'create_prompt',
  'meta prompt': 'create_prompt',
  'list prompts': 'list_prompts',
  'run prompt': 'run_prompt',

  // Mental frameworks
  'consider pareto': 'consider_pareto',
  'consider first principles': 'consider_first_principles',
  'consider inversion': 'consider_inversion',
  'consider five whys': 'consider_five_whys',
  'consider second order': 'consider_second_order',
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

  // "create prompt for [task]"
  {
    pattern: /^(?:create|meta)\s+prompt\s+(?:for\s+)?(.+)$/i,
    action: 'create_prompt_for',
    extract: (match) => match[1].trim(),
  },

  // "run prompt [number]"
  {
    pattern: /^run\s+prompt\s+(\d+)$/i,
    action: 'run_prompt_num',
    extract: (match) => parseInt(match[1], 10),
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
        speak(`Resumed plan: ${state.currentPlan?.title || 'unnamed'}`);
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

  try {
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
        return gotoTask(-1);
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

      // Meta-prompting
      case 'create_prompt':
        return await createPromptInteractive();
      case 'create_prompt_for':
        return await createPromptFor(value);
      case 'list_prompts':
        return await listPrompts();
      case 'run_prompt':
        return await runPromptInteractive();
      case 'run_prompt_num':
        return await runPrompt(value);

      // Mental frameworks
      case 'consider_pareto':
        return await runConsider('pareto');
      case 'consider_first_principles':
        return await runConsider('first-principles');
      case 'consider_inversion':
        return await runConsider('inversion');
      case 'consider_five_whys':
        return await runConsider('5-whys');
      case 'consider_second_order':
        return await runConsider('second-order');

      default:
        speak(`Unknown planning action: ${action}`);
        return false;
    }
  } catch (error) {
    console.error('[Planning] Error:', error);
    speak(`Error: ${error.message}`);
    return false;
  }
}

// ============================================================
// PLAN OPERATIONS
// ============================================================

async function createPlanInteractive() {
  speak('Starting plan creation. Describe your project to Claude.');
  return runClaudeCommand('/create-plan');
}

async function createPlanFor(description) {
  speak(`Creating plan for: ${description}`);
  return runClaudeCommand(`/create-plan ${description}`);
}

async function listPlans() {
  try {
    const files = fs.readdirSync(PLANS_DIR).filter((f) => f.endsWith('.md'));

    if (files.length === 0) {
      speak('No plans found. Say "create plan" to start one.');
      return true;
    }

    const planNames = files
      .map((f) => f.replace('.md', '').replace(/-/g, ' '))
      .slice(0, 5); // Limit to 5 for TTS

    speak(
      `You have ${files.length} plans. Recent: ${planNames.join(', ')}`
    );
    return true;
  } catch (e) {
    speak('Could not list plans');
    return false;
  }
}

async function openPlanInteractive() {
  let files = [];
  try {
    files = fs.readdirSync(PLANS_DIR).filter((f) => f.endsWith('.md'));
  } catch (e) {
    speak('No plans directory found');
    return false;
  }

  if (files.length === 0) {
    speak('No plans available. Create one first.');
    return false;
  }

  if (files.length === 1) {
    return openPlanByName(files[0].replace('.md', ''));
  }

  // Open most recent
  const sorted = files
    .map((f) => ({
      name: f,
      mtime: fs.statSync(path.join(PLANS_DIR, f)).mtime,
    }))
    .sort((a, b) => b.mtime - a.mtime);

  return openPlanByName(sorted[0].name.replace('.md', ''));
}

async function openPlanByName(name) {
  const filename = name.toLowerCase().replace(/\s+/g, '-');
  let planPath = path.join(PLANS_DIR, `${filename}.md`);

  // Try exact match first
  if (!fs.existsSync(planPath)) {
    // Try fuzzy match
    const files = fs.readdirSync(PLANS_DIR).filter((f) => f.endsWith('.md'));
    const match = files.find((f) =>
      f.toLowerCase().includes(filename.toLowerCase())
    );
    if (match) {
      planPath = path.join(PLANS_DIR, match);
    } else {
      speak(`Plan not found: ${name}`);
      return false;
    }
  }

  loadPlan(planPath);
  const taskCount = state.currentPlan?.tasks?.length || 0;
  speak(`Opened plan: ${state.currentPlan?.title || name}. ${taskCount} tasks.`);
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
  const lines = content.split('\n');
  const plan = {
    title: '',
    description: '',
    tasks: [],
  };

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

    // Description
    if (line.trim() && !line.startsWith('#') && !currentTask) {
      plan.description += line + '\n';
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
  const title = state.currentPlan.title;
  state.currentPlan = null;
  state.planPath = null;
  state.currentTask = 0;
  updateStatus();

  speak(`Closed plan: ${title}`);
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
  if (!state.currentPlan?.tasks) return 0;

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
    speak('No plan open. Say "list plans" or "create plan".');
    return true;
  }

  const tasks = state.currentPlan.tasks;
  const completed = tasks.filter((t) => t.completed).length;
  const pending = tasks.length - completed;

  speak(`${completed} of ${tasks.length} tasks completed. ${pending} remaining.`);

  // Read next pending tasks
  const pendingTasks = tasks
    .map((t, i) => ({ ...t, num: i + 1 }))
    .filter((t) => !t.completed)
    .slice(0, 3);

  if (pendingTasks.length > 0) {
    const taskList = pendingTasks.map((t) => `${t.num}: ${t.text}`).join('. ');
    speak(`Next: ${taskList}`);
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
  return runClaudeCommand(`Execute this task: ${task.text}`);
}

async function runTask(num) {
  if (gotoTask(num)) {
    return await runCurrentTask();
  }
  return false;
}

function startTask() {
  if (!state.currentPlan) {
    speak('No plan open');
    return false;
  }

  speak(`Starting task ${state.currentTask + 1}`);
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
    setTimeout(() => {
      speak(`Next: ${state.currentPlan.tasks[nextIncomplete].text}`);
    }, 500);
  } else if (state.currentPlan.tasks.every((t) => t.completed)) {
    setTimeout(() => {
      speak('All tasks completed! Plan finished.');
    }, 500);
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
  });

  savePlan();
  updateStatus();
  speak(`Added task: ${description}`);
  return true;
}

async function addTaskInteractive() {
  speak('Say the task description.');
  state.awaitingInput = 'task_description';
  return true;
}

// ============================================================
// META-PROMPTING
// ============================================================

async function createPromptInteractive() {
  speak('Starting prompt creation with Claude.');
  return runClaudeCommand('/create-prompt');
}

async function createPromptFor(description) {
  speak(`Creating prompt for: ${description}`);
  return runClaudeCommand(`/create-prompt ${description}`);
}

async function listPrompts() {
  const promptsDir = path.join(process.env.HOME, '.claude', 'prompts');

  try {
    if (!fs.existsSync(promptsDir)) {
      speak('No prompts created yet.');
      return true;
    }

    const files = fs.readdirSync(promptsDir).filter((f) => f.endsWith('.md'));

    if (files.length === 0) {
      speak('No prompts found. Say "create prompt" to make one.');
      return true;
    }

    speak(`You have ${files.length} prompts. Say "run prompt" followed by a number.`);
    return true;
  } catch (e) {
    speak('Could not list prompts');
    return false;
  }
}

async function runPromptInteractive() {
  speak('Which prompt number?');
  state.awaitingInput = 'prompt_number';
  return true;
}

async function runPrompt(num) {
  speak(`Running prompt ${num}`);
  return runClaudeCommand(`/run-prompt ${num}`);
}

// ============================================================
// MENTAL FRAMEWORKS
// ============================================================

async function runConsider(framework) {
  const currentContext = state.currentPlan
    ? `Current plan: ${state.currentPlan.title}. Task: ${state.currentPlan.tasks[state.currentTask]?.text || 'none'}`
    : 'No active plan';

  speak(`Applying ${framework.replace('-', ' ')} thinking`);
  return runClaudeCommand(`/consider:${framework} ${currentContext}`);
}

// ============================================================
// CONTEXT HANDOFF
// ============================================================

async function whatsNext() {
  speak('Creating context handoff document');
  return runClaudeCommand('/whats-next');
}

// ============================================================
// STATUS & HELPERS
// ============================================================

function planStatus() {
  if (!state.currentPlan) {
    speak('No plan open. Say "list plans" or "create plan".');
    return true;
  }

  const tasks = state.currentPlan.tasks;
  const completed = tasks.filter((t) => t.completed).length;
  const percent = Math.round((completed / tasks.length) * 100);

  speak(
    `Plan: ${state.currentPlan.title}. ` +
      `Progress: ${percent} percent. ` +
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

  // Read first 5 tasks
  const tasksToRead = state.currentPlan.tasks.slice(0, 5);
  tasksToRead.forEach((task, i) => {
    const status = task.completed ? 'done' : 'pending';
    setTimeout(() => {
      speak(`${i + 1}. ${status}: ${task.text}`);
    }, (i + 1) * 1500);
  });

  return true;
}

function speak(text) {
  // Write to TTS queue file for Speech2Type to pick up
  try {
    fs.appendFileSync(TTS_QUEUE, text + '\n');
  } catch (e) {
    // Ignore errors, file might not be writable
  }
  console.log(`[Planning TTS] ${text}`);
}

function updateStatus() {
  const status = {
    planPath: state.planPath,
    currentTask: state.currentTask,
    planTitle: state.currentPlan?.title || null,
    totalTasks: state.currentPlan?.tasks?.length || 0,
    completedTasks:
      state.currentPlan?.tasks?.filter((t) => t.completed).length || 0,
    timestamp: Date.now(),
  };

  try {
    fs.writeFileSync(STATUS_FILE, JSON.stringify(status, null, 2));
  } catch (e) {
    console.error('[Planning] Could not write status:', e);
  }
}

function saveStatus() {
  updateStatus();
}

function runClaudeCommand(command) {
  // Run Claude command in the current terminal context
  const fullCommand = `cd "${state.projectPath}" && claude "${command}"`;

  try {
    spawn('bash', ['-c', fullCommand], {
      detached: true,
      stdio: 'ignore',
    }).unref();
    return true;
  } catch (e) {
    speak(`Failed to run command: ${e.message}`);
    return false;
  }
}
