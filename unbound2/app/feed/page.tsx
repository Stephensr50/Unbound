"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import { useSearchParams } from "next/navigation";
import StoriesBar from "./StoriesBar";

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
group_id?: number | null;
};

type GroupRow = {
id: number;
name: string;
slug: string;
avatar_url?: string | null;
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

export default function FeedPage() {
useEffect(() => {
async function updateLastActive() {
const supabase = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const {
data: { user },
} = await supabase.auth.getUser();

if (!user) return;

await supabase
.from("profiles")
.update({ last_active_at: new Date().toISOString() })
.eq("id", user.id);
}

void updateLastActive();
}, []);

const supabase = useMemo(() => getSupabase(), []);
const router = useRouter();
const searchParams = useSearchParams();

const [myUserId, setMyUserId] = useState<string | null>(null);
const [posts, setPosts] = useState<PostRow[]>([]);
const [text, setText] = useState("");

const [file, setFile] = useState<File | null>(null);
const [uploading, setUploading] = useState(false);

const [posting, setPosting] = useState(false);
const [profilesById, setProfilesById] = useState<Record<string, ProfileRow>>(
{}
);
const [groupsById, setGroupsById] = useState<Record<number, GroupRow>>({});

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

const [viewer, setViewer] = useState<{
url: string;
type: "image" | "video";
} | null>(null);

const [focusPostId, setFocusPostId] = useState<number | null>(null);
const [flashPostId, setFlashPostId] = useState<number | null>(null);
const flashTimerRef = useRef<number | null>(null);
const didAutoScrollRef = useRef(false);

useEffect(() => {
const raw =
searchParams?.get("focusPost") || searchParams?.get("postId") || null;
const n = raw ? Number(raw) : NaN;

if (Number.isFinite(n) && n > 0) {
didAutoScrollRef.current = false;
setFocusPostId(n);
} else {
setFocusPostId(null);
}
}, [searchParams?.toString()]);

async function refreshAuth() {
const { data } = await supabase.auth.getSession();
const uid = data.session?.user?.id ?? null;
setMyUserId(uid);
return uid;
}

async function loadGroups(groupIds: number[]) {
if (!groupIds.length) {
setGroupsById({});
return;
}

const { data, error } = await supabase
.from("groups")
.select("id,name,slug,avatar_url")
.in("id", groupIds);

if (error) {
setBanner(error.message);
return;
}

const map: Record<number, GroupRow> = {};
for (const g of (data ?? []) as GroupRow[]) {
map[g.id] = g;
}
setGroupsById(map);
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

async function ensureFocusPostLoaded(focusId: number) {
if (posts.some((p) => p.id === focusId)) return;

const { data, error } = await supabase
.from("posts")
.select("id,user_id,body,kind,created_at,media_url,media_type,group_id")
.eq("id", focusId)
.maybeSingle();

if (error || !data) return;

const p = data as PostRow;

setPosts((prev) => {
if (prev.some((x) => x.id === p.id)) return prev;
return [p, ...prev];
});

if (p.user_id && !profilesById[p.user_id]) {
const { data: prof } = await supabase
.from("profiles")
.select("id,username,display_name,avatar_url")
.eq("id", p.user_id)
.maybeSingle();

if (prof) {
setProfilesById((m) => ({ ...m, [prof.id]: prof as ProfileRow }));
}
}

if (typeof p.group_id === "number" && !groupsById[p.group_id]) {
await loadGroups([p.group_id]);
}

await loadCounts([focusId]);
}

async function loadPosts() {
const { data, error } = await supabase
.from("posts")
.select("id,user_id,body,kind,created_at,media_url,media_type,group_id")
.order("created_at", { ascending: false })
.limit(200);

if (error) {
setBanner(error.message);
return;
}

const rows = (data ?? []) as PostRow[];

setPosts((prev) => {
const byId = new Map<number, PostRow>();

for (const p of prev ?? []) byId.set(p.id, p);
for (const p of rows) byId.set(p.id, p);

return Array.from(byId.values()).sort(
(a, b) =>
new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
);
});

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

const groupIds = Array.from(
new Set(
rows
.map((r) => r.group_id)
.filter((id): id is number => typeof id === "number")
)
);
await loadGroups(groupIds);

if (rows.length) {
await loadCounts(rows.map((r) => r.id));
}
}

useEffect(() => {
void (async () => {
await refreshAuth();
await loadPosts();
})();
}, []);

useEffect(() => {
void (async () => {
if (!focusPostId) return;

await ensureFocusPostLoaded(focusPostId);

window.setTimeout(() => {
if (didAutoScrollRef.current) return;

const el = document.getElementById(`post-${focusPostId}`);
if (el) {
didAutoScrollRef.current = true;
el.scrollIntoView({ behavior: "smooth", block: "center" });

setFlashPostId(focusPostId);
if (flashTimerRef.current) window.clearTimeout(flashTimerRef.current);
flashTimerRef.current = window.setTimeout(() => {
setFlashPostId(null);
}, 8000);
}
}, 60);
})();
}, [focusPostId, posts.length]);

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

const { error: insErr } = await supabase.from("post_likes").insert({
post_id: postId,
user_id: uid,
});

if (!insErr) {
setLikedByMe((m) => ({ ...m, [postId]: true }));
setLikeCounts((m) => ({ ...m, [postId]: (m[postId] ?? 0) + 1 }));
triggerSpark(postId);
setBusyPostId(null);
return;
}

const isConflict =
(insErr as any)?.status === 409 ||
(insErr as any)?.code === "23505" ||
String((insErr as any)?.message || "")
.toLowerCase()
.includes("duplicate") ||
String((insErr as any)?.message || "")
.toLowerCase()
.includes("unique");

if (isConflict) {
const { error: delErr } = await supabase
.from("post_likes")
.delete()
.eq("post_id", postId)
.eq("user_id", uid);

if (delErr) {
setBanner(delErr.message);
setBusyPostId(null);
return;
}

setLikedByMe((m) => ({ ...m, [postId]: false }));
setLikeCounts((m) => ({
...m,
[postId]: Math.max(0, (m[postId] ?? 0) - 1),
}));
setBusyPostId(null);
return;
}

setBanner(insErr.message);
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

const avatarStyle: React.CSSProperties = {
width: 46,
height: 46,
borderRadius: 999,
objectFit: "cover",
border: "1px solid rgba(180,120,255,0.24)",
flex: "0 0 auto",
background: "rgba(0,0,0,0.45)",
};

const groupPillStyle: React.CSSProperties = {
display: "inline-flex",
alignItems: "center",
gap: 8,
marginTop: 8,
marginBottom: 2,
padding: "6px 10px",
borderRadius: 999,
background: "rgba(168,85,247,0.18)",
border: "1px solid rgba(168,85,247,0.45)",
boxShadow: "0 0 12px rgba(168,85,247,0.35)",
color: "rgba(240,220,255,0.96)",
fontSize: 12,
fontWeight: 700,
width: "fit-content",
};

const groupLinkStyle: React.CSSProperties = {
color: "inherit",
textDecoration: "none",
};

const authorName = (uid: string) => {
const p = profilesById[uid];
return p?.display_name || p?.username || "Unknown";
};

const authorHandle = (uid: string) => {
const p = profilesById[uid];
return p?.username ? `@${p.username}` : "";
};

const authorAvatar = (uid: string) => {
const p = profilesById[uid];
return p?.avatar_url || "";
};

const authorInitial = (uid: string) => {
const p = profilesById[uid];
const label = p?.display_name || p?.username || "U";
return label.trim().charAt(0).toUpperCase();
};

async function uploadToStorage(uid: string, f: File) {
const isImage = f.type.startsWith("image/");
const isVideo = f.type.startsWith("video/");
if (!isImage && !isVideo) {
throw new Error("Please choose an image or video.");
}

const maxMb = isVideo ? 60 : 15;
if (f.size > maxMb * 1024 * 1024) {
throw new Error(`File too large. Max ${maxMb}MB for this upload.`);
}

const ext = (f.name.split(".").pop() || "").toLowerCase();
const safeExt = ext ? `.${ext}` : isImage ? ".jpg" : ".mp4";

const uuid =
typeof crypto !== "undefined" && "randomUUID" in crypto
? (crypto as any).randomUUID()
: `${Math.random().toString(16).slice(2)}${Date.now()}`;

const name = `${Date.now()}-${uuid}${safeExt}`;
const path = `posts/${uid}/${name}`;

const { error: upErr } = await supabase.storage.from("media").upload(path, f, {
contentType: f.type,
cacheControl: "3600",
upsert: false,
});

if (upErr) throw new Error(upErr.message);

const { data } = supabase.storage.from("media").getPublicUrl(path);
return { publicUrl: data.publicUrl, mediaType: f.type };
}

async function submitPost() {
const trimmed = text.trim();
if (!trimmed && !file) return;

setPosting(true);
setBanner(null);

try {
const uid = myUserId ?? (await refreshAuth());
if (!uid) throw new Error("Not signed in.");

let media_url: string | null = null;
let media_type: string | null = null;
let kind = "text";

if (file) {
setUploading(true);
const up = await uploadToStorage(uid, file);
media_url = up.publicUrl;
media_type = up.mediaType;
kind = media_type.startsWith("video/") ? "video" : "image";
setUploading(false);
}

const { error } = await supabase.from("posts").insert({
user_id: uid,
body: trimmed || null,
kind,
media_url,
media_type,
});

if (error) throw new Error(error.message);

setText("");
setFile(null);

await loadPosts();
} catch (e: any) {
setBanner(String(e?.message || e));
} finally {
setUploading(false);
setPosting(false);
}
}

async function deletePost(post: PostRow) {
try {
const uid = myUserId ?? (await refreshAuth());
if (!uid) return;

if (post.user_id !== uid) {
setBanner("You can only delete your own posts.");
return;
}

if (post.media_url) {
try {
const url = new URL(post.media_url);
const path = url.pathname.split("/media/")[1];
if (path) await supabase.storage.from("media").remove([path]);
} catch {
// ignore
}
}

const { error } = await supabase
.from("posts")
.delete()
.eq("id", post.id)
.eq("user_id", uid);

if (error) throw error;

setPosts((rows) => rows.filter((r) => r.id !== post.id));
} catch (e: any) {
setBanner(e.message || "Delete failed");
}
}

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
cursor: "pointer",
}}
onClick={() => setViewer({ url: p.media_url!, type: "image" })}
/>
);
}

