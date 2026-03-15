"use client";

export default function NearbyRadar() {
return (
<div style={wrapper}>
<div style={ring} />
<div style={{ ...ring, width: 220, height: 220 }} />
<div style={{ ...ring, width: 150, height: 150 }} />

<div style={beam} />

<div style={dotMain} />
<div style={dotSmall} />

<div style={label}>Scanning nearby…</div>
</div>
);
}

const wrapper: React.CSSProperties = {
position: "relative",
width: 280,
height: 280,
margin: "40px auto",
borderRadius: "50%",
};

const ring: React.CSSProperties = {
position: "absolute",
top: "50%",
left: "50%",
transform: "translate(-50%, -50%)",
width: 280,
height: 280,
borderRadius: "50%",
border: "1px solid rgba(180,120,255,0.25)",
};

const beam: React.CSSProperties = {
position: "absolute",
top: "50%",
left: "50%",
width: 140,
height: 140,
transformOrigin: "0% 0%",
background:
"conic-gradient(from 0deg, rgba(200,100,255,0.6), rgba(200,100,255,0.05))",
borderRadius: "0 100% 0 0",
animation: "spin 1.6s linear infinite",
};

const dotMain: React.CSSProperties = {
position: "absolute",
top: "45%",
left: "55%",
width: 14,
height: 14,
borderRadius: "50%",
background: "#d28cff",
boxShadow: "0 0 12px rgba(210,140,255,0.9)",
};

const dotSmall: React.CSSProperties = {
position: "absolute",
top: "65%",
left: "62%",
width: 8,
height: 8,
borderRadius: "50%",
background: "#d28cff",
boxShadow: "0 0 8px rgba(210,140,255,0.9)",
};

const label: React.CSSProperties = {
position: "absolute",
bottom: -40,
width: "100%",
textAlign: "center",
opacity: 0.85,
fontWeight: 600,
};