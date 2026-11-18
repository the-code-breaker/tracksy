import { createClient } from "npm:@supabase/supabase-js@2.118.0";
const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization,apikey,content-type,x-client-info",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json",
  "Cache-Control": "no-store",
};
const reply = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers });
const escape = (value: string) =>
  value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ]!,
  );
function base64(text: string) {
  return btoa(String.fromCharCode(...new TextEncoder().encode(text)));
}
async function sendEmail(recipient: string, subject: string, html: string) {
  const user = Deno.env.get("TRACKSY_SMTP_USER"),
    password = Deno.env.get("TRACKSY_SMTP_PASSWORD");
  if (!user || !password) throw Error("Email delivery is not configured");
  if (
    /[\r\n]/.test(recipient) ||
    !recipient.includes("@") ||
    /[\r\n]/.test(user)
  )
    throw Error("Invalid recipient");
  const conn = await Deno.connectTls({ hostname: "smtp.gmail.com", port: 465 });
  const deadline = setTimeout(() => conn.close(), 15000),
    reader = conn.readable.getReader(),
    writer = conn.writable.getWriter();
  let pending = "";
  async function response(expected: number) {
    while (true) {
      const end = pending.indexOf("\r\n");
      if (end >= 0) {
        const line = pending.slice(0, end);
        pending = pending.slice(end + 2);
        if (/^\d{3} /.test(line)) {
          if (Number(line.slice(0, 3)) !== expected)
            throw Error("Email service rejected the message");
          return;
        }
      } else {
        const chunk = await reader.read();
        if (chunk.done) throw Error("Email service disconnected");
        pending += new TextDecoder().decode(chunk.value);
        if (pending.length > 20000) throw Error("Unexpected email response");
      }
    }
  }
  async function command(value: string, code: number) {
    await writer.write(new TextEncoder().encode(value + "\r\n"));
    await response(code);
  }
  try {
    await response(220);
    await command("EHLO tracksy.app", 250);
    await command("AUTH PLAIN " + base64("\0" + user + "\0" + password), 235);
    await command("MAIL FROM:<" + user + ">", 250);
    await command("RCPT TO:<" + recipient + ">", 250);
    await command("DATA", 354);
    const encoded =
      base64(html)
        .match(/.{1,76}/g)
        ?.join("\r\n") || "";
    await command(
      "From: Tracksy <" +
        user +
        ">\r\nTo: <" +
        recipient +
        ">\r\nSubject: =?UTF-8?B?" +
        base64(subject) +
        "?=\r\nMIME-Version: 1.0\r\nContent-Type: text/html; charset=UTF-8\r\nContent-Transfer-Encoding: base64\r\n\r\n" +
        encoded +
        "\r\n.",
      250,
    );
  } finally {
    clearTimeout(deadline);
    try {
      reader.releaseLock();
      writer.releaseLock();
      conn.close();
    } catch {}
  }
}
Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers });
  if (request.method !== "POST")
    return reply({ error: "Method not allowed" }, 405);
  if (!Deno.env.get("TRACKSY_SMTP_PASSWORD"))
    return reply(
      {
        error:
          "Email delivery is not ready. You can share an invitation link instead.",
      },
      503,
    );
  const auth = request.headers.get("authorization");
  if (!auth?.startsWith("Bearer "))
    return reply({ error: "Sign in to send an email." }, 401);
  const url = Deno.env.get("SUPABASE_URL")!,
    anon = Deno.env.get("SUPABASE_ANON_KEY")!,
    service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const client = createClient(url, anon, {
      global: { headers: { Authorization: auth } },
      auth: { persistSession: false },
    }),
    server = createClient(url, service, { auth: { persistSession: false } });
  const verified = await client.auth.getUser();
  if (verified.error || !verified.data.user)
    return reply({ error: "Sign in again to send an email." }, 401);
  let job: { id: string; status: string; link?: string } | null = null;
  try {
    const text = await request.text();
    if (text.length > 4096)
      return reply({ error: "Email request is too large" }, 400);
    const body = JSON.parse(text);
    if (!["invite", "reminder"].includes(body.kind))
      return reply({ error: "Invalid email request" }, 400);
    const prepared = await client.rpc("prepare_group_mail", {
      p_group: body.group_id,
      p_kind: body.kind,
      p_key: body.request_key,
      p_email: body.email || null,
      p_recipient: body.recipient_id || null,
      p_currency: body.currency || null,
    });
    if (prepared.error) return reply({ error: prepared.error.message }, 400);
    job = prepared.data;
    if (job?.status === "sent") return reply({ sent: true, link: job.link });
    const claimed = await server.rpc("claim_group_mail", {
      p_id: job!.id,
      p_user: verified.data.user.id,
    });
    if (claimed.error) return reply({ error: claimed.error.message }, 409);
    const delivery = claimed.data;
    if (delivery.status === "sent")
      return reply({ sent: true, link: job?.link });
    const invitation = delivery.kind === "invite",
      group = escape(delivery.group_name),
      sender = escape(delivery.sender_name),
      link = escape(delivery.link);
    const html = `<!doctype html><html><body style="font-family:Arial,sans-serif;color:#172c31;line-height:1.6"><h2 style="color:#008574">Tracksy</h2><h3>${invitation ? "You are invited to " + group : "A friendly reminder from " + group}</h3><p>${invitation ? sender + " invited you to share expenses in this group." : sender + " sent a reminder to review your outstanding group balance. Open Tracksy to check the latest expenses and payments."}</p><p><a href="${link}" style="display:inline-block;background:#008574;color:white;padding:12px 24px;border-radius:10px;text-decoration:none">${invitation ? "View invitation" : "Open Tracksy"}</a></p>${invitation ? "<p>This invitation is valid for seven days and can be used once. Sign in using the email address that received it. Joining does not include you in earlier expenses.</p>" : "<p>You can turn email reminders off in Profile → Notifications.</p>"}<p style="font-size:12px;color:#62767d">Sent at a group member’s request. If you did not expect this message, you can ignore it. <a href="https://tracksy-support.coralprawn64.chatgpt.site/privacy/">Privacy</a> · souravsharma191919@gmail.com</p></body></html>`;
    await sendEmail(
      delivery.recipient,
      invitation
        ? "You are invited to a Tracksy group"
        : "A reminder from your Tracksy group",
      html,
    );
    const completed = await server.rpc("complete_group_mail", {
      p_id: job!.id,
      p_user: verified.data.user.id,
      p_success: true,
    });
    if (completed.error) throw Error("Could not record email delivery");
    return reply({ sent: true, link: job?.link });
  } catch {
    if (job)
      await server.rpc("complete_group_mail", {
        p_id: job.id,
        p_user: verified.data.user.id,
        p_success: false,
      });
    return reply(
      {
        error:
          "The email could not be sent. Please try again. You can also share an invitation link.",
      },
      502,
    );
  }
});
