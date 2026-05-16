"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import StoriesBar from "./StoriesBar";
import ReactionBar from "@/app/components/ReactionBar";
import ReportCommentButton from "@/app/components/ReportCommentButton";
import ReportPostButton from "@/app/components/ReportPostButton";
import FeaturedProfileCard from "@/app/components/FeaturedProfileCard";

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
return createClient(url, key);
}

type ReactionKey = "devil" | "fire" | "eyes" | "purple_heart";

type PostRow = {
id: number;
user_id: string;
body: string | null;
kind: string;
created_at: string;
media_url: string | null;
media_type: string | null;
group_id?: number | null;
is_locked: boolean | null;
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
last_active_at?: string | null;
moderation_status?: string | null;
};

type ReactionCountsMap = Partial<Record<ReactionKey, number>>;

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

function spaceLockedPosts(rows: PostRow[]) {
const unlocked = rows.filter((p) => !p.is_locked);
const locked = rows.filter((p) => p.is_locked);

const result: PostRow[] = [];
let lockedIndex = 0;

for (let i = 0; i < unlocked.length; i++) {
result.push(unlocked[i]);

const shouldInsertLocked = (i + 1) % 6 === 0;

if (shouldInsertLocked && lockedIndex < locked.length) {
result.push(locked[lockedIndex]);
lockedIndex++;
}
}

return result;
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
const [reportBusyPostId, setReportBusyPostId] = useState<number | null>(null);
const [allowedAuthorIds, setAllowedAuthorIds] = useState<string[]>([]);
const [posts, setPosts] = useState<PostRow[]>([]);
const [text, setText] = useState("");

const [file, setFile] = useState<File | null>(null);
const [wantsLocked, setWantsLocked] = useState(false);
const [uploading, setUploading] = useState(false);

const [posting, setPosting] = useState(false);
const [profilesById, setProfilesById] = useState<Record<string, ProfileRow>>(
{}
);
const [suggestedUsers, setSuggestedUsers] = useState<ProfileRow[]>([]);
const [followingIds, setFollowingIds] = useState<string[]>([]);
const [followBusyId, setFollowBusyId] = useState<string | null>(null);
const [groupsById, setGroupsById] = useState<Record<number, GroupRow>>({});

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

const [openComments, setOpenComments] = useState<Record<number, boolean>>({});
const [commentsByPost, setCommentsByPost] = useState<
Record<number, CommentRow[]>
>({});
const [commentDraft, setCommentDraft] = useState<Record<number, string>>({});
const [busyPostId, setBusyPostId] = useState<number | null>(null);

const [banner, setBanner] = useState<string | null>(null);

const [spark, setSpark] = useState<Record<number, boolean>>({});
const [unlockedPostIds, setUnlockedPostIds] = useState<Record<number, boolean>>({});

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

async function getAllowedAuthorIds(uid: string) {
const allowed = new Set<string>([uid]);

const { data: followingRows, error: followsErr } = await supabase
.from("follows")
.select("following_id")
.eq("follower_id", uid);

if (followsErr) {
setBanner(followsErr.message);
} else {
for (const row of followingRows ?? []) {
const followingId = (row as any).following_id as string | null;
if (followingId) allowed.add(followingId);
}
}

const { data: friendRows, error: friendsErr } = await supabase
.from("friends")
.select("user_id,friend_id")
.or(`user_id.eq.${uid},friend_id.eq.${uid}`);

if (friendsErr) {
setBanner(friendsErr.message);
} else {
for (const row of friendRows ?? []) {
const userId = (row as any).user_id as string | null;
const friendId = (row as any).friend_id as string | null;

if (userId && userId !== uid) allowed.add(userId);
if (friendId && friendId !== uid) allowed.add(friendId);
}
}

const ids = Array.from(allowed);
setAllowedAuthorIds(ids);
return ids;
}

async function loadSuggestedUsers(uid: string) {
const { data: followingRows, error: followingErr } = await supabase
.from("follows")
.select("following_id")
.eq("follower_id", uid);

if (followingErr) {
setBanner(followingErr.message);
return;
}

const alreadyFollowing = (followingRows ?? [])
.map((row) => (row as any).following_id as string | null)
.filter((id): id is string => !!id);

setFollowingIds(alreadyFollowing);

const excludeIds = new Set<string>([uid, ...alreadyFollowing]);

const { data: blockRows, error: blockErr } = await supabase
.from("blocked_users")
.select("blocker_id,blocked_id")
.or(`blocker_id.eq.${uid},blocked_id.eq.${uid}`);

if (blockErr) {
setBanner(blockErr.message);
return;
}

for (const row of blockRows ?? []) {
const blockerId = (row as any).blocker_id as string | null;
const blockedId = (row as any).blocked_id as string | null;

if (blockerId === uid && blockedId) excludeIds.add(blockedId);
if (blockedId === uid && blockerId) excludeIds.add(blockerId);
}



const { data, error } = await supabase
.from("profiles")

.select("id,username,display_name,avatar_url,last_active_at,moderation_status")
.order("last_active_at", { ascending: false })
.limit(30);

if (error) {
setBanner(error.message);
return;
}

const filtered = ((data ?? []) as ProfileRow[]).filter(
(profile) =>
!excludeIds.has(profile.id) &&
(profile.moderation_status ?? "active") === "active"
);

setSuggestedUsers(filtered.slice(0, 12));
}

async function followUser(targetUserId: string) {
const uid = myUserId ?? (await refreshAuth());
if (!uid) return;
const { data: meProfile } = await supabase
.from("profiles")
.select("moderation_status,suspended_until")
.eq("id", uid)
.maybeSingle();

const suspended =
meProfile?.moderation_status === "suspended" &&
meProfile?.suspended_until &&
new Date(meProfile.suspended_until).getTime() > Date.now();

const banned = meProfile?.moderation_status === "banned";

if (suspended || banned) {
setBanner(
suspended
? `Your account is suspended until ${new Date(
meProfile.suspended_until
).toLocaleString()}.`
: "Your account has been banned."
);
return;
}
if (targetUserId === uid) return;

setFollowBusyId(targetUserId);
setBanner(null);

const { error } = await supabase.from("follows").insert({
follower_id: uid,
following_id: targetUserId,
});


if (error) {
const isConflict =
(error as any)?.status === 409 ||
(error as any)?.code === "23505" ||
String((error as any)?.message || "").toLowerCase().includes("duplicate") ||
String((error as any)?.message || "").toLowerCase().includes("unique");

if (!isConflict) {
setBanner(error.message);
setFollowBusyId(null);
return;
}
}

setFollowingIds((prev) => [...new Set([...prev, targetUserId])]);
setSuggestedUsers((prev) => prev.filter((u) => u.id !== targetUserId));

await loadPosts();
await loadSuggestedUsers(uid);

setFollowBusyId(null);
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
if (!postIds.length) {
setLikeCounts({});
setLikedByMe({});
setMyReactionByPost({});
setReactionCountsByPost({});
setCommentCounts({});
return;
}

setBanner(null);
const { data: likeRows, error: likeErr } = await supabase
.from("post_likes")
.select("post_id,user_id,reaction")
.in("post_id", postIds);

if (likeErr) {
setBanner(`Spanks disabled: ${likeErr.message}`);
return;
}

const lc: Record<number, number> = {};
const lbm: Record<number, boolean> = {};
const reactionsByMe: Record<number, ReactionKey | undefined> = {};
const reactionTotals: Record<number, ReactionCountsMap> = {};

for (const r of likeRows ?? []) {
const pid = (r as any).post_id as number;
const uid = (r as any).user_id as string;
const reaction = ((r as any).reaction || "devil") as ReactionKey;

lc[pid] = (lc[pid] ?? 0) + 1;

if (!reactionTotals[pid]) {
reactionTotals[pid] = {};
}

reactionTotals[pid][reaction] =
(reactionTotals[pid][reaction] ?? 0) + 1;

if (myUserId && uid === myUserId) {
lbm[pid] = true;
reactionsByMe[pid] = reaction;
}
}

const { data: commentRows, error: cErr } = await supabase
.from("post_comments")
.select("post_id")
.in("post_id", postIds);

if (cErr) {
setLikeCounts(lc);
setLikedByMe(lbm);
setMyReactionByPost(reactionsByMe);
setReactionCountsByPost(reactionTotals);
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
setMyReactionByPost(reactionsByMe);
setReactionCountsByPost(reactionTotals);
setCommentCounts(cc);
}

async function ensureFocusPostLoaded(focusId: number) {
if (posts.some((p) => p.id === focusId)) return;

const uid = myUserId ?? (await refreshAuth());
if (!uid) return;

const allowedIds =
allowedAuthorIds.length > 0 ? allowedAuthorIds : await getAllowedAuthorIds(uid);

const { data, error } = await supabase
.from("posts")
.select("id,user_id,body,kind,created_at,media_url,media_type,group_id,is_locked")
.eq("id", focusId)
.maybeSingle();

if (error || !data) return;

const p = data as PostRow;

const { data: authorProfile } = await supabase
.from("profiles")
.select("moderation_status")
.eq("id", p.user_id)
.maybeSingle();

if ((authorProfile?.moderation_status ?? "active") !== "active") {
setBanner("That post is not available.");
return;
}

if (!allowedIds.includes(p.user_id)) {
setBanner("That post is not available in your feed.");
return;
}

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
const uid = myUserId ?? (await refreshAuth());
if (!uid) {
setPosts([]);
return;
}

const allowedIds = await getAllowedAuthorIds(uid);

if (!allowedIds.length) {
setPosts([]);
setProfilesById({});
setGroupsById({});
await loadCounts([]);
return;
}

const { data: blockRows, error: blockErr } = await supabase
.from("blocked_users")
.select("blocker_id,blocked_id")
.or(`blocker_id.eq.${uid},blocked_id.eq.${uid}`);

if (blockErr) {
setBanner(blockErr.message);
return;
}

const blockedUserIds = new Set<string>();

for (const row of blockRows ?? []) {
const blockerId = (row as any).blocker_id as string | null;
const blockedId = (row as any).blocked_id as string | null;

if (blockerId === uid && blockedId) blockedUserIds.add(blockedId);
if (blockedId === uid && blockerId) blockedUserIds.add(blockerId);
}

const visibleAllowedIds = allowedIds.filter((id) => !blockedUserIds.has(id));

if (!visibleAllowedIds.length) {
setPosts([]);
setProfilesById({});
setGroupsById({});
await loadCounts([]);
return;
}

const { data, error } = await supabase
.from("posts")
.select("id,user_id,body,kind,created_at,media_url,media_type,group_id,is_locked")
.in("user_id", visibleAllowedIds)
.order("created_at", { ascending: false })
.limit(200);

if (error) {
setBanner(error.message);
return;
}

const rows = (data ?? []) as PostRow[];
let unlockedMap: Record<number, boolean> = {};

const lockedPostIds = rows
.filter((p) => p.is_locked)
.map((p) => p.id);

if (lockedPostIds.length) {
const { data: unlockRows, error: unlockErr } = await supabase
.from("post_unlocks")
.select("post_id")
.eq("buyer_id", uid)
.in("post_id", lockedPostIds);

if (!unlockErr) {
unlockedMap = Object.fromEntries(
(unlockRows ?? []).map((r: any) => [Number(r.post_id), true])
);
}
}

setUnlockedPostIds(unlockedMap);



const uids = Array.from(new Set(rows.map((r) => r.user_id).filter(Boolean)));
if (uids.length) {
const { data: profs } = await supabase
.from("profiles")
.select("id,username,display_name,avatar_url,moderation_status")
.in("id", uids);

const activeProfiles = ((profs ?? []) as ProfileRow[]).filter(
(p) => (p.moderation_status ?? "active") === "active"
);

const activeUserIds = new Set(activeProfiles.map((p) => p.id));

const map: Record<string, ProfileRow> = {};
for (const p of activeProfiles) map[p.id] = p;

setProfilesById(map);
const activeRows = rows.filter((post) => activeUserIds.has(post.user_id));
setPosts(spaceLockedPosts(activeRows));
} else {
setProfilesById({});
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
} else {
await loadCounts([]);
}
}

useEffect(() => {
void (async () => {
const uid = await refreshAuth();
if (!uid) {
setPosts([]);
setSuggestedUsers([]);
return;
}

await loadPosts();
await loadSuggestedUsers(uid);
})();
// eslint-disable-next-line react-hooks/exhaustive-deps
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
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [focusPostId, posts.length]);

function triggerSpark(postId: number) {
setSpark((m) => ({ ...m, [postId]: true }));
window.setTimeout(() => {
setSpark((m) => ({ ...m, [postId]: false }));
}, 260);
}

function closeReactionPicker(postId: number) {
setOpenReactionPicker((m) => ({ ...m, [postId]: false }));
}

function toggleReactionPicker(postId: number) {
setOpenReactionPicker((m) => ({ ...m, [postId]: !m[postId] }));
}

async function setReaction(postId: number, reaction: ReactionKey = "devil") {
const uid = myUserId ?? (await refreshAuth());
if (!uid) return;

const { data: meProfile } = await supabase
.from("profiles")
.select("moderation_status,suspended_until")
.eq("id", uid)
.maybeSingle();

const suspended =
meProfile?.moderation_status === "suspended" &&
meProfile?.suspended_until &&
new Date(meProfile.suspended_until).getTime() > Date.now();

const banned = meProfile?.moderation_status === "banned";

if (suspended || banned) {
setBanner(
suspended
? `Your account is suspended until ${new Date(
meProfile.suspended_until
).toLocaleString()}.`
: "Your account has been banned."
);
return;
}

const postOwnerId = posts.find((p) => p.id === postId)?.user_id ?? null;

if (!postOwnerId) {
setBanner("Post unavailable.");
return;
}

if (postOwnerId !== uid) {
const { data: blockRows, error: blockErr } = await supabase
.from("blocked_users")
.select("id")
.or(
`and(blocker_id.eq.${uid},blocked_id.eq.${postOwnerId}),and(blocker_id.eq.${postOwnerId},blocked_id.eq.${uid})`
)
.limit(1);

if (blockErr) {
setBanner("Could not verify block status.");
return;
}

if ((blockRows ?? []).length > 0) {
setBanner("You can’t interact with this post.");
return;
}
}

if (busyPostId) return;
setBusyPostId(postId);
setBanner(null);

const currentReaction = myReactionByPost[postId];
const already = !!likedByMe[postId];

if (already && currentReaction === reaction) {
const { error } = await supabase
.from("post_likes")
.delete()
.eq("post_id", postId)
.eq("user_id", uid);

if (error) {
setBanner(error.message);
setBusyPostId(null);
return;
}

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
closeReactionPicker(postId);
setBusyPostId(null);
return;
}

if (already && currentReaction && currentReaction !== reaction) {
const { error } = await supabase
.from("post_likes")
.update({ reaction })
.eq("post_id", postId)
.eq("user_id", uid);

if (error) {
setBanner(error.message);
setBusyPostId(null);
return;
}

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
closeReactionPicker(postId);
setBusyPostId(null);
return;
}

const { error } = await supabase.from("post_likes").insert({
post_id: postId,
user_id: uid,
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
.eq("user_id", uid);

if (updateErr) {
setBanner(updateErr.message);
setBusyPostId(null);
return;
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
closeReactionPicker(postId);
setBusyPostId(null);
}
setBanner(error.message);
setBusyPostId(null);
return;
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
closeReactionPicker(postId);
setBusyPostId(null);
}

async function toggleSpank(postId: number) {
const existing = myReactionByPost[postId];
await setReaction(postId, existing || "devil");
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
try {
const uid = await ensureCanInteract();

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
} catch (e: any) {
setBanner(String(e?.message || e));
}
}

const postBtn: CSSProperties = {
padding: "8px 16px",
borderRadius: 999,
border: "none",
cursor: "pointer",
color: "white",
fontWeight: 700,
background: "linear-gradient(90deg,#7c3aed,#c026d3)",
boxShadow: "0 0 14px rgba(168,85,247,0.6)",
};

const pillBtn: CSSProperties = {
padding: "8px 14px",
borderRadius: 999,
border: "1px solid rgba(180,120,255,0.25)",
background: "rgba(0,0,0,0.35)",
color: "white",
cursor: "pointer",
fontWeight: 650,
};

const cardStyle: CSSProperties = {
background: "rgba(0,0,0,0.55)",
border: "3px solid rgba(181, 120, 255, 0.33)",
borderRadius: 16,
padding: 14,
};

const inputStyle: CSSProperties = {
background: "rgba(0,0,0,0.6)",
color: "white",
border: "1px solid rgba(181, 120, 255, 0.44)",
borderRadius: 12,
padding: "10px 12px",
outline: "none",
};

const avatarStyle: CSSProperties = {
width: 46,
height: 46,
borderRadius: 999,
objectFit: "cover",
border: "1px solid rgba(180,120,255,0.24)",
flex: "0 0 auto",
background: "rgba(0,0,0,0.45)",
};

const groupPillStyle: CSSProperties = {
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

async function ensureCanInteract() {
const uid = myUserId ?? (await refreshAuth());
if (!uid) throw new Error("Not signed in.");

const { data: profile, error } = await supabase
.from("profiles")
.select("moderation_status,suspended_until,moderation_note")
.eq("id", uid)
.maybeSingle();

if (error) throw new Error(error.message);

const status = profile?.moderation_status ?? "active";
const suspendedUntil = profile?.suspended_until
? new Date(profile.suspended_until)
: null;

if (status === "banned") {
throw new Error(
profile?.moderation_note ||
"Your account has been banned. You cannot post or comment."
);
}

if (
status === "suspended" &&
suspendedUntil &&
suspendedUntil.getTime() > Date.now()
) {
throw new Error(
`Your account is suspended until ${suspendedUntil.toLocaleString()}.`
);
}

return uid;
}

async function submitPost() {
const trimmed = text.trim();
if (!trimmed && !file) return;

setPosting(true);
setBanner(null);

try {
const uid = await ensureCanInteract();

let media_url: string | null = null;
let media_type: string | null = null;
let kind = "text";

if (file) {
setUploading(true);
const up = await uploadToStorage(uid, file);

console.log("UPLOAD DEBUG", {
name: file.name,
type: file.type,
size: file.size,
url: up.publicUrl,
});
media_url = up.publicUrl;
media_type = up.mediaType;
kind = media_type.startsWith("video/") ? "video" : "image";
setUploading(false);
}

if (wantsLocked && file) {
const { count: totalMediaCount, error: totalMediaError } = await supabase
.from("posts")
.select("id", { count: "exact", head: true })
.eq("user_id", uid)
.in("kind", ["photo", "video"]);

if (totalMediaError) throw new Error(totalMediaError.message);

const { count: lockedMediaCount, error: lockedMediaError } = await supabase
.from("posts")
.select("id", { count: "exact", head: true })
.eq("user_id", uid)
.eq("is_locked", true)
.in("kind", ["photo", "video"]);

if (lockedMediaError) throw new Error(lockedMediaError.message);

const totalAfterThisPost = (totalMediaCount ?? 0) + 1;
const lockLimit = Math.floor(totalAfterThisPost * 0.3);

if ((lockedMediaCount ?? 0) >= lockLimit) {
setBanner(
`You can lock up to 30% of your photos and videos. Add more public media first or unlock something.`
);
return;
}
}

const { error } = await supabase.from("posts").insert({
user_id: uid,
body: trimmed || null,
kind,
media_url,
media_type,
is_locked: wantsLocked,
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

async function unlockPost(post: PostRow) {
const uid = myUserId ?? (await refreshAuth());
if (!uid) {
setBanner("You need to be signed in to unlock this post.");
return;
}

const { error } = await supabase.from("post_unlocks").insert({
post_id: post.id,
buyer_id: uid,
creator_id: post.user_id,
amount_cents: 149,
currency: "usd",
});

if (error && !String(error.message).toLowerCase().includes("duplicate")) {
setBanner(error.message);
return;
}

setUnlockedPostIds((m) => ({ ...m, [post.id]: true }));
}

async function reportPost(post: PostRow) {
return;
}

async function deletePost(post: PostRow) {
try {
const uid = myUserId ?? (await refreshAuth());
if (!uid) return;

const { data: meProfile } = await supabase
.from("profiles")
.select("moderation_status,suspended_until")
.eq("id", uid)
.maybeSingle();

const suspended =
meProfile?.moderation_status === "suspended" &&
meProfile?.suspended_until &&
new Date(meProfile.suspended_until).getTime() > Date.now();

const banned = meProfile?.moderation_status === "banned";

if (suspended || banned) {
setBanner(
suspended
? `Your account is suspended until ${new Date(
meProfile.suspended_until
).toLocaleString()}.`
: "Your account has been banned."
);
return;
}

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
if (p.is_locked && !unlockedPostIds[p.id]) {
return (
<div
onClick={() => unlockPost(p)}
style={{
width: "100%",
minHeight: 420,
cursor: "pointer",
borderRadius: 18,
border: "1px solid rgba(236,72,153,0.28)",
background:
"linear-gradient(180deg, rgba(255,255,255,0.08), rgba(0,0,0,0.82))",
backdropFilter: "blur(18px)",
WebkitBackdropFilter: "blur(18px)",
display: "flex",
alignItems: "center",
justifyContent: "center",
flexDirection: "column",
gap: 12,
marginBottom: 10,
color: "#fff",
textAlign: "center",
padding: 24,
boxShadow:
"0 0 25px rgba(236,72,153,0.18), 0 0 60px rgba(168,85,247,0.12)",
transition: "all 0.22s ease",

}}
onMouseEnter={(e) => {
const el = e.currentTarget;
el.style.transform = "translateY(-4px) scale(1.01)";
el.style.boxShadow =
"0 0 35px rgba(236,72,153,0.32), 0 0 80px rgba(168,85,247,0.22)";
}}
onMouseLeave={(e) => {
const el = e.currentTarget;
el.style.transform = "translateY(0) scale(1)";
el.style.boxShadow =
"0 0 25px rgba(236,72,153,0.18), 0 0 60px rgba(168,85,247,0.12)";
}}
>
<div
style={{
width: 88,
height: 88,
borderRadius: "50%",
display: "flex",
alignItems: "center",
justifyContent: "center",
background: "rgba(255,255,255,0.08)",
border: "1px solid rgba(255,255,255,0.12)",
backdropFilter: "blur(18px)",
WebkitBackdropFilter: "blur(18px)",
boxShadow:
"0 0 22px rgba(236,72,153,0.30), 0 0 45px rgba(168,85,247,0.22)",
marginBottom: 12,
}}
>
<div style={{ fontSize: 42 }}>🔒</div>
</div>

<div style={{ fontSize: 24, fontWeight: 900 }}>Locked Content</div>

<div style={{ opacity: 0.82, fontSize: 15 }}>
Unlock this post for $1.49
</div>

<button
type="button"
style={{
marginTop: 8,
padding: "12px 22px",
borderRadius: 999,
border: "1px solid rgba(236,72,153,0.45)",
background:
"linear-gradient(180deg, rgba(255,255,255,0.14), rgba(255,255,255,0.06))",
color: "white",
fontWeight: 800,
cursor: "pointer",
backdropFilter: "blur(14px)",
WebkitBackdropFilter: "blur(14px)",
boxShadow:
"0 0 18px rgba(236,72,153,0.25), 0 0 40px rgba(168,85,247,0.18)",
}}
>
Unlock Now
</button>
</div>
);
}

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
<img
src={p.media_url}
alt=""
style={{
width: "100%",
borderRadius: 14,
height: "auto",
border: "1px solid rgba(180,120,255,0.14)",
marginBottom: 10,
objectFit: "contain",
cursor: "pointer",
}}
onClick={() => setViewer({ url: p.media_url!, type: "image" })}
/>
);
}

return null;
};

return (
<div
style={{
width: "100%",
maxWidth: 1240,
margin: "0 auto",
padding: 16,
display: "grid",
gridTemplateColumns: "220px minmax(0, 720px) 280px",
gap: 18,
alignItems: "start",
}}
>
<aside style={{ minHeight: 1 }} />

<main style={{ minWidth: 0 }}>
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

<div
style={{
textAlign: "center",
fontSize: 90,
fontWeight: 900,
letterSpacing: 2,
marginBottom: 20,
color: "rgba(238, 8, 169, 0.72)",
textShadow: `
0 0 2.5px rgba(168,85,247,0.9),
0 0 20px rgba(168,85,247,0.9),
0 0 20px rgba(168,85,247,0.8),
0 0 35px rgba(168,85,247,0.7)
`,
animation: "glowPulse 1.5s ease-in-out infinite alternate",
}}
>
UNBOUND
</div>

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
border: "1px solid rgba(238, 8, 169, 0.25)",
borderRadius: 20,
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

{file && (
<label
style={{
display: "flex",
alignItems: "center",
gap: 8,
marginTop: 10,
fontSize: 14,
color: "#ddd",
}}
>
<input
type="checkbox"
checked={wantsLocked}
onChange={(e) => setWantsLocked(e.target.checked)}
/>
🔒 Lock this content
</label>
)}



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

<button onClick={submitPost} disabled={posting || uploading} style={postBtn}>
{uploading ? "Reaching climax..." : posting ? "Reaching climax..." : "Post"}
</button>
</div>
</div>

<div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
{posts.length === 0 && (
<div
style={{
background: "rgba(0,0,0,0.65)",
border: "1px solid rgba(192,38,211,0.35)",
borderRadius: 20,
padding: 24,
textAlign: "center",
boxShadow: `
0 0 20px rgba(192,38,211,0.25),
0 0 40px rgba(168,85,247,0.15)
`,
backdropFilter: "blur(18px)",
}}
>
<div
style={{
fontSize: 28,
fontWeight: 900,
marginBottom: 10,
color: "rgba(236,72,153,0.95)",
textShadow: `
0 0 6px rgba(236,72,153,0.9),
0 0 18px rgba(168,85,247,0.8)
`,
}}
>
Welcome to Unbound
</div>

<div
style={{
opacity: 0.75,
fontSize: 14,
marginBottom: 18,
}}
>
Your feed comes alive when you follow people, make friends, or join groups.
</div>

<div
style={{
display: "flex",
justifyContent: "center",
gap: 12,
flexWrap: "wrap",
}}
>
<button
onClick={() => router.push("/explore")}
style={{
padding: "10px 18px",
borderRadius: 999,
border: "none",
cursor: "pointer",
fontWeight: 800,
color: "white",
background: "linear-gradient(90deg,#ec4899,#a855f7)",
boxShadow: "0 0 16px rgba(168,85,247,0.7)",
}}
>
Explore
</button>

<button
onClick={() => router.push("/search")}
style={{
padding: "10px 18px",
borderRadius: 999,
border: "1px solid rgba(168,85,247,0.35)",
background: "rgba(0,0,0,0.4)",
color: "white",
cursor: "pointer",
fontWeight: 700,
}}
>
Find People
</button>

<button
onClick={() => router.push("/groups")}
style={{
padding: "10px 18px",
borderRadius: 999,
border: "1px solid rgba(168,85,247,0.35)",
background: "rgba(0,0,0,0.4)",
color: "white",
cursor: "pointer",
fontWeight: 700,
}}
>
Browse Groups
</button>
</div>

{suggestedUsers.length > 0 ? (
<div style={{ marginTop: 22 }}>
<div
style={{
fontSize: 13,
fontWeight: 800,
letterSpacing: 0.4,
textTransform: "uppercase",
color: "rgba(236,72,153,0.9)",
marginBottom: 12,
textShadow: "0 0 10px rgba(168,85,247,0.35)",
}}
>
Suggested for you
</div>

<div
style={{
display: "grid",
gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
gap: 12,
textAlign: "left",
}}
>
{suggestedUsers.map((user) => {
const label = user.display_name || user.username || "Unknown";
const handle = user.username ? `@${user.username}` : "";

return (
<div
key={user.id}
style={{
background: "rgba(255,255,255,0.04)",
border: "1px solid rgba(168,85,247,0.22)",
borderRadius: 16,
padding: 12,
display: "flex",
alignItems: "center",
gap: 12,
boxShadow: "0 0 16px rgba(168,85,247,0.12)",
}}
>
{user.avatar_url ? (
<img
src={user.avatar_url}
alt=""
onClick={() => router.push(`/u/${user.id}`)}
style={{
width: 52,
height: 52,
borderRadius: 999,
objectFit: "cover",
cursor: "pointer",
border: "1px solid rgba(236,72,153,0.28)",
flex: "0 0 auto",
}}
/>
) : (
<div
onClick={() => router.push(`/u/${user.id}`)}
style={{
width: 52,
height: 52,
borderRadius: 999,
display: "grid",
placeItems: "center",
cursor: "pointer",
fontWeight: 800,
color: "white",
background: "rgba(168,85,247,0.18)",
border: "1px solid rgba(236,72,153,0.28)",
flex: "0 0 auto",
}}
>
{label.trim().charAt(0).toUpperCase()}
</div>
)}

<div style={{ flex: 1, minWidth: 0 }}>
<div
onClick={() => router.push(`/u/${user.id}`)}
style={{
fontWeight: 800,
color: "white",
cursor: "pointer",
whiteSpace: "nowrap",
overflow: "hidden",
textOverflow: "ellipsis",
}}
>
{label}
</div>

<div
style={{
fontSize: 12,
opacity: 0.7,
marginTop: 2,
whiteSpace: "nowrap",
overflow: "hidden",
textOverflow: "ellipsis",
}}
>
{handle || "New connection"}
</div>
</div>

<button
onClick={() => followUser(user.id)}
disabled={followBusyId === user.id || followingIds.includes(user.id)}
style={{
padding: "8px 12px",
borderRadius: 999,
border: "none",
cursor: "pointer",
color: "white",
fontWeight: 800,
background: "linear-gradient(90deg,#ec4899,#a855f7)",
boxShadow: "0 0 14px rgba(168,85,247,0.45)",
opacity:
followBusyId === user.id || followingIds.includes(user.id) ? 0.65 : 1,
}}
>
{followBusyId === user.id
? "..."
: followingIds.includes(user.id)
? "Following"
: "Follow"}
</button>
</div>
);
})}
</div>
</div>
) : null}
</div>
)}

{posts.map((p) => {
const spanks = likeCounts[p.id] ?? 0;
const comments = commentCounts[p.id] ?? 0;
const iSpanked = !!likedByMe[p.id];
const myReaction = myReactionByPost[p.id];
const isBusy = busyPostId === p.id;
const isOpen = !!openComments[p.id];

const isMine = myUserId && p.user_id === myUserId;
const isFocused = flashPostId === p.id;
const groupInfo = typeof p.group_id === "number" ? groupsById[p.group_id] : null;

return (
<div
key={p.id}
id={`post-${p.id}`}
style={{
...cardStyle,
border: isFocused ? "1px solid rgba(192,38,211,0.65)" : cardStyle.border,
boxShadow: isFocused ? "0 0 34px rgba(192,38,211,0.35)" : undefined,
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
el.style.boxShadow =
"0 0 60px rgba(192,38,211,0.85), 0 0 120px rgba(168,85,247,0.55)";
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
<div style={{ fontWeight: 850, opacity: 0.95 }}>{authorName(p.user_id)}</div>
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
{authorHandle(p.user_id) ? <span>{authorHandle(p.user_id)}</span> : null}
<span>{timeAgo(p.created_at)}</span>
</div>

{groupInfo ? (
<div
onClick={() => router.push(`/groups/${groupInfo.slug}`)}
style={{ ...groupPillStyle, cursor: "pointer" }}
>
{groupInfo.avatar_url ? (
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

<div
style={{
display: "flex",
gap: 10,
alignItems: "center",
marginLeft: "auto",
}}
>
{!isMine ? (
<ReportPostButton
postId={p.id}
reportedUserId={p.user_id}
myUserId={myUserId}
onReported={setBanner}
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
/>
) : null}

{isMine ? (
<button
onClick={(e) => {
e.preventDefault();
e.stopPropagation();
deletePost(p);
}}
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

<ReactionBar
postId={p.id}
spanks={spanks}
comments={comments}
iSpanked={iSpanked}
myReaction={myReaction}
isBusy={isBusy}
isPickerOpen={!!openReactionPicker[p.id]}
sparkOn={!!spark[p.id]}
pillBtn={pillBtn}
reactionCounts={reactionCountsByPost[p.id]}
onToggleSpank={toggleSpank}
onTogglePicker={toggleReactionPicker}
onSetReaction={setReaction}
onOpenComments={openCommentsFor}
/>

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

<button onClick={() => addComment(p.id)} disabled={isBusy} style={postBtn}>
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
<ReportCommentButton
commentId={c.id}
commentBody={c.body}
commentUserId={c.user_id}
myUserId={myUserId}
onReported={setBanner}
/>
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
</main>

<aside
style={{
position: "sticky",
top: 86,
display: "flex",
flexDirection: "column",
gap: 14,
}}
>
<FeaturedProfileCard />
</aside>

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
<img src={viewer.url} alt="" style={{ width: "100%", borderRadius: 12 }} />
) : (
<video src={viewer.url} controls style={{ width: "100%", borderRadius: 12 }} />
)}

<div style={{ display: "flex", justifyContent: "flex-end", marginTop: 10 }}>
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