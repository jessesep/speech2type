#!/bin/bash
# Start speech2type in a new Terminal window with auto-listening

osascript -e 'tell application "Terminal"
    activate
    do script "s2t start --auto"
end tell'
