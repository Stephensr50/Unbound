"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import SpankIcon from "./icons/SpankIcon";

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
return createClient(url, key);
}

export default function PostActions({ postId }: { postId: number }) {
const supabase = useMemo(() => getSupabase(), []);
const [liked, setLiked] = useState(false);
const [busy, setBusy] = useState(false);

// Comment UI
const [commentOpen, setCommentOpen] = useState(false);
const [commentText, setCommentText] = useState("");
const [commentBusy, setCommentBusy] = useState(false);

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

// optimistic UI
setLiked(true);

const { error: insErr } = await supabase
.from("post_likes")
.insert({ post_id: postId, user_id: me });

if (!insErr) {
setLiked(true);
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

console.error("spank failed", insErr?.message, insErr);
setLiked(false);
} finally {
setBusy(false);
}
}

async function handleSubmitComment() {
if (commentBusy) return;
const body = commentText.trim();
if (!body) return;

setCommentBusy(true);
try {
const { data: ses } = await supabase.auth.getSession();
const me = ses.session?.user?.id;
if (!me) return;

const { error } = await supabase.from("post_comments").insert({
post_id: postId,
user_id: me,
body,
});

if (error) {
console.error("comment insert failed", error?.message, error);
return;
}

setCommentText("");
setCommentOpen(false);
} finally {
setCommentBusy(false);
}
}

// This styling is IMPORTANT:
// position/zIndex/pointerEvents makes sure clicks land on the buttons
// even if some invisible overlay is sitting over the post card.
const actionBtnBase: React.CSSProperties = {
padding: "6px 12px",
borderRadius: 999,
border: "1px solid rgba(168,85,247,0.4)",
background: "rgba(168,85,247,0.12)",
color: "rgba(255,255,255,0.9)",
fontWeight: 700,
cursor: "pointer",
position: "relative",
zIndex: 50,
pointerEvents: "auto",
};

return (
<div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 10 }}>
<div style={{ display: "flex", gap: 10 }}>
<button
onClick={handleSpank}
disabled={busy}
style={{
...actionBtnBase,
background: liked ? "rgba(168,85,247,0.35)" : "rgba(168,85,247,0.12)",
cursor: busy ? "not-allowed" : "pointer",
opacity: busy ? 0.85 : 1,
}}
>
<span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
<SpankIcon size={18} />
<span>{liked ? "Spanked" : "Spank"}</span>
</span>
</button>

<button
type="button"
onClick={() => setCommentOpen((v) => !v)}
style={actionBtnBase}
>
Comment
</button>
</div>

{commentOpen && (
<div
style={{
position: "relative",
zIndex: 50,
pointerEvents: "auto",
border: "1px solid rgba(168,85,247,0.25)",
borderRadius: 14,
padding: 10,
background: "rgba(0,0,0,0.35)",
maxWidth: 520,
}}
>
<textarea
value={commentText}
onChange={(e) => setCommentText(e.target.value)}
placeholder="Write a comment…"
rows={3}
style={{
width: "100%",
resize: "vertical",
padding: 10,
borderRadius: 12,
border: "1px solid rgba(255,255,255,0.12)",
background: "rgba(255,255,255,0.06)",
color: "white",
outline: "none",
}}
/>

<div style={{ display: "flex", gap: 10, marginTop: 10 }}>
<button
type="button"
onClick={handleSubmitComment}
disabled={commentBusy || !commentText.trim()}
style={{
...actionBtnBase,
background: "rgba(168,85,247,0.25)",
cursor: commentBusy ? "not-allowed" : "pointer",
opacity: commentBusy ? 0.85 : 1,
}}
>
{commentBusy ? "Posting…" : "Post"}
</button>

<button
type="button"
onClick={() => {
setCommentOpen(false);
setCommentText("");
}}
style={actionBtnBase}
>
Cancel
</button>
</div>
</div>
)}
</div>
);
}