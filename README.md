# Speech2Type Enhanced

> **Voice typing and commands for macOS developers**

A powerful voice-to-text tool that works in every Mac app. Type with your voice, execute commands naturally, and control your workflow hands-free.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![macOS](https://img.shields.io/badge/macOS-13%2B-blue)](https://www.apple.com/macos/)

## Features

| Feature | Description |
|---------|-------------|
| **Voice Transcription** | Real-time Deepgram STT with 40+ language support |
| **AI Commands** | Claude Haiku interprets natural speech (optional) |
| **Personal Dictionary** | Auto-learns your command variations |
| **Menu Bar GUI** | Electron app with settings and status indicators |
| **Secure Storage** | API keys in macOS Keychain |
| **Multiple Modes** | General, Claude (auto-pause/resume), Music (Ableton) |
| **Hotkeys** | Cmd+; toggle, push-to-talk, spacebar stop TTS |

---

## Quick Start

### Installation

```bash
npm install -g speech2type-enhanced
s2t start
```

Or from GitHub:
```bash
npm install -g github:jessesep/speech2type
s2t start
```

### First Run

1. Get your **free** [Deepgram API key](https://deepgram.com)
2. (Optional) Add [Anthropic API key](https://console.anthropic.com) for AI commands
3. Grant microphone and accessibility permissions
4. Press **Cmd+;** to start speaking

### Basic Usage

1. Click where you want text
2. Press **Cmd+;** to start listening
3. Speak naturally
4. Say **"affirmative"** to submit
5. Press **Cmd+;** to stop

---

## AI-Powered Commands

With an Anthropic API key, say commands naturally:

```
Traditional (exact match):
  "computer focus terminal"  -> Works
  "switch to terminal"       -> Doesn't work

With AI understanding:
  "switch to terminal"       -> Works
  "open my terminal"         -> Works
  "go to the terminal app"   -> Works
```

**Cost**: ~$0.00005 per command (1,000 commands = $0.05)

---

## Voice Commands

Most commands use the **"computer"** prefix. Exceptions: "affirmative" and "retract" work without prefix.

### Essential Commands

| Say | Action |
|-----|--------|
| **"affirmative"** | Press Enter (submit) |
| **"retract"** | Delete last transcribed text |
| **"computer scratch"** | Clear entire input |
| **"computer stop listening"** | Stop recognition |

### App Switching

Use: "focus", "switch to", "go to", or "open"

| Say | Switches To |
|-----|-------------|
| "focus terminal" | Terminal |
| "focus chrome" | Google Chrome |
| "focus code" | VS Code |
| "focus cursor" | Cursor |
| "focus slack" | Slack |

### Clipboard

| Say | Action |
|-----|--------|
| "computer copy" | Cmd+C |
| "computer paste" | Cmd+V |
| "computer select all" | Cmd+A |
| "computer save" | Cmd+S |

---

## Modes

### General Mode (Default)
Standard voice typing and commands.

### Claude Mode
Optimized for Claude Code. Auto-pauses after submit, resumes when Claude responds.

**Activate:** "computer claude mode"

### Music Mode
Voice control for Ableton Live via OSC.

**Activate:** "computer music mode"

See [docs/ableton-voice-commands.md](docs/ableton-voice-commands.md) for details.

---

## Claude Code Integration

Auto-read Claude responses using Piper TTS:

1. Install Piper: `pip install piper-tts`
2. Copy hook: `cp claude-hooks/speak-response.sh ~/.claude/hooks/`
3. Register in `~/.claude/settings.json`

Toggle with **Cmd+'** or say **"silence"** to stop.

See [claude-hooks/README.md](claude-hooks/README.md) for setup details.

---

## Requirements

- **macOS 13+** with Apple Silicon
- **Node.js 18+**
- **Deepgram API key** (free tier: 50+ hours)
- **Anthropic API key** (optional, for AI commands)

### Permissions Required

- Microphone access
- Accessibility access
- Automation access (System Events)

Grant to your **terminal app** in System Settings > Privacy & Security.

---

## Configuration

```bash
# View settings
s2t config

# Change hotkey
s2t config --hotkey

# Select language
s2t config --language

# Update API key
s2t config --deepgram-api-key
```

---

## Development

```bash
git clone https://github.com/jessesep/speech2type.git
cd speech2type
npm install
npm run build
npm run dev
```

### Project Structure

```
speech2type/
├── src/
│   ├── index.js              # Main application
│   ├── services/
│   │   ├── intent-resolver.js # AI command understanding
│   │   ├── commands.js        # Personal dictionary
│   │   ├── secrets.js         # Keychain storage
│   │   ├── transcriber.js     # Deepgram integration
│   │   └── typer.js           # Text injection
│   └── data/
│       └── default_commands.json
├── gui/                       # Electron menu bar app
├── swift/                     # Native macOS components
└── tests/                     # Vitest test suites
```

### Running Tests

```bash
npm test
```

---

## Troubleshooting

**Permission denied**: Grant microphone/accessibility to your terminal app in System Settings.

**Command not found**: Reinstall with `npm install -g speech2type-enhanced`

**AI commands not working**: Check Anthropic API key in GUI settings.

**Text not appearing**: Verify Deepgram API key and internet connection.

### Debug Mode

```bash
DEBUG=1 s2t start
```

---

## Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Test thoroughly on macOS
4. Submit pull request

---

## License

MIT License - see [LICENSE](LICENSE)

---

## Acknowledgments

- Built on [Speech2Type](https://github.com/gergomiklos/speech2type) by Gergo Miklos
- Powered by [Deepgram](https://deepgram.com)
- AI via [Anthropic Claude](https://anthropic.com)
- TTS via [Piper](https://github.com/rhasspy/piper)

---

**Speech2Type Enhanced** - Voice typing for developers.
