import { createClient } from "@supabase/supabase-js";
import StoriesBar from "./StoriesBar";

export const dynamic = "force-dynamic";

type StoryRow = {
id: string;
user_id: string;
media_url: string;
caption: string | null;
};

type ProfileRow = {
id: string;
username: string | null;
avatar_url: string | null;
};

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
throw new Error(
"Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY in env."
);
}

return createClient(url, key, { auth: { persistSession: false } });
}

export default async function FeedPage() {
const supabase = getSupabase();

const { data: stories, error: storiesError } = await supabase
.from("stories")
.select("id,user_id,media_url,caption")
.order("created_at", { ascending: false })
.limit(200);

if (storiesError) {
return (
<div style={{ padding: 24, color: "white" }}>
<div
style={{
border: "1px solid rgba(255,0,0,.35)",
background: "rgba(255,0,0,.10)",
padding: 16,
borderRadius: 12,
}}
>
Stories query failed: {storiesError.message}
</div>
</div>
);
}

const storyRows = (stories ?? []) as StoryRow[];
const userIds = Array.from(new Set(storyRows.map((s) => s.user_id)));

let profilesById: Record<string, ProfileRow> = {};
if (userIds.length) {
const { data: profiles } = await supabase
.from("profiles")
.select("id,username,avatar_url")
.in("id", userIds);

if (profiles) {
profilesById = Object.fromEntries(
(profiles as ProfileRow[]).map((p) => [p.id, p])
);
}
}

return (
<div style={{ paddingLeft: 16, paddingRight: 16, paddingTop: 32, paddingBottom: 16 }}>
{/* STORIES: top of feed */}
<StoriesBar stories={storyRows} profilesById={profilesById} />

{/* Posts feed (placeholder for now) */}
<div style={{ marginTop: 16 }}>
<div
style={{
border: "1px solid rgba(255,255,255,.12)",
background: "rgba(0,0,0,.25)",
padding: 16,
borderRadius: 16,
color: "rgba(255,255,255,.80)",
}}
>
Posts will go here next.
</div>
</div>
</div>
);
}