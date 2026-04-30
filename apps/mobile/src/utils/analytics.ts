import { api } from '../api/client';
import { useAuthStore } from '../store/auth-store';

/**
 * Names allowed by the backend (TrackEventDto). Keep this in sync if you
 * add new ones — the backend rejects payloads that don't match the
 * snake_case slug pattern.
 */
export type AnalyticsEventName =
  | 'app_opened'
  | 'signup_started'
  | 'signup_completed'
  | 'workshop_viewed'
  | 'application_created';

/**
 * Fire-and-forget product-analytics tracker.
 *
 * Failures (offline, server error, rate-limit) are silently swallowed —
 * analytics MUST NEVER block or break user flow.
 *
 * userId is pulled from the auth store automatically when the user is
 * signed in; pre-login events (app_opened, signup_started) carry no
 * userId. Backend stores client IP and user-agent for sanity.
 */
export function track(
  name: AnalyticsEventName,
  properties?: Record<string, unknown>,
): void {
  const userId = useAuthStore.getState().session?.user?.id;
  api
    .post('/analytics/event', { name, properties, userId })
    .catch(() => {
      // intentional no-op: never bubble analytics errors up
    });
}
