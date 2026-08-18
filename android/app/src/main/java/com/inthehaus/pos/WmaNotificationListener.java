package com.inthehaus.pos;

import android.app.Notification;
import android.os.Bundle;
import android.service.notification.NotificationListenerService;
import android.service.notification.StatusBarNotification;
import android.util.Log;

public class WmaNotificationListener extends NotificationListenerService {

    private static final String TAG = "WmaNotificationListener";

    @Override
    public void onNotificationPosted(StatusBarNotification sbn) {
        if (sbn == null || sbn.getNotification() == null) return;

        try {
            String packageName = sbn.getPackageName() != null ? sbn.getPackageName().toLowerCase() : "";
            Notification notification = sbn.getNotification();
            Bundle extras = notification.extras;
            if (extras == null) return;

            CharSequence titleSeq = extras.getCharSequence(Notification.EXTRA_TITLE);
            CharSequence textSeq = extras.getCharSequence(Notification.EXTRA_TEXT);
            CharSequence bigTextSeq = extras.getCharSequence(Notification.EXTRA_BIG_TEXT);
            CharSequence subTextSeq = extras.getCharSequence(Notification.EXTRA_SUB_TEXT);

            String title = titleSeq != null ? titleSeq.toString() : "";
            String text = bigTextSeq != null ? bigTextSeq.toString() : (textSeq != null ? textSeq.toString() : "");
            String subText = subTextSeq != null ? subTextSeq.toString() : "";

            String combinedText = (title + " " + text + " " + subText).toLowerCase();

            // Match WMA / LINE MAN / Wongnai packages or keywords
            boolean isWmaPackage = packageName.contains("wongnai") || packageName.contains("lineman") || packageName.contains("merchant") || packageName.contains("food");
            boolean hasOrderKeyword = combinedText.contains("line man") || combinedText.contains("lineman") 
                    || combinedText.contains("wongnai") || combinedText.contains("ออเดอร์ใหม่") 
                    || combinedText.contains("คำสั่งซื้อใหม่") || combinedText.contains("order #lm") 
                    || combinedText.contains("#lm-") || combinedText.contains("มีออเดอร์");

            if (isWmaPackage || hasOrderKeyword) {
                Log.i(TAG, "🛵 Intercepted delivery notification: [" + title + "] " + text + " (" + packageName + ")");
                MainActivity.dispatchWmaNotification(title, text, packageName);
            }
        } catch (Exception e) {
            Log.e(TAG, "Error handling notification: " + e.getMessage());
        }
    }

    @Override
    public void onNotificationRemoved(StatusBarNotification sbn) {
        // No-op
    }
}
