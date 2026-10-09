# Desktop and mobile apps

AEGIS runs in any browser and installs as a PWA (Chrome/Edge: install icon in the address bar; iPhone: Share, then Add to Home Screen). The native apps below add a proper window, taskbar/dock icon and app-store packaging. Both open your hosted AEGIS, so deploy it first (docs/DEPLOYMENT.md).

## Desktop (Windows, macOS, Linux): `desktop/`
Built with Tauri 2, which uses the system web view, so the installer is a few MB.

- On first launch it asks for your AEGIS address and remembers it. **AEGIS menu → Change server…** switches it later.
- The remote page gets no native permissions; it behaves like a browser tab.

**Build without installing anything:** on GitHub, open Actions → Apps → Run workflow, tick Windows (and/or Linux), and download the installer from the run's artifacts.

**Build locally:** install Rust (rustup.rs) and, on Windows, the WebView2 runtime (preinstalled on Windows 11). Then:
```
cd desktop
npm install
npm run dev      # try it
npm run build    # installers in src-tauri/target/release/bundle/
```
Unsigned installers trigger a SmartScreen/Gatekeeper warning. Code signing certificates cost money, so they are left for later.

## Android and iOS: `mobile/`
Built with Capacitor 8. The address is set when you build:

**Android, without installing anything:** Actions → Apps → Run workflow, enter your AEGIS address, tick Android, then install the APK from the artifacts (allow "install unknown apps" on the phone).

**Locally:** install Android Studio, then:
```
cd mobile
npm install
AEGIS_URL=https://your-aegis.example npm run sync
npm run android   # opens Android Studio
```
**iOS** needs a Mac with Xcode (`npm run ios`). Installing on your own iPhone works with a free Apple ID for 7 days at a time; App Store and Play Store publishing need paid developer accounts ($99/year Apple, $25 once Google).

## Icons
Generated from the placeholder `public/icon.svg`. When the final logo exists, replace it and run `npm run icons` in `desktop/` (and regenerate Android/iOS icons with `npx @capacitor/assets generate` in `mobile/`).
