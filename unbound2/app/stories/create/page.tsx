"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/app/supabaseClient";

export default function CreateStoryPage() {
const router = useRouter();
const [file, setFile] = useState<File | null>(null);
const [loading, setLoading] = useState(false);

const handlePostStory = async () => {
if (!file) return;

setLoading(true);

const {
data: { user },
} = await supabase.auth.getUser();

if (!user) {
setLoading(false);
return;
}

const ext = file.name.split(".").pop();
const filePath = `${user.id}/${crypto.randomUUID()}.${ext}`;

// Upload to storage
const { error: uploadError } = await supabase.storage
.from("stories")
.upload(filePath, file);

if (uploadError) {
console.error("Upload error:", uploadError);
setLoading(false);
return;
}

const { data: publicUrl } = supabase.storage
.from("stories")
.getPublicUrl(filePath);

const expiresAt = new Date();
expiresAt.setHours(expiresAt.getHours() + 24);

// Insert story record
const { error: insertError } = await supabase.from("stories").insert({
user_id: user.id,
media_url: publicUrl.publicUrl,
media_type: file.type.startsWith("video") ? "video" : "image",
expires_at: expiresAt.toISOString(),
});

if (insertError) {
console.error("Insert error:", insertError);
setLoading(false);
return;
}

router.push("/feed");
};

return (
<div className="min-h-screen flex flex-col items-center justify-center gap-6 p-6 text-white">
<h1 className="text-xl font-semibold">Post a Story</h1>

<input
type="file"
accept="image/*,video/*"
onChange={(e) => setFile(e.target.files?.[0] || null)}
className="text-sm"
/>

<button
onClick={handlePostStory}
disabled={!file || loading}
className="px-6 py-2 rounded-full bg-purple-600 disabled:opacity-50"
>
{loading ? "Posting…" : "Post Story"}
</button>
</div>
);
}