# 🔐 Apple Code Signing Setup for ArkAngel

## ✅ Your Apple Developer Account Info:
- **Team ID:** T5KKCBUDB7
- **Account Type:** Individual
- **Status:** Active (renews October 1, 2026)

---

## 🎯 What We Need:

You have: ✅ "Apple Development" certificate (for local testing)
We need: ❌ "Developer ID Application" certificate (for distribution)

**The difference:**
- **Apple Development** = Only works on YOUR computer
- **Developer ID Application** = Works on ANYONE's computer (no warnings!)

---

## 📝 STEP-BY-STEP: Create Distribution Certificate

### Step 1: Create Certificate Signing Request (CSR)

1. Open **Keychain Access** on your Mac (Applications → Utilities → Keychain Access)

2. Click **Keychain Access** menu → **Certificate Assistant** → **Request a Certificate From a Certificate Authority...**

3. Fill in the form:
   - **User Email Address:** paradooma@gmail.com
   - **Common Name:** Nadav Shanun
   - **CA Email Address:** Leave blank
   - **Request is:** ✅ Check "Saved to disk"
   - ✅ Check "Let me specify key pair information"

4. Click **Continue**

5. Save as: `CertificateSigningRequest.certSigningRequest`
   Location: Desktop (or Downloads)

6. Click **Save**

7. **Key Pair Information:**
   - Key Size: **2048 bits**
   - Algorithm: **RSA**

8. Click **Continue**

9. Click **Done**

**✅ You now have a CSR file on your Desktop!**

---

### Step 2: Create Certificate on Apple Developer Portal

1. Go to: https://developer.apple.com/account/resources/certificates/list

2. Click the **"+"** button (top-left)

3. Under **"Software"** section, select:
   - ✅ **"Developer ID Application"**
   - This says: "Allows you to distribute an application outside the Mac App Store."

4. Click **Continue**

5. **Upload your CSR:**
   - Click **"Choose File"**
   - Select `CertificateSigningRequest.certSigningRequest` from your Desktop
   - Click **Continue**

6. Click **Download**

7. The file will download as: `developerID_application.cer`

**✅ You now have your certificate!**

---

### Step 3: Install the Certificate

1. Find the downloaded file: `developerID_application.cer`

2. **Double-click it**

3. Keychain Access will open and ask "Add certificates"

4. Make sure **"login"** keychain is selected

5. Click **Add**

6. You might be asked for your **Mac password** - enter it

**✅ Certificate is now installed!**

---

### Step 4: Verify Installation

Run this in Terminal:

```bash
security find-identity -p codesigning -v
```

You should now see **TWO** certificates:
```
1) BA9F95F2745132A4617C5E6C0BB3F90877EFF789 "Apple Development: Nadav Shanun (7874TJ7T2V)"
2) [NEW HASH] "Developer ID Application: Nadav Shanun (T5KKCBUDB7)"
```

**If you see the second one - you're ready to sign!** ✅

---

### Step 5: Get Your Certificate Identity

Copy the **full name** of your Developer ID certificate. It will look like:

```
Developer ID Application: Nadav Shanun (T5KKCBUDB7)
```

**📝 Copy this EXACT string - you'll need it for the next step!**

---

## ⚙️ STEP 6: Update Tauri Configuration

Once you have the certificate, **tell me the exact name** from Step 5, and I'll update your `tauri.conf.json` file automatically.

**Or you can do it manually:**

1. Open: `src-tauri/tauri.conf.json`

2. Find the `"bundle"` section

3. Update the `"macOS"` part to look like this:

```json
{
  "bundle": {
    "active": true,
    "targets": ["dmg"],
    "macOS": {
      "minimumSystemVersion": "10.13",
      "signingIdentity": "Developer ID Application: Nadav Shanun (T5KKCBUDB7)"
    }
  }
}
```

4. Save the file

---

## 🚀 STEP 7: Build Signed DMG

Once the config is updated, run:

```bash
cd "/Users/nadavshanun/Downloads/ArkAngel-copilot-fix-5294b662-d677-4a0a-9a82-119bf5a02734 2"
npm run tauri build
```

Tauri will automatically sign the app with your certificate!

---

## ✅ STEP 8: Verify Signature

After building, verify the signature:

```bash
codesign -dv --verbose=4 "/Users/nadavshanun/Downloads/ArkAngel-copilot-fix-5294b662-d677-4a0a-9a82-119bf5a02734 2/src-tauri/target/release/bundle/macos/ArkAngel.app"
```

You should see:
```
Authority=Developer ID Application: Nadav Shanun (T5KKCBUDB7)
```

**If you see this - your app is signed!** 🎉

---

## 🎯 OPTIONAL: Notarization (Extra Trust)

For even MORE trust, you can **notarize** the app with Apple:

### Create App-Specific Password:

1. Go to: https://appleid.apple.com/account/manage
2. Sign in with your Apple ID (paradooma@gmail.com)
3. Under **"Security"** → **"App-Specific Passwords"**
4. Click **"+"** to generate
5. Name it: "ArkAngel Notarization"
6. Copy the password (looks like: `xxxx-xxxx-xxxx-xxxx`)

### Notarize the DMG:

```bash
xcrun notarytool submit "ArkAngel_0.1.1_aarch64.dmg" \
  --apple-id "paradooma@gmail.com" \
  --team-id "T5KKCBUDB7" \
  --password "xxxx-xxxx-xxxx-xxxx" \
  --wait
```

This takes 5-15 minutes. When done:

```bash
xcrun stapler staple "ArkAngel_0.1.1_aarch64.dmg"
```

**Now your DMG is fully trusted by macOS!**

---

## 📋 Quick Checklist

Before you start, make sure you have:

- [ ] Active Apple Developer account ✅ (You have this!)
- [ ] Team ID: T5KKCBUDB7 ✅ (You have this!)
- [ ] Keychain Access app (built into macOS) ✅
- [ ] 15 minutes of time ✅

---

## 🆘 Troubleshooting

### "Certificate not trusted"
- Make sure you installed the certificate in the **"login"** keychain, not "System"
- Try: `security find-identity -p codesigning -v` to verify

### "No signing identity found"
- You might need to download the Apple Worldwide Developer Relations certificate
- Go to: https://www.apple.com/certificateauthority/
- Download "Worldwide Developer Relations - G4"
- Double-click to install

### Build fails with signing error
- Make sure the `signingIdentity` in `tauri.conf.json` matches EXACTLY what you see in `security find-identity`
- Including parentheses and Team ID!

---

## 📞 Next Steps

**After you create the certificate:**

1. **Tell me the exact certificate name** (from Step 5)
2. I'll update `tauri.conf.json` for you
3. We'll rebuild and create a fully signed DMG
4. Anyone can download and install without warnings!

---

**Ready to create the certificate? Follow Steps 1-5, then let me know!** 🚀
