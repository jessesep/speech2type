#!/bin/bash
# Start speech2type in a new Terminal window and announce ready

# Open Terminal and run s2t
osascript -e 'tell application "Terminal"
    activate
    do script "s2t start"
end tell'

# Wait a moment for s2t to start, then announce
sleep 2
say -v Samantha "I'm listening"
