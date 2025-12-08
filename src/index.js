import { exec, execFile, execSync } from 'child_process';

import boxen from 'boxen';
import chalk from 'chalk';

import { HotkeyService } from './services/hotkey.js';
import { PermissionService } from './services/permission.js';
import { TranscriberService } from './services/transcriber.js';
import { TyperService } from './services/typer.js';
import { AddonLoader } from './services/addon-loader.js';
import { createIntentResolverAsync, commandDictionary } from './services/intent-resolver.js';
import { migrateFromConfig, getAnthropicKey } from './services/secrets.js';
import { learningLoop } from './services/learning-loop.js';
import { trainingMode } from './services/training-mode.js';
import defaultCommandsData from './data/default_commands.json' with { type: 'json' };

let sessionActive = false;
let hotkeyService, transcriberService, typerService, addonLoader;

// AI Intent Resolver for understanding natural speech commands
let intentResolver = null;
let aiUnderstandingEnabled = false;

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
import { homedir } from 'os';
import { join } from 'path';

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

// Focus detection - commands-only when not in text field
let smartCommandsOnly = false; // Global setting for auto commands-only mode
let lastFocusCheck = 0;
let cachedIsTextInput = true; // Cache result, default to true (allow typing)
const FOCUS_CHECK_INTERVAL = 200; // Check focus every 200ms max

// Reset focus cache - call when smart mode changes to force fresh check
function resetFocusCache() {
  lastFocusCheck = 0;
  cachedIsTextInput = true;
}

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

  // Smart commands-only mode (focus detection)
  'computer smart mode on': 'smart_commands_on',
  'computer smart mode off': 'smart_commands_off',
  'computer focus mode on': 'smart_commands_on',
  'computer focus mode off': 'smart_commands_off',

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

  // Training mode (Phase 2.2)
  'computer learn': 'training_learn',
  'computer training mode': 'training_learn',
  'computer teach you': 'training_learn',
  'computer teach': 'training_learn',

  // Training commands (Phase 2.3)
  'computer what have i taught you': 'training_list',
  'computer what did i teach you': 'training_list',
  'computer list learned': 'training_list',
  'computer show learned': 'training_list',
};

// Dynamic patterns for general mode (Phase 2.3)
const GENERAL_PATTERNS = [
  {
    pattern: /^computer\s+forget\s+(.+)$/i,
    action: 'training_forget',
    extract: (match) => ({ phrase: match[1] })
  },
  {
    pattern: /^computer\s+what\s+does\s+(.+?)\s+do\??$/i,
    action: 'training_query',
    extract: (match) => ({ phrase: match[1] })
  }
];

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
  const patterns = [...GENERAL_PATTERNS]; // Always include general patterns

  if (currentMode === 'addon' && addonLoader) {
    patterns.push(...addonLoader.getActivePatterns());
  }

  return patterns;
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

// Audio settings config path
const AUDIO_CONFIG_FILE = join(homedir(), '.config', 'speech2type', 'config.json');

// Sound preset to file path mapping
const SOUND_PRESETS = {
  'pop': '/System/Library/Sounds/Pop.aiff',
  'glass': '/System/Library/Sounds/Glass.aiff',
  'ping': '/System/Library/Sounds/Ping.aiff',
  'hero': '/System/Library/Sounds/Hero.aiff',
  'funk': '/System/Library/Sounds/Funk.aiff',
  'purr': '/System/Library/Sounds/Purr.aiff',
  'submarine': '/System/Library/Sounds/Submarine.aiff',
  'morse': '/System/Library/Sounds/Morse.aiff',
  'basso': '/System/Library/Sounds/Basso.aiff',
  'blow': '/System/Library/Sounds/Blow.aiff',
  'bottle': '/System/Library/Sounds/Bottle.aiff',
  'frog': '/System/Library/Sounds/Frog.aiff',
  'sosumi': '/System/Library/Sounds/Sosumi.aiff',
  'tink': '/System/Library/Sounds/Tink.aiff'
};

// Default sounds for each event type
const DEFAULT_SOUNDS = {
  start: '/System/Library/Sounds/Pop.aiff',
  stop: '/System/Library/Sounds/Morse.aiff',
  typing: '/System/Library/Sounds/Tink.aiff',
  command: '/System/Library/Sounds/Funk.aiff',
  error: '/System/Library/Sounds/Basso.aiff',
  mode: '/System/Library/Sounds/Glass.aiff',
  ttsStart: '/System/Library/Sounds/Purr.aiff',
  ttsStop: '/System/Library/Sounds/Blow.aiff'
};

