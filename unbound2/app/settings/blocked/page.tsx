"use client";

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { useRouter } from "next/navigation";

type BlockRow = {
id: number;
blocker_id: string;
blocked_id: string;
created_at: string;
};

type ProfileRow = {
id: string;
username: string | null;
display_name: string | null;
avatar_url: string | null;
};

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
return createClient(url, key);
}

export default function BlockedUsersPage() {
const supabase = useMemo(() => getSupabase(), []);
const router = useRouter();

const [me, setMe] = useState<string | null>(null);
const [blocks, setBlocks] = useState<BlockRow[]>([]);
const [profilesById, setProfilesById] = useState<Record<string, ProfileRow>>({});
const [loading, setLoading] = useState(true);
const [busyId, setBusyId] = useState<string | null>(null);
const [banner, setBanner] = useState<string | null>(null);

const [confirmOpen, setConfirmOpen] = useState(false);
const [pendingUnblockId, setPendingUnblockId] = useState<string | null>(null);

async function loadBlockedUsers() {
setLoading(true);
setBanner(null);

const { data: sessionData } = await supabase.auth.getSession();
const uid = sessionData.session?.user?.id ?? null;
setMe(uid);

if (!uid) {
setBlocks([]);
setProfilesById({});
setLoading(false);
return;
}

const { data: blockRows, error: blockErr } = await supabase
.from("blocked_users")
.select("id,blocker_id,blocked_id,created_at")
.eq("blocker_id", uid)
.order("created_at", { ascending: false });

if (blockErr) {
setBanner(blockErr.message);
setLoading(false);
return;
}

const rows = (blockRows ?? []) as BlockRow[];
setBlocks(rows);

const blockedIds = rows.map((r) => r.blocked_id).filter(Boolean);

if (!blockedIds.length) {
setProfilesById({});
setLoading(false);
return;
}

const { data: profiles, error: profileErr } = await supabase
.from("profiles")
.select("id,username,display_name,avatar_url")
.in("id", blockedIds);

if (profileErr) {
setBanner(profileErr.message);
setLoading(false);
return;
}

const map: Record<string, ProfileRow> = {};
for (const p of (profiles ?? []) as ProfileRow[]) {
map[p.id] = p;
}

setProfilesById(map);
setLoading(false);
}

function askUnblock(blockedId: string) {
setPendingUnblockId(blockedId);
setConfirmOpen(true);
}

async function unblockUser(blockedId: string) {
if (!me) return;

setBusyId(blockedId);
setBanner(null);

const { error } = await supabase
.from("blocked_users")
.delete()
.eq("blocker_id", me)
.eq("blocked_id", blockedId);

if (error) {
setBanner(error.message);
setBusyId(null);
return;
}

setBlocks((prev) => prev.filter((b) => b.blocked_id !== blockedId));
setBusyId(null);
setBanner("User unblocked.");
}

async function confirmUnblock() {
if (!pendingUnblockId) return;

const id = pendingUnblockId;
setConfirmOpen(false);
setPendingUnblockId(null);

await unblockUser(id);
}

useEffect(() => {
void loadBlockedUsers();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

const pendingProfile = pendingUnblockId
? profilesById[pendingUnblockId]
: null;

const pendingLabel =
pendingProfile?.display_name || pendingProfile?.username || "this user";

return (
<div
style={{
width: "min(920px, 94vw)",
margin: "30px auto",
color: "white",
}}
>
<button
onClick={() => router.back()}
style={{
marginBottom: 18,
padding: "8px 14px",
borderRadius: 999,
border: "1px solid rgba(168,85,247,0.35)",
background: "rgba(0,0,0,0.45)",
color: "white",
cursor: "pointer",
fontWeight: 800,
}}
>
← Back
</button>

<h1
style={{
fontSize: 42,
margin: "0 0 8px",
color: "rgba(236,72,153,0.95)",
textShadow: "0 0 18px rgba(168,85,247,0.55)",
fontFamily: '"Gloock", serif',
}}
>
Blocked Users
</h1>

<div style={{ opacity: 0.75, marginBottom: 18 }}>
Manage people you’ve blocked on Unbound.
</div>

{banner ? (
<div
style={{
marginBottom: 14,
padding: 12,
borderRadius: 14,
background: "rgba(120,0,0,0.35)",
border: "1px solid rgba(255,80,80,0.35)",
color: "rgba(255,220,220,0.95)",
}}
>
{banner}
</div>
) : null}

<div
style={{
background: "rgba(0,0,0,0.55)",
border: "1px solid rgba(168,85,247,0.28)",
borderRadius: 20,
padding: 16,
boxShadow: "0 0 24px rgba(168,85,247,0.18)",
}}
>
{loading ? (
<div style={{ opacity: 0.75 }}>Loading blocked users…</div>
) : !me ? (
<div style={{ opacity: 0.75 }}>Please sign in to manage blocked users.</div>
) : blocks.length === 0 ? (
<div style={{ opacity: 0.75 }}>You haven’t blocked anyone.</div>
) : (
<div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
{blocks.map((block) => {
const p = profilesById[block.blocked_id];
const label = p?.display_name || p?.username || "Blocked user";
const handle = p?.username ? `@${p.username}` : "";

return (
<div
key={block.id}
style={{
display: "flex",
alignItems: "center",
gap: 12,
padding: 12,
borderRadius: 16,
background: "rgba(255,255,255,0.04)",
border: "1px solid rgba(255,255,255,0.08)",
}}
>
{p?.avatar_url ? (
// eslint-disable-next-line @next/next/no-img-element
<img
src={p.avatar_url}
alt=""
style={{
width: 52,
height: 52,
borderRadius: 999,
objectFit: "cover",
border: "1px solid rgba(236,72,153,0.28)",
}}
/>
) : (
<div
style={{
width: 52,
height: 52,
borderRadius: 999,
display: "grid",
placeItems: "center",
background: "rgba(168,85,247,0.18)",
border: "1px solid rgba(236,72,153,0.28)",
fontWeight: 900,
}}
>
{label.trim().charAt(0).toUpperCase()}
</div>
)}

<div style={{ flex: 1, minWidth: 0 }}>
<div style={{ fontWeight: 900 }}>{label}</div>
<div style={{ opacity: 0.65, fontSize: 13 }}>{handle}</div>
<div style={{ opacity: 0.45, fontSize: 12, marginTop: 4 }}>
Blocked {new Date(block.created_at).toLocaleDateString()}
</div>
</div>

<button
onClick={() => askUnblock(block.blocked_id)}
disabled={busyId === block.blocked_id}
style={{
padding: "9px 14px",
borderRadius: 999,
border: "1px solid rgba(168,85,247,0.35)",
background: "rgba(168,85,247,0.18)",
color: "white",
cursor: busyId === block.blocked_id ? "not-allowed" : "pointer",
fontWeight: 900,
opacity: busyId === block.blocked_id ? 0.65 : 1,
}}
>
{busyId === block.blocked_id ? "..." : "Unblock"}
</button>
</div>
);
})}
</div>
)}
</div>

{confirmOpen ? (
<div
onClick={() => {
if (busyId) return;
setConfirmOpen(false);
setPendingUnblockId(null);
}}
style={{
position: "fixed",
inset: 0,
zIndex: 9999,
display: "grid",
placeItems: "center",
padding: 18,
background: "rgba(0,0,0,0.68)",
backdropFilter: "blur(8px)",
}}
>
<div
onClick={(e) => e.stopPropagation()}
style={{
width: "min(440px, 94vw)",
borderRadius: 22,
padding: 18,
background:
"linear-gradient(180deg, rgba(30,0,45,0.96), rgba(0,0,0,0.92))",
border: "1px solid rgba(236,72,153,0.34)",
boxShadow:
"0 0 28px rgba(168,85,247,0.42), 0 0 80px rgba(236,72,153,0.18)",
color: "white",
}}
>
<div
style={{
fontFamily: '"Gloock", serif',
fontSize: 28,
color: "rgba(236,72,153,0.96)",
textShadow: "0 0 16px rgba(168,85,247,0.55)",
marginBottom: 8,
}}
>
Unblock user?
</div>

<div style={{ opacity: 0.82, lineHeight: 1.45, marginBottom: 16 }}>
Are you sure you want to unblock{" "}
<b style={{ color: "white" }}>{pendingLabel}</b>? They may be able
to see your public activity again.
</div>

<div
style={{
display: "flex",
justifyContent: "flex-end",
gap: 10,
flexWrap: "wrap",
}}
>
<button
type="button"
onClick={() => {
setConfirmOpen(false);
setPendingUnblockId(null);
}}
style={{
padding: "10px 14px",
borderRadius: 999,
border: "1px solid rgba(255,255,255,0.14)",
background: "rgba(255,255,255,0.06)",
color: "white",
cursor: "pointer",
fontWeight: 900,
}}
>
Cancel
</button>

<button
type="button"
onClick={confirmUnblock}
disabled={!pendingUnblockId || !!busyId}
style={{
padding: "10px 14px",
borderRadius: 999,
border: "1px solid rgba(236,72,153,0.45)",
background: "linear-gradient(90deg,#7c3aed,#ec4899)",
color: "white",
cursor: !pendingUnblockId || busyId ? "not-allowed" : "pointer",
fontWeight: 950,
boxShadow: "0 0 18px rgba(168,85,247,0.55)",
opacity: !pendingUnblockId || busyId ? 0.6 : 1,
}}
>
Yes, unblock
</button>
</div>
</div>
</div>
) : null}
</div>
);
}