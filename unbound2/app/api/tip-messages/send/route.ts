import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
try {
const body = await req.json();
const { receiver_id, amount, message } = body;

const supabase = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const authHeader = req.headers.get("authorization") || "";
const token = authHeader.replace("Bearer ", "").trim();

if (!token) {
return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

const {
data: { user },
error: userError,
} = await supabase.auth.getUser(token);

if (userError || !user) {
return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

const sender_id = user.id;

const { error } = await supabase.from("tip_messages").insert({
sender_id,
receiver_id,
amount,
message,
status: "pending",
});

if (error) {
return NextResponse.json({ error: error.message }, { status: 400 });
}

return NextResponse.json({ success: true });
} catch (err: any) {
return NextResponse.json(
{ error: err?.message || "Something went wrong" },
{ status: 500 }
);
}
}