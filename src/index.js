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

// Store config reference for voice commands
let currentConfig = null;

// Track if this is the initial app startup (for init-only commands like computer resume/fresh)
// Only true once when s2t first launches, never reset
let isInitMode = true;

// Voice commands - using "affirmative" as the main trigger
const VOICE_COMMANDS = {
  // Submit / Enter
  'affirmative': 'enter',
  'computer enter': 'enter',
  'computer submit': 'enter',

  // Undo last spoken chunk
  'retract': 'undo',
  'computer undo': 'undo',

  // Clear entire input field
  'computer scratch': 'clear_all',
  'computer scratch all': 'clear_all',
  'computer scratch that': 'clear_all',

  // Clipboard operations
  'computer copy': 'copy',
  'computer paste': 'paste',
  'computer cut': 'cut',

  // Selection
  'computer select all': 'select_all',

  // Common shortcuts
  'computer save': 'save',
  'computer find': 'find',
  'computer new tab': 'new_tab',
  'computer close tab': 'close_tab',
  'computer new window': 'new_window',

  // Listening control
  'computer stop listening': 'stop_listening',
  'computer stop': 'stop_listening',

  // Claude Code launch
  'computer resume': 'claude_resume',
  'computer fresh': 'claude_fresh',
};

// Play a soft beep for audio feedback
function playBeep() {
  exec('afplay -v 0.3 /System/Library/Sounds/Pop.aiff &', () => {});
}

// Play subtle typing sounds (always 2 taps)
function playTypingSound() {
  exec('afplay -v 0.12 /System/Library/Sounds/Tink.aiff &', () => {});
  setTimeout(() => {
    exec('afplay -v 0.12 /System/Library/Sounds/Tink.aiff &', () => {});
  }, 70);
}

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

function playStartSound() {
  exec('afplay -v 0.3 -r 1.3 /System/Library/Sounds/Bottle.aiff &', () => {});
}

function playStopSound() {
  exec('afplay -v 0.3 -r 0.8 /System/Library/Sounds/Bottle.aiff &', () => {});
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

  currentConfig = config;
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
    playStartSound();
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
        playBeep();
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
          typedHistory.length = 0;
          playBeep();
          break;
        case 'clear_all':
          await typerService.clearAll();
          typedHistory.length = 0;
          playBeep();
          break;
        case 'stop_speak':
          await typerService.stopSpeaking();
          isSpeaking = false;
          playBeep();
          break;
        case 'copy':
          await typerService.copy();
          playBeep();
          break;
        case 'paste':
          await typerService.paste();
          playBeep();
          break;
        case 'cut':
          await typerService.cut();
          playBeep();
          break;
        case 'select_all':
          await typerService.selectAll();
          playBeep();
          break;
        case 'save':
          await typerService.save();
          playBeep();
          break;
        case 'find':
          await typerService.find();
          playBeep();
          break;
        case 'new_tab':
          await typerService.newTab();
          playBeep();
          break;
        case 'close_tab':
          await typerService.closeTab();
          playBeep();
          break;
        case 'new_window':
          await typerService.newWindow();
          playBeep();
          break;
        case 'stop_listening':
          if (currentConfig) {
            stopSession(currentConfig);
          }
          break;
        case 'claude_resume':
          if (isInitMode) {
            playBeep();
            exec('osascript -e \'tell application "Terminal" to do script "claude --resume --dangerously-skip-permissions"\'', () => {});
            isInitMode = false;
          }
          break;
        case 'claude_fresh':
          if (isInitMode) {
            playBeep();
            exec('osascript -e \'tell application "Terminal" to do script "claude --dangerously-skip-permissions"\'', () => {});
            isInitMode = false;
          }
          break;
      }
      // After any command, disable init mode
      isInitMode = false;
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
        playTypingSound();
        // Add to undo history
        typedHistory.push(typedText.length);
        if (typedHistory.length > MAX_UNDO_HISTORY) typedHistory.shift();
        pendingText = '';
        // After first text typed, disable init mode
        isInitMode = false;
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

  playStopSound();

  console.log(chalk.bold.dim.magenta('\n⏹ Stopped listening.'));
  console.log(chalk.dim(`Press ${config.formatHotkey()} to start listening again. Press Ctrl+C to quit.`));

  transcriberService.stop();
}

async function startApplication(config, options = {}) {
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
  console.log(chalk.dim("Press CMD+' to toggle auto-read mode. Press SPACEBAR to stop TTS."));
  hotkeyService.on('toggle', () => (sessionActive ? stopSession(config) : startSession(config)));
  hotkeyService.on('toggle_auto_read', () => {
    // Toggle the Claude auto-speak control file
    const controlFile = '/tmp/claude-auto-speak';
    if (existsSync(controlFile)) {
      // Disable auto-speak
      exec(`rm -f ${controlFile}; killall say 2>/dev/null`, () => {});
      console.log(chalk.magenta('[auto-read] Claude auto-speak DISABLED'));
    } else {
      // Enable auto-speak
      exec(`touch ${controlFile}`, () => {});
      console.log(chalk.magenta('[auto-read] Claude auto-speak ENABLED'));
    }
  });
  hotkeyService.on('stop_tts', async () => {
    // Spacebar pressed while TTS is playing - stop it
    // First, kill the audio but DON'T remove the lock file yet
    exec('killall afplay 2>/dev/null; killall piper 2>/dev/null; killall say 2>/dev/null', () => {});
    console.log(chalk.magenta('[TTS] Stopped by spacebar'));
    // Keep the lock file for a moment to prevent transcription pickup
    setTimeout(() => {
      exec('rm -f /tmp/claude-tts-speaking', () => {});
    }, 800);
  });
  hotkeyService.start();

  // Auto-start listening if --auto flag was passed
  if (options.autoStart) {
    startSession(config);
  }
}

export { startApplication };
