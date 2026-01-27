import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("Missing Supabase env vars");
return createClient(url, key, { auth: { persistSession: false } });
}

export async function POST(req: Request) {
const supabase = getSupabase();

const { to } = await req.json().catch(() => ({}));
if (!to) return NextResponse.json({ error: "Missing 'to' user id" }, { status: 400 });

// Who am I? (from Supabase auth cookie)
const { data: authData, error: authErr } = await supabase.auth.getUser();
if (authErr || !authData?.user) {
return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

const me = authData.user.id;

// 1) Check if a conversation already exists between the two users
// We look in conversation_members for a conv that has BOTH members.
const { data: myMemberships, error: memErr } = await supabase
.from("conversation_members")
.select("conversation_id")
.eq("user_id", me);

if (memErr) return NextResponse.json({ error: memErr.message }, { status: 500 });

const convIds = (myMemberships ?? []).map((m: any) => m.conversation_id);

let existingId: string | null = null;

if (convIds.length > 0) {
const { data: otherMembership, error: otherErr } = await supabase
.from("conversation_members")
.select("conversation_id")
.eq("user_id", to)
.in("conversation_id", convIds);

if (otherErr) return NextResponse.json({ error: otherErr.message }, { status: 500 });

existingId = otherMembership?.[0]?.conversation_id ?? null;
}

if (existingId) {
return NextResponse.json({ conversation_id: existingId });
}

// 2) Create a new conversation
const { data: conv, error: convErr } = await supabase
.from("conversations")
.insert({})
.select("id")
.single();

if (convErr || !conv?.id) {
return NextResponse.json({ error: convErr?.message ?? "Failed to create conversation" }, { status: 500 });
}

const conversationId = conv.id;

// 3) Add both members
const { error: addErr } = await supabase.from("conversation_members").insert([
{ conversation_id: conversationId, user_id: me },
{ conversation_id: conversationId, user_id: to },
]);

if (addErr) {
return NextResponse.json({ error: addErr.message }, { status: 500 });
}

return NextResponse.json({ conversation_id: conversationId });
}