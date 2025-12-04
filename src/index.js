import { exec, execFile } from 'child_process';

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

// History of typed text lengths for multiple undos
const typedHistory = [];
const MAX_UNDO_HISTORY = 20; // Keep last 20 chunks

// TTS state - pause transcription while speaking
let isSpeaking = false;

// Check if external TTS (Claude hook) is speaking
const TTS_LOCK_FILE = '/tmp/claude-tts-speaking';
import { existsSync } from 'fs';

// Clipboard watching for auto-read
let lastClipboardContent = '';
let clipboardWatchInterval = null;
const CLIPBOARD_WATCH_MS = 500; // Check clipboard every 500ms

// Voice commands - using "affirmative" as the main trigger
const VOICE_COMMANDS = {
  // Primary command - "affirmative" with all punctuation variations handled by stripPunctuation()
  'affirmative': 'enter',

  // Undo/delete last chunk - distinctive words that won't appear in normal speech
  'disregard': 'undo',
  'scratch that': 'undo',
  'belay that': 'undo',        // nautical term, very distinctive
  'retract': 'undo',
  'undo': 'undo',

  // Clear entire input field - all variations of "retract everything confirm"
  'retract everything confirm': 'clear_all',
  'retract everything confirmed': 'clear_all',
  'retract all confirm': 'clear_all',
  'retract all confirmed': 'clear_all',
  'clear everything confirm': 'clear_all',
  'clear everything confirmed': 'clear_all',
  'clear all confirm': 'clear_all',
  'clear all confirmed': 'clear_all',
  'delete everything confirm': 'clear_all',
  'delete everything confirmed': 'clear_all',
  'delete all confirm': 'clear_all',
  'delete all confirmed': 'clear_all',

  // Text-to-speech commands - read clipboard aloud
  'read it': 'speak',
  'read that': 'speak',
  'speak': 'speak',
  'read aloud': 'speak',
  'read clipboard': 'speak',

  // Stop speaking
  'stop reading': 'stop_speak',
  'silence': 'stop_speak',
  'quiet': 'stop_speak',
  'shut up': 'stop_speak',
  'hush': 'stop_speak',

  // Auto-read mode toggle
  'auto read': 'auto_read_on',
  'auto read on': 'auto_read_on',
  'start auto read': 'auto_read_on',
  'auto read off': 'auto_read_off',
  'stop auto read': 'auto_read_off',
};

// Auto-read state
let autoReadEnabled = false;

// Start watching clipboard for changes (auto-read feature)
function startClipboardWatch() {
  if (clipboardWatchInterval) return; // Already watching

  // Get current clipboard content to establish baseline
  execFile('/usr/bin/pbpaste', [], { maxBuffer: 1024 * 1024 }, (err, stdout) => {
    if (!err) {
      lastClipboardContent = stdout;
    }
  });

  clipboardWatchInterval = setInterval(async () => {
    if (!autoReadEnabled || isSpeaking) return;

    try {
      const currentContent = await new Promise((resolve, reject) => {
        execFile('/usr/bin/pbpaste', [], { maxBuffer: 1024 * 1024 }, (err, stdout) => {
          if (err) reject(err);
          else resolve(stdout);
        });
      });

      // Check if clipboard changed and has content
      if (currentContent && currentContent !== lastClipboardContent) {
        lastClipboardContent = currentContent;
        console.log(chalk.magenta(`[auto-read] New clipboard content detected (${currentContent.length} chars)`));

        // Speak the new content
        isSpeaking = true;
        await typerService.speakClipboard();
        isSpeaking = false;
      }
    } catch (error) {
      // Ignore clipboard read errors
    }
  }, CLIPBOARD_WATCH_MS);

  console.log(chalk.magenta(`[clipboard] Started watching (every ${CLIPBOARD_WATCH_MS}ms)`));
}

// Stop watching clipboard
function stopClipboardWatch() {
  if (clipboardWatchInterval) {
    clearInterval(clipboardWatchInterval);
    clipboardWatchInterval = null;
    console.log(chalk.magenta('[clipboard] Stopped watching'));
  }
}

