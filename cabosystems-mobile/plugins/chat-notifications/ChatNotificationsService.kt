package com.cabosystems.fieldservice.notifications

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.BitmapShader
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.Paint
import android.graphics.Shader
import android.os.Bundle
import android.util.LruCache
import androidx.core.app.NotificationCompat
import androidx.core.app.NotificationManagerCompat
import androidx.core.app.Person
import expo.modules.notifications.notifications.enums.NotificationPriority
import expo.modules.notifications.notifications.model.Notification
import expo.modules.notifications.notifications.model.NotificationBehaviorRecord
import expo.modules.notifications.notifications.model.NotificationContent
import expo.modules.notifications.notifications.model.NotificationRequest
import expo.modules.notifications.service.NotificationsService
import expo.modules.notifications.service.delegates.ExpoHandlingDelegate
import expo.modules.notifications.service.delegates.ExpoPresentationDelegate
import expo.modules.notifications.service.interfaces.HandlingDelegate
import expo.modules.notifications.service.interfaces.PresentationDelegate
import java.io.ByteArrayOutputStream
import java.net.HttpURLConnection
import java.net.URI

/** Keeps Expo's delivery, foreground rules and tap intents; changes only chat presentation. */
class ChatNotificationsService : NotificationsService() {
  override fun getHandlingDelegate(context: Context): HandlingDelegate {
    val expo = ExpoHandlingDelegate(context)
    return object : HandlingDelegate by expo {
      override fun handleNotification(notification: Notification) {
        val request = notification.notificationRequest
        val data = request.content.body
        if (data?.optString("kind") != "chat-message" || data.optString("groupId").isBlank()) {
          expo.handleNotification(notification)
          return
        }
        val content = NotificationContent.Builder()
          .setTitle(data.optString("groupName", "Chat de Cuadrilla"))
          .setText("${data.optString("senderName", "Compañero de equipo")}: ${data.optString("messageText", "Nuevo mensaje")}")
          .setBody(data).setAutoDismiss(true).setPriority(NotificationPriority.HIGH).build()
        // A stable conversation identifier updates this group's notification,
        // while Expo still receives the latest message's routing data on tap.
        val chatRequest = NotificationRequest("chat:${data.optString("groupId")}", content, request.trigger)
        expo.handleNotification(Notification(chatRequest, notification.originDate))
      }
    }
  }

  override fun getPresentationDelegate(context: Context): PresentationDelegate = ChatPresentationDelegate(context)
}

private class ChatPresentationDelegate(context: Context) : ExpoPresentationDelegate(context) {
  override suspend fun createNotification(notification: Notification, notificationBehavior: NotificationBehaviorRecord?): android.app.Notification {
    val base = super.createNotification(notification, notificationBehavior)
    val data = notification.notificationRequest.content.body ?: return base
    if (data.optString("kind") != "chat-message") return base
    val groupId = data.optString("groupId")
    val groupName = data.optString("groupName", "Chat de Cuadrilla")
    val previous = NotificationManagerCompat.from(context).activeNotifications
      .firstOrNull { it.tag == "chat:$groupId" }?.notification
    val style = NotificationCompat.MessagingStyle(Person.Builder().setName("Tú").build())
      .setConversationTitle(groupName).setGroupConversation(true)
    previous?.let { NotificationCompat.MessagingStyle.extractMessagingStyleFromNotification(it) }
      ?.messages?.takeLast(5)?.forEach { style.addMessage(it) }
    val messageId = data.optString("messageId")
    if (previous == null || messageId.isBlank() || previous.extras.getString("csy.chat.messageId") != messageId) {
      val sender = Person.Builder().setName(data.optString("senderName", "Compañero de equipo"))
        .setKey(data.optString("senderId")).build()
      style.addMessage(data.optString("messageText", "Nuevo mensaje"), notification.originDate.time, sender)
    }
    val builder = NotificationCompat.Builder(context, base)
      .setChannelId("chat-messages")
      .setStyle(style)
      .setCategory(NotificationCompat.CATEGORY_MESSAGE)
      .setLargeIcon(groupAvatar(data.optString("groupPhotoUrl"), groupName))
      .addExtras(Bundle().apply { putString("csy.chat.messageId", messageId) })
    return builder.build()
  }

  companion object {
    private val avatars = LruCache<String, Bitmap>(16)

    private fun groupAvatar(url: String, name: String): Bitmap {
      avatars.get(url)?.let { return it }
      val photo = runCatching {
        val uri = URI(url)
        require(uri.scheme == "https" && uri.userInfo == null)
        val connection = uri.toURL().openConnection() as HttpURLConnection
        try {
          connection.connectTimeout = 2500
          connection.readTimeout = 2500
          connection.instanceFollowRedirects = false
          require(connection.responseCode == 200)
          require(connection.contentLengthLong <= 1_048_576)
          val bytes = connection.inputStream.use { input ->
            val output = ByteArrayOutputStream()
            val buffer = ByteArray(8192)
            while (output.size() <= 1_048_576) {
              val count = input.read(buffer)
              if (count < 0) break
              output.write(buffer, 0, count)
            }
            output.toByteArray()
          }
          require(bytes.size <= 1_048_576)
          val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
          BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
          val options = BitmapFactory.Options().apply {
            var sample = 1
            while (bounds.outWidth / sample > 256 || bounds.outHeight / sample > 256) sample *= 2
            inSampleSize = sample
          }
          BitmapFactory.decodeByteArray(bytes, 0, bytes.size, options)
        } finally { connection.disconnect() }
      }.getOrNull()
      val bitmap = Bitmap.createBitmap(96, 96, Bitmap.Config.ARGB_8888)
      val canvas = Canvas(bitmap)
      val paint = Paint(Paint.ANTI_ALIAS_FLAG)
      if (photo != null) {
        val side = minOf(photo.width, photo.height)
        val square = Bitmap.createBitmap(photo, (photo.width - side) / 2, (photo.height - side) / 2, side, side)
        val scaled = Bitmap.createScaledBitmap(square, 96, 96, true)
        paint.shader = BitmapShader(scaled, Shader.TileMode.CLAMP, Shader.TileMode.CLAMP)
        canvas.drawCircle(48f, 48f, 48f, paint)
        if (url.isNotBlank()) avatars.put(url, bitmap)
      } else {
        paint.color = Color.rgb(247, 140, 38)
        canvas.drawCircle(48f, 48f, 48f, paint)
        paint.color = Color.WHITE
        paint.textSize = 34f
        paint.textAlign = Paint.Align.CENTER
        canvas.drawText(name.trim().take(2).uppercase(), 48f, 48f - (paint.ascent() + paint.descent()) / 2, paint)
      }
      return bitmap
    }
  }
}
