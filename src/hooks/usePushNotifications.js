
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabaseClient'; // Corrected path

const PUBLIC_VAPID_KEY = "BIdzmSkckPWxlQPKaJDo7og5NvuzLgbAgFft3hW9J_80a0YAIY_9Aqg1e4ozrm44Zg0_gog_RzkYhLtJPVpLwYE";

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [subscription, setSubscription] = useState(null);
  const [permission, setPermission] = useState(Notification.permission);

  useEffect(() => {
    // Check if subscription exists
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      navigator.serviceWorker.ready.then(function(registration) {
        registration.pushManager.getSubscription().then(function(sub) {
          if (sub) {
            setIsSubscribed(true);
            setSubscription(sub);
          }
        });
      });
    }
  }, []);

  const subscribeToPush = async () => {
    try {
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
      });

      // Save subscription to Supabase
      const { data: { user } } = await supabase.auth.getUser();
      
      if (user) {
        // Format keys for storage
        const keys = {
            p256dh: btoa(String.fromCharCode.apply(null, new Uint8Array(sub.getKey('p256dh')))),
            auth: btoa(String.fromCharCode.apply(null, new Uint8Array(sub.getKey('auth'))))
        };

        const { error } = await supabase.from('push_subscriptions').upsert({
            user_id: user.id,
            endpoint: sub.endpoint,
            keys: keys, // Storing as JSON
            user_agent: navigator.userAgent
        }, { onConflict: 'endpoint' });

        if (error) {
            console.error('Failed to save subscription to DB:', error);
            throw error;
        }
      }

      setSubscription(sub);
      setIsSubscribed(true);
      setPermission(Notification.permission);
      alert("Notifications Enabled!");
      
      // Test Notification
      await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-web-push`, {
          method: 'POST',
          headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify({
              title: 'Welcome!',
              body: 'Push notifications are now active.',
              url: window.location.href
          })
      });

    } catch (error) {
      console.error('Failed to subscribe to push', error);
      alert('Failed to subscribe: ' + error.message);
    }
  };

  return {
    isSubscribed,
    subscribeToPush,
    permission
  };
}
