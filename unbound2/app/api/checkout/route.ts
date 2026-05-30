import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
try {
const body = await req.json();

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
return NextResponse.json(
{ error: "Missing STRIPE_SECRET_KEY" },
{ status: 500 }
);
}

const checkoutType = body.checkoutType ?? "post_unlock";

const params = new URLSearchParams();

params.append("mode", "payment");
params.append("payment_method_types[]", "card");
params.append("line_items[0][quantity]", "1");
params.append("line_items[0][price_data][currency]", "usd");

if (checkoutType === "message") {
const conversationId = body.conversationId;
const payerId = body.payerId;
const receiverId = body.receiverId;
const priceCents = Number(body.priceCents);

if (!conversationId || !payerId || !receiverId || !priceCents) {
return NextResponse.json(
{ error: "Missing message checkout info" },
{ status: 400 }
);
}

params.append(
"line_items[0][price_data][unit_amount]",
String(priceCents)
);
params.append(
"line_items[0][price_data][product_data][name]",
"Start an Unbound conversation"
);

params.append(
"success_url",
`${siteUrl}/messages/${conversationId}?checkout_session_id={CHECKOUT_SESSION_ID}&message_paid=1`
);
params.append(
"cancel_url",
`${siteUrl}/messages?message_payment=cancelled`
);

params.append("metadata[checkoutType]", "message");
params.append("metadata[conversationId]", String(conversationId));
params.append("metadata[payerId]", String(payerId));
params.append("metadata[receiverId]", String(receiverId));
params.append("metadata[priceCents]", String(priceCents));
} else {
const { postId, userId } = body;

if (!postId || !userId) {
return NextResponse.json(
{ error: "Missing postId or userId" },
{ status: 400 }
);
}

params.append("line_items[0][price_data][unit_amount]", "149");
params.append(
"line_items[0][price_data][product_data][name]",
"Unlock Unbound content"
);

params.append(
"success_url",
`${siteUrl}/feed?checkout_session_id={CHECKOUT_SESSION_ID}`
);
params.append(
"cancel_url",
`${siteUrl}/feed?unlock=cancelled&postId=${postId}`
);

params.append("metadata[checkoutType]", "post_unlock");
params.append("metadata[postId]", String(postId));
params.append("metadata[userId]", String(userId));
}

const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
method: "POST",
headers: {
Authorization: `Bearer ${secretKey}`,
"Content-Type": "application/x-www-form-urlencoded",
},
body: params.toString(),
});

const session = await stripeRes.json();

if (!stripeRes.ok) {
throw new Error(session?.error?.message || "Stripe checkout failed.");
}

return NextResponse.json({ url: session.url });
} catch (err: any) {
console.error("Stripe checkout error:", err);

return NextResponse.json(
{ error: err.message || "Checkout failed" },
{ status: 500 }
);
}
}