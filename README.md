# Speech2Type Enhanced

> **Voice typing from your terminal with voice commands.**

A CLI tool for fast voice typing in every Mac app. Includes voice commands like "affirmative" (Enter), "retract" (undo), and Claude Code integration for automatic text-to-speech responses.

## Installation

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

## ✨ Features

- **⚡️ Real-time transcription**: Your words appear instantly as you speak
- **💻 Works everywhere**: Claude Code, Cursor, Slack, Chrome, Lovable... any Mac app with text input
- **🎯 Inline-typing**: Text is inserted directly at the cursor's position (no clipboard involved).
- **💸 Completely free**: Open source with free Deepgram API tier
- **🌍 40+ languages**: English, Spanish, French, German, Japanese, Chinese, and many more

### Voice Commands

| Say | Action |
|-----|--------|
| **"affirmative"** | Press Enter (submit) |
| **"retract"** | Undo last spoken text |
| **"retract everything confirm"** | Clear entire input field |
| **"silence"** | Stop text-to-speech |
| **"focus chrome"** | Switch to app |
| **"terminal 1"** | Switch Terminal window |

### Hotkeys

| Key | Action |
|-----|--------|
| **Cmd+;** | Start/stop voice typing |
| **Cmd+'** | Toggle Claude auto-speak |
| **Cmd+Option** (hold) | Push-to-talk in Music mode |
| **Spacebar** | Stop TTS while speaking |

### Modes

Speech2Type has three operating modes:

| Mode | Activation | Description |
|------|------------|-------------|
| **General** | "computer general mode" | Default mode for everyday use |
| **Music** | "computer music mode" | Ableton Live voice control with push-to-talk |
| **Claude** | "computer power mode" | Auto-pause after submit, resume after response |