return null;
};

return (
<div style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
<style>{`
@keyframes unboundPop {
0% { transform: scale(1); }
45% { transform: scale(1.22); }
100% { transform: scale(1); }
}
@keyframes focusGlow {
0% { box-shadow: 0 0 0 rgba(192,38,211,0.0); }
35% { box-shadow: 0 0 34px rgba(192,38,211,0.45); }
100% { box-shadow: 0 0 0 rgba(192,38,211,0.0); }
}
`}</style>

<StoriesBar />

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

<div
style={{
display: "flex",
gap: 10,
alignItems: "center",
marginTop: 10,
}}
>
<label
style={{
...pillBtn,
display: "inline-flex",
alignItems: "center",
gap: 8,
cursor: "pointer",
userSelect: "none",
}}
>
<input
type="file"
accept="image/*,video/*"
style={{ display: "none" }}
onChange={(e) => {
const f = e.target.files?.[0] || null;
setFile(f);
}}
/>
{file ? "Change media" : "Add photo/video"}
</label>

{file ? (
<div
style={{
opacity: 0.75,
fontSize: 12,
overflow: "hidden",
textOverflow: "ellipsis",
whiteSpace: "nowrap",
maxWidth: 260,
}}
>
{file.name}
</div>
) : (
<div style={{ opacity: 0.55, fontSize: 12 }}>Optional</div>
)}

<div style={{ flex: 1 }} />

<button
onClick={submitPost}
disabled={posting || uploading}
style={postBtn}
>
{uploading ? "Uploading…" : posting ? "Posting…" : "Post"}
</button>
</div>
</div>

<div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
{posts.map((p) => {
const spanks = likeCounts[p.id] ?? 0;
const comments = commentCounts[p.id] ?? 0;
const iSpanked = !!likedByMe[p.id];
const isBusy = busyPostId === p.id;
const isOpen = !!openComments[p.id];

const isMine = myUserId && p.user_id === myUserId;
const isFocused = flashPostId === p.id;
const groupInfo =
typeof p.group_id === "number" ? groupsById[p.group_id] : null;

return (
<div
key={p.id}
id={`post-${p.id}`}
style={{
...cardStyle,
border: isFocused
? "1px solid rgba(192,38,211,0.65)"
: cardStyle.border,
boxShadow: isFocused
? "0 0 34px rgba(192,38,211,0.35)"
: undefined,
animation: isFocused ? "focusGlow 1.25s ease" : undefined,
}}
>
<div
style={{
display: "flex",
gap: 12,
alignItems: "flex-start",
marginBottom: 10,
}}
>
{authorAvatar(p.user_id) ? (
// eslint-disable-next-line @next/next/no-img-element
<img
src={authorAvatar(p.user_id)}
alt=""
style={{ ...avatarStyle, cursor: "pointer" }}
onClick={() => router.push(`/u/${p.user_id}`)}
/>
) : (
<div
onClick={() => router.push(`/u/${p.user_id}`)}
style={{
...avatarStyle,
display: "grid",
placeItems: "center",
fontWeight: 800,
fontSize: 18,
color: "rgba(255,255,255,0.92)",
cursor: "pointer",
}}
>
{authorInitial(p.user_id)}
</div>
)}

<div style={{ flex: 1, minWidth: 0 }}>
<div
onClick={() => router.push(`/u/${p.user_id}`)}
style={{
display: "flex",
gap: 12,
alignItems: "flex-start",
marginBottom: 10,
cursor: "pointer",
borderRadius: 12,
padding: 6,
transition: "all 0.18s ease",
}}
onMouseEnter={(e) => {
const el = e.currentTarget;
el.style.background = "rgba(168,85,247,0.12)";
el.style.boxShadow = "0 0 60px rgba(192,38,211,0.85), 0 0 120px rgba(168,85,247,0.55)"
el.style.transform = "translateY(-2px) scale(1.01)";
el.style.backdropFilter = "blur(6px)";
}}
onMouseLeave={(e) => {
const el = e.currentTarget;
el.style.background = "transparent";
el.style.boxShadow = "none";
el.style.transform = "translateY(0) scale(1)";
el.style.backdropFilter = "none";
}}
>
<div style={{ minWidth: 0 }}>
<div style={{ fontWeight: 850, opacity: 0.95 }}>
{authorName(p.user_id)}
</div>
<div
style={{
opacity: 0.65,
fontSize: 12,
marginTop: 2,
display: "flex",
gap: 8,
flexWrap: "wrap",
}}
>
{authorHandle(p.user_id) ? (
<span>{authorHandle(p.user_id)}</span>
) : null}
<span>{timeAgo(p.created_at)}</span>
</div>

{groupInfo ? (
<div
onClick={() => router.push(`/groups/${groupInfo.slug}`)}
style={{ ...groupPillStyle, cursor: "pointer" }}
>
{groupInfo.avatar_url ? (
// eslint-disable-next-line @next/next/no-img-element
<img
src={groupInfo.avatar_url}
alt=""
style={{
width: 18,
height: 18,
borderRadius: 999,
objectFit: "cover",
border: "1px solid rgba(255,255,255,0.18)",
}}
/>
) : (
<div
style={{
width: 18,
height: 18,
borderRadius: 999,
display: "grid",
placeItems: "center",
fontSize: 10,
background: "rgba(255,255,255,0.10)",
border: "1px solid rgba(255,255,255,0.16)",
}}
>
G
</div>
)}

<span>Group · </span>
<span>{groupInfo.name}</span>
</div>
) : null}
</div>

<div style={{ display: "flex", gap: 10, alignItems: "center" }}>
{isMine ? (
<button
onClick={() => deletePost(p)}
style={{
border: "1px solid rgba(255,120,120,0.35)",
background: "rgba(255,80,80,0.10)",
color: "rgba(255,220,220,0.95)",
borderRadius: 999,
padding: "6px 10px",
cursor: "pointer",
fontWeight: 800,
fontSize: 12,
}}
title="Delete post"
>
Delete
</button>
) : null}
</div>
</div>

<div style={{ marginTop: 10 }}>
{renderMedia(p)}

{p.body ? (
<div
style={{
fontSize: 16,
lineHeight: 1.4,
whiteSpace: "pre-wrap",
}}
>
{p.body}
</div>
) : null}
</div>
</div>
</div>

<div
style={{
display: "flex",
gap: 14,
marginTop: 12,
alignItems: "center",
}}
>
<button
onClick={() => !isBusy && toggleSpank(p.id)}
disabled={isBusy}
style={{
...pillBtn,
display: "flex",
alignItems: "center",
gap: 8,
opacity: isBusy ? 0.6 : 1,
animation: spark[p.id] ? "unboundPop .22s ease" : undefined,
color: iSpanked ? "#e879f9" : "white",
border: iSpanked
? "1px solid rgba(192,38,211,0.55)"
: "1px solid rgba(180,120,255,0.25)",
background: iSpanked
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
{iSpanked ? "♥" : "♡"}
</span>

<span>
{iSpanked ? "Spanked" : "Spank"}
{spanks ? ` · ${spanks}` : ""}
</span>
</button>

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
setCommentDraft((m) => ({
...m,
[p.id]: e.target.value,
}))
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

<div
style={{
marginTop: 10,
display: "flex",
flexDirection: "column",
gap: 10,
}}
>
{(commentsByPost[p.id] ?? []).map((c) => (
<div
key={c.id}
id={`comment-${c.id}`}
style={{
background: "rgba(0,0,0,0.35)",
border: "1px solid #222",
borderRadius: 14,
padding: 10,
}}
>
<div
style={{
opacity: 0.6,
fontSize: 12,
marginBottom: 6,
}}
>
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

{viewer ? (
<div
onClick={() => setViewer(null)}
style={{
position: "fixed",
inset: 0,
background: "rgba(0,0,0,0.72)",
display: "flex",
alignItems: "center",
justifyContent: "center",
zIndex: 9999,
padding: 16,
}}
>
<div
onClick={(e) => e.stopPropagation()}
style={{
width: "min(920px, 96vw)",
background: "rgba(0,0,0,0.85)",
border: "1px solid rgba(180,120,255,0.22)",
borderRadius: 16,
padding: 12,
}}
>
{viewer.type === "image" ? (
// eslint-disable-next-line @next/next/no-img-element
<img
src={viewer.url}
alt=""
style={{ width: "100%", borderRadius: 12 }}
/>
) : (
<video
src={viewer.url}
controls
style={{ width: "100%", borderRadius: 12 }}
/>
)}

<div
style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}
>
<button onClick={() => setViewer(null)} style={pillBtn}>
Close
</button>
</div>
</div>
</div>
) : null}
</div>
);
}