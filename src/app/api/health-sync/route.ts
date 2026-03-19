import { NextRequest, NextResponse } from "next/server"
import { createClient as createServiceClient } from "@supabase/supabase-js"

export async function POST(request: NextRequest) {
  try {
    // Auth via Bearer token (sync token, not Supabase auth)
    const authHeader = request.headers.get("authorization")
    if (!authHeader?.startsWith("Bearer ")) {
      return NextResponse.json(
        { error: "Missing or invalid Authorization header" },
        { status: 401 }
      )
    }

    const token = authHeader.slice(7)

    // Use service role client to look up token (bypasses RLS)
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

    if (!supabaseUrl || !serviceKey) {
      return NextResponse.json(
        { error: "Server configuration error" },
        { status: 500 }
      )
    }

    const supabase = createServiceClient(supabaseUrl, serviceKey)

    // Validate token
    const { data: tokenRow, error: tokenError } = await supabase
      .from("health_sync_tokens")
      .select("id, user_id, is_active")
      .eq("token", token)
      .single()

    if (tokenError || !tokenRow) {
      return NextResponse.json(
        { error: "Invalid sync token" },
        { status: 401 }
      )
    }

    if (!tokenRow.is_active) {
      return NextResponse.json(
        { error: "Sync token is disabled" },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { date } = body

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      return NextResponse.json(
        { error: "Valid date (YYYY-MM-DD) is required" },
        { status: 400 }
      )
    }

    // Build upsert data — only include provided fields
    const activityData: Record<string, unknown> = {
      user_id: tokenRow.user_id,
      date,
      source: "apple_health",
    }

    const syncedFields: string[] = []

    if (body.steps != null) {
      activityData.steps = Math.round(body.steps)
      syncedFields.push("steps")
    }
    if (body.active_calories != null) {
      activityData.active_calories = Math.round(body.active_calories)
      syncedFields.push("active_calories")
    }
    if (body.active_minutes != null) {
      activityData.active_minutes = Math.round(body.active_minutes)
      syncedFields.push("active_minutes")
    }
    if (body.distance_km != null) {
      activityData.distance_km = Math.round(body.distance_km * 100) / 100
      syncedFields.push("distance_km")
    }
    if (body.flights_climbed != null) {
      activityData.flights_climbed = Math.round(body.flights_climbed)
      syncedFields.push("flights_climbed")
    }
    if (body.resting_calories != null) {
      activityData.resting_calories = Math.round(body.resting_calories)
      syncedFields.push("resting_calories")
    }
    if (body.workout_calories != null) {
      activityData.workout_calories = Math.round(body.workout_calories)
      syncedFields.push("workout_calories")
    }
    if (body.heart_rate_avg != null) {
      activityData.heart_rate_avg = Math.round(body.heart_rate_avg)
      syncedFields.push("heart_rate_avg")
    }
    if (body.heart_rate_resting != null) {
      activityData.heart_rate_resting = Math.round(body.heart_rate_resting)
      syncedFields.push("heart_rate_resting")
    }

    if (syncedFields.length === 0) {
      return NextResponse.json(
        { error: "No health data fields provided" },
        { status: 400 }
      )
    }

    // Upsert activity entry
    const { error: upsertError } = await supabase
      .from("activity_entries")
      .upsert(activityData, {
        onConflict: "user_id,date",
      })

    if (upsertError) {
      console.error("Health sync upsert error:", upsertError)
      return NextResponse.json(
        { error: "Failed to sync data" },
        { status: 500 }
      )
    }

    // Update token's last_synced_at
    await supabase
      .from("health_sync_tokens")
      .update({ last_synced_at: new Date().toISOString() })
      .eq("id", tokenRow.id)

    return NextResponse.json({
      success: true,
      date,
      synced_fields: syncedFields,
    })
  } catch (err) {
    console.error("Health sync error:", err)
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    )
  }
}
