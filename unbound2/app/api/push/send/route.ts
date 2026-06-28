import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as webpush from "web-push";

export const runtime = "nodejs";

export async function POST(req: Request) {
try {
const { recipientId, title, body, url } = await req.json();

if (!recipientId) {
return NextResponse.json({ error: "Missing recipientId" }, { status: 400 });
}

const vapidSubject = process.env.VAPID_SUBJECT;
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (!vapidSubject || !vapidPublicKey || !vapidPrivateKey) {
return NextResponse.json({ error: "Missing VAPID env vars" }, { status: 500 });
}

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

const supabaseAdmin = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const { data: subscriptions, error } = await supabaseAdmin
.from("push_subscriptions")
.select("id, subscription")
.eq("user_id", recipientId);

if (error) {
return NextResponse.json({ error: error.message }, { status: 500 });
}

if (!subscriptions || subscriptions.length === 0) {
return NextResponse.json({ ok: true, sent: 0 });
}

const payload = JSON.stringify({
title: title || "Unbound",
body: body || "You have a new notification.",
url: url || "/messages",
});

await Promise.all(
subscriptions.map((row) =>
webpush.sendNotification(row.subscription, payload).catch((err) => {
console.error("Push failed:", err);
})
)
);

return NextResponse.json({ ok: true, sent: subscriptions.length });
} catch (err) {
console.error("Push send failed:", err);

return NextResponse.json(
{ error: err instanceof Error ? err.message : "Unknown push error" },
{ status: 500 }
);
}
}