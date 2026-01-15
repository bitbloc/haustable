import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient';
import { toast } from 'sonner';

export default function usePushNotifications() {
  const [permission, setPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'default'
  );
  const [fcmToken, setFcmToken] = useState(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    if (typeof Notification !== 'undefined') {
      setPermission(Notification.permission);
      setIsSubscribed(Notification.permission === 'granted');
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
        setIsSubscribed(true);
        toast.success("Notifications enabled!");
        
        // Get the service worker registration
        const registration = await navigator.serviceWorker.ready;

        // Lazy load Firebase Messaging
        const { getMessaging, getToken } = await import("firebase/messaging");
        const { default: app } = await import("../utils/firebase"); 
        const msg = getMessaging(app);

        const currentToken = await getToken(msg, {
          vapidKey: import.meta.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
          serviceWorkerRegistration: registration
        });

        if (currentToken) {
          console.log('FCM Token:', currentToken);
          setFcmToken(currentToken);
          await saveTokenToDatabase(currentToken);
        } else {
          console.log('No registration token available.');
          toast.error("Failed to get token.");
        }
      } else {
        setIsSubscribed(false);
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

    // Save to 'profiles' table. Ensure 'fcm_token' column exists.
    const { error } = await supabase
      .from('profiles')
      .update({ 
        fcm_token: token,
        updated_at: new Date()
      })
      .eq('id', user.id);

    if (error) {
        console.error("Error saving token to profiles:", error);
        // Fallback: If simple update fails, try upsert if row might not exist (though profiles should exist for users)
        // or just log it for now.
    } else {
        console.log("Token saved to DB");
    }
  };

  /**
   * Triggers a system notification (Desktop style)
   * Uses Service Worker if available -> "Desktop" feel in PWA
   */
  const triggerNotification = (title, options = {}) => {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    const defaultOptions = {
        icon: '/pwa-icon.png',
        badge: '/pwa-icon.png',
        vibrate: [200, 100, 200],
        ...options
    };

    if (navigator.serviceWorker && navigator.serviceWorker.ready) {
        navigator.serviceWorker.ready.then(registration => {
            registration.showNotification(title, defaultOptions);
        });
    } else {
        new Notification(title, defaultOptions);
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
                // In foreground, we might want to show a toast OR a system notification
                // For "Desktop Version" feel, let's do BOTH or just System if supported
                if(payload.notification) {
                     triggerNotification(payload.notification.title, {
                         body: payload.notification.body,
                         data: payload.data, // pass data for click handling
                     });
                }
             });
             return () => unsubscribe();
          });
      });
    }
  }, []);

  return { 
      permission, 
      requestPermission, 
      fcmToken, 
      isSubscribed, 
      triggerNotification 
  };
}