// Get audio settings from config file
function getAudioSettings() {
  try {
    if (existsSync(AUDIO_CONFIG_FILE)) {
      const config = JSON.parse(readFileSync(AUDIO_CONFIG_FILE, 'utf8'));
      return config.audio || {};
    }
  } catch (e) {
    // Ignore errors, use defaults
  }
  return {};
}

// Get AI understanding settings from config file
function getAISettings() {
  try {
    if (existsSync(AUDIO_CONFIG_FILE)) {
      const config = JSON.parse(readFileSync(AUDIO_CONFIG_FILE, 'utf8'));
      return {
        enabled: config.aiUnderstandingEnabled || false,
        mode: config.aiUnderstandingMode || 'auto',
        apiKey: config.anthropicApiKey || null
      };
    }
  } catch (e) {
    // Ignore errors, use defaults
  }
  return { enabled: false, mode: 'auto', apiKey: null };
}

// Initialize the AI Intent Resolver based on settings (async for keychain access)
async function initializeIntentResolver() {
  // Always initialize command dictionary (even if AI is disabled)
  await commandDictionary.load();

  // Migrate default commands if dictionary is empty
  if (commandDictionary.isEmpty()) {
    await commandDictionary.migrateDefaults(defaultCommandsData.commands);
  }

  const aiSettings = getAISettings();
  aiUnderstandingEnabled = aiSettings.enabled;

  if (!aiUnderstandingEnabled) {
    intentResolver = null;
    return;
  }

  try {
    // Use async version that checks keychain for API key
    intentResolver = await createIntentResolverAsync({
      mode: aiSettings.mode === 'auto' ? undefined : aiSettings.mode,
      apiKey: aiSettings.apiKey  // Falls through to keychain if not set
    });
    console.log(chalk.cyan(`[ai] Intent resolver initialized (${intentResolver.mode} mode)`));
  } catch (e) {
    console.error(chalk.yellow(`[ai] Failed to initialize intent resolver: ${e.message}`));
    intentResolver = null;
  }

  // Initialize learning loop callbacks
  learningLoop.setCallbacks({
    onSpeak: async (text) => {
      // Simple TTS using macOS say command
      exec(`say -v Samantha -r 180 "${text.replace(/"/g, '\\"')}"`, () => {});
    },
    onExecute: async (action) => {
      // Execute an action from the learning loop (e.g., after confirmation)
      const mappedAction = AI_ACTION_MAP[action];
      if (mappedAction) {
        await executeGeneralAction(mappedAction);
        playBeep();
      }
    },
    onStateChange: (newState, oldState) => {
      // Optional: track state changes for debugging
      console.log(chalk.dim(`[learning] State: ${oldState} -> ${newState}`));
    }
  });

  // Initialize training mode callbacks
  trainingMode.setCallbacks({
    onSpeak: async (text) => {
      // Use TTS with lock to prevent transcript pickup
      exec(`touch /tmp/claude-tts-speaking && say -v Samantha -r 180 "${text.replace(/"/g, '\\"')}" && rm -f /tmp/claude-tts-speaking &`, () => {});
    },
    onExecute: async (action) => {
      // Execute an action from training mode
      const mappedAction = AI_ACTION_MAP[action];
      if (mappedAction) {
        await executeGeneralAction(mappedAction);
        playBeep();
      }
    },
    onStateChange: (newState, oldState) => {
      console.log(chalk.magenta(`[training] State: ${oldState} -> ${newState}`));
    }
  });
}

// Action mapping from IntentResolver actions to our internal actions
const AI_ACTION_MAP = {
  'enter': 'enter',
  'undo': 'undo',
  'clear_all': 'clear_all',
  'copy': 'copy',
  'paste': 'paste',
  'cut': 'cut',
  'select_all': 'select_all',
  'scroll_up': 'scroll_up',
  'scroll_down': 'scroll_down',
  'page_up': 'page_up',
  'page_down': 'page_down',
  'new_tab': 'new_tab',
  'close_tab': 'close_tab',
  'volume_up': 'volume_up',
  'volume_down': 'volume_down',
  'mute': 'mute',
  'stop_listening': 'stop_listening',
  'start_listening': 'start_listening',
  'mode_general': 'mode_general',
  'mode_claude': 'mode_claude',
  'mode_music': 'mode_addon_ableton',
  'tts_on': 'tts_on',
  'tts_off': 'tts_off',
  'smart_mode_on': 'smart_commands_on',
  'smart_mode_off': 'smart_commands_off',
  'focus_app': 'focus_app'  // Special - needs target
};

