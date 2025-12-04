import AVFoundation
import Foundation

// Get text from command line argument or stdin
var textToSpeak = ""

if CommandLine.arguments.count > 1 {
    textToSpeak = CommandLine.arguments.dropFirst().joined(separator: " ")
} else {
    // Read from stdin
    while let line = readLine() {
        textToSpeak += line + " "
    }
}

textToSpeak = textToSpeak.trimmingCharacters(in: .whitespacesAndNewlines)

if textToSpeak.isEmpty {
    fputs("Usage: siri-speak <text> or echo <text> | siri-speak\n", stderr)
    exit(1)
}

// List available voices if --list flag
if textToSpeak == "--list" {
    let voices = AVSpeechSynthesisVoice.speechVoices()
    for voice in voices.filter({ $0.language.starts(with: "en") }) {
        print("\(voice.identifier) - \(voice.name) (\(voice.language))")
    }
    exit(0)
}

// Create synthesizer
let synthesizer = AVSpeechSynthesizer()

// Find a Siri voice by identifier
let voices = AVSpeechSynthesisVoice.speechVoices()
var selectedVoice: AVSpeechSynthesisVoice?

// Preferred Siri voices in order (US English first, then UK, then AU)
let preferredVoiceIds = [
    "com.apple.ttsbundle.siri_aaron_en-US_compact",
    "com.apple.ttsbundle.siri_nicky_en-US_compact",
    "com.apple.ttsbundle.siri_martha_en-GB_compact",
    "com.apple.ttsbundle.siri_arthur_en-GB_compact",
    "com.apple.ttsbundle.siri_gordon_en-AU_compact",
    "com.apple.ttsbundle.siri_catherine_en-AU_compact"
]

// Try to find a Siri voice
for voiceId in preferredVoiceIds {
    if let voice = AVSpeechSynthesisVoice(identifier: voiceId) {
        selectedVoice = voice
        fputs("[siri-speak] Using Siri voice: \(voice.name)\n", stderr)
        break
    }
}

// Fallback: look for any voice with "siri" in the identifier
if selectedVoice == nil {
    for voice in voices {
        if voice.identifier.lowercased().contains("siri") && voice.language.starts(with: "en") {
            selectedVoice = voice
            fputs("[siri-speak] Using Siri voice: \(voice.name) (\(voice.identifier))\n", stderr)
            break
        }
    }
}

// Fallback to Samantha
if selectedVoice == nil {
    selectedVoice = AVSpeechSynthesisVoice(language: "en-US")
    fputs("[siri-speak] Using default voice\n", stderr)
}

let utterance = AVSpeechUtterance(string: textToSpeak)
utterance.voice = selectedVoice
utterance.rate = 0.52  // Slightly faster than default (0.5)
utterance.pitchMultiplier = 1.0
utterance.volume = 1.0

// Use a delegate to know when speech is done
class SpeechDelegate: NSObject, AVSpeechSynthesizerDelegate {
    let semaphore = DispatchSemaphore(value: 0)

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didFinish utterance: AVSpeechUtterance) {
        semaphore.signal()
    }

    func speechSynthesizer(_ synthesizer: AVSpeechSynthesizer, didCancel utterance: AVSpeechUtterance) {
        semaphore.signal()
    }
}

let delegate = SpeechDelegate()
synthesizer.delegate = delegate

synthesizer.speak(utterance)

// Wait for speech to complete
delegate.semaphore.wait()
