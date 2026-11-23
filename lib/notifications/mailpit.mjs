const titles = {
  appointment_confirmed: "Randevu onaylandı",
  appointment_rescheduled: "Randevu saati değişti",
  appointment_cancelled: "Randevu kapatıldı",
  appointment_reminder: "Randevu hatırlatması",
  follow_up_reminder: "Kontrol randevusu hatırlatması"
};
export const syntheticEmail = /^[a-z0-9._%+-]+@[a-z0-9-]+(?:\.[a-z0-9-]+)*\.test$/i;

/** @param {{mail:string,app:string}} config */
export function mailpit(config) {
  const href = new URL("/clinic/notifications", config.app).href;
  return {
    /**
     * @param {{id:string,to:string,kind:keyof typeof titles}} job
     * @returns {Promise<{result:"reconciled"|"accepted"|"provider_rejected"|"provider_unavailable",id?:string}>}
     */
    async deliver(job) {
      const title = titles[job.kind];
      if (!title || !syntheticEmail.test(job.to) || !/^[a-f0-9-]{36}$/.test(job.id)) return { result: "provider_rejected" };
      const messageId = `aftercare-${job.id}@notification.test`;
      try {
        const search = new URL("/api/v1/search", config.mail);
        search.searchParams.set("query", "message-id:" + messageId);
        const previous = await fetch(search, { redirect: "error", signal: AbortSignal.timeout(2500) });
        if (!previous.ok) return { result: "provider_unavailable" };
        const results = await previous.json();
        if (!Array.isArray(results.messages)) return { result: "provider_unavailable" };
        const recovered = results.messages.find((message) => Array.isArray(message.To)
          && message.To.some((contact) => contact.Address === job.to));
        if (recovered && typeof recovered.ID === "string" && recovered.ID.length <= 128) {
          return { result: "reconciled", id: recovered.ID };
        }

        const text = `${title}\n\nGüncel bilgiyi görmek için AfterCare Clinic bildirim merkezini açın.\n${href}\n\nYerel portföy demosu`;
        const html = `<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${title}</title></head>
<body style="margin:0;background:#f5f3eb;color:#19352b;font-family:Arial,'Liberation Sans','Helvetica Neue',Helvetica,sans-serif"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="font-family:Arial,'Liberation Sans','Helvetica Neue',Helvetica,sans-serif"><tr><td style="padding:24px 12px">
<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="max-width:520px;margin:0 auto;background:#fffefa;border:1px solid #c9d9cb;border-radius:14px">
<tr><td style="padding:17px 22px;background:#e5eee2;border-radius:14px 14px 0 0;font-weight:bold;color:#174536">AfterCare Clinic</td></tr>
<tr><td style="padding:24px 22px"><h1 style="font-size:25px;line-height:1.25;margin:0 0 12px">${title}</h1>
<p style="line-height:1.55">Güncel bilgiyi görmek için bildirim merkezini açın.</p>
<p style="margin:22px 0"><a href="${href}" style="display:inline-block;background:#174536;color:white;border-radius:8px;padding:12px 16px;text-decoration:none">Bildirim merkezine git</a></p>
<p style="margin:0;color:#445b50;font-size:13px">Yerel portföy demosu</p>
</td></tr></table></td></tr></table></body></html>`;
        const send = await fetch(new URL("/api/v1/send", config.mail), {
          method: "POST", redirect: "error", signal: AbortSignal.timeout(3500),
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            From: { Email: "aftercare@notification.test", Name: "AfterCare Clinic" },
            To: [{ Email: job.to }], Subject: "AfterCare Clinic · " + title, Text: text, HTML: html,
            Headers: { "Message-ID": "<" + messageId + ">" }
          })
        });
        if (send.status >= 500) return { result: "provider_unavailable" };
        if (!send.ok) return { result: "provider_rejected" };
        const receipt = await send.json();
        return typeof receipt.ID === "string" && receipt.ID.length > 0 && receipt.ID.length <= 128
          ? { result: "accepted", id: receipt.ID } : { result: "provider_unavailable" };
      } catch {
        return { result: "provider_unavailable" };
      }
    }
  };
}
