"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";

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

export default function ProfileFeedClient({ userId }: { userId: string }) {
const supabase = useMemo(() => getSupabase(), []);

const [myUserId, setMyUserId] = useState<string | null>(null);
const [posts, setPosts] = useState<PostRow[]>([]);
const [text, setText] = useState("");
const [posting, setPosting] = useState(false);

const [profilesById, setProfilesById] = useState<Record<string, ProfileRow>>(
{}
);

const [likeCounts, setLikeCounts] = useState<Record<number, number>>({});
const [commentCounts, setCommentCounts] = useState<Record<number, number>>({});
const [likedByMe, setLikedByMe] = useState<Record<number, boolean>>({});

const [openComments, setOpenComments] = useState<Record<number, boolean>>({});
const [commentsByPost, setCommentsByPost] = useState<
Record<number, CommentRow[]>
>({});
const [commentDraft, setCommentDraft] = useState<Record<number, string>>({});
const [busyPostId, setBusyPostId] = useState<number | null>(null);

const [banner, setBanner] = useState<string | null>(null);
const [spark, setSpark] = useState<Record<number, boolean>>({});

async function refreshAuth() {
const { data } = await supabase.auth.getSession();
const uid = data.session?.user?.id ?? null;
setMyUserId(uid);
return uid;
}

async function loadCounts(postIds: number[]) {
setBanner(null);

const { data: likeRows, error: likeErr } = await supabase
.from("post_likes")
.select("post_id,user_id")
.in("post_id", postIds);

if (likeErr) {
setBanner(`Spanks disabled: ${likeErr.message}`);
return;
}

const lc: Record<number, number> = {};
const lbm: Record<number, boolean> = {};

for (const r of likeRows ?? []) {
const pid = (r as any).post_id as number;
const uid = (r as any).user_id as string;
lc[pid] = (lc[pid] ?? 0) + 1;
if (myUserId && uid === myUserId) lbm[pid] = true;
}

const { data: commentRows, error: cErr } = await supabase
.from("post_comments")
.select("post_id")
.in("post_id", postIds);

if (cErr) {
setLikeCounts(lc);
setLikedByMe(lbm);
setCommentCounts({});
return;
}

const cc: Record<number, number> = {};
for (const r of commentRows ?? []) {
const pid = (r as any).post_id as number;
cc[pid] = (cc[pid] ?? 0) + 1;
}

setLikeCounts(lc);
setLikedByMe(lbm);
setCommentCounts(cc);
}

async function loadPosts() {
// ✅ PROFILE MODE: only this user's posts
const { data, error } = await supabase
.from("posts")
.select("id,user_id,body,kind,created_at")
.eq("user_id", userId)
.order("created_at", { ascending: false })
.limit(50);

if (error) {
setBanner(error.message);
return;
}

const rows = (data ?? []) as PostRow[];
setPosts(rows);

// (on profile, this will usually just be one user, but keep it consistent)
const uids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
if (uids.length) {
const { data: profs } = await supabase
.from("profiles")
.select("id,username,display_name,avatar_url")
.in("id", uids);

const map: Record<string, ProfileRow> = {};
for (const p of (profs ?? []) as ProfileRow[]) map[p.id] = p;
setProfilesById(map);
}

if (rows.length) await loadCounts(rows.map((r) => r.id));
}

useEffect(() => {
(async () => {
await refreshAuth();
await loadPosts();
})();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [userId]);

async function submitPost() {
const trimmed = text.trim();
if (!trimmed) return;

setPosting(true);

const uid = myUserId ?? (await refreshAuth());
if (!uid) {
setBanner("Not signed in");
setPosting(false);
return;
}

const { error } = await supabase.from("posts").insert({
user_id: uid,
body: trimmed,
kind: "text",
});

setPosting(false);

if (error) {
setBanner(error.message);
return;
}

setText("");
await loadPosts();
}

function triggerSpark(postId: number) {
setSpark((m) => ({ ...m, [postId]: true }));
window.setTimeout(() => {
setSpark((m) => ({ ...m, [postId]: false }));
}, 260);
}

async function toggleSpank(postId: number) {
const uid = myUserId ?? (await refreshAuth());
if (!uid) return;

if (busyPostId) return;
setBusyPostId(postId);

const already = !!likedByMe[postId];

if (already) {
const { error } = await supabase
.from("post_likes")
.delete()
.eq("post_id", postId)
.eq("user_id", uid);

setLikedByMe((m) => ({ ...m, [postId]: false }));
setLikeCounts((m) => ({
...m,
[postId]: Math.max(0, (m[postId] ?? 0) - 1),
}));

if (error) setBanner(error.message);

setBusyPostId(null);
return;
}

const { error } = await supabase.from("post_likes").insert({
post_id: postId,
user_id: uid,
});

if (!error) {
setLikedByMe((m) => ({ ...m, [postId]: true }));
setLikeCounts((m) => ({ ...m, [postId]: (m[postId] ?? 0) + 1 }));
triggerSpark(postId);
} else {
const msg = String(error.message || "");
if (!msg.toLowerCase().includes("duplicate")) setBanner(msg);
}

setBusyPostId(null);
}

async function openCommentsFor(postId: number) {
setOpenComments((m) => ({ ...m, [postId]: !m[postId] }));

if (commentsByPost[postId]) return;

const { data, error } = await supabase
.from("post_comments")
.select("id,post_id,user_id,body,created_at")
.eq("post_id", postId)
.order("created_at", { ascending: true })
.limit(50);

if (error) {
setBanner(error.message);
return;
}

setCommentsByPost((m) => ({
...m,
[postId]: (data ?? []) as CommentRow[],
}));
}

async function addComment(postId: number) {
const uid = myUserId ?? (await refreshAuth());
if (!uid) return;

const body = (commentDraft[postId] ?? "").trim();
if (!body) return;

const { data, error } = await supabase
.from("post_comments")
.insert({ post_id: postId, user_id: uid, body })
.select("id,post_id,user_id,body,created_at")
.single();

if (error) {
setBanner(error.message);
return;
}

setCommentsByPost((m) => ({
...m,
[postId]: [...(m[postId] ?? []), data as CommentRow],
}));

setCommentDraft((m) => ({ ...m, [postId]: "" }));
setCommentCounts((m) => ({ ...m, [postId]: (m[postId] ?? 0) + 1 }));
}

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

const pillBtn: React.CSSProperties = {
padding: "8px 14px",
borderRadius: 999,
border: "1px solid rgba(180,120,255,0.25)",
background: "rgba(0,0,0,0.35)",
color: "white",
cursor: "pointer",
fontWeight: 650,
};

const cardStyle: React.CSSProperties = {
background: "rgba(0,0,0,0.55)",
border: "1px solid rgba(180,120,255,0.16)",
borderRadius: 16,
padding: 14,
};

const inputStyle: React.CSSProperties = {
background: "rgba(0,0,0,0.6)",
color: "white",
border: "1px solid rgba(180,120,255,0.22)",
borderRadius: 12,
padding: "10px 12px",
outline: "none",
};

const authorName = (uid: string) => {
const p = profilesById[uid];
return p?.display_name || p?.username || "Unknown";
};

const authorHandle = (uid: string) => {
const p = profilesById[uid];
return p?.username ? `@${p.username}` : "";
};

return (
<div style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
<style>{`
@keyframes unboundPop {
0% { transform: scale(1); }
45% { transform: scale(1.22); }
100% { transform: scale(1); }
}
@keyframes sparkBurst {
0% { transform: scale(0.3); opacity: 0; }
25% { opacity: 1; }
100% { transform: scale(1.35); opacity: 0; }
}
`}</style>

{banner ? (
<div
style={{
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

{/* Composer (only enabled if this is YOUR profile) */}
{myUserId === userId ? (
<div
style={{
background: "rgba(0,0,0,0.55)",
border: "1px solid rgba(180,120,255,0.25)",
borderRadius: 16,
padding: 14,
marginBottom: 18,
}}
>
<textarea
placeholder="Share a status update…"
value={text}
onChange={(e) => setText(e.target.value)}
rows={3}
style={{
...inputStyle,
width: "100%",
resize: "none",
}}
/>

<div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
<button onClick={submitPost} disabled={posting} style={postBtn}>
{posting ? "Posting…" : "Post"}
</button>
</div>
</div>
) : null}

{/* Feed */}
<div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
{posts.map((p) => {
const spanks = likeCounts[p.id] ?? 0;
const comments = commentCounts[p.id] ?? 0;
const iSpanked = !!likedByMe[p.id];
const isBusy = busyPostId === p.id;
const isOpen = !!openComments[p.id];

return (
<div key={p.id} style={cardStyle}>
<div
style={{
display: "flex",
justifyContent: "space-between",
marginBottom: 8,
}}
>
<div style={{ display: "flex", gap: 10, alignItems: "baseline" }}>
<div style={{ fontWeight: 850, opacity: 0.95 }}>
{authorName(p.user_id)}
</div>
<div style={{ opacity: 0.65, fontSize: 12 }}>
{timeAgo(p.created_at)}
</div>
</div>
<div style={{ opacity: 0.55, fontSize: 12 }}>
{authorHandle(p.user_id)}
</div>
</div>

<div style={{ fontSize: 16, lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
{p.body}
</div>

<div style={{ display: "flex", gap: 14, marginTop: 12, alignItems: "center" }}>
<div
onClick={() => !isBusy && toggleSpank(p.id)}
style={{
display: "flex",
alignItems: "center",
gap: 8,
cursor: isBusy ? "default" : "pointer",
userSelect: "none",
opacity: isBusy ? 0.6 : 1,
padding: "6px 8px",
borderRadius: 12,
}}
title="Spank"
>
<div
style={{
position: "relative",
width: 22,
height: 22,
animation: spark[p.id] ? "unboundPop .22s ease" : undefined,
}}
>
<UnboundSpankIcon on={iSpanked} />

{spark[p.id] ? (
<div
style={{
position: "absolute",
inset: -6,
borderRadius: 999,
border: "2px solid rgba(192,38,211,0.55)",
boxShadow: "0 0 14px rgba(192,38,211,0.45)",
animation: "sparkBurst .26s ease-out",
pointerEvents: "none",
}}
/>
) : null}
</div>

<span
style={{
fontWeight: 650,
color: iSpanked ? "#e879f9" : "rgba(255,255,255,0.85)",
}}
>
Spank{spanks ? ` · ${spanks}` : ""}
</span>
</div>

<button onClick={() => openCommentsFor(p.id)} style={pillBtn}>
Comments {comments ? `· ${comments}` : ""}
</button>
</div>

{isOpen ? (
<div style={{ marginTop: 12 }}>
<div style={{ display: "flex", gap: 10 }}>
<input
value={commentDraft[p.id] ?? ""}
onChange={(e) =>
setCommentDraft((m) => ({ ...m, [p.id]: e.target.value }))
}
placeholder="Write a comment…"
style={{ ...inputStyle, flex: 1 }}
/>

<button
onClick={() => addComment(p.id)}
disabled={isBusy}
style={postBtn}
>
{isBusy ? "…" : "Send"}
</button>
</div>

<div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
{(commentsByPost[p.id] ?? []).map((c) => (
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

{(commentsByPost[p.id] ?? []).length === 0 ? (
<div style={{ opacity: 0.6, fontSize: 13, marginTop: 6 }}>
No comments yet.
</div>
) : null}
</div>
</div>
) : null}
</div>
);
})}
</div>
</div>
);
}