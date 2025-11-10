# Dragging Implementation Debug Plan

## Problem
Window dragging is not working properly. User reports the window cannot be dragged around the screen.

## Research Findings

From Tauri GitHub discussions and docs:
1. `data-tauri-drag-region` ONLY works on the element it's directly applied to, NOT children
2. For custom drag behavior, need to use `window.startDragging()` JavaScript API
3. Must have `core:window:allow-start-dragging` permission (✓ already added)

## New Implementation Strategy

Instead of relying on `data-tauri-drag-region` attribute:
1. Add mouse event listeners to the entire window background
2. Call `getCurrentWindow().startDragging()` on mousedown
3. This allows dragging from ANYWHERE on the window
4. Keep interactive elements (buttons/inputs) working with stopPropagation

## Code Changes Needed

### App.tsx
- Remove `pointer-events: none` overlay approach (not working)
- Add direct mouse event handlers
- Call startDragging() API on mousedown

### MinimizeOrb.tsx
- Same approach for orb mode
- Use mousedown to call startDragging()
- Differentiate between drag and click with time tracking

## Testing Steps
1. Add console.log in every function
2. Check browser console for errors
3. Verify startDragging() is being called
4. Test click vs drag detection
