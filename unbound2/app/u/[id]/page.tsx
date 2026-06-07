import { createClient } from "@supabase/supabase-js";

import UserProfileClient from "./UserProfileClient";



export const dynamic = "force-dynamic";



type ProfileRow = {

  id: string;

  username: string | null;

  display_name: string | null;

  designation?: string | null;

  founder_badge?: string | null;

  bio: string | null;

  avatar_url: string | null;

  buy_me_a_coffee_url: string | null;

  city?: string | null;

  state?: string | null;

  country?: string | null;



  relationship_status?: string | null;

  orientation?: string | null;

  pronouns?: string | null;

  looking_for?: string | null;

  ds_relationship?: string | null;



  moderation_status?: string | null;

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



function UnavailableProfile() {

  return (

    <div

      style={{

        width: "min(920px, 94vw)",

        margin: "30px auto",

        color: "white",

      }}

    >

      <h1 style={{ fontSize: 34, marginBottom: 10 }}>

        Profile unavailable.

      </h1>

      <div style={{ opacity: 0.85 }}>

        This profile is not available.

      </div>

    </div>

  );

}



export default async function PublicProfilePage({

  params,

}: {

  params: Promise<{ id: string }>;

}) {

  const { id } = await params;

  const routeId = (id ?? "").toString();



  const supabase = getSupabase();



  const isUuid =

    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(

      routeId

    );



  const base = supabase

    .from("profiles")

    .select(

      "id, username, display_name, designation, founder_badge, bio, avatar_url, buy_me_a_coffee_url, city, state, country, relationship_status, orientation, pronouns, looking_for, ds_relationship, moderation_status"

    )

    .limit(1);



  const { data, error } = isUuid

    ? await base.eq("id", routeId).maybeSingle()

    : await base.eq("username", routeId).maybeSingle();



  if (error || !data) {

    return (

      <div

        style={{

          width: "min(920px, 94vw)",

          margin: "30px auto",

          color: "white",

        }}

      >

        <h1 style={{ fontSize: 34, marginBottom: 10 }}>

          Profile not found.

        </h1>

        <div style={{ opacity: 0.85 }}>

          {error ? error.message : `No profile matched: ${routeId}`}

        </div>

      </div>

    );

  }



  if ((data as ProfileRow).moderation_status === "banned") {

    return <UnavailableProfile />;

  }



  return <UserProfileClient profile={data as ProfileRow} />;

}

