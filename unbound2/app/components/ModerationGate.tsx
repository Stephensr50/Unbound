"use client";

import { useEffect, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
return createClient(url, key);
}

export default function ModerationGate() {
const supabase = useMemo(() => getSupabase(), []);
const router = useRouter();
const pathname = usePathname();

useEffect(() => {
async function checkStatus() {
if (pathname === "/banned" || pathname === "/suspended") return;
if (pathname?.startsWith("/admin")) return;

const { data: authData } = await supabase.auth.getUser();
const user = authData?.user;
if (!user) return;

const { data: profile } = await supabase
.from("profiles")
.select("moderation_status,suspended_until")
.eq("id", user.id)
.maybeSingle();

if (profile?.moderation_status === "banned") {
router.replace("/banned");
return;
}

const suspendedUntil = profile?.suspended_until
? new Date(profile.suspended_until)
: null;

if (
profile?.moderation_status === "suspended" &&
suspendedUntil &&
suspendedUntil.getTime() > Date.now()
) {
router.replace("/suspended");
}
}

void checkStatus();
}, [pathname, router, supabase]);

return null;
}