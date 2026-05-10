"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";
import ReactionBar from "@/app/components/ReactionBar";
import ReportPostButton from "@/app/components/ReportPostButton";

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
throw new Error(
"Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
);
}

return createClient(url, key);
}

type GroupRow = {
id: number;
creator_id: string;
name: string;
slug: string;
description: string | null;
avatar_url: string | null;
banner_url: string | null;
visibility: "public" | "private";
created_at: string;
};

type MemberRow = {
id: number;
group_id: number;
user_id: string;
role: "owner" | "admin" | "member";
created_at: string;
};

type PostRow = {
id: number;
user_id: string;
body: string | null;
kind: string | null;
created_at: string;
media_url: string | null;
media_type: string | null;
group_id: number | null;
};

type ProfileRow = {
id: string;
username: string | null;
display_name: string | null;
avatar_url: string | null;
};

type MemberProfile = {
user_id: string;
role: "owner" | "admin" | "member";
created_at: string;
profile: ProfileRow | null;
};

type CommentRow = {
id: number;
post_id: number;
user_id: string;
body: string;
created_at: string;
};

type ReactionKey = "devil" | "fire" | "eyes" | "purple_heart";
type ReactionCountsMap = Partial<Record<ReactionKey, number>>;

function timeAgo(ts: string) {
const then = new Date(ts).getTime();
const now = Date.now();
const s = Math.max(0, Math.floor((now - then) / 1000));
if (s < 60) return `${s}s`;
if (s < 3600) return `${Math.floor(s / 60)}m`;
if (s < 86400) return `${Math.floor(s / 3600)}h`;
return `${Math.floor(s / 86400)}d`;
}

