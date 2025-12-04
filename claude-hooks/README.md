# Claude Code Auto-Speak Hook

This hook automatically reads Claude Code responses aloud using macOS text-to-speech.

## Features

- Speaks Claude's responses automatically when enabled
- Toggle on/off with **Cmd+'** (when speech2type is running)
- Creates a lock file while speaking so speech2type pauses transcription (prevents feedback loops)
- Limits responses to 2000 characters to avoid overly long readings

## Installation

### 1. Copy the hook script

```bash
mkdir -p ~/.claude/hooks
cp speak-response.sh ~/.claude/hooks/
chmod +x ~/.claude/hooks/speak-response.sh
```

### 2. Register the hook in Claude Code settings

Create or edit `~/.claude/settings.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "matcher": "*",
        "hooks": [
          {
            "type": "command",
            "command": "~/.claude/hooks/speak-response.sh"
          }
        ]
      }
    ]
  }
}
```

**Note:** Replace `~/.claude/hooks/speak-response.sh` with the full absolute path (e.g., `/Users/yourusername/.claude/hooks/speak-response.sh`).

### 3. Enable auto-speak

The hook only speaks when `/tmp/claude-auto-speak` exists. To enable:

```bash
touch /tmp/claude-auto-speak
```

To disable:

```bash
rm /tmp/claude-auto-speak
```

### 4. (Optional) Enable by default on startup

Add to your `~/.zshrc` or `~/.bashrc`:

```bash
# Enable Claude auto-speak by default
touch /tmp/claude-auto-speak
```

## Usage with Speech2Type

When using speech2type alongside this hook:

- **Cmd+;** - Start/stop voice typing
- **Cmd+'** - Toggle auto-speak on/off
- Say **"silence"** - Stop current speech

The hook creates `/tmp/claude-tts-speaking` while speaking, which speech2type monitors to pause transcription and prevent feedback loops.

## Customization

Edit `speak-response.sh` to change:

- **Voice**: Change `-v Samantha` to another voice (run `say -v ?` to list available voices)
- **Speed**: Change `-r 200` to adjust words per minute
- **Character limit**: Modify the `2000` limit in the Python script

## Troubleshooting

**Hook not triggering:**
- Restart Claude Code after modifying settings.json
- Check the hook path is absolute in settings.json
- Verify the script is executable: `chmod +x ~/.claude/hooks/speak-response.sh`

**No speech output:**
- Check auto-speak is enabled: `ls /tmp/claude-auto-speak`
- Test manually: `echo "test" | say`
- Check macOS sound output settings

**Wrong transcript being read:**
- The hook reads the last assistant message from the current session transcript
