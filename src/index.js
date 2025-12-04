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
const VOICE_COMMANDS = {
  // Submit/Enter commands
  'send it': 'enter',
  'submit': 'enter',
  'enter': 'enter',
  'press enter': 'enter',
  'execute': 'enter',

  // Newline commands
  'new line': 'newline',
  'newline': 'newline',
  'next line': 'newline',

  // Escape commands
  'escape': 'escape',
  'cancel': 'escape',
};

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
