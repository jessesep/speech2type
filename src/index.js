import { exec, execFile } from 'child_process';

import boxen from 'boxen';
import chalk from 'chalk';

import { HotkeyService } from './services/hotkey.js';
import { PermissionService } from './services/permission.js';
import { TranscriberService } from './services/transcriber.js';
import { TyperService } from './services/typer.js';
import { AddonLoader } from './services/addon-loader.js';

let sessionActive = false;
let hotkeyService, transcriberService, typerService, addonLoader;

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
import { existsSync, readFileSync, writeFileSync } from 'fs';

// Clipboard watching for auto-read
let lastClipboardContent = '';
let clipboardWatchInterval = null;
const CLIPBOARD_WATCH_MS = 500; // Check clipboard every 500ms

// Store config reference for voice commands
let currentConfig = null;

// Track if this is the initial app startup (for init-only commands like computer resume/fresh)
// Only true once when s2t first launches, never reset
let isInitMode = true;

// Mode system - 'general', 'addon', or 'claude'
let currentMode = 'general';

// Claude mode - auto pause/resume listening after response
const CLAUDE_RESPONSE_DONE_FILE = '/tmp/claude-response-done';
let claudeModeWatcher = null;

// Voice commands - all commands require "computer" prefix except affirmative/retract
// GENERAL mode commands (always available)
const GENERAL_COMMANDS = {
  // Submit / Enter - affirmative works without "computer" prefix (+ variations)
  'affirmative': 'enter',
  'affirmatives': 'enter',
  'a]firmative': 'enter',
  'affirm a tive': 'enter',
  'affirm ative': 'enter',
  'firm ative': 'enter',
  'computer affirmative': 'enter',
  'computer enter': 'enter',
  'computer submit': 'enter',
  'computer send': 'enter',
  'computer go': 'enter',
  'computer done': 'enter',

  // Undo last spoken chunk - retract works without "computer" prefix (+ variations)
  'retract': 'undo',
  'retracts': 'undo',
  'retracted': 'undo',
  're tract': 'undo',
  'ree tract': 'undo',
  'detract': 'undo',
  'computer retract': 'undo',
  'computer undo': 'undo',
  'computer oops': 'undo',
  'computer nevermind': 'undo',
  'computer never mind': 'undo',

  // Clear entire input field (+ variations) - only "scratch" to avoid accidents
  'computer scratch': 'clear_all',
  'computer scratch all': 'clear_all',
  'computer scratch that': 'clear_all',
  'computer scrap': 'clear_all',
  'computer scrap all': 'clear_all',
  'computer scrap that': 'clear_all',

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

  // Listening control - variations for speech recognition
  'computer stop listening': 'stop_listening',
  'computer stopped listening': 'stop_listening',
  'computer stop lesson': 'stop_listening',
  'computer stop lessening': 'stop_listening',
  'computer stop listing': 'stop_listening',
  'computer stop listen': 'stop_listening',
  'computer stuff listening': 'stop_listening',
  'computer stock listening': 'stop_listening',
  'computer top listening': 'stop_listening',

  // TTS control - variations
  'computer text to speech on': 'tts_on',
  'computer text to speech off': 'tts_off',
  'computer speech on': 'tts_on',
  'computer speech off': 'tts_off',
  'computer speak on': 'tts_on',
  'computer speak off': 'tts_off',
  'computer speaking on': 'tts_on',
  'computer speaking off': 'tts_off',
  'computer voice on': 'tts_on',
  'computer voice off': 'tts_off',

  // Claude Code launch
  'computer resume': 'claude_resume',
  'computer fresh': 'claude_fresh',

  // Mode switching (always available) - with variations
  'computer general mode': 'mode_general',
  'computer general': 'mode_general',
  'computer normal mode': 'mode_general',
  'computer default mode': 'mode_general',
  'computer regular mode': 'mode_general',

  // Claude/Power mode - many variations for speech recognition
  'computer power mode': 'mode_claude',
  'computer powermode': 'mode_claude',
  'computer power-mode': 'mode_claude',
  'computer claude mode': 'mode_claude',
  'computer powered mode': 'mode_claude',
  'computer par mode': 'mode_claude',
  'computer pour mode': 'mode_claude',
  'computer tower mode': 'mode_claude',
  'computer powder mode': 'mode_claude',
  'computer hour mode': 'mode_claude',
  'computer flower mode': 'mode_claude',
  'computer coding mode': 'mode_claude',
  'computer claw mode': 'mode_claude',
  'computer cloud mode': 'mode_claude',
};

