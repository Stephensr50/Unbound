import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export async function DELETE(
req: Request,
context: { params: Promise<{ id: string }> }
) {
const { id } = await context.params;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!url || !serviceKey) {
return new NextResponse("Missing Supabase env", { status: 500 });
}

const supabase = createClient(url, serviceKey);

const storyId = id;

const { data: story, error: fetchErr } = await supabase
.from("stories")
.select("id, user_id, media_url")
.eq("id", storyId)
.single();

if (fetchErr || !story) {
return new NextResponse("Story not found", { status: 404 });
}

const { error: delErr } = await supabase
.from("stories")
.delete()
.eq("id", storyId);

if (delErr) {
return new NextResponse(delErr.message, { status: 400 });
}

try {
const marker = "/storage/v1/object/public/";
const idx = story.media_url.indexOf(marker);

if (idx !== -1) {
const after = story.media_url.slice(idx + marker.length);
const [bucket, ...pathParts] = after.split("/");
const path = pathParts.join("/");

if (bucket && path) {
await supabase.storage.from(bucket).remove([path]);
}
}
} catch {
// ignore storage delete errors
}

return NextResponse.json({ ok: true });
}