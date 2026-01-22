"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

type ProfileRow = {
id: string;
username: string | null;
display_name: string | null;
bio: string | null;
avatar_url: string | null;
};

type ModalType = "followers" | "following";

export default function ProfilePage() {
// Browser-safe Supabase client (uses NEXT_PUBLIC keys)
const supabase = useMemo(() => {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
return createClient(url, anon);
}, []);

const [myUserId, setMyUserId] = useState<string | null>(null);
const [myProfile, setMyProfile] = useState<ProfileRow | null>(null);

const [followersCount, setFollowersCount] = useState<number>(0);
const [followingCount, setFollowingCount] = useState<number>(0);

// (Optional) Friends count placeholder for now
const friendsCount = 0;

const [modalOpen, setModalOpen] = useState(false);
const [modalType, setModalType] = useState<ModalType>("followers");
const [modalLoading, setModalLoading] = useState(false);
const [modalUsers, setModalUsers] = useState<ProfileRow[]>([]);

// 1) Get logged-in user
useEffect(() => {
(async () => {
const { data, error } = await supabase.auth.getUser();
if (error) {
console.error(error);
return;
}
setMyUserId(data.user?.id ?? null);
})();
}, [supabase]);

// 2) Load my profile + counts
useEffect(() => {
if (!myUserId) return;

(async () => {
// Load profile
const { data: p, error: pErr } = await supabase
.from("profiles")
.select("id, username, display_name, bio, avatar_url")
.eq("id", myUserId)
.maybeSingle();

if (pErr) console.error(pErr);
setMyProfile((p as ProfileRow) ?? null);

// Followers count = rows where following_id = me
const { count: followers, error: fErr } = await supabase
.from("follows")
.select("*", { count: "exact", head: true })
.eq("following_id", myUserId);

if (fErr) console.error(fErr);
setFollowersCount(followers ?? 0);

// Following count = rows where follower_id = me
const { count: following, error: foErr } = await supabase
.from("follows")
.select("*", { count: "exact", head: true })
.eq("follower_id", myUserId);

if (foErr) console.error(foErr);
setFollowingCount(following ?? 0);
})();
}, [supabase, myUserId]);

function openModal(type: ModalType) {
setModalType(type);
setModalOpen(true);
}

// 3) When modal opens, load users list
useEffect(() => {
if (!modalOpen) return;
if (!myUserId) return;

(async () => {
setModalLoading(true);
setModalUsers([]);

try {
const isFollowers = modalType === "followers";

const { data: rows, error: rowsErr } = await supabase
.from("follows")
.select(isFollowers ? "follower_id" : "following_id")
.eq(isFollowers ? "following_id" : "follower_id", myUserId);

if (rowsErr) {
console.error(rowsErr);
setModalUsers([]);
return;
}

const ids =
(rows ?? []).map((r: any) =>
isFollowers ? r.follower_id : r.following_id
) ?? [];

if (ids.length === 0) {
setModalUsers([]);
return;
}

// IMPORTANT: include bio here to match ProfileRow type
const { data: profiles, error: profErr } = await supabase
.from("profiles")
.select("id, username, display_name, bio, avatar_url")
.in("id", ids);

if (profErr) {
console.error(profErr);
setModalUsers([]);
return;
}

setModalUsers(((profiles ?? []) as unknown) as ProfileRow[]);
} finally {
setModalLoading(false);
}
})();
}, [modalOpen, modalType, myUserId, supabase]);

// UI helpers
const title = myProfile?.display_name || myProfile?.username || "My Profile";
const subtitle = myProfile?.username ? `@${myProfile.username}` : "";
const locationLine = "Tacoma, Washington, United States"; // placeholder for now

// --------- Styles (no Tailwind dependency) ----------
const S = {
page: {
minHeight: "100vh",
padding: "28px 18px",
color: "rgba(255,255,255,0.92)",
fontFamily:
'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, "Apple Color Emoji","Segoe UI Emoji"',
} as const,

card: {
width: "100%",
maxWidth: 520,
margin: "0 auto",
borderRadius: 18,
border: "1px solid rgba(255,255,255,0.10)",
background: "rgba(0,0,0,0.45)",
backdropFilter: "blur(14px)",
padding: 16,
} as const,

headerRow: {
display: "flex",
gap: 14,
alignItems: "center",
} as const,

avatar: {
height: 140,
width: 140,
borderRadius: "50%",
overflow: "hidden",
border: "1px solid rgba(255,255,255,0.10)",
background: "rgba(255,255,255,0.06)",
flex: "0 0 auto",
} as const,

name: {
fontSize: 30,
fontWeight: 800,
lineHeight: 1.05,
margin: 0,
} as const,

sub: {
marginTop: 6,
fontSize: 14,
color: "rgba(255,255,255,0.65)",
} as const,

bio: {
marginTop: 10,
fontSize: 14,
color: "rgba(255,255,255,0.70)",
} as const,

btnRow: {
display: "flex",
gap: 10,
marginTop: 14,
} as const,

btn: {
flex: 1,
height: 44,
borderRadius: 10,
border: "1px solid rgba(255,255,255,0.14)",
background: "rgba(255,255,255,0.10)",
color: "rgba(255,255,255,0.95)",
fontWeight: 650,
fontSize: 14,
display: "flex",
alignItems: "center",
justifyContent: "center",
cursor: "pointer",
textDecoration: "none",
} as const,

statsWrap: {
marginTop: 14,
borderTop: "1px solid rgba(255,255,255,0.12)",
borderBottom: "1px solid rgba(255,255,255,0.12)",
display: "grid",
gridTemplateColumns: "1fr 1fr 1fr",
} as const,

stat: {
padding: "12px 8px",
textAlign: "center" as const,
cursor: "pointer",
userSelect: "none" as const,
} as const,

statMiddle: {
borderLeft: "1px solid rgba(255,255,255,0.12)",
borderRight: "1px solid rgba(255,255,255,0.12)",
} as const,

statNum: {
fontSize: 18,
fontWeight: 800,
color: "rgba(255,255,255,0.92)",
lineHeight: 1.1,
} as const,

statLabel: {
fontSize: 12,
color: "rgba(255,255,255,0.60)",
marginTop: 4,
} as const,

modalBackdrop: {
position: "fixed" as const,
inset: 0,
background: "rgba(0,0,0,0.62)",
display: "flex",
alignItems: "center",
justifyContent: "center",
zIndex: 9999,
padding: 14,
} as const,

modal: {
width: "100%",
maxWidth: 420,
borderRadius: 16,
border: "1px solid rgba(255,255,255,0.12)",
background: "rgba(0,0,0,0.72)",
backdropFilter: "blur(14px)",
padding: 12,
} as const,

modalHeader: {
display: "flex",
alignItems: "center",
justifyContent: "space-between",
paddingBottom: 8,
borderBottom: "1px solid rgba(255,255,255,0.10)",
marginBottom: 10,
} as const,

modalTitle: {
fontWeight: 800,
color: "rgba(255,255,255,0.92)",
} as const,

closeBtn: {
border: "none",
background: "transparent",
color: "rgba(255,255,255,0.75)",
cursor: "pointer",
fontSize: 14,
} as const,

list: {
maxHeight: "62vh",
overflowY: "auto" as const,
display: "flex",
flexDirection: "column" as const,
gap: 8,
paddingTop: 4,
} as const,

userRow: {
display: "flex",
alignItems: "center",
gap: 10,
padding: 10,
borderRadius: 12,
border: "1px solid rgba(255,255,255,0.10)",
background: "rgba(255,255,255,0.06)",
textDecoration: "none",
color: "rgba(255,255,255,0.92)",
} as const,

userAvatar: {
height: 40,
width: 40,
borderRadius: 999,
overflow: "hidden",
border: "1px solid rgba(255,255,255,0.10)",
background: "rgba(255,255,255,0.06)",
flex: "0 0 auto",
} as const,

userName: { fontWeight: 700, fontSize: 14 } as const,
userHandle: { fontSize: 12, color: "rgba(255,255,255,0.60)" } as const,
};
// ---------------------------------------------------

async function shareProfile() {
// If you have a public profile route later, swap this to your real URL.
const shareText = `Check out my Unbound profile: ${window.location.href}`;

try {
// @ts-ignore
if (navigator.share) {
// @ts-ignore
await navigator.share({ text: shareText, url: window.location.href });
return;
}
} catch {
// ignore
}

try {
await navigator.clipboard.writeText(shareText);
alert("Profile link copied.");
} catch {
alert(shareText);
}
}

return (
<div style={{...S.page, marginTop: "80px"}}>
<div style={S.card}>
<div style={S.headerRow}>
<div style={S.avatar}>
{myProfile?.avatar_url ? (
// eslint-disable-next-line @next/next/no-img-element
<img
src={`${myProfile.avatar_url}?t=${Date.now()}`}
alt=""
style={{ height: "100%", width: "100%", objectFit: "cover" }}
/>
) : (
<div
style={{
height: "100%",
width: "100%",
display: "flex",
alignItems: "center",
justifyContent: "center",
color: "rgba(255,255,255,0.35)",
fontWeight: 800,
fontSize: 18,
}}
>
—
</div>
)}
</div>

<div style={{ minWidth: 0 }}>
<h1 style={S.name}>{title}</h1>
{subtitle ? <div style={S.sub}>{subtitle}</div> : null}
<div style={S.sub}>{locationLine}</div>
<div style={S.bio}>{myProfile?.bio ? myProfile.bio : "No bio yet."}</div>
</div>
</div>

{/* Buttons like FetLife */}
<div style={S.btnRow}>
<Link href="/edit-profile" style={S.btn}>
Edit Profile
</Link>

<button type="button" style={S.btn} onClick={shareProfile}>
Share Profile
</button>
</div>

{/* Stats row like FetLife */}
<div style={S.statsWrap}>
<div
style={S.stat}
onClick={() => alert("Friends coming next.")}
title="Friends (coming soon)"
>
<div style={S.statNum}>{friendsCount}</div>
<div style={S.statLabel}>Friends</div>
</div>

<div style={{ ...S.stat, ...S.statMiddle }} onClick={() => openModal("followers")}>
<div style={S.statNum}>{followersCount}</div>
<div style={S.statLabel}>Followers</div>
</div>

<div style={S.stat} onClick={() => openModal("following")}>
<div style={S.statNum}>{followingCount}</div>
<div style={S.statLabel}>Following</div>
</div>
</div>
</div>

{/* Modal */}
{modalOpen && (
<div style={S.modalBackdrop} onClick={() => setModalOpen(false)}>
<div style={S.modal} onClick={(e) => e.stopPropagation()}>
<div style={S.modalHeader}>
<div style={S.modalTitle}>
{modalType === "followers" ? "Followers" : "Following"}
</div>
<button style={S.closeBtn} onClick={() => setModalOpen(false)}>
Close
</button>
</div>

{modalLoading ? (
<div style={{ padding: 18, textAlign: "center", color: "rgba(255,255,255,0.70)" }}>
Loading…
</div>
) : modalUsers.length === 0 ? (
<div style={{ padding: 18, textAlign: "center", color: "rgba(255,255,255,0.70)" }}>
No one yet.
</div>
) : (
<div style={S.list}>
{modalUsers.map((u) => {
const label = u.display_name || u.username || "User";
const href = u.username ? `/u/${u.username}` : `/profile`;

return (
<Link
key={u.id}
href={href}
style={S.userRow}
onClick={() => setModalOpen(false)}
>
<div style={S.userAvatar}>
{u.avatar_url ? (
// eslint-disable-next-line @next/next/no-img-element
<img
src={u.avatar_url}
alt=""
style={{ height: "100%", width: "100%", objectFit: "cover" }}
/>
) : (
<div
style={{
height: "100%",
width: "100%",
display: "flex",
alignItems: "center",
justifyContent: "center",
color: "rgba(255,255,255,0.35)",
fontWeight: 900,
fontSize: 12,
}}
>
—
</div>
)}
</div>

<div style={{ minWidth: 0 }}>
<div style={S.userName}>{label}</div>
{u.username ? <div style={S.userHandle}>@{u.username}</div> : null}
</div>
</Link>
);
})}
</div>
)}
</div>
</div>
)}
</div>
);
}