# 📦 How to Install ArkAngel on macOS

**macOS will show a security warning - this is normal for apps from independent developers who don't have a $99/year Apple Developer account.**

---

## 🚀 Quick Install (3 Steps)

### Method 1: Using Terminal (Recommended - Fastest)

**Step 1:** Download `ArkAngel_0.1.1_macOS.zip` or `ArkAngel_0.1.1_aarch64.dmg`

**Step 2:** Open **Terminal** (Applications → Utilities → Terminal)

**Step 3:** Copy and paste this command based on what you downloaded:

**For ZIP file:**
```bash
xattr -cr ~/Downloads/ArkAngel_0.1.1_macOS.zip && \
unzip -o ~/Downloads/ArkAngel_0.1.1_macOS.zip -d ~/Downloads && \
xattr -cr ~/Downloads/ArkAngel.app && \
open -R ~/Downloads/ArkAngel.app
```

**For DMG file:**
```bash
xattr -cr ~/Downloads/ArkAngel_0.1.1_aarch64.dmg && \
open ~/Downloads/ArkAngel_0.1.1_aarch64.dmg
```

**Step 4:**
- For ZIP: Drag ArkAngel.app from Downloads to Applications
- For DMG: Drag ArkAngel from the opened window to Applications

**Step 5:** Right-click on ArkAngel in Applications → Click **"Open"** → Click **"Open"** again in the dialog

**✅ Done! ArkAngel is now installed.**

---

## 🖱️ Method 2: Using System Settings (No Terminal Needed)

**Step 1:** Download the file and try to open it

**Step 2:** When you see **"ArkAngel is damaged"** error, click **Cancel**

**Step 3:** Open **System Settings** → **Privacy & Security**

**Step 4:** Scroll down to the **Security** section

**Step 5:** You'll see a message: *"ArkAngel was blocked from use because it is not from an identified developer"*

**Step 6:** Click **"Open Anyway"**

**Step 7:** Try opening the file again

**Step 8:** Drag ArkAngel to Applications folder

**Step 9:** Right-click on ArkAngel → **Open** → Click **"Open"** in the confirmation dialog

**✅ Done!**

---

## ❓ Why Do I See a Security Warning?

**The app is completely safe!**

macOS shows this warning because:
1. The app isn't signed with an Apple Developer certificate ($99/year)
2. macOS's "Gatekeeper" blocks all unsigned apps by default
3. This is normal for apps from independent developers

**What "xattr -cr" does:** Removes the quarantine flag that macOS adds to downloaded files.

---

## 🔒 Is This Safe?

**Yes!** You're downloading directly from the developer. The app:
- Is built from open-source code
- Doesn't contain any malware
- Stores all data locally on your computer
- Has no tracking or telemetry

The warning is just Apple being overprotective of unsigned apps.

---

## 📁 Where to Get the Files

Choose ONE of these:

1. **ArkAngel_0.1.1_macOS.zip** (8.1 MB) - Easier installation
2. **ArkAngel_0.1.1_aarch64.dmg** (8.7 MB) - Traditional Mac installer

Both contain the exact same app.

---

## 💻 System Requirements

- **macOS:** 10.13 (High Sierra) or later
- **Processor:** Apple Silicon (M1/M2/M3) or Intel
- **Disk Space:** ~20 MB
- **Internet:** Required for AI features

---

## 🆘 Troubleshooting

### "The application cannot be opened"
- Make sure you right-clicked and selected **"Open"** (don't just double-click)
- Run the terminal command from Method 1

### "Application is damaged and can't be opened"
- This means the quarantine flag is still set
- Run the `xattr -cr` command from Method 1

### App opens but immediately closes
- Check **System Settings → Privacy & Security**
- Look for an "Open Anyway" button for ArkAngel
- Click it and try again

### Still having issues?
1. Make sure you're running macOS 10.13 or later
2. Restart your Mac
3. Try the Terminal method (Method 1) instead

---

## 🎯 Quick Reference

**Terminal command for ZIP:**
```bash
xattr -cr ~/Downloads/ArkAngel_0.1.1_macOS.zip
```

**Terminal command for DMG:**
```bash
xattr -cr ~/Downloads/ArkAngel_0.1.1_aarch64.dmg
```

**Terminal command if app is already extracted:**
```bash
xattr -cr ~/Downloads/ArkAngel.app
```

---

## 🚀 After Installation

1. **Open ArkAngel** from Applications
2. **Sign up** or **Sign in** (or use as guest)
3. **Enter API keys** for AI providers (Settings)
4. **Start chatting** with your AI assistant!

---

Enjoy using ArkAngel! 🎉
