import * as Sentry from "@sentry/node";

Sentry.init({
  dsn: "https://c93888a5e789afb024acdd57559c888b@o4511786733207552.ingest.de.sentry.io/4511798704865360",
  tracesSampleRate: 1.0,
  // تفعيل ميزة إرسال الـ Logs المباشرة لسينتري
  enableLogs: true, 
});

// السطر اللي سينتري مستنيه منك في الشاشة بالضبط!
Sentry.logger.info('User triggered test log', { action: 'test_log' });