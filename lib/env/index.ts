import { z } from "zod";
import type { AppEnv } from "@/lib/types";

const appEnvValues = ["local", "test", "development", "preview", "staging", "production"] as const;

const serverEnvSchema = z
  .object({
    APP_ENV: z.enum(appEnvValues),
    NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
    SUPABASE_SERVICE_ROLE_KEY: z
      .string()
      .min(1)
      .refine((value) => !value.startsWith("NEXT_PUBLIC"), {
        message: "SUPABASE_SERVICE_ROLE_KEY must never be public"
      }),
    PHOTO_CLEANUP_SECRET: z.string().min(16).optional(),
    SUPABASE_PROJECT_REF: z.string().min(1),
    AUDIT_LOG_PEPPER: z.string().min(1),
    RATE_LIMIT_PEPPER: z.string().min(1).optional(),
    PRODUCTION_SUPABASE_PROJECT_REF: z.string().min(1).optional()
  })
  .superRefine((env, ctx) => {
    if (
      env.APP_ENV === "preview" &&
      env.PRODUCTION_SUPABASE_PROJECT_REF &&
      env.SUPABASE_PROJECT_REF === env.PRODUCTION_SUPABASE_PROJECT_REF
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["SUPABASE_PROJECT_REF"],
        message: "Preview environment cannot use the production Supabase project ref"
      });
    }
  });

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1)
});

export type ServerEnv = z.infer<typeof serverEnvSchema> & { APP_ENV: AppEnv };
export type PublicEnv = z.infer<typeof publicEnvSchema>;

export function parseServerEnv(source: NodeJS.ProcessEnv | Record<string, string | undefined>) {
  return serverEnvSchema.parse(source) as ServerEnv;
}

export function getServerEnv() {
  return parseServerEnv(process.env);
}

export function getPublicEnv(source: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env) {
  return publicEnvSchema.parse(source);
}
