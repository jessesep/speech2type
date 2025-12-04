# Developer Guide: Adding Voice Commands

This guide explains how to add new voice commands to speech2type, including best practices for speech recognition reliability.

## Architecture Overview

Voice commands are processed in `src/index.js`:

1. **Static Commands** (`GENERAL_COMMANDS`, `ABLETON_COMMANDS`) - Exact phrase matches
2. **Dynamic Patterns** (`ABLETON_PATTERNS`) - Regex patterns for parameterized commands
3. **Action Handlers** - Switch statement that executes the action

## Adding Static Commands

### Command Structure

Commands map a spoken phrase to an action identifier:

```javascript
const GENERAL_COMMANDS = {
  'computer play': 'play_action',
  'computer start': 'play_action',  // Variation maps to same action
};
```

### Guidelines for Command Variations

Speech recognition isn't perfect. Create multiple variations for each command:

1. **Synonyms** - Different words with same meaning
   ```javascript
   'computer play': 'ableton_play',
   'computer start': 'ableton_play',
   'computer go': 'ableton_play',
   ```

2. **Common mishearings** - Words that sound similar
   ```javascript
   'computer playing': 'ableton_play',  // "play" sometimes heard as "playing"
   ```

3. **Natural phrasing** - How people actually speak
   ```javascript
   'computer toggle metronome': 'ableton_metronome_toggle',
   'computer metronome': 'ableton_metronome_toggle',  // Shorter version
   'computer click': 'ableton_metronome_toggle',      // Musician slang
   ```

4. **Word order variations** - Different orderings
   ```javascript
   'computer mute track 1': 'ableton_mute',
   'computer track 1 mute': 'ableton_mute',
   ```

### Required Prefix

All commands (except `affirmative` and `retract`) must start with "computer":

```javascript
// GOOD
'computer play': 'ableton_play',

// BAD - will conflict with normal speech
'play': 'ableton_play',
```

The app normalizes "computers" to "computer" automatically (common speech recognition error).

## Adding Dynamic Patterns

For commands with parameters (numbers, values), use regex patterns:

```javascript
const ABLETON_PATTERNS = [
  {
    pattern: /^computer\s+tempo\s+(\d+)$/,
    action: 'ableton_tempo',
    extract: (match) => parseInt(match[1])
  },
];
```

### Pattern Structure

```javascript
{
  pattern: RegExp,           // Regex to match spoken text
  action: String,            // Action identifier
  extract: (match) => value  // Function to extract parameters from match
}
```

### Multiple Variations for Patterns

Create multiple patterns for the same action:

```javascript
// All these set tempo:
{ pattern: /^computer\s+tempo\s+(\d+)$/, action: 'ableton_tempo', extract: (m) => parseInt(m[1]) },
{ pattern: /^computer\s+set\s+tempo\s+(\d+)$/, action: 'ableton_tempo', extract: (m) => parseInt(m[1]) },
{ pattern: /^computer\s+bpm\s+(\d+)$/, action: 'ableton_tempo', extract: (m) => parseInt(m[1]) },
{ pattern: /^computer\s+(\d+)\s+bpm$/, action: 'ableton_tempo', extract: (m) => parseInt(m[1]) },
```

### Extracting Multiple Parameters

```javascript
{
  pattern: /^computer\s+volume\s+track\s+(\d+)\s+(\d+)$/,
  action: 'ableton_volume',
  extract: (m) => ({ track: parseInt(m[1]), volume: parseInt(m[2]) })
}
```

## Adding Action Handlers

Add a case to the switch statement in the transcript handler:

```javascript
case 'ableton_tempo':
  abletonService.setTempo(value);
  playBeep();
  break;
```

For actions with extracted values:

```javascript
case 'ableton_volume':
  abletonService.setTrackVolume(value.track, value.volume);
  playBeep();
  break;
```

## Adding Ableton OSC Commands

### 1. Add to AbletonService

In `src/services/ableton.js`:

```javascript
class AbletonService {
  // Add new method
  newCommand(param) {
    this.send('/live/osc/address', param);
  }
}
```

### 2. OSC Address Reference

Common AbletonOSC addresses:

