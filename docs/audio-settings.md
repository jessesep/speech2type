# Audio Settings

Speech2Type provides comprehensive audio feedback configuration. You can enable/disable sounds for different events, choose from system presets, or use your own custom sound files.

## Accessing Audio Settings

1. Open the Speech2Type settings window (click the menu bar icon)
2. Go to the **API** tab
3. Under **Audio**, click the **Configure** button

## Settings Overview

### Master Controls

| Setting | Description |
|---------|-------------|
| **Sound Effects Enabled** | Master toggle that enables/disables ALL sound effects |
| **Master Volume** | Volume slider (0-100%) affecting all sounds |

## Sound Events

### Listening Events

| Event | Description | Default Sound |
|-------|-------------|---------------|
| **Start Listening** | Plays when voice recognition begins | Pop (pitched up) |
| **Stop Listening** | Plays when voice recognition stops | Morse (pitched down) |
| **Typing Feedback** | Subtle sounds when text is typed | Tink (2 taps) |

### Commands & Actions

| Event | Description | Default Sound |
|-------|-------------|---------------|
| **Command Recognized** | Plays when a voice command is detected and executed | Funk |
| **Error / Failed** | Plays when an action fails or an error occurs | Basso |
| **Mode Switch** | Plays when switching between General/Claude/Addon modes | Glass |

### Text-to-Speech Events

| Event | Description | Default Sound |
|-------|-------------|---------------|
| **TTS Started** | Plays when text-to-speech begins (disabled by default) | Purr |
| **TTS Stopped** | Plays when text-to-speech ends (disabled by default) | Blow |

## Sound Selection

For each event, you can choose from:

### System Sound Presets
- **Pop** - Short, pleasant pop sound
- **Glass** - Crisp glass tap
- **Ping** - Soft ping notification
- **Hero** - Triumphant hero sound
- **Funk** - Funky notification
- **Purr** - Soft purring sound
- **Submarine** - Submarine sonar ping
- **Morse** - Morse code beep
- **Basso** - Deep bass sound
- **Blow** - Soft blow sound
- **Bottle** - Bottle pop
- **Frog** - Frog croak
- **Sosumi** - Classic Mac alert
- **Tink** - Light tink sound

### Custom Sound Files
Select "Custom File..." from the dropdown to choose your own audio file.

**Supported Formats:**
- `.aiff` - Audio Interchange File Format (recommended for macOS)
- `.mp3` - MPEG Audio Layer 3
- `.wav` - Waveform Audio File
- `.m4a` - MPEG-4 Audio
- `.ogg` - Ogg Vorbis

## Using the Interface

### For Each Sound Event:
1. **Toggle** (right side) - Enable/disable this specific sound
2. **Dropdown** - Select a preset sound or "Custom File..."
3. **▶ Button** - Test/preview the sound at current volume

### When Using Custom Files:
1. Select "Custom File..." from the dropdown
2. A file browser opens automatically
3. Select your audio file
4. The filename appears below the dropdown
5. Click **▶** to test
6. Click **Save** to apply

## Configuration File

Audio settings are stored in `~/.config/speech2type/config.json`:

```json
{
  "audio": {
    "enabled": true,
    "volume": 100,
    "startEnabled": true,
    "startPreset": "default",
    "startCustom": null,
    "stopEnabled": true,
    "stopPreset": "glass",
    "stopCustom": null,
    "typingEnabled": true,
    "typingPreset": "default",
    "typingCustom": null,
    "commandEnabled": true,
    "commandPreset": "funk",
    "commandCustom": null,
    "errorEnabled": true,
    "errorPreset": "basso",
    "errorCustom": null,
    "modeEnabled": true,
    "modePreset": "default",
    "modeCustom": "/path/to/custom/mode-sound.mp3",
    "ttsStartEnabled": false,
    "ttsStartPreset": "default",
    "ttsStartCustom": null,
    "ttsStopEnabled": false,
    "ttsStopPreset": "default",
    "ttsStopCustom": null
  }
}
```

### Configuration Keys

For each event type (`start`, `stop`, `typing`, `command`, `error`, `mode`, `ttsStart`, `ttsStop`):

| Key Pattern | Type | Description |
|-------------|------|-------------|
| `{event}Enabled` | boolean | Whether this sound is enabled |
| `{event}Preset` | string | Preset name (`default`, `pop`, `glass`, etc.) or `custom` |
| `{event}Custom` | string\|null | Path to custom sound file (only used when preset is `custom`) |

## Console Logging

Sound events are logged to the console:

```
[audio] Playing start sound (80%)
[audio] Playing command sound (80%)
[audio] Playing mode sound (80%)
[audio] error sound disabled - skipping
```

## Tips

### For Best Experience:
1. **Keep sounds short** - Under 1 second is ideal for feedback
2. **Use distinct sounds** - Different sounds for different events helps recognition
3. **Typing sounds should be subtle** - They play frequently
4. **Test at your normal volume** - Adjust master volume to match your environment

### Finding Sound Files

**macOS System Sounds:**
Located at `/System/Library/Sounds/`

**Free Sound Resources:**
- [Freesound.org](https://freesound.org) - Creative Commons sounds
- [Mixkit](https://mixkit.co/free-sound-effects/) - Free sound effects
- [Zapsplat](https://www.zapsplat.com) - Free sound effects library

## Troubleshooting

### No sounds playing
1. Check master toggle is ON (green indicator on Configure button)
2. Check individual event toggles are enabled
3. Verify volume is above 0%
4. Check system volume

### Custom sound not working
1. Verify the file exists
2. Check format is supported
3. Test with the ▶ button
4. Try converting to .aiff format

### Sound plays but too quiet/loud
1. Adjust master volume slider
2. Some sounds are naturally quieter - try a different preset
3. For custom files, normalize the audio before importing
