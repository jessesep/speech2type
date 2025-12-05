# Ableton Live Addon for speech2type

Control Ableton Live with your voice using OSC commands.

## Requirements

- [AbletonOSC](https://github.com/ideoforms/AbletonOSC) - MIDI remote script for Ableton Live
- Ableton Live 11 or higher

## Installation

### 1. Install AbletonOSC

1. Download from [GitHub](https://github.com/ideoforms/AbletonOSC)
2. Copy the `AbletonOSC` folder to your Remote Scripts directory:
   - **macOS**: `~/Music/Ableton/User Library/Remote Scripts/`
   - **Windows**: `\Users\[username]\Documents\Ableton\User Library\Remote Scripts`
3. Restart Ableton Live
4. Go to **Preferences → Link/Tempo/MIDI**
5. Under **Control Surface**, select **AbletonOSC**
6. You should see: "AbletonOSC: Listening for OSC on port 11000"

### 2. Install the Addon

Copy the `ableton` folder to your speech2type `addons` directory:

```
speech2type/
  addons/
    ableton/
      index.js
      README.md
```

## Usage

Say **"computer music mode"** or **"computer ableton mode"** to activate.

### Commands Only Mode

In music mode, **text is not typed** - only voice commands are executed. This prevents accidental typing while producing.

### Push-to-Talk

Listening is **OFF by default** to avoid interfering with your workflow:

- **Hold Cmd+Option** → Start listening
- **Release Cmd+Option** → Auto-submit and stop listening

You can also use the regular hotkey (Cmd+;) to toggle listening.

## Voice Commands

All commands require the "computer" prefix.

### Transport

| Command | Variations | Action |
|---------|------------|--------|
| computer play | start, go | Start playback |
| computer stop | pause, halt | Stop playback |
| computer continue | resume | Continue from current position |
| computer record | recording, rec | Toggle session record |
| computer overdub | | Toggle arrangement overdub |
| computer tap | tap tempo | Tap tempo |
| computer undo | | Undo |
| computer redo | | Redo |

### Tempo & Metronome

| Command | Variations | Action |
|---------|------------|--------|
| computer tempo 120 | bpm 120, 120 bpm | Set tempo |
| computer metronome | click, toggle metronome | Toggle metronome |
| computer metronome on | click on | Metronome on |
| computer metronome off | click off | Metronome off |

### Loop

| Command | Variations | Action |
|---------|------------|--------|
| computer loop | toggle loop | Toggle loop |
| computer loop on | | Enable loop |
| computer loop off | | Disable loop |

### Track Controls

Track numbers are 1-indexed (track 1 = first track).

| Command | Variations | Action |
|---------|------------|--------|
| computer mute track 1 | mute 1, track 1 mute | Mute track |
| computer unmute track 1 | unmute 1 | Unmute track |
| computer solo track 1 | solo 1 | Solo track |
| computer unsolo track 1 | unsolo 1 | Unsolo track |
| computer arm track 1 | arm 1 | Arm for recording |
| computer disarm track 1 | disarm 1, unarm 1 | Disarm track |
| computer track 1 | select track 1 | Select track |
| computer volume track 1 50 | | Set volume (0-100) |

### Scene Controls

| Command | Variations | Action |
|---------|------------|--------|
| computer scene 1 | fire scene 1, launch scene 1 | Fire scene |
| computer stop all | stop all clips | Stop all clips |

### Track & Scene Management

| Command | Variations | Action |
|---------|------------|--------|
| computer new audio track | create audio track | Create audio track |
| computer new midi track | create midi track | Create MIDI track |
| computer new return track | | Create return track |
| computer new scene | create scene | Create scene |
| computer delete track 1 | remove track 1 | Delete track |
| computer duplicate track 1 | copy track 1 | Duplicate track |
| computer delete scene 1 | | Delete scene |
| computer duplicate scene 1 | | Duplicate scene |

### Navigation

| Command | Action |
|---------|--------|
| computer next cue | Jump to next cue point |
| computer previous cue | Jump to previous cue |

### Other

| Command | Action |
|---------|--------|
| computer capture | Capture MIDI |
| computer find | Open find dialog |

## Mode Switching

| Command | Action |
|---------|--------|
| computer general mode | Exit to general mode |
| computer music mode | Switch to music mode |
| computer exit | Exit to general mode |

## Technical Details

### OSC Communication

- **Host**: 127.0.0.1 (localhost)
- **Port**: 11000
- **Protocol**: UDP/OSC

### Index Conversion

Voice commands use 1-indexed numbers (track 1, scene 1), while OSC uses 0-indexed. The conversion is handled automatically.

## Troubleshooting

### "AbletonOSC not responding"

1. Check that AbletonOSC is selected in Preferences → Link/Tempo/MIDI
2. Look for "Listening for OSC on port 11000" in Live's status bar
3. Make sure no other application is using port 11000

### "Commands not recognized"

1. Make sure you're in music mode ("computer music mode")
2. Speak clearly with the "computer" prefix
3. Check the console output for debugging info

## License

MIT
