import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function POST(request: Request) {
try {
const authHeader = request.headers.get("authorization");

if (!authHeader?.startsWith("Bearer ")) {
return NextResponse.json({ error: "Missing auth token." }, { status: 401 });
}

const token = authHeader.replace("Bearer ", "");

const supabaseAdmin = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const {
data: { user },
error: userError,
} = await supabaseAdmin.auth.getUser(token);

if (userError || !user) {
return NextResponse.json({ error: "Could not verify user." }, { status: 401 });
}

const userId = user.id;

await supabaseAdmin.from("post_likes").delete().eq("user_id", userId);
await supabaseAdmin.from("post_comments").delete().eq("user_id", userId);
await supabaseAdmin.from("post_unlocks").delete().eq("user_id", userId);
await supabaseAdmin.from("stories").delete().eq("user_id", userId);
await supabaseAdmin.from("posts").delete().eq("user_id", userId);

await supabaseAdmin.from("follows").delete().or(`follower_id.eq.${userId},following_id.eq.${userId}`);
await supabaseAdmin.from("friends").delete().or(`user_id.eq.${userId},friend_id.eq.${userId}`);
await supabaseAdmin.from("friend_requests").delete().or(`sender_id.eq.${userId},receiver_id.eq.${userId}`);
await supabaseAdmin.from("blocked_users").delete().or(`blocker_id.eq.${userId},blocked_id.eq.${userId}`);

const { error: profileDeleteError } = await supabaseAdmin
.from("profiles")
.delete()
.eq("id", userId);

if (profileDeleteError) {
return NextResponse.json({ error: profileDeleteError.message }, { status: 500 });
}

const { error: authDeleteError } =
await supabaseAdmin.auth.admin.deleteUser(userId);

if (authDeleteError) {
return NextResponse.json({ error: authDeleteError.message }, { status: 500 });
}

return NextResponse.json({ ok: true });
} catch (error) {
return NextResponse.json(
{ error: error instanceof Error ? error.message : "Unknown server error." },
{ status: 500 }
);
}
}