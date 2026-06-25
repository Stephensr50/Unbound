"use client";

import Link from "next/link";

export default function CreatePage() {
return (
<main style={{ minHeight: "100vh", color: "white", padding: 24 }}>
<h1 style={{ fontSize: 42, marginBottom: 20 }}>Create</h1>

<p style={{ opacity: 0.8, marginBottom: 24 }}>
Choose what you want to create.
</p>

<div style={{ display: "grid", gap: 14, maxWidth: 420 }}>
<Link href="/feed" style={buttonStyle}>
Create Feed Post
</Link>

<Link href="/feed" style={buttonStyle}>
Create Reel
</Link>

<Link href="/stories/create" style={buttonStyle}>
Create Story
</Link>
</div>
</main>
);
}

const buttonStyle: React.CSSProperties = {
display: "block",
padding: "16px 18px",
borderRadius: 18,
background: "rgba(255,79,216,.16)",
border: "1px solid rgba(255,79,216,.45)",
color: "white",
textDecoration: "none",
fontSize: 18,
fontWeight: 700,
};