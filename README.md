# Speech2Type

> **Voice typing from your terminal.**

A simple CLI tool that gives you fast voice typing in every Mac app. Instant speech-to-text from your terminal to your cursor with one hotkey - works with Claude Code, Cursor, and any macOS application.

It just works:
```bash
npm install -g speech2type && s2t start
```

[![NPM Version](https://img.shields.io/npm/v/speech2type)](https://www.npmjs.com/package/speech2type)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![macOS](https://img.shields.io/badge/macOS-13%2B-blue)](https://www.apple.com/macos/)

## ✨ Features

- **⚡️ Real-time transcription**: Your words appear instantly as you speak
- **💻 Works everywhere**: Claude Code, Cursor, Slack, Chrome, Lovable... any Mac app with text input
- **🎯 Inline-typing**: Text is inserted directly at the cursor's position (no clipboard involved).
- **💸 Completely free**: Open source with free Deepgram API tier
- **🌍 40+ languages**: English, Spanish, French, German, Japanese, Chinese, and many more

### Fork Features (jessesep/speech2type-fork)

This fork adds **voice commands** for hands-free control:

- **Submit text**: Say "affirmative" to press Enter
- **Undo text**: Say "retract" to delete the last spoken chunk
- **Switch apps**: Say "focus chrome" or "switch to terminal"
- **Switch Terminal windows**: Say "terminal 1" or "terminal claude"

See [Voice Commands](#voice-commands) for the complete list.

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

### Submit / Enter

| Say | Action |
|-----|--------|
| **"affirmative"** | Press Enter (submit text) |

### Undo / Delete Last Chunk

| Say | Action |
|-----|--------|
| **"retract"** | Delete the last transcribed text |
| "disregard" | Delete the last transcribed text |
| "scratch that" | Delete the last transcribed text |
| "belay that" | Delete the last transcribed text |
| "undo" | Delete the last transcribed text |

*You can say "retract" multiple times to undo multiple chunks (up to 20).*

### Text-to-Speech (Read Aloud)

Read clipboard contents aloud using macOS text-to-speech:

| Say | Action |
|-----|--------|
| **"read it"** | Read clipboard aloud |
| "read that" | Read clipboard aloud |
| "speak" | Read clipboard aloud |
| "read aloud" | Read clipboard aloud |

Stop speaking:

| Say | Action |
|-----|--------|
| **"silence"** | Stop reading |
| "quiet" | Stop reading |
| "hush" | Stop reading |
| "stop reading" | Stop reading |

*Tip: Copy Claude's response (Cmd+C), then say "read it" to hear it spoken aloud.*

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
git clone https://github.com/gergomiklos/speech2type.git
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
- **Issues**: [GitHub Issues](https://github.com/gergomiklos/speech2type/issues)
- **Discussions**: [GitHub Discussions](https://github.com/gergomiklos/speech2type/discussions)

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
