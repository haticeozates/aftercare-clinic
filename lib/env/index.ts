import { z } from "zod";
import type { AppEnv } from "@/lib/types";

const appEnvValues = ["local", "test", "development", "preview", "staging", "production"] as const;

export const LOCAL_RATE_LIMIT_PEPPER_FALLBACK = "local-rate-limit-pepper-deterministic-test-only";

const rateLimitPepperPlaceholders = new Set([
  "replace-with-local-random-value",
  LOCAL_RATE_LIMIT_PEPPER_FALLBACK
]);

export function isLocalSupabaseUrl(url: string) {
  try {
    const hostname = new URL(url).hostname;
    return hostname === "127.0.0.1" || hostname === "localhost" || hostname === "[::1]";
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

function getJwtClaims(key: string): Record<string, unknown> {
  try {
    const payload = key.split(".")[1];
    const decoded: unknown = payload && JSON.parse(atob(payload.replace(/-/g, "+").replace(/_/g, "/")));
    return decoded && typeof decoded === "object" ? decoded as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export function isPublicSupabaseKey(key: string) {
  const role = getJwtClaims(key).role;
  return !key.startsWith("sb_secret_") && (role === undefined || role === "anon");
}

const publicSupabaseKey = z.string().min(1).refine(isPublicSupabaseKey, {
  message: "Supabase public key must have anon or publishable scope"
});

function validateHostedCredentials(
  env: { SUPABASE_PROJECT_REF: string; NEXT_PUBLIC_SUPABASE_ANON_KEY: string; SUPABASE_SERVICE_ROLE_KEY: string },
  ctx: z.RefinementCtx
) {
  const keys = {
    NEXT_PUBLIC_SUPABASE_ANON_KEY: ["sb_publishable_", "anon"],
    SUPABASE_SERVICE_ROLE_KEY: ["sb_secret_", "service_role"]
  };
  for (const name of ["NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"] as const) {
    const [prefix, role] = keys[name];
    const value = env[name];
    const claims = getJwtClaims(value);
    if (!value.startsWith(prefix) && (claims.role !== role || claims.ref !== env.SUPABASE_PROJECT_REF)) {
      ctx.addIssue({
        code: "custom",
        path: [name],
        message: "Hosted Supabase credential must match its scope and configured project"
      });
    }
  }
}

export function isHostedAppEnv(appEnv: string) {
  return appEnv === "preview" || appEnv === "staging" || appEnv === "production";
}

function validateRateLimitPepper(
  env: {
    APP_ENV: AppEnv;
    AUDIT_LOG_PEPPER: string;
    RATE_LIMIT_PEPPER?: string;
  },
  ctx: z.RefinementCtx
) {
  if (!isHostedAppEnv(env.APP_ENV)) {
    return;
  }

  const pepper = env.RATE_LIMIT_PEPPER?.trim();
  if (!pepper) {
    ctx.addIssue({
      code: "custom",
      path: ["RATE_LIMIT_PEPPER"],
      message: "RATE_LIMIT_PEPPER is required in hosted environments"
    });
    return;
  }

  if (pepper.length < 32) {
    ctx.addIssue({
      code: "custom",
      path: ["RATE_LIMIT_PEPPER"],
      message: "RATE_LIMIT_PEPPER must be at least 32 characters in hosted environments"
    });
  }

  if (rateLimitPepperPlaceholders.has(pepper) || /^replace-with/i.test(pepper)) {
    ctx.addIssue({
      code: "custom",
      path: ["RATE_LIMIT_PEPPER"],
      message: "RATE_LIMIT_PEPPER cannot use a placeholder value in hosted environments"
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
    NEXT_PUBLIC_SUPABASE_ANON_KEY: publicSupabaseKey,
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

    if (env.SUPABASE_SERVICE_ROLE_KEY === env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      ctx.addIssue({ code: "custom", path: ["SUPABASE_SERVICE_ROLE_KEY"], message: "Public and server keys must differ" });
    }

    if (env.PHOTO_CLEANUP_SECRET && env.PHOTO_CLEANUP_SECRET === env.RATE_LIMIT_CLEANUP_SECRET) {
      ctx.addIssue({ code: "custom", path: ["RATE_LIMIT_CLEANUP_SECRET"], message: "Cleanup secrets must differ" });
    }

    let url: URL;
    try {
      url = new URL(env.NEXT_PUBLIC_SUPABASE_URL);
    } catch {
      return;
    }
    const hosted = isHostedAppEnv(env.APP_ENV);

    if (url.username || url.password || url.search || url.hash || url.pathname !== "/") {
      ctx.addIssue({ code: "custom", path: ["NEXT_PUBLIC_SUPABASE_URL"], message: "Supabase URL must be a bare origin" });
    }

    if (hosted) {
      const productionRef = env.PRODUCTION_SUPABASE_PROJECT_REF;
      if (!productionRef || !/^[a-z0-9]{20}$/.test(productionRef)) {
        ctx.addIssue({
          code: "custom", path: ["PRODUCTION_SUPABASE_PROJECT_REF"],
          message: "Hosted environments require a configured production project ref"
        });
      }
      if (env.APP_ENV !== "production" && usesProductionSupabaseProjectRef(env)) {
        ctx.addIssue({
          code: "custom", path: ["SUPABASE_PROJECT_REF"],
          message: env.APP_ENV === "preview"
            ? "Preview environment cannot use the production Supabase project ref"
            : "Staging environment cannot use the production Supabase project ref"
        });
      }
      if (!/^[a-z0-9]{20}$/.test(env.SUPABASE_PROJECT_REF) ||
          url.origin !== `https://${env.SUPABASE_PROJECT_REF}.supabase.co`) {
        ctx.addIssue({
          code: "custom", path: ["NEXT_PUBLIC_SUPABASE_URL"],
          message: "Hosted Supabase HTTPS origin must match SUPABASE_PROJECT_REF"
        });
      }
      validateHostedCredentials(env, ctx);
      if (env.AUDIT_LOG_PEPPER.trim().length < 32 || /^replace-with|^local-/i.test(env.AUDIT_LOG_PEPPER)) {
        ctx.addIssue({
          code: "custom", path: ["AUDIT_LOG_PEPPER"],
          message: "Hosted audit pepper must be dedicated and at least 32 characters"
        });
      }
      validateRateLimitPepper(env, ctx);
    } else if (!["http:", "https:"].includes(url.protocol) ||
        !isLocalSupabaseUrl(env.NEXT_PUBLIC_SUPABASE_URL) || !isLocalProjectRef(env.SUPABASE_PROJECT_REF)) {
      ctx.addIssue({
        code: "custom", path: ["NEXT_PUBLIC_SUPABASE_URL"],
        message: "Local environments require a loopback Supabase origin and a local project ref"
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
          message: "RATE_LIMIT_CLEANUP_SECRET is required in hosted environments"
        });
      }

    }
  });

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: publicSupabaseKey
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

  if (isHostedAppEnv(appEnv)) {
    throw new Error("RATE_LIMIT_PEPPER is required in hosted environments");
  }

  return LOCAL_RATE_LIMIT_PEPPER_FALLBACK;
}
