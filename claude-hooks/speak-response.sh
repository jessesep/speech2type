#!/bin/bash
# Claude Code Stop Hook - Speaks Claude's response via TTS
# Receives JSON with transcript_path pointing to conversation JSONL file

# Check if auto-speak is enabled (control file)
CONTROL_FILE="/tmp/claude-auto-speak"
if [[ ! -f "$CONTROL_FILE" ]]; then
    exit 0
fi

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

    print(last_assistant_text)
except Exception as e:
    pass
" "$TRANSCRIPT_PATH" 2>/dev/null)

# If we got text, speak it
if [[ -n "$TRANSCRIPT" ]]; then
    # Create a lock file to signal speech is happening (for speech2type to check)
    SPEAKING_LOCK="/tmp/claude-tts-speaking"
    touch "$SPEAKING_LOCK"

    # Speak the response (Samantha voice, 200 wpm)
    /usr/bin/say -v Samantha -r 200 "$TRANSCRIPT"

    # Remove lock file when done
    rm -f "$SPEAKING_LOCK"
fi
