"use client";

import { useEffect, useMemo, useRef, useState } from "react";
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
parent_comment_id: number | null;
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

export default function PostPage() {
const supabase = useMemo(() => getSupabase(), []);
const params = useParams();
const router = useRouter();
const searchParams = useSearchParams();

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
const [commentAuthors, setCommentAuthors] = useState<Record<string, ProfileRow>>({});
const [draft, setDraft] = useState("");
const [busy, setBusy] = useState(false);
const [spark, setSpark] = useState(false);

const [replyTo, setReplyTo] = useState<{
id: number;
userId: string;
label: string;
} | null>(null);

const [flashOn, setFlashOn] = useState(false);
const flashTimerRef = useRef<number | null>(null);

async function refreshAuth() {
const { data } = await supabase.auth.getSession();
const uid = data.session?.user?.id ?? null;
setMyUserId(uid);
return uid;
}

async function hydrateCommentAuthors(list: CommentRow[]) {
const ids = Array.from(new Set(list.map((c) => c.user_id).filter(Boolean)));
const missing = ids.filter((id) => !commentAuthors[id]);

if (missing.length === 0) return;

const { data, error } = await supabase
.from("profiles")
.select("id,username,display_name,avatar_url")
.in("id", missing);

if (error || !data) return;

const patch: Record<string, ProfileRow> = {};
for (const p of data as ProfileRow[]) {
patch[p.id] = p;
}

setCommentAuthors((prev) => ({ ...prev, ...patch }));
}

async function loadPostAndStuff(pid: number) {
setBanner(null);

const uid = await refreshAuth();

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

if (postRow.user_id) {
const { data: prof } = await supabase
.from("profiles")
.select("id,username,display_name,avatar_url")
.eq("id", postRow.user_id)
.maybeSingle();

if (prof) setAuthor(prof as ProfileRow);
}

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

const { data: cRows, error: cErr } = await supabase
.from("post_comments")
.select("id,post_id,user_id,body,created_at,parent_comment_id")
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
await hydrateCommentAuthors(list);
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

if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
flashTimerRef.current = window.setTimeout(() => {
setFlashOn(false);
}, ms);

return () => {
if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
flashTimerRef.current = null;
};
}, [searchParams?.toString()]);

function triggerSpark() {
setSpark(true);
window.setTimeout(() => {
setSpark(false);
}, 260);
}

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
triggerSpark();
setBusy(false);
return;
}

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
.insert({
post_id: post.id,
user_id: uid,
body,
parent_comment_id: replyTo?.id ?? null,
})
.select("id,post_id,user_id,body,created_at,parent_comment_id")
.single();

if (error) {
setBanner(error.message);
setBusy(false);
return;
}

const newComment = data as CommentRow;

setComments((arr) => [...arr, newComment]);
setCommentCount((n) => n + 1);
setDraft("");
setReplyTo(null);
setBusy(false);

await hydrateCommentAuthors([newComment]);
}

function startReply(c: CommentRow) {
const p = commentAuthors[c.user_id];
const label = p?.display_name || (p?.username ? `@${p.username}` : "this comment");
setReplyTo({
id: c.id,
userId: c.user_id,
label,
});
setOpenComments(true);
}

