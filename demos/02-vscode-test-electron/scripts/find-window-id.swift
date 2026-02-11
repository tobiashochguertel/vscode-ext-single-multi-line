#!/usr/bin/env swift
// Finds the CGWindowID of a window owned by a process matching the given name.
// Usage: find-window-id <ownerName>
// Prints the window ID (integer) to stdout, or exits with code 1 if not found.

import CoreGraphics
import Foundation

let targetOwner = CommandLine.arguments.count > 1 ? CommandLine.arguments[1] : "Electron"

guard let windowList = CGWindowListCopyWindowInfo(
    [.optionOnScreenOnly, .excludeDesktopElements],
    kCGNullWindowID
) as? [[String: Any]] else {
    exit(1)
}

for w in windowList {
    let owner = w["kCGWindowOwnerName"] as? String ?? ""
    let name = w["kCGWindowName"] as? String ?? ""
    let layer = w["kCGWindowLayer"] as? Int ?? 999

    // Match: layer 0 (normal window), owner contains target, has a title
    if layer == 0 && owner.contains(targetOwner) && !name.isEmpty {
        if let wid = w["kCGWindowNumber"] as? Int {
            print(wid)
            exit(0)
        }
    }
}

exit(1)
