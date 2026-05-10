export default function BannedPage() {
return (
<div
style={{
minHeight: "100vh",
display: "grid",
placeItems: "center",
padding: 24,
color: "white",
}}
>
<div
style={{
width: "min(620px, 94vw)",
padding: 28,
borderRadius: 24,
background: "rgba(0,0,0,0.72)",
border: "1px solid rgba(255,80,80,0.45)",
boxShadow: "0 0 35px rgba(255,80,80,0.22)",
}}
>
<h1 style={{ marginTop: 0, color: "rgba(255,180,180,0.98)" }}>
Account banned
</h1>

<p style={{ lineHeight: 1.6, opacity: 0.9 }}>
This account has been banned from Unbound. Access to posting,
messaging, stories, and other community features has been restricted.
</p>
</div>
</div>
);
}