export default function ExplorePage() {
return (
<div style={{ padding: 24 }}>
<h1 style={{ fontSize: 24, fontWeight: 700 }}>Explore</h1>

<p style={{ marginTop: 8, opacity: 0.85 }}>
Explore placeholder — we’ll wire real results + filters next.
</p>

<div
style={{
marginTop: 16,
display: "grid",
gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
gap: 12,
}}
>
{Array.from({ length: 12 }).map((_, i) => (
<div
key={i}
style={{
height: 160,
borderRadius: 16,
background: "rgba(0,0,0,0.35)",
border: "1px solid rgba(255,255,255,0.10)",
backdropFilter: "blur(10px)",
}}
/>
))}
</div>
</div>
);
}