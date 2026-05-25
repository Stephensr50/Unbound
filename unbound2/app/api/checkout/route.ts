import { NextResponse } from "next/server";
import Stripe from "stripe";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
try {
const { postId, userId } = await req.json();

if (!postId || !userId) {
return NextResponse.json(
{ error: "Missing postId or userId" },
{ status: 400 }
);
}

const siteUrl =
process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

const session = await stripe.checkout.sessions.create({
mode: "payment",
payment_method_types: ["card"],
line_items: [
{
quantity: 1,
price_data: {
currency: "usd",
unit_amount: 149,
product_data: {
name: "Unlock Unbound content",
},
},
},
],
success_url: `${siteUrl}/feed?unlock=success&postId=${postId}`,
cancel_url: `${siteUrl}/feed?unlock=cancelled&postId=${postId}`,
metadata: {
postId: String(postId),
userId: String(userId),
},
});

return NextResponse.json({ url: session.url });
} catch (err: any) {
console.error("Stripe checkout error:", err);

return NextResponse.json(
{ error: err.message || "Checkout failed" },
{ status: 500 }
);
}
}