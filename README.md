# Terraforming Mars Milestone Watch (v1.4.0)

Separate Brave/Chromium extension for Terraforming Mars games and tutorials on
Board Game Arena. It does not modify the BGA Replay Viewer Settings extension.

- Milestones show your progress / each opponent's progress / target, with player colors.
- The collapsed Awards section shows each player's projected VP in their player color.
- The panel border signals when an opponent is one away or can claim.
- Identifies the current player from BGA's player ID rather than a fixed name.
- Forces BGA's actual two-column log layout even when its selector incorrectly
  says second column while the logs remain below the player panels.
- Can be enabled or disabled from the extension-icon popup.
- The panel can be dragged, resized, collapsed, and closed.
- Panel position, size, and collapsed state persist in BGA local storage.
- The popup has a one-click extension reload button for future code changes;
  refresh the BGA tab afterward.
- The popup also has a one-click button to refresh the active BGA tab.

## Install in Brave

1. Download and unzip the extension folder, then open `brave://extensions` (or `chrome://extensions` in Chrome).
2. Enable **Developer mode**.
3. Click **Load unpacked**.
4. Select the extracted folder containing `manifest.json`.
5. Reload the BGA Terraforming Mars page.
