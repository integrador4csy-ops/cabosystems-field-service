# Calendar data on the device

After Main is ready, Agenda prepares nearby periods first, then all twelve months
of the selected year. Requests are limited to two at a time and pause in the
background. Nearby periods refresh after one minute; other months after fifteen
minutes. Changing the selected year replaces the retained year.

The saved window is bounded to nineteen records: twelve month ranges plus up to
seven nearby day/week/month ranges. Month navigation uses a native horizontal
pager with stable page identities and a virtualized window of nearby lists.
It retains at most twelve lightweight React page descriptions; week/day navigation
retains six adjacent preview trees. The twelve months of data do not mount twelve
screens. Snapshots restore before
network access and remain available when refresh fails.

Both disk caches explicitly select event/calendar fields. Attachments, downloaded
files, media payloads and unknown fields are excluded. Each account has its own
snapshot.

For performance testing without Metro, build an embedded, optimized JavaScript
bundle and disable development-server loading together:

```powershell
cd android
.\gradlew.bat app:assembleDebug '-Pcabosystems.standalone=true' -PreactNativeArchitectures=arm64-v8a
```

This produces a debug-signed APK using production JavaScript. Normal debug builds
keep development-server support. The Expo config plugin preserves both settings
across native regeneration. Install the APK with `adb install -r` to preserve app
data, then open Agenda and verify the saved month ranges before measuring gestures.
