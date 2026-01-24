"use client";

import React, { useMemo, useState } from "react";
import styles from "./StoriesBar.module.css";
import StoriesViewer, { type Story } from "./StoriesViewer";

type StoryRow = {
id: string;
user_id: string;
media_url: string | null;
caption?: string | null;
};

type ProfileRow = {
id: string;
username: string | null;
avatar_url: string | null;
};

type Props = {
stories: StoryRow[];
profilesById: Record<string, ProfileRow | undefined>;
};

// 1x1 transparent gif so StoriesViewer always has a valid src
const FALLBACK_IMG =
"data:image/gif;base64,R0lGODlhAQABAAD/ACwAAAAAAQABAAACADs=";

export default function StoriesBar({ stories, profilesById }: Props) {
const [showCreate, setShowCreate] = useState(false);

// viewer state (YOU ALREADY HAD THIS ✅)
const [openIndex, setOpenIndex] = useState<number | null>(null);
const hasViewerOpen = openIndex !== null && openIndex >= 0;

const openStory = (idx: number) => setOpenIndex(idx);
const closeStory = () => setOpenIndex(null);

/**
* StoriesViewer expects media_url: string (not null)
* So we map your rows -> Story, using story.media_url first,
* otherwise profile avatar, otherwise a 1x1 fallback.
*/
const viewerStories: Story[] = useMemo(() => {
return stories.map((s) => {
const profile = profilesById[s.user_id];
const media = s.media_url || profile?.avatar_url || FALLBACK_IMG;

return {
id: s.id,
user_id: s.user_id,
media_url: media,
caption: s.caption ?? null,
};
});
}, [stories, profilesById]);

return (
<>
{/* STORIES ROW */}
<div className={styles.storiesRow}>
{/* ADD STORY (FIRST ITEM) */}
<button
type="button"
className={styles.addStory}
onClick={() => setShowCreate(true)}
title="Create story"
aria-label="Create story"
>
<div className={styles.addStoryInner}>
<span className={styles.addStoryPlus}>+</span>
</div>
</button>

{/* EXISTING STORIES */}
{stories.map((story, idx) => {
const profile = profilesById[story.user_id];

return (
<button
key={story.id}
type="button"
className={styles.storyBubble}
title={profile?.username ? profile.username : "Story"}
aria-label="Open story"
onClick={() => openStory(idx)} // YOU ALREADY HAD THIS ✅
>
{story.media_url ? (
// eslint-disable-next-line @next/next/no-img-element
<img src={story.media_url} alt="" className={styles.storyAvatar} />
) : profile?.avatar_url ? (
// eslint-disable-next-line @next/next/no-img-element
<img src={profile.avatar_url} alt="" className={styles.storyAvatar} />
) : (
<div className={styles.storyFallback}>
{profile?.username?.[0]?.toUpperCase() || "U"}
</div>
)}
</button>
);
})}
</div>

{/* ✅ NEW: STORY VIEWER (auto-advance + swipe-down exit) */}
<StoriesViewer
open={hasViewerOpen}
stories={viewerStories}
initialIndex={openIndex ?? 0}
onClose={closeStory}
/>

{/* CREATE STORY MODAL (your existing one) */}
{showCreate && (
<div
className={styles.modalBackdrop}
onClick={() => setShowCreate(false)}
role="dialog"
aria-modal="true"
>
<div className={styles.modalCard} onClick={(e) => e.stopPropagation()}>
<div className={styles.modalHeader}>
<h3 className={styles.modalTitle}>Create story</h3>
<button
type="button"
className={styles.closeBtn}
onClick={() => setShowCreate(false)}
aria-label="Close"
>
✕
</button>
</div>

<div className={styles.storyPreview}>
<div className={styles.previewPlaceholder}>Add a photo or video</div>
</div>

<button type="button" className={styles.uploadBtn}>
Add photo / video
</button>

<div className={styles.modalHint}>
Upload goes to Storage bucket <code>stories</code> and inserts into{" "}
<code>public.stories</code>.
</div>
</div>
</div>
)}
</>
);
}