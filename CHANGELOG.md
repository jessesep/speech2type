# Changelog

All notable changes to Speech2Type Enhanced will be documented in this file.

## [0.6.0] - 2025-12-07

### Added

#### Expanded Audio Settings
- **8 Configurable Sound Events**:
  - Listening: Start, Stop, Typing feedback
  - Commands: Command recognized, Error, Mode switch
  - TTS: TTS Started, TTS Stopped
- **Sound Selection**: Dropdown with 14 system presets per event
- **Custom Sound Files**: Browse and select your own audio files
- **Test Buttons**: Preview each sound at current volume

#### Menu Bar Icons
- **Unified 3-bar design**: All modes use consistent waveform bars
- **Hi-res rendering**: 32x32 pixels with 2x retina scale factor
- **Mode-specific animations**:
  - General: Smooth flowing wave (green)
  - Claude: Seesaw/orbit effect (orange)
  - Music: Energetic bounce (blue)
- **Mode change debounce**: Prevents icon flickering on mode switch

#### About Dialog
- Version information
- Feature summary
- Link to GitHub repository

### Fixed
- **Icon flickering**: Added 1-second debounce after GUI mode changes
- **Ctrl tap disabled**: No longer triggers in General/Claude modes (addon only)

### Documentation
- Added `docs/menu-bar-icons.md` - Icon system and animation guide
- Updated `docs/audio-settings.md` - Complete audio configuration guide

---

## [0.5.0] - 2025-12-06

### Added

#### Audio Settings System
- **Audio Settings Modal**: Full-featured audio configuration accessible from API tab
  - Master toggle to enable/disable all sound effects
  - Individual toggles for start sound, stop sound, and typing sounds
  - Volume slider (0-100%) affecting all sounds
  - Status indicator on Configure button (green = enabled, gray = disabled)
  - Dynamic description showing which sounds are enabled and volume level
- **Custom Sound Files**: Load your own audio files for any sound effect
  - Supports .aiff, .mp3, .wav, .m4a, .ogg formats
  - Browse button to select files from your computer
  - Clear button to reset to system defaults
  - Test button (▶) to preview sounds at current volume
- **Console Logging**: Debug output for sound playback
  - Logs when sounds play with file path and volume
  - Logs when sounds are skipped (disabled)
- **Documentation**: Added `docs/audio-settings.md` with complete guide

### Changed
- Moved audio configuration from inline settings to dedicated modal dialog
- Sound functions now read from config file for custom sound paths
- Custom sounds play at natural pitch (rate flags only apply to system defaults)

---

## [0.4.0] - 2025-12-05

### Added

#### GUI Enhancements
- **New Settings Window**: Complete Electron-based settings GUI with menu bar tray icon
  - Service status indicator with animated icons for different states
  - Mode selector (General, Music, Claude) with visual icons
  - Start/Stop/Restart service controls
  - Start/Stop listening buttons for voice input control
  - TTS toggle with sync between GUI, hotkey, and menu bar
  - Advanced Mode toggle to show/hide Addons, Hotkeys, Commands tabs
  - Tab navigation: General, Addons, API, Hotkeys, Commands

#### Addon System
- **Hot-reload addons**: Addons can be created, modified, and loaded without restarting
- **Addon settings modal**: Configure per-addon settings
  - Commands Only mode
  - Toggle Hotkey to Speak (push-to-talk alternative)
  - TTS Enabled per mode
  - Custom Commands with swipe-to-delete
- **Hide Addon feature**: Remove addons from GUI without deleting files
- **Import/Export**: Import addons from GitHub or local folders, export for sharing
- **Create New Addon**: Built-in wizard for creating custom addons

#### Commands Tab
- **Collapsible sections**: All commands organized into expandable/collapsible sections
  - Core Commands (expanded by default)
  - System Commands (expanded by default)
  - Clipboard & Editing (collapsed)
  - Navigation (collapsed)
  - Window Management (collapsed)
  - Addon-specific sections with Edit button (collapsed)
- **Custom commands display**: Shows custom commands with green star indicator
- **Edit button**: Quick access to addon settings from Commands tab

#### Ableton/Music Mode
- **Search Mode**: Say "computer search" to open Ableton's search with voice transcription
  - Automatically strips punctuation from search terms
  - Say "affirmative" to confirm (presses Enter twice) and exit search mode
- **Exit commands**: "done", "cancel", "exit", "exit search", "stop search"

