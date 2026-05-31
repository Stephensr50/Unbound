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
try {
const { senderId, recipientId, amountCents } = await req.json();

if (!senderId || !recipientId || !amountCents) {
return NextResponse.json({ error: "Missing tip info." }, { status: 400 });
}

if (amountCents < 100) {
return NextResponse.json(
{ error: "Minimum tip is $1.00." },
{ status: 400 }
);
}

const supabase = getAdminSupabase();

const { data: recipient, error: recipientError } = await supabase
.from("profiles")
.select("id, user_id, display_name, username")
.or(`id.eq.${recipientId},user_id.eq.${recipientId}`)
.single();

if (recipientError || !recipient) {
return NextResponse.json(
{ error: "Recipient not found." },
{ status: 404 }
);
}

const { data: tipRow, error: tipError } = await supabase
.from("profile_tips")
.insert({
sender_id: senderId,
recipient_id: recipient.id,
amount_cents: amountCents,
currency: "usd",
status: "pending",
})
.select("id")
.single();

if (tipError || !tipRow) {
console.error("Tip insert error:", tipError);
return NextResponse.json(
{ error: "Could not create tip record." },
{ status: 500 }
);
}

const baseUrl =
process.env.NEXT_PUBLIC_SITE_URL ||
process.env.NEXT_PUBLIC_APP_URL ||
"http://localhost:3000";

const session = await stripe.checkout.sessions.create({
mode: "payment",
success_url: `${baseUrl}/profile?tip_success=1`,
cancel_url: `${baseUrl}/profile?tip_cancelled=1`,
metadata: {
type: "profile_tip",
tip_id: String(tipRow.id),
sender_id: senderId,
recipient_id: recipient.id,
},
line_items: [
{
quantity: 1,
price_data: {
currency: "usd",
unit_amount: amountCents,
product_data: {
name: `Buy ${
recipient.display_name || recipient.username || "this creator"
} a coffee`,
},
},
},
],
});

await supabase
.from("profile_tips")
.update({
stripe_session_id: session.id,
})
.eq("id", tipRow.id);

return NextResponse.json({ url: session.url });
} catch (err: any) {
console.error("Tip checkout error:", err);

return NextResponse.json(
{
error:
err?.message || "Something went wrong creating tip checkout.",
},
{ status: 500 }
);
}
}