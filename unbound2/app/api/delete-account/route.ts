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

const { error: profileDeleteError } = await supabaseAdmin
.from("profiles")
.delete()
.eq("id", user.id);

if (profileDeleteError) {
return NextResponse.json(
{ error: profileDeleteError.message },
{ status: 500 }
);
}

const { error: authDeleteError } =
await supabaseAdmin.auth.admin.deleteUser(user.id);

if (authDeleteError) {
return NextResponse.json(
{ error: authDeleteError.message },
{ status: 500 }
);
}

return NextResponse.json({ ok: true });
} catch (error) {
return NextResponse.json(
{ error: error instanceof Error ? error.message : "Unknown server error." },
{ status: 500 }
);
}
}