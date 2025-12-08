/**
 * Multi-Agent Orchestration Addon for Speech2Type
 * Voice control for the Claude multi-agent system
 *
 * Activation: "computer supervisor mode" or "computer executor mode"
 *
 * This is an OPTIONAL bridge - the multiagent system works standalone
 * This addon just adds voice control convenience
 */

import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

// ============================================================
// METADATA
// ============================================================

export const metadata = {
  name: 'multiagent',
  displayName: 'Multi-Agent Control',
  version: '1.0.0',
  description: 'Voice control for Claude multi-agent orchestration',
  author: 'Speech2Type',

  modeCommand: 'supervisor mode',
  modeAliases: ['multiagent mode', 'multi agent mode', 'orchestrator mode'],

  pushToTalk: false,
  pushToTalkAutoSubmit: false,
  commandsOnly: true,
  ttsEnabled: true,
};

// ============================================================
// PATHS
// ============================================================

const MULTIAGENT_DIR = path.join(process.env.HOME, '.claude', 'multiagent');
const STATE_FILE = path.join(MULTIAGENT_DIR, 'state.json');
const LOCKS_FILE = path.join(MULTIAGENT_DIR, 'locks', 'current.json');
const ACTIVE_TASKS = path.join(MULTIAGENT_DIR, 'tasks', 'active.json');
const SUPERVISOR_INBOX = path.join(MULTIAGENT_DIR, 'inbox', 'supervisor.jsonl');
const TTS_QUEUE = '/tmp/s2t-tts-queue.txt';

// ============================================================
// STATE
// ============================================================

const state = {
  role: 'supervisor', // or 'executor'
  agentName: null,
  projectPath: process.cwd(),
};

// ============================================================
// COMMANDS
// ============================================================

export const commands = {
  // Supervisor commands
  'system status': 'system_status',
  'status': 'system_status',
  'agent status': 'system_status',

  'assign': 'assign_task',
  'give task': 'assign_task',

  'broadcast': 'broadcast_message',
  'tell everyone': 'broadcast_message',
  'announce': 'broadcast_message',

  'check messages': 'check_messages',
  'read inbox': 'check_messages',
  'any messages': 'check_messages',

  'release locks': 'release_locks',
  'clear locks': 'release_locks',

  'list agents': 'list_agents',
  'who is online': 'list_agents',
  'show agents': 'list_agents',

  'list tasks': 'list_tasks',
  'show tasks': 'list_tasks',
  'what is everyone doing': 'list_tasks',

  // Executor commands (when in executor mode)
  'task done': 'task_done',
  'done': 'task_done',
  'complete': 'task_done',

  'ask supervisor': 'ask_supervisor',
  'question': 'ask_supervisor',

  'my task': 'my_task',
  'current task': 'my_task',
  'what am i doing': 'my_task',

  // Mode switching
  'executor mode': 'switch_executor',
  'become executor': 'switch_executor',
};

// ============================================================
// PATTERNS
// ============================================================

export const patterns = [
  // "assign alpha to [task]"
  {
    pattern: /^assign\s+(\w+)\s+(?:to\s+)?(.+)$/i,
    action: 'assign_to',
    extract: (m) => ({ agent: m[1], task: m[2] }),
  },

  // "broadcast [message]"
  {
    pattern: /^(?:broadcast|announce|tell everyone)\s+(.+)$/i,
    action: 'broadcast_msg',
    extract: (m) => m[1],
  },

  // "executor [name]"
  {
    pattern: /^(?:executor|become executor)\s+(\w+)$/i,
    action: 'become_executor',
    extract: (m) => m[1],
  },

  // "ask [question]"
  {
    pattern: /^(?:ask|question)\s+(.+)$/i,
    action: 'ask_question',
    extract: (m) => m[1],
  },

  // "check on [agent]"
  {
    pattern: /^check\s+(?:on\s+)?(\w+)$/i,
    action: 'check_agent',
    extract: (m) => m[1],
  },
];

// ============================================================
// INIT / CLEANUP
// ============================================================

