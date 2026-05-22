import * as Sentry from "@sentry/nextjs";

import {
  getSentryEnvironment,
  isSentryEnabled,
  sanitizeSentryEvent,
} from "./src/lib/observability";

Sentry.init({
  dsn: process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN,
  enabled: isSentryEnabled(),
  environment: getSentryEnvironment(),
  sendDefaultPii: false,
  tracesSampleRate: 0,
  beforeBreadcrumb(breadcrumb) {
    return sanitizeSentryEvent(breadcrumb);
  },
  beforeSend(event) {
    return sanitizeSentryEvent(event);
  },
});

