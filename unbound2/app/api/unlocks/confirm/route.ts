import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

export async function POST(req: Request) {
try {
const { sessionId } = await req.json();

if (!sessionId) {
return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const secretKey = process.env.STRIPE_SECRET_KEY;

if (!supabaseUrl || !serviceRoleKey) {
return NextResponse.json(
{ error: "Missing Supabase server environment variables" },
{ status: 500 }
);
}

if (!secretKey) {
return NextResponse.json(
{ error: "Missing STRIPE_SECRET_KEY" },
{ status: 500 }
);
}

const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

const stripeRes = await fetch(
`https://api.stripe.com/v1/checkout/sessions/${sessionId}`,
{
headers: {
Authorization: `Bearer ${secretKey}`,
},
}
);

const session = await stripeRes.json();

if (!stripeRes.ok) {
return NextResponse.json(
{ error: session?.error?.message || "Could not verify Stripe session" },
{ status: 400 }
);
}

if (session.payment_status !== "paid") {
return NextResponse.json(
{ error: "Payment has not been completed" },
{ status: 402 }
);
}

const postId = Number(session.metadata?.postId);
const buyerId = String(session.metadata?.userId || "");

if (!postId || !buyerId) {
return NextResponse.json(
{ error: "Missing checkout metadata" },
{ status: 400 }
);
}

const { data: postRow, error: postErr } = await supabaseAdmin
.from("posts")
.select("id,user_id")
.eq("id", postId)
.maybeSingle();

if (postErr || !postRow) {
return NextResponse.json({ error: "Post not found" }, { status: 404 });
}

const { data: existingUnlock } = await supabaseAdmin
.from("post_unlocks")
.select("post_id")
.eq("post_id", postId)
.eq("buyer_id", buyerId)
.maybeSingle();

const { error: upsertErr } = await supabaseAdmin.from("post_unlocks").upsert(
{
post_id: postId,
buyer_id: buyerId,
creator_id: postRow.user_id,
amount_cents: 149,
currency: "usd",
},
{ onConflict: "post_id,buyer_id" }
);

if (upsertErr) {
return NextResponse.json({ error: upsertErr.message }, { status: 500 });
}

if (!existingUnlock && postRow.user_id !== buyerId) {
const href = `/feed?post=${postId}`;

const { data: existingNotification } = await supabaseAdmin
.from("notifications")
.select("id")
.eq("user_id", postRow.user_id)
.eq("actor_id", buyerId)
.eq("type", "content_unlock")
.eq("href", href)
.maybeSingle();

if (!existingNotification) {
await supabaseAdmin.from("notifications").insert({
user_id: postRow.user_id,
actor_id: buyerId,
type: "content_unlock",
message: "Someone unlocked your photo/video 🔓",
href,
});
}
}

return NextResponse.json({ ok: true, postId });
} catch (err: any) {
return NextResponse.json(
{ error: err?.message || "Unlock confirmation failed" },
{ status: 500 }
);
}
}