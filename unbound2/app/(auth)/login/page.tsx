export default function LoginPage() {
return (
<div
style={{
width: 380,
padding: 24,
borderRadius: 12,
background: "rgba(0,0,0,0.75)",
backdropFilter: "blur(12px)",
border: "1px solid rgba(255,255,255,0.1)",
}}
>
<h1 style={{ marginBottom: 16 }}>Log in to Unbound</h1>

<input
placeholder="Email"
style={inputStyle}
/>

<input
placeholder="Password"
type="password"
style={inputStyle}
/>

<button style={buttonStyle}>
Log In
</button>

<p style={{ marginTop: 12, opacity: 0.7 }}>
Don’t have an account?{" "}
<a href="/signup">Sign up</a>
</p>
</div>
);
}

const inputStyle: React.CSSProperties = {
width: "100%",
padding: 12,
marginBottom: 12,
borderRadius: 8,
border: "1px solid rgba(255,255,255,0.15)",
background: "rgba(0,0,0,0.6)",
color: "#fff",
};

const buttonStyle: React.CSSProperties = {
width: "100%",
padding: 12,
borderRadius: 8,
background: "#fff",
color: "#000",
fontWeight: 600,
cursor: "pointer",
};