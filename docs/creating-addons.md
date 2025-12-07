# Creating Addons for Speech2Type

Addons extend Speech2Type with custom voice commands for specific applications. This guide shows you how to create your own addon.

## Quick Start

### Option 1: Using the GUI (Recommended)

1. Open Settings (click the menu bar icon -> Settings)
2. Go to the "Addons" tab
3. Click "New Addon"
4. Fill in the form and click "Create"
5. Your addon is ready! Edit `addons/your-addon/index.js` to add commands

### Option 2: Manual Creation

1. Create a folder in `addons/` with your addon name (e.g., `addons/my-addon/`)
2. Create an `index.js` file with your addon code
3. Restart Speech2Type - your addon will be automatically loaded

## Basic Addon Structure

```javascript
// addons/my-addon/index.js

// Required: Export metadata about your addon
export const metadata = {
  name: 'my-addon',
  displayName: 'My Custom Addon',
  version: '1.0.0',
  description: 'Description of what your addon does',
  author: 'Your Name',

  // The voice command to activate this mode (e.g., "computer my mode")
  modeCommand: 'my mode',

  // Alternative phrases that also activate this mode (for speech recognition variations)
  modeAliases: ['my addon mode', 'custom mode'],

  // Optional: Enable push-to-talk (hold Cmd+Option to speak)
  pushToTalk: false,
  pushToTalkAutoSubmit: false,
};

// Optional: Called when addon is loaded or activated
export function init() {
  console.log('[my-addon] Initialized');
}

// Optional: Called when switching away from this mode
export function cleanup() {
  console.log('[my-addon] Cleaned up');
}

// Required: Voice commands for this mode
// Format: { "phrase": "action" } - phrases are prefixed with "computer" automatically
export const commands = {
  // Simple actions
  'do something': 'my_action',
  'another command': 'another_action',
};

// Required: Handle voice command actions
export async function handleCommand(action, context) {
  switch (action) {
    case 'my_action':
      console.log('Doing something!');
      // Your code here
      return true; // Return true if handled

    case 'another_action':
      console.log('Another action!');
      return true;

    default:
      return false; // Not handled
  }
}
```

## Metadata Options

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique identifier (lowercase, no spaces) |
| `displayName` | No | Human-readable name |
| `version` | No | Semantic version (e.g., "1.0.0") |
| `description` | No | Brief description |
| `author` | No | Your name or handle |
| `modeCommand` | Yes | Voice phrase to activate (without "computer" prefix) |
| `modeAliases` | No | Array of alternative activation phrases |
| `pushToTalk` | No | If true, use Cmd+Option hold-to-speak |
| `pushToTalkAutoSubmit` | No | If true, auto-press Enter on release |
| `commandsOnly` | No | If true, don't type text - only execute commands |
| `ttsEnabled` | No | If true, enable TTS when entering this mode |

## GUI Settings Override

Users can override addon settings from the GUI without modifying code:

1. Open Settings -> Addons tab
2. Click the gear icon next to any addon
3. Configure:
   - **Commands Only**: Don't type text, only execute commands
   - **Push-to-Talk**: Hold Cmd+Option to speak
   - **TTS Enabled**: Enable text-to-speech for this mode
   - **Custom Commands**: Add extra voice commands dynamically

Settings are stored in `~/.config/speech2type/addons.json` and override the addon's defaults.

## Adding Speech Recognition Variations

Speech recognition often mishears words. Add common variations to `modeAliases`:

```javascript
modeAliases: [
  'my mode',
  'my mod',      // "mode" heard as "mod"
  'my mowed',    // "mode" heard as "mowed"
  'my moat',     // "mode" heard as "moat"
],
```

## Pattern-Based Commands (Dynamic Values)

For commands that include variable values (like "tempo 120" or "mute track 3"), use the `patterns` export:

```javascript
// Patterns use regex to capture dynamic values
export const patterns = [
  // "tempo 120" - captures the number
  {
    pattern: /^tempo\s+(\d+)$/i,
    action: 'set_tempo',
    extract: (match) => parseInt(match[1])
  },

  // "mute track 5" - captures the track number
  {
    pattern: /^mute\s+track\s+(\d+)$/i,
    action: 'mute_track',
    extract: (match) => parseInt(match[1])
  },

  // "volume track 2 80" - captures both track and volume
  {
    pattern: /^volume\s+track\s+(\d+)\s+(\d+)$/i,
    action: 'set_volume',
    extract: (match) => ({ track: parseInt(match[1]), volume: parseInt(match[2]) })
  },
];

// Handle dynamic values in execute()
export async function execute(action, value) {
  switch (action) {
    case 'set_tempo':
      console.log(`Setting tempo to ${value} BPM`);
      return true;

    case 'mute_track':
      console.log(`Muting track ${value}`);
      return true;

    case 'set_volume':
      console.log(`Setting track ${value.track} volume to ${value.volume}%`);
      return true;

    default:
      return false;
  }
}
```