See [Voice Commands](#voice-commands-1), [Modes](#-modes), and [Claude Code Integration](#claude-code-integration) for full details.

### Perfect for:
- **Developers**: Vibe coding in any environment (Claude Code CLI, Cursor IDE, etc.)
- **Creators**: Dictating in any text editor
- **Productivity**: Quick voice input in Slack, email, and more

## 🚀 Quick Start

### Installation

```bash
npm install -g speech2type
```

### First Run

```bash
# Start the application
# s2t or s2t start
s2t start

# Follow the setup wizard to:
# 1. Get your FREE Deepgram API key from https://deepgram.com
# 2. Configure your language preference (default: English)
# 3. Set up your hotkey (default: ⌘;)
# 4. Grant microphone and accessibility permissions
```

### Usage

1. **Start the app**: Run `s2t start` in your terminal
2. **Position your cursor**: Click in where you want text to appear
3. **Press your hotkey**: Default is ⌘; to start listening
4. **Speak**: Your words will appear in real-time at your cursor
5. **Press hotkey again**: Stop listening

That's it! You now have voice typing in every Mac app.

## 🎤 Voice Commands

This fork includes voice commands for hands-free control. All commands work with punctuation (e.g., "Affirmative." works the same as "affirmative").

### Command Prefix

All voice commands require the **"computer"** prefix to avoid conflicts with normal speech. The exceptions are "affirmative" and "retract" which work without the prefix for faster workflow.

The app automatically normalizes "computers" to "computer" (common speech recognition error).

### Submit / Enter

| Say | Action |
|-----|--------|
| **"affirmative"** | Press Enter (submit text) |
| **"computer affirmative"** | Press Enter (submit text) |
| **"computer enter"** | Press Enter (submit text) |
| **"computer submit"** | Press Enter (submit text) |

### Undo / Delete Last Chunk

| Say | Action |
|-----|--------|
| **"retract"** | Delete the last transcribed text |
| **"computer retract"** | Delete the last transcribed text |
| **"computer undo"** | Delete the last transcribed text |

*You can say "retract" multiple times to undo multiple chunks (up to 20).*

### Clear Entire Input Field

| Say | Action |
|-----|--------|
| **"computer scratch"** | Select all and delete (clears the input field) |
| **"computer scratch all"** | Select all and delete (clears the input field) |
| **"computer scratch that"** | Select all and delete (clears the input field) |

### Text-to-Speech Control

| Say | Action |
|-----|--------|
| **"computer speech on"** | Enable text-to-speech |
| **"computer speech off"** | Disable text-to-speech |
| **"computer text to speech on"** | Enable text-to-speech |
| **"computer text to speech off"** | Disable text-to-speech |

*You can also press Cmd+' to toggle Claude auto-speak, or Spacebar to stop current TTS playback.*

### Clipboard & Editing

| Say | Action |
|-----|--------|
| **"computer copy"** | Copy selection (Cmd+C) |
| **"computer paste"** | Paste (Cmd+V) |
| **"computer cut"** | Cut selection (Cmd+X) |
| **"computer select all"** | Select all (Cmd+A) |
| **"computer save"** | Save (Cmd+S) |
| **"computer find"** | Find (Cmd+F) |

### Window Management

| Say | Action |
|-----|--------|
| **"computer new tab"** | New tab (Cmd+T) |
| **"computer close tab"** | Close tab (Cmd+W) |
| **"computer new window"** | New window (Cmd+N) |

### Listening Control

| Say | Action |
|-----|--------|
| **"computer stop listening"** | Stop voice recognition |

### App Switching

Use any of these prefixes: **"focus"**, **"switch to"**, **"go to"**, **"open"**

| Say | Switches To |
|-----|-------------|
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

### Terminal Window Switching

Switch between multiple Terminal windows by index or by searching window titles:

| Say | Action |
|-----|--------|
| **"terminal 1"** | Switch to Terminal window 1 |
| **"terminal 2"** | Switch to Terminal window 2 |
| **"window 1"** | Switch to Terminal window 1 |
| **"terminal claude"** | Switch to Terminal window containing "claude" in title |
| **"terminal ssh"** | Switch to Terminal window containing "ssh" in title |
| **"window with code"** | Switch to Terminal window containing "code" in title |

*Note: Terminal window titles typically show the current directory and running command.*

## 🎛️ Modes

Speech2Type supports three operating modes, each optimized for different workflows.

### General Mode (Default)

The standard mode for everyday voice typing. All commands work with the "computer" prefix.

**Activate:** "computer general mode" (or start fresh)

### Music Mode (Ableton Live)

Voice control for Ableton Live via OSC. Features push-to-talk for non-intrusive control during music production.

**Activate:** "computer music mode" or "computer ableton mode"

**Features:**
- **Push-to-talk**: Hold Cmd+Option to speak, release to auto-submit
- **OSC Integration**: Controls Ableton via AbletonOSC
- **Extensive commands**: Transport, track controls, scene management, and more

See [Ableton Voice Commands](docs/ableton-voice-commands.md) for full documentation.

**Requirements:**
- Ableton Live 11+
- [AbletonOSC](https://github.com/ideoforms/AbletonOSC) installed and enabled

### Claude Mode (Power Mode)

Optimized for conversations with Claude Code. Automatically pauses listening after you submit, then resumes when Claude finishes responding.

**Activate:** "computer power mode" or "computer claude mode"

**Features:**
- **Auto-pause**: Listening stops after "affirmative" (submit)
- **Auto-resume**: Listening restarts when Claude's response completes
- **Seamless workflow**: No manual toggling needed during conversation

This mode works best with the Claude Code integration hook installed.

### Mode Commands

These commands work in any mode:

| Voice Command | Action |
|---------------|--------|
| "computer general mode" | Switch to General mode |
| "computer music mode" | Switch to Music (Ableton) mode |
| "computer ableton mode" | Switch to Music (Ableton) mode |
| "computer power mode" | Switch to Claude mode |
| "computer claude mode" | Switch to Claude mode |

## 🤖 Claude Code Integration

This fork includes a hook that automatically reads Claude Code responses aloud using Piper TTS (neural text-to-speech).

### Hotkeys

| Hotkey | Action |
|--------|--------|
| **Cmd+;** | Start/stop voice typing |
| **Cmd+'** | Toggle Claude auto-speak on/off |

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
# Look for en_US-lessac-high.onnx and en_US-lessac-high.onnx.json
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

5. **Enable auto-speak by default** (optional) - Add to `~/.zshrc`:
```bash
touch /tmp/claude-auto-speak
```

### How It Works

- When Claude finishes responding, the hook reads the response aloud using Piper TTS
- The voice is tuned for natural speech (faster generation, deeper pitch)
- Speech2type pauses transcription while TTS is active (saves Deepgram API costs, prevents feedback loops)
- Toggle on/off anytime with **Cmd+'**
- Say **"silence"** to stop current speech
- Falls back to macOS `say` command if Piper is not installed

See [claude-hooks/README.md](claude-hooks/README.md) for detailed documentation.

## 📋 Requirements

- **macOS 13+ with Apple Silicon**
- **Node.js 18+** 
- **Deepgram API key** (free tier available, no credit card required)
- **Xcode Command Line Tools** (only for development)

### System Permissions

Speech2Type requires two permissions that will be requested on first run:

1. **Microphone access**: To capture your voice
2. **Accessibility access**: To listen global hotkeys
3. **Automation access - System Events**: To inject text into other applications

Grant these permissions in **System Settings → Privacy & Security** for **your terminal app from which you run Speech2Type**!

## ⚙️ Configuration

### View Current Settings

```bash
s2t config
```

### Configure Individual Settings

```bash
# Change hotkey combination (default: ⌘;)
s2t config --hotkey

# Select language for speech recognition (default: English)
s2t config --language

# Update your Deepgram API key (or set the DEEPGRAM_API_KEY environment variable)
s2t config --deepgram-api-key
```

### Supported Languages

Speech2Type supports 40+ languages including:
- Bulgarian: bg,
- Catalan: ca,
- Chinese (Mandarin, Simplified):zh, zh-CN,zh-Hans,
- Chinese (Mandarin, Traditional):zh-TW,zh-Hant,
- Chinese (Cantonese, Traditional): zh-HK,
- Czech: cs,
- Danish: da, da-DK,
- Dutch: nl,
- English: en, en-US, en-AU, en-GB, en-NZ, en-IN,
- Estonian: et,
- Finnish: fi,
- Flemish: nl-BE,
- French: fr, fr-CA,
- German: de,
- German (Switzerland): de-CH,
- Greek: el,
- Hindi: hi,
- Hungarian: hu,
- Indonesian: id,
- Italian: it,
- Japanese: ja,
- Korean: ko, ko-KR,
- Latvian: lv,
- Lithuanian: lt,
- Malay: ms,
- Norwegian: no,
- Polish: pl,
- Portuguese: pt, pt-BR, pt-PT,
- Romanian: ro,
- Russian: ru,
- Slovak: sk,
- Spanish: es, es-419,
- Swedish: sv, sv-SE,
- Thai: th, th-TH,
- Turkish: tr,
- Ukrainian: uk,
- Vietnamese: vi

See [supported languages](https://developers.deepgram.com/docs/models-languages-overview#nova-2) for the up-to-date full list.


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
speech2type/
├── bin/                   # Executable scripts
│   └── speech2type        # Main CLI entry point
├── src/                   # JavaScript source code
│   ├── index.js           # Main application logic
│   ├── config.js          # Configuration management
│   └── services/          # Core services
│       ├── hotkey.js      # Global hotkey management
│       ├── transcriber.js # Deepgram integration
│       └── typer.js       # Text injection via osascript
|       └── permission.js  # macOS permission handling
├── data/                  # Language data
│   └── languages.json     # Supported languages
└── swift/                 # Native Swift components
    ├── hotkey-manager.swift     # Global hotkey capture
    ├── mic-recorder.swift       # Audio recording
    └── permission-checker.swift # System permissions
```

## 🔧 Troubleshooting

### Common Issues

**1. "Permission denied" errors**
- Grant microphone access to your terminal app in System Settings → Privacy & Security → Microphone
- Grant accessibility access to your terminal app in System Settings → Privacy & Security → Accessibility


  *Important: the terminal app must be the one that is running Speech2Type.
  Common terminal apps: Terminal (built-in macOS terminal), Cursor (integrated in-app terminals), Warp, VS Code...*


**2. "Command not found: s2t"**
- Reinstall globally: `npm install -g speech2type`
- Check your PATH includes npm global binaries

**3. "Hotkey not working"**
- Check for conflicts with other applications
- Reconfigure hotkey with: `s2t config --hotkey`
- Ensure permissions are granted

**4. "Text not appearing"**
- Ensure your deepgram api key is correct
- Check your microphone is working
- Check you have internet connection
- Ensure permissions are granted

**5. "Text not appearing in secure fields"**
- This is by design - secure input fields (passwords) don't accept simulated typing
- Speech2Type works in regular text fields only

**6. "How to get a Deepgram API key?"**
- Go to https://deepgram.com/
- Sign up for a free account
- Go to https://console.deepgram.com/
- Click on "API Keys"
- Click on "Create API Key"
- Copy the API key
- Run `s2t config --deepgram-api-key` and paste the API key

  *The free tier includes more than 50 hours of credits. No credit card required.*

FAQ: [https://speech2type.com/faq](https://speech2type.com/faq)

### Debug Mode

Run with debug output for troubleshooting:

```bash
DEBUG=1 s2t start
```

### Getting Help

- **Documentation**: This README and inline help (`s2t --help`)
- **Issues**: [GitHub Issues](https://github.com/jessesep/speech2type/issues)
- **Discussions**: [GitHub Discussions](https://github.com/jessesep/speech2type/discussions)

## 🤝 Contributing

We welcome contributions! Here's how to get started:

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/amazing-feature`
3. **Make your changes**: Follow the existing code style
4. **Test thoroughly**: Ensure your changes work on macOS
5. **Submit a pull request**: Describe your changes clearly

### Development Guidelines

- **Code style**: Follow existing JavaScript and Swift patterns
- **Testing**: Test on multiple macOS versions when possible
- **Documentation**: Update README for new features
- **Permissions**: Be mindful of security and privacy implications

### Why not Whisper?

Deepgram provides real-time streaming, higher accuracy, wider language support with reasonable low cost and developer-friendly APIs, allowing Speech2Type to remain native and lightweight (Speech2Type is not affiliated with Deepgram).

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🌟 Support the Project

If Speech2Type helps your workflow, consider:
- Starring the repository
- Reporting bugs and suggesting features  
- Improving documentation
- Contributing code
- Sharing with others who might benefit

---

**Speech2Type** - If you can type there, you can speak there.

Official website: [https://speech2type.com](https://speech2type.com)

*Built with ❤️*
