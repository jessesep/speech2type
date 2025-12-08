import Cocoa
import Foundation

/**
 * Focus Checker - Detects if the currently focused UI element is a text input
 *
 * Uses macOS Accessibility API to determine if the user's cursor is in a text field.
 * Returns JSON with focus state information.
 *
 * Requires Accessibility permission (System Settings > Privacy & Security > Accessibility)
 */

// Text input roles in macOS Accessibility API
let textInputRoles: Set<String> = [
    "AXTextField",
    "AXTextArea",
    "AXComboBox",
    "AXSearchField",
    "AXStaticText",  // Some editable text views
]

// Subroles that indicate editable content
let editableSubroles: Set<String> = [
    "AXPlainTextArea",
    "AXTextArea",
    "AXSecureTextField",
    "AXSearchField",
]

struct FocusInfo {
    var isTextInput: Bool = false
    var role: String = ""
    var subrole: String = ""
    var appName: String = ""
    var isEditable: Bool = false
    var hasSelectedTextRange: Bool = false
}

func getAttributeValue(_ element: AXUIElement, _ attribute: String) -> AnyObject? {
    var value: AnyObject?
    let result = AXUIElementCopyAttributeValue(element, attribute as CFString, &value)
    if result == .success {
        return value
    }
    return nil
}

func checkFocusedElement() -> FocusInfo {
    var info = FocusInfo()

    // Get system-wide accessibility element
    let systemWide = AXUIElementCreateSystemWide()

    // Get focused application
    if let focusedApp = getAttributeValue(systemWide, kAXFocusedApplicationAttribute) {
        let appElement = focusedApp as! AXUIElement
        if let appName = getAttributeValue(appElement, kAXTitleAttribute) as? String {
            info.appName = appName
        }

        // For Chrome/Electron apps, try to enable enhanced accessibility
        AXUIElementSetAttributeValue(appElement, "AXEnhancedUserInterface" as CFString, true as CFTypeRef)
        AXUIElementSetAttributeValue(appElement, "AXManualAccessibility" as CFString, true as CFTypeRef)
    }

    // Get focused UI element
    guard let focusedElement = getAttributeValue(systemWide, kAXFocusedUIElementAttribute) else {
        return info
    }

    let element = focusedElement as! AXUIElement

    // Get role
    if let role = getAttributeValue(element, kAXRoleAttribute) as? String {
        info.role = role

        // Check if it's a known text input role
        if textInputRoles.contains(role) {
            info.isTextInput = true
        }
    }

    // Get subrole
    if let subrole = getAttributeValue(element, kAXSubroleAttribute) as? String {
        info.subrole = subrole

        // Check if it's an editable subrole
        if editableSubroles.contains(subrole) {
            info.isTextInput = true
            info.isEditable = true
        }
    }

    // Check if element has selected text range (indicates text input)
    if let _ = getAttributeValue(element, kAXSelectedTextRangeAttribute) {
        info.hasSelectedTextRange = true
        info.isTextInput = true
    }

    // Check if element has value attribute and is editable
    if let _ = getAttributeValue(element, kAXValueAttribute) {
        // Check if we can set the value (indicates editable)
        var settableAttributes: CFArray?
        if AXUIElementCopyActionNames(element, &settableAttributes) == .success {
            // Has actions, might be interactive
        }
    }

    // Additional check: see if AXInsertionPointLineNumber exists (text cursor)
    if let _ = getAttributeValue(element, "AXInsertionPointLineNumber") {
        info.isTextInput = true
        info.isEditable = true
    }

    // Check role description for web text inputs
    if let roleDesc = getAttributeValue(element, kAXRoleDescriptionAttribute) as? String {
        let lowerDesc = roleDesc.lowercased()
        if lowerDesc.contains("text") || lowerDesc.contains("edit") || lowerDesc.contains("input") {
            info.isTextInput = true
        }
    }

    return info
}

func main() {
    // Check if we have accessibility permission
    guard AXIsProcessTrusted() else {
        let result: [String: Any] = [
            "error": "accessibility_not_granted",
            "isTextInput": false
        ]
        printJSON(result)
        exit(1)
    }

    let info = checkFocusedElement()

    let result: [String: Any] = [
        "isTextInput": info.isTextInput,
        "isEditable": info.isEditable,
        "role": info.role,
        "subrole": info.subrole,
        "appName": info.appName,
        "hasSelectedTextRange": info.hasSelectedTextRange
    ]

    printJSON(result)
    exit(0)
}

func printJSON(_ dict: [String: Any]) {
    do {
        let jsonData = try JSONSerialization.data(withJSONObject: dict, options: [])
        print(String(data: jsonData, encoding: .utf8) ?? "{}")
    } catch {
        print("{\"error\": \"json_serialization_failed\"}")
    }
}

main()
