import { z } from "zod";
import type { AppEnv } from "@/lib/types";

const appEnvValues = ["local", "test", "development", "preview", "staging", "production"] as const;

export const LOCAL_RATE_LIMIT_PEPPER_FALLBACK = "local-rate-limit-pepper-deterministic-test-only";

const rateLimitPepperPlaceholders = new Set([
  "replace-with-local-random-value",
  LOCAL_RATE_LIMIT_PEPPER_FALLBACK
]);

function isLocalSupabaseUrl(url: string) {
  try {
    const hostname = new URL(url).hostname;
    return hostname === "127.0.0.1" || hostname === "localhost";
  } catch {
    return false;
  }
}

function isLocalProjectRef(projectRef: string) {
  return projectRef === "local-aftercare" || projectRef.startsWith("local-");
}

function usesProductionSupabaseProjectRef(env: {
  APP_ENV: AppEnv;
  SUPABASE_PROJECT_REF: string;
  PRODUCTION_SUPABASE_PROJECT_REF?: string;
}) {
  return Boolean(
    env.PRODUCTION_SUPABASE_PROJECT_REF && env.SUPABASE_PROJECT_REF === env.PRODUCTION_SUPABASE_PROJECT_REF
  );
}

function validateRateLimitPepper(
  env: {
    APP_ENV: AppEnv;
    AUDIT_LOG_PEPPER: string;
    RATE_LIMIT_PEPPER?: string;
  },
  ctx: z.RefinementCtx
) {
  if (env.APP_ENV !== "production") {
    return;
  }

  const pepper = env.RATE_LIMIT_PEPPER?.trim();
  if (!pepper) {
    ctx.addIssue({
      code: "custom",
      path: ["RATE_LIMIT_PEPPER"],
      message: "RATE_LIMIT_PEPPER is required in production"
    });
    return;
  }

  if (pepper.length < 32) {
    ctx.addIssue({
      code: "custom",
      path: ["RATE_LIMIT_PEPPER"],
      message: "RATE_LIMIT_PEPPER must be at least 32 characters in production"
    });
  }

  if (rateLimitPepperPlaceholders.has(pepper) || /^replace-with/i.test(pepper)) {
    ctx.addIssue({
      code: "custom",
      path: ["RATE_LIMIT_PEPPER"],
      message: "RATE_LIMIT_PEPPER cannot use a placeholder value in production"
    });
  }

  if (pepper === env.AUDIT_LOG_PEPPER) {
    ctx.addIssue({
      code: "custom",
      path: ["RATE_LIMIT_PEPPER"],
      message: "RATE_LIMIT_PEPPER must differ from AUDIT_LOG_PEPPER"
    });
  }
}

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
    RATE_LIMIT_CLEANUP_SECRET: z.string().min(16).optional(),
    SUPABASE_PROJECT_REF: z.string().min(1),
    AUDIT_LOG_PEPPER: z.string().min(1),
    RATE_LIMIT_PEPPER: z.string().min(1).optional(),
    PRODUCTION_SUPABASE_PROJECT_REF: z.string().min(1).optional()
  })
  .superRefine((env, ctx) => {
    if (env.APP_ENV === "preview" && usesProductionSupabaseProjectRef(env)) {
      ctx.addIssue({
        code: "custom",
        path: ["SUPABASE_PROJECT_REF"],
        message: "Preview environment cannot use the production Supabase project ref"
      });
    }

    if (
      (env.APP_ENV === "local" || env.APP_ENV === "test" || env.APP_ENV === "development") &&
      usesProductionSupabaseProjectRef(env)
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["SUPABASE_PROJECT_REF"],
        message: "Local and test environments cannot use the production Supabase project ref"
      });
    }

    if (env.APP_ENV === "production") {
      if (isLocalSupabaseUrl(env.NEXT_PUBLIC_SUPABASE_URL)) {
        ctx.addIssue({
          code: "custom",
          path: ["NEXT_PUBLIC_SUPABASE_URL"],
          message: "Production cannot use a local Supabase URL"
        });
      }

      if (isLocalProjectRef(env.SUPABASE_PROJECT_REF)) {
        ctx.addIssue({
          code: "custom",
          path: ["SUPABASE_PROJECT_REF"],
          message: "Production cannot use a local project ref"
        });
      }

      if (
        env.PRODUCTION_SUPABASE_PROJECT_REF &&
        env.SUPABASE_PROJECT_REF !== env.PRODUCTION_SUPABASE_PROJECT_REF
      ) {
        ctx.addIssue({
          code: "custom",
          path: ["SUPABASE_PROJECT_REF"],
          message: "Production must use the configured production Supabase project ref"
        });
      }

      if (!env.RATE_LIMIT_CLEANUP_SECRET) {
        ctx.addIssue({
          code: "custom",
          path: ["RATE_LIMIT_CLEANUP_SECRET"],
          message: "RATE_LIMIT_CLEANUP_SECRET is required in production"
        });
      }

      validateRateLimitPepper(env, ctx);
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

export function resolveRateLimitPepper(source: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env) {
  const appEnv = (source.APP_ENV ?? "development") as AppEnv;
  const configured = source.RATE_LIMIT_PEPPER?.trim();

  if (configured) {
    return configured;
  }

  if (appEnv === "production") {
    throw new Error("RATE_LIMIT_PEPPER is required in production");
  }

  return LOCAL_RATE_LIMIT_PEPPER_FALLBACK;
}
