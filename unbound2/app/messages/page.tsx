import MessagesInbox from "./MessagesInbox";

export const dynamic = "force-dynamic";

const STORAGE_KEY = "unbound_unread_threads";

export default function MessagesPage() {
if (typeof window !== "undefined") {
try {
const raw = localStorage.getItem(STORAGE_KEY);

// Seed unread counts ONCE if they don't exist yet
if (!raw) {
localStorage.setItem(
STORAGE_KEY,
JSON.stringify({
A: 2,
B: 1,
C: 0,
})
);
}
} catch {
// ignore
}
}

return <MessagesInbox />;
}