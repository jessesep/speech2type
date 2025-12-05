/**
 * Ableton Live Addon for speech2type
 *
 * Control Ableton Live with voice commands via OSC.
 * Requires AbletonOSC: https://github.com/ideoforms/AbletonOSC
 */

import { Client } from 'node-osc';
import chalk from 'chalk';

// Addon metadata
export const metadata = {
  name: 'ableton',
  displayName: 'Ableton Live',
  version: '1.0.0',
  description: 'Voice control for Ableton Live via OSC',
  author: 'speech2type',
  modeCommand: 'music mode',  // "computer music mode" activates this addon
  modeAliases: [
    // Ableton tonal variations (speech recognition mishears)
    'ableton mode',
    'able ton mode',
    'able to mode',
    'able turn mode',
    'ablton mode',
    'abelton mode',
    'ableten mode',
    'able ten mode',
  ],
  pushToTalk: true,  // Enable push-to-talk behavior (Cmd+Option)
  pushToTalkAutoSubmit: true,  // Auto-submit on release
};

// OSC Configuration
const OSC_HOST = '127.0.0.1';
const OSC_PORT = 11000;

// OSC Client
let client = null;
let connected = false;

/**
 * Initialize the addon
 * Called when the addon is loaded or when switching to this mode
 */
export function init() {
  if (client) return;

  try {
    client = new Client(OSC_HOST, OSC_PORT);
    connected = true;
    console.log(chalk.green(`[ableton] Connected to OSC port ${OSC_PORT}`));
  } catch (error) {
    console.error(chalk.red(`[ableton] Failed to connect: ${error.message}`));
    connected = false;
  }
}

/**
 * Cleanup the addon
 * Called when switching away from this mode or shutting down
 */
export function cleanup() {
  if (client) {
    client.close();
    client = null;
    connected = false;
    console.log(chalk.dim('[ableton] Disconnected'));
  }
}

/**
 * Send OSC message
 */
function send(address, ...args) {
  if (!client) init();

  if (client) {
    console.log(chalk.blue(`[ableton] OSC: ${address} ${args.join(' ')}`));
    client.send(address, ...args, (err) => {
      if (err) {
        console.error(chalk.red(`[ableton] OSC error: ${err.message}`));
      }
    });
  }
}

// ============================================================================
// COMMANDS - Static phrase mappings
// ============================================================================

/**
 * Static commands - exact phrase matches
 * Key: spoken phrase (without "computer" prefix - it's added automatically)
 * Value: action identifier
 *
 * BEST PRACTICES:
 * - Add 3-5 variations per command for speech recognition reliability
 * - Include common mishearings and synonyms
 * - Consider natural speech patterns
 */
export const commands = {
  // Transport - play
  'play': 'play',
  'start': 'play',
  'go': 'play',
  'playing': 'play',

  // Transport - stop
  'stop': 'stop',
  'pause': 'stop',
  'halt': 'stop',

  // Transport - continue
  'continue': 'continue',
  'resume': 'continue',

  // Transport - record
  'record': 'record',
  'recording': 'record',
  'rec': 'record',
  'start recording': 'record',

  // Transport - overdub
  'overdub': 'overdub',
  'over dub': 'overdub',

  // Transport - tap tempo
  'tap': 'tap_tempo',
  'tap tempo': 'tap_tempo',
  'tempo tap': 'tap_tempo',

  // Transport - undo/redo
  'undo': 'undo',
  'redo': 'redo',

  // Metronome - many variations
  'metronome': 'metronome_toggle',
  'metronome on': 'metronome_on',
  'metronome off': 'metronome_off',
  'toggle metronome': 'metronome_toggle',
  'click': 'metronome_toggle',
  'click on': 'metronome_on',
  'click off': 'metronome_off',
  'toggle click': 'metronome_toggle',

  // Loop - many variations
  'loop': 'loop_toggle',
  'loop on': 'loop_on',
  'loop off': 'loop_off',
  'toggle loop': 'loop_toggle',
  'looping': 'loop_toggle',

  // Stop all clips
  'stop all': 'stop_all',
  'stop all clips': 'stop_all',
  'stop clips': 'stop_all',
  'stop everything': 'stop_all',

  // Navigation
  'next cue': 'next_cue',
  'previous cue': 'prev_cue',
  'next marker': 'next_cue',
  'previous marker': 'prev_cue',
  'cue next': 'next_cue',
  'cue previous': 'prev_cue',

  // Create tracks
  'new audio track': 'create_audio',
  'create audio track': 'create_audio',
  'add audio track': 'create_audio',
  'new midi track': 'create_midi',
  'create midi track': 'create_midi',
  'add midi track': 'create_midi',
  'new return track': 'create_return',
  'create return track': 'create_return',
  'add return track': 'create_return',

  // Scene management
  'new scene': 'create_scene',
  'create scene': 'create_scene',
  'add scene': 'create_scene',

  // Capture MIDI
  'capture': 'capture_midi',
  'capture midi': 'capture_midi',

  // Common shortcuts (also available in this mode)
  'find': 'find',
  'search': 'find',
};

