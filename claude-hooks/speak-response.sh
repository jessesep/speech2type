#!/bin/bash
# Claude Code Stop Hook - Speaks Claude's response via TTS
# Receives JSON with transcript_path pointing to conversation JSONL file
#
# Setup:
# 1. Install Piper TTS: pip install piper-tts
# 2. Download a voice model (e.g., en_US-lessac-high.onnx) from:
#    https://github.com/rhasspy/piper/releases
# 3. Place voice model in ~/.local/share/piper-voices/
# 4. Copy this script to ~/.claude/hooks/speak-response.sh
# 5. Add to ~/.claude/settings.json:
#    {
#      "hooks": {
#        "Stop": [{
#          "matcher": "*",
#          "hooks": [{"type": "command", "command": "~/.claude/hooks/speak-response.sh"}]
#        }]
#      }
#    }
# 6. Create control file to enable: touch /tmp/claude-auto-speak
#    Or toggle with speech2type's Cmd+' hotkey
#
# Configuration (optional):
#   Set TTS_VOLUME environment variable (0.0 to 1.0, default: 0.3)
#   Set TTS_SPEED environment variable (default: 0.55, lower = slower)
#   Set TTS_PITCH environment variable (default: 0.85, lower = deeper)
#
#   Example: Add to ~/.zshrc:
#     export TTS_VOLUME=0.4
#     export TTS_SPEED=0.6
#     export TTS_PITCH=0.9

# Check if auto-speak is enabled (control file)
CONTROL_FILE="/tmp/claude-auto-speak"
if [[ ! -f "$CONTROL_FILE" ]]; then
    exit 0
fi

# TTS settings (configurable via environment variables)
TTS_VOLUME="${TTS_VOLUME:-0.3}"
TTS_SPEED="${TTS_SPEED:-0.55}"
TTS_PITCH="${TTS_PITCH:-0.85}"

# Read JSON from stdin
INPUT=$(cat)

# Extract the transcript_path from the hook data
TRANSCRIPT_PATH=$(echo "$INPUT" | python3 -c "
import sys, json
try:
    data = json.load(sys.stdin)
    path = data.get('transcript_path', '')
    # Expand ~ to home directory
    if path.startswith('~'):
        import os
        path = os.path.expanduser(path)
    print(path)
except:
    pass
" 2>/dev/null)

# If no transcript path, exit
if [[ -z "$TRANSCRIPT_PATH" || ! -f "$TRANSCRIPT_PATH" ]]; then
    exit 0
fi

# Extract the last assistant message from the JSONL transcript
# Claude Code format: {"type": "assistant", "message": {"role": "assistant", "content": [...]}}
TRANSCRIPT=$(python3 -c "
import json
import sys

transcript_path = sys.argv[1]
last_assistant_text = ''

try:
    with open(transcript_path, 'r') as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            try:
                entry = json.loads(line)
                # Claude Code format: type field indicates message type
                if entry.get('type') == 'assistant':
                    message = entry.get('message', {})
                    content = message.get('content', [])
                    text_parts = []
                    for block in content:
                        if isinstance(block, dict) and block.get('type') == 'text':
                            text_parts.append(block.get('text', ''))
                        elif isinstance(block, str):
                            text_parts.append(block)
                    if text_parts:
                        last_assistant_text = ' '.join(text_parts)
            except json.JSONDecodeError:
                continue

    # Limit to reasonable length for TTS (first 2000 chars)
    if len(last_assistant_text) > 2000:
        last_assistant_text = last_assistant_text[:2000] + '... (truncated)'

    # Clean up text for natural speech
    import re

    # URLs
    last_assistant_text = re.sub(r'https?://[^\s\)\]]+', 'website', last_assistant_text)
    # File paths (Unix style)
    last_assistant_text = re.sub(r'(?:~|/)[^\s\)\]]*(?:/[^\s\)\]]+)+', 'filepath', last_assistant_text)

    # Remove markdown formatting
    last_assistant_text = re.sub(r'\*\*([^*]+)\*\*', r'\1', last_assistant_text)  # **bold**
    last_assistant_text = re.sub(r'\*([^*]+)\*', r'\1', last_assistant_text)  # *italic*
    last_assistant_text = re.sub(r'\`[^\`]+\`', '', last_assistant_text)  # `code`
    last_assistant_text = re.sub(r'\`\`\`[\s\S]*?\`\`\`', '', last_assistant_text)  # code blocks
    last_assistant_text = re.sub(r'^#{1,6}\s+', '', last_assistant_text, flags=re.MULTILINE)  # headers
    last_assistant_text = re.sub(r'^\s*[-*+]\s+', '', last_assistant_text, flags=re.MULTILINE)  # bullet points
    last_assistant_text = re.sub(r'^\s*\d+\.\s+', '', last_assistant_text, flags=re.MULTILINE)  # numbered lists
    last_assistant_text = re.sub(r'\[([^\]]+)\]\([^)]+\)', r'\1', last_assistant_text)  # [link](url)
    last_assistant_text = re.sub(r'[*_~\`#|>]', '', last_assistant_text)  # remaining symbols
    last_assistant_text = re.sub(r'\s+', ' ', last_assistant_text).strip()  # normalize whitespace

    print(last_assistant_text)
except Exception as e:
    pass
" "$TRANSCRIPT_PATH" 2>/dev/null)

# If we got text, speak it
if [[ -n "$TRANSCRIPT" ]]; then
    # Create a lock file to signal speech is happening (for speech2type to check)
    SPEAKING_LOCK="/tmp/claude-tts-speaking"
    touch "$SPEAKING_LOCK"

    # Piper TTS configuration
    # Find piper binary (check common locations)
    PIPER_BIN=$(which piper 2>/dev/null || echo "$HOME/Library/Python/3.10/bin/piper")
    PIPER_MODEL="$HOME/.local/share/piper-voices/en_US-lessac-high.onnx"
    TMP_WAV="/tmp/claude-tts-$$.wav"

    if [[ -x "$PIPER_BIN" && -f "$PIPER_MODEL" ]]; then
        # Generate with configurable speed, play with configurable pitch and volume
        echo "$TRANSCRIPT" | "$PIPER_BIN" --model "$PIPER_MODEL" --length_scale "$TTS_SPEED" --output_file "$TMP_WAV" 2>/dev/null
        afplay -v "$TTS_VOLUME" -r "$TTS_PITCH" "$TMP_WAV"
        rm -f "$TMP_WAV"
    else
        # Fallback to macOS say command if Piper not available
        /usr/bin/say -v Samantha -r 200 "$TRANSCRIPT"
    fi

    # Wait a moment after speaking before removing lock
    # This prevents speech2type from picking up residual audio
    sleep 0.5

    # Remove lock file when done
    rm -f "$SPEAKING_LOCK"
fi
