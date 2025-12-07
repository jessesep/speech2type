# Menu Bar Icons

Speech2Type uses animated menu bar icons to indicate the current state and mode. This document describes the icon system and how to customize or extend it.

## Icon States

| State | Color | Description |
|-------|-------|-------------|
| **idle** | Black (template) | Service running but not listening |
| **listening** | Mode-specific | Actively transcribing speech |
| **speaking** | Blue | TTS is playing |
| **processing** | Amber | Processing command |
| **error** | Red | Error occurred |
| **disabled** | Gray | Service stopped |

## Mode-Specific Colors (Listening State)

| Mode | Color | RGB Value |
|------|-------|-----------|
| **General** | Green | `[90, 200, 130]` |
| **Claude** | Orange/Terracotta | `[217, 119, 87]` |
| **Music** | Blue | `[100, 160, 240]` |

## Icon Design

All modes use a unified **3-bar waveform** design for visual consistency. The bars animate differently based on the current mode:

### General Mode Animation
- **Style**: Smooth flowing wave
- **Behavior**: Bars move in a sine wave pattern with phase offset
- **Feel**: Calm, natural speech rhythm

```javascript
const wave = Math.sin(phase + barIndex * 0.8);
return minH + (maxH - minH) * (0.5 + wave * 0.45);
```

### Claude Mode Animation
- **Style**: Seesaw/orbit effect
- **Behavior**: Left and right bars alternate heights (one up, one down), center bar stays stable
- **Feel**: AI thinking, contemplative

```javascript
// Left bar
const wave = Math.sin(phase);
// Right bar (opposite phase)
const wave = Math.sin(phase + Math.PI);
// Center bar: subtle pulse
return (6 + Math.sin(phase) * 0.5) * scale;
```

### Music Mode Animation
- **Style**: Energetic bounce
- **Behavior**: Bars bounce with offset timing, more dynamic movement
- **Feel**: Musical, rhythmic energy

```javascript
const barPhase = phase + barIndex * 1.0;
const bounce = Math.abs(Math.sin(barPhase));
return minH + (maxH - minH) * bounce;
```

## Technical Details

### Resolution
- Icons render at **32x32 pixels** (2x retina scale)
- Display size: 16x16 logical pixels
- Uses `scaleFactor: 2` for crisp retina display

### Animation
- **16 frames** per animation cycle
- **80ms** interval between frames (12.5 FPS)
- Smooth sine-wave based animations

### Caching
Icons are cached by state, frame, and mode to avoid regenerating:
```javascript
const cacheKey = `${state}-${frame}-${currentMode}`;
```

## Creating Custom Icons

To create a new icon style, implement a drawing function:

```javascript
function drawCustomIcon(buffer, width, height, r, g, b, a, frame, isAnimated, mode) {
  const scale = width / 16;  // Scale factor for hi-res

  // Your drawing code here
  // Use setPixel() helper for anti-aliasing:
  setPixel(buffer, width, x, y, r, g, b, alpha);
}
```

### Helper Functions

```javascript
// Set a pixel with alpha
setPixel(buffer, width, x, y, r, g, b, alpha)

// Draw anti-aliased filled circle
drawFilledCircle(buffer, width, cx, cy, radius, r, g, b, a)

// Draw anti-aliased ellipse outline
drawEyeOutline(buffer, width, cx, cy, eyeW, eyeH, thickness, r, g, b, a)
```

### Buffer Format
- RGBA format, 4 bytes per pixel
- Index calculation: `(y * width + x) * 4`
- Channels: `[R, G, B, A]` at indices `[0, 1, 2, 3]`

## Backup Icons

The codebase includes backup icon functions for reference:

- `drawWaveformIcon_OLD` - Original waveform bars
- `drawClaudeIcon_OLD` - Pulsing circle design
- `drawMusicIcon_OLD` - 4-bar equalizer design
- `drawEyeIcon` - Eye with animated pupil
- `drawClaudeEyeIcon` - Eye with pulsing aura
- `drawMusicEyeIcon` - Eye with equalizer eyelashes

These can be swapped back in by modifying the `createTrayIcon()` function.

## Files

- **gui/main.cjs** - Icon rendering code in `createTrayIcon()` and `drawWaveformIcon()`