// ============================================================================
// PATTERNS - Dynamic commands with parameters
// ============================================================================

/**
 * Dynamic patterns - regex matches for parameterized commands
 *
 * Each pattern has:
 * - pattern: RegExp (without "computer" prefix - it's added automatically)
 * - action: action identifier
 * - extract: function to extract parameters from match
 */
export const patterns = [
  // Tempo variations
  { pattern: /^tempo\s+(\d+)$/, action: 'tempo', extract: (m) => parseInt(m[1]) },
  { pattern: /^set\s+tempo\s+(\d+)$/, action: 'tempo', extract: (m) => parseInt(m[1]) },
  { pattern: /^bpm\s+(\d+)$/, action: 'tempo', extract: (m) => parseInt(m[1]) },
  { pattern: /^(\d+)\s+bpm$/, action: 'tempo', extract: (m) => parseInt(m[1]) },

  // Scene variations
  { pattern: /^scene\s+(\d+)$/, action: 'scene', extract: (m) => parseInt(m[1]) },
  { pattern: /^fire\s+scene\s+(\d+)$/, action: 'scene', extract: (m) => parseInt(m[1]) },
  { pattern: /^launch\s+scene\s+(\d+)$/, action: 'scene', extract: (m) => parseInt(m[1]) },
  { pattern: /^play\s+scene\s+(\d+)$/, action: 'scene', extract: (m) => parseInt(m[1]) },

  // Mute variations - "mute track 1", "mute 1", "track 1 mute"
  { pattern: /^mute\s+track\s+(\d+)$/, action: 'mute', extract: (m) => parseInt(m[1]) },
  { pattern: /^mute\s+(\d+)$/, action: 'mute', extract: (m) => parseInt(m[1]) },
  { pattern: /^track\s+(\d+)\s+mute$/, action: 'mute', extract: (m) => parseInt(m[1]) },

  // Unmute variations
  { pattern: /^unmute\s+track\s+(\d+)$/, action: 'unmute', extract: (m) => parseInt(m[1]) },
  { pattern: /^unmute\s+(\d+)$/, action: 'unmute', extract: (m) => parseInt(m[1]) },
  { pattern: /^un\s*mute\s+track\s+(\d+)$/, action: 'unmute', extract: (m) => parseInt(m[1]) },
  { pattern: /^track\s+(\d+)\s+unmute$/, action: 'unmute', extract: (m) => parseInt(m[1]) },

  // Solo variations
  { pattern: /^solo\s+track\s+(\d+)$/, action: 'solo', extract: (m) => parseInt(m[1]) },
  { pattern: /^solo\s+(\d+)$/, action: 'solo', extract: (m) => parseInt(m[1]) },
  { pattern: /^track\s+(\d+)\s+solo$/, action: 'solo', extract: (m) => parseInt(m[1]) },

  // Unsolo variations
  { pattern: /^unsolo\s+track\s+(\d+)$/, action: 'unsolo', extract: (m) => parseInt(m[1]) },
  { pattern: /^unsolo\s+(\d+)$/, action: 'unsolo', extract: (m) => parseInt(m[1]) },
  { pattern: /^un\s*solo\s+track\s+(\d+)$/, action: 'unsolo', extract: (m) => parseInt(m[1]) },
  { pattern: /^track\s+(\d+)\s+unsolo$/, action: 'unsolo', extract: (m) => parseInt(m[1]) },

  // Arm variations
  { pattern: /^arm\s+track\s+(\d+)$/, action: 'arm', extract: (m) => parseInt(m[1]) },
  { pattern: /^arm\s+(\d+)$/, action: 'arm', extract: (m) => parseInt(m[1]) },
  { pattern: /^track\s+(\d+)\s+arm$/, action: 'arm', extract: (m) => parseInt(m[1]) },
  { pattern: /^record\s+arm\s+(\d+)$/, action: 'arm', extract: (m) => parseInt(m[1]) },

  // Disarm variations
  { pattern: /^disarm\s+track\s+(\d+)$/, action: 'disarm', extract: (m) => parseInt(m[1]) },
  { pattern: /^disarm\s+(\d+)$/, action: 'disarm', extract: (m) => parseInt(m[1]) },
  { pattern: /^dis\s*arm\s+track\s+(\d+)$/, action: 'disarm', extract: (m) => parseInt(m[1]) },
  { pattern: /^track\s+(\d+)\s+disarm$/, action: 'disarm', extract: (m) => parseInt(m[1]) },
  { pattern: /^unarm\s+track\s+(\d+)$/, action: 'disarm', extract: (m) => parseInt(m[1]) },
  { pattern: /^unarm\s+(\d+)$/, action: 'disarm', extract: (m) => parseInt(m[1]) },

  // Select track variations
  { pattern: /^select\s+track\s+(\d+)$/, action: 'select_track', extract: (m) => parseInt(m[1]) },
  { pattern: /^track\s+(\d+)$/, action: 'select_track', extract: (m) => parseInt(m[1]) },
  { pattern: /^go\s+to\s+track\s+(\d+)$/, action: 'select_track', extract: (m) => parseInt(m[1]) },

  // Volume variations
  { pattern: /^volume\s+track\s+(\d+)\s+(\d+)$/, action: 'volume', extract: (m) => ({ track: parseInt(m[1]), volume: parseInt(m[2]) }) },
  { pattern: /^track\s+(\d+)\s+volume\s+(\d+)$/, action: 'volume', extract: (m) => ({ track: parseInt(m[1]), volume: parseInt(m[2]) }) },

  // Delete track variations
  { pattern: /^delete\s+track\s+(\d+)$/, action: 'delete_track', extract: (m) => parseInt(m[1]) },
  { pattern: /^remove\s+track\s+(\d+)$/, action: 'delete_track', extract: (m) => parseInt(m[1]) },

  // Duplicate track variations
  { pattern: /^duplicate\s+track\s+(\d+)$/, action: 'duplicate_track', extract: (m) => parseInt(m[1]) },
  { pattern: /^copy\s+track\s+(\d+)$/, action: 'duplicate_track', extract: (m) => parseInt(m[1]) },

  // Delete scene variations
  { pattern: /^delete\s+scene\s+(\d+)$/, action: 'delete_scene', extract: (m) => parseInt(m[1]) },
  { pattern: /^remove\s+scene\s+(\d+)$/, action: 'delete_scene', extract: (m) => parseInt(m[1]) },

  // Duplicate scene variations
  { pattern: /^duplicate\s+scene\s+(\d+)$/, action: 'duplicate_scene', extract: (m) => parseInt(m[1]) },
  { pattern: /^copy\s+scene\s+(\d+)$/, action: 'duplicate_scene', extract: (m) => parseInt(m[1]) },
];

