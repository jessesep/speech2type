import { exec } from 'child_process';

import boxen from 'boxen';
import chalk from 'chalk';

import { HotkeyService } from './services/hotkey.js';
import { PermissionService } from './services/permission.js';
import { TranscriberService } from './services/transcriber.js';
import { TyperService } from './services/typer.js';

let sessionActive = false;
let hotkeyService, transcriberService, typerService;

// Buffer for handling commands that come as separate chunks
let pendingText = '';
let pendingTimeout = null;
const COMMAND_WAIT_MS = 400; // Wait this long to see if a command follows

// Voice commands - trigger phrases mapped to actions
// Added many variations to handle different transcription results
const VOICE_COMMANDS = {
  // Submit/Enter commands - many variations
  'send it': 'enter',
  'send': 'enter',
  'sent it': 'enter',      // common mishearing
  'sent': 'enter',
  'submit': 'enter',
  'enter': 'enter',
  'press enter': 'enter',
  'execute': 'enter',
  'run it': 'enter',
  'run': 'enter',
  'go': 'enter',
  'do it': 'enter',
  'done': 'enter',
  'send that': 'enter',
  'submit that': 'enter',

  // Newline commands
  'new line': 'newline',
  'newline': 'newline',
  'next line': 'newline',
  'line break': 'newline',
  'break': 'newline',

  // Escape commands
  'escape': 'escape',
  'cancel': 'escape',
  'stop': 'escape',
  'nevermind': 'escape',
  'never mind': 'escape',
};

// App switching patterns - "focus [app]", "switch to [app]", "open [app]"
const APP_SWITCH_PATTERNS = [
  /^(?:focus|switch to|go to|open)\s+(.+)$/i,
];

// Common app name aliases
const APP_ALIASES = {
  'terminal': 'Terminal',
  'term': 'Terminal',
  'chrome': 'Google Chrome',
  'google': 'Google Chrome',
  'browser': 'Google Chrome',
  'safari': 'Safari',
  'finder': 'Finder',
  'files': 'Finder',
  'code': 'Visual Studio Code',
  'vs code': 'Visual Studio Code',
  'vscode': 'Visual Studio Code',
  'cursor': 'Cursor',
  'slack': 'Slack',
  'discord': 'Discord',
  'spotify': 'Spotify',
  'music': 'Spotify',
  'notes': 'Notes',
  'messages': 'Messages',
  'mail': 'Mail',
  'email': 'Mail',
  'preview': 'Preview',
  'settings': 'System Settings',
  'system settings': 'System Settings',
  'preferences': 'System Settings',
};

// Try to match an app name from spoken text
function matchAppName(spokenName) {
  const lower = spokenName.toLowerCase().trim();

  // Check aliases first
  if (APP_ALIASES[lower]) {
    return APP_ALIASES[lower];
  }

  // Try to find a partial match in aliases
  for (const [alias, appName] of Object.entries(APP_ALIASES)) {
    if (lower.includes(alias) || alias.includes(lower)) {
      return appName;
    }
  }

  // Return the spoken name with first letter capitalized (might work for exact app names)
  return spokenName.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
}

function playSound() {
  console.debug('[speech2type] Playing sound effect');
  exec('afplay /System/Library/Sounds/Tink.aiff', (err) => {
    if (err) console.debug('[speech2type] Sound playback failed:', err.message);
  });
}

function initializeServices(config) {
  const permissionService = new PermissionService(config);
  const permissionsGranted = permissionService.validateAllPermissions();
  if (!permissionsGranted) {
    process.exit(1);
  }

  hotkeyService = new HotkeyService(config);
  transcriberService = new TranscriberService(config);
  typerService = new TyperService(config);
}

