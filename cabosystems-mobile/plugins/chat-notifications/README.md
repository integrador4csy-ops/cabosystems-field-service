# Android chat notifications

Uses Android `NotificationCompat.MessagingStyle`: the group avatar is a small round
conversation icon, the group name is the conversation title, and sender/message
lines appear below. Group images are never sent as `richContent.image` attachments.

The local Expo config plugin installs a `NotificationsService` subclass. It preserves
Expo's permissions, foreground behavior, response intents and navigation. New chat
messages replace the notification for that conversation, retaining the last six
messages currently in the notification tray. Dismissing it clears that history.
Image downloads have time/size limits; failure falls back to the group's initials.

Build 9 is the first APK with this native receiver. Token registration advertises
`chat_notification_version=1` only when the immutable `Application.nativeBuildVersion >= 9` on Android.
The server sends those devices high-priority data-only pushes, so Firebase cannot
render a BigPicture notification first. Older APKs and iOS retain normal title/body
delivery, without a large image. Keep the capability at zero for any build that
does not include this plugin; a JavaScript update cannot add a native receiver.

Apply the database migration before releasing build 9. EAS prebuild runs the plugin
automatically. For an existing local `android/` checkout, first run
`node scripts/sync-chat-notifications.cjs`. Use the project's existing signing and
distribution workflow to create the replacement APK.

Verification:

```
node --test supabase/functions/chat-push-notifications/presentation.test.mjs cabosystems-mobile/plugins/chat-notifications/plugin.test.cjs
```

Device acceptance: receive two messages from the same group while foregrounded,
backgrounded and after swiping the app away; confirm one conversation with a small
avatar, sender lines, and tap navigation into that group. Also test a second group,
missing/unreachable avatar, dismissal, and an older APK. No direct reply action is
implemented; tapping opens the chat.