| Category | Address | Arguments |
|----------|---------|-----------|
| **Transport** | | |
| Play | `/live/song/start_playing` | - |
| Stop | `/live/song/stop_playing` | - |
| Continue | `/live/song/continue_playing` | - |
| Record | `/live/song/trigger_session_record` | - |
| **Song** | | |
| Set tempo | `/live/song/set/tempo` | `float bpm` |
| Set metronome | `/live/song/set/metronome` | `int 0/1` |
| Set loop | `/live/song/set/loop` | `int 0/1` |
| Undo | `/live/song/undo` | - |
| Redo | `/live/song/redo` | - |
| **Track** (0-indexed) | | |
| Mute | `/live/track/set/mute` | `int track, int 0/1` |
| Solo | `/live/track/set/solo` | `int track, int 0/1` |
| Arm | `/live/track/set/arm` | `int track, int 0/1` |
| Volume | `/live/track/set/volume` | `int track, float 0.0-1.0` |
| Select | `/live/view/set/selected_track` | `int track` |
| **Scene** (0-indexed) | | |
| Fire | `/live/scene/fire` | `int scene` |
| **Clip** (0-indexed) | | |
| Fire | `/live/clip_slot/fire` | `int track, int slot` |
| Stop | `/live/track/stop_all_clips` | `int track` |
| **Create** | | |
| Audio track | `/live/song/create_audio_track` | `int position (-1 = end)` |
| MIDI track | `/live/song/create_midi_track` | `int position (-1 = end)` |
| Return track | `/live/song/create_return_track` | - |
| Scene | `/live/song/create_scene` | `int position (-1 = end)` |

### 3. Index Conversion

User speaks 1-indexed, OSC uses 0-indexed. Convert in the service:

```javascript
muteTrack(trackNum) {
  this.send('/live/track/set/mute', trackNum - 1, 1);  // Convert to 0-indexed
}
```

## Testing

### Test OSC Commands Directly

```bash
node scripts/test-ableton.js <command> [args]
```

Example:
```bash
node scripts/test-ableton.js play
node scripts/test-ableton.js tempo 120
node scripts/test-ableton.js mute 1
```

### Adding Test Commands

Edit `scripts/test-ableton.js`:

```javascript
const commands = {
  mycommand: () => client.send('/live/osc/address'),
  mycommand2: (arg) => client.send('/live/osc/address', parseInt(arg)),
};
```

## Best Practices

### 1. Speech Recognition Reliability

- Add 3-5 variations per command
- Include common mishearings
- Test with actual speech, not just typing
- Consider accents and speech patterns

### 2. User-Friendly Numbers

- Always use 1-indexed in voice commands (track 1, scene 1)
- Convert to 0-indexed internally for OSC
- Document this clearly

### 3. Feedback

- Always call `playBeep()` after successful commands
- Log actions to console for debugging:
  ```javascript
  console.log(chalk.magenta(`[ableton] ${action} → ${value}`));
  ```

### 4. Mode Awareness

- General commands go in `GENERAL_COMMANDS`
- Ableton-specific commands go in `ABLETON_COMMANDS`
- Mode switching should be available in both modes

### 5. Prefix Everything

- All commands must have "computer" prefix
- Exceptions: `affirmative`, `retract` (used constantly)

## Example: Adding a New Command

Let's add "computer pan track 1 left/center/right":

### 1. Add to AbletonService

```javascript
// In src/services/ableton.js
setTrackPan(trackNum, pan) {
  // Pan: -1 (left) to 1 (right), 0 = center
  this.send('/live/track/set/panning', trackNum - 1, pan);
}
```

### 2. Add Patterns

```javascript
// In src/index.js ABLETON_PATTERNS
{
  pattern: /^computer\s+pan\s+track\s+(\d+)\s+(left|center|right)$/,
  action: 'ableton_pan',
  extract: (m) => ({
    track: parseInt(m[1]),
    pan: m[2] === 'left' ? -1 : m[2] === 'right' ? 1 : 0
  })
},
{
  pattern: /^computer\s+track\s+(\d+)\s+pan\s+(left|center|right)$/,
  action: 'ableton_pan',
  extract: (m) => ({
    track: parseInt(m[1]),
    pan: m[2] === 'left' ? -1 : m[2] === 'right' ? 1 : 0
  })
},
```

### 3. Add Handler

```javascript
// In switch statement
case 'ableton_pan':
  abletonService.setTrackPan(value.track, value.pan);
  playBeep();
  break;
```

### 4. Add Test Command

```javascript
// In scripts/test-ableton.js
pan: (track, dir) => {
  const pan = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
  client.send('/live/track/set/panning', parseInt(track) - 1, pan);
},
```

### 5. Document

Add to `docs/ableton-voice-commands.md`:

```markdown
| "computer pan track 1 left" | track 1 pan left | Pan track left/center/right |
```

## Resources

- [AbletonOSC API](https://github.com/ideoforms/AbletonOSC#api)
- [Live Object Model](https://docs.cycling74.com/max8/vignettes/live_object_model)
- [node-osc](https://github.com/MylesBorins/node-osc)
