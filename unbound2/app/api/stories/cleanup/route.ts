import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

export async function POST() {
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !serviceRoleKey) {
return NextResponse.json(
{ error: "Missing Supabase server env vars." },
{ status: 500 }
);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
auth: {
persistSession: false,
},
});

const { data: expiredFiles, error: fetchError } = await supabase
.from("expired_story_media")
.select("id, media_path")
.limit(100);

if (fetchError) {
return NextResponse.json({ error: fetchError.message }, { status: 500 });
}

const paths = (expiredFiles ?? [])
.map((row) => row.media_path)
.filter(Boolean);

if (paths.length === 0) {
return NextResponse.json({
ok: true,
deletedFiles: 0,
message: "No expired story media to clean up.",
});
}

const { error: storageError } = await supabase.storage
.from("stories")
.remove(paths);

if (storageError) {
return NextResponse.json({ error: storageError.message }, { status: 500 });
}

const ids = (expiredFiles ?? []).map((row) => row.id);

const { error: deleteRowsError } = await supabase
.from("expired_story_media")
.delete()
.in("id", ids);

if (deleteRowsError) {
return NextResponse.json(
{ error: deleteRowsError.message },
{ status: 500 }
);
}

return NextResponse.json({
ok: true,
deletedFiles: paths.length,
});
}