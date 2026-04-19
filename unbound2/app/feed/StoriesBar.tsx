"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";
import styles from "./StoriesBar.module.css";
import StoryModal from "../components/StoryModal";

type StoryRow = {
  id: string;
  user_id: string;
  media_url: string;
  caption: string | null;
  created_at?: string;
};

type ProfileRow = {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
};

function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
    );
  }
  return createClient(url, key);
}

export default function StoriesBar() {
  const supabase = useMemo(() => getSupabase(), []);
  const router = useRouter();

  const [stories, setStories] = useState<StoryRow[]>([]);
  const [profilesById, setProfilesById] = useState<Record<string, ProfileRow>>(
    {}
  );

  const [openCreate, setOpenCreate] = useState(false);
  const [openView, setOpenView] = useState(false);
  const [selectedStory, setSelectedStory] = useState<StoryRow | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [pickedFile, setPickedFile] = useState<File | null>(null);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const [myUserId, setMyUserId] = useState<string | null>(null);

  const rowRef = useRef<HTMLDivElement | null>(null);
  const isDownRef = useRef(false);
  const startXRef = useRef(0);
  const scrollLeftRef = useRef(0);

  async function loadProfilesForStories(rows: StoryRow[]) {
    const uids = Array.from(new Set(rows.map((s) => s.user_id).filter(Boolean)));
    if (!uids.length) {
      setProfilesById({});
      return;
    }

    const { data: profs } = await supabase
      .from("profiles")
      .select("id,username,display_name,avatar_url")
      .in("id", uids);

    const map: Record<string, ProfileRow> = {};
    for (const p of (profs ?? []) as ProfileRow[]) {
      map[p.id] = p;
    }
    setProfilesById(map);
  }

async function refreshStories() {
try {
const {
data: { user },
} = await supabase.auth.getUser();

const me = user?.id;
if (!me) {
setStories([]);
setProfilesById({});
return;
}

const { data: followingRows, error: followingError } = await supabase
.from("follows")
.select("following_id")
.eq("follower_id", me);

if (followingError) throw followingError;

const { data: friendRows, error: friendError } = await supabase
.from("friends")
.select("friend_id")
.eq("user_id", me);

if (friendError) throw friendError;

const allowedUserIds = Array.from(
new Set([
me,
...(followingRows ?? []).map((r: any) => r.following_id),
...(friendRows ?? []).map((r: any) => r.friend_id),
])
);

const { data: mainData, error: mainError } = await supabase
.from("stories")
.select("id,user_id,media_url,caption,created_at")
.in("user_id", allowedUserIds)
.order("created_at", { ascending: false })
.limit(30);

if (mainError) throw mainError;

const excludedUserIds = allowedUserIds;

const { data: discoveryData, error: discoveryError } = await supabase
.from("stories")
.select("id,user_id,media_url,caption,created_at")
.order("created_at", { ascending: false })
.limit(60);

if (discoveryError) throw discoveryError;

const mainRows = (mainData ?? []) as StoryRow[];

const discoveryPool = ((discoveryData ?? []) as StoryRow[]).filter(
(s) => !excludedUserIds.includes(s.user_id)
);

const discoveryByUser = Array.from(
new Map(discoveryPool.map((s) => [s.user_id, s])).values()
);

const shuffledDiscovery = [...discoveryByUser].sort(
() => Math.random() - 0.5
);

const merged: StoryRow[] = [];
let discoveryIndex = 0;

for (let i = 0; i < mainRows.length; i++) {
merged.push(mainRows[i]);

const shouldInject =
i === 2 || (i + 1) % 6 === 0;

if (shouldInject && discoveryIndex < shuffledDiscovery.length) {
merged.push(shuffledDiscovery[discoveryIndex]);
discoveryIndex += 1;
}
}

if (!mainRows.length && shuffledDiscovery.length) {
merged.push(...shuffledDiscovery.slice(0, 5));
}

setStories(merged);
await loadProfilesForStories(merged);
} catch {
// keep UI stable
}
}

useEffect(() => {
refreshStories();
// eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

useEffect(() => {
let alive = true;

(async () => {
try {
const { data, error } = await supabase.auth.getUser();
if (error) return;
if (!alive) return;
setMyUserId(data?.user?.id ?? null);
} catch {
// ignore
}
})();

return () => {
alive = false;
};
}, [supabase]);
  const dedupedStories = useMemo(() => {
    const map = new Map<string, StoryRow>();

    const sorted = [...stories].sort((a, b) => {
      const aT = a.created_at ? +new Date(a.created_at) : 0;
      const bT = b.created_at ? +new Date(b.created_at) : 0;
      return bT - aT;
    });

    for (const s of sorted) {
      if (!map.has(s.user_id)) map.set(s.user_id, s);
    }

    return Array.from(map.values());
  }, [stories]);

  function openFilePicker() {
    fileInputRef.current?.click();
  }

  function openStoryViewer(story: StoryRow) {
    setSelectedStory(story);
    setOpenView(true);
  }

  function closeStoryViewer() {
    setOpenView(false);
    setSelectedStory(null);
  }

  function goToProfile(userId: string) {
    router.push(`/u/${userId}`);
  }

  function onRowMouseDown(e: React.MouseEvent<HTMLDivElement>) {
    if (!rowRef.current) return;
    isDownRef.current = true;
    startXRef.current = e.pageX;
    scrollLeftRef.current = rowRef.current.scrollLeft;
  }

  function onRowMouseLeave() {
    isDownRef.current = false;
  }

  function onRowMouseUp() {
    isDownRef.current = false;
  }

function onRowMouseMove(e: React.MouseEvent<HTMLDivElement>) {
  if (!isDownRef.current || !rowRef.current) return;
  const dx = e.pageX - startXRef.current;
  rowRef.current.scrollLeft = scrollLeftRef.current - dx;
}


  async function postStory() {
    try {
      setMsg("");
      if (!pickedFile) {
        setMsg("Pick a photo/video first.");
        return;
      }

      setBusy(true);

      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) throw authErr;
      const user = authData?.user;
      if (!user) {
        setMsg("You are not logged in.");
        return;
      }

      const ext = pickedFile.name.split(".").pop() || "jpg";
      const path = `${user.id}/${crypto.randomUUID()}.${ext}`;

      const { error: upErr } = await supabase.storage
        .from("stories")
        .upload(path, pickedFile, { upsert: false });

      if (upErr) throw upErr;

      const { data: pub } = supabase.storage.from("stories").getPublicUrl(path);
      const mediaUrl = pub?.publicUrl;
      if (!mediaUrl) throw new Error("Could not get public URL for uploaded file.");

      const { error: insErr } = await supabase.from("stories").insert({
        user_id: user.id,
        media_url: mediaUrl,
        caption: caption.trim() || null,
      });

      if (insErr) throw insErr;

      setMsg("Posted ✅");
      setPickedFile(null);
      setCaption("");
      setOpenCreate(false);

      await refreshStories();
    } catch (e: any) {
      setMsg(e?.message || "Failed to post story.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className={styles.storiesWrap}>
        <div
          ref={rowRef}
          className={styles.storiesRow}
          onMouseDown={onRowMouseDown}
          onMouseLeave={onRowMouseLeave}
          onMouseUp={onRowMouseUp}
          onMouseMove={onRowMouseMove}
        >
          <div className={styles.storyItem}>
            <button
              type="button"
              className={styles.addStory}
              title="Create story"
              aria-label="Create story"
              onClick={() => {
                setMsg("");
                setPickedFile(null);
                setCaption("");
                setOpenCreate(true);
              }}
            >
              <span>+</span>
            </button>
            <div className={styles.storyUsername}>Your story</div>
          </div>

          {dedupedStories.map((s) => {
            const profile = profilesById[s.user_id];
            const storyLabel = profile?.display_name || profile?.username || "user";

            return (
              <div key={s.id} className={styles.storyItem}>
                <button
                  type="button"
                  className={styles.storyBubble}
                  title={storyLabel}
                  aria-label={`Open ${storyLabel}'s story`}
                  onClick={() => openStoryViewer(s)}
                >
                  <img
                    className={styles.storyAvatar}
                    src={profile?.avatar_url || s.media_url}
                    alt={storyLabel}
                    draggable={false}
                  />
                </button>

                <button
                  type="button"
                  className={styles.storyUsernameBtn}
                  onClick={() => goToProfile(s.user_id)}
                  title={`Go to ${storyLabel}'s profile`}
                  aria-label={`Go to ${storyLabel}'s profile`}
                >
                  {storyLabel.length > 12
                    ? `${storyLabel.slice(0, 12)}…`
                    : storyLabel}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*,video/*"
        style={{ display: "none" }}
        onChange={(e) => setPickedFile(e.target.files?.[0] ?? null)}
      />

      {openCreate ? (
        <div
          className={styles.modalBackdrop}
          onClick={() => !busy && setOpenCreate(false)}
          style={{ pointerEvents: "auto" }}
        >
          <div
            className={styles.modalCard}
            onClick={(e) => e.stopPropagation()}
            style={{ zIndex: 9999, pointerEvents: "auto" }}
          >
            <div className={styles.modalHeader}>
              <div style={{ fontSize: 18, fontWeight: 800 }}>Create story</div>
              <button
                type="button"
                className={styles.closeBtn}
                onClick={() => !busy && setOpenCreate(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div style={{ opacity: 0.9, marginBottom: 10 }}>
              Add a photo or video
            </div>

            <button
              type="button"
              className={styles.uploadBtn}
              onClick={openFilePicker}
              disabled={busy}
              style={{ pointerEvents: "auto" }}
            >
              {pickedFile ? "Change photo / video" : "Add photo / video"}
            </button>

            {pickedFile ? (
              <div style={{ marginTop: 10, fontSize: 13, opacity: 0.85 }}>
                Selected: {pickedFile.name}
              </div>
            ) : null}

            <input
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Caption (optional)"
              disabled={busy}
              style={{
                marginTop: 12,
                width: "100%",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(180, 120, 255, 0.35)",
                background: "rgba(0,0,0,0.35)",
                color: "white",
              }}
            />

            <button
              type="button"
              className={styles.uploadBtn}
              onClick={postStory}
              disabled={busy || !pickedFile}
              style={{ marginTop: 12, opacity: busy || !pickedFile ? 0.55 : 1 }}
            >
              {busy ? "Reachimg climax..." : "Post story"}
            </button>

            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.8 }}>
              Upload goes to Storage bucket <b>stories</b> and inserts into{" "}
              <b>public.stories</b>.
            </div>

            {msg ? <div style={{ marginTop: 10, opacity: 0.9 }}>{msg}</div> : null}
          </div>
        </div>
      ) : null}

      <StoryModal
        open={openView}
        onClose={closeStoryViewer}
        stories={dedupedStories}
        startIndex={Math.max(
          0,
          dedupedStories.findIndex((s) => s.id === selectedStory?.id)
        )}
        myUserId={myUserId}
        onDeleteCurrent={async (story: StoryRow) => {
          const { data: authData, error: authErr } = await supabase.auth.getUser();
          if (authErr) throw authErr;
          const user = authData?.user;
          if (!user) throw new Error("You are not logged in.");

          const { error } = await supabase
            .from("stories")
            .delete()
            .eq("id", story.id)
            .eq("user_id", user.id);

          if (error) throw error;

          await refreshStories();
        }}
      />
    </>
  );
}