// Get sound file path for an event
function getSoundFile(eventType) {
  const audio = getAudioSettings();
  const preset = audio[eventType + 'Preset'];
  const custom = audio[eventType + 'Custom'];

  if (custom) return custom;
  if (preset && preset !== 'default' && SOUND_PRESETS[preset]) {
    return SOUND_PRESETS[preset];
  }
  return DEFAULT_SOUNDS[eventType];
}

// Check if a sound event is enabled
function isSoundEnabled(eventType) {
  const audio = getAudioSettings();
  if (audio.enabled === false) return false;
  // Default to true for most events, false for TTS events
  const defaultEnabled = !eventType.startsWith('tts');
  return audio[eventType + 'Enabled'] !== false && (audio[eventType + 'Enabled'] === true || defaultEnabled);
}

// Get volume (0-100) as afplay volume (0-1 range, scaled)
function getVolume(baseVolume = 0.25) {
  const audio = getAudioSettings();
  const volume = audio.volume ?? 100;
  return (volume / 100) * baseVolume;
}

// Generic sound player
function playSound(eventType, baseVolume = 0.25, rateFlag = '') {
  if (!isSoundEnabled(eventType)) {
    if (eventType !== 'typing') { // Don't spam logs for typing
      console.log(`[audio] ${eventType} sound disabled - skipping`);
    }
    return;
  }
  const soundFile = getSoundFile(eventType);
  const volume = getVolume(baseVolume);
  console.log(`[audio] Playing ${eventType} sound (${Math.round(getAudioSettings().volume ?? 100)}%)`);
  exec(`afplay -v ${volume} ${rateFlag} "${soundFile}" &`, () => {});
}

// Play a soft beep for audio feedback
function playBeep() {
  playSound('command', 0.3);
}

// Play subtle typing sounds (always 2 taps)
function playTypingSound() {
  if (!isSoundEnabled('typing')) return;
  const soundFile = getSoundFile('typing');
  const volume = getVolume(0.12);
  exec(`afplay -v ${volume} "${soundFile}" &`, () => {});
  setTimeout(() => {
    exec(`afplay -v ${volume} "${soundFile}" &`, () => {});
  }, 70);
}

// Play command recognized sound
function playCommandSound() {
  playSound('command', 0.25);
}

// Play error sound
function playErrorSound() {
  playSound('error', 0.3);
}

// Play mode switch sound
function playModeSound() {
  playSound('mode', 0.25);
}

// Play TTS start sound
function playTTSStartSound() {
  playSound('ttsStart', 0.2);
}

