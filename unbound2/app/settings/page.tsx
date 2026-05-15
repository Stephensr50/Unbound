import Link from "next/link";

export default function SettingsPage() {
return (
<main
style={{
minHeight: "100vh",
padding: "160px 24px 60px",
color: "white",
}}
>
<section
style={{
maxWidth: 760,
margin: "0 auto",
padding: 24,
borderRadius: 24,
background: "rgba(0,0,0,0.58)",
border: "1px solid rgba(168,85,247,0.28)",
boxShadow: "0 0 36px rgba(168,85,247,0.18)",
backdropFilter: "blur(14px)",
}}
>
<h1
style={{
fontFamily: '"Gloock", serif',
fontSize: 42,
margin: 0,
}}
>
Settings
</h1>

<p style={{ opacity: 0.75, marginTop: 8 }}>
Manage your account, safety, privacy, and Unbound preferences.
</p>

<div style={{ display: "grid", gap: 14, marginTop: 28 }}>
<Link href="/profile" style={cardStyle}>
Account & Profile
</Link>

<Link href="/settings/blocked" style={cardStyle}>
Blocked Users
</Link>

<div style={cardStyle}>Privacy & Safety — coming soon</div>

<div style={cardStyle}>Notifications — coming soon</div>

<div style={cardStyle}>Appearance — coming soon</div>

<Link
href="/settings/delete-account"
style={{
display: "block",
padding: "16px 18px",
borderRadius: 18,
background: "rgba(120,0,0,0.22)",
border: "1px solid rgba(255,80,80,0.28)",
color: "rgba(255,180,180,0.95)",
textDecoration: "none",
fontWeight: 800,
marginTop: 12,
textAlign: "center",
boxShadow: "0 0 22px rgba(255,0,0,0.12)",
}}
>
Delete Account
</Link>
</div>
</section>
</main>
);
}

const cardStyle: React.CSSProperties = {
display: "block",
padding: "16px 18px",
borderRadius: 18,
background: "rgba(255,255,255,0.055)",
border: "1px solid rgba(255,255,255,0.1)",
color: "white",
textDecoration: "none",
fontWeight: 800,
};