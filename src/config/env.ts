import { z } from "zod";

const envSchema = z.object({
  VITE_GOOGLE_CLIENT_ID: z.string().optional().or(z.literal("")),
  VITE_BILLING_API_BASE_URL: z.string().url().optional().or(z.literal("")),
  VITE_RESET_EMAIL_WEBHOOK_URL: z.string().url().optional().or(z.literal("")),
  VITE_COLLECTIONS_WEBHOOK_URL: z.string().url().optional().or(z.literal("")),
  VITE_COLLECTIONS_WHATSAPP_WEBHOOK_URL: z.string().url().optional().or(z.literal("")),
  VITE_COLLECTIONS_STATUS_WEBHOOK_URL: z.string().url().optional().or(z.literal("")),
  VITE_INVOICE_EMAIL_WEBHOOK_URL: z.string().url().optional().or(z.literal("")),
});

export type AppEnv = z.infer<typeof envSchema>;

export function readEnv(): AppEnv {
  const parsed = envSchema.safeParse(import.meta.env);
  if (!parsed.success) {
    const message = parsed.error.issues
      .map((issue) => `${issue.path.join(".")}: ${issue.message}`)
      .join("; ");
    throw new Error(`Environment validation failed: ${message}`);
  }
  return parsed.data;
}