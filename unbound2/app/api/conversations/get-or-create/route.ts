import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

/**
* USER CLIENT (respects RLS)
*/
function getUserClient(req: Request) {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

return createClient(url, key, {
auth: { persistSession: false },
global: {
headers: {
Authorization: req.headers.get("authorization") ?? "",
},
},
});
}

/**
* ADMIN CLIENT (bypasses RLS)
*/
function getAdminClient() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

return createClient(url, serviceKey, {
auth: { persistSession: false },
});
}

async function getMessagePriceCents(adminClient: ReturnType<typeof getAdminClient>, me: string, to: string) {
const { data: friendRows, error: friendErr } = await adminClient
.from("friends")
.select("user_id, friend_id")
.or(
`and(user_id.eq.${me},friend_id.eq.${to}),and(user_id.eq.${to},friend_id.eq.${me})`
)
.limit(1);

if (friendErr) {
throw new Error(friendErr.message);
}

if ((friendRows ?? []).length > 0) {
return {
price_cents: 0,
relationship: "friend",
requires_payment: false,
};
}

const { data: followRows, error: followErr } = await adminClient
.from("follows")
.select("follower_id, following_id")
.eq("follower_id", me)
.eq("following_id", to)
.limit(1);

if (followErr) {
throw new Error(followErr.message);
}

if ((followRows ?? []).length > 0) {
return {
price_cents: 149,
relationship: "following",
requires_payment: true,
};
}

return {
price_cents: 299,
relationship: "none",
requires_payment: true,
};
}

export async function POST(req: Request) {
try {
const userClient = getUserClient(req);
const adminClient = getAdminClient();

const { to } = await req.json().catch(() => ({}));

if (!to || typeof to !== "string") {
return NextResponse.json({ error: "Missing 'to'" }, { status: 400 });
}

const {
data: { user },
error: authErr,
} = await userClient.auth.getUser();

if (authErr || !user?.id) {
return NextResponse.json({ error: "Not authed" }, { status: 401 });
}

const me = user.id;

if (me === to) {
return NextResponse.json(
{ error: "Cannot create a conversation with yourself" },
{ status: 400 }
);
}

const pricing = await getMessagePriceCents(adminClient, me, to);

const { data: myMemberships, error: myErr } = await adminClient
.from("conversation_members")
.select("conversation_id")
.eq("user_id", me);

if (myErr) {
return NextResponse.json({ error: myErr.message }, { status: 500 });
}

const myConversationIds = (myMemberships ?? [])
.map((row) => row.conversation_id)
.filter(Boolean);

if (myConversationIds.length > 0) {
const { data: sharedMemberships, error: sharedErr } = await adminClient
.from("conversation_members")
.select("conversation_id")
.eq("user_id", to)
.in("conversation_id", myConversationIds)
.order("conversation_id", { ascending: true });

if (sharedErr) {
return NextResponse.json({ error: sharedErr.message }, { status: 500 });
}

const existingConversationId = sharedMemberships?.[0]?.conversation_id;

if (existingConversationId) {
return NextResponse.json({
conversation_id: existingConversationId,
existing: true,
...pricing,
});
}
}

const { data: conv, error: convErr } = await adminClient
.from("conversations")
.insert({})
.select("id")
.single();

if (convErr || !conv) {
return NextResponse.json(
{ error: convErr?.message || "Failed to create conversation" },
{ status: 500 }
);
}

const { error: membersErr } = await adminClient
.from("conversation_members")
.upsert(
[
{ conversation_id: conv.id, user_id: me },
{ conversation_id: conv.id, user_id: to },
],
{
onConflict: "conversation_id,user_id",
}
);

if (membersErr) {
return NextResponse.json({ error: membersErr.message }, { status: 500 });
}

return NextResponse.json({
conversation_id: conv.id,
existing: false,
...pricing,
});
} catch (e: any) {
return NextResponse.json(
{
error: e?.message ?? "Failed to get or create conversation",
},
{ status: 500 }
);
}
}