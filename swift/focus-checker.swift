import Cocoa
import Foundation

/**
 * Focus Checker - Detects if the currently focused UI element is a text input
 *
 * Uses macOS Accessibility API to determine if the user's cursor is in a text field.
 * Returns JSON with focus state information.
 *
 * Requires Accessibility permission (System Settings > Privacy & Security > Accessibility)
 * The PARENT PROCESS (Terminal, Electron app, etc.) must have accessibility permissions.
 */

// Text input roles in macOS Accessibility API
let textInputRoles: Set<String> = [
    "AXTextField",
    "AXTextArea",
    "AXComboBox",
    "AXSearchField",
]

// Roles that need additional editable check (not text input by default)
let conditionalTextRoles: Set<String> = [
    "AXStaticText",  // Only if editable
    "AXWebArea",     // Only if editable (whole page isn't a text input)
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
    var appBundleId: String = ""
    var isEditable: Bool = false
    var hasSelectedTextRange: Bool = false
    var debug: String = ""
    var error: String = ""
}

func getAttributeValue(_ element: AXUIElement, _ attribute: String) -> AnyObject? {
    var value: AnyObject?
    let result = AXUIElementCopyAttributeValue(element, attribute as CFString, &value)
    if result == .success {
        return value
    }
    return nil
}

func axErrorDescription(_ error: AXError) -> String {
    switch error {
    case .success: return "success"
    case .failure: return "failure"
    case .illegalArgument: return "illegal_argument"
    case .invalidUIElement: return "invalid_ui_element"
    case .invalidUIElementObserver: return "invalid_ui_element_observer"
    case .cannotComplete: return "cannot_complete"
    case .attributeUnsupported: return "attribute_unsupported"
    case .actionUnsupported: return "action_unsupported"
    case .notificationUnsupported: return "notification_unsupported"
    case .notImplemented: return "not_implemented"
    case .notificationAlreadyRegistered: return "notification_already_registered"
    case .notificationNotRegistered: return "notification_not_registered"
    case .apiDisabled: return "api_disabled"
    case .noValue: return "no_value"
    case .parameterizedAttributeUnsupported: return "parameterized_attribute_unsupported"
    case .notEnoughPrecision: return "not_enough_precision"
    @unknown default: return "unknown_\(error.rawValue)"
    }
}

func getFrontmostAppInfo() -> (name: String, bundleId: String, pid: pid_t)? {
    if let app = NSWorkspace.shared.frontmostApplication {
        return (
            name: app.localizedName ?? "Unknown",
            bundleId: app.bundleIdentifier ?? "",
            pid: app.processIdentifier
        )
    }
    return nil
}

