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
<h1 style={{ marginBottom: 8 }}>{data.display_name ?? "User"}</h1>
{data.bio ? <p style={{ opacity: 0.9 }}>{data.bio}</p> : null}

<div style={{ marginTop: 16 }}>
{/* ✅ THIS IS THE BUTTON */}
<Link href={`/messages?to=${data.id}`}>
<button
style={{
padding: "10px 14px",
borderRadius: 10,
border: "1px solid rgb(58, 2, 62)",
background: "rgba(95, 5, 143, 0.62)",
color: "white",
cursor: "pointer",
}}
>
Message
</button>
</Link>
</div>
</div>
);
}