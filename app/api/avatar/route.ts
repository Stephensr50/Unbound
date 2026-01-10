import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const runtime = "nodejs"; // keep it on Node (not Edge) for FormData + file handling

function getExtFromMime(mime: string) {
  const map: Record<string, string> = {
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/webp": "webp",
    "image/gif": "gif",
  };
  return map[mime] ?? null;
}




export async function POST(req: Request) {
  console.log("=== AVATAR UPLOAD START ===");
  console.log("SUPABASE URL:", process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log(
    "SERVICE ROLE KEY PRESENT:",
    !!process.env.SUPABASE_SERVICE_ROLE_KEY
);

  try {
    // 1) Read file from form-data
    const form = await req.formData();
    const file = form.get("file");

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // 2) Basic checks
    if (file.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
    }

    const ext = getExtFromMime(file.type);
    if (!ext) {
      return NextResponse.json({ error: "Unsupported file type" }, { status: 400 });
    }

    // 3) Create Supabase client using SERVICE ROLE KEY (server-only)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    console.log("BUCKET:", "Avatars");
    console.log("URL length:", (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").length);
    console.log("KEY length:", (process.env.SUPABASE_SERVICE_ROLE_KEY ?? "").length);

// quick connectivity test (no secrets)
// quick connectivity test (no secrets)
try {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!; // server only

  const health = await fetch(`${url}/auth/v1/health`, {
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
  });

  console.log("SUPABASE HEALTH STATUS:", health.status);
  // optional: see response text when not 200
  if (!health.ok) console.log("SUPABASE HEALTH BODY:", await health.text());
} catch (e: any) {
  console.error("SUPABASE HEALTH FETCH FAILED:", e?.message || e);
}



    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json(
        { error: "Missing env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // 4) For now, we’ll store under a fixed path until auth is wired up
    // Later we’ll replace `demo-user` with the real logged-in user id.
    const storagePath = `demo-user/avatar.${ext}`;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    // IMPORTANT: your bucket name is AVATARS (caps)
    const { error: uploadErr } = await supabase.storage
      .from("Avatars")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadErr) {
      return NextResponse.json({ error: uploadErr.message }, { status: 400 });
    }

    return NextResponse.json({ ok: true, avatar_path: storagePath });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message ?? "Unknown error" }, { status: 500 });
  }
}
