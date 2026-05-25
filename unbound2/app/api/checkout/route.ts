import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST(req: Request) {
try {
const { postId, userId } = await req.json();

if (!postId || !userId) {
return NextResponse.json(
{ error: "Missing postId or userId" },
{ status: 400 }
);
}

return NextResponse.json(
{ error: "CHECKOUT DEBUG HIT" },
{ status: 418 }
);

const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const secretKey = process.env.STRIPE_SECRET_KEY;

if (!secretKey) {
return NextResponse.json(
{ error: "Missing STRIPE_SECRET_KEY" },
{ status: 500 }
);
}

const params = new URLSearchParams();

params.append("mode", "payment");
params.append("payment_method_types[]", "card");
params.append("line_items[0][quantity]", "1");
params.append("line_items[0][price_data][currency]", "usd");
params.append("line_items[0][price_data][unit_amount]", "149");
params.append(
"line_items[0][price_data][product_data][name]",
"Unlock Unbound content"
);
params.append("success_url", `${siteUrl}/feed?unlock=success&postId=${postId}`);
params.append("cancel_url", `${siteUrl}/feed?unlock=cancelled&postId=${postId}`);
params.append("metadata[postId]", String(postId));
params.append("metadata[userId]", String(userId));

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