function cancelReply() {
setReplyTo(null);
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
return (
// eslint-disable-next-line @next/next/no-img-element
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
@keyframes unboundPop {
0% { transform: scale(1); }
45% { transform: scale(1.22); }
100% { transform: scale(1); }
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
border: flashOn
? "1px solid rgba(192,38,211,0.65)"
: "1px solid rgba(255,255,255,0.08)",
boxShadow: flashOn ? "0 0 34px rgba(192,38,211,0.35)" : undefined,
animation: flashOn ? "focusGlow 1.25s ease" : undefined,
borderRadius: 16,
padding: 14,
}}
>
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

{renderMedia(post)}

{post.body ? (
<div style={{ fontSize: 16, lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
{post.body}
</div>
) : null}

<div
style={{
display: "flex",
gap: 14,
marginTop: 12,
alignItems: "center",
}}
>
<button
onClick={() => !busy && toggleSpank()}
disabled={busy}
style={{
...pillBtn,
display: "flex",
alignItems: "center",
gap: 8,
opacity: busy ? 0.6 : 1,
animation: spark ? "unboundPop .22s ease" : undefined,
color: liked ? "#e879f9" : "white",
border: liked
? "1px solid rgba(192,38,211,0.55)"
: "1px solid rgba(180,120,255,0.25)",
background: liked
? "rgba(192,38,211,0.16)"
: "rgba(0,0,0,0.35)",
}}
title="Spank"
>
<span
style={{
fontSize: 18,
lineHeight: 1,
display: "inline-flex",
}}
>
{liked ? "♥" : "♡"}
</span>

<span>
{liked ? "Spanked" : "Spank"}
{likeCount ? ` · ${likeCount}` : ""}
</span>
</button>

<button onClick={() => setOpenComments((v) => !v)} style={pillBtn}>
Comments {commentCount ? `· ${commentCount}` : ""}
</button>
</div>

{openComments ? (
<div style={{ marginTop: 12 }}>
{replyTo ? (
<div
style={{
marginBottom: 10,
display: "flex",
alignItems: "center",
justifyContent: "space-between",
gap: 10,
padding: "10px 12px",
borderRadius: 12,
border: "1px solid rgba(180,120,255,0.22)",
background: "rgba(168,85,247,0.10)",
}}
>
<div style={{ fontSize: 13, opacity: 0.9 }}>
Replying to <strong>{replyTo.label}</strong>
</div>
<button onClick={cancelReply} style={pillBtn}>
Cancel
</button>
</div>
) : null}

<div style={{ display: "flex", gap: 10 }}>
<input
value={draft}
onChange={(e) => setDraft(e.target.value)}
placeholder={replyTo ? `Reply to ${replyTo.label}…` : "Write a comment…"}
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
{comments.map((c) => {
const cAuthor = commentAuthors[c.user_id] ?? null;
const cName =
cAuthor?.display_name || cAuthor?.username || "Unknown";
const cHandle = cAuthor?.username ? `@${cAuthor.username}` : "";

const parent = c.parent_comment_id
? comments.find((x) => x.id === c.parent_comment_id) ?? null
: null;

const parentAuthor = parent ? commentAuthors[parent.user_id] ?? null : null;
const replyLabel =
parentAuthor?.display_name ||
(parentAuthor?.username ? `@${parentAuthor.username}` : null) ||
null;

return (
<div
key={c.id}
style={{
background: "rgba(0,0,0,0.35)",
border: "1px solid #222",
borderRadius: 14,
padding: 10,
}}
>
<div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
{cAuthor?.avatar_url ? (
// eslint-disable-next-line @next/next/no-img-element
<img
src={cAuthor.avatar_url}
alt=""
style={{
width: 38,
height: 38,
borderRadius: 999,
objectFit: "cover",
border: "1px solid rgba(255,255,255,0.16)",
flex: "0 0 auto",
}}
/>
) : (
<div
style={{
width: 38,
height: 38,
borderRadius: 999,
display: "grid",
placeItems: "center",
border: "1px solid rgba(255,255,255,0.16)",
background: "rgba(255,255,255,0.04)",
opacity: 0.7,
flex: "0 0 auto",
fontWeight: 800,
}}
>
{cName.charAt(0).toUpperCase()}
</div>
)}

<div style={{ flex: 1, minWidth: 0 }}>
<div
style={{
display: "flex",
justifyContent: "space-between",
gap: 10,
marginBottom: 6,
alignItems: "baseline",
flexWrap: "wrap",
}}
>
<div style={{ display: "flex", gap: 8, alignItems: "baseline", flexWrap: "wrap" }}>
<div style={{ fontWeight: 800 }}>{cName}</div>
{cHandle ? (
<div style={{ opacity: 0.6, fontSize: 12 }}>{cHandle}</div>
) : null}
</div>

<div style={{ opacity: 0.6, fontSize: 12 }}>
{timeAgo(c.created_at)}
</div>
</div>

{replyLabel ? (
<div style={{ opacity: 0.7, fontSize: 12, marginBottom: 6 }}>
Replying to {replyLabel}
</div>
) : null}

<div style={{ whiteSpace: "pre-wrap" }}>{c.body}</div>

<div style={{ marginTop: 8 }}>
<button onClick={() => startReply(c)} style={pillBtn}>
Reply
</button>
</div>
</div>
</div>
</div>
);
})}

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