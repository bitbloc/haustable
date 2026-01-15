import { useState, useEffect } from 'react';
import { messaging } from '../utils/firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';

export default function usePushNotifications() {
  // Safe initialization
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [fcmToken, setFcmToken] = useState(null);

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = async () => {
    if (typeof Notification === 'undefined') {
        toast.error("Notifications not supported in this browser.");
        return;
    }

    try {
      const permissionResult = await Notification.requestPermission();
      setPermission(permissionResult);

      if (permissionResult === 'granted') {
        toast.success("Notifications enabled!");
        
        // Get the service worker registration
        const registration = await navigator.serviceWorker.ready;

        // Get FCM Token
        // NOTE: We rely on the async import of messaging in firebase.js, so we might need to wait or re-import
        // But since this is called on a user action, likely it's loaded. 
        // A safer way is ensuring we have the messaging instance.
        const { getMessaging } = await import("firebase/messaging");
        const { default: app } = await import("../utils/firebase"); // default export is app
        const msg = getMessaging(app);

        const currentToken = await getToken(msg, {
          vapidKey: import.meta.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY, // Ensure this exists in .env
          serviceWorkerRegistration: registration
        });

        if (currentToken) {
          console.log('FCM Token:', currentToken);
          setFcmToken(currentToken);
          await saveTokenToDatabase(currentToken);
        } else {
          console.log('No registration token available. Request permission to generate one.');
          toast.error("Failed to get token.");
        }
      } else {
         toast.error("Permission denied for notifications.");
      }
    } catch (error) {
      console.error('An error occurred while retrieving token. ', error);
      toast.error("Error enabling notifications.");
    }
  };

  const saveTokenToDatabase = async (token) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    // Save functionality -> We need a table for this, or just put in profiles?
    // For now, let's update 'profiles' if there's a column, or create a 'user_tokens' table.
    // Assuming 'profiles' for simplicity as per common patterns, or just log it for now.
    
    // For the immediate task, I will try to save to a 'push_tokens' table if it exists, or 'profiles'.
    // Let's assume 'profiles' has a field or we use a separate table.
    // I will use a separate table 'fcm_tokens' to allow multiple devices per user.
    
    const { error } = await supabase
      .from('profiles')
      .upsert({ 
        user_id: user.id,
        fcm_token: token,
        updated_at: new Date()
      }, { onConflict: 'user_id' }); // Assuming 1 token per user for MVP, or we can use device_id logic.

    if (error) {
        // Fallback: maybe table doesn't exist?
        console.error("Error saving token:", error);
    } else {
        console.log("Token saved to DB");
    }
  };

  // Listen for foreground messages
  useEffect(() => {
    if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
      import("firebase/messaging").then(({ getMessaging, onMessage }) => {
          import("../utils/firebase").then(({ default: app }) => {
             const msg = getMessaging(app);
             const unsubscribe = onMessage(msg, (payload) => {
                console.log('Message received. ', payload);
                toast(payload.notification.title, {
                    description: payload.notification.body,
                });
             });
             return () => unsubscribe();
          });
      });
    }
  }, []);

  return { permission, requestPermission, fcmToken };
}
