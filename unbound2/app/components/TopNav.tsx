"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function TopNav() {
const pathname = usePathname();

const linkStyle = (href: string) => ({
textDecoration: "none",
color: "white",
opacity: pathname === href ? 1 : 0.7,
fontWeight: pathname === href ? 700 : 500,
});

return (
<div
style={{
position: "sticky",
top: 0,
zIndex: 50,
padding: "14px 0",
}}
>
<div
style={{
width: "min(1100px, calc(100% - 32px))",
margin: "0 auto",
}}
>
<div
style={{
display: "flex",
alignItems: "center",
justifyContent: "space-between",
gap: 14,
padding: "12px 14px",
borderRadius: 16,
background: "rgba(18, 18, 24, 0.70)",
border: "1px solid rgba(255, 255, 255, 0.08)",
backdropFilter: "blur(16px)",
WebkitBackdropFilter: "blur(16px)",
boxShadow: "0 12px 40px rgba(0,0,0,0.45)",
}}
>
<Link href="/feed" style={{ textDecoration: "none", color: "white", fontWeight: 900 }}>
UNBOUND
</Link>

<div style={{ display: "flex", gap: 12, alignItems: "center" }}>
<Link href="/feed" style={linkStyle("/feed")}>
Feed
</Link>
<Link href="/profile" style={linkStyle("/profile")}>
Profile
</Link>
</div>

<input
placeholder="Search"
style={{
width: 260,
maxWidth: "40vw",
padding: "10px 12px",
borderRadius: 12,
background: "rgba(255,255,255,0.06)",
border: "1px solid rgba(255,255,255,0.10)",
color: "white",
outline: "none",
}}
/>
</div>
</div>
</div>
);
}