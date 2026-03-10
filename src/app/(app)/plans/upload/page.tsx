"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Upload, FileText, Loader2, Check, X, ChevronDown, ChevronUp } from "lucide-react"
import { toast } from "sonner"

interface ParsedExercise {
  name: string
  sets: number | null
  reps: string | null
  weight_suggestion: string | null
  rest_seconds: number | null
  notes: string | null
}

interface ParsedWorkout {
  name: string
  day_of_week: number | null
  exercises: ParsedExercise[]
}

interface ParsedWeek {
  week_number: number
  name: string | null
  workouts: ParsedWorkout[]
}

interface ParsedPlan {
  name: string
  description: string
  weeks: ParsedWeek[]
}

export default function UploadPlanPage() {
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  const [file, setFile] = useState<File | null>(null)
  const [planName, setPlanName] = useState("")
  const [description, setDescription] = useState("")
  const [parsing, setParsing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [parsed, setParsed] = useState<ParsedPlan | null>(null)
  const [expandedWeeks, setExpandedWeeks] = useState<Set<number>>(new Set([0]))

  const allowedTypes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/markdown",
    "text/plain",
  ]

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0]
    if (!f) return
    if (f.size > 10 * 1024 * 1024) {
      toast.error("File too large (max 10MB)")
      return
    }
    setFile(f)
    if (!planName) {
      setPlanName(f.name.replace(/\.[^.]+$/, ""))
    }
  }

  async function handleParse() {
    if (!file) return
    setParsing(true)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch("/api/parse-plan", {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || "Failed to parse plan")
      }

      const data = await res.json()
      setParsed({
        name: planName || file.name,
        description,
        weeks: data.weeks || [],
      })
      toast.success("Plan parsed successfully! Review and save below.")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to parse plan")
    } finally {
      setParsing(false)
    }
  }

  async function handleSave() {
    if (!user || !parsed) return
    setSaving(true)

    try {
      // Create plan
      const { data: plan, error: planError } = await supabase
        .from("workout_plans")
        .insert({
          user_id: user.id,
          name: planName || parsed.name,
          description,
          source: "uploaded" as const,
          source_file_name: file?.name,
          duration_weeks: parsed.weeks.length,
          is_active: true,
          parsed_data: parsed as unknown as Record<string, unknown>,
        })
        .select()
        .single()

      if (planError) throw planError

      // Create weeks, workouts, exercises
      for (const week of parsed.weeks) {
        const { data: weekRow, error: weekError } = await supabase
          .from("plan_weeks")
          .insert({
            plan_id: plan.id,
            week_number: week.week_number,
            name: week.name,
          })
          .select()
          .single()

        if (weekError) throw weekError

        for (let wi = 0; wi < week.workouts.length; wi++) {
          const workout = week.workouts[wi]
          const { data: workoutRow, error: woError } = await supabase
            .from("plan_workouts")
            .insert({
              plan_week_id: weekRow.id,
              day_of_week: workout.day_of_week,
              name: workout.name,
              sort_order: wi,
            })
            .select()
            .single()

          if (woError) throw woError

          // Find or create exercises and create plan_exercises
          for (let ei = 0; ei < workout.exercises.length; ei++) {
            const ex = workout.exercises[ei]

            // Try to find existing exercise
            let exerciseId: string | null = null
            const { data: existing } = await supabase
              .from("exercises")
              .select("id")
              .eq("user_id", user.id)
              .ilike("name", ex.name)
              .limit(1)

            if (existing && existing.length > 0) {
              exerciseId = existing[0].id
            } else {
              // Create new exercise
              const { data: newEx } = await supabase
                .from("exercises")
                .insert({
                  user_id: user.id,
                  name: ex.name,
                  is_custom: false,
                })
                .select()
                .single()
              if (newEx) exerciseId = newEx.id
            }

            await supabase.from("plan_exercises").insert({
              plan_workout_id: workoutRow.id,
              exercise_id: exerciseId,
              exercise_name: ex.name,
              sets: ex.sets,
              reps: ex.reps,
              weight_suggestion: ex.weight_suggestion,
              rest_seconds: ex.rest_seconds,
              notes: ex.notes,
              sort_order: ei,
            })
          }
        }
      }

      toast.success("Plan saved!")
      router.push(`/plans/${plan.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to save plan")
    } finally {
      setSaving(false)
    }
  }

  function toggleWeek(idx: number) {
    setExpandedWeeks((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  return (
    <>
      <Header title="Upload Plan" />
      <div className="p-4 lg:p-8 max-w-3xl mx-auto space-y-6">
        <div className="hidden lg:block">
          <h1 className="text-3xl font-bold">Upload Workout Plan</h1>
          <p className="text-muted-foreground">Upload a PDF, DOCX, or Markdown file</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Plan Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Plan Name</Label>
              <Input
                id="name"
                placeholder="e.g., PPL Program, 5/3/1, Couch to 5K"
                value={planName}
                onChange={(e) => setPlanName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desc">Description (optional)</Label>
              <Textarea
                id="desc"
                placeholder="Brief description of the program"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="file">Upload File</Label>
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <Upload className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                <p className="text-sm text-muted-foreground mb-2">
                  PDF, DOCX, or Markdown (max 10MB)
                </p>
                <Input
                  id="file"
                  type="file"
                  accept=".pdf,.docx,.md,.txt"
                  onChange={handleFileChange}
                  className="max-w-xs mx-auto"
                />
                {file && (
                  <div className="flex items-center justify-center gap-2 mt-3">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="text-sm">{file.name}</span>
                    <Badge variant="secondary">{(file.size / 1024).toFixed(0)} KB</Badge>
                  </div>
                )}
              </div>
            </div>
            <Button onClick={handleParse} disabled={!file || parsing} className="w-full">
              {parsing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Parsing...
                </>
              ) : (
                "Parse Plan"
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Parsed Preview */}
        {parsed && parsed.weeks.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle>Parsed Plan Preview</CardTitle>
              <p className="text-sm text-muted-foreground">
                Review the parsed content. {parsed.weeks.length} week(s) detected.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {parsed.weeks.map((week, wi) => (
                <div key={wi} className="border rounded-lg">
                  <button
                    onClick={() => toggleWeek(wi)}
                    className="w-full flex items-center justify-between p-3 hover:bg-accent/50 transition-colors"
                  >
                    <span className="font-medium">
                      Week {week.week_number}{week.name ? `: ${week.name}` : ""}
                    </span>
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary">{week.workouts.length} workouts</Badge>
                      {expandedWeeks.has(wi) ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </div>
                  </button>
                  {expandedWeeks.has(wi) && (
                    <div className="px-3 pb-3 space-y-2">
                      <Separator />
                      {week.workouts.map((workout, woi) => (
                        <div key={woi} className="pl-2 border-l-2 border-primary/30 ml-2">
                          <p className="font-medium text-sm">{workout.name}</p>
                          <div className="space-y-1 mt-1">
                            {workout.exercises.map((ex, ei) => (
                              <div key={ei} className="text-sm text-muted-foreground flex items-center gap-2">
                                <span className="text-foreground">{ex.name}</span>
                                {ex.sets && ex.reps && (
                                  <Badge variant="outline" className="text-xs">
                                    {ex.sets}x{ex.reps}
                                  </Badge>
                                )}
                                {ex.weight_suggestion && (
                                  <span className="text-xs">{ex.weight_suggestion}</span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}

              <Separator />
              <Button onClick={handleSave} disabled={saving} className="w-full">
                {saving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Check className="mr-2 h-4 w-4" />
                    Save Plan
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {parsed && parsed.weeks.length === 0 && (
          <Card className="border-destructive">
            <CardContent className="flex items-center gap-3 py-4">
              <X className="h-5 w-5 text-destructive" />
              <p className="text-sm">
                Could not parse workout structure from the file. Try a different format or check that the file contains exercises with sets/reps.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </>
  )
}
