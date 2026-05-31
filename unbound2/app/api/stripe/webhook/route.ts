import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function getAdminSupabase() {
return createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.SUPABASE_SERVICE_ROLE_KEY!
);
}

export async function POST(req: Request) {
const body = await req.text();
const signature = req.headers.get("stripe-signature");

if (!signature) {
return NextResponse.json({ error: "Missing Stripe signature." }, { status: 400 });
}

let event: Stripe.Event;

try {
event = stripe.webhooks.constructEvent(
body,
signature,
process.env.STRIPE_WEBHOOK_SECRET!
);
} catch (err: any) {
console.error("Stripe webhook signature error:", err.message);
return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
}

try {
const supabase = getAdminSupabase();

if (event.type === "checkout.session.completed") {
const session = event.data.object as Stripe.Checkout.Session;
const metadata = session.metadata ?? {};

if (metadata.type === "profile_tip") {
const tipId = metadata.tip_id;
const senderId = metadata.sender_id;
const recipientId = metadata.recipient_id;

if (tipId && senderId && recipientId) {
await supabase
.from("profile_tips")
.update({
status: "paid",
stripe_payment_intent_id:
typeof session.payment_intent === "string"
? session.payment_intent
: null,
})
.eq("id", tipId);

await supabase.from("notifications").insert({
user_id: recipientId,
actor_id: senderId,
type: "tip_received",
message: "Someone bought you a coffee ☕",
href: `/u/${senderId}`,
});
}
}
}

return NextResponse.json({ received: true });
} catch (err: any) {
console.error("Stripe webhook handler error:", err);
return NextResponse.json({ error: "Webhook handler failed." }, { status: 500 });
}
}