# Speech2Type GUI Settings

The Speech2Type GUI provides a menu bar application for controlling voice recognition without using the command line.

## Opening Settings

Click the Speech2Type icon in your menu bar, then select **Settings** to open the settings window.

## General Tab

### Service Status

The service status indicator shows three states:

| Status | Color | Description |
|--------|-------|-------------|
| **Stopped** | Gray | Service is not running |
| **Idle** | Yellow | Service is running but not listening |
| **Listening** | Green (pulsing) | Actively listening for voice input |

**Service Controls:**
- **Start**: Launch the speech2type backend service
- **Restart**: Stop and restart the service (useful after config changes)
- **Stop**: Shut down the service

### Mode Selection

Three operating modes are available:

| Mode | Icon | Description |
|------|------|-------------|
| **General** | Microphone | Default mode for everyday voice typing |
| **Music** | Music note | Ableton Live voice control with push-to-talk |
| **Claude** | Sun | Optimized for Claude Code conversations |

Click a mode to switch. You can also switch modes by voice: "computer general mode", "computer music mode", or "computer power mode".

### Listening Controls

- **Start Listening**: Begin voice recognition
- **Stop Listening**: Pause voice recognition (service stays running)

### Text-to-Speech

Toggle **Auto-speak Claude responses** to have Claude's responses read aloud using Piper TTS. You can also toggle this with **Ctrl+'** or by saying "computer speech on/off".

### Advanced Mode

Enable **Advanced Mode** to show additional tabs:
- Addons
- Hotkeys
- Commands

## Addons Tab

*(Requires Advanced Mode)*

### Installed Addons

Lists all addons in the `addons/` folder. Each addon shows:
- Name and description
- Activation command (e.g., "computer music mode")
- Enable/disable toggle
- Settings gear icon

### Addon Settings

Click the gear icon to configure an addon:

| Setting | Description |
|---------|-------------|
| **Commands Only** | Don't type text, only execute voice commands |
| **Toggle Hotkey to Speak** | Use push-to-talk instead of continuous listening |
| **TTS Enabled** | Enable text-to-speech when entering this mode |
| **Custom Commands** | Add extra voice commands without editing code |

**Custom Commands** can be added dynamically:
1. Click "Add Command"
2. Enter the voice phrase
3. Select the action from the dropdown
4. Click Save

Swipe left on a command to delete it.

### Hide Addon

Click **Hide Addon** to remove an addon from the GUI without deleting its files. Hidden addons can be restored by editing `~/.config/speech2type/addons.json`.

### Create New Addon

Click **New Addon** to create a custom addon:
1. Enter a name (lowercase, no spaces)
2. Set the display name
3. Define the mode command (what you say to activate)
4. Add a description
5. Configure options (commands only, push-to-talk, TTS)
6. Click Create

The addon will be created in `addons/your-addon-name/` with a template `index.js` file.

### Import/Export

- **Import from GitHub**: Enter a repository URL to download and install an addon
- **Import from Folder**: Select a local folder or .zip file
- **Export**: Save an addon as a .zip file for sharing

## API Tab

### Deepgram API Key

Enter your Deepgram API key for speech recognition. Get a free key at [deepgram.com](https://deepgram.com).

- Click **Show/Hide** to toggle visibility
- Click **Save** to store the key

### Piper TTS (Optional)

Configure Piper TTS for high-quality text-to-speech:

| Setting | Description |
|---------|-------------|
| **Piper TTS Path** | Path to the Piper binary (e.g., `/usr/local/bin/piper`) |
| **Voice Model** | Path to the voice model file (e.g., `~/.local/share/piper-voices/en_US-lessac-high.onnx`) |

If Piper is not configured, Speech2Type falls back to macOS's built-in `say` command.

## Hotkeys Tab

*(Requires Advanced Mode)*

### Configurable Hotkeys

| Hotkey | Default | Description |
|--------|---------|-------------|
| **Toggle Listening** | Cmd+; | Start/stop voice recognition |
| **Toggle TTS** | Ctrl+' | Turn text-to-speech on/off |
| **Push-to-Talk** | Cmd+Option | Hold to speak, release to submit |
| **Stop TTS** | Spacebar | Stop current speech playback |

### Recording a New Hotkey

1. Click **Record** next to any hotkey
2. Press your desired key combination
3. The hotkey is saved automatically
4. Restart the service for changes to take effect

### Reset to Defaults

Click **Reset** to restore all hotkeys to their default values.

## Commands Tab

*(Requires Advanced Mode)*

The Commands tab displays all available voice commands organized by category:

### Built-in Categories

- **Core Commands**: affirmative, retract, new line, escape, silence
- **Mode Switching**: general mode, music mode, power mode
- **Text-to-Speech**: speech on/off
- **Text Editing**: scratch, undo, redo, select all
- **Clipboard**: copy, paste, cut
- **File Operations**: save, find, new tab, close tab
- **Navigation**: tab, up, down, left, right, page up/down
- **Window Management**: close, quit, minimize, switch
- **App Switching**: focus terminal, focus chrome, etc.
- **Terminal Windows**: terminal 1, terminal 2, window with [name]

### Addon Commands

Each enabled addon has its own collapsible section showing:
- Built-in commands from the addon's `index.js`
- Custom commands added via GUI settings
- Edit button to modify addon settings

Custom commands are marked with a green star indicator.

### Expanding/Collapsing Sections

- Click a section header to expand or collapse it
- Core Commands and System Commands are expanded by default
- All other sections are collapsed by default

## Menu Bar

The menu bar icon shows the current status:

| State | Icon |
|-------|------|
| Idle | Gray microphone |
| Listening | Animated green waves |
| Speaking (TTS) | Animated speaker |

Right-click the icon to access:
- Mode switching
- Start/Stop listening
- TTS toggle
- Settings
- Quit

## Keyboard Shortcuts Summary

| Shortcut | Action |
|----------|--------|
| **Cmd+;** | Toggle listening |
| **Ctrl+'** | Toggle TTS |
| **Cmd+Option** (hold) | Push-to-talk |
| **Spacebar** | Stop TTS |
| **Ctrl tap** | Quick toggle (tap Ctrl to start/stop + auto-submit) |

## Configuration Files

Settings are stored in:

| File | Purpose |
|------|---------|
| `~/.config/speech2type/config.json` | API keys, language, hotkeys |
| `~/.config/speech2type/addons.json` | Addon enable/disable, settings overrides |
| `/tmp/s2t-status.json` | Runtime status (listening, mode) |
| `/tmp/claude-auto-speak` | TTS enabled flag |

## Troubleshooting

### Service won't start
- Check that Deepgram API key is configured
- Grant microphone permission to your terminal app
- Grant accessibility permission for hotkeys

### State not updating in GUI
- The GUI polls for state every 300ms
- If state seems stuck, try restarting the service

### Hotkeys not working
- Restart the service after changing hotkeys
- Check for conflicts with other applications
- Ensure accessibility permissions are granted

### Commands not showing
- Make sure Advanced Mode is enabled
- Check that the addon is enabled
- Restart the service if commands were recently added
