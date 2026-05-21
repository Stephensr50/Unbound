"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

type InboxItem = {
  id: number;
  preview: string;
  last_message_at: string | null;
  other_user: {
    id: string;
    username: string | null;
    display_name: string | null;
    avatar_url: string | null;
  } | null;
};

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

function timeAgo(ts: string | null) {
  if (!ts) return "";
  const then = new Date(ts).getTime();
  const now = Date.now();
  const s = Math.max(1, Math.floor((now - then) / 1000));

  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d`;
  const w = Math.floor(d / 7);
  if (w < 5) return `${w}w`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo`;
  const y = Math.floor(d / 365);
  return `${y}y`;
}

function avatarFallback(name: string) {
  return (name || "?").trim().charAt(0).toUpperCase() || "?";
}

function MessagesInboxContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const supabase = useMemo(() => getSupabase(), []);

  const [threads, setThreads] = useState<InboxItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  const inFlightRef = useRef(false);

  async function getAccessToken() {
    const { data } = await supabase.auth.getSession();
    return data.session?.access_token ?? "";
  }

  async function refreshAuth() {
    const { data } = await supabase.auth.getSession();
    return data.session?.user?.id ?? null;
  }

  async function hideConversation(conversationId: number) {
    const uid = await refreshAuth();
    if (!uid) return;

    const { error } = await supabase
      .from("conversation_members")
      .update({ hidden_at: new Date().toISOString() })
      .eq("conversation_id", conversationId)
      .eq("user_id", uid);

    if (error) {
      setErr(error.message);
      return;
    }

    setThreads((prev) => prev.filter((t) => t.id !== conversationId));
  }

  async function loadInbox(opts?: { silent?: boolean }) {
    const silent = opts?.silent ?? false;
    if (inFlightRef.current) return;
    inFlightRef.current = true;

    try {
      if (!silent) setLoading(true);
      setErr("");

      const token = await getAccessToken();
      if (!token) {
        setErr("Not signed in.");
        setThreads([]);
        return;
      }

      const res = await fetch("/api/messages/inbox", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json().catch(() => ({}));

      if (!res.ok) {
    throw new Error(json?.error || json?.message || `Inbox load failed. Status: ${res.status}`);
      }

      setThreads(Array.isArray(json?.items) ? json.items : []);
    } catch (e: any) {
      console.error(e);
      setErr(e?.message ?? "Inbox load failed.");
      setThreads([]);
    } finally {
      if (!silent) setLoading(false);
      inFlightRef.current = false;
    }
  }

  useEffect(() => {
    loadInbox();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  if (loading) {
    return <div style={{ padding: 16, opacity: 0.9 }}>Loading messages…</div>;
  }

  if (err) {
    return (
      <div style={{ padding: 16 }}>
        <div style={{ color: "#ffb3b3", marginBottom: 12 }}>{err}</div>

        <button
          onClick={() => loadInbox()}
          style={{
            padding: "12px 18px",
            borderRadius: 12,
            border: "none",
            outline: "none",
            background: "linear-gradient(180deg,#a47aed,#49159e)",
            color: "#f5edff",
            fontWeight: 700,
            cursor: "pointer",
            boxShadow: "0 0 18px rgba(170,90,255,0.45)",
          }}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div style={{ padding: 16 }}>
      {threads.length === 0 ? (
        <div style={{ opacity: 0.85 }}>No conversations yet.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {threads.map((t) => {
            const displayName =
              t.other_user?.display_name?.trim() ||
              t.other_user?.username?.trim() ||
              "Unknown user";

            const secondary =
              t.other_user?.display_name && t.other_user?.username
                ? `@${t.other_user.username}`
                : "";

            const preview = t.preview?.trim() || "(no text)";
            const timeLabel = timeAgo(t.last_message_at);

            return (
              <div
                key={t.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: 12,
                  borderRadius: 16,
                  background:
                    "linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))",
                  border: "1px solid rgba(168,85,247,0.14)",
                  boxShadow: "0 0 18px rgba(170,90,255,0.10)",
                }}
              >
                <button
                  onClick={() => router.push(`/messages/${t.id}`)}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    flex: 1,
                    minWidth: 0,
                    border: "none",
                    outline: "none",
                    background: "transparent",
                    color: "#f5edff",
                    cursor: "pointer",
                    padding: 0,
                    textAlign: "left",
                  }}
                >
                  <div
                    style={{
                      width: 56,
                      height: 56,
                      minWidth: 56,
                      borderRadius: 14,
                      overflow: "hidden",
                      border: "1px solid rgba(255,255,255,0.10)",
                      background:
                        "linear-gradient(180deg, rgba(168,85,247,0.22), rgba(255,255,255,0.05))",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "#fff",
                      fontWeight: 800,
                      fontSize: 18,
                    }}
                  >
                    {t.other_user?.avatar_url ? (
                      <img
                        src={t.other_user.avatar_url}
                        alt={displayName}
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                    ) : (
                      avatarFallback(displayName)
                    )}
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "baseline",
                        justifyContent: "space-between",
                        gap: 10,
                      }}
                    >
                      <div style={{ minWidth: 0, overflow: "hidden" }}>
                        <div
                          style={{
                            fontWeight: 800,
                            fontSize: 18,
                            color: "#fff",
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                          }}
                        >
                          {displayName}
                        </div>

                        {secondary ? (
                          <div
                            style={{
                              fontSize: 12,
                              opacity: 0.65,
                              marginTop: 2,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                            }}
                          >
                            {secondary}
                          </div>
                        ) : null}
                      </div>

                      <div
                        style={{
                          fontSize: 12,
                          opacity: 0.65,
                          whiteSpace: "nowrap",
                          alignSelf: "flex-start",
                        }}
                      >
                        {timeLabel}
                      </div>
                    </div>

                    <div
                      style={{
                        marginTop: 8,
                        fontSize: 15,
                        lineHeight: 1.3,
                        color: "rgba(245,237,255,0.88)",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                      }}
                    >
                      {preview}
                    </div>
                  </div>
                </button>

                <button
                  onClick={() => hideConversation(t.id)}
                  title="Hide conversation"
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: "1px solid rgba(255,120,120,0.20)",
                    background: "rgba(255,80,80,0.08)",
                    color: "rgba(255,220,220,0.90)",
                    fontWeight: 700,
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  Delete
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
export default function MessagesInbox() {
return (
<Suspense fallback={<div style={{ padding: 16, opacity: 0.9 }}>Loading messages…</div>}>
<MessagesInboxContent />
</Suspense>
);
}