"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient, SupabaseClient } from "@supabase/supabase-js";

type SignalRow = {
id: number;
receiver_id: string;
};

function getSupabase(): SupabaseClient {
const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
return createClient(url, key);
}

export function useUnreadSignals() {
const supabase = useMemo(() => getSupabase(), []);
const [signalUnread, setSignalUnread] = useState(0);
const [myUserId, setMyUserId] = useState<string | null>(null);

const inFlight = useRef(false);

async function refreshSignals() {
if (inFlight.current) return;
inFlight.current = true;

try {
const { data } = await supabase.auth.getSession();
const uid = data.session?.user?.id ?? null;
setMyUserId(uid);

if (!uid) {
setSignalUnread(0);
return;
}

const { data: rows, error } = await supabase
.from("user_signals")
.select("id,receiver_id,read_at")
.eq("receiver_id", uid)
.is("read_at", null);

if (error) throw error;

setSignalUnread((rows as SignalRow[] | null)?.length ?? 0);
} finally {
inFlight.current = false;
}
}

useEffect(() => {
refreshSignals();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

useEffect(() => {
if (!myUserId) return;

const ch = supabase
.channel("signals-badge")
.on(
"postgres_changes",
{
event: "*",
schema: "public",
table: "user_signals",
filter: `receiver_id=eq.${myUserId}`,
},
() => {
refreshSignals();
}
)
.subscribe();

return () => {
supabase.removeChannel(ch);
};
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [supabase, myUserId]);

useEffect(() => {
const id = window.setInterval(() => {
refreshSignals();
}, 60000);

return () => {
window.clearInterval(id);
};
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

return { signalUnread, refreshSignals, supabase };
}