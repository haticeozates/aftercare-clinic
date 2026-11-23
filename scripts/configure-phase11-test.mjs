import { readFileSync, writeFileSync } from "node:fs";

const file = "supabase/config.toml";
const config = readFileSync(file, "utf8");
const required = /^project_id = "aftercare-portfolio-stage2-test"$/m.test(config)
  && /^\[api\][^[]*\bport = 56321$/m.test(config)
  && /^\[db\][^[]*\bport = 56322$/m.test(config)
  && /^\[inbucket\][^[]*\bport = 56324$/m.test(config);
if (!required) throw new Error("Only the isolated Stage 2 test runner can enable Phase 11");
if (/^\[auth\.email\]/m.test(config)) {
  if (config.includes("phase11-confirmation.html") && config.includes("enable_confirmations = true")) {
    process.exit(0);
  }
  throw new Error("Unexpected Auth settings in the test runner");
}

const updated = config
  .replaceAll("http://127.0.0.1:3000", "http://localhost:3000")
  .replace("enable_signup = false", "enable_signup = true")
  .replace("[inbucket]\nenabled = false", "[inbucket]\nenabled = true");
if (!updated.includes("enable_signup = true") || !updated.includes("[inbucket]\nenabled = true")) {
  throw new Error("The isolated test config does not match the expected baseline");
}
writeFileSync(file, updated + `
[auth.email]
enable_signup = true
enable_confirmations = true
max_frequency = "1s"
otp_expiry = 900

[auth.email.template.confirmation]
subject = "AfterCare Clinic e-posta doğrulama"
content_path = "./supabase/templates/phase11-confirmation.html"

[auth.email.template.recovery]
subject = "AfterCare Clinic parola yenileme"
content_path = "./supabase/templates/phase11-recovery.html"
`);
console.log("Phase 11 email verification and local Mailpit configured for the isolated runner.");