func checkFocusedElement() -> FocusInfo {
    var info = FocusInfo()
    var debugLog = [String]()

    // First, get frontmost app via NSWorkspace (more reliable)
    if let appInfo = getFrontmostAppInfo() {
        info.appName = appInfo.name
        info.appBundleId = appInfo.bundleId
        debugLog.append("frontmost app: \(appInfo.name) (\(appInfo.bundleId))")

        // Create AXUIElement for this specific app by PID
        let appElement = AXUIElementCreateApplication(appInfo.pid)

        // For Chrome/Electron apps, try to enable enhanced accessibility
        AXUIElementSetAttributeValue(appElement, "AXEnhancedUserInterface" as CFString, true as CFTypeRef)
        AXUIElementSetAttributeValue(appElement, "AXManualAccessibility" as CFString, true as CFTypeRef)

        // Try to get focused element from the app
        var focusedUIElement: AnyObject?
        let focusResult = AXUIElementCopyAttributeValue(appElement, kAXFocusedUIElementAttribute as CFString, &focusedUIElement)

        if focusResult == .success, let element = focusedUIElement {
            debugLog.append("got focused element")
            let axElement = element as! AXUIElement

            // Get role
            if let role = getAttributeValue(axElement, kAXRoleAttribute) as? String {
                info.role = role
                debugLog.append("role: \(role)")

                // Check if it's a definite text input role
                if textInputRoles.contains(role) {
                    info.isTextInput = true
                    debugLog.append("matched text role")
                }
                // Conditional roles only count if editable (checked later)
                // Don't set isTextInput here for AXWebArea, AXStaticText, etc.
            }

            // Get subrole
            if let subrole = getAttributeValue(axElement, kAXSubroleAttribute) as? String {
                info.subrole = subrole
                debugLog.append("subrole: \(subrole)")

                // Check if it's an editable subrole
                if editableSubroles.contains(subrole) {
                    info.isTextInput = true
                    info.isEditable = true
                    debugLog.append("matched editable subrole")
                }
            }

            // Check if element has selected text range (indicates text input)
            if let _ = getAttributeValue(axElement, kAXSelectedTextRangeAttribute) {
                info.hasSelectedTextRange = true
                info.isTextInput = true
                debugLog.append("has selected text range")
            }

            // Additional check: see if AXInsertionPointLineNumber exists (text cursor)
            if let _ = getAttributeValue(axElement, "AXInsertionPointLineNumber") {
                info.isTextInput = true
                info.isEditable = true
                debugLog.append("has insertion point")
            }

            // Check role description for web text inputs
            if let roleDesc = getAttributeValue(axElement, kAXRoleDescriptionAttribute) as? String {
                let lowerDesc = roleDesc.lowercased()
                debugLog.append("roleDesc: \(roleDesc)")
                if lowerDesc.contains("text") || lowerDesc.contains("edit") || lowerDesc.contains("input") || lowerDesc.contains("field") {
                    info.isTextInput = true
                    debugLog.append("matched roleDesc")
                }
            }

            // Check if element is editable via AXValue writability
            var isSettable: DarwinBoolean = false
            if AXUIElementIsAttributeSettable(axElement, "AXValue" as CFString, &isSettable) == .success {
                if isSettable.boolValue {
                    info.isEditable = true
                    info.isTextInput = true
                    debugLog.append("AXValue is settable")
                }
            }
        } else {
            let errorDesc = axErrorDescription(focusResult)
            debugLog.append("failed to get focused element: \(errorDesc) (\(focusResult.rawValue))")

            // If we got cannot_complete, it's likely a permission issue
            if focusResult == .cannotComplete {
                info.error = "accessibility_permission_needed"
                debugLog.append("parent process may need accessibility permission")
            }
        }
    } else {
        debugLog.append("no frontmost app found")
    }

    info.debug = debugLog.joined(separator: "; ")
    return info
}

func promptForAccessibility() {
    // This creates a prompt for accessibility permission
    let options = [kAXTrustedCheckOptionPrompt.takeUnretainedValue() as String: true] as CFDictionary
    AXIsProcessTrustedWithOptions(options)
}

func main() {
    // Check if we have accessibility permission
    let isTrusted = AXIsProcessTrusted()

    if !isTrusted {
        // Prompt for permission
        promptForAccessibility()

        // Still try to get basic app info even without full accessibility
        var result: [String: Any] = [
            "error": "accessibility_not_granted",
            "isTextInput": false,
            "message": "Please grant accessibility permission in System Settings > Privacy & Security > Accessibility",
            "debug": "AXIsProcessTrusted returned false, prompting for permission"
        ]

        // We can still get frontmost app via NSWorkspace without accessibility
        if let appInfo = getFrontmostAppInfo() {
            result["appName"] = appInfo.name
            result["appBundleId"] = appInfo.bundleId
        }

        printJSON(result)
        exit(1)
    }

    let info = checkFocusedElement()

    var result: [String: Any] = [
        "isTextInput": info.isTextInput,
        "isEditable": info.isEditable,
        "role": info.role,
        "subrole": info.subrole,
        "appName": info.appName,
        "appBundleId": info.appBundleId,
        "hasSelectedTextRange": info.hasSelectedTextRange,
        "debug": info.debug
    ]

    if !info.error.isEmpty {
        result["error"] = info.error
    }

    printJSON(result)
    exit(info.error.isEmpty ? 0 : 1)
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
