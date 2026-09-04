declare module "@sentry/react-native" {
  import type { ComponentType } from "react";

  export type SeverityLevel = "fatal" | "error" | "warning" | "log" | "info" | "debug";

  export interface Breadcrumb {
    category?: string;
    message?: string;
    level?: SeverityLevel;
    data?: Record<string, unknown>;
  }

  export interface User {
    id?: string;
    email?: string;
    username?: string;
    [key: string]: unknown;
  }

  export interface CaptureContext {
    tags?: Record<string, string>;
    extra?: Record<string, unknown>;
  }

  export interface ReactNativeOptions {
    dsn?: string;
    enabled?: boolean;
    debug?: boolean;
    tracesSampleRate?: number;
    enableNative?: boolean;
    environment?: string;
    release?: string;
    dist?: string;
    enableAutoSessionTracking?: boolean;
  }

  export function init(options: ReactNativeOptions): void;
  export function setTag(key: string, value: string): void;
  export function setUser(user: User | null): void;
  export function addBreadcrumb(breadcrumb: Breadcrumb): void;
  export function captureException(
    exception: unknown,
    captureContext?: CaptureContext,
  ): string;
  export function flush(timeout?: number): Promise<boolean>;
  export function wrap<P>(component: ComponentType<P>): ComponentType<P>;

  const Sentry: {
    init: typeof init;
    setTag: typeof setTag;
    setUser: typeof setUser;
    addBreadcrumb: typeof addBreadcrumb;
    captureException: typeof captureException;
    flush: typeof flush;
    wrap: typeof wrap;
  };

  export default Sentry;
}
