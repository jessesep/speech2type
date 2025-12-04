# Ableton Live Voice Commands

Control Ableton Live with your voice using speech2type and AbletonOSC.

## Setup Requirements

### 1. Install AbletonOSC

AbletonOSC is a MIDI remote script that exposes Ableton's Live Object Model via OSC.

1. Download from [GitHub](https://github.com/ideoforms/AbletonOSC)
2. Copy the `AbletonOSC` folder to your Remote Scripts directory:
   - **macOS**: `~/Music/Ableton/User Library/Remote Scripts/`
   - **Windows**: `\Users\[username]\Documents\Ableton\User Library\Remote Scripts`
3. Restart Ableton Live
4. Go to **Preferences → Link/Tempo/MIDI**
5. Under **Control Surface**, select **AbletonOSC**
6. You should see: "AbletonOSC: Listening for OSC on port 11000"

### 2. Start speech2type with Ableton mode

```bash
s2t start --ableton
```

---

## Voice Commands Overview

All Ableton commands use the "ableton" prefix to avoid conflicts with normal speech.

### Transport Controls

| Voice Command | Action |
|---------------|--------|
| "ableton play" | Start playback |
| "ableton stop" | Stop playback |
| "ableton continue" | Continue from current position |
| "ableton record" | Toggle session record |
| "ableton overdub" | Toggle arrangement overdub |
| "ableton tap" | Tap tempo |
| "ableton undo" | Undo last action |
| "ableton redo" | Redo last action |

### Tempo & Metronome

| Voice Command | Action |
|---------------|--------|
| "ableton tempo [number]" | Set tempo (e.g., "ableton tempo 120") |
| "ableton metronome on" | Turn metronome on |
| "ableton metronome off" | Turn metronome off |
| "ableton metronome" | Toggle metronome |

### Track Controls

Track numbers are 1-indexed in voice commands (track 1 = first track).

| Voice Command | Action |
|---------------|--------|
| "ableton mute track [n]" | Mute track n |
| "ableton unmute track [n]" | Unmute track n |
| "ableton solo track [n]" | Solo track n |
| "ableton unsolo track [n]" | Unsolo track n |
| "ableton arm track [n]" | Arm track n for recording |
| "ableton disarm track [n]" | Disarm track n |
| "ableton volume track [n] [0-100]" | Set track volume (percentage) |
| "ableton pan track [n] left/center/right" | Set track panning |
| "ableton select track [n]" | Select track n |

### Scene Controls

Scene numbers are 1-indexed in voice commands (scene 1 = first scene).

| Voice Command | Action |
|---------------|--------|
| "ableton scene [n]" | Fire scene n |
| "ableton fire scene [n]" | Fire scene n |
| "ableton stop scene" | Stop all clips |
| "ableton next scene" | Select and fire next scene |
| "ableton previous scene" | Select and fire previous scene |

### Clip Controls

| Voice Command | Action |
|---------------|--------|
| "ableton clip [track] [slot]" | Fire clip at track/slot |
| "ableton stop clip [track]" | Stop clips on track |
| "ableton stop all clips" | Stop all playing clips |

### Loop Controls

| Voice Command | Action |
|---------------|--------|
| "ableton loop on" | Enable loop |
| "ableton loop off" | Disable loop |
| "ableton loop" | Toggle loop |

### Navigation

| Voice Command | Action |
|---------------|--------|
| "ableton jump [bars]" | Jump forward by bars |
| "ableton back [bars]" | Jump backward by bars |
| "ableton cue next" | Jump to next cue point |
| "ableton cue previous" | Jump to previous cue point |

### Quantization

| Voice Command | Action |
|---------------|--------|
| "ableton quantize none" | No quantization |
| "ableton quantize bar" | Quantize to 1 bar |
| "ableton quantize beat" | Quantize to 1 beat |

---

## Advanced Commands (Planned)

These commands are planned for future implementation:

### Device Control
- "ableton device [n] parameter [m] [value]" - Set device parameter
- "ableton bypass device [n]" - Bypass device on selected track

### Arrangement
- "ableton arrangement" - Switch to arrangement view
- "ableton session" - Switch to session view

### Sends
- "ableton send [track] [send] [level]" - Set send level

### Groups
- "ableton fold track [n]" - Fold/unfold group track
- "ableton unfold track [n]" - Unfold group track

---

## Technical Details

### OSC Communication

speech2type communicates with AbletonOSC using:
- **Send port**: 11000 (to Ableton)
- **Receive port**: 11001 (from Ableton)
- **Protocol**: UDP/OSC

### Example OSC Messages

| Command | OSC Address | Arguments |
|---------|-------------|-----------|
| Play | `/live/song/start_playing` | - |
| Stop | `/live/song/stop_playing` | - |
| Set tempo | `/live/song/set/tempo` | `120.0` |
| Mute track 1 | `/live/track/set/mute` | `0, 1` |
| Fire scene 1 | `/live/scene/fire` | `0` |
| Fire clip | `/live/clip_slot/fire` | `track_index, slot_index` |

### Supported Ableton Versions

- Ableton Live 11 or higher (required by AbletonOSC)

---

## Troubleshooting

### "AbletonOSC not responding"

1. Check that AbletonOSC is selected in Preferences → Link/Tempo/MIDI
2. Look for the message "Listening for OSC on port 11000" in Live's status bar
3. Make sure no other application is using port 11000

### "Commands not recognized"

1. Ensure you're using the "ableton" prefix
2. Speak clearly and wait for the command to be processed
3. Check that speech2type is running with `--ableton` flag

### "Track/scene numbers don't match"

Voice commands use 1-indexed numbers (human-friendly), but OSC uses 0-indexed. The conversion is handled automatically.

---

## Resources

- [AbletonOSC GitHub](https://github.com/ideoforms/AbletonOSC)
- [AbletonOSC API Documentation](https://github.com/ideoforms/AbletonOSC#api)
- [Ableton Live Object Model](https://docs.cycling74.com/max8/vignettes/live_object_model)
- [speech2type GitHub](https://github.com/jessesep/speech2type)
