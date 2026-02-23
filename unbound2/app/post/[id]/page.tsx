"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useParams, useRouter, useSearchParams } from "next/navigation";

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
return createClient(url, key);
}

type PostRow = {
id: number;
user_id: string;
body: string | null;
kind: string;
created_at: string;
media_url: string | null;
media_type: string | null;
};

type CommentRow = {
id: number;
post_id: number;
user_id: string;
body: string;
created_at: string;
};

type ProfileRow = {
id: string;
username: string | null;
display_name: string | null;
avatar_url: string | null;
};

function timeAgo(ts: string) {
const then = new Date(ts).getTime();
const now = Date.now();
const s = Math.max(0, Math.floor((now - then) / 1000));
if (s < 15) return "just now";
if (s < 60) return `${s}s`;
if (s < 3600) return `${Math.floor(s / 60)}m`;
if (s < 86400) return `${Math.floor(s / 3600)}h`;
return `${Math.floor(s / 86400)}d`;
}

function UnboundSpankIcon({ on }: { on: boolean }) {
const stroke = "rgba(255,255,255,0.95)";
const fillOn = "rgba(192,38,211,0.92)";

return (
<svg
width="24"
height="24"
viewBox="0 0 24 24"
style={{
filter: on
? "drop-shadow(0 0 12px rgba(192,38,211,.9))"
: "drop-shadow(0 0 6px rgba(255,255,255,.12))",
transition: "all .16s ease",
}}
>
<path
d="
M7.2 8.8
C5.4 6.8,5.6 4.7,7.2 3.7
C8.6 2.9,9.6 3.4,10.4 4.8
C10.9 3.0,12.2 2.0,14.0 2.0
C15.8 2.0,17.1 3.0,17.6 4.8
C18.4 3.4,19.4 2.9,20.8 3.7
C22.4 4.7,22.6 6.8,20.8 8.8
C19.9 9.9,18.7 10.2,17.6 9.9
C17.9 10.7,18.0 11.6,17.8 12.6
C17.3 15.6,14.9 18.0,12.0 20.5
C9.1 18.0,6.7 15.6,6.2 12.6
C6.0 11.6,6.1 10.7,6.4 9.9
C5.3 10.2,4.1 9.9,7.2 8.8
Z
"
fill={on ? fillOn : "none"}
stroke={stroke}
strokeWidth="2.2"
strokeLinejoin="round"
/>
</svg>
);
}

