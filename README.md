# ONE - Voice-First AI Operating Layer

> **Control your Mac with voice. Let AI understand what you mean.**

ONE (formerly Speech2Type Enhanced) is evolving from a voice typing tool into an intelligent voice-first command layer for macOS. Currently at **v0.7**, it combines real-time voice transcription with AI-powered command understanding.

## ✨ What Makes ONE Different

- **AI Understands You**: Say commands naturally—"ship it", "open my code"—ONE figures out what you mean
- **Learns From You**: The more you use it, the better it understands your vocabulary
- **Works Everywhere**: Claude Code, Cursor, Slack, Chrome—any Mac app with text input
- **Secure by Default**: API keys stored in macOS Keychain, not config files

### Current Features (v0.7)

| Feature | Description |
|---------|-------------|
| **🤖 AI Command Understanding** | Claude Haiku interprets natural speech, learns your phrases |
| **🎤 Voice Transcription** | Real-time Deepgram STT with 40+ language support |
| **🖥️ Menu Bar GUI** | Full Electron app with settings and status indicators |
| **🔒 Secure Storage** | API keys in macOS Keychain via keytar |
| **🎛️ Multiple Modes** | General, Claude (auto-pause/resume), Music (Ableton control) |
| **🔊 Audio Feedback** | Configurable sounds for start/stop, commands, errors |
| **🗣️ Claude TTS** | Auto-read Claude Code responses with Piper neural TTS |
| **⌨️ Hotkeys** | Cmd+; toggle, push-to-talk, spacebar stop TTS |

See [CHANGELOG.md](CHANGELOG.md) for full release history.

---

## 🚀 Quick Start

### Installation

```bash
npm install -g speech2type-enhanced
s2t start
```

