// IMPORTANT: this file must be imported as the very first line of main.ts —
// before any NestJS / Prisma / express modules. Sentry's auto-instrumentation
// patches require/import internally, and patching only affects modules loaded
// AFTER Sentry.init(). If Sentry boots after the app, we miss instrumentation
// for everything already loaded.
//
// Why a separate file: keeps the side-effect import explicit and unambiguous.
// `import './instrument';` at top of main.ts says "I depend on this happening
// first" — a single inline Sentry.init() in main.ts can be reordered by tooling.

import * as Sentry from '@sentry/nestjs';

const dsn = process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    release: process.env.SENTRY_RELEASE,

    // Performance tracing disabled by default — free tier has only 10k spans/mo
    // and we don't have a perf-debugging need yet. Flip to 0.1-0.3 when needed.
    tracesSampleRate: 0,

    // PII off: don't auto-capture IPs / cookies / request bodies. We attach
    // user-id explicitly when relevant (future enhancement). Phone numbers must
    // never reach Sentry — they're in DTO bodies which are skipped by default
    // when sendDefaultPii=false.
    sendDefaultPii: false,

    // Drop noisy errors that aren't actionable.
    ignoreErrors: [
      // Client closed the connection before we finished — not a server bug.
      'Request aborted',
      // ThrottlerException: thrown when a client hits the rate limit. We want
      // those visible in our own logs (already counted by ThrottlerGuard) but
      // not as Sentry "issues" — they're expected behavior, not bugs.
      'ThrottlerException: Too Many Requests',
    ],
  });
}