// Play TTS stop sound
function playTTSStopSound() {
  playSound('ttsStop', 0.2);
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

// Focus detection - check if currently focused element is a text input
let focusCheckerPath = null;

function initFocusChecker(config) {
  focusCheckerPath = join(config.projectRoot, 'bin', 'focus-checker');
}

function checkIsTextInput() {
  // Rate limit focus checks
  const now = Date.now();
  if (now - lastFocusCheck < FOCUS_CHECK_INTERVAL) {
    return cachedIsTextInput;
  }
  lastFocusCheck = now;

  // If smart commands-only is disabled, always allow typing
  if (!smartCommandsOnly) {
    return true;
  }

  // If focus checker not available, default to allowing typing
  if (!focusCheckerPath || !existsSync(focusCheckerPath)) {
    console.log(chalk.yellow(`[focus] focus-checker not found at ${focusCheckerPath}`));
    return true;
  }

  try {
    const result = execSync(focusCheckerPath, {
      encoding: 'utf8',
      timeout: 100,
      stdio: ['pipe', 'pipe', 'pipe']
    });
    const data = JSON.parse(result);

    // Check for accessibility permission error
    if (data.error === 'accessibility_not_granted') {
      console.log(chalk.yellow(`[focus] Accessibility permission needed for Speech2Type`));
      console.log(chalk.yellow(`[focus] Grant permission in System Settings > Privacy & Security > Accessibility`));
      console.log(chalk.dim(`[focus] Frontmost app: ${data.appName || 'unknown'}`));
      // Disable smart mode automatically when accessibility isn't available
      smartCommandsOnly = false;
      return true;
    }

    // Check for permission error on the focused element (can still get app name)
    if (data.error === 'accessibility_permission_needed') {
      console.log(chalk.yellow(`[focus] Can't detect focused element - permission issue`));
      console.log(chalk.dim(`[focus] App: ${data.appName || 'unknown'}, debug: ${data.debug}`));
      return true;
    }

    const prevValue = cachedIsTextInput;
    cachedIsTextInput = data.isTextInput === true;

    // Always log focus check results when smart mode is active
    console.log(chalk.dim(`[focus] isTextInput: ${cachedIsTextInput}, role: "${data.role || ''}", subrole: "${data.subrole || ''}", app: "${data.appName || ''}", editable: ${data.isEditable || false}`));

    if (prevValue !== cachedIsTextInput) {
      console.log(chalk.cyan(`[focus] State changed: ${prevValue} → ${cachedIsTextInput}`));
    }

    return cachedIsTextInput;
  } catch (e) {
    // Try to parse output even on error exit code
    try {
      const stderr = e.stderr?.toString() || '';
      const stdout = e.stdout?.toString() || '';
      const output = stdout || stderr;
      if (output) {
        const data = JSON.parse(output);
        if (data.error === 'accessibility_not_granted') {
          console.log(chalk.yellow(`[focus] Accessibility permission required for Smart Mode`));
          console.log(chalk.dim(`[focus] App: ${data.appName || 'unknown'}`));
          smartCommandsOnly = false;
          return true;
        }
      }
    } catch (parseErr) {
      // Ignore parse errors
    }
    console.log(chalk.red(`[focus] Error checking focus: ${e.message}`));
    // On error, default to allowing typing
    return true;
  }
}

// Check if commands-only mode is active (either addon setting or smart mode)
function isCommandsOnlyActive() {
  // Check addon-level commands-only first
  if (addonLoader && addonLoader.isCommandsOnly()) {
    return true;
  }

  // Check smart commands-only (focus-based)
  if (smartCommandsOnly && !checkIsTextInput()) {
    return true;
  }

  return false;
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
  playSound('start', 0.25, '-r 1.5');
}

function playStopSound() {
  playSound('stop', 0.12, '-r 0.7');
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

  // Initialize focus checker for smart commands-only mode
  initFocusChecker(config);

  // Load smart commands-only setting from config
  const audioSettings = getAudioSettings();
  smartCommandsOnly = audioSettings.smartCommandsOnly === true;
  if (smartCommandsOnly) {
    console.log(chalk.cyan('[focus] Smart commands-only mode enabled - will detect text inputs'));
  }
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
    case 'smart_commands_on':
      smartCommandsOnly = true;
      resetFocusCache();
      console.log(chalk.cyan('[smart mode] ON - Commands only when not in text field'));
      playBeep();
      return true;
    case 'smart_commands_off':
      smartCommandsOnly = false;
      resetFocusCache();
      console.log(chalk.yellow('[smart mode] OFF - Always allow typing'));
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
      playModeSound();
      return true;
    case 'mode_claude':
      currentMode = 'claude';
      if (addonLoader) addonLoader.deactivate();
      startClaudeModeWatcher(currentConfig);
      // TTS on by default in Claude mode
      exec('touch /tmp/claude-auto-speak', () => {});
      console.log(chalk.cyan.bold('[mode] Switched to CLAUDE mode - TTS on, listening pauses after submit'));
      playModeSound();
      // Soft welcome voice - use TTS lock to prevent mic pickup
      exec('touch /tmp/claude-tts-speaking && say -v Samantha -r 180 "welcome" && rm -f /tmp/claude-tts-speaking &', () => {});
      return true;
    case 'training_learn':
      // Enter training mode
      await trainingMode.enter();
      playBeep();
      return true;

    case 'training_list':
      // List all learned commands
      const allCommands = commandDictionary.getAllCommands();
      const learnedCommands = allCommands.filter(cmd => cmd.source === 'learned');

      if (learnedCommands.length === 0) {
        console.log(chalk.yellow('[training] You haven\'t taught me anything yet'));
        exec('say -v Samantha -r 180 "You haven\'t taught me anything yet"', () => {});
      } else {
        console.log(chalk.cyan(`[training] You've taught me ${learnedCommands.length} commands:`));
        learnedCommands.forEach(cmd => {
          console.log(chalk.dim(`  - ${cmd.phrases.join(', ')} → ${cmd.action}`));
        });

        // Voice summary
        const summary = `You've taught me ${learnedCommands.length} custom ${learnedCommands.length === 1 ? 'command' : 'commands'}`;
        exec(`say -v Samantha -r 180 "${summary}"`, () => {});
      }
      playBeep();
      return true;

    case 'training_forget':
      // This will be called with params.phrase from pattern match
      // Handler is in the pattern matching section below
      return false; // Let it be handled in pattern matching

    case 'training_query':
      // This will be called with params.phrase from pattern match
      // Handler is in the pattern matching section below
      return false; // Let it be handled in pattern matching

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

    // Check if training mode is active and handle speech there
    if (trainingMode.isActive()) {
      const handled = await trainingMode.handleSpeech(text);
      if (handled) {
        return;
      }
    }

    // Check for corrections first (learning loop)
    const correctionHandled = await learningLoop.handleSpeech(cleanText);
    if (correctionHandled) {
      console.log(chalk.yellow(`[learning] Handled as correction/feedback`));
      return;
    }

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

    // Check dynamic patterns (general patterns + addon patterns)
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

        const params = extract(match);

        // Handle general training commands
        if (action === 'training_forget') {
          const phrase = params.phrase;
          const success = await commandDictionary.forget(phrase);
          if (success) {
            console.log(chalk.green(`[training] Forgot: "${phrase}"`));
            exec(`say -v Samantha -r 180 "Okay, I've forgotten ${phrase}"`, () => {});
          } else {
            console.log(chalk.yellow(`[training] I don't know: "${phrase}"`));
            exec(`say -v Samantha -r 180 "I don't know that phrase"`, () => {});
          }
          playBeep();
          return;
        } else if (action === 'training_query') {
          const phrase = params.phrase;
          const result = commandDictionary.lookup(phrase);
          if (result) {
            console.log(chalk.cyan(`[training] "${phrase}" → ${result.action} (${result.tier === 1 ? 'exact' : 'fuzzy'} match, confidence: ${result.confidence.toFixed(2)})`));
            const response = `${phrase} does ${result.action}`;
            exec(`say -v Samantha -r 180 "${response}"`, () => {});
          } else {
            console.log(chalk.yellow(`[training] I don't know: "${phrase}"`));
            exec(`say -v Samantha -r 180 "I don't know what ${phrase} does"`, () => {});
          }
          playBeep();
          return;
        }

        // Handle addon patterns
        if (currentMode === 'addon' && addonLoader) {
          const addonMeta = addonLoader.getActiveMetadata();
          console.log(chalk.magenta(`[${addonMeta?.name || 'addon'}] ${action} → ${JSON.stringify(params)}`));

          const result = addonLoader.executeAction(action, params);
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

        // Track undo for learning loop (potential negative feedback)
        await learningLoop.handleImmediateUndo();

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
        playModeSound();

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

    // AI Understanding fallback - try to interpret natural speech as commands
    // Only for short phrases that might be commands (under 8 words)
    if (intentResolver && aiUnderstandingEnabled && cleanText.split(' ').length <= 7) {
      // Use heuristic check first (no API call)
      if (intentResolver.looksLikeCommand(cleanText)) {
        console.log(chalk.dim(`[ai] Checking: "${cleanText}"...`));
        try {
          // Use tiered resolution: Dictionary (Tier 1+2) first, then AI (Tier 3)
          const result = await intentResolver.resolveWithDictionary(cleanText, {
            appName: currentMode === 'addon' ? addonLoader?.getActiveMetadata()?.displayName : null
          });

          // Log tier info for debugging
          const tierInfo = result.tier ? `tier ${result.tier}` : 'cache';

          // Check if we should ask for confirmation (50-70% confidence)
          if (result.action !== 'none' && result.action !== 'unknown' &&
              result.confidence >= 0.5 && result.confidence < 0.7) {
            console.log(chalk.yellow(`[ai] Low confidence "${cleanText}" → ${result.action} (${Math.round(result.confidence * 100)}%, ${tierInfo})`));

            // Ask user for confirmation via learning loop
            const actionDescription = AI_ACTION_MAP[result.action] || result.action;
            await learningLoop.askForConfirmation(cleanText, result.action, result.confidence, actionDescription);
            return;
          }

          // Only act on high-confidence results (>= 70%)
          if (result.action !== 'none' && result.action !== 'unknown' && result.confidence >= 0.7) {
            const mappedAction = AI_ACTION_MAP[result.action];
            if (mappedAction) {
              console.log(chalk.cyan(`[ai] Understood "${cleanText}" → ${result.action} (${Math.round(result.confidence * 100)}%, ${tierInfo}, ${result.latencyMs}ms)`));

              // Clear any pending
              if (pendingTimeout) {
                clearTimeout(pendingTimeout);
                pendingTimeout = null;
              }
              if (pendingText) {
                await typerService.typeText(pendingText + ' ');
                typedHistory.push((pendingText + ' ').length);
                if (typedHistory.length > MAX_UNDO_HISTORY) typedHistory.shift();
                pendingText = '';
              }

              // Handle focus_app specially (needs target)
              if (result.action === 'focus_app' && result.target) {
                const appName = matchAppName(result.target);
                console.log(chalk.green(`[ai] Focus app: "${result.target}" → ${appName}`));
                await typerService.focusApp(appName);
                playBeep();
                return;
              }

              // Execute the action
              await executeGeneralAction(mappedAction);
              playBeep();

              // Track action for learning loop (observe for implicit feedback)
              await learningLoop.observeAction(cleanText, result.action, result.confidence, result.tier || 3);

              return;
            }
          } else if (result.action === 'none') {
            console.log(chalk.dim(`[ai] "${cleanText}" is dictation, not a command`));
          }
        } catch (e) {
          console.error(chalk.dim(`[ai] Error: ${e.message}`));
        }
      }
    }

    // No command found - buffer the text briefly in case a command follows
    // In commandsOnly mode (addon setting or smart focus-based), don't type any text
    if (isCommandsOnlyActive()) {
      const reason = (addonLoader && addonLoader.isCommandsOnly())
        ? 'addon commands-only'
        : 'not in text field';
      console.log(chalk.dim(`[commands-only] Ignoring text (${reason}): "${text}"`));
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

  // Migrate API keys from config.json to Keychain (one-time)
  const migration = await migrateFromConfig();
  if (migration.migrated.length > 0) {
    console.log(chalk.green(`[secrets] Migrated ${migration.migrated.length} key(s) to macOS Keychain`));
  }

  await initializeServices(config);

  // Initialize AI Intent Resolver (if enabled in settings)
  await initializeIntentResolver();

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
  // Only enabled for addon modes (not general or claude)
  hotkeyService.on('ctrl_tap', async () => {
    // Skip ctrl tap in general and claude modes
    if (currentMode === 'general' || currentMode === 'claude') {
      console.log(chalk.dim('[ctrl-tap] Disabled in general/claude mode'));
      return;
    }

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
  const checkGuiCommands = async () => {
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
        } else if (command === 'reload-ai') {
          // Hot-reload AI understanding settings
          await initializeIntentResolver();
        } else if (command === 'sync-tts') {
          // GUI toggled TTS - just log the current state (file already changed by GUI)
          const ttsEnabled = existsSync('/tmp/claude-auto-speak');
          console.log(chalk.magenta(`[TTS] ${ttsEnabled ? 'ENABLED' : 'DISABLED'} (synced from GUI)`));
        } else if (command === 'smart-commands-on') {
          smartCommandsOnly = true;
          resetFocusCache();
          console.log(chalk.cyan('[smart mode] ON - Commands only when not in text field (from GUI)'));
        } else if (command === 'smart-commands-off') {
          smartCommandsOnly = false;
          resetFocusCache();
          console.log(chalk.yellow('[smart mode] OFF - Always allow typing (from GUI)'));
        } else if (command.startsWith('mode:')) {
          const newMode = command.split(':')[1];
          if (newMode === 'general') {
            currentMode = 'general';
            stopClaudeModeWatcher();
            if (addonLoader) addonLoader.deactivate();
            console.log(chalk.cyan('[mode] Switched to general mode'));
          } else if (newMode === 'claude') {
            currentMode = 'claude';
            if (addonLoader) addonLoader.deactivate();
            startClaudeModeWatcher(currentConfig);
            console.log(chalk.cyan('[mode] Switched to claude/power mode'));
          } else if (newMode === 'music' && addonLoader) {
            stopClaudeModeWatcher();
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
      tts: existsSync('/tmp/claude-auto-speak'),
      smartCommandsOnly: smartCommandsOnly,
      aiEnabled: aiUnderstandingEnabled,
      aiMode: intentResolver?.mode || null
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