**Tips for patterns:**
- Add multiple patterns for the same action (e.g., "tempo 120", "set tempo 120", "bpm 120")
- Use `\s+` for whitespace matching (handles multiple spaces)
- Use `(\d+)` to capture numbers
- The `extract` function receives the regex match array

## Example: Controlling an Application via OSC

```javascript
import { Client } from 'node-osc';

export const metadata = {
  name: 'my-osc-app',
  displayName: 'My OSC App',
  version: '1.0.0',
  modeCommand: 'app mode',
};

let oscClient = null;

export function init() {
  oscClient = new Client('127.0.0.1', 8000);
}

export function cleanup() {
  if (oscClient) {
    oscClient.close();
    oscClient = null;
  }
}

export const commands = {
  'play': 'osc_play',
  'stop': 'osc_stop',
  'tempo 120': 'osc_tempo_120',
};

export async function handleCommand(action) {
  if (!oscClient) return false;

  switch (action) {
    case 'osc_play':
      oscClient.send('/transport/play');
      return true;
    case 'osc_stop':
      oscClient.send('/transport/stop');
      return true;
    case 'osc_tempo_120':
      oscClient.send('/tempo', 120);
      return true;
    default:
      return false;
  }
}
```

## Example: Keyboard Shortcuts

```javascript
import { exec } from 'child_process';

export const metadata = {
  name: 'shortcuts',
  displayName: 'Keyboard Shortcuts',
  version: '1.0.0',
  modeCommand: 'shortcut mode',
};

export const commands = {
  'new file': 'shortcut_new',
  'save': 'shortcut_save',
  'undo': 'shortcut_undo',
};

function pressKeys(keys) {
  // Use osascript to simulate key presses on macOS
  exec(`osascript -e 'tell application "System Events" to keystroke "${keys}" using command down'`);
}

export async function handleCommand(action) {
  switch (action) {
    case 'shortcut_new':
      pressKeys('n');
      return true;
    case 'shortcut_save':
      pressKeys('s');
      return true;
    case 'shortcut_undo':
      pressKeys('z');
      return true;
    default:
      return false;
  }
}
```

## Push-to-Talk Mode

For applications where continuous listening would interfere (like music production), enable push-to-talk:

```javascript
export const metadata = {
  name: 'studio',
  displayName: 'Studio Mode',
  modeCommand: 'studio mode',
  pushToTalk: true,           // Hold Cmd+Option to speak
  pushToTalkAutoSubmit: true, // Auto-press Enter on release
};
```

With push-to-talk:
- Speech2Type doesn't listen continuously
- Hold **Cmd+Option** to start speaking
- Release to stop and auto-submit (if enabled)

## Enabling/Disabling Addons

You can enable or disable addons without removing them:

### Via GUI
1. Open Settings (click the menu bar icon → Settings)
2. Go to the "Addons" tab
3. Toggle addons on/off using the switches
4. Restart the service to apply changes

### Via Config File
Edit `~/.config/speech2type/addons.json`:

```json
{
  "enabled": {
    "my-addon": false,
    "another-addon": true
  }
}
```

Addons default to enabled if not specified in the config.

## Testing Your Addon

1. Place your addon in `addons/your-addon/`
2. Run Speech2Type: `npm start` or `npm run gui`
3. Say "computer your mode" to activate
4. Test your voice commands

## Debugging

Enable debug output:

```bash
DEBUG=1 npm start
```

Add logging to your addon:

```javascript
import chalk from 'chalk';

export async function handleCommand(action) {
  console.log(chalk.blue(`[my-addon] Received action: ${action}`));
  // ...
}
```

## Adding Documentation

Create a `README.md` file in your addon folder to provide documentation:

```
addons/
  my-addon/
    index.js
    README.md    <-- Your documentation here
```

The GUI will show a "Docs" link next to your addon name if `README.md` exists.

## Publishing Your Addon

1. Create a GitHub repository for your addon
2. Include a README with:
   - What your addon does
   - Required dependencies
   - Voice commands list
   - Setup instructions
3. Share it with the community!

## Import/Export Addons

### Importing from GitHub

1. Open Settings -> Addons tab
2. Click "Import" under "Import from GitHub"
3. Paste the GitHub repository URL
4. The addon will be downloaded and installed automatically

### Importing from Local Folder/Zip

1. Open Settings -> Addons tab
2. Click "Browse" under "Import from Folder"
3. Select a folder or .zip file containing an addon

### Exporting an Addon

1. Open Settings -> Addons tab
2. Click "Export"
3. Select which addon to export
4. Choose where to save the .zip file

## Hot Reload

Changes to addon settings (via the GUI gear icon) take effect immediately without restarting the service. The backend watches for config changes and reloads automatically.

## Need Help?

- Check the [Ableton addon](../addons/ableton/) for a complete, well-documented example
- See [Ableton Voice Commands](./ableton-voice-commands.md) for the full command list
- Open an issue on [GitHub](https://github.com/jessesep/speech2type)
- Read the full [addon API documentation](./addon-developer-guide.md)
