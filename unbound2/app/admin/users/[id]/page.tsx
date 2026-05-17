"use client";

import { useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
return createClient(url, key);
}

type ProfileRow = {
id: string;
username: string | null;
display_name: string | null;
moderation_status: string | null;
suspended_until: string | null;
moderation_note: string | null;
};

type DeviceSignalRow = {
id: number;
fingerprint: string;
user_agent: string | null;
timezone: string | null;
language: string | null;
created_at: string;
last_seen_at: string;
};

type LinkedAccountRow = {
id: string;
username: string | null;
display_name: string | null;
};

export default function AdminUserPage() {
const params = useParams();
const userId = String(params?.id ?? "");

const supabase = useMemo(() => getSupabase(), []);

const [profile, setProfile] = useState<ProfileRow | null>(null);
const [signals, setSignals] = useState<DeviceSignalRow[]>([]);
const [linkedAccounts, setLinkedAccounts] = useState<LinkedAccountRow[]>([]);
const [loading, setLoading] = useState(true);

useEffect(() => {
async function load() {
setLoading(true);

const { data: profileData } = await supabase
.from("profiles")
.select(`
id,
username,
display_name,
moderation_status,
suspended_until,
moderation_note,
device_fingerprint
`)
.eq("id", userId)
.maybeSingle();

setProfile(profileData ?? null);

if (profileData?.device_fingerprint) {
const { data: linked } = await supabase
.from("profiles")
.select("id, username, display_name, moderation_status")
.eq("device_fingerprint", profileData.device_fingerprint)
.neq("id", profileData.id)
.limit(25);

setLinkedAccounts(linked ?? []);
}

const { data: signalData } = await supabase
.from("user_device_signals")
.select("*")
.eq("user_id", userId)
.order("last_seen_at", { ascending: false });

const safeSignals = signalData ?? [];
setSignals(safeSignals);

const fingerprints = safeSignals.map((s) => s.fingerprint);

if (fingerprints.length > 0) {
const { data: matchingSignals } = await supabase
.from("user_device_signals")
.select("user_id,fingerprint")
.in("fingerprint", fingerprints);

const linkedIds = Array.from(
new Set(
(matchingSignals ?? [])
.map((x: any) => x.user_id)
.filter((id: string) => id !== userId)
)
);

if (linkedIds.length > 0) {
const { data: linkedProfiles } = await supabase
.from("profiles")
.select("id,username,display_name")
.in("id", linkedIds);

setLinkedAccounts(linkedProfiles ?? []);
}
}

setLoading(false);
}

if (userId) {
void load();
}
}, [supabase, userId]);

if (loading) {
return (
<div style={{ padding: 24, color: "white" }}>
Loading moderation profile...
</div>
);
}

return (
<div
style={{
maxWidth: 900,
margin: "0 auto",
padding: 24,
color: "white",
}}
>
<h1
style={{
fontSize: 36,
marginBottom: 20,
}}
>
Moderation Profile
</h1>

<div
style={{
padding: 20,
borderRadius: 18,
border: "1px solid rgba(255,255,255,0.12)",
background: "rgba(255,255,255,0.04)",
marginBottom: 28,
}}
>
<div><strong>User:</strong> {profile?.display_name ?? "Unknown"}</div>
<div><strong>@:</strong> {profile?.username ?? "unknown"}</div>
<div>
<strong>Status:</strong>{" "}
{profile?.moderation_status ?? "active"}
</div>

{profile?.suspended_until && (
<div>
<strong>Suspended Until:</strong>{" "}
{new Date(profile.suspended_until).toLocaleString()}
</div>
)}

{profile?.moderation_note && (
<div>
<strong>Moderator Note:</strong>{" "}
{profile.moderation_note}
</div>
)}
</div>

<h2 style={{ fontSize: 28, marginBottom: 16 }}>
Device Signals
</h2>

<div
style={{
display: "grid",
gap: 16,
marginBottom: 40,
}}
>
{signals.map((signal) => (
<div
key={signal.id}
style={{
padding: 18,
borderRadius: 16,
border: "1px solid rgba(168,85,247,0.22)",
background: "rgba(168,85,247,0.08)",
}}
>
<div>
<strong>Timezone:</strong> {signal.timezone ?? "Unknown"}
</div>

<div>
<strong>Language:</strong> {signal.language ?? "Unknown"}
</div>

<div>
<strong>User Agent:</strong>
</div>

<div
style={{
opacity: 0.7,
fontSize: 13,
wordBreak: "break-word",
marginTop: 4,
}}
>
{signal.user_agent}
</div>

<div style={{ marginTop: 12 }}>
<strong>Last Seen:</strong>{" "}
{new Date(signal.last_seen_at).toLocaleString()}
</div>
</div>
))}
</div>

<h2 style={{ fontSize: 28, marginBottom: 16 }}>
Potential Linked Accounts
</h2>

{linkedAccounts.length === 0 ? (
<div style={{ opacity: 0.7 }}>
No linked accounts detected.
</div>
) : (
<div
style={{
display: "grid",
gap: 16,
}}
>
{linkedAccounts.map((acct) => (
<div
key={acct.id}
style={{
padding: 18,
borderRadius: 16,
border: "1px solid rgba(255,80,80,0.3)",
background: "rgba(255,80,80,0.08)",
}}
>
<div>
<strong>Name:</strong>{" "}
{acct.display_name ?? "Unknown"}
</div>

<div>
<strong>Username:</strong>{" "}
@{acct.username ?? "unknown"}
</div>

<div
style={{
marginTop: 10,
}}
>
Possible shared device fingerprint detected.
</div>
</div>
))}
</div>
)}
</div>
);
}