export default function EditProfilePage() {
return (
<div style={{ maxWidth: 720, margin: "0 auto", padding: 16 }}>
<h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 12 }}>
Edit Profile
</h1>

<div
style={{
background: "rgba(0,0,0,0.55)",
border: "1px solid rgba(255,255,255,0.10)",
borderRadius: 14,
padding: 16,
backdropFilter: "blur(10px)",
WebkitBackdropFilter: "blur(10px)",
}}
>
<label style={{ display: "block", marginBottom: 10 }}>
<div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
Display name
</div>
<input
placeholder="Your name"
style={{
width: "100%",
padding: "10px 12px",
borderRadius: 10,
border: "1px solid rgba(255,255,255,0.15)",
background: "rgba(0,0,0,0.35)",
color: "white",
outline: "none",
}}
/>
</label>

<label style={{ display: "block", marginBottom: 12 }}>
<div style={{ fontSize: 12, opacity: 0.8, marginBottom: 6 }}>
Bio
</div>
<textarea
placeholder="A little about you..."
rows={4}
style={{
width: "100%",
padding: "10px 12px",
borderRadius: 10,
border: "1px solid rgba(255,255,255,0.15)",
background: "rgba(0,0,0,0.35)",
color: "white",
outline: "none",
resize: "vertical",
}}
/>
</label>

<button
type="button"
style={{
width: "100%",
padding: "12px 14px",
borderRadius: 12,
border: "1px solid rgba(255,255,255,0.15)",
background: "rgba(255,255,255,0.10)",
color: "white",
fontWeight: 700,
cursor: "pointer",
}}
>
Save (placeholder)
</button>
</div>
</div>
);
}