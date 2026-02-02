import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabase(req: Request) {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

return createClient(url, key, {
auth: {
persistSession: false,
},
global: {
headers: {
Authorization: req.headers.get("authorization") ?? "",
},
},
});
}

export async function POST(req: Request) {
const supabase = getSupabase(req);

const { to } = await req.json().catch(() => ({}));
if (!to) {
return NextResponse.json({ error: "Missing 'to'" }, { status: 400 });
}

// who am I
const { data: authData } = await supabase.auth.getUser();
const me = authData.user?.id;
if (!me) {
return NextResponse.json({ error: "Not authed" }, { status: 401 });
}

// find my conversations
const { data: mine } = await supabase
.from("conversation_members")
.select("conversation_id")
.eq("user_id", me);

const convIds = (mine ?? []).map(r => r.conversation_id);

if (convIds.length > 0) {
const { data: both } = await supabase
.from("conversation_members")
.select("conversation_id")
.eq("user_id", to)
.in("conversation_id", convIds)
.limit(1);

if (both?.[0]) {
return NextResponse.json({ conversation_id: both[0].conversation_id });
}
}

// create conversation
const { data: conv, error: convErr } = await supabase
.from("conversations")
.insert({})
.select("id")
.single();

if (convErr || !conv) {
return NextResponse.json({ error: convErr?.message }, { status: 500 });
}

// insert both members (safe even if rerun thanks to UNIQUE constraint)
await supabase.from("conversation_members").upsert([
{ conversation_id: conv.id, user_id: me },
{ conversation_id: conv.id, user_id: to },
]);

return NextResponse.json({ conversation_id: conv.id });
}