// ============================================================================
// ACTION HANDLERS
// ============================================================================

/**
 * Execute an action
 * @param {string} action - The action identifier
 * @param {any} value - Optional parameter value (from pattern extraction)
 * @returns {boolean} - True if action was handled
 */
export function execute(action, value) {
  switch (action) {
    // Transport
    case 'play':
      send('/live/song/start_playing');
      return true;
    case 'stop':
      send('/live/song/stop_playing');
      return true;
    case 'continue':
      send('/live/song/continue_playing');
      return true;
    case 'record':
      send('/live/song/trigger_session_record');
      return true;
    case 'overdub':
      send('/live/song/set/arrangement_overdub', 1);
      return true;
    case 'tap_tempo':
      send('/live/song/tap_tempo');
      return true;
    case 'undo':
      send('/live/song/undo');
      return true;
    case 'redo':
      send('/live/song/redo');
      return true;

    // Tempo
    case 'tempo':
      send('/live/song/set/tempo', parseFloat(value));
      return true;

    // Metronome
    case 'metronome_on':
      send('/live/song/set/metronome', 1);
      return true;
    case 'metronome_off':
      send('/live/song/set/metronome', 0);
      return true;
    case 'metronome_toggle':
      send('/live/song/set/metronome', 1);  // Toggle by turning on (user can say "off")
      return true;

    // Loop
    case 'loop_on':
      send('/live/song/set/loop', 1);
      return true;
    case 'loop_off':
      send('/live/song/set/loop', 0);
      return true;
    case 'loop_toggle':
      send('/live/song/set/loop', 1);
      return true;

    // Track controls (convert 1-indexed to 0-indexed)
    case 'mute':
      send('/live/track/set/mute', value - 1, 1);
      return true;
    case 'unmute':
      send('/live/track/set/mute', value - 1, 0);
      return true;
    case 'solo':
      send('/live/track/set/solo', value - 1, 1);
      return true;
    case 'unsolo':
      send('/live/track/set/solo', value - 1, 0);
      return true;
    case 'arm':
      send('/live/track/set/arm', value - 1, 1);
      return true;
    case 'disarm':
      send('/live/track/set/arm', value - 1, 0);
      return true;
    case 'select_track':
      send('/live/view/set/selected_track', value - 1);
      return true;
    case 'volume':
      send('/live/track/set/volume', value.track - 1, value.volume / 100);
      return true;

    // Scene controls
    case 'scene':
      send('/live/scene/fire', value - 1);
      return true;
    case 'stop_all':
      send('/live/song/stop_all_clips');
      return true;

    // Navigation
    case 'next_cue':
      send('/live/song/jump_to_next_cue');
      return true;
    case 'prev_cue':
      send('/live/song/jump_to_prev_cue');
      return true;

    // Create
    case 'create_audio':
      send('/live/song/create_audio_track', -1);
      return true;
    case 'create_midi':
      send('/live/song/create_midi_track', -1);
      return true;
    case 'create_return':
      send('/live/song/create_return_track');
      return true;
    case 'create_scene':
      send('/live/song/create_scene', -1);
      return true;

    // Delete/Duplicate
    case 'delete_track':
      send('/live/song/delete_track', value - 1);
      return true;
    case 'duplicate_track':
      send('/live/song/duplicate_track', value - 1);
      return true;
    case 'delete_scene':
      send('/live/song/delete_scene', value - 1);
      return true;
    case 'duplicate_scene':
      send('/live/song/duplicate_scene', value - 1);
      return true;

    // Capture
    case 'capture_midi':
      send('/live/song/capture_midi');
      return true;

    // Find (keyboard shortcut)
    case 'find':
      return 'find';  // Return string to delegate to main app

    default:
      return false;
  }
}
