import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
try {
const body = await req.json();
const { receiver_id, amount, message } = body;

const authSupabase = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!serviceRoleKey) {
return NextResponse.json(
{ error: "Missing SUPABASE_SERVICE_ROLE_KEY in .env.local" },
{ status: 500 }
);
}

const adminSupabase = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
serviceRoleKey
);

const authHeader = req.headers.get("authorization") || "";
const token = authHeader.replace("Bearer ", "").trim();

if (!token) {
return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

const {
data: { user },
error: userError,
} = await authSupabase.auth.getUser(token);

if (userError || !user) {
return NextResponse.json(
{ error: userError?.message || "Not authenticated" },
{ status: 401 }
);
}

const sender_id = user.id;

if (!receiver_id) {
return NextResponse.json({ error: "Missing receiver_id" }, { status: 400 });
}

if (sender_id === receiver_id) {
return NextResponse.json(
{ error: "You cannot tip yourself" },
{ status: 400 }
);
}

const { error: tipError } = await adminSupabase.from("tip_messages").insert({
sender_id,
receiver_id,
amount,
message,
status: "pending",
});

if (tipError) {
return NextResponse.json(
{ error: `tip_messages insert failed: ${tipError.message}` },
{ status: 400 }
);
}

let conversationId: number | string | null = null;

const { data: senderMemberships, error: senderMembershipsError } =
await adminSupabase
.from("conversation_members")
.select("conversation_id")
.eq("user_id", sender_id);

if (senderMembershipsError) {
return NextResponse.json(
{
error: `sender conversation_members lookup failed: ${senderMembershipsError.message}`,
},
{ status: 400 }
);
}

const senderConversationIds = (senderMemberships ?? []).map(
(row: any) => row.conversation_id
);

if (senderConversationIds.length > 0) {
const { data: receiverMemberships, error: receiverMembershipsError } =
await adminSupabase
.from("conversation_members")
.select("conversation_id")
.eq("user_id", receiver_id)
.in("conversation_id", senderConversationIds);

if (receiverMembershipsError) {
return NextResponse.json(
{
error: `receiver conversation_members lookup failed: ${receiverMembershipsError.message}`,
},
{ status: 400 }
);
}

if ((receiverMemberships ?? []).length > 0) {
conversationId = receiverMemberships![0].conversation_id;
}
}

if (!conversationId) {
const { data: newConversation, error: conversationError } =
await adminSupabase.from("conversations").insert({}).select("id").single();

if (conversationError || !newConversation) {
return NextResponse.json(
{
error: `conversations insert failed: ${
conversationError?.message || "No conversation returned"
}`,
},
{ status: 400 }
);
}

conversationId = newConversation.id;

const { error: membersError } = await adminSupabase
.from("conversation_members")
.insert([
{ conversation_id: conversationId, user_id: sender_id },
{ conversation_id: conversationId, user_id: receiver_id },
]);

if (membersError) {
return NextResponse.json(
{ error: `conversation_members insert failed: ${membersError.message}` },
{ status: 400 }
);
}
}

const bodyText =
typeof message === "string" && message.trim()
? `💸 Sent you a tip: ${message.trim()}`
: "💸 Sent you a tip!";

const { error: messageError } = await adminSupabase.from("messages").insert({
conversation_id: conversationId,
sender_id,
body: bodyText,
});

if (messageError) {
return NextResponse.json(
{ error: `messages insert failed: ${messageError.message}` },
{ status: 400 }
);
}

const { error: updateError } = await adminSupabase
.from("conversations")
.update({ last_message_at: new Date().toISOString() })
.eq("id", conversationId);

if (updateError) {
return NextResponse.json(
{ error: `conversations update failed: ${updateError.message}` },
{ status: 400 }
);
}

return NextResponse.json({
success: true,
conversation_id: conversationId,
});
} catch (err: any) {
return NextResponse.json(
{ error: err?.message || "Something went wrong" },
{ status: 500 }
);
}
}