#### Hotkey System
- **Configurable hotkeys**: All hotkeys can be customized in settings
  - Toggle listening (default: Cmd+;)
  - Toggle TTS (default: Ctrl+')
  - Push-to-talk (default: Cmd+Option)
  - Stop TTS (default: Spacebar)
- **Reset to defaults**: One-click reset for all hotkeys

### Fixed
- TTS toggle sync between GUI toggle, menu bar toggle, and Ctrl+' hotkey
- Claude mode "welcome" speech no longer picked up by microphone (uses TTS lock file)
- Hotkey manager argument count (was passing 6, now correctly passes 4)
- Custom commands delete button now works via click (not just swipe)
- General tab no longer scrolls (only Commands tab scrolls)
- **Service state display**: Now shows three states - Stopped (gray), Idle (yellow), Listening (green with pulse)
- **Scroll overlap**: Fixed content scrolling under window buttons by adding fixed title bar area
- **State sync**: Unified state-changed event ensures GUI updates consistently for mode, listening, and TTS changes
- **Addon commands parsing**: Fixed regex to capture all commands from addon files (was truncating at first brace)

### Changed
- "Push-to-Talk" renamed to "Toggle Hotkey to Speak" in addon settings
- "Remove Addon" changed to "Hide Addon" (hides from GUI, keeps files)
- Tab font size reduced for better fit
- Command section fonts reduced (11px) for better readability

### Documentation
- Added `docs/gui-settings.md` - Comprehensive guide to the settings GUI
- Updated `docs/creating-addons.md` - Complete addon development guide

### Known Issues
- **coreaudiod CPU usage**: Sometimes macOS coreaudiod process uses high CPU. Restart coreaudiod with `sudo killall coreaudiod` to fix.
- **GUI layout on small screens**: Window may be too tall for smaller displays
- **Scroll behavior**: Scroll momentum may feel different between light/dark areas due to `-webkit-app-region` handling

---

## [0.3.2] - Previous Release

See git history for earlier changes.

---

## Wishlist / Future Features

### High Priority
1. **Voice activity detection (VAD)**: Only send audio when speech is detected to reduce API costs
2. **Local speech recognition option**: Whisper integration for offline use
3. **Multi-language switching**: Quick switch between languages via voice command
4. **Customizable wake word**: Replace "computer" with custom trigger word
5. ~~**Audio feedback**: Optional beep/sound when listening starts/stops~~ ✅ Done in 0.5.0

### Medium Priority
6. **Auto-launch apps on mode switch**: Start Ableton when entering Music mode, Claude when entering Claude mode
7. **Per-app profiles**: Different settings for different applications
8. **Command history**: View and repeat recent voice commands
9. **Dictation shortcuts**: "insert email" -> your@email.com
10. **Voice macros**: Record and playback sequences of commands
11. **Editable command phrases**: Customize trigger phrases in GUI

### Nice to Have
12. **iOS/watchOS companion**: Start/stop listening from phone or watch
13. **Transcription log**: Save all transcribed text to file
14. **Training mode**: Improve recognition for your voice
15. **Multiple voices for TTS**: Choose different Piper voices
16. **Streaming TTS**: Start speaking before full response is ready
17. **Keyboard shortcut editor**: Visual hotkey configuration in settings
18. **Sound pack themes**: Bundled sound themes (minimal, retro, sci-fi)

### Technical Improvements
19. **Reduce memory footprint**: Optimize Electron bundle size
20. **Better error recovery**: Auto-reconnect on network issues
21. **Metrics dashboard**: Track usage, API costs, recognition accuracy
22. **Plugin API**: Allow third-party addon marketplace
23. **Cross-platform**: Windows and Linux support
24. **Auto-updater**: Check for and install updates from GitHub releases

### Recently Completed
- ✅ Expanded audio settings with 8 sound events (0.6.0)
- ✅ Hi-res menu bar icons with mode-specific animations (0.6.0)
- ✅ About dialog (0.6.0)
- ✅ Audio settings modal with custom sounds (0.5.0)
- ✅ GUI settings window (0.4.0)
- ✅ Addon system with hot-reload (0.4.0)

---

## Bug Reports

Please report bugs at: https://github.com/jessesep/speech2type/issues

When reporting, include:
- macOS version
- Speech2Type version (`s2t --version`)
- Steps to reproduce
- Error messages from terminal
- Screenshots if applicable
