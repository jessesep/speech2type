# Speech2Type Enhanced - Roadmap

## Vision

Speech2Type Enhanced aims to be the most intuitive voice control system for macOS - one that learns from you, adapts to your workflow, and requires zero manual configuration.

## Current Status (v0.6.0)

### Core Features
- Real-time speech-to-text via Deepgram Nova-2
- Voice commands with "computer" prefix
- Multi-mode system (General, Claude, Music/Ableton)
- Menu bar GUI with animated status icons
- Text-to-speech responses via Piper
- Focus-aware Smart Mode

### Recent Additions
- Smart Mode: Commands-only when not in text field
- Focus detection via macOS Accessibility API
- Visual indicator (dot) for Smart Mode status
- Claude mode auto-resume after response

## Roadmap

### Near Term (v0.7.0)

#### AI Command Understanding
See: [ai-command-understanding.md](./ai-command-understanding.md)

- Personal command dictionary
- "Computer learn" training mode
- Voice confirmation workflow
- Context-aware suggestions

#### Local Speech-to-Text
- Evaluate Moonshine, Whisper.cpp, faster-whisper
- Hybrid mode: local for commands, cloud for dictation
- Reduced latency for common phrases
- Offline fallback capability

#### Enhanced Smart Mode
- Per-app command profiles
- Automatic mode switching based on focused app
- Custom command sets for specific applications

### Medium Term (v0.8.0)

#### Local Intent Classification
- Small local model for intent recognition
- Fuzzy matching for similar phrases
- Confidence-based fallback to cloud
- Progressive learning from user corrections

#### Multi-Step Commands
- Command chaining ("copy this and paste in notes")
- Conditional commands ("if in browser...")
- Command macros ("morning routine")

#### Improved TTS
- Evaluate VibeVoice and other local TTS options
- Voice selection and customization
- Interruptible speech with smooth transitions

### Long Term (v1.0.0)

#### Voice-First Configuration
- All settings configurable via voice
- "What can you do?" help system
- Voice-based command editing and removal

#### Community Features
- Shareable command libraries
- App-specific command packs
- Community-contributed intents

#### Cross-Platform
- Linux support (PipeWire audio)
- Windows support consideration

## Technical Debt & Improvements

### Code Quality
- [ ] TypeScript migration
- [ ] Unit test coverage
- [ ] E2E testing for voice commands
- [ ] Better error handling and recovery

### Performance
- [ ] Reduce memory footprint
- [ ] Faster startup time
- [ ] Audio processing optimization
- [ ] Efficient icon animation

### Documentation
- [x] Developer guide
- [x] Menu bar icons documentation
- [x] Addon development guide
- [ ] API documentation
- [ ] Video tutorials

## Research Topics

### Local Speech Recognition
- **Moonshine**: Optimized for real-time, low latency
- **Whisper.cpp**: CPU-efficient Whisper implementation
- **faster-whisper**: CTranslate2-based, 4x faster
- **Vosk**: Lightweight, offline-first

### Local Text-to-Speech
- **Piper**: Current choice, fast and natural
- **VibeVoice**: Microsoft's new real-time TTS
- **Coqui TTS**: Open source, customizable
- **macOS say**: Built-in, no dependencies

### Intent Classification
- **TinyLlama**: Small but capable
- **DistilBERT**: Fast classification
- **Phi-2**: Microsoft's small language model
- **Custom training**: Domain-specific model

## Contributing

We welcome contributions! Priority areas:
1. Local STT integration
2. Command learning system
3. App-specific command profiles
4. Documentation and tutorials

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## Version History

| Version | Focus |
|---------|-------|
| 0.5.0 | Multi-mode system, Ableton addon |
| 0.6.0 | Smart Mode, focus detection, GUI improvements |
| 0.7.0 | AI command understanding (planned) |
| 0.8.0 | Local processing, multi-step commands (planned) |
| 1.0.0 | Voice-first configuration, community features (planned) |

---

*Last updated: December 2024*