export default function GroupPage({
params,
}: {
params: Promise<{ slug: string }>;
}) {
const supabase = useMemo(() => getSupabase(), []);

const [slug, setSlug] = useState("");
const [group, setGroup] = useState<GroupRow | null>(null);
const [memberCount, setMemberCount] = useState(0);
const [myUserId, setMyUserId] = useState<string | null>(null);
const [myMembership, setMyMembership] = useState<MemberRow | null>(null);
const [loading, setLoading] = useState(true);
const [busy, setBusy] = useState(false);
const [status, setStatus] = useState("");

const [postBody, setPostBody] = useState("");
const [posting, setPosting] = useState(false);
const [posts, setPosts] = useState<PostRow[]>([]);
const [profilesById, setProfilesById] = useState<Record<string, ProfileRow>>(
{}
);
const [members, setMembers] = useState<MemberProfile[]>([]);

const [likeCounts, setLikeCounts] = useState<Record<number, number>>({});
const [reactionCountsByPost, setReactionCountsByPost] = useState<
Record<number, ReactionCountsMap>
>({});
const [commentCounts, setCommentCounts] = useState<Record<number, number>>({});
const [likedByMe, setLikedByMe] = useState<Record<number, boolean>>({});
const [myReactionByPost, setMyReactionByPost] = useState<
Record<number, ReactionKey | undefined>
>({});
const [openReactionPicker, setOpenReactionPicker] = useState<
Record<number, boolean>
>({});
const [likeBusy, setLikeBusy] = useState<Record<number, boolean>>({});
const [spark, setSpark] = useState<Record<number, boolean>>({});

const [openComments, setOpenComments] = useState<Record<number, boolean>>({});
const [commentsByPost, setCommentsByPost] = useState<Record<number, CommentRow[]>>(
{}
);
const [commentDraft, setCommentDraft] = useState<Record<number, string>>({});
const [commentBusy, setCommentBusy] = useState<Record<number, boolean>>({});
const [loadingComments, setLoadingComments] = useState<Record<number, boolean>>(
{}
);

useEffect(() => {
let alive = true;

(async () => {
const resolved = await params;
if (!alive) return;
setSlug(resolved.slug);
})();

return () => {
alive = false;
};
}, [params]);

async function loadPostMeta(postIds: number[], uid: string | null) {
if (postIds.length === 0) {
setLikeCounts({});
setReactionCountsByPost({});
setCommentCounts({});
setLikedByMe({});
setMyReactionByPost({});
return;
}

const [likesRes, commentsRes] = await Promise.all([
supabase
.from("post_likes")
.select("post_id,user_id,reaction")
.in("post_id", postIds),
supabase
.from("post_comments")
.select("post_id")
.in("post_id", postIds),
]);

if (likesRes.error) throw likesRes.error;
if (commentsRes.error) throw commentsRes.error;

const nextLikeCounts: Record<number, number> = {};
const nextReactionCounts: Record<number, ReactionCountsMap> = {};
const nextCommentCounts: Record<number, number> = {};
const nextLikedByMe: Record<number, boolean> = {};
const nextReactionByPost: Record<number, ReactionKey | undefined> = {};

for (const postId of postIds) {
nextLikeCounts[postId] = 0;
nextReactionCounts[postId] = {};
nextCommentCounts[postId] = 0;
nextLikedByMe[postId] = false;
nextReactionByPost[postId] = undefined;
}

for (const row of likesRes.data ?? []) {
const pid = row.post_id as number;
const reaction = ((row as any).reaction || "devil") as ReactionKey;

nextLikeCounts[pid] = (nextLikeCounts[pid] ?? 0) + 1;
nextReactionCounts[pid][reaction] =
(nextReactionCounts[pid][reaction] ?? 0) + 1;

if (uid && row.user_id === uid) {
nextLikedByMe[pid] = true;
nextReactionByPost[pid] = reaction;
}
}

for (const row of commentsRes.data ?? []) {
nextCommentCounts[row.post_id] = (nextCommentCounts[row.post_id] ?? 0) + 1;
}

setLikeCounts(nextLikeCounts);
setReactionCountsByPost(nextReactionCounts);
setCommentCounts(nextCommentCounts);
setLikedByMe(nextLikedByMe);
setMyReactionByPost(nextReactionByPost);
}

async function loadPosts(groupId: number, uid: string | null) {
const { data: postData, error: postErr } = await supabase
.from("posts")
.select("id,user_id,body,kind,created_at,media_url,media_type,group_id")
.eq("group_id", groupId)
.order("created_at", { ascending: false });

if (postErr) throw postErr;

const safePosts = (postData ?? []) as PostRow[];
setPosts(safePosts);

const userIds = Array.from(
new Set(safePosts.map((p) => p.user_id).filter(Boolean))
);

if (userIds.length > 0) {
const { data: profileData, error: profileErr } = await supabase
.from("profiles")
.select("id,username,display_name,avatar_url")
.in("id", userIds);

if (profileErr) throw profileErr;

const map: Record<string, ProfileRow> = {};
for (const p of (profileData ?? []) as ProfileRow[]) {
map[p.id] = p;
}

setProfilesById((prev) => ({ ...prev, ...map }));
}

await loadPostMeta(
safePosts.map((p) => p.id),
uid
);
}

async function loadMembers(groupId: number) {
const { data: memberRows, error: memberErr } = await supabase
.from("group_members")
.select("id,group_id,user_id,role,created_at")
.eq("group_id", groupId)
.order("created_at", { ascending: true });

if (memberErr) throw memberErr;

const safeMembers = (memberRows ?? []) as MemberRow[];
const ids = Array.from(new Set(safeMembers.map((m) => m.user_id)));
const profileMap: Record<string, ProfileRow> = {};

if (ids.length > 0) {
const { data: profileRows, error: profileErr } = await supabase
.from("profiles")
.select("id,username,display_name,avatar_url")
.in("id", ids);

if (profileErr) throw profileErr;

for (const p of (profileRows ?? []) as ProfileRow[]) {
profileMap[p.id] = p;
}
}

const sorted = [...safeMembers].sort((a, b) => {
const rank = (role: string) => {
if (role === "owner") return 0;
if (role === "admin") return 1;
return 2;
};

const r = rank(a.role) - rank(b.role);
if (r !== 0) return r;

const aName = (
profileMap[a.user_id]?.display_name ||
profileMap[a.user_id]?.username ||
""
).toLowerCase();

const bName = (
profileMap[b.user_id]?.display_name ||
profileMap[b.user_id]?.username ||
""
).toLowerCase();

return aName.localeCompare(bName);
});

setMembers(
sorted.map((m) => ({
user_id: m.user_id,
role: m.role,
created_at: m.created_at,
profile: profileMap[m.user_id] ?? null,
}))
);
}

async function loadComments(postId: number) {
try {
setLoadingComments((m) => ({ ...m, [postId]: true }));

const { data, error } = await supabase
.from("post_comments")
.select("id,post_id,user_id,body,created_at")
.eq("post_id", postId)
.order("created_at", { ascending: true });

if (error) throw error;

const safeRows = (data ?? []) as CommentRow[];
setCommentsByPost((m) => ({ ...m, [postId]: safeRows }));

const missingUserIds = Array.from(
new Set(
safeRows
.map((c) => c.user_id)
.filter((id) => id && !profilesById[id])
)
);

if (missingUserIds.length > 0) {
const { data: profileRows, error: profileErr } = await supabase
.from("profiles")
.select("id,username,display_name,avatar_url")
.in("id", missingUserIds);

if (profileErr) throw profileErr;

setProfilesById((prev) => {
const next = { ...prev };
for (const p of (profileRows ?? []) as ProfileRow[]) {
next[p.id] = p;
}
return next;
});
}
} catch (e: any) {
setStatus(e?.message || "Could not load comments.");
} finally {
setLoadingComments((m) => ({ ...m, [postId]: false }));
}
}

useEffect(() => {
if (!slug) return;

let alive = true;

async function loadPage() {
try {
setLoading(true);
setStatus("");

const { data: authData } = await supabase.auth.getUser();
const uid = authData?.user?.id ?? null;
if (!alive) return;
setMyUserId(uid);

const { data: groupData, error: groupErr } = await supabase
.from("groups")
.select("*")
.eq("slug", slug)
.maybeSingle();

if (groupErr) throw groupErr;
if (!groupData) {
if (!alive) return;
setGroup(null);
setLoading(false);
return;
}

if (!alive) return;
setGroup(groupData as GroupRow);

const { count } = await supabase
.from("group_members")
.select("*", { count: "exact", head: true })
.eq("group_id", groupData.id);

if (!alive) return;
setMemberCount(count ?? 0);

if (uid) {
const { data: membership } = await supabase
.from("group_members")
.select("*")
.eq("group_id", groupData.id)
.eq("user_id", uid)
.maybeSingle();

if (!alive) return;
setMyMembership((membership as MemberRow) ?? null);
} else {
setMyMembership(null);
}

await Promise.all([
loadPosts(groupData.id, uid),
loadMembers(groupData.id),
]);

setLoading(false);
} catch (e: any) {
if (!alive) return;
setStatus(e?.message || "Failed to load group.");
setLoading(false);
}
}

void loadPage();

return () => {
alive = false;
};
}, [slug, supabase]);

async function joinGroup() {
if (!group || !myUserId) {
setStatus("You must be logged in.");
return;
}

try {
setBusy(true);
setStatus("");

const { error } = await supabase.from("group_members").insert({
group_id: group.id,
user_id: myUserId,
role: "member",
});

if (error) throw error;

setMyMembership({
id: Date.now(),
group_id: group.id,
user_id: myUserId,
role: "member",
created_at: new Date().toISOString(),
});

setMemberCount((n) => n + 1);
await loadMembers(group.id);
} catch (e: any) {
setStatus(e?.message || "Could not join group.");
} finally {
setBusy(false);
}
}

async function leaveGroup() {
if (!group || !myUserId) return;

try {
setBusy(true);
setStatus("");

const { error } = await supabase
.from("group_members")
.delete()
.eq("group_id", group.id)
.eq("user_id", myUserId);

if (error) throw error;

setMyMembership(null);
setMemberCount((n) => Math.max(0, n - 1));
await loadMembers(group.id);
} catch (e: any) {
setStatus(e?.message || "Could not leave group.");
} finally {
setBusy(false);
}
}

async function createGroupPost() {
if (!group) return;
if (!myMembership) {
setStatus("Join the group before posting.");
return;
}

const trimmed = postBody.trim();
if (!trimmed) {
setStatus("Write something first.");
return;
}

try {
setPosting(true);
setStatus("");

const { data: authData, error: authErr } = await supabase.auth.getUser();
if (authErr) throw authErr;

const user = authData?.user;
if (!user) {
setStatus("You must be logged in.");
setPosting(false);
return;
}

const { error } = await supabase.from("posts").insert({
user_id: user.id,
body: trimmed,
kind: "text",
group_id: group.id,
});

if (error) throw error;

setPostBody("");
await loadPosts(group.id, user.id);
} catch (e: any) {
setStatus(e?.message || "Could not create post.");
} finally {
setPosting(false);
}
}

async function createGroupNotification(args: {
recipientId: string;
actorId: string;
type: string;
postId: number;
groupName: string;
message: string;
}) {
if (args.recipientId === args.actorId) return;

await supabase.from("notifications").insert({
user_id: args.recipientId,
actor_id: args.actorId,
type: args.type,
entity_id: args.postId,
title: args.message,
body: args.message,
href: `/groups/${slug}`,
});
}

function triggerSpark(postId: number) {
setSpark((m) => ({ ...m, [postId]: true }));

window.setTimeout(() => {
setSpark((m) => ({ ...m, [postId]: false }));
}, 260);
}

function toggleReactionPicker(postId: number) {
setOpenReactionPicker((m) => ({ ...m, [postId]: !m[postId] }));
}

async function setReaction(postId: number, reaction: ReactionKey = "devil") {
if (!myUserId) {
setStatus("You must be logged in.");
return;
}
if (likeBusy[postId]) return;

const post = posts.find((p) => p.id === postId);
if (!post) {
setStatus("Post not found.");
return;
}

setLikeBusy((m) => ({ ...m, [postId]: true }));
setStatus("");

const currentReaction = myReactionByPost[postId];
const already = !!likedByMe[postId];

try {
if (already && currentReaction === reaction) {
const { error } = await supabase
.from("post_likes")
.delete()
.eq("post_id", postId)
.eq("user_id", myUserId);

if (error) throw error;

setLikedByMe((m) => ({ ...m, [postId]: false }));
setMyReactionByPost((m) => ({ ...m, [postId]: undefined }));
setLikeCounts((m) => ({
...m,
[postId]: Math.max(0, (m[postId] ?? 0) - 1),
}));
setReactionCountsByPost((m) => {
const current = { ...(m[postId] ?? {}) };
if (currentReaction) {
current[currentReaction] = Math.max(
0,
(current[currentReaction] ?? 0) - 1
);
if ((current[currentReaction] ?? 0) === 0) {
delete current[currentReaction];
}
}
return { ...m, [postId]: current };
});
setOpenReactionPicker((m) => ({ ...m, [postId]: false }));
return;
}

if (already && currentReaction && currentReaction !== reaction) {
const { error } = await supabase
.from("post_likes")
.update({ reaction })
.eq("post_id", postId)
.eq("user_id", myUserId);

if (error) throw error;

setLikedByMe((m) => ({ ...m, [postId]: true }));
setMyReactionByPost((m) => ({ ...m, [postId]: reaction }));
setReactionCountsByPost((m) => {
const current = { ...(m[postId] ?? {}) };
current[currentReaction] = Math.max(
0,
(current[currentReaction] ?? 0) - 1
);
if ((current[currentReaction] ?? 0) === 0) {
delete current[currentReaction];
}
current[reaction] = (current[reaction] ?? 0) + 1;
return { ...m, [postId]: current };
});
triggerSpark(postId);
setOpenReactionPicker((m) => ({ ...m, [postId]: false }));
return;
}

const { error } = await supabase.from("post_likes").insert({
post_id: postId,
user_id: myUserId,
reaction,
});

if (error) {
const isConflict =
(error as any)?.status === 409 ||
(error as any)?.code === "23505" ||
String((error as any)?.message || "")
.toLowerCase()
.includes("duplicate") ||
String((error as any)?.message || "")
.toLowerCase()
.includes("unique");

if (isConflict) {
const { error: updateErr } = await supabase
.from("post_likes")
.update({ reaction })
.eq("post_id", postId)
.eq("user_id", myUserId);

if (updateErr) throw updateErr;

setLikedByMe((m) => ({ ...m, [postId]: true }));
setMyReactionByPost((m) => ({ ...m, [postId]: reaction }));
setReactionCountsByPost((m) => {
const current = { ...(m[postId] ?? {}) };
const prev = currentReaction;
if (prev) {
current[prev] = Math.max(0, (current[prev] ?? 0) - 1);
if ((current[prev] ?? 0) === 0) {
delete current[prev];
}
}
current[reaction] = (current[reaction] ?? 0) + 1;
return { ...m, [postId]: current };
});
triggerSpark(postId);
setOpenReactionPicker((m) => ({ ...m, [postId]: false }));
return;
}

throw error;
}

setLikedByMe((m) => ({ ...m, [postId]: true }));
setMyReactionByPost((m) => ({ ...m, [postId]: reaction }));
setLikeCounts((m) => ({ ...m, [postId]: (m[postId] ?? 0) + 1 }));
setReactionCountsByPost((m) => ({
...m,
[postId]: {
...(m[postId] ?? {}),
[reaction]: ((m[postId] ?? {})[reaction] ?? 0) + 1,
},
}));
triggerSpark(postId);
setOpenReactionPicker((m) => ({ ...m, [postId]: false }));

await createGroupNotification({
recipientId: post.user_id,
actorId: myUserId,
type: "group_spank",
postId,
groupName: group?.name || "this group",
message: `Someone spanked your post in ${group?.name || "this group"}`,
});
} catch (e: any) {
setStatus(e?.message || "Could not update spank.");
} finally {
setLikeBusy((m) => ({ ...m, [postId]: false }));
}
}

async function toggleLike(postId: number) {
const existing = myReactionByPost[postId];
await setReaction(postId, existing || "devil");
}

async function toggleComments(postId: number) {
const nextOpen = !openComments[postId];
setOpenComments((m) => ({ ...m, [postId]: nextOpen }));

if (nextOpen && !commentsByPost[postId]) {
await loadComments(postId);
}
}

async function addComment(postId: number) {
if (!myUserId) {
setStatus("You must be logged in.");
return;
}

const body = (commentDraft[postId] ?? "").trim();
if (!body) return;

try {
setCommentBusy((m) => ({ ...m, [postId]: true }));
setStatus("");

const post = posts.find((p) => p.id === postId);
if (!post) throw new Error("Post not found.");

const { error } = await supabase.from("post_comments").insert({
post_id: postId,
user_id: myUserId,
body,
});

if (error) throw error;

setCommentDraft((m) => ({ ...m, [postId]: "" }));
setCommentCounts((m) => ({
...m,
[postId]: (m[postId] ?? 0) + 1,
}));

await loadComments(postId);

await createGroupNotification({
recipientId: post.user_id,
actorId: myUserId,
type: "group_comment",
postId,
groupName: group?.name || "this group",
message: `Someone commented on your post in ${group?.name || "this group"}`,
});
} catch (e: any) {
setStatus(e?.message || "Could not add comment.");
} finally {
setCommentBusy((m) => ({ ...m, [postId]: false }));
}
}

const shell: React.CSSProperties = {
width: "min(940px, 94vw)",
margin: "24px auto",
borderRadius: 18,
overflow: "hidden",
background: "rgba(0,0,0,0.50)",
border: "1px solid rgba(180,120,255,0.18)",
boxShadow: "0 0 24px rgba(168,85,247,0.18)",
};

const banner: React.CSSProperties = {
height: 180,
background:
"linear-gradient(135deg, rgba(90,20,180,0.55), rgba(190,40,210,0.28), rgba(20,20,40,0.85))",
borderBottom: "1px solid rgba(180,120,255,0.16)",
};

const inner: React.CSSProperties = {
padding: 18,
};

const button: React.CSSProperties = {
padding: "10px 14px",
borderRadius: 12,
border: "1px solid rgba(170, 90, 255, 0.45)",
background: "rgba(120, 60, 220, 0.18)",
color: "rgba(235,220,255,0.95)",
fontWeight: 800,
cursor: "pointer",
boxShadow: "0 0 18px rgba(170, 90, 255, 0.18)",
};

const actionBtn: React.CSSProperties = {
padding: "8px 12px",
borderRadius: 999,
border: "1px solid rgba(170, 90, 255, 0.30)",
background: "rgba(120, 60, 220, 0.12)",
color: "rgba(235,220,255,0.95)",
fontWeight: 700,
cursor: "pointer",
};

const inputStyle: React.CSSProperties = {
width: "100%",
padding: "10px 12px",
borderRadius: 10,
border: "1px solid rgba(255,255,255,0.16)",
background: "rgba(0,0,0,0.30)",
color: "white",
outline: "none",
};

const card: React.CSSProperties = {
marginTop: 16,
padding: 16,
borderRadius: 16,
background: "rgba(255,255,255,0.03)",
border: "1px solid rgba(255,255,255,0.08)",
};

if (loading) {
return (
<div
style={{
width: "min(940px, 94vw)",
margin: "24px auto",
opacity: 0.85,
}}
>
Loading group...
</div>
);
}

if (!group) {
return (
<div
style={{
width: "min(940px, 94vw)",
margin: "24px auto",
opacity: 0.85,
}}
>
Group not found.
</div>
);
}

const isOwner = myMembership?.role === "owner";
const isMember = !!myMembership;

return (
<div style={shell}>
<style>{`
@keyframes unboundPop {
0% { transform: scale(1); }
45% { transform: scale(1.22); }
100% { transform: scale(1); }
}
`}</style>

<div style={banner} />

<div style={inner}>
<div
style={{
display: "flex",
gap: 16,
alignItems: "flex-start",
justifyContent: "space-between",
flexWrap: "wrap",
}}
>
<div>
<h1
style={{
margin: 0,
fontSize: 34,
fontWeight: 900,
}}
>
{group.name}
</h1>

<div style={{ opacity: 0.72, marginTop: 6 }}>
{group.visibility === "private" ? "Private group" : "Public group"} ·{" "}
{memberCount} member{memberCount === 1 ? "" : "s"}
</div>

{group.description ? (
<div style={{ marginTop: 14, maxWidth: 720, lineHeight: 1.5 }}>
{group.description}
</div>
) : null}
</div>

<div style={{ display: "flex", gap: 10 }}>
{!isMember ? (
<button onClick={joinGroup} disabled={busy} style={button}>
{busy ? "Joining..." : "Join group"}
</button>
) : !isOwner ? (
<button onClick={leaveGroup} disabled={busy} style={button}>
{busy ? "Leaving..." : "Leave group"}
</button>
) : (
<button
disabled
style={{ ...button, opacity: 0.75, cursor: "default" }}
>
Owner
</button>
)}
</div>
</div>

{status ? (
<div style={{ marginTop: 12, fontSize: 13, opacity: 0.9 }}>
{status}
</div>
) : null}

<div style={card}>
<div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>
Write to the group
</div>

{isMember ? (
<>
<textarea
value={postBody}
onChange={(e) => setPostBody(e.target.value)}
placeholder="Say something to the group..."
style={{
width: "100%",
minHeight: 110,
resize: "vertical",
padding: "12px 14px",
borderRadius: 12,
border: "1px solid rgba(255,255,255,0.16)",
background: "rgba(0,0,0,0.35)",
color: "white",
outline: "none",
}}
/>

<button
onClick={createGroupPost}
disabled={posting}
style={{ ...button, marginTop: 12 }}
>
{posting ? "Reaching climax..." : "Post to group"}
</button>
</>
) : (
<div style={{ opacity: 0.82 }}>
Join this group to post in it.
</div>
)}
</div>

<div style={{ ...card, marginTop: 18 }}>
<div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>
Members
</div>

{members.length === 0 ? (
<div style={{ opacity: 0.78 }}>No members yet.</div>
) : null}

{members.map((member) => {
const profile = member.profile;
const label =
profile?.display_name || profile?.username || "Unknown user";
const handle = profile?.username ? `@${profile.username}` : "";

return (
<Link
key={`${member.user_id}-${member.role}`}
href={`/u/${member.user_id}`}
style={{
display: "flex",
alignItems: "center",
gap: 12,
padding: 12,
borderRadius: 14,
border: "1px solid rgba(180,120,255,0.10)",
background: "rgba(0,0,0,0.18)",
marginTop: 10,
textDecoration: "none",
color: "white",
}}
>
{profile?.avatar_url ? (
// eslint-disable-next-line @next/next/no-img-element
<img
src={profile.avatar_url}
alt=""
style={{
width: 42,
height: 42,
borderRadius: 999,
objectFit: "cover",
border: "1px solid rgba(255,255,255,0.16)",
}}
/>
) : (
<div
style={{
width: 42,
height: 42,
borderRadius: 999,
display: "grid",
placeItems: "center",
border: "1px solid rgba(255,255,255,0.16)",
opacity: 0.7,
}}
>
?
</div>
)}

<div style={{ minWidth: 0, flex: 1 }}>
<div style={{ fontWeight: 800 }}>{label}</div>
<div style={{ opacity: 0.72, fontSize: 13 }}>
{handle} {handle ? "· " : ""}
{member.role}
</div>
</div>

<div style={{ opacity: 0.62, fontSize: 13 }}>View →</div>
</Link>
);
})}
</div>

<div style={{ ...card, marginTop: 18 }}>
<div style={{ fontSize: 18, fontWeight: 800, marginBottom: 10 }}>
Group feed
</div>

{posts.length === 0 ? (
<div style={{ opacity: 0.78 }}>No posts yet.</div>
) : null}

{posts.map((post) => {
const author = profilesById[post.user_id];
const authorName =
author?.display_name || author?.username || "Unknown user";
const handle = author?.username ? `@${author.username}` : "";

return (
<div
key={post.id}
style={{
padding: 14,
position: "relative",
borderRadius: 14,
border: "1px solid rgba(180,120,255,0.12)",
background: "rgba(0,0,0,0.22)",
marginTop: 12,
}}
>
    {myUserId !== post.user_id ? (
<ReportPostButton
postId={post.id}
reportedUserId={post.user_id}
myUserId={myUserId}
onReported={() => {}}
style={{
position: "absolute",
top: 14,
right: 14,
border: "1px solid rgba(255,120,120,0.35)",
background: "rgba(255,80,80,0.10)",
color: "rgba(255,220,220,0.95)",
borderRadius: 999,
padding: "6px 10px",
cursor: "pointer",
fontWeight: 800,
fontSize: 12,
}}
/>
) : null}
<div
style={{
display: "flex",
gap: 10,
alignItems: "center",
marginLeft: "auto",
}}
>
   
{author?.avatar_url ? (
// eslint-disable-next-line @next/next/no-img-element
<img
src={author.avatar_url}
alt=""
style={{
width: 38,
height: 38,
borderRadius: 999,
objectFit: "cover",
border: "1px solid rgba(255,255,255,0.16)",
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
opacity: 0.7,
}}
>
?
</div>
)}

<div>
<div style={{ fontWeight: 800 }}>{authorName}</div>
<div style={{ opacity: 0.72, fontSize: 13 }}>
{handle} {handle ? "· " : ""}
{timeAgo(post.created_at)}
</div>
</div>
</div>



{post.body ? (
<div style={{ marginTop: 12, lineHeight: 1.5 }}>
{post.body}
</div>
) : null}

<ReactionBar
postId={post.id}
spanks={likeCounts[post.id] ?? 0}
comments={commentCounts[post.id] ?? 0}
iSpanked={!!likedByMe[post.id]}
myReaction={myReactionByPost[post.id]}
isBusy={!!likeBusy[post.id]}
isPickerOpen={!!openReactionPicker[post.id]}
sparkOn={!!spark[post.id]}
pillBtn={actionBtn}
reactionCounts={reactionCountsByPost[post.id]}
onToggleSpank={toggleLike}
onTogglePicker={toggleReactionPicker}
onSetReaction={setReaction}
onOpenComments={toggleComments}
/>

{openComments[post.id] ? (
<div style={{ marginTop: 12 }}>
{loadingComments[post.id] ? (
<div style={{ opacity: 0.72, fontSize: 13 }}>
Loading comments...
</div>
) : null}

{(commentsByPost[post.id] ?? []).map((comment) => {
const commenter = profilesById[comment.user_id];
const commenterName =
commenter?.display_name ||
commenter?.username ||
"Unknown user";
const commenterHandle = commenter?.username
? `@${commenter.username}`
: "";

return (
<div
key={comment.id}
style={{
marginTop: 10,
padding: 10,
borderRadius: 12,
background: "rgba(255,255,255,0.03)",
border: "1px solid rgba(255,255,255,0.08)",
}}
>
<div style={{ fontWeight: 800, fontSize: 14 }}>
{commenterName}
</div>
<div style={{ opacity: 0.7, fontSize: 12, marginTop: 2 }}>
{commenterHandle} {commenterHandle ? "· " : ""}
{timeAgo(comment.created_at)}
</div>
<div style={{ marginTop: 8, lineHeight: 1.45 }}>
{comment.body}
</div>
</div>
);
})}

<div style={{ marginTop: 12 }}>
<input
value={commentDraft[post.id] ?? ""}
onChange={(e) =>
setCommentDraft((m) => ({
...m,
[post.id]: e.target.value,
}))
}
placeholder="Write a comment..."
style={inputStyle}
/>
<button
onClick={() => addComment(post.id)}
disabled={!!commentBusy[post.id]}
style={{ ...actionBtn, marginTop: 8 }}
>
{commentBusy[post.id] ? "Reaching climax..." : "Comment"}
</button>
</div>
</div>
) : null}
</div>
);
})}
</div>
</div>
</div>
);
}