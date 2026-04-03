export type ReactionKey = "devil" | "fire" | "eyes" | "purple_heart";

/**
* Emoji fallback (used anywhere you DON'T want images)
*/
export const REACTIONS: Record<ReactionKey, string> = {
devil: "😈",
fire: "🔥",
eyes: "👀",
purple_heart: "💜",
};

/**
* Get emoji (fallback)
*/
export function getReactionEmoji(reaction?: string | null): string {
if (reaction === "fire") return REACTIONS.fire;
if (reaction === "eyes") return REACTIONS.eyes;
if (reaction === "purple_heart") return REACTIONS.purple_heart;
return REACTIONS.devil;
}

/**
* Get image path (🔥 THIS is your new branding)
*/
export function getReactionImage(
reaction?: string | null,
active?: boolean
): string {
if (reaction === "devil") {
return "/rope-devil.png";
}

// fallback for others (you can expand later)
return "";
}