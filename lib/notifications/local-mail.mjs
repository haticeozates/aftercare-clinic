const localEnvironments = new Set(["local", "test", "development"]);

function isLoopback(value, port, protocol = "http:") {
  if (!value) return false;
  try {
    const url = new URL(value);
    return url.protocol === protocol && ["127.0.0.1", "localhost"].includes(url.hostname) &&
      url.port === port && url.pathname === "/" && !url.username && !url.password && !url.search && !url.hash;
  } catch {
    return false;
  }
}

export function notificationMailConfig(env = process.env) {
  if (env.PHASE13_MAIL_ENABLED !== "true" || !localEnvironments.has(env.APP_ENV) ||
      !isLoopback(env.NEXT_PUBLIC_SUPABASE_URL, "56321") ||
      !isLoopback(env.PHASE13_MAILPIT_ORIGIN, "56324") ||
      !isLoopback(env.PHASE13_APP_ORIGIN, "3000")) return null;
  return {
    mail: new URL(env.PHASE13_MAILPIT_ORIGIN).origin,
    app: new URL(env.PHASE13_APP_ORIGIN).origin
  };
}

export function isolatedNotificationDatabase(value, toml) {
  if (!/^project_id = "aftercare-portfolio-stage2-test"$/m.test(toml)
      || !/^\[db\][^[]*\bport = 56322$/m.test(toml)
      || !/^\[api\][^[]*\bport = 56321$/m.test(toml)
      || !/^\[inbucket\][^[]*\bport = 56324$/m.test(toml)) return false;
  try {
    const url = new URL(value);
    return ["postgres:", "postgresql:"].includes(url.protocol) &&
      ["127.0.0.1", "localhost"].includes(url.hostname) &&
      url.port === "56322" && url.pathname === "/postgres" && !url.search && !url.hash;
  } catch {
    return false;
  }
}
