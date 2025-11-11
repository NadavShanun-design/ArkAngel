#!/bin/bash

echo "🖼️  Screenshot Capture Test"
echo "=========================="
echo ""

# Check if workflows folder exists
if [ -d "workflows" ]; then
    echo "✅ workflows/ folder exists"
    echo "📁 Current screenshots:"
    ls -lh workflows/*.png 2>/dev/null || echo "   No screenshots found yet"
else
    echo "📂 workflows/ folder doesn't exist yet (will be created on first capture)"
fi

echo ""
echo "📍 Screenshots will be saved to:"
echo "   $(pwd)/workflows/screenshot_<uuid>.png"
echo ""

echo "🔍 Checking permission status..."
echo ""

# Try to capture a screenshot using the running app
echo "To test screenshot capture:"
echo ""
echo "Option 1: Use the test page"
echo "   open test-screenshot.html"
echo "   Click 'Test Screenshot Capture' button"
echo ""
echo "Option 2: Use browser console"
echo "   Open the app's DevTools (Cmd+Option+I)"
echo "   Paste: window.__TAURI__.core.invoke('capture_screenshot').then(console.log).catch(console.error)"
echo ""
echo "Option 3: Enable auto-capture"
echo "   In browser console: localStorage.setItem('auto-capture-screenshots', 'true')"
echo "   Reload the app"
echo "   Send any message"
echo ""

echo "🔐 IMPORTANT: Make sure you've:"
echo "   1. Granted Screen Recording permission in System Settings"
echo "   2. Restarted the app after granting permission"
echo ""

# Check if app is running
if pgrep -x "arkangel" > /dev/null; then
    echo "✅ ArkAngel app is running"
else
    echo "⚠️  ArkAngel app is NOT running - start it with 'npm run tauri dev'"
fi

echo ""
echo "After capturing, run this script again to see the results!"
