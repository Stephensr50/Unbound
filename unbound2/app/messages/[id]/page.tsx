import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type ProfileRow = {
id: string;
username: string | null;
display_name: string | null;
avatar_url: string | null;
bio: string | null;
location: string | null;
};

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) throw new Error("Missing Supabase env vars.");
return createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true } });
}

export default async function UserProfilePage({
params,
}: {
params: { id: string };
}) {
const supabase = getSupabase();

const { data, error } = await supabase
.from("profiles")
.select("id, username, display_name, avatar_url, bio, location")
.eq("id", params.id)
.single();

if (error || !data) {
return (
<div className="unbound-bg" style={{ minHeight: "100vh", padding: 24 }}>
<div style={{ maxWidth: 980, margin: "0 auto", opacity: 0.9 }}>
Profile not found.
</div>
</div>
);
}

const p = data as ProfileRow;
const name = p.display_name || p.username || "User";

return (
<div className="unbound-bg" style={{ minHeight: "100vh", padding: "24px 16px" }}>
<div style={{ maxWidth: 980, margin: "0 auto" }}>
<div
style={{
borderRadius: 22,
border: "1px solid rgba(255,255,255,0.10)",
background: "rgba(0,0,0,0.45)",
backdropFilter: "blur(10px)",
padding: 18,
display: "flex",
gap: 18,
alignItems: "center",
}}
>
<div
style={{
width: 92,
height: 92,
borderRadius: 999,
overflow: "hidden",
border: "1px solid rgba(255,255,255,0.14)",
background: "rgba(255,255,255,0.06)",
flex: "0 0 auto",
}}
>
{/* avatar (optional) */}
{p.avatar_url ? (
// eslint-disable-next-line @next/next/no-img-element
<img
src={p.avatar_url}
alt={name}
style={{ width: "100%", height: "100%", objectFit: "cover" }}
/>
) : null}
</div>

<div style={{ flex: 1, minWidth: 0 }}>
<div style={{ fontSize: 34, fontWeight: 700 }}>{name}</div>
{p.username ? (
<div style={{ opacity: 0.8, marginTop: 4 }}>@{p.username}</div>
) : null}
{p.location ? (
<div style={{ opacity: 0.75, marginTop: 6 }}>{p.location}</div>
) : null}
{p.bio ? (
<div style={{ opacity: 0.9, marginTop: 10 }}>{p.bio}</div>
) : null}

<div style={{ marginTop: 14, display: "flex", gap: 10 }}>
<a
href={`/messages/${p.id}`}
style={{
display: "inline-flex",
alignItems: "center",
justifyContent: "center",
padding: "10px 16px",
borderRadius: 16,
border: "1px solid rgba(196,146,255,0.35)",
background: "rgba(168, 85, 247, 0.22)",
color: "rgba(255,255,255,0.92)",
textDecoration: "none",
}}
>
Message
</a>
</div>
</div>
</div>
</div>
</div>
);
}