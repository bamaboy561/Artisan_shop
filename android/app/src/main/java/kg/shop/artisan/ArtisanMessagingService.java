package kg.shop.artisan;

import android.app.Notification;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;

import com.google.firebase.messaging.FirebaseMessagingService;
import com.google.firebase.messaging.RemoteMessage;

import java.util.Map;

public final class ArtisanMessagingService extends FirebaseMessagingService {
    @Override
    public void onRegistered(String installationId) {
        PushRegistrationStore.saveInstallationId(this, installationId);
    }

    @Override
    public void onUnregistered(String installationId) {
        PushRegistrationStore.clearInstallationId(this, installationId);
    }

    @Override
    public void onMessageReceived(RemoteMessage remoteMessage) {
        PushNotificationChannels.ensure(this);

        Map<String, String> data = remoteMessage.getData();
        RemoteMessage.Notification remoteNotification = remoteMessage.getNotification();
        String title = remoteNotification != null ? remoteNotification.getTitle() : null;
        String body = remoteNotification != null ? remoteNotification.getBody() : null;
        String url = data.get("url");

        if (title == null || title.isBlank()) {
            title = data.getOrDefault("title", "Artisan");
        }
        if (body == null || body.isBlank()) {
            body = data.getOrDefault("body", "Откройте приложение, чтобы посмотреть обновление.");
        }
        if (url == null || url.isBlank()) {
            url = BuildConfig.SITE_URL;
        }

        Intent intent = new Intent(this, MainActivity.class)
            .setAction(Intent.ACTION_VIEW)
            .setData(Uri.parse(url))
            .addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_SINGLE_TOP);
        PendingIntent pendingIntent = PendingIntent.getActivity(
            this,
            url.hashCode(),
            intent,
            PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        Notification notification = new Notification.Builder(this, PushNotificationChannels.UPDATES)
            .setSmallIcon(R.drawable.ic_stat_artisan)
            .setColor(Color.rgb(201, 101, 58))
            .setContentTitle(title)
            .setContentText(body)
            .setStyle(new Notification.BigTextStyle().bigText(body))
            .setAutoCancel(true)
            .setContentIntent(pendingIntent)
            .build();

        NotificationManager manager = getSystemService(NotificationManager.class);
        manager.notify(remoteMessage.getMessageId() == null
            ? (int) System.currentTimeMillis()
            : remoteMessage.getMessageId().hashCode(), notification);
    }
}
