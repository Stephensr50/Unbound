import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

function getAdminClient() {
return createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.SUPABASE_SERVICE_ROLE_KEY!,
{ auth: { persistSession: false } }
);
}

export async function POST(req: Request) {
try {
const { sessionId, conversationId } = await req.json();

if (!sessionId || !conversationId) {
return NextResponse.json(
{ error: "Missing sessionId or conversationId" },
{ status: 400 }
);
}

const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
return NextResponse.json(
{ error: "Missing STRIPE_SECRET_KEY" },
{ status: 500 }
);
}

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
throw new Error(session?.error?.message || "Could not verify payment.");
}

if (session.payment_status !== "paid") {
return NextResponse.json(
{ error: "Payment is not marked paid." },
{ status: 402 }
);
}

if (session.metadata?.checkoutType !== "message") {
return NextResponse.json(
{ error: "Not a message checkout session." },
{ status: 400 }
);
}

if (String(session.metadata?.conversationId) !== String(conversationId)) {
return NextResponse.json(
{ error: "Conversation mismatch." },
{ status: 400 }
);
}

const adminClient = getAdminClient();

const { error } = await adminClient
.from("conversations")
.update({
paid_unlocked: true,
paid_unlocked_at: new Date().toISOString(),
paid_by: session.metadata?.payerId ?? null,
paid_to: session.metadata?.receiverId ?? null,
paid_amount_cents: Number(session.metadata?.priceCents ?? 0),
stripe_checkout_session_id: session.id,
})
.eq("id", conversationId);

if (error) throw error;

return NextResponse.json({ ok: true });
} catch (e: any) {
return NextResponse.json(
{ error: e?.message ?? "Could not confirm payment." },
{ status: 500 }
);
}
}