export default function NotificationsPage() {
return (
<main style={{ padding: "22px 16px", maxWidth: 900, margin: "0 auto" }}>
<h1 style={{ fontSize: 22, marginBottom: 10 }}>Notifications</h1>

<div
style={{
border: "1px solid rgba(255,255,255,0.12)",
borderRadius: 14,
padding: 14,
background: "rgba(0,0,0,0.35)",
}}
>
<div style={{ opacity: 0.8, marginBottom: 10 }}>
This is the notifications hub.
</div>

{/* Placeholder items for now */}
<div style={itemStyle}>
<div style={titleStyle}>Friend request</div>
<div style={metaStyle}>Jazzy sent you a friend request</div>
</div>

<div style={itemStyle}>
<div style={titleStyle}>Spank</div>
<div style={metaStyle}>Ladybug spanked your photo</div>
</div>

<div style={itemStyle}>
<div style={titleStyle}>Comment</div>
<div style={metaStyle}>Holden C commented on your post</div>
</div>
</div>
</main>
);
}

const itemStyle: React.CSSProperties = {
padding: "12px 12px",
borderRadius: 12,
border: "1px solid rgba(255,255,255,0.10)",
background: "rgba(0,0,0,0.25)",
marginTop: 10,
};

const titleStyle: React.CSSProperties = {
fontWeight: 700,
marginBottom: 4,
};

const metaStyle: React.CSSProperties = {
opacity: 0.85,
fontSize: 14,
};