export default function PostPage() {
const supabase = useMemo(() => getSupabase(), []);
const params = useParams();
const router = useRouter();

const postId = useMemo(() => {
const raw = typeof params?.id === "string" ? params.id : "";
const n = Number(raw);
return Number.isFinite(n) ? n : NaN;
}, [params]);

const [myUserId, setMyUserId] = useState<string | null>(null);
const [post, setPost] = useState<PostRow | null>(null);
const [author, setAuthor] = useState<ProfileRow | null>(null);

const [banner, setBanner] = useState<string | null>(null);

const [likeCount, setLikeCount] = useState(0);
const [commentCount, setCommentCount] = useState(0);
const [liked, setLiked] = useState(false);

const [openComments, setOpenComments] = useState(true);
const [comments, setComments] = useState<CommentRow[]>([]);
const [draft, setDraft] = useState("");
const [busy, setBusy] = useState(false);
 const searchParams = useSearchParams();

// highlight/flash support (ex: /post/38?flash=1 or ?flash=8000)
const [flashOn, setFlashOn] = useState(false);
const flashTimerRef = useMemo<{ id: number | null }>(() => ({ id: null }), []);

async function refreshAuth() {
const { data } = await supabase.auth.getSession();
const uid = data.session?.user?.id ?? null;
setMyUserId(uid);
return uid;
}

async function loadPostAndStuff(pid: number) {
setBanner(null);

const uid = await refreshAuth();

// post
const { data: p, error: pErr } = await supabase
.from("posts")
.select("id,user_id,body,kind,created_at,media_url,media_type")
.eq("id", pid)
.maybeSingle();

if (pErr) {
setBanner(pErr.message);
return;
}
if (!p) {
setBanner("Post not found.");
return;
}

const postRow = p as PostRow;
setPost(postRow);

// author profile
if (postRow.user_id) {
const { data: prof } = await supabase
.from("profiles")
.select("id,username,display_name,avatar_url")
.eq("id", postRow.user_id)
.maybeSingle();

if (prof) setAuthor(prof as ProfileRow);
}

// likes (count + did I like)
const { data: likeRows, error: likeErr } = await supabase
.from("post_likes")
.select("user_id")
.eq("post_id", pid);

if (likeErr) {
setBanner(`Spanks disabled: ${likeErr.message}`);
return;
}

const users = (likeRows ?? []).map((r: any) => String(r.user_id));
setLikeCount(users.length);
setLiked(!!uid && users.includes(uid));

// comments (count + list)
const { data: cRows, error: cErr } = await supabase
.from("post_comments")
.select("id,post_id,user_id,body,created_at")
.eq("post_id", pid)
.order("created_at", { ascending: true })
.limit(50);

if (cErr) {
setCommentCount(0);
setComments([]);
return;
}

const list = (cRows ?? []) as CommentRow[];
setComments(list);
setCommentCount(list.length);
}

useEffect(() => {
if (!Number.isFinite(postId) || postId <= 0) {
setBanner("Bad post id.");
return;
}
void loadPostAndStuff(postId);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [postId]);
useEffect(() => {
const raw = searchParams?.get("flash");
if (!raw) return;

const ms = raw === "1" ? 1600 : Math.max(200, Number(raw) || 1600);

setFlashOn(true);

if (flashTimerRef.id) window.clearTimeout(flashTimerRef.id);
flashTimerRef.id = window.setTimeout(() => {
setFlashOn(false);
}, ms);

return () => {
if (flashTimerRef.id) window.clearTimeout(flashTimerRef.id);
flashTimerRef.id = null;
};
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [searchParams?.toString()]);
async function toggleSpank() {
if (!post) return;
const uid = myUserId ?? (await refreshAuth());
if (!uid) return;

if (busy) return;
setBusy(true);

if (liked) {
const { error } = await supabase
.from("post_likes")
.delete()
.eq("post_id", post.id)
.eq("user_id", uid);

if (error) setBanner(error.message);

setLiked(false);
setLikeCount((n) => Math.max(0, n - 1));
setBusy(false);
return;
}

const { error: insErr } = await supabase.from("post_likes").insert({
post_id: post.id,
user_id: uid,
});

if (!insErr) {
setLiked(true);
setLikeCount((n) => n + 1);
setBusy(false);
return;
}

// treat unique conflict as "already liked"
const isConflict =
(insErr as any)?.status === 409 ||
(insErr as any)?.code === "23505" ||
String((insErr as any)?.message || "").toLowerCase().includes("duplicate") ||
String((insErr as any)?.message || "").toLowerCase().includes("unique");

if (isConflict) {
setLiked(true);
setBusy(false);
return;
}

setBanner(insErr.message);
setBusy(false);
}

async function addComment() {
if (!post) return;
const uid = myUserId ?? (await refreshAuth());
if (!uid) return;

const body = draft.trim();
if (!body) return;

if (busy) return;
setBusy(true);

const { data, error } = await supabase
.from("post_comments")
.insert({ post_id: post.id, user_id: uid, body })
.select("id,post_id,user_id,body,created_at")
.single();

if (error) {
setBanner(error.message);
setBusy(false);
return;
}

setComments((arr) => [...arr, data as CommentRow]);
setCommentCount((n) => n + 1);
setDraft("");
setBusy(false);
}

const pillBtn: React.CSSProperties = {
padding: "8px 14px",
borderRadius: 999,
border: "1px solid rgba(180,120,255,0.25)",
background: "rgba(0,0,0,0.35)",
color: "white",
cursor: "pointer",
fontWeight: 650,
};

const postBtn: React.CSSProperties = {
padding: "8px 16px",
borderRadius: 999,
border: "none",
cursor: "pointer",
color: "white",
fontWeight: 700,
background: "linear-gradient(90deg,#7c3aed,#c026d3)",
boxShadow: "0 0 14px rgba(168,85,247,0.6)",
};

const inputStyle: React.CSSProperties = {
background: "rgba(0,0,0,0.6)",
color: "white",
border: "1px solid rgba(180,120,255,0.22)",
borderRadius: 12,
padding: "10px 12px",
outline: "none",
};

const renderMedia = (p: PostRow) => {
if (!p.media_url) return null;

const isVideo =
(p.media_type && p.media_type.startsWith("video/")) || p.kind === "video";
const isImage =
(p.media_type && p.media_type.startsWith("image/")) || p.kind === "image";

if (isVideo) {
return (
<video
src={p.media_url}
controls
style={{
width: "100%",
borderRadius: 14,
border: "1px solid rgba(180,120,255,0.14)",
marginBottom: 10,
maxHeight: 520,
background: "rgba(0,0,0,0.5)",
}}
/>
);
}

if (isImage) {
// eslint-disable-next-line @next/next/no-img-element
return (
<img
src={p.media_url}
alt=""
style={{
width: "100%",
borderRadius: 14,
border: "1px solid rgba(180,120,255,0.14)",
marginBottom: 10,
objectFit: "cover",
maxHeight: 520,
}}
/>
);
}

return null;
};

const authorName =
author?.display_name || author?.username || (post ? "Unknown" : "");
const authorHandle = author?.username ? `@${author.username}` : "";

return (
<div style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
    <style>{`
@keyframes focusGlow {
0% { box-shadow: 0 0 0 rgba(192,38,211,0.0); }
35% { box-shadow: 0 0 34px rgba(192,38,211,0.45); }
100% { box-shadow: 0 0 0 rgba(192,38,211,0.0); }
}
`}</style>
{banner ? (
<div
style={{
marginTop: 12,
marginBottom: 12,
padding: 10,
borderRadius: 14,
background: "rgba(120,0,0,0.35)",
border: "1px solid rgba(255,80,80,0.35)",
color: "rgba(255,220,220,0.95)",
fontSize: 13,
}}
>
{banner}
</div>
) : null}

<button onClick={() => router.back()} style={pillBtn}>
← Back
</button>

<div style={{ height: 12 }} />

{post ? (
<div
style={{
background: "rgba(0,0,0,0.55)",
border: flashOn ? "1px solid rgba(192,38,211,0.65)" : "1px solid rgba(255,255,255,0.08)",
boxShadow: flashOn ? "0 0 34px rgba(192,38,211,0.35)" : undefined,
animation: flashOn ? "focusGlow 1.25s ease" : undefined,
borderRadius: 16,
padding: 14,
}}
>
{/* header */}
<div
style={{
display: "flex",
justifyContent: "space-between",
marginBottom: 8,
}}
>
<div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
<div style={{ fontWeight: 850, opacity: 0.95 }}>{authorName}</div>
<div style={{ opacity: 0.65, fontSize: 12 }}>
{timeAgo(post.created_at)}
</div>
</div>

<div style={{ opacity: 0.55, fontSize: 12 }}>{authorHandle}</div>
</div>

{/* media */}
{renderMedia(post)}

{/* text */}
{post.body ? (
<div style={{ fontSize: 16, lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
{post.body}
</div>
) : null}

{/* actions */}
<div
style={{
display: "flex",
gap: 14,
marginTop: 12,
alignItems: "center",
}}
>
<div
onClick={() => !busy && toggleSpank()}
style={{
display: "flex",
alignItems: "center",
gap: 8,
cursor: busy ? "default" : "pointer",
userSelect: "none",
opacity: busy ? 0.6 : 1,
padding: "6px 8px",
borderRadius: 12,
}}
title="Spank"
>
<UnboundSpankIcon on={liked} />
<span
style={{
fontWeight: 650,
color: liked ? "#e879f9" : "rgba(255,255,255,0.85)",
}}
>
Spank{likeCount ? ` · ${likeCount}` : ""}
</span>
</div>

<button onClick={() => setOpenComments((v) => !v)} style={pillBtn}>
Comments {commentCount ? `· ${commentCount}` : ""}
</button>
</div>

{/* comments */}
{openComments ? (
<div style={{ marginTop: 12 }}>
<div style={{ display: "flex", gap: 10 }}>
<input
value={draft}
onChange={(e) => setDraft(e.target.value)}
placeholder="Write a comment…"
style={{ ...inputStyle, flex: 1 }}
/>
<button onClick={addComment} disabled={busy} style={postBtn}>
{busy ? "…" : "Send"}
</button>
</div>

<div
style={{
marginTop: 10,
display: "flex",
flexDirection: "column",
gap: 10,
}}
>
{comments.map((c) => (
<div
key={c.id}
style={{
background: "rgba(0,0,0,0.35)",
border: "1px solid #222",
borderRadius: 14,
padding: 10,
}}
>
<div style={{ opacity: 0.6, fontSize: 12, marginBottom: 6 }}>
{timeAgo(c.created_at)}
</div>
<div style={{ whiteSpace: "pre-wrap" }}>{c.body}</div>
</div>
))}

{comments.length === 0 ? (
<div style={{ opacity: 0.6, fontSize: 13, marginTop: 6 }}>
No comments yet.
</div>
) : null}
</div>
</div>
) : null}
</div>
) : (
<div style={{ opacity: 0.8 }}>Loading…</div>
)}
</div>
);
}