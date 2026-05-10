export default function SuspendedPage() {
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
border: "1px solid rgba(251,146,60,0.45)",
boxShadow: "0 0 35px rgba(251,146,60,0.22)",
}}
>
<h1 style={{ marginTop: 0, color: "rgba(255,220,180,0.98)" }}>
Account suspended
</h1>

<p style={{ lineHeight: 1.6, opacity: 0.9 }}>
This account is temporarily suspended. You may not post, comment,
message, follow users, or upload stories until the suspension expires.
</p>
</div>
</div>
);
}