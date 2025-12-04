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

### 2. Switch to Music Mode

Say "computer music mode" to enable Ableton voice control.

---

## Push-to-Talk (Music Mode)

In music mode, listening is **OFF by default** to avoid interfering with your music workflow.

- **Hold Cmd+Option** → Start listening
- **Release Cmd+Option** → Auto-submit and stop listening

You can also use the regular hotkey (Cmd+;) to toggle listening manually.

---

## Voice Commands

All commands require the "computer" prefix. Commands are designed with multiple variations for better speech recognition.

### Transport Controls

| Voice Command | Variations | Action |
|---------------|------------|--------|
| "computer play" | start, go, playing | Start playback |
| "computer stop" | pause, halt | Stop playback |
| "computer continue" | resume | Continue from current position |
| "computer record" | recording, rec, start recording | Toggle session record |
| "computer overdub" | over dub | Toggle arrangement overdub |
| "computer tap" | tap tempo, tempo tap | Tap tempo |
| "computer undo" | | Undo last action |
| "computer redo" | | Redo last action |

### Tempo & Metronome

| Voice Command | Variations | Action |
|---------------|------------|--------|
| "computer tempo 120" | set tempo 120, bpm 120, 120 bpm | Set tempo |
| "computer metronome" | toggle metronome, click, toggle click | Toggle metronome |
| "computer metronome on" | click on | Turn metronome on |
| "computer metronome off" | click off | Turn metronome off |

### Loop Controls

| Voice Command | Variations | Action |
|---------------|------------|--------|
| "computer loop" | toggle loop, looping | Toggle loop |
| "computer loop on" | | Enable loop |
| "computer loop off" | | Disable loop |

### Track Controls

Track numbers are 1-indexed (track 1 = first track).

| Voice Command | Variations | Action |
|---------------|------------|--------|
| "computer mute track 1" | mute 1, track 1 mute | Mute track |
| "computer unmute track 1" | unmute 1, track 1 unmute | Unmute track |
| "computer solo track 1" | solo 1, track 1 solo | Solo track |
| "computer unsolo track 1" | unsolo 1, track 1 unsolo | Unsolo track |
| "computer arm track 1" | arm 1, track 1 arm, record arm 1 | Arm for recording |
| "computer disarm track 1" | disarm 1, unarm 1, track 1 disarm | Disarm track |
| "computer track 1" | select track 1, go to track 1 | Select track |
| "computer volume track 1 50" | track 1 volume 50 | Set track volume (0-100) |

### Scene Controls

Scene numbers are 1-indexed (scene 1 = first scene).

| Voice Command | Variations | Action |
|---------------|------------|--------|
| "computer scene 1" | fire scene 1, launch scene 1, play scene 1 | Fire scene |
| "computer stop all" | stop all clips, stop clips, stop everything | Stop all clips |

### Track & Scene Management

| Voice Command | Variations | Action |
|---------------|------------|--------|
| "computer new audio track" | create audio track, add audio track | Create audio track |
| "computer new midi track" | create midi track, add midi track | Create MIDI track |
| "computer new return track" | create return track, add return track | Create return track |
| "computer new scene" | create scene, add scene | Create scene |
| "computer delete track 1" | remove track 1 | Delete track |
| "computer duplicate track 1" | copy track 1 | Duplicate track |
| "computer delete scene 1" | remove scene 1 | Delete scene |
| "computer duplicate scene 1" | copy scene 1 | Duplicate scene |

### Navigation

| Voice Command | Variations | Action |
|---------------|------------|--------|
| "computer next cue" | next marker, cue next | Jump to next cue point |
| "computer previous cue" | previous marker, cue previous | Jump to previous cue |

### Other

| Voice Command | Variations | Action |
|---------------|------------|--------|
| "computer capture" | capture midi | Capture MIDI |
| "computer find" | search | Open find dialog (Cmd+F) |

### Mode Switching

| Voice Command | Action |
|---------------|--------|
| "computer general mode" | Switch to general mode |
| "computer music mode" | Switch to Ableton/music mode |
| "computer ableton mode" | Switch to Ableton/music mode |
| "computer exit" | Exit to general mode |

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

## Testing OSC Commands

Use the test script to send OSC commands directly:

```bash
node scripts/test-ableton.js play
node scripts/test-ableton.js tempo 120
node scripts/test-ableton.js mute 1
node scripts/test-ableton.js scene 2
```

Run without arguments to see all available commands.

---

## Troubleshooting

### "AbletonOSC not responding"

1. Check that AbletonOSC is selected in Preferences → Link/Tempo/MIDI
2. Look for the message "Listening for OSC on port 11000" in Live's status bar
3. Make sure no other application is using port 11000

### "Commands not recognized"

1. Ensure you're using the "computer" prefix
2. Speak clearly and wait for the command to be processed
3. Make sure you're in music mode ("computer music mode")

### "Track/scene numbers don't match"

Voice commands use 1-indexed numbers (human-friendly), but OSC uses 0-indexed. The conversion is handled automatically.

---

## Resources

- [AbletonOSC GitHub](https://github.com/ideoforms/AbletonOSC)
- [AbletonOSC API Documentation](https://github.com/ideoforms/AbletonOSC#api)
- [Ableton Live Object Model](https://docs.cycling74.com/max8/vignettes/live_object_model)
- [speech2type GitHub](https://github.com/jessesep/speech2type)