// Get active commands based on current mode
function getActiveCommands() {
  const commands = { ...GENERAL_COMMANDS };

  // Add addon mode switching commands
  if (addonLoader) {
    Object.assign(commands, addonLoader.getModeCommands());
  }

  // In addon mode, add addon-specific commands
  if (currentMode === 'addon' && addonLoader) {
    const addonCommands = addonLoader.getActiveCommands();
    Object.assign(commands, addonCommands);

    // In addon mode, "computer stop" should go to addon, not stop_listening
    // Remove general stop_listening if addon has a stop command
    if (addonCommands['computer stop']) {
      delete commands['computer stop listening'];
    }
  }

  return commands;
}

// Get active patterns for current mode
function getActivePatterns() {
  if (currentMode === 'addon' && addonLoader) {
    return addonLoader.getActivePatterns();
  }
  return [];
}

// Claude mode: watch for response completion and resume listening
function startClaudeModeWatcher(config) {
  if (claudeModeWatcher) return;

  // Clean up any stale file
  exec(`rm -f ${CLAUDE_RESPONSE_DONE_FILE}`, () => {});

  claudeModeWatcher = setInterval(() => {
    if (existsSync(CLAUDE_RESPONSE_DONE_FILE)) {
      // Response complete - resume listening
      exec(`rm -f ${CLAUDE_RESPONSE_DONE_FILE}`, () => {});
      console.log(chalk.cyan('[claude mode] Response complete - resuming listening'));
      if (!sessionActive && config) {
        startSession(config);
      }
    }
  }, 200);

  console.log(chalk.cyan('[claude mode] Watcher started'));
}

function stopClaudeModeWatcher() {
  if (claudeModeWatcher) {
    clearInterval(claudeModeWatcher);
    claudeModeWatcher = null;
    exec(`rm -f ${CLAUDE_RESPONSE_DONE_FILE}`, () => {});
    console.log(chalk.dim('[claude mode] Watcher stopped'));
  }
}

// For backward compatibility
const VOICE_COMMANDS = GENERAL_COMMANDS;

// Normalize "computers" to "computer" for command matching
function normalizeCommand(text) {
  return text.replace(/^computers\s+/, 'computer ');
}

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
  // Ascending tone - Pop sound at higher pitch
  exec('afplay -v 0.25 -r 1.5 /System/Library/Sounds/Pop.aiff &', () => {});
}

function playStopSound() {
  // Descending tone - Morse sound at lower pitch, softer
  exec('afplay -v 0.12 -r 0.7 /System/Library/Sounds/Morse.aiff &', () => {});
}

async function initializeServices(config) {
  const permissionService = new PermissionService(config);
  const permissionsGranted = permissionService.validateAllPermissions();
  if (!permissionsGranted) {
    process.exit(1);
  }

  hotkeyService = new HotkeyService(config);
  transcriberService = new TranscriberService(config);
  typerService = new TyperService(config);

  // Load addons
  addonLoader = new AddonLoader(config.projectRoot);
  await addonLoader.loadAll();
}

