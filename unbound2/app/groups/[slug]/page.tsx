"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import Link from "next/link";

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

async function loadPosts(groupId: number) {
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
if (userIds.length === 0) {
setProfilesById({});
return;
}

const { data: profileData, error: profileErr } = await supabase
.from("profiles")
.select("id,username,display_name,avatar_url")
.in("id", userIds);

if (profileErr) throw profileErr;

const map: Record<string, ProfileRow> = {};
for (const p of (profileData ?? []) as ProfileRow[]) {
map[p.id] = p;
}
setProfilesById(map);
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
let profileMap: Record<string, ProfileRow> = {};

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

await Promise.all([loadPosts(groupData.id), loadMembers(groupData.id)]);

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
await loadPosts(group.id);
} catch (e: any) {
setStatus(e?.message || "Could not create post.");
} finally {
setPosting(false);
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
{posting ? "Posting..." : "Post to group"}
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
borderRadius: 14,
border: "1px solid rgba(180,120,255,0.12)",
background: "rgba(0,0,0,0.22)",
marginTop: 12,
}}
>
<div style={{ display: "flex", alignItems: "center", gap: 10 }}>
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
</div>
);
})}
</div>
</div>
</div>
);
}