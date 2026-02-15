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

// Optional: load whether I already liked this post
useEffect(() => {
let cancelled = false;

(async () => {
const { data: ses } = await supabase.auth.getSession();
const me = ses.session?.user?.id;
if (!me) return;

const { data, error } = await supabase
.from("post_likes")
.select("id")
.eq("post_id", postId)
.eq("user_id", me)
.maybeSingle();

if (!cancelled) setLiked(!error && !!data);
})();

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

if (!liked) {
// INSERT like
const { error } = await supabase.from("post_likes").insert({
post_id: postId,
user_id: me,
});

if (error) throw error;

// ✅ Notification should be created by DB trigger on post_likes
setLiked(true);
} else {
// UNLIKE (optional toggle)
const { error } = await supabase
.from("post_likes")
.delete()
.eq("post_id", postId)
.eq("user_id", me);

if (error) throw error;

setLiked(false);
}
} catch (e: any) {
alert(e?.message ?? String(e));
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
background: liked ? "rgba(168,85,247,0.35)" : "rgba(168,85,247,0.12)",
color: "white",
fontWeight: 700,
cursor: "pointer",
opacity: busy ? 0.75 : 1,
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
cursor: "pointer",
}}
onClick={() => {
alert("Comment modal next 🙂");
}}
>
Comment
</button>
</div>
);
}