// Execute a general action (keyboard shortcuts, mode switches, etc.)
async function executeGeneralAction(action) {
  switch (action) {
    case 'enter':
      // In Ableton/addon mode with search mode active, press Enter twice (select + confirm)
      if (currentMode === 'addon' && addonLoader) {
        const addon = addonLoader.getActive();
        if (addon && addon.isSearchMode && addon.isSearchMode()) {
          // Press Enter twice: first to select search result, second to confirm/load
          await typerService.pressEnter();
          await new Promise(resolve => setTimeout(resolve, 100)); // Small delay between presses
          await typerService.pressEnter();
          typedHistory.length = 0;
          playBeep();
          // Exit search mode
          addon.setSearchMode(false);
          addonLoader.setTempCommandsOnly(null);
          console.log(chalk.magenta('[ableton] Search mode ended (Enter x2)'));
          // Stop listening
          if (currentConfig) {
            stopSession(currentConfig);
          }
          return true;
        }
        // Not in search mode, but still in addon mode - stop listening on affirmative
        await typerService.pressEnter();
        typedHistory.length = 0;
        playBeep();
        if (currentConfig) {
          stopSession(currentConfig);
        }
        return true;
      }
      // Normal enter for other modes
      await typerService.pressEnter();
      typedHistory.length = 0;
      playBeep();
      // In Claude mode, pause listening after submit
      if (currentMode === 'claude' && currentConfig) {
        console.log(chalk.cyan('[claude mode] Pausing listening - waiting for response...'));
        stopSession(currentConfig);
      }
      return true;
    case 'clear_all':
      await typerService.clearAll();
      typedHistory.length = 0;
      playBeep();
      return true;
    case 'stop_speak':
      await typerService.stopSpeaking();
      isSpeaking = false;
      playBeep();
      return true;
    case 'copy':
      await typerService.copy();
      playBeep();
      return true;
    case 'paste':
      await typerService.paste();
      playBeep();
      return true;
    case 'cut':
      await typerService.cut();
      playBeep();
      return true;
    case 'select_all':
      await typerService.selectAll();
      playBeep();
      return true;
    case 'save':
      await typerService.save();
      playBeep();
      return true;
    case 'find':
      await typerService.find();
      playBeep();
      return true;
    case 'new_tab':
      await typerService.newTab();
      playBeep();
      return true;
    case 'close_tab':
      await typerService.closeTab();
      playBeep();
      return true;
    case 'new_window':
      await typerService.newWindow();
      playBeep();
      return true;
    case 'stop_listening':
      if (currentConfig) {
        stopSession(currentConfig);
      }
      return true;
    case 'tts_on':
      exec('touch /tmp/claude-auto-speak', () => {});
      console.log(chalk.green('[TTS] Text-to-speech ON'));
      playBeep();
      return true;
    case 'tts_off':
      exec('rm -f /tmp/claude-auto-speak', () => {});
      console.log(chalk.yellow('[TTS] Text-to-speech OFF'));
      playBeep();
      return true;
    case 'claude_resume':
      if (isInitMode) {
        playBeep();
        exec('osascript -e \'tell application "Terminal" to do script "claude --resume --dangerously-skip-permissions"\'', () => {});
        isInitMode = false;
      }
      return true;
    case 'claude_fresh':
      if (isInitMode) {
        playBeep();
        exec('osascript -e \'tell application "Terminal" to do script "claude --dangerously-skip-permissions"\'', () => {});
        isInitMode = false;
      }
      return true;
    case 'mode_general':
      currentMode = 'general';
      stopClaudeModeWatcher();
      if (addonLoader) addonLoader.deactivate();
      // TTS off by default in general mode
      exec('rm -f /tmp/claude-auto-speak', () => {});
      console.log(chalk.green.bold('[mode] Switched to GENERAL mode (TTS off)'));
      playBeep();
      return true;
    case 'mode_claude':
      currentMode = 'claude';
      if (addonLoader) addonLoader.deactivate();
      startClaudeModeWatcher(currentConfig);
      // TTS on by default in Claude mode
      exec('touch /tmp/claude-auto-speak', () => {});
      console.log(chalk.cyan.bold('[mode] Switched to CLAUDE mode - TTS on, listening pauses after submit'));
      // Soft welcome voice - use TTS lock to prevent mic pickup
      exec('touch /tmp/claude-tts-speaking && say -v Samantha -r 180 "welcome" && rm -f /tmp/claude-tts-speaking &', () => {});
      return true;
    default:
      return false;
  }
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

  // Play start sound immediately
  playStartSound();

  transcriberService.once('open', () => {
    console.debug('[speech2type] Speech recognition connection opened');
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
    const cleanText = normalizeCommand(stripPunctuation(lowerText));

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

    // In addon mode, check dynamic patterns first (tempo 120, scene 1, etc.)
    if (currentMode === 'addon') {
      const patterns = getActivePatterns();
      for (const { pattern, action, extract } of patterns) {
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

          const value = extract(match);
          const addonMeta = addonLoader.getActiveMetadata();
          console.log(chalk.magenta(`[${addonMeta?.name || 'addon'}] ${action} → ${JSON.stringify(value)}`));

          const result = addonLoader.executeAction(action, value);
          if (result === true) {
            playBeep();
          } else if (typeof result === 'string') {
            // Delegate to general action
            await executeGeneralAction(result);
          }
          return;
        }
      }
    }

    // Check if this chunk is ONLY a command (using cleaned text without punctuation)
    const activeCommands = getActiveCommands();
    if (activeCommands[cleanText]) {
      // Clear any pending timeout
      if (pendingTimeout) {
        clearTimeout(pendingTimeout);
        pendingTimeout = null;
      }

      // For undo, don't type pending text - we want to undo it too
      const action = activeCommands[cleanText];

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

      // Check for addon mode switch commands
      if (action.startsWith('mode_addon_')) {
        const addonName = action.replace('mode_addon_', '');
        currentMode = 'addon';
        stopClaudeModeWatcher();
        addonLoader.activate(addonName);

        // Set TTS based on addon settings
        if (addonLoader.isTTSEnabled()) {
          exec('touch /tmp/claude-auto-speak', () => {});
        } else {
          exec('rm -f /tmp/claude-auto-speak', () => {});
        }
        playBeep();

        // If addon has push-to-talk enabled, stop listening
        if (addonLoader.isPushToTalkEnabled() && currentConfig) {
          const meta = addonLoader.getActiveMetadata();
          const ttsStatus = addonLoader.isTTSEnabled() ? 'TTS on' : 'TTS off';
          console.log(chalk.dim(`[${meta?.displayName || addonName}] Push-to-talk mode: Cmd+Option to speak (${ttsStatus})`));
          stopSession(currentConfig);
        }
        isInitMode = false;
        return;
      }

      // Try addon action FIRST (addon can override general actions like 'find')
      if (currentMode === 'addon' && addonLoader) {
        const result = addonLoader.executeAction(action, null);
        if (result === true) {
          playBeep();
          isInitMode = false;
          return;
        } else if (typeof result === 'string') {
          // Delegate to general action
          await executeGeneralAction(result);
          isInitMode = false;
          return;
        } else if (result && typeof result === 'object') {
          // Handle special addon return values
          if (result.action === 'search_mode') {
            // Enter search mode: enable transcription, open search (Cmd+F)
            addonLoader.setTempCommandsOnly(false);
            await typerService.find();
            console.log(chalk.magenta('[ableton] Search mode: Type your search, say "affirmative" when done'));
            playBeep();
          } else if (result.action === 'exit_search_mode') {
            // Exit search mode: disable transcription, optionally stop listening
            addonLoader.setTempCommandsOnly(null);
            playBeep();
            if (result.stopListening && currentConfig) {
              stopSession(currentConfig);
            }
          }
          isInitMode = false;
          return;
        }
        // result was false, fall through to general action
      }

      // Try general action
      const handled = await executeGeneralAction(action);
      if (handled) {
        isInitMode = false;
        return;
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
            // In Claude mode, pause listening after submit
            if (currentMode === 'claude' && currentConfig) {
              console.log(chalk.cyan('[claude mode] Pausing listening - waiting for response...'));
              stopSession(currentConfig);
            }
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
    // In commandsOnly mode (e.g., Ableton), don't type any text
    if (addonLoader && addonLoader.isCommandsOnly()) {
      console.log(chalk.dim(`[commands-only] Ignoring text: "${text}"`));
      return;
    }

    if (pendingTimeout) {
      clearTimeout(pendingTimeout);
    }
    pendingText += (pendingText ? ' ' : '') + text;

    pendingTimeout = setTimeout(async () => {
      if (pendingText && sessionActive) {
        let typedText = pendingText + ' ';

        // In Ableton search mode, strip punctuation (it interferes with search)
        if (currentMode === 'addon' && addonLoader) {
          const addon = addonLoader.getActive();
          if (addon && addon.isSearchMode && addon.isSearchMode()) {
            typedText = typedText.replace(/[.,!?;:'"()\[\]{}]/g, '') + ' ';
            console.log(chalk.dim(`[search mode] Stripped punctuation: "${typedText.trim()}"`));
          }
        }

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

  await initializeServices(config);

  process.on('SIGINT', () => {
    stopSession(config);
    hotkeyService.stop();
    if (addonLoader) addonLoader.deactivate();
    process.exit(0);
  });

  // List available addons
  const addons = addonLoader.list();
  if (addons.length > 0) {
    console.log(chalk.dim(`Addons: ${addons.map(a => a.displayName || a.name).join(', ')}`));
  }

  console.log(`Ready. Press ${config.formatHotkey()} to speak. Ctrl+C to quit.`);
  console.log(chalk.dim('As you speak, transcription will appear in real time at your cursor, so place it where you want to type.'));
  console.log(chalk.dim("Tap CTRL to quick-toggle (stops & submits). Press SPACEBAR to stop TTS."));
  hotkeyService.on('toggle', () => (sessionActive ? stopSession(config) : startSession(config)));

  // Ctrl tap: quick toggle that also submits (presses Enter) when stopping
  hotkeyService.on('ctrl_tap', async () => {
    if (sessionActive) {
      // Stopping - type pending text, press Enter, then stop
      console.log(chalk.magenta('[ctrl-tap] Stopping and submitting...'));

      // Type any pending text first
      if (pendingTimeout) {
        clearTimeout(pendingTimeout);
        pendingTimeout = null;
      }
      if (pendingText) {
        await typerService.typeText(pendingText + ' ');
        pendingText = '';
      }

      // Press Enter to submit
      await typerService.pressEnter();

      // Stop listening
      stopSession(config);
    } else {
      // Starting
      console.log(chalk.magenta('[ctrl-tap] Starting to listen...'));
      startSession(config);
    }
  });
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
      // Signal response complete (for Claude mode - spacebar counts as "done")
      exec('touch /tmp/claude-response-done', () => {});
    }, 800);
  });

  // Push-to-talk for addon modes: Cmd+Option held = listen, released = submit
  hotkeyService.on('push_to_talk_start', () => {
    if (currentMode === 'addon' && addonLoader && addonLoader.isPushToTalkEnabled()) {
      const meta = addonLoader.getActiveMetadata();
      console.log(chalk.magenta(`[push-to-talk] Cmd+Option pressed - starting to listen`));
      if (!sessionActive) {
        startSession(config);
      }
    }
  });

  hotkeyService.on('push_to_talk_end', async () => {
    if (currentMode === 'addon' && addonLoader && addonLoader.isPushToTalkEnabled() && sessionActive) {
      const meta = addonLoader.getActiveMetadata();
      console.log(chalk.magenta(`[push-to-talk] Cmd+Option released - submitting`));

      // Type any pending text first
      if (pendingTimeout) {
        clearTimeout(pendingTimeout);
        pendingTimeout = null;
      }
      if (pendingText) {
        await typerService.typeText(pendingText + ' ');
        pendingText = '';
      }

      // Auto-submit if enabled for this addon
      if (addonLoader.isPushToTalkAutoSubmit()) {
        await typerService.pressEnter();
        playBeep();
      }

      // Stop listening
      stopSession(config);
    }
  });

  hotkeyService.start();

  // Watch for GUI commands via shared file
  const guiCommandFile = '/tmp/s2t-gui-command';
  const checkGuiCommands = () => {
    if (existsSync(guiCommandFile)) {
      try {
        const command = readFileSync(guiCommandFile, 'utf8').trim();
        exec(`rm -f ${guiCommandFile}`, () => {});

        if (command === 'toggle') {
          sessionActive ? stopSession(config) : startSession(config);
        } else if (command === 'start') {
          if (!sessionActive) startSession(config);
        } else if (command === 'stop') {
          if (sessionActive) stopSession(config);
        } else if (command === 'reload-addons') {
          // Hot-reload addon settings
          if (addonLoader) {
            addonLoader.reloadConfig();
            console.log(chalk.green('[addons] Settings reloaded'));
          }
        } else if (command === 'sync-tts') {
          // GUI toggled TTS - just log the current state (file already changed by GUI)
          const ttsEnabled = existsSync('/tmp/claude-auto-speak');
          console.log(chalk.magenta(`[TTS] ${ttsEnabled ? 'ENABLED' : 'DISABLED'} (synced from GUI)`));
        } else if (command.startsWith('mode:')) {
          const newMode = command.split(':')[1];
          if (newMode === 'general') {
            currentMode = 'general';
            console.log(chalk.cyan('[mode] Switched to general mode'));
          } else if (newMode === 'claude') {
            currentMode = 'claude';
            console.log(chalk.cyan('[mode] Switched to claude/power mode'));
          } else if (newMode === 'music' && addonLoader) {
            currentMode = 'addon';
            addonLoader.activate('ableton');
            console.log(chalk.cyan('[mode] Switched to music/addon mode'));
            // Stop listening - music mode uses push-to-talk
            if (addonLoader.isPushToTalkEnabled() && sessionActive) {
              console.log(chalk.dim('[music mode] Push-to-talk mode: Cmd+Option to speak'));
              stopSession(config);
            }
          }
        }
      } catch (e) {
        // Ignore read errors
      }
    }
  };
  setInterval(checkGuiCommands, 200);

  // Write status for GUI to read
  const updateGuiStatus = () => {
    const status = {
      listening: sessionActive,
      mode: currentMode,
      tts: existsSync('/tmp/claude-auto-speak')
    };
    writeFileSync('/tmp/s2t-status.json', JSON.stringify(status));
  };
  setInterval(updateGuiStatus, 500);

  // Auto-start listening if --auto flag was passed
  if (options.autoStart) {
    startSession(config);
  }
}

export { startApplication };
