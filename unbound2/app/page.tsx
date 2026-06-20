import { redirect } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

export default async function Home({
searchParams,
}: {
searchParams?: Record<string, string | string[] | undefined>;
}) {
const qs = searchParams
? new URLSearchParams(
Object.entries(searchParams).flatMap(([k, v]) =>
v == null ? [] : Array.isArray(v) ? v.map((vv) => [k, vv]) : [[k, v]]
)
).toString()
: "";

const supabase = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const {
data: { user },
} = await supabase.auth.getUser();

if (user) {
redirect(qs ? `/feed?${qs}` : "/feed");
}

redirect(qs ? `/login?${qs}` : "/login");
}