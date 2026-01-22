"use client";

import React, { useState } from "react";
import styles from "./StoriesBar.module.css";

type StoryRow = {
id: string;
user_id: string;
media_url: string | null;
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

export default function StoriesBar({ stories, profilesById }: Props) {
const [showCreate, setShowCreate] = useState(false);

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
{stories.map((story) => {
const profile = profilesById[story.user_id];

return (
<button
key={story.id}
type="button"
className={styles.storyBubble}
title={profile?.username ? profile.username : "Story"}
aria-label="Open story"
onClick={() => {
// TODO: open story viewer for story.id
// (we’ll wire this next)
}}
>
{profile?.avatar_url ? (
// eslint-disable-next-line @next/next/no-img-element
<img
src={profile.avatar_url}
alt=""
className={styles.storyAvatar}
/>
) : (
<div className={styles.storyFallback}>
{profile?.username?.[0]?.toUpperCase() || "U"}
</div>
)}
</button>
);
})}
</div>

{/* CREATE STORY MODAL */}
{showCreate && (
<div
className={styles.modalBackdrop}
onClick={() => setShowCreate(false)}
role="dialog"
aria-modal="true"
>
<div
className={styles.modalCard}
onClick={(e) => e.stopPropagation()}
>
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
<div className={styles.previewPlaceholder}>
Add a photo or video
</div>
</div>

<button type="button" className={styles.uploadBtn}>
Add photo / video
</button>

<div className={styles.modalHint}>
Next: we’ll wire this button to open a file picker and upload to
Supabase Storage + insert into <code>public.stories</code>.
</div>
</div>
</div>
)}
</>
);
}