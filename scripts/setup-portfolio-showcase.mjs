import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import pg from "pg";
import { assertLocalOnlyTargets, readSupabaseStatusEnv } from "./lib/local-supabase-env.mjs";

const project = "aftercare-portfolio-showcase";

async function main() {
  const config = readFileSync("supabase/config.toml", "utf8");
  if (!new RegExp(`^project_id = "${project}"$`, "m").test(config)) {
    throw new Error("A dedicated local showcase project is required");
  }
  const env = readSupabaseStatusEnv();
  assertLocalOnlyTargets(env);
  const containerPort = execFileSync("docker", ["port", `supabase_db_${project}`, "5432/tcp"], {
    encoding: "utf8", stdio: ["ignore", "pipe", "pipe"]
  });
  if (new URL(env.DB_URL).port !== "56322" || new URL(env.API_URL).port !== "56321"
      || !containerPort.split("\n").some((line) => line.endsWith(":56322"))) {
    throw new Error("The showcase database must match its dedicated local container and ports");
  }

  // Reuse the demo tenant as a foundation without changing its regression fixture.
  const foundation = readFileSync("supabase/demo/phase9b-demo.sql", "utf8");
  const showcase = readFileSync("supabase/demo/portfolio-showcase.sql", "utf8");
  const client = new pg.Client({ connectionString: env.DB_URL });
  await client.connect();
  try {
    await client.query(foundation);
    await client.query(showcase);
    console.log("Local portfolio showcase prepared for the mock clinic.");
  } finally {
    await client.end();
  }
}

main().catch(() => {
  console.error("Showcase setup stopped. Check the dedicated local Supabase identity and seed prerequisites.");
  process.exitCode = 1;
});
