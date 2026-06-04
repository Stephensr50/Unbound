import { NextResponse } from "next/server";
import Stripe from "stripe";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

function getAdminSupabase() {
return createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.SUPABASE_SERVICE_ROLE_KEY!
);
}

export async function POST(req: Request) {
try {
const { userId } = await req.json();

if (!userId) {
return NextResponse.json({ error: "Missing userId." }, { status: 400 });
}

const supabase = getAdminSupabase();

const { data: profile, error: profileError } = await supabase
.from("profiles")
.select("id, user_id, email, stripe_account_id")
.or(`id.eq.${userId},user_id.eq.${userId}`)
.single();

if (profileError || !profile) {
return NextResponse.json({ error: "Profile not found." }, { status: 404 });
}

let accountId = profile.stripe_account_id;

if (!accountId) {
const account = await stripe.accounts.create({
type: "express",
country: "US",
email: profile.email || undefined,
capabilities: {
card_payments: { requested: true },
transfers: { requested: true },
},
metadata: {
profile_id: profile.id,
user_id: profile.user_id || profile.id,
},
});

accountId = account.id;

await supabase
.from("profiles")
.update({ stripe_account_id: accountId })
.eq("id", profile.id);
}

const baseUrl =
process.env.NEXT_PUBLIC_SITE_URL ||
process.env.NEXT_PUBLIC_APP_URL ||
"http://localhost:3000";

const accountLink = await stripe.accountLinks.create({
account: accountId,
refresh_url: `${baseUrl}/profile?stripe_refresh=1`,
return_url: `${baseUrl}/profile?stripe_return=1`,
type: "account_onboarding",
});

return NextResponse.json({ url: accountLink.url });
} catch (err: any) {
console.error("Create Connect account error:", err);

return NextResponse.json(
{ error: err?.message || "Could not start Stripe onboarding." },
{ status: 500 }
);
}
}