export function init() {
  console.log('[MultiAgent] Voice control initialized');

  // Check if multiagent system is set up
  if (!fs.existsSync(STATE_FILE)) {
    speak('Multi-agent system not initialized. Run slash multiagent init first.');
    return false;
  }

  // Read current state
  try {
    const systemState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));

    if (systemState.supervisor) {
      speak('Supervisor mode active. Say status for overview.');
    } else {
      speak('Multi-agent ready. No supervisor online yet.');
    }
  } catch (e) {
    speak('Could not read multiagent state.');
  }

  return true;
}

export function cleanup() {
  console.log('[MultiAgent] Cleanup');
}

// ============================================================
// EXECUTE
// ============================================================

export async function execute(action, value) {
  console.log(`[MultiAgent] Execute: ${action}`, value);

  try {
    switch (action) {
      // Status
      case 'system_status':
        return systemStatus();

      // Supervisor actions
      case 'assign_task':
        speak('Say: assign agent name to task description');
        return true;
      case 'assign_to':
        return assignTask(value.agent, value.task);
      case 'broadcast_message':
        speak('What message to broadcast?');
        return true;
      case 'broadcast_msg':
        return broadcastMessage(value);
      case 'check_messages':
        return checkMessages();
      case 'release_locks':
        return releaseLocks();
      case 'list_agents':
        return listAgents();
      case 'list_tasks':
        return listTasks();

      // Executor actions
      case 'task_done':
        return taskDone();
      case 'ask_supervisor':
        speak('What is your question?');
        return true;
      case 'ask_question':
        return askQuestion(value);
      case 'my_task':
        return myTask();

      // Mode
      case 'switch_executor':
        speak('Say executor followed by your name, like executor alpha');
        return true;
      case 'become_executor':
        return becomeExecutor(value);
      case 'check_agent':
        return checkAgent(value);

      default:
        speak(`Unknown action: ${action}`);
        return false;
    }
  } catch (e) {
    speak(`Error: ${e.message}`);
    return false;
  }
}

// ============================================================
// IMPLEMENTATIONS
// ============================================================

function systemStatus() {
  try {
    const systemState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    const tasks = JSON.parse(fs.readFileSync(ACTIVE_TASKS, 'utf8'));
    const locks = JSON.parse(fs.readFileSync(LOCKS_FILE, 'utf8'));

    const executorCount = systemState.executors?.length || 0;
    const taskCount = tasks.tasks?.length || 0;
    const lockCount = Object.keys(locks.locks || {}).length;

    let status = `System status: `;
    status += systemState.supervisor ? 'Supervisor online. ' : 'No supervisor. ';
    status += `${executorCount} executors. `;
    status += `${taskCount} active tasks. `;
    status += `${lockCount} file locks.`;

    speak(status);
    return true;
  } catch (e) {
    speak('Could not read system status');
    return false;
  }
}

function assignTask(agent, task) {
  speak(`Assigning ${agent} to ${task}`);

  // Trigger Claude command
  runClaudeCommand(`/multiagent:assign ${agent} "${task}"`);
  return true;
}

function broadcastMessage(message) {
  speak(`Broadcasting: ${message}`);

  // Write to all executor inboxes
  try {
    const systemState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    const timestamp = new Date().toISOString();

    for (const executor of systemState.executors || []) {
      const inbox = path.join(MULTIAGENT_DIR, 'inbox', `${executor.name}.jsonl`);
      const msg = JSON.stringify({
        from: 'supervisor',
        type: 'broadcast',
        content: message,
        timestamp,
      });
      fs.appendFileSync(inbox, msg + '\n');
    }

    speak(`Broadcast sent to ${systemState.executors?.length || 0} agents`);
    return true;
  } catch (e) {
    speak('Failed to broadcast');
    return false;
  }
}

function checkMessages() {
  try {
    if (!fs.existsSync(SUPERVISOR_INBOX)) {
      speak('No messages');
      return true;
    }

    const content = fs.readFileSync(SUPERVISOR_INBOX, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);

    if (lines.length === 0) {
      speak('Inbox empty');
      return true;
    }

    // Read last 3 messages
    const recent = lines.slice(-3);
    speak(`${lines.length} messages. Recent:`);

    for (const line of recent) {
      try {
        const msg = JSON.parse(line);
        setTimeout(() => {
          speak(`From ${msg.from}: ${msg.content}`);
        }, 500);
      } catch (e) {
        // Skip malformed
      }
    }

    return true;
  } catch (e) {
    speak('Could not read messages');
    return false;
  }
}

