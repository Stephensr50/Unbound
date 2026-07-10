"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

export default function HomeAuthRedirect() {
const router = useRouter();

useEffect(() => {
const supabase = createClient(
process.env.NEXT_PUBLIC_SUPABASE_URL!,
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

async function checkSession() {
const {
data: { session },
} = await supabase.auth.getSession();

if (!session?.user) return;

const queryString = window.location.search;

router.replace(queryString ? `/feed${queryString}` : "/feed");
}

void checkSession();
}, [router]);

return null;
}