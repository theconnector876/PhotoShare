/**
 * Native push notifications via @capacitor/push-notifications.
 * Only active when the app is running inside Capacitor (iOS/Android).
 * In the browser, the Web Push API (use-push.ts) is used instead.
 */
import { useEffect } from 'react';
import { apiRequest } from '@/lib/queryClient';

export function useNativePush(isLoggedIn: boolean) {
  useEffect(() => {
    if (!isLoggedIn) return;

    // Only run inside Capacitor
    const isCapacitor = typeof (window as any).Capacitor !== 'undefined' &&
      (window as any).Capacitor?.isNativePlatform?.();
    if (!isCapacitor) return;

    let cleanup: (() => void) | undefined;

    (async () => {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');

        const permResult = await PushNotifications.requestPermissions();
        if (permResult.receive !== 'granted') return;

        await PushNotifications.register();

        const regHandler = await PushNotifications.addListener('registration', async (token) => {
          try {
            await apiRequest('POST', '/api/push/native-token', {
              token: token.value,
              platform: (window as any).Capacitor.getPlatform(),
            });
          } catch (e) {
            console.error('Failed to save native push token:', e);
          }
        });

        const errHandler = await PushNotifications.addListener('registrationError', (err) => {
          console.error('Native push registration error:', err);
        });

        const receivedHandler = await PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('Push received (foreground):', notification.title);
        });

        const actionHandler = await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          const url = action.notification.data?.url;
          if (url) window.location.href = url;
        });

        cleanup = () => {
          regHandler.remove();
          errHandler.remove();
          receivedHandler.remove();
          actionHandler.remove();
        };
      } catch (e) {
        console.error('Native push setup error:', e);
      }
    })();

    return () => cleanup?.();
  }, [isLoggedIn]);
}