function releaseLocks() {
  try {
    fs.writeFileSync(LOCKS_FILE, JSON.stringify({ locks: {} }, null, 2));
    speak('All locks released');
    return true;
  } catch (e) {
    speak('Failed to release locks');
    return false;
  }
}

function listAgents() {
  try {
    const systemState = JSON.parse(fs.readFileSync(STATE_FILE, 'utf8'));
    const executors = systemState.executors || [];

    if (executors.length === 0) {
      speak('No executors online');
      return true;
    }

    const names = executors.map((e) => `${e.name} ${e.status}`).join(', ');
    speak(`${executors.length} executors: ${names}`);
    return true;
  } catch (e) {
    speak('Could not list agents');
    return false;
  }
}

function listTasks() {
  try {
    const tasks = JSON.parse(fs.readFileSync(ACTIVE_TASKS, 'utf8'));
    const taskList = tasks.tasks || [];

    if (taskList.length === 0) {
      speak('No active tasks');
      return true;
    }

    const summary = taskList
      .map((t) => `${t.agent || 'unassigned'}: ${t.title}`)
      .slice(0, 5)
      .join('. ');

    speak(`${taskList.length} tasks. ${summary}`);
    return true;
  } catch (e) {
    speak('Could not list tasks');
    return false;
  }
}

function taskDone() {
  if (!state.agentName) {
    speak('You are not in executor mode');
    return false;
  }

  runClaudeCommand('/multiagent:done');
  speak('Marking task complete');
  return true;
}

function askQuestion(question) {
  if (!state.agentName) {
    speak('You are not in executor mode');
    return false;
  }

  const timestamp = new Date().toISOString();
  const msg = JSON.stringify({
    from: state.agentName,
    type: 'question',
    content: question,
    timestamp,
  });

  fs.appendFileSync(SUPERVISOR_INBOX, msg + '\n');
  speak('Question sent to supervisor');
  return true;
}

function myTask() {
  if (!state.agentName) {
    speak('You are not in executor mode');
    return false;
  }

  try {
    const tasks = JSON.parse(fs.readFileSync(ACTIVE_TASKS, 'utf8'));
    const myTask = tasks.tasks?.find((t) => t.agent === state.agentName);

    if (!myTask) {
      speak('No task assigned to you');
      return true;
    }

    speak(`Your task: ${myTask.title}. Status: ${myTask.status}`);
    return true;
  } catch (e) {
    speak('Could not read task');
    return false;
  }
}

function becomeExecutor(name) {
  state.role = 'executor';
  state.agentName = name;

  // Write agent identity file
  const agentFile = path.join(MULTIAGENT_DIR, '.current-agent');
  fs.writeFileSync(agentFile, name);

  speak(`Now executor ${name}. Say my task to see assignment.`);
  return true;
}

function checkAgent(name) {
  try {
    const tasks = JSON.parse(fs.readFileSync(ACTIVE_TASKS, 'utf8'));
    const agentTask = tasks.tasks?.find((t) => t.agent === name);

    if (!agentTask) {
      speak(`${name} has no active task`);
      return true;
    }

    speak(`${name} is working on: ${agentTask.title}. Status: ${agentTask.status}`);
    return true;
  } catch (e) {
    speak(`Could not check ${name}`);
    return false;
  }
}

// ============================================================
// HELPERS
// ============================================================

function speak(text) {
  try {
    fs.appendFileSync(TTS_QUEUE, text + '\n');
  } catch (e) {
    // Ignore
  }
  console.log(`[MultiAgent TTS] ${text}`);
}

function runClaudeCommand(command) {
  const fullCommand = `cd "${state.projectPath}" && claude "${command}"`;

  try {
    spawn('bash', ['-c', fullCommand], {
      detached: true,
      stdio: 'ignore',
    }).unref();
    return true;
  } catch (e) {
    speak(`Failed: ${e.message}`);
    return false;
  }
}
