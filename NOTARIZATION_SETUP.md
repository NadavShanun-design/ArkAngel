# ArkAngel Notarization Setup Guide

## ✅ What We've Configured

Your ArkAngel app is now configured for code signing and notarization with:

- **Certificate**: Developer ID Application: Nadav Shanun (T5KKCBUDB7)
- **Team ID**: T5KKCBUDB7
- **Valid Until**: October 22, 2030
- **Hardened Runtime**: Enabled
- **Entitlements**: Configured for network, file access, and microphone

## 🔐 Notarization Requirements

To complete notarization, you need to set up Apple credentials. Apple requires these for automated notarization:

### Step 1: Create an App-Specific Password

1. Go to [appleid.apple.com](https://appleid.apple.com)
2. Sign in with your Apple ID
3. Navigate to **Security** → **App-Specific Passwords**
4. Click **Generate an app-specific password**
5. Name it "ArkAngel Notarization"
6. **Copy the password** (you won't see it again!)

### Step 2: Set Environment Variables

Add these to your shell profile (`~/.zshrc` or `~/.bash_profile`):

```bash
# Apple Notarization Credentials
export APPLE_ID="your-apple-id@email.com"              # Your Apple ID email
export APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx"            # App-specific password from Step 1
export APPLE_TEAM_ID="T5KKCBUDB7"                      # Your Team ID (already set)
```

After adding, reload your shell:
```bash
source ~/.zshrc   # or source ~/.bash_profile
```

### Step 3: Verify Certificate is Installed

Run this command to verify your certificate is accessible:

```bash
security find-identity -v -p codesigning
```

You should see:
```
2) 9E42027A7959735B365D024CD1F33261B0E5AFDC "Developer ID Application: Nadav Shanun (T5KKCBUDB7)"
```

✅ This is confirmed and working!

## 🏗️ Building a Signed & Notarized DMG

Once environment variables are set, build your app:

```bash
npm run tauri build
```

This will:
1. ✅ Build the React frontend
2. ✅ Compile the Rust backend
3. ✅ Sign the app with your certificate
4. ✅ Create a DMG with hardened runtime
5. ✅ Submit to Apple for notarization
6. ✅ Staple the notarization ticket to the DMG

**Build Output Location:**
```
src-tauri/target/release/bundle/dmg/ArkAngel_0.1.1_aarch64.dmg
```

## 🔍 Verifying the Signature

After building, verify the DMG is properly signed:

```bash
# Check code signature
codesign -dv --verbose=4 src-tauri/target/release/bundle/macos/ArkAngel.app

# Check notarization status
spctl -a -vvv -t install src-tauri/target/release/bundle/macos/ArkAngel.app

# Verify DMG signature
codesign -dv --verbose=4 src-tauri/target/release/bundle/dmg/ArkAngel_0.1.1_aarch64.dmg
```

Expected output:
```
Executable=/path/to/ArkAngel.app/Contents/MacOS/ArkAngel
Identifier=com.nadavshanun.arkangel
Format=app bundle with Mach-O universal (arm64 x86_64)
CodeDirectory v=20500 size=... flags=0x10000(runtime) hashes=...
Signature size=...
Authority=Developer ID Application: Nadav Shanun (T5KKCBUDB7)
Authority=Developer ID Certification Authority
Authority=Apple Root CA
Timestamp=...
```

## 🌍 Distributing the DMG

Once notarized, the DMG can be downloaded by **anyone on any Mac worldwide** without warnings!

### Distribution Methods:

1. **Direct Download**
   - Upload to your website/server
   - Share the DMG file link
   - Users can download and install without issues

2. **GitHub Releases**
   - Upload to GitHub Releases
   - Auto-updater will work with signed releases
   - Users get automatic updates

3. **Third-Party Hosting**
   - Upload to CDN (Cloudflare, S3, etc.)
   - No Apple notarization warnings
   - Install opens without "damaged" errors

## 🚨 Common Issues & Solutions

### Issue: "Apple ID or password not set"
**Solution**: Make sure environment variables are exported in your current shell session

### Issue: "Unable to find signing identity"
**Solution**: Run `security find-identity -v -p codesigning` to verify certificate is installed

### Issue: "Notarization failed"
**Solution**: Check notarization log with:
```bash
xcrun notarytool log <submission-id> --apple-id <your-id> --password <password> --team-id T5KKCBUDB7
```

### Issue: DMG still shows as "damaged"
**Solution**: The app needs to be notarized. Make sure:
1. Environment variables are set
2. App-specific password is correct
3. Build completes notarization step (takes 2-5 minutes)

## 📝 What Changed

### Files Modified:
1. **`src-tauri/tauri.conf.json`**
   - Added `signingIdentity`: Uses your Developer ID certificate
   - Added `providerShortName`: Your Team ID
   - Added `hardenedRuntime`: true (required for notarization)
   - Added `entitlements`: Points to entitlements file

2. **`src-tauri/entitlements.plist`** (NEW)
   - Network client/server access (for AI APIs and sidecar)
   - File read/write access (for uploads)
   - Microphone access (for voice input)
   - Security entitlements for WebView and dynamic libraries

## 🎯 Next Steps

1. **Set environment variables** (Step 2 above)
2. **Run `npm run tauri build`**
3. **Verify signature** with verification commands
4. **Test on a different Mac** to confirm it works
5. **Upload to GitHub Releases** or your hosting

## ✨ Benefits After Notarization

✅ No "damaged file" errors
✅ No security warnings when opening
✅ Works on any Mac (macOS 10.13+)
✅ Eligible for automatic updates
✅ Complies with Apple Gatekeeper
✅ Professional distribution ready

---

**Your certificate is valid until October 22, 2030** - plenty of time for distribution!
