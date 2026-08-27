import { Storage } from "@google-cloud/storage";

/**
 * Used only when STORAGE_DRIVER=gcs.
 * Relies on Application Default Credentials / GOOGLE_APPLICATION_CREDENTIALS.
 * Production VPS uses STORAGE_DRIVER=local (see fileStorage.ts).
 */
export const objectStorageClient = new Storage(
  process.env.GCS_PROJECT_ID
    ? { projectId: process.env.GCS_PROJECT_ID }
    : undefined,
);
