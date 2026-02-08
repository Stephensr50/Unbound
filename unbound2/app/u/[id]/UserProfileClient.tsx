"use client";

import MessageButton from "@/app/components/MessageButton";

type ProfileRow = {
id: string;
username: string | null;
display_name: string | null;
bio: string | null;
avatar_url: string | null;
};

export default function UserProfileClient({ profile }: { profile: ProfileRow }) {
const card: React.CSSProperties = {
width: "min(920px, 94vw)",
margin: "22px auto 0",
padding: 18,
borderRadius: 18,
background: "rgba(0,0,0,0.45)",
border: "1px solid rgba(255,255,255,0.14)",
boxShadow: "0 0 22px rgba(170, 90, 255, 0.20)",
color: "white",
display: "flex",
gap: 16,
alignItems: "center",
};

const avatar: React.CSSProperties = {
width: 62,
height: 62,
borderRadius: 999,
objectFit: "cover",
border: "1px solid rgba(255,255,255,0.18)",
flex: "0 0 auto",
};

const msgBtn: React.CSSProperties = {
marginLeft: "auto",
padding: "10px 14px",
borderRadius: 12,
border: "none", // ← ADD THIS
color: "rgba(235, 215, 255, 0.98)",
textDecoration: "none",
background: "rgba(120, 60, 220, 0.22)",
boxShadow: "0 0 18px rgba(90, 156, 255, 0.22)",
whiteSpace: "nowrap",
cursor: "pointer",
fontWeight: 800,
};

const label = profile.display_name || profile.username || "Unknown";

return (
<div style={card}>
{profile.avatar_url ? (
<img src={profile.avatar_url} alt="" style={avatar} />
) : (
<div
style={{
...avatar,
display: "grid",
placeItems: "center",
opacity: 0.7,
}}
>
?
</div>
)}

<div style={{ minWidth: 0 }}>
<div style={{ fontSize: 28, fontWeight: 900 }}>{label}</div>
{profile.username ? (
<div style={{ opacity: 0.85, marginTop: 4 }}>@{profile.username}</div>
) : null}
{profile.bio ? (
<div style={{ opacity: 0.92, marginTop: 10 }}>{profile.bio}</div>
) : null}
</div>

<div style={msgBtn as React.CSSProperties}>
<MessageButton toUserId={profile.id} />
</div>
</div>
);
}