function startSession(config) {
  if (sessionActive) return;

  sessionActive = true;
  transcriberService.removeAllListeners();

  console.log(chalk.bold.magenta('\n▶ Started listening...'));
  console.log(chalk.dim(`Press ${config.formatHotkey()} again to stop.`));

  transcriberService.once('open', () => {
    console.debug('[speech2type] Speech recognition connection opened');
    playSound();
  });
  transcriberService.once('close', () => {
    console.debug('[speech2type] Speech recognition connection closed');
    stopSession(config);
  });
  transcriberService.once('error', (error) => {
    console.error('[speech2type] Speech recognition connection error:', error?.message || error);
    stopSession(config);
  });
  transcriberService.on('transcript', async (text) => {
    if (!sessionActive) return;

    const lowerText = text.toLowerCase().trim();

    // Log what we received for debugging
    console.log(chalk.dim(`[transcript] "${text}" → normalized: "${lowerText}"`));

    // Check for app switching commands first (e.g., "focus terminal", "switch to chrome")
    for (const pattern of APP_SWITCH_PATTERNS) {
      const match = lowerText.match(pattern);
      if (match) {
        // Clear any pending
        if (pendingTimeout) {
          clearTimeout(pendingTimeout);
          pendingTimeout = null;
        }
        if (pendingText) {
          await typerService.typeText(pendingText + ' ');
          pendingText = '';
        }

        const spokenAppName = match[1];
        const appName = matchAppName(spokenAppName);
        console.log(chalk.green(`[app switch] "${spokenAppName}" → ${appName}`));
        await typerService.focusApp(appName);
        return;
      }
    }

    // Check if this chunk is ONLY a command (e.g., user said "send it" after a pause)
    if (VOICE_COMMANDS[lowerText]) {
      // Clear any pending timeout
      if (pendingTimeout) {
        clearTimeout(pendingTimeout);
        pendingTimeout = null;
      }

      // If there's pending text, type it first
      if (pendingText) {
        await typerService.typeText(pendingText + ' ');
        pendingText = '';
      }

      // Execute the command
      const action = VOICE_COMMANDS[lowerText];
      console.log(chalk.cyan(`[voice command] "${lowerText}" → ${action}`));

      switch (action) {
        case 'enter':
          await typerService.pressEnter();
          break;
        case 'newline':
          await typerService.insertNewline();
          break;
        case 'escape':
          await typerService.pressEscape();
          break;
      }
      return;
    }

    // Check if text ends with a command (e.g., "hello world send it" in one chunk)
    for (const [phrase, action] of Object.entries(VOICE_COMMANDS)) {
      if (lowerText.endsWith(phrase)) {
        // Clear any pending
        if (pendingTimeout) {
          clearTimeout(pendingTimeout);
          pendingTimeout = null;
        }
        if (pendingText) {
          await typerService.typeText(pendingText + ' ');
          pendingText = '';
        }

        // Type the text before the command
        const textBeforeCommand = text.slice(0, -phrase.length).trim();
        if (textBeforeCommand) {
          await typerService.typeText(textBeforeCommand + ' ');
        }

        console.log(chalk.cyan(`[voice command] "${phrase}" → ${action}`));

        switch (action) {
          case 'enter':
            await typerService.pressEnter();
            break;
          case 'newline':
            await typerService.insertNewline();
            break;
          case 'escape':
            await typerService.pressEscape();
            break;
        }
        return;
      }
    }

    // No command found - buffer the text briefly in case a command follows
    if (pendingTimeout) {
      clearTimeout(pendingTimeout);
    }
    pendingText += (pendingText ? ' ' : '') + text;

    pendingTimeout = setTimeout(async () => {
      if (pendingText && sessionActive) {
        await typerService.typeText(pendingText + ' ');
        pendingText = '';
      }
      pendingTimeout = null;
    }, COMMAND_WAIT_MS);
  });

  transcriberService.start();
}

function stopSession(config) {
  if (!sessionActive) return;

  sessionActive = false;

  // Clear any pending text buffer
  if (pendingTimeout) {
    clearTimeout(pendingTimeout);
    pendingTimeout = null;
  }
  if (pendingText) {
    // Type any remaining text before stopping
    typerService.typeText(pendingText + ' ');
    pendingText = '';
  }

  playSound();

  console.log(chalk.bold.dim.magenta('\n⏹ Stopped listening.'));
  console.log(chalk.dim(`Press ${config.formatHotkey()} to start listening again. Press Ctrl+C to quit.`));

  transcriberService.stop();
}

async function startApplication(config) {
  console.log(
    boxen(`${chalk.bold('Speech2Type')}\n\n${chalk.dim('Voice typing from your terminal.')}`, {
      padding: 1,
      borderStyle: 'round',
      borderColor: 'magenta',
      title: 'Welcome to',
      fullscreen: (width, _) => [width - 10, 7],
    })
  );

  if (config.isFirstRun) {
    await config.setupWizard();
  }
  await config.ensureDeepgramApiKey();

  initializeServices(config);

  process.on('SIGINT', () => {
    stopSession(config);
    hotkeyService.stop();
    process.exit(0);
  });

  console.log(`Ready. Press ${config.formatHotkey()} to speak. Ctrl+C to quit.`);
  console.log(chalk.dim('As you speak, transcription will appear in real time at your cursor, so place it where you want to type.'));
  hotkeyService.on('toggle', () => (sessionActive ? stopSession(config) : startSession(config)));
  hotkeyService.start();
}

export { startApplication };