Or install directly from GitHub:
```bash
npm install -g github:jessesep/speech2type
s2t start
```

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![macOS](https://img.shields.io/badge/macOS-13%2B-blue)](https://www.apple.com/macos/)

### First Run

```bash
# Start the application
s2t start

# Follow the setup wizard to:
# 1. Get your FREE Deepgram API key from https://deepgram.com
# 2. (Optional) Add your Anthropic API key for AI command understanding
# 3. Configure language preference (default: English)
# 4. Set up your hotkey (default: ⌘;)
# 5. Grant microphone and accessibility permissions
```

### Basic Usage

1. **Start ONE**: Run `s2t start` in your terminal
2. **Position cursor**: Click where you want text to appear
3. **Press hotkey**: Default is ⌘; to start listening
4. **Speak**: Your words appear in real-time at your cursor
5. **Use commands**: Say "affirmative" to submit, "retract" to undo
6. **Press hotkey again**: Stop listening

That's it! You now have intelligent voice control in every Mac app.

---

## 🤖 AI-Powered Commands (v0.7 New!)

ONE now understands natural speech using Claude Haiku. Say commands how you'd naturally say them.

### How It Works

```
Traditional (exact match):
  You: "computer focus terminal"  ✅ Works
  You: "switch to terminal"       ❌ Doesn't work

ONE v0.7 (AI understanding):
  You: "switch to terminal"       ✅ Works
  You: "open my terminal"         ✅ Works
  You: "go to the terminal app"   ✅ Works

  AI figures out you want to focus Terminal.
```

### Intelligent Features

- **Natural Language**: Say commands in your own words
- **Fuzzy Matching**: Typos and variations work automatically
- **Auto-Learning**: High-confidence AI results get saved to your personal dictionary
- **Cost-Efficient**: ~$0.00005 per command via Claude Haiku API
- **Privacy-First**: API key stored in macOS Keychain

**Cost example**: 1,000 commands ≈ $0.05 (five cents)

### Setup AI Commands

1. Get an Anthropic API key from [https://console.anthropic.com](https://console.anthropic.com)
2. Open ONE settings (click menu bar icon)
3. Add your API key—it's stored securely in macOS Keychain
4. Start using natural commands!

**Note**: AI commands are optional. ONE works without an API key using exact command matching.

---

## 🎤 Voice Commands

ONE supports 30+ voice commands for hands-free control. Commands work with or without punctuation.

### Command Prefix

Most commands require the **"computer"** prefix to avoid conflicts with normal speech. Exceptions: "affirmative" and "retract" work without prefix for faster workflow.

The app automatically normalizes "computers" to "computer" (common speech recognition error).

### Essential Commands

| Say | Action |
|-----|--------|
| **"affirmative"** | Press Enter (submit text) |
| **"retract"** | Delete the last transcribed text |
| **"computer scratch"** | Clear entire input field |
| **"computer stop listening"** | Stop voice recognition |

### App Switching

Use any prefix: **"focus"**, **"switch to"**, **"go to"**, **"open"**

| Say | Switches To |
|-----|-------------|
| "focus terminal" | Terminal |
| "focus chrome" / "focus google" | Google Chrome |
| "focus safari" | Safari |
| "focus code" / "focus vs code" | Visual Studio Code |
| "focus cursor" | Cursor |
| "focus slack" | Slack |
| "focus spotify" / "focus music" | Spotify |

*And 10+ more apps—see full list below*

### Clipboard & Editing

| Say | Action |
|-----|--------|
| "computer copy" | Copy selection (Cmd+C) |
| "computer paste" | Paste (Cmd+V) |
| "computer select all" | Select all (Cmd+A) |
| "computer save" | Save (Cmd+S) |

### Terminal Window Switching

Switch between multiple Terminal windows by index or by searching titles:

| Say | Action |
|-----|--------|
| "terminal 1" / "terminal 2" | Switch to Terminal window 1 or 2 |
| "terminal claude" | Switch to Terminal with "claude" in title |
| "window with ssh" | Switch to Terminal with "ssh" in title |

See [Full Command Reference](#full-command-reference) for all 30+ commands.

---

## 🎛️ Modes

ONE adapts to different workflows with three operating modes.

### General Mode (Default)

Standard mode for everyday voice typing and commands.

**Activate:** "computer general mode"

### Music Mode (Ableton Live)

Voice control for Ableton Live via OSC with push-to-talk.

**Activate:** "computer music mode"

**Features:**
- **Push-to-talk**: Hold Cmd+Option to speak, release to auto-submit
- **OSC Integration**: Controls Ableton via AbletonOSC
- **Extensive commands**: Transport, tracks, scenes, and more

See [docs/ableton-voice-commands.md](docs/ableton-voice-commands.md) for full documentation.

**Requirements:**
- Ableton Live 11+
- [AbletonOSC](https://github.com/ideoforms/AbletonOSC) installed

### Claude Mode (Power Mode)

Optimized for Claude Code conversations. Auto-pauses after submit, resumes after Claude responds.

**Activate:** "computer power mode" or "computer claude mode"

**Features:**
- Auto-pause listening after "affirmative" (submit)
- Auto-resume when Claude finishes responding
- Seamless back-and-forth conversation flow

Works best with the Claude Code integration hook (see below).

---

## 🤖 Claude Code Integration

ONE includes a hook that reads Claude Code responses aloud using Piper TTS (neural text-to-speech).

### Setup

1. **Install Piper TTS:**
```bash
pip install piper-tts
```

2. **Download a voice model** (e.g., en_US-lessac-high):
```bash
mkdir -p ~/.local/share/piper-voices
cd ~/.local/share/piper-voices
# Download from https://github.com/rhasspy/piper/releases
```

3. **Copy the hook script:**
```bash
mkdir -p ~/.claude/hooks
cp claude-hooks/speak-response.sh ~/.claude/hooks/
chmod +x ~/.claude/hooks/speak-response.sh
```

4. **Register the hook** - Create or edit `~/.claude/settings.json`:
```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "/Users/YOURUSERNAME/.claude/hooks/speak-response.sh"
          }
        ]
      }
    ]
  }
}
```
*Replace `YOURUSERNAME` with your actual username.*

### How It Works

- Claude finishes → hook reads response aloud using Piper TTS
- ONE pauses transcription during TTS (saves API costs, prevents feedback)
- Toggle on/off with **Cmd+'**
- Say **"silence"** to stop current speech
- Falls back to macOS `say` if Piper not installed

See [claude-hooks/README.md](claude-hooks/README.md) for details.

---

## 📋 Requirements

- **macOS 13+ with Apple Silicon** (Intel Macs work but slower)
- **Node.js 18+**
- **Deepgram API key** (free tier available, no credit card required)
- **Anthropic API key** (optional, for AI commands)

### System Permissions

ONE requires these permissions (requested on first run):

1. **Microphone access**: To capture your voice
2. **Accessibility access**: To listen for global hotkeys
3. **Automation access - System Events**: To inject text into other applications

Grant permissions in **System Settings → Privacy & Security** for **your terminal app**!

---

## ⚙️ Configuration

### View Current Settings

```bash
s2t config
```

### Configure Individual Settings

```bash
# Change hotkey (default: ⌘;)
s2t config --hotkey

# Select language (default: English)
s2t config --language

# Update Deepgram API key
s2t config --deepgram-api-key
```

### Supported Languages

ONE supports 40+ languages including:
- English (US, UK, AU, NZ, IN)
- Spanish, French, German, Italian, Portuguese
- Chinese (Mandarin, Cantonese)
- Japanese, Korean, Hindi
- And 30+ more

See [supported languages](https://developers.deepgram.com/docs/models-languages-overview#nova-2) for the full list.

---

## 🗺️ Roadmap

ONE is evolving from voice typing to intelligent voice orchestration.

### Phase 1: Foundation (v0.7) ✅ COMPLETE
- [x] AI command understanding (Claude Haiku)
- [x] Personal command dictionary with auto-learning
- [x] Secure API key storage (macOS Keychain)
- [x] Fuzzy matching for command variations

### Phase 2: Training Mode (v0.8) 🎯 NEXT
- [ ] "Computer learn" - teach new commands through conversation
- [ ] Correction flow: "No, I meant..."
- [ ] Workflow creation: record multi-step sequences
- [ ] Voice feedback: "Got it, what should that do?"

### Phase 3: Context & Profiles (v0.9) 📋 PLANNED
- [ ] Per-app command profiles
- [ ] Auto-detect context (coding vs writing vs music)
- [ ] Context-aware command suggestions

### Phase 4: Multi-Agent Orchestration (v1.0) 🚀 VISION
- [ ] Spawn multiple AI agents via voice
- [ ] Task decomposition: "Build me a landing page"
- [ ] Agent coordination with voice feedback
- [ ] Voice-controlled workflow automation

See [.planning/one/ROADMAP.md](.planning/one/ROADMAP.md) for detailed specifications.

---

## 🛠️ Development

### Local Development Setup

```bash
# Clone the repository
git clone https://github.com/jessesep/speech2type.git
cd speech2type

# Install dependencies
npm install

# Build Swift components
npm run build

# Run in development mode
npm run dev
```

### Project Structure

```
speech2type/ (evolving to ONE)
├── src/
│   ├── index.js                  # Main application
│   ├── services/
│   │   ├── intent-resolver.js    # AI command understanding (v0.7)
│   │   ├── commands.js           # Personal dictionary (v0.7)
│   │   ├── secrets.js            # Keychain storage (v0.7)
│   │   ├── transcriber.js        # Deepgram integration
│   │   └── typer.js              # Text injection
│   └── data/
│       └── default_commands.json # Default command library
├── gui/                          # Electron menu bar app
├── swift/                        # Native macOS components
├── tests/                        # Vitest test suites (155 tests)
└── .planning/one/                # Future specs & roadmap
```

---

## 🔧 Troubleshooting

### Common Issues

**1. "Permission denied" errors**
- Grant microphone access: System Settings → Privacy & Security → Microphone
- Grant accessibility access: System Settings → Privacy & Security → Accessibility
- *Important*: Grant to your terminal app (Terminal, Warp, VS Code, etc.)

**2. "Command not found: s2t"**
- Reinstall: `npm install -g speech2type`
- Check PATH includes npm global binaries

**3. "AI commands not working"**
- Check API key is set in GUI settings
- Verify API key has credits in Anthropic console
- Check internet connection

**4. "Text not appearing"**
- Verify Deepgram API key is correct
- Check microphone is working
- Ensure permissions granted
- Verify internet connection

**5. "How to get a Deepgram API key?"**
- Go to https://deepgram.com/
- Sign up for free account (no credit card)
- Get API key from https://console.deepgram.com/
- Run `s2t config --deepgram-api-key` and paste key
- *Free tier: 50+ hours of credits*

### Debug Mode

Run with debug output:

```bash
DEBUG=1 s2t start
```

### Getting Help

- **Documentation**: This README and `s2t --help`
- **Issues**: [GitHub Issues](https://github.com/jessesep/speech2type/issues)
- **Discussions**: [GitHub Discussions](https://github.com/jessesep/speech2type/discussions)

---

## Full Command Reference

### Submit / Enter

| Say | Action |
|-----|--------|
| "affirmative" | Press Enter |
| "computer affirmative" | Press Enter |
| "computer enter" | Press Enter |
| "computer submit" | Press Enter |

### Undo / Delete

| Say | Action |
|-----|--------|
| "retract" | Delete last transcribed text |
| "computer retract" | Delete last transcribed text |
| "computer undo" | Delete last transcribed text |

*Say "retract" multiple times to undo multiple chunks (up to 20)*

### Clear Input

| Say | Action |
|-----|--------|
| "computer scratch" | Select all and delete |
| "computer scratch all" | Select all and delete |
| "computer scratch that" | Select all and delete |

### Text-to-Speech Control

| Say | Action |
|-----|--------|
| "computer speech on" | Enable TTS |
| "computer speech off" | Disable TTS |
| "silence" | Stop current TTS playback |

*Hotkey: Cmd+' toggles Claude auto-speak*

### Clipboard & Editing

| Say | Action |
|-----|--------|
| "computer copy" | Copy (Cmd+C) |
| "computer paste" | Paste (Cmd+V) |
| "computer cut" | Cut (Cmd+X) |
| "computer select all" | Select all (Cmd+A) |
| "computer save" | Save (Cmd+S) |
| "computer find" | Find (Cmd+F) |

### Window Management

| Say | Action |
|-----|--------|
| "computer new tab" | New tab (Cmd+T) |
| "computer close tab" | Close tab (Cmd+W) |
| "computer new window" | New window (Cmd+N) |

### App Switching (Full List)

Use prefixes: "focus", "switch to", "go to", "open"

| Say | App |
|-----|-----|
| "focus terminal" | Terminal |
| "focus chrome" / "focus google" / "focus browser" | Google Chrome |
| "focus safari" | Safari |
| "focus finder" / "focus files" | Finder |
| "focus code" / "focus vs code" / "focus vscode" | Visual Studio Code |
| "focus cursor" | Cursor |
| "focus slack" | Slack |
| "focus discord" | Discord |
| "focus spotify" / "focus music" | Spotify |
| "focus notes" | Notes |
| "focus messages" | Messages |
| "focus mail" / "focus email" | Mail |
| "focus preview" | Preview |
| "focus settings" / "focus preferences" | System Settings |

### Mode Switching

| Say | Mode |
|-----|------|
| "computer general mode" | General mode |
| "computer music mode" / "computer ableton mode" | Music (Ableton) mode |
| "computer power mode" / "computer claude mode" | Claude mode |

---

## 🤝 Contributing

We welcome contributions! Here's how:

1. **Fork the repository**
2. **Create feature branch**: `git checkout -b feature/amazing-feature`
3. **Make changes**: Follow existing code style
4. **Test thoroughly**: Ensure changes work on macOS
5. **Submit pull request**: Describe changes clearly

### Development Guidelines

- **Code style**: Follow existing JavaScript and Swift patterns
- **Testing**: Use Vitest framework, maintain >80% coverage
- **Documentation**: Update README for new features
- **Security**: Be mindful of permissions and API key handling

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🌟 Acknowledgments

- Built on [Speech2Type](https://github.com/nicobrenner/speech2type) by Nico Brenner
- Powered by [Deepgram](https://deepgram.com) for real-time transcription
- AI understanding via [Anthropic Claude](https://anthropic.com)
- TTS via [Piper](https://github.com/rhasspy/piper) neural voices

---

**ONE** - If you can speak there, you can command there.

*Evolving from voice typing to voice orchestration*

Official website: [https://speech2type.com](https://speech2type.com)
