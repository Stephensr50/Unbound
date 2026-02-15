"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

type NotifRow = {
id: number;
user_id: string;
read_at: string | null;
};

function getSupabase(): SupabaseClient {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
return createClient(url, key);
}

export function useUnreadNotifications() {
const supabase = useMemo(() => getSupabase(), []);
const [notifUnread, setNotifUnread] = useState(0);
const [myUserId, setMyUserId] = useState<string | null>(null);

const inFlight = useRef(false);

async function refreshNotifs() {
if (inFlight.current) return;
inFlight.current = true;

try {
const { data } = await supabase.auth.getSession();
const uid = data.session?.user?.id ?? null;
setMyUserId(uid);

if (!uid) {
setNotifUnread(0);
return;
}

const { data: rows, error } = await supabase
.from("notifications")
.select("id,user_id,read_at")
.eq("user_id", uid)
.is("read_at", null);

if (error) throw error;
setNotifUnread((rows as NotifRow[] | null)?.length ?? 0);
} finally {
inFlight.current = false;
}
}

// initial load
useEffect(() => {
refreshNotifs();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

// realtime: listen for inserts/updates/deletes for *my* notifications
useEffect(() => {
if (!myUserId) return;

const ch = supabase
.channel("notifications-badge")
.on(
"postgres_changes",
{
event: "*",
schema: "public",
table: "notifications",
filter: `user_id=eq.${myUserId}`,
},
() => {
refreshNotifs();
}
)
.subscribe();

return () => {
supabase.removeChannel(ch);
};
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [supabase, myUserId]);

return { notifUnread, refreshNotifs, supabase };
}