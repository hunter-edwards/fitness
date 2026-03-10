"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"
import { ArrowLeft, Save } from "lucide-react"
import Link from "next/link"

const CATEGORIES = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "legs",
  "glutes",
  "core",
  "cardio",
  "flexibility",
  "olympic",
  "other",
] as const

const EQUIPMENT = [
  "barbell",
  "dumbbell",
  "machine",
  "cable",
  "bodyweight",
  "kettlebell",
  "bands",
  "smith_machine",
  "other",
] as const

const EXERCISE_TYPES = [
  { value: "strength", label: "Strength" },
  { value: "cardio", label: "Cardio" },
  { value: "flexibility", label: "Flexibility" },
  { value: "other", label: "Other" },
] as const

const MUSCLE_GROUPS = [
  "chest",
  "upper back",
  "lats",
  "lower back",
  "front delts",
  "side delts",
  "rear delts",
  "biceps",
  "triceps",
  "forearms",
  "quads",
  "hamstrings",
  "glutes",
  "calves",
  "hip flexors",
  "abs",
  "obliques",
  "traps",
  "neck",
] as const

export default function NewExercisePage() {
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()

  const [name, setName] = useState("")
  const [category, setCategory] = useState<string>("")
  const [equipment, setEquipment] = useState<string>("")
  const [exerciseType, setExerciseType] = useState<string>("strength")
  const [selectedMuscles, setSelectedMuscles] = useState<string[]>([])
  const [videoUrl, setVideoUrl] = useState("")
  const [instructions, setInstructions] = useState("")
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const toggleMuscle = (muscle: string) => {
    setSelectedMuscles((prev) =>
      prev.includes(muscle)
        ? prev.filter((m) => m !== muscle)
        : [...prev, muscle]
    )
  }

  const handleSave = async () => {
    if (!user) return
    if (!name.trim()) {
      setError("Exercise name is required")
      return
    }

    setSaving(true)
    setError(null)

    try {
      const { error: insertError } = await supabase.from("exercises").insert({
        user_id: user.id,
        name: name.trim(),
        category: category || null,
        equipment: equipment || null,
        muscle_groups: selectedMuscles.length > 0 ? selectedMuscles : null,
        exercise_type: (exerciseType as "strength" | "cardio" | "flexibility" | "other") || "strength",
        video_url: videoUrl.trim() || null,
        instructions: instructions.trim() || null,
        is_custom: true,
      })

      if (insertError) {
        console.error("Error creating exercise:", insertError)
        setError("Failed to create exercise. Please try again.")
        setSaving(false)
        return
      }

      router.push("/workouts/exercises")
    } catch (err) {
      console.error("Error:", err)
      setError("An unexpected error occurred.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <Header title="New Exercise" />
      <div className="p-4 lg:p-8 space-y-6 max-w-2xl">
        {/* Page header */}
        <div className="flex items-center gap-3">
          <Link href="/workouts/exercises">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div className="hidden lg:block">
            <h1 className="text-3xl font-bold">New Exercise</h1>
            <p className="text-muted-foreground">
              Add a custom exercise to your library
            </p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Exercise Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Name */}
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="e.g. Barbell Bench Press"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>

            {/* Category + Equipment row */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={(v) => v && setCategory(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        <span className="capitalize">{cat}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Equipment</Label>
                <Select value={equipment} onValueChange={(v) => v && setEquipment(v)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select equipment" />
                  </SelectTrigger>
                  <SelectContent>
                    {EQUIPMENT.map((eq) => (
                      <SelectItem key={eq} value={eq}>
                        <span className="capitalize">
                          {eq.replace("_", " ")}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Exercise type */}
            <div className="space-y-2">
              <Label>Exercise Type</Label>
              <Select value={exerciseType} onValueChange={(v) => v && setExerciseType(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {EXERCISE_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Muscle groups */}
            <div className="space-y-2">
              <Label>Muscle Groups</Label>
              <div className="flex flex-wrap gap-1.5">
                {MUSCLE_GROUPS.map((muscle) => {
                  const isActive = selectedMuscles.includes(muscle)
                  return (
                    <button
                      key={muscle}
                      type="button"
                      onClick={() => toggleMuscle(muscle)}
                      className={cn(
                        "rounded-full px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                        isActive
                          ? "bg-primary text-primary-foreground"
                          : "bg-muted text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {muscle}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Video URL */}
            <div className="space-y-2">
              <Label htmlFor="video-url">Video URL (optional)</Label>
              <Input
                id="video-url"
                type="url"
                placeholder="https://youtube.com/watch?v=..."
                value={videoUrl}
                onChange={(e) => setVideoUrl(e.target.value)}
              />
            </div>

            {/* Instructions */}
            <div className="space-y-2">
              <Label htmlFor="instructions">Instructions (optional)</Label>
              <Textarea
                id="instructions"
                placeholder="Describe how to perform the exercise..."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
                rows={4}
              />
            </div>

            {/* Error message */}
            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            {/* Save button */}
            <div className="flex justify-end pt-2">
              <Button onClick={handleSave} disabled={saving}>
                <Save className="h-4 w-4 mr-1.5" />
                {saving ? "Saving..." : "Save Exercise"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