// Strip all punctuation from text for command matching
function stripPunctuation(text) {
  return text.replace(/[.,!?;:'"()[\]{}]/g, '').trim();
}

// App switching patterns - "focus [app]", "switch to [app]", "open [app]"
const APP_SWITCH_PATTERNS = [
  /^(?:focus|switch to|go to|open)\s+(.+)$/i,
];

// Terminal window switching patterns
// "terminal 1", "terminal 2", "window 1", "terminal window 1"
const TERMINAL_INDEX_PATTERN = /^(?:terminal|window|terminal window)\s*(\d+)$/i;

// "terminal claude", "terminal ssh", "window with claude"
const TERMINAL_NAME_PATTERN = /^(?:terminal|window|terminal window)\s+(?:with\s+)?(.+)$/i;

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
  // Remove ALL listeners before adding new ones to prevent double-firing
  transcriberService.removeAllListeners('transcript');
  transcriberService.removeAllListeners('open');
  transcriberService.removeAllListeners('close');
  transcriberService.removeAllListeners('error');

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

    // Ignore transcriptions while TTS is speaking (prevents feedback loop)
    // Check both internal isSpeaking flag and external Claude TTS lock file
    if (isSpeaking || existsSync(TTS_LOCK_FILE)) {
      console.log(chalk.dim(`[transcript] Ignored (TTS speaking): "${text}"`));
      return;
    }

    const lowerText = text.toLowerCase().trim();
    const cleanText = stripPunctuation(lowerText);

    // Log what we received for debugging
    console.log(chalk.dim(`[transcript] "${text}" → clean: "${cleanText}"`));

    // Check for Terminal window switching by index (e.g., "terminal 1", "window 2")
    const terminalIndexMatch = cleanText.match(TERMINAL_INDEX_PATTERN);
    if (terminalIndexMatch) {
      // Clear any pending
      if (pendingTimeout) {
        clearTimeout(pendingTimeout);
        pendingTimeout = null;
      }
      if (pendingText) {
        await typerService.typeText(pendingText + ' ');
        pendingText = '';
      }

      const windowIndex = parseInt(terminalIndexMatch[1], 10);
      console.log(chalk.green(`[terminal switch] window index ${windowIndex}`));
      await typerService.focusTerminalWindow(windowIndex);
      return;
    }

    // Check for Terminal window switching by name (e.g., "terminal claude", "window ssh")
    const terminalNameMatch = cleanText.match(TERMINAL_NAME_PATTERN);
    if (terminalNameMatch) {
      const searchTerm = terminalNameMatch[1];
      // Skip if it's just a number (handled above) or a generic app name
      if (!/^\d+$/.test(searchTerm) && !APP_ALIASES[searchTerm]) {
        // Clear any pending
        if (pendingTimeout) {
          clearTimeout(pendingTimeout);
          pendingTimeout = null;
        }
        if (pendingText) {
          await typerService.typeText(pendingText + ' ');
          pendingText = '';
        }

        console.log(chalk.green(`[terminal switch] searching for "${searchTerm}"`));
        await typerService.focusTerminalByName(searchTerm);
        return;
      }
    }

    // Check for app switching commands (e.g., "focus terminal", "switch to chrome")
    for (const pattern of APP_SWITCH_PATTERNS) {
      const match = cleanText.match(pattern);
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

    // Check if this chunk is ONLY a command (using cleaned text without punctuation)
    if (VOICE_COMMANDS[cleanText]) {
      // Clear any pending timeout
      if (pendingTimeout) {
        clearTimeout(pendingTimeout);
        pendingTimeout = null;
      }

      // For undo, don't type pending text - we want to undo it too
      const action = VOICE_COMMANDS[cleanText];

      if (action === 'undo') {
        // Delete pending text if any, or delete from history
        if (pendingText) {
          console.log(chalk.yellow(`[undo] Discarding pending: "${pendingText}"`));
          pendingText = '';
        } else if (typedHistory.length > 0) {
          const lastLength = typedHistory.pop();
          console.log(chalk.yellow(`[undo] Deleting ${lastLength} characters (${typedHistory.length} more in history)`));
          await typerService.deleteCharacters(lastLength);
        } else {
          console.log(chalk.yellow(`[undo] Nothing to undo`));
        }
        return;
      }

      // If there's pending text, type it first (for non-undo commands)
      if (pendingText) {
        const typedText = pendingText + ' ';
        await typerService.typeText(typedText);
        typedHistory.push(typedText.length);
        if (typedHistory.length > MAX_UNDO_HISTORY) typedHistory.shift();
        pendingText = '';
      }

      // Execute the command
      console.log(chalk.cyan(`[voice command] "${cleanText}" → ${action}`));

      switch (action) {
        case 'enter':
          await typerService.pressEnter();
          typedHistory.length = 0; // Clear history after enter
          break;
        case 'newline':
          await typerService.insertNewline();
          break;
        case 'escape':
          await typerService.pressEscape();
          break;
        case 'clear_all':
          console.log(chalk.yellow('[clear] Clearing entire input field'));
          await typerService.clearAll();
          typedHistory.length = 0; // Clear history since all text is gone
          break;
        case 'speak':
          console.log(chalk.magenta('[tts] Reading clipboard aloud...'));
          isSpeaking = true;
          await typerService.speakClipboard();
          isSpeaking = false;
          break;
        case 'stop_speak':
          console.log(chalk.magenta('[tts] Stopping speech...'));
          await typerService.stopSpeaking();
          isSpeaking = false;
          break;
        case 'auto_read_on':
          autoReadEnabled = true;
          startClipboardWatch();
          console.log(chalk.magenta('[tts] Auto-read enabled - will read new clipboard content'));
          break;
        case 'auto_read_off':
          autoReadEnabled = false;
          stopClipboardWatch();
          console.log(chalk.magenta('[tts] Auto-read disabled'));
          break;
      }
      return;
    }

    // Check if text ends with a command (e.g., "hello world affirmative" in one chunk)
    for (const [phrase, action] of Object.entries(VOICE_COMMANDS)) {
      // Check if cleaned text ends with the command phrase
      if (cleanText.endsWith(phrase)) {
        // Clear any pending
        if (pendingTimeout) {
          clearTimeout(pendingTimeout);
          pendingTimeout = null;
        }
        if (pendingText) {
          await typerService.typeText(pendingText + ' ');
          pendingText = '';
        }

        // Type the text before the command (use cleanText length calculation)
        const textBeforeCommand = cleanText.slice(0, -phrase.length).trim();
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
        const typedText = pendingText + ' ';
        await typerService.typeText(typedText);
        // Add to undo history
        typedHistory.push(typedText.length);
        if (typedHistory.length > MAX_UNDO_HISTORY) typedHistory.shift();
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
