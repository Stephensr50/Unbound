import Link from "next/link";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

type Props = {
params: Promise<{ id: string }>;
};

export default async function PublicProfilePage({ params }: Props) {
const { id } = await params; // ✅ fixes “params is a Promise” in Next 16

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(url, key);

const { data, error } = await supabase
.from("profiles")
.select("id, display_name, bio")
.eq("id", id)
.single();

if (error || !data) {
return (
<div style={{ padding: 24 }}>
<h1>Profile not found</h1>
</div>
);
}

return (
<div style={{ padding: 24 }}>
{/* ✅ Pulse CSS lives INSIDE this TSX (no globals.css needed) */}
<style>{`
@keyframes unboundPulse {
0% {
box-shadow:
0 0 0 1px rgba(168,85,247,0.25),
0 8px 22px rgba(168,85,247,0.45),
0 0 32px rgba(217,70,239,0.35);
}
50% {
box-shadow:
0 0 0 1px rgba(168,85,247,0.45),
0 14px 34px rgba(217,70,239,0.85),
0 0 44px rgba(217,70,239,0.65);
}
100% {
box-shadow:
0 0 0 1px rgba(168,85,247,0.25),
0 8px 22px rgba(168,85,247,0.45),
0 0 32px rgba(217,70,239,0.35);
}
}

.unboundPulse {
animation: unboundPulse 1.6s ease-in-out infinite;
}

/* Optional: respect Reduce Motion if enabled */
@media (prefers-reduced-motion: reduce) {
.unboundPulse { animation: none; }
}
`}</style>

<h1 style={{ marginBottom: 8 }}>{data.display_name ?? "User"}</h1>
{data.bio ? <p style={{ opacity: 0.9 }}>{data.bio}</p> : null}

<div style={{ marginTop: 16 }}>
{/* ✅ THIS IS THE BUTTON */}
<Link href={`/messages?to=${data.id}`}>
<button
className="unboundPulse"
style={{
padding: "10px 16px",
borderRadius: 12,
border: "1px solid rgba(64, 7, 118, 0.55)",
background:
"linear-gradient(180deg, rgba(168,85,247,0.9), rgba(147,51,234,0.85))",
color: "purple",
cursor: "pointer",
fontWeight: 600,
letterSpacing: "0.3px",
boxShadow: `
0 0 0 1px rgba(168,85,247,0.25),
0 8px 22px rgba(168,85,247,0.45),
0 0 32px rgba(217,70,239,0.35)
`,
}}
>
Message
</button>
</Link>
</div>
</div>
);
}