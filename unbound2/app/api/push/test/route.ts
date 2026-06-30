import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import * as webpush from "web-push";

export const runtime = "nodejs";

export async function POST(req: Request) {
try {
const vapidSubject = process.env.VAPID_SUBJECT;
const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY;

if (!vapidSubject || !vapidPublicKey || !vapidPrivateKey) {
return NextResponse.json(
{ error: "Missing VAPID environment variables." },
{ status: 500 }
);
}

webpush.setVapidDetails(vapidSubject, vapidPublicKey, vapidPrivateKey);

const authHeader = req.headers.get("authorization");

if (!authHeader) {
return NextResponse.json({ error: "Missing authorization header" }, { status: 401 });
}

const supabase = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
{
global: {
headers: {
Authorization: authHeader,
},
},
}
);

const {
data: { user },
error: userError,
} = await supabase.auth.getUser();

if (userError || !user) {
return NextResponse.json({ error: "Not logged in" }, { status: 401 });
}

const { data: subscriptions, error } = await supabase
.from("push_subscriptions")
.select("id, subscription")
.eq("user_id", user.id);

if (error) {
return NextResponse.json({ error: error.message }, { status: 500 });
}

if (!subscriptions || subscriptions.length === 0) {
return NextResponse.json({ error: "No push subscriptions found." }, { status: 404 });
}

const payload = JSON.stringify({
title: "Unbound",
body: "Test notification from Unbound 🔔",
url: "/feed",
});
const results = await Promise.all(
subscriptions.map(async (row) => {
try {
await webpush.sendNotification(row.subscription, payload);
return { id: row.id, ok: true };
} catch (err: any) {
console.error("Push test failed for subscription:", {
id: row.id,
statusCode: err?.statusCode,
body: err?.body,
message: err?.message,
});

return {
id: row.id,
ok: false,
statusCode: err?.statusCode,
body: err?.body,
message: err?.message,
};
}
})
);

return NextResponse.json({
ok: true,
sent: results.filter((r) => r.ok).length,
failed: results.filter((r) => !r.ok).length,
results,
});

return NextResponse.json({ ok: true });
} catch (err) {
console.error("Push test failed:", err);

return NextResponse.json(
{ error: err instanceof Error ? err.message : "Unknown push error" },
{ status: 500 }
);
}
}