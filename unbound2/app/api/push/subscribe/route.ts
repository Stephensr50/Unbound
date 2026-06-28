import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(req: Request) {
try {
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

const body = await req.json();

const { error } = await supabase.from("push_subscriptions").upsert(
{
user_id: user.id,
endpoint: body.endpoint,
subscription: body,
},
{ onConflict: "endpoint" }
);

if (error) {
return NextResponse.json({ error: error.message }, { status: 500 });
}

return NextResponse.json({ ok: true });
} catch (err) {
return NextResponse.json(
{ error: err instanceof Error ? err.message : "Unknown error" },
{ status: 500 }
);
}
}