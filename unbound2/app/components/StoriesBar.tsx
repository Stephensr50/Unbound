"use client";

import styles from "./StoriesBar.module.css";

const stories = [
{ id: "robby", name: "Robby", initial: "R" },
{ id: "tess", name: "Tess", initial: "T" },
{ id: "ladybug", name: "Ladybug", initial: "L" },
{ id: "dahlia", name: "Dahlia", initial: "D" },
{ id: "nova", name: "Nova", initial: "N" },
{ id: "jinx", name: "Jinx", initial: "J" },
];

export default function StoriesBar() {
return (
<div className={styles.storiesWrap}>
{/* THIS is the wrapper that MUST be flex-row */}
<div className={styles.storiesScroll}>
{stories.map((s) => (
<button
key={s.id}
type="button"
className={styles.storyBubble}
aria-label={`Open story for ${s.name}`}
onClick={() => {
// later: open story viewer
}}
>
<div className={styles.avatar}>{s.initial}</div>
<div className={styles.name}>{s.name}</div>
</button>
))}
</div>
</div>
);
}