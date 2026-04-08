import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  return createClient(url, key);
}

type ReactionKey = "devil" | "fire" | "eyes" | "purple_heart";

const REACTIONS: Record<ReactionKey, string> = {
  devil: "😈",
  fire: "🔥",
  eyes: "👀",
  purple_heart: "💜",
};

type PostRow = {
  id: number;
  user_id: string;
  body: string | null;
  kind: string | null;
  created_at: string;
  media_url?: string | null;
  image_url?: string | null;
  file_url?: string | null;
  media_type?: string | null;
  group_id?: number | null;
};

type GroupRow = {
  id: number;
  name: string;
  slug: string;
  avatar_url?: string | null;
};

function timeAgo(ts: string) {
  const then = new Date(ts).getTime();
  const now = Date.now();
  const s = Math.max(0, Math.floor((now - then) / 1000));
  if (s < 15) return "just now";
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m`;
  if (s < 86400) return `${Math.floor(s / 3600)}h`;
  return `${Math.floor(s / 86400)}d`;
}

export default function ProfileFeedClient() {
  const supabase = useMemo(() => getSupabase(), []);
  const router = useRouter();

  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [posts, setPosts] = useState<PostRow[]>([]);
  const [banner, setBanner] = useState<string | null>(null);
  const [groupsById, setGroupsById] = useState<Record<number, GroupRow>>({});

  const [likeCounts, setLikeCounts] = useState<Record<number, number>>({});
  const [commentCounts, setCommentCounts] = useState<Record<number, number>>(
    {}
  );
  const [likedByMe, setLikedByMe] = useState<Record<number, boolean>>({});
  const [myReactionByPost, setMyReactionByPost] = useState<
    Record<number, ReactionKey | undefined>
  >({});
  const [openReactionPicker, setOpenReactionPicker] = useState<
    Record<number, boolean>
  >({});

  const [busyPostId, setBusyPostId] = useState<number | null>(null);
  const [spark, setSpark] = useState<Record<number, boolean>>({});

  async function refreshAuth() {
    const { data } = await supabase.auth.getSession();
    const uid = data.session?.user?.id ?? null;
    setMyUserId(uid);
    return uid;
  }

  async function loadCounts(postIds: number[], uid: string | null) {
    if (!postIds.length) {
      setLikeCounts({});
      setLikedByMe({});
      setMyReactionByPost({});
      setCommentCounts({});
      return;
    }

    const { data: likeRows, error: likeErr } = await supabase
      .from("post_likes")
      .select("post_id,user_id,reaction")
      .in("post_id", postIds);

    if (likeErr) {
      setBanner(likeErr.message);
      return;
    }

    const lc: Record<number, number> = {};
    const lbm: Record<number, boolean> = {};
    const reactionsByMe: Record<number, ReactionKey | undefined> = {};

    for (const r of likeRows ?? []) {
      const pid = (r as any).post_id as number;
      const likerId = (r as any).user_id as string;
      const reaction = (((r as any).reaction || "devil") as ReactionKey) ?? "devil";

      lc[pid] = (lc[pid] ?? 0) + 1;

      if (uid && likerId === uid) {
        lbm[pid] = true;
        reactionsByMe[pid] = reaction;
      }
    }

    const { data: commentRows, error: commentErr } = await supabase
      .from("post_comments")
      .select("post_id")
      .in("post_id", postIds);

    if (commentErr) {
      setLikeCounts(lc);
      setLikedByMe(lbm);
      setMyReactionByPost(reactionsByMe);
      setCommentCounts({});
      return;
    }

    const cc: Record<number, number> = {};
    for (const r of commentRows ?? []) {
      const pid = (r as any).post_id as number;
      cc[pid] = (cc[pid] ?? 0) + 1;
    }

    setLikeCounts(lc);
    setLikedByMe(lbm);
    setMyReactionByPost(reactionsByMe);
    setCommentCounts(cc);
  }

  async function loadGroups(groupIds: number[]) {
    if (!groupIds.length) {
      setGroupsById({});
      return;
    }

    const { data, error } = await supabase
      .from("groups")
      .select("id,name,slug,avatar_url")
      .in("id", groupIds);

    if (error) {
      setBanner(error.message);
      return;
    }

    const map: Record<number, GroupRow> = {};
    for (const g of (data ?? []) as GroupRow[]) {
      map[g.id] = g;
    }
    setGroupsById(map);
  }

  async function loadMyPosts(uid: string) {
    setBanner(null);

    const { data, error } = await supabase
      .from("posts")
      .select("id,user_id,body,kind,created_at,media_url,media_type,group_id")
      .eq("user_id", uid)
      .order("created_at", { ascending: false })
      .limit(50);

    if (error) {
      setBanner(error.message);
      setPosts([]);
      return;
    }

    const rows = (data ?? []) as PostRow[];
    setPosts(rows);

    const groupIds = Array.from(
      new Set(
        rows
          .map((p) => p.group_id)
          .filter((id): id is number => typeof id === "number")
      )
    );

    await loadGroups(groupIds);
    await loadCounts(
      rows.map((p) => p.id),
      myUserId ?? uid
    );
  }

  useEffect(() => {
    (async () => {
      const uid = await refreshAuth();
      if (!uid) {
        setBanner("Not signed in.");
        setPosts([]);
        return;
      }
      await loadMyPosts(uid);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function triggerSpark(postId: number) {
    setSpark((m) => ({ ...m, [postId]: true }));
    window.setTimeout(() => {
      setSpark((m) => ({ ...m, [postId]: false }));
    }, 260);
  }

  function closeReactionPicker(postId: number) {
    setOpenReactionPicker((m) => ({ ...m, [postId]: false }));
  }

  function toggleReactionPicker(postId: number) {
    setOpenReactionPicker((m) => ({ ...m, [postId]: !m[postId] }));
  }

  async function setReaction(postId: number, reaction: ReactionKey = "devil") {
    const uid = myUserId ?? (await refreshAuth());
    if (!uid) return;

    if (busyPostId) return;
    setBusyPostId(postId);
    setBanner(null);

    const currentReaction = myReactionByPost[postId];
    const already = !!likedByMe[postId];

    if (already && currentReaction === reaction) {
      const { error } = await supabase
        .from("post_likes")
        .delete()
        .eq("post_id", postId)
        .eq("user_id", uid);

      if (error) {
        setBanner(error.message);
        setBusyPostId(null);
        return;
      }

      setLikedByMe((m) => ({ ...m, [postId]: false }));
      setMyReactionByPost((m) => ({ ...m, [postId]: undefined }));
      setLikeCounts((m) => ({
        ...m,
        [postId]: Math.max(0, (m[postId] ?? 0) - 1),
      }));
      closeReactionPicker(postId);
      setBusyPostId(null);
      return;
    }

    if (already && currentReaction && currentReaction !== reaction) {
      const { error } = await supabase
        .from("post_likes")
        .update({ reaction })
        .eq("post_id", postId)
        .eq("user_id", uid);

      if (error) {
        setBanner(error.message);
        setBusyPostId(null);
        return;
      }

      setLikedByMe((m) => ({ ...m, [postId]: true }));
      setMyReactionByPost((m) => ({ ...m, [postId]: reaction }));
      triggerSpark(postId);
      closeReactionPicker(postId);
      setBusyPostId(null);
      return;
    }

    const { error } = await supabase.from("post_likes").insert({
      post_id: postId,
      user_id: uid,
      reaction,
    });

    if (error) {
      const isConflict =
        (error as any)?.status === 409 ||
        (error as any)?.code === "23505" ||
        String((error as any)?.message || "")
          .toLowerCase()
          .includes("duplicate") ||
        String((error as any)?.message || "")
          .toLowerCase()
          .includes("unique");

      if (isConflict) {
        const { error: updateErr } = await supabase
          .from("post_likes")
          .update({ reaction })
          .eq("post_id", postId)
          .eq("user_id", uid);

        if (updateErr) {
          setBanner(updateErr.message);
          setBusyPostId(null);
          return;
        }

        setLikedByMe((m) => ({ ...m, [postId]: true }));
        setMyReactionByPost((m) => ({ ...m, [postId]: reaction }));
        triggerSpark(postId);
        closeReactionPicker(postId);
        setBusyPostId(null);
        return;
      }

      setBanner(error.message);
      setBusyPostId(null);
      return;
    }

    setLikedByMe((m) => ({ ...m, [postId]: true }));
    setMyReactionByPost((m) => ({ ...m, [postId]: reaction }));
    setLikeCounts((m) => ({ ...m, [postId]: (m[postId] ?? 0) + 1 }));
    triggerSpark(postId);
    closeReactionPicker(postId);
    setBusyPostId(null);
  }

  async function toggleSpank(postId: number) {
    const existing = myReactionByPost[postId];
    await setReaction(postId, existing || "devil");
  }

  const card: React.CSSProperties = {
    background: "rgba(0,0,0,0.55)",
    border: "1px solid rgba(180,120,255,0.16)",
    borderRadius: 16,
    padding: 14,
  };

  const mediaStyle: React.CSSProperties = {
    width: "100%",
    borderRadius: 14,
    marginTop: 12,
    border: "1px solid rgba(180,120,255,0.16)",
    display: "block",
    maxHeight: 560,
    objectFit: "cover",
  };

  const pillBtn: React.CSSProperties = {
    padding: "8px 14px",
    borderRadius: 999,
    border: "1px solid rgba(180,120,255,0.25)",
    background: "rgba(0,0,0,0.35)",
    color: "white",
    cursor: "pointer",
    fontWeight: 650,
  };

  const groupPill: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
    padding: "6px 10px",
    borderRadius: 999,
    background: "rgba(168,85,247,0.18)",
    border: "1px solid rgba(168,85,247,0.45)",
    boxShadow: "0 0 12px rgba(168,85,247,0.35)",
    color: "rgba(240,220,255,0.96)",
    fontSize: 12,
    fontWeight: 700,
  };

  return (
    <div style={{ width: "min(920px, 94vw)", margin: "16px auto 0" }}>
      <style>{`
        @keyframes unboundPop {
          0% { transform: scale(1); }
          45% { transform: scale(1.22); }
          100% { transform: scale(1); }
        }
      `}</style>

      {banner ? (
        <div
          style={{
            marginBottom: 12,
            padding: 10,
            borderRadius: 14,
            background: "rgba(120,0,0,0.35)",
            border: "1px solid rgba(255,80,80,0.35)",
            color: "rgba(255,220,220,0.95)",
            fontSize: 13,
          }}
        >
          {banner}
        </div>
      ) : null}

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {posts.map((p) => {
          const media = p.media_url ?? p.image_url ?? p.file_url ?? null;

          const isVideo =
            (p.kind ?? "").toLowerCase().includes("video") ||
            (!!media && /\.(mp4|webm|mov)(\?|$)/i.test(media));

          const isPhoto =
            (p.kind ?? "").toLowerCase().includes("photo") ||
            (p.kind ?? "").toLowerCase().includes("image") ||
            (!!media && /\.(jpg|jpeg|png|gif|webp)(\?|$)/i.test(media));

          const spanks = likeCounts[p.id] ?? 0;
          const comments = commentCounts[p.id] ?? 0;
          const iSpanked = !!likedByMe[p.id];
          const myReaction = myReactionByPost[p.id];
          const isBusy = busyPostId === p.id;
          const groupInfo =
            typeof p.group_id === "number" ? groupsById[p.group_id] : null;

          return (
            <div key={p.id} style={card}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  marginBottom: 8,
                }}
              >
                <div style={{ opacity: 0.65, fontSize: 12 }}>
                  {timeAgo(p.created_at)}
                </div>
                <div style={{ opacity: 0.55, fontSize: 12 }}>@robby_78</div>
              </div>

              {groupInfo ? (
                <div
                  onClick={() => router.push(`/groups/${groupInfo.slug}`)}
                  style={{ ...groupPill, cursor: "pointer" }}
                >
                  {groupInfo.avatar_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={groupInfo.avatar_url}
                      alt=""
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 999,
                        objectFit: "cover",
                        border: "1px solid rgba(255,255,255,0.18)",
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: 18,
                        height: 18,
                        borderRadius: 999,
                        display: "grid",
                        placeItems: "center",
                        fontSize: 10,
                        background: "rgba(255,255,255,0.10)",
                        border: "1px solid rgba(255,255,255,0.16)",
                      }}
                    >
                      G
                    </div>
                  )}

                  <span>Group · </span>
                  <span>{groupInfo.name}</span>
                </div>
              ) : null}

              {p.body ? (
                <div style={{ fontSize: 16, lineHeight: 1.4, whiteSpace: "pre-wrap" }}>
                  {p.body}
                </div>
              ) : null}

              {media && (isPhoto || isVideo) ? (
                isVideo ? (
                  <video src={media} controls style={mediaStyle} />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={media} alt="" style={mediaStyle} />
                )
              ) : null}

              <div
                style={{
                  display: "flex",
                  gap: 14,
                  marginTop: 12,
                  alignItems: "center",
                  flexWrap: "wrap",
                }}
              >
                <div style={{ position: "relative", display: "flex", gap: 8 }}>
                  <button
                    onClick={() => !isBusy && toggleSpank(p.id)}
                    disabled={isBusy}
                    style={{
                      ...pillBtn,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      opacity: isBusy ? 0.6 : 1,
                      animation: spark[p.id] ? "unboundPop .22s ease" : undefined,
                      color: iSpanked ? "#e879f9" : "white",
                      border: iSpanked
                        ? "1px solid rgba(192,38,211,0.55)"
                        : "1px solid rgba(180,120,255,0.25)",
                      background: iSpanked
                        ? "rgba(192,38,211,0.16)"
                        : "rgba(0,0,0,0.35)",
                    }}
                    title="Spank"
                  >
                    <span
                      style={{
                        fontSize: 16,
                        lineHeight: 1,
                        display: "inline-flex",
                      }}
                    >
                      {iSpanked ? REACTIONS[myReaction || "devil"] : "👿"}
                    </span>

                    <span>
                      {iSpanked ? "Spanked" : "Spank"}
                      {spanks ? ` · ${spanks}` : ""}
                    </span>
                  </button>

                  <button
                    onClick={() => toggleReactionPicker(p.id)}
                    disabled={isBusy}
                    style={{
                      ...pillBtn,
                      padding: "8px 10px",
                      minWidth: 40,
                      opacity: isBusy ? 0.6 : 1,
                    }}
                    title="Choose reaction"
                  >
                    ▾
                  </button>

                  {openReactionPicker[p.id] ? (
                    <div
                      style={{
                        position: "absolute",
                        top: "100%",
                        left: 0,
                        marginTop: 8,
                        display: "flex",
                        gap: 8,
                        padding: 8,
                        borderRadius: 14,
                        background: "rgba(10,10,10,0.94)",
                        border: "1px solid rgba(180,120,255,0.28)",
                        boxShadow: "0 10px 28px rgba(0,0,0,0.35)",
                        zIndex: 40,
                      }}
                    >
                      {(Object.keys(REACTIONS) as ReactionKey[]).map((reaction) => (
                        <button
                          key={reaction}
                          onClick={() => setReaction(p.id, reaction)}
                          style={{
                            width: 40,
                            height: 40,
                            borderRadius: 999,
                            border:
                              myReaction === reaction
                                ? "1px solid rgba(192,38,211,0.55)"
                                : "1px solid rgba(180,120,255,0.25)",
                            background:
                              myReaction === reaction
                                ? "rgba(192,38,211,0.16)"
                                : "rgba(0,0,0,0.35)",
                            color: "white",
                            cursor: "pointer",
                            fontSize: 20,
                            lineHeight: "20px",
                          }}
                          title={reaction}
                        >
                          {REACTIONS[reaction]}
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>

                <button style={pillBtn}>
                  Comments {comments ? `· ${comments}` : ""}
                </button>
              </div>
            </div>
          );
        })}

        {posts.length === 0 ? (
          <div style={{ opacity: 0.65, fontSize: 13, padding: 8 }}>
            No posts yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}
