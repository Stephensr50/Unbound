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
city?: string | null;
state?: string | null;
last_active_at?: string | null;
};

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
return createClient(url, key);
}

export default function FeaturedProfileCard() {
const supabase = useMemo(() => getSupabase(), []);
const [profile, setProfile] = useState<ProfileRow | null>(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
let alive = true;

async function loadFeaturedProfile() {
setLoading(true);

const {
data: { user },
} = await supabase.auth.getUser();

let query = supabase
.from("profiles")
.select(
"id, username, display_name, avatar_url, bio, moderation_status"
)
.eq("moderation_status", "active");
if (user?.id) {
query = query.neq("id", user.id);
}

const { data, error } = await query;

if (!alive) return;

if (error || !data || data.length === 0) {
setProfile(null);
setLoading(false);
return;
}

const picked = data[Math.floor(Math.random() * data.length)];
setProfile(picked);
setLoading(false);
}

loadFeaturedProfile();

return () => {
alive = false;
};
}, [supabase]);

if (loading) {
return (
<div style={cardStyle}>
<div style={eyebrowStyle}>Crush of the Day</div>
<div style={{ opacity: 0.7, fontSize: 13 }}>Finding someone worth noticing...</div>
</div>
);
}

if (!profile) {
return null;
}

const name = profile.display_name || profile.username || "Unbound member";
const username = profile.username ? `@${profile.username}` : "";
const location =
profile.city && profile.state
? `${profile.city}, ${profile.state}`
: profile.city || profile.state || "";

return (
<div style={cardStyle}>
<div style={eyebrowStyle}>Crush of the Day ✨</div>

<div style={{ display: "flex", gap: 12, alignItems: "center" }}>
<div style={avatarWrapStyle}>
{profile.avatar_url ? (
<img
src={profile.avatar_url}
alt={name}
style={{
width: "100%",
height: "100%",
objectFit: "cover",
borderRadius: "50%",
}}
/>
) : (
<div style={avatarFallbackStyle}>{name.slice(0, 1).toUpperCase()}</div>
)}
</div>

<div style={{ minWidth: 0 }}>
<div style={nameStyle}>{name}</div>
{username && <div style={usernameStyle}>{username}</div>}
{location && <div style={locationStyle}>{location}</div>}
</div>
</div>

{profile.bio && (
<p style={bioStyle}>
{profile.bio.length > 90 ? `${profile.bio.slice(0, 90)}...` : profile.bio}
</p>
)}

<Link href={`/u/${profile.id}`} style={buttonStyle}>
View Profile
</Link>
</div>
);
}

const cardStyle: React.CSSProperties = {
width: "100%",
borderRadius: 22,
padding: 16,
background:
"linear-gradient(180deg, rgba(45, 18, 70, 0.72), rgba(10, 8, 16, 0.88))",
border: "1px solid rgba(214, 160, 255, 0.22)",
boxShadow: "0 0 32px rgba(170, 80, 255, 0.16)",
color: "white",
backdropFilter: "blur(14px)",
};

const eyebrowStyle: React.CSSProperties = {
fontSize: 12,
textTransform: "uppercase",
letterSpacing: "0.12em",
color: "rgba(236, 196, 255, 0.9)",
marginBottom: 12,
fontWeight: 800,
};

const avatarWrapStyle: React.CSSProperties = {
width: 64,
height: 64,
borderRadius: "50%",
padding: 3,
background: "linear-gradient(135deg, #ff4fd8, #9b5cff, #6ee7ff)",
boxShadow: "0 0 24px rgba(190, 95, 255, 0.45)",
flexShrink: 0,
};

const avatarFallbackStyle: React.CSSProperties = {
width: "100%",
height: "100%",
borderRadius: "50%",
background: "rgba(255,255,255,0.08)",
display: "flex",
alignItems: "center",
justifyContent: "center",
fontWeight: 900,
fontSize: 24,
};

const nameStyle: React.CSSProperties = {
fontWeight: 900,
fontSize: 16,
overflow: "hidden",
whiteSpace: "nowrap",
textOverflow: "ellipsis",
};

const usernameStyle: React.CSSProperties = {
fontSize: 13,
color: "rgba(255,255,255,0.68)",
marginTop: 2,
};

const locationStyle: React.CSSProperties = {
fontSize: 12,
color: "rgba(255,255,255,0.52)",
marginTop: 2,
};

const bioStyle: React.CSSProperties = {
fontSize: 13,
lineHeight: 1.45,
color: "rgba(255,255,255,0.72)",
margin: "14px 0",
};

const buttonStyle: React.CSSProperties = {
display: "block",
width: "100%",
textAlign: "center",
textDecoration: "none",
color: "white",
fontWeight: 900,
fontSize: 13,
padding: "10px 12px",
borderRadius: 999,
background: "linear-gradient(135deg, #ff4fd8, #8b5cf6)",
boxShadow: "0 0 20px rgba(180, 90, 255, 0.35)",
};