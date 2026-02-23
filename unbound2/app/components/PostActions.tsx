"use client";

import { useEffect, useMemo, useState } from "react";
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

// On load, figure out if *I* already spanked this post
useEffect(() => {
let cancelled = false;

async function loadLiked() {
const { data: ses } = await supabase.auth.getSession();
const me = ses.session?.user?.id;
if (!me) return;

const { data, error } = await supabase
.from("post_likes")
.select("id")
.eq("post_id", postId)
.eq("user_id", me)
.maybeSingle();

if (cancelled) return;

if (error) {
// If this fails, we just leave liked=false (button still works)
console.error("load liked failed", error);
return;
}

setLiked(!!data);
}

loadLiked();
return () => {
cancelled = true;
};
}, [supabase, postId]);

async function handleSpank() {
if (busy) return;
setBusy(true);

try {
const { data: ses } = await supabase.auth.getSession();
const me = ses.session?.user?.id;
if (!me) return;

// Find post owner (so we can notify them when you spank)
const { data: post, error: postErr } = await supabase
.from("posts")
.select("user_id")
.eq("id", postId)
.maybeSingle();

if (postErr) {
console.error("post lookup failed", postErr);
return;
}
if (!post?.user_id) return;

// Try to INSERT like first (spank)
const { error: insErr } = await supabase
.from("post_likes")
.insert({ post_id: postId, user_id: me });

if (!insErr) {
// Spanked successfully
setLiked(true);

// Notify post owner (but not yourself)
if (post.user_id !== me) {
await supabase.from("notifications").insert({
user_id: post.user_id,
actor_id: me,
type: "spank",
entity_table: "posts",
entity_id: String(postId),
message: "spanked your post",
});
}
return;
}

// If insert failed because it already exists => UNspank (delete)
const msg = String((insErr as any)?.message || "").toLowerCase();
const isConflict =
(insErr as any)?.status === 409 ||
(insErr as any)?.code === "23505" ||
msg.includes("duplicate") ||
msg.includes("unique");

if (isConflict) {
const { error: delErr } = await supabase
.from("post_likes")
.delete()
.eq("post_id", postId)
.eq("user_id", me);

if (delErr) {
console.error("unspank failed", delErr);
return;
}

setLiked(false);
return;
}

// Some other real error
console.error("spank failed", insErr);
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
cursor: busy ? "not-allowed" : "pointer",
opacity: busy ? 0.85 : 1,
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