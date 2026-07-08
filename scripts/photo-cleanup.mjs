const mode = process.argv.includes("--execute") ? "execute" : "dry_run";
const baseUrl = process.env.AFTERCARE_LOCAL_URL ?? "http://localhost:3000";
const secret = process.env.PHOTO_CLEANUP_SECRET;

if (mode === "execute" && process.env.PHOTO_CLEANUP_CONFIRM !== "DELETE_ORPHANS") {
  console.error("Execute mode requires PHOTO_CLEANUP_CONFIRM=DELETE_ORPHANS.");
  process.exit(1);
}

if (!secret) {
  console.error("PHOTO_CLEANUP_SECRET is required.");
  process.exit(1);
}

const response = await fetch(`${baseUrl}/internal/jobs/photo-cleanup`, {
  method: "POST",
  headers: {
    "content-type": "application/json",
    authorization: `Bearer ${secret}`
  },
  body: JSON.stringify({ mode })
});

const body = await response.json().catch(() => ({ error: "cleanup_failed" }));

if (!response.ok) {
  console.error(JSON.stringify({ ok: false, status: response.status, error: body.error ?? "cleanup_failed" }));
  process.exit(1);
}

console.log(JSON.stringify({ ok: true, result: body }, null, 2));
