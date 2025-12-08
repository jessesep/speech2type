# Changelog

All notable changes to ONE (formerly Speech2Type Enhanced) will be documented in this file.

## [Unreleased]

*No unreleased changes*

---

## [0.7.0] - 2025-12-08 - "Foundation" 🎯

**ONE v0.7 marks the transition from Speech2Type Enhanced to ONE - a voice-first AI operating layer.**

### 🚀 Major Features

#### AI Command Understanding
- **Claude Haiku Integration**: Natural language command interpretation
  - Say commands in your own words: "switch to terminal", "open my code", "ship it"
  - AI figures out your intent automatically
  - ~$0.00005 per command (~$0.05 per 1,000 commands)
  - Dual-mode support: Anthropic API (fast) or Claude CLI (uses login)

#### Personal Command Dictionary
- **Auto-learning system**: High-confidence AI results automatically saved to personal dictionary
- **Fuzzy matching**: Typos and variations work automatically (Fuse.js with 0.3 threshold)
- **3-tier resolution**:
  1. Exact match (dictionary lookup, <1ms)
  2. Fuzzy match (phonetic variations, <5ms)
  3. AI fallback (Claude Haiku, ~300ms)
- **Stats tracking**: Monitor tier1/tier2/tier3 hit rates
- **Personal vocabulary**: `~/.config/one/personal_commands.json`

#### Secure API Key Storage
- **macOS Keychain integration**: API keys stored securely via keytar
- **Migration from plaintext**: Automatic migration from config.json to Keychain
- **GUI management**: Add/delete API keys in settings window
- **Status indicators**: Visual confirmation of Keychain storage

### Added

#### Core Services
- **`src/services/intent-resolver.js`**: AI command understanding service
  - `looksLikeCommand()` heuristic to avoid unnecessary API calls
  - Response caching with 5-minute TTL
  - Dual-mode: API or CLI

- **`src/services/commands.js`**: Personal command dictionary
  - Load/save personal commands
  - Fuzzy matching with Fuse.js
  - Auto-learning from AI results
  - Usage statistics

- **`src/services/secrets.js`**: Keychain API key storage
  - macOS Keychain integration via keytar
  - Secure storage and retrieval
  - Migration utilities

#### Data Files
- **`src/data/default_commands.json`**: Default command library
  - 30+ built-in commands
  - Phonetic variations
  - Action mappings

#### Testing & Quality
- **155 tests passing** with Vitest framework
  - 35 tests: `tests/intent-resolver.test.js`
  - 46 tests: `tests/commands.test.js`
  - 26 tests: `tests/secrets.test.js`
  - 12 tests: `tests/phonetic-variations.test.js`
  - 36 tests: `tests/context-window.test.js`
- **Test coverage**: 32% overall
  - 100% coverage: commands.js, context-window.js
  - 97% coverage: secrets.js
  - 85% coverage: intent-resolver.js
- **ESLint configuration**: Fixed and enforced

### Changed

#### Transcript Pipeline
- **AI-powered fallback**: When no exact keyword match found, ONE asks AI
- **Smart filtering**: Only checks short phrases (≤7 words) that look like commands
- **Confidence threshold**: 70% minimum for AI command execution
- **GUI indicators**: Shows AI status in menu bar

#### Branding
- **README rebrand**: "ONE - Voice-First AI Operating Layer"
- **Project vision**: Evolving from voice typing to voice orchestration
- **Roadmap published**: Phases 1-4 specifications complete

### Documentation

#### Planning & Architecture
- **`.planning/one/`**: Complete Phase 1-4 specifications (10,540+ lines)
  - `AI-COMMAND-SYSTEM.md`: AI understanding architecture
  - `PERSONAL-DICTIONARY.md`: Dictionary and learning system
  - `SECURE-STORAGE.md`: Security and API key management
  - `TRAINING-MODE.md`: Phase 2 specifications
  - `LEARNING-LOOP.md`: Auto-learning design
  - `MULTI-AGENT-INTEGRATION.md`: Phase 4 vision
  - `ROADMAP.md`: Complete development roadmap
  - `VISION.md`: ONE strategic vision

- **`docs/ARCHITECTURE.md`**: Comprehensive technical documentation (1,003 lines)
- **`.planning/TEAM-STATUS.md`**: Multi-agent development coordination
- **Updated README.md**: ONE branding, v0.7 features, roadmap

#### Future Planning
- **`.planning/future/`**: Post-v1.0 strategy (3,866+ lines)
  - `FUTURE-VISION.md`: v2.0+ roadmap
  - `LOCAL-PROCESSING.md`: Whisper/Moonshine integration plans
  - `ECOSYSTEM-STRATEGY.md`: Marketplace and community
  - `PRICING-STRATEGY.md`: Monetization model

### Performance

#### Latency
- **Tier 1 (exact)**: <1ms
- **Tier 2 (fuzzy)**: <5ms
- **Tier 3 (AI)**: ~300ms (API), ~500ms (CLI)

#### Costs
- **Deepgram STT**: Free tier (50+ hours)
- **Claude Haiku**: ~$0.00005 per command
- **Total**: ~$0.05 per 1,000 commands

### Migration Guide

#### For Existing Users
1. **Update to v0.7**: `npm install -g speech2type-enhanced@latest`
2. **Add Anthropic API key** (optional):
   - Open settings GUI
   - Click "API" tab
   - Enter API key → stored in Keychain
3. **Existing commands**: All existing commands continue to work
4. **New features**: AI understanding works automatically when API key is set

#### Breaking Changes
- None - fully backwards compatible

### Known Issues
- **Metrics tracking**: Tier 1/2/3 hit rates not yet displayed in GUI (tracked internally)
- **Integration tests**: Partial coverage with mock API (real-world testing needed)
- **Cost monitoring**: No dashboard yet for API usage tracking

### Next Phase

**Phase 2: Training Mode (v0.8)** - Coming next
- "Computer learn" - teach new commands through conversation
- Correction flow: "No, I meant..."
- Workflow creation: record multi-step sequences
- Voice feedback: "Got it, what should that do?"

See [.planning/one/ROADMAP.md](.planning/one/ROADMAP.md) for full specifications.

---

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
