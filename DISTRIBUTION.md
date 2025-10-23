# ArkAngel - Distribution Guide

## 📦 Download File Location

Your distributable macOS app is ready to share!

### **File Location:**
```
ArkAngel_0.1.1_macOS.dmg
```

This file is located in:
- **Project Root:** `/Users/nadavshanun/Downloads/ArkAngel-copilot-fix-5294b662-d677-4a0a-9a82-119bf5a02734 2/ArkAngel_0.1.1_macOS.dmg`
- **Your Downloads Folder:** `/Users/nadavshanun/Downloads/ArkAngel_0.1.1_aarch64.dmg`
- **Build Output:** `/Users/nadavshanun/Downloads/ArkAngel-copilot-fix-5294b662-d677-4a0a-9a82-119bf5a02734 2/src-tauri/target/release/bundle/dmg/`

### **File Size:** 8.7 MB

---

## 🚀 How to Distribute

### **Option 1: Share Directly**
1. Copy `ArkAngel_0.1.1_macOS.dmg` from your Downloads folder or project root
2. Share it via:
   - Email attachment
   - Cloud storage (Google Drive, Dropbox, iCloud)
   - USB drive
   - AirDrop
   - File sharing service (WeTransfer, Dropbox Transfer, etc.)

### **Option 2: Host on Your Website**
1. Upload `ArkAngel_0.1.1_macOS.dmg` to your website hosting
2. Create a download link:
   ```html
   <a href="/downloads/ArkAngel_0.1.1_macOS.dmg" download>
     Download ArkAngel for macOS
   </a>
   ```

### **Option 3: GitHub Releases (Recommended)**
1. Go to your GitHub repository: https://github.com/NadavShanun-design/ArkAngel
2. Click "Releases" → "Create a new release"
3. Tag version: `v0.1.1`
4. Upload `ArkAngel_0.1.1_macOS.dmg` as an asset
5. Write release notes
6. Publish release
7. Share the release URL with users

### **Option 4: Cloud Storage Services**
- **Google Drive:** Upload → Get shareable link → Set to "Anyone with the link"
- **Dropbox:** Upload → Share → Copy link
- **iCloud Drive:** Upload → Share folder → Copy link
- **OneDrive:** Upload → Share → Copy link

---

## 💻 Installation Instructions for Users

When someone downloads the DMG file, they should:

1. **Double-click** `ArkAngel_0.1.1_macOS.dmg`
2. **Drag** the ArkAngel app to the Applications folder
3. **Open** the app from Applications
4. If macOS shows a security warning:
   - Go to **System Settings** → **Privacy & Security**
   - Click **"Open Anyway"** next to the ArkAngel security message
   - Click **"Open"** in the confirmation dialog

---

## ⚙️ System Requirements

- **macOS:** 10.13 (High Sierra) or later
- **Architecture:** Apple Silicon (M1/M2/M3) - ARM64
- **Disk Space:** ~20 MB

---

## 🔄 Building New Versions

To rebuild the distributable file after code changes:

```bash
cd "/Users/nadavshanun/Downloads/ArkAngel-copilot-fix-5294b662-d677-4a0a-9a82-119bf5a02734 2"
npm run tauri build
```

New DMG will be created at:
```
src-tauri/target/release/bundle/dmg/ArkAngel_0.1.1_aarch64.dmg
```

---

## 📝 Notes

- **Code Signing:** This build is NOT code-signed. Users will see a security warning on first launch.
- **Gatekeeper:** Users may need to bypass Gatekeeper security to install (normal for unsigned apps).
- **Auto-Updates:** The app has built-in update checking via GitHub releases (see `tauri.conf.json`).
- **Privacy:** The app is privacy-first - all data stays local, no tracking or telemetry.

---

## 🛡️ Optional: Code Signing (for Production)

For a professional distribution without security warnings:

1. **Get an Apple Developer Account** ($99/year)
2. **Create certificates** in Xcode or Apple Developer Portal
3. **Update** `src-tauri/tauri.conf.json` with your Team ID
4. **Rebuild** with signing:
   ```bash
   npm run tauri build -- --sign
   ```

---

## 📧 Support

For issues or questions:
- GitHub: https://github.com/NadavShanun-design/ArkAngel/issues
- Email: nadavshanun@gmail.com
