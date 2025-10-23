# ArkAngel Installers

This folder contains production-ready installer files for ArkAngel.

## Available Installers

### Mac (macOS)
- **File**: `ArkAngel_0.1.1_aarch64.dmg`
- **Platform**: macOS (Apple Silicon - M1/M2/M3)
- **Size**: ~50-100 MB
- **Installation**: Download and open the DMG file, then drag ArkAngel to your Applications folder

### Windows
To build the Windows installer, you have two options:

#### Option 1: Use GitHub Actions (Recommended)
1. Push this code to a GitHub repository
2. The GitHub Actions workflow at `.github/workflows/build.yml` will automatically build installers for both Mac and Windows
3. Download the Windows installer from the workflow artifacts

#### Option 2: Manual Build on Windows
If you have access to a Windows machine:
1. Install Node.js and Rust
2. Run `npm install`
3. Run `cd sidecar && npm install`
4. Run `npm run tauri build`
5. Find the installer at `src-tauri/target/release/bundle/nsis/ArkAngel_0.1.1_x64-setup.exe`

## Uploading to Your Website

You can upload these installer files directly to your website for users to download.

### Recommended: Direct Download Links
Create download buttons on your website that link directly to these files:

```html
<!-- Mac Download -->
<a href="/downloads/ArkAngel_0.1.1_aarch64.dmg" download>
  Download for Mac (Apple Silicon)
</a>

<!-- Windows Download -->
<a href="/downloads/ArkAngel_0.1.1_x64-setup.exe" download>
  Download for Windows
</a>
```

### Alternative: Use GitHub Releases
Instead of hosting on your website, you can use GitHub Releases:
1. Create a new release on GitHub
2. Upload the DMG and EXE files as release assets
3. Users can download directly from GitHub
4. The app's auto-updater is already configured to check GitHub releases

## File Sizes and Requirements

### Mac
- Minimum OS: macOS 10.15 (Catalina) or later
- Architecture: Apple Silicon (M1/M2/M3)
- Installer size: ~50-100 MB

### Windows
- Minimum OS: Windows 10 or later
- Architecture: x64 (64-bit)
- Installer size: ~50-100 MB

## Security Notes

These installers are **not code-signed**. Users will see security warnings when installing:

### Mac Users
- Right-click the app and select "Open" the first time
- Or go to System Preferences > Security & Privacy and click "Open Anyway"

### Windows Users
- Click "More info" on the Windows Defender SmartScreen warning
- Then click "Run anyway"

To avoid these warnings, you would need to:
- **Mac**: Purchase an Apple Developer account ($99/year) and sign the app
- **Windows**: Purchase a code signing certificate (~$200-400/year)

## Cloud Services Required

When users download and install ArkAngel, they will need:

1. **Supabase** (Already hosted - users just need to sign up)
   - Authentication and user profiles work out of the box
   - Free tier supports up to 50,000 monthly active users

2. **AI API Keys** (Users provide their own)
   - OpenAI, Anthropic, or other supported providers
   - Users enter their API key in the app settings

3. **Optional: AWS S3** (Currently disabled)
   - File upload feature requires AWS credentials
   - Can be enabled later if needed

Everything else runs locally on the user's machine!
