"use client";

import { useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";


function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
return createClient(url, key);
}

export default function PostActions({ postId }: { postId: number }) {
const supabase = useMemo(() => getSupabase(), []);
const [liked, setLiked] = useState(false);
const [busy, setBusy] = useState(false);

async function handleSpank() {
if (busy) return;
setBusy(true);

try {
const { data: ses } = await supabase.auth.getSession();
const me = ses.session?.user?.id;
if (!me) return;

// find post owner
const { data: post } = await supabase
.from("posts")
.select("user_id")
.eq("id", postId)
.maybeSingle();

if (!post?.user_id) return;

// insert like/spank (if you don't have a spanks table, use post_likes instead)
// IMPORTANT: pick ONE that exists in your DB:
// await supabase.from("post_likes").insert({ post_id: postId, user_id: me });
await supabase.from("spanks").insert({ post_id: postId, user_id: me });

// look up actor profile for display name + avatar
const { data: actorProfile } = await supabase
.from("profiles")
.select("display_name, username, avatar_url")
.eq("id", me)
.maybeSingle();

const actorName =
actorProfile?.display_name ||
(actorProfile?.username ? `@${actorProfile.username}` : "Someone");

// insert notification (don’t notify yourself)
if (post.user_id !== me) {
await supabase.from("notifications").insert({
user_id: post.user_id,
actor_id: me,
type: "spank",
entity_id: String(postId),
href: `/feed?focusPost=${postId}`,
title: `${actorName} spanked your post`,
body: null,
read_at: null,
actor_display_name: actorName,
actor_avatar_url: actorProfile?.avatar_url ?? null,
});
}

setLiked(true);
} finally {
setBusy(false);
}
}

return (
<div style={{ display: "flex", gap: 10, marginTop: 10 }}>
<button
onClick={handleSpank}
disabled={busy}
style={{
padding: "6px 12px",
borderRadius: 999,
border: "1px solid rgba(168,85,247,0.4)",
background: liked
? "rgba(168,85,247,0.35)"
: "rgba(168,85,247,0.12)",
color: "white",
fontWeight: 700,
cursor: "pointer",
}}
>
{liked ? "Spanked 💜" : "Spank"}
</button>

<button
style={{
padding: "6px 12px",
borderRadius: 999,
border: "1px solid rgba(168,85,247,0.4)",
background: "rgba(168,85,247,0.12)",
color: "white",
fontWeight: 700,
}}
>
Comment
</button>
</div>
);
}