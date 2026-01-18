

export default function ProfilePage() {
return (
<>


<div
style={{
width: "min(1100px, calc(100% - 32px))",
margin: "0 auto",
paddingTop: 20,
}}
>
<div
style={{
padding: 20,
borderRadius: 16,
background: "rgba(18, 18, 24, 0.70)",
border: "1px solid rgba(255, 255, 255, 0.08)",
backdropFilter: "blur(16px)",
}}
>
<h1 style={{ margin: 0, fontSize: 26, fontWeight: 800 }}>Your Profile</h1>
<p style={{ marginTop: 10, opacity: 0.75 }}>
Profile placeholder (we’ll wire Supabase data next).
</p>
</div>
</div>
</>
);
}