import { createClient } from "@supabase/supabase-js";
import UserProfileClient from "./UserProfileClient";

export const dynamic = "force-dynamic";

type ProfileRow = {
id: string;
username: string | null;
display_name: string | null;
bio: string | null;
avatar_url: string | null;
};

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !key) {
throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

return createClient(url, key);
}

export default async function PublicProfilePage({
params,
}: {
params: Promise<{ id: string }>;
}) {
const { id } = await params; // ✅ unwrap the Promise in your Next version
const routeId = (id ?? "").toString();

const supabase = getSupabase();

// If routeId looks like a UUID, fetch by id. Otherwise treat as username.
const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(routeId);

const query = supabase
.from("profiles")
.select("id, username, display_name, bio, avatar_url")
.limit(1);

const { data, error } = isUuid
? await query.eq("id", routeId).maybeSingle()
: await query.eq("username", routeId).maybeSingle();

if (error) {
return (
<div style={{ width: "min(920px, 94vw)", margin: "30px auto", color: "white" }}>
<h1 style={{ fontSize: 34, marginBottom: 10 }}>Profile not found.</h1>
<div style={{ opacity: 0.85 }}>Supabase error: {error.message}</div>
</div>
);
}

if (!data) {
return (
<div style={{ width: "min(920px, 94vw)", margin: "30px auto", color: "white" }}>
<h1 style={{ fontSize: 34, marginBottom: 10 }}>Profile not found.</h1>
<div style={{ opacity: 0.85 }}>No profile matched: {routeId}</div>
</div>
);
}

return <UserProfileClient profile={data as ProfileRow} />;
}