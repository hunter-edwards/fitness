import { NextRequest, NextResponse } from "next/server"
import { parsePlan } from "@/lib/parsers/plan-parser"

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get("file") as File | null

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 })
    }

    if (file.size > 10 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 10MB)" }, { status: 400 })
    }

    const buffer = Buffer.from(await file.arrayBuffer())
    const result = await parsePlan(buffer, file.name, file.type)

    return NextResponse.json(result)
  } catch (err) {
    console.error("Plan parse error:", err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to parse plan" },
      { status: 500 }
    )
  }
}
