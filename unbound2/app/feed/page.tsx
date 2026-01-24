"use client";

import { useEffect, useState } from "react";
import StoriesBar from "./StoriesBar";
import { supabase } from "@/app/lib/supabaseClient";

type StoryRow = {
id: string;
user_id: string;
media_url: string | null;
caption: string | null;
created_at?: string;
};

type ProfileRow = {
id: string;
username: string | null;
avatar_url: string | null;
};

export default function FeedPage() {
const [stories, setStories] = useState<StoryRow[]>([]);
const [profilesById, setProfilesById] = useState<Record<string, ProfileRow>>(
{}
);
const [error, setError] = useState<string | null>(null);

const refreshStories = async () => {
setError(null);

const { data, error: storiesError } = await supabase
.from("stories")
.select("id, user_id, media_url, caption, created_at")
.order("created_at", { ascending: false })
.limit(50);

if (storiesError) {
setError(storiesError.message);
setStories([]);
return;
}

const rawStories = (data ?? []) as StoryRow[];

// 1️⃣ Deduplicate by story id
const dedupedById = Array.from(
new Map(rawStories.map((s) => [s.id, s])).values()
);

// 2️⃣ Keep only latest story per user (Instagram-style)
const seenUsers = new Set<string>();
const oneStoryPerUser = dedupedById.filter((story) => {
if (seenUsers.has(story.user_id)) return false;
seenUsers.add(story.user_id);
return true;
});

setStories(oneStoryPerUser);

// 3️⃣ Load profiles for visible stories
const userIds = Array.from(
new Set(oneStoryPerUser.map((s) => s.user_id))
);

if (!userIds.length) {
setProfilesById({});
return;
}

const { data: profiles, error: profilesError } = await supabase
.from("profiles")
.select("id, username, avatar_url")
.in("id", userIds);

if (profilesError) {
setProfilesById({});
return;
}

const profileMap: Record<string, ProfileRow> = {};
(profiles ?? []).forEach((p) => {
profileMap[p.id] = p;
});

setProfilesById(profileMap);
};

useEffect(() => {
refreshStories();
}, []);

return (
<div
style={{
paddingLeft: 16,
paddingRight: 16,
paddingTop: 96, // pushes below TopNav
paddingBottom: 16,
}}
>
{error && (
<div style={{ padding: 24, color: "white" }}>
<div
style={{
border: "1px solid rgba(255,0,0,.35)",
background: "rgba(255,0,0,.10)",
padding: 16,
borderRadius: 12,
}}
>
Stories query failed: {error}
</div>
</div>
)}

<StoriesBar stories={stories} profilesById={profilesById} />

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