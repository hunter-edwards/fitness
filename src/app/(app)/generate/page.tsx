"use client"

import { useState, useRef, useEffect } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { toast } from "sonner"
import {
  Dumbbell,
  Heart,
  UtensilsCrossed,
  Target,
  ArrowLeft,
  Loader2,
  Send,
  Sparkles,
  ChevronDown,
  ChevronRight,
} from "lucide-react"

type GenerationType = "workout" | "cardio" | "meal" | "goals"

interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

const TYPE_CONFIG = {
  workout: {
    icon: Dumbbell,
    title: "Workout Plan",
    description: "Custom strength & hypertrophy programs",
  },
  cardio: {
    icon: Heart,
    title: "Cardio Plan",
    description: "Endurance, fat loss & race prep plans",
  },
  meal: {
    icon: UtensilsCrossed,
    title: "Meal Plan",
    description: "Nutrition plans tailored to your goals",
  },
  goals: {
    icon: Target,
    title: "Goals",
    description: "Smart goals with actionable milestones",
  },
} as const

export default function GeneratePage() {
  const router = useRouter()
  const { user } = useAuth()
  const chatEndRef = useRef<HTMLDivElement>(null)

  const [step, setStep] = useState(1)
  const [generationType, setGenerationType] = useState<GenerationType | null>(null)
  const [fields, setFields] = useState<Record<string, string | number>>({})
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState("")
  const [generatedData, setGeneratedData] = useState<any>(null)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [questionsAnswered, setQuestionsAnswered] = useState(0)
  const [ready, setReady] = useState(false)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({})

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [chatMessages])

  function updateField(key: string, value: string | number) {
    setFields((prev) => ({ ...prev, [key]: value }))
  }

  function toggleSection(key: string) {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }))
  }

  function handleSelectType(type: GenerationType) {
    setGenerationType(type)
    setFields({})
    setStep(2)
  }

  function handleBack() {
    if (step === 2) {
      setGenerationType(null)
      setFields({})
      setStep(1)
    } else if (step === 3) {
      setStep(2)
      setChatMessages([])
      setQuestionsAnswered(0)
      setReady(false)
    } else if (step === 4) {
      setStep(3)
      setGeneratedData(null)
    }
  }

  async function handleStartChat() {
    if (!generationType) return
    setGenerating(true)
    setStep(3)

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "chat",
          type: generationType,
          fields,
          messages: [],
        }),
      })

      if (!res.ok) throw new Error("Failed to start generation chat")

      const data = await res.json()
      setChatMessages([{ role: "assistant", content: data.message }])
      if (data.ready) setReady(true)
    } catch {
      toast.error("Failed to connect to AI. Please try again.")
      setStep(2)
    } finally {
      setGenerating(false)
    }
  }

  async function handleSendMessage() {
    if (!chatInput.trim() || generating) return

    const userMessage = chatInput.trim()
    setChatInput("")
    const newMessages: ChatMessage[] = [
      ...chatMessages,
      { role: "user", content: userMessage },
    ]
    setChatMessages(newMessages)
    const answered = questionsAnswered + 1
    setQuestionsAnswered(answered)
    setGenerating(true)

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "chat",
          type: generationType,
          fields,
          messages: newMessages,
        }),
      })

      if (!res.ok) throw new Error("Failed to send message")

      const data = await res.json()
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.message },
      ])
      if (data.ready || answered >= 2) setReady(true)
    } catch {
      toast.error("Failed to get AI response.")
    } finally {
      setGenerating(false)
    }
  }

  async function handleGenerate() {
    setGenerating(true)

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "generate",
          type: generationType,
          fields,
          messages: chatMessages,
        }),
      })

      if (!res.ok) throw new Error("Failed to generate plan")

      const data = await res.json()
      setGeneratedData(data.result)
      setStep(4)
    } catch {
      toast.error("Failed to generate plan. Please try again.")
    } finally {
      setGenerating(false)
    }
  }

  async function handleSave() {
    setSaving(true)

    try {
      const res = await fetch("/api/generate/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: generationType,
          data: generatedData,
        }),
      })

      if (!res.ok) throw new Error("Failed to save")

      toast.success("Saved successfully!")

      if (generationType === "workout" || generationType === "cardio") {
        router.push("/plans")
      } else if (generationType === "meal") {
        router.push("/nutrition")
      } else if (generationType === "goals") {
        router.push("/goals")
      }
    } catch {
      toast.error("Failed to save. Please try again.")
    } finally {
      setSaving(false)
    }
  }

  // ── Step 1: Type Selector ──

  function renderTypeSelector() {
    return (
      <div className="space-y-6">
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold">What would you like to create?</h2>
          <p className="text-sm text-muted-foreground">
            Choose a type and our AI will build a personalized plan for you.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {(Object.entries(TYPE_CONFIG) as [GenerationType, (typeof TYPE_CONFIG)[GenerationType]][]).map(
            ([type, config]) => {
              const Icon = config.icon
              return (
                <Card
                  key={type}
                  className="cursor-pointer transition-all hover:ring-2 hover:ring-primary/50 active:scale-[0.98]"
                  onClick={() => handleSelectType(type)}
                >
                  <CardContent className="flex flex-col items-center text-center gap-3 pt-2">
                    <div className="rounded-xl bg-primary/10 p-3">
                      <Icon className="size-6 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">{config.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {config.description}
                      </p>
                    </div>
                  </CardContent>
                </Card>
              )
            }
          )}
        </div>
      </div>
    )
  }

  // ── Step 2: Form Fields ──

  function renderFormFields() {
    if (!generationType) return null

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={handleBack}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold">
              {TYPE_CONFIG[generationType].title}
            </h2>
            <p className="text-xs text-muted-foreground">
              Fill in your preferences below
            </p>
          </div>
        </div>

        <div className="space-y-4">
          {generationType === "workout" && renderWorkoutFields()}
          {generationType === "cardio" && renderCardioFields()}
          {generationType === "meal" && renderMealFields()}
          {generationType === "goals" && renderGoalsFields()}
        </div>

        <Button className="w-full" onClick={handleStartChat} disabled={generating}>
          {generating ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Starting...
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              Generate
            </>
          )}
        </Button>
      </div>
    )
  }

  function renderWorkoutFields() {
    return (
      <>
        <FormSelect
          label="Goal"
          value={fields.goal as string}
          onChange={(v) => updateField("goal", v)}
          options={[
            { value: "muscle_building", label: "Muscle building" },
            { value: "strength", label: "Strength" },
            { value: "athletic_performance", label: "Athletic performance" },
            { value: "general_fitness", label: "General fitness" },
          ]}
        />
        <div className="space-y-1.5">
          <Label>Days per week</Label>
          <Input
            type="number"
            min={2}
            max={6}
            placeholder="3"
            value={fields.days_per_week ?? ""}
            onChange={(e) =>
              updateField("days_per_week", parseInt(e.target.value) || "")
            }
          />
        </div>
        <FormSelect
          label="Experience"
          value={fields.experience as string}
          onChange={(v) => updateField("experience", v)}
          options={[
            { value: "beginner", label: "Beginner" },
            { value: "intermediate", label: "Intermediate" },
            { value: "advanced", label: "Advanced" },
          ]}
        />
        <FormSelect
          label="Equipment"
          value={fields.equipment as string}
          onChange={(v) => updateField("equipment", v)}
          options={[
            { value: "gym", label: "Gym" },
            { value: "home_dumbbells", label: "Home dumbbells" },
            { value: "bodyweight", label: "Bodyweight only" },
          ]}
        />
        <FormSelect
          label="Duration"
          value={fields.duration as string}
          onChange={(v) => updateField("duration", v)}
          options={[
            { value: "4", label: "4 weeks" },
            { value: "8", label: "8 weeks" },
            { value: "12", label: "12 weeks" },
          ]}
        />
      </>
    )
  }

  function renderCardioFields() {
    return (
      <>
        <FormSelect
          label="Goal"
          value={fields.goal as string}
          onChange={(v) => updateField("goal", v)}
          options={[
            { value: "fat_loss", label: "Fat loss" },
            { value: "endurance", label: "Endurance" },
            { value: "race_prep", label: "Race prep" },
            { value: "general_health", label: "General health" },
          ]}
        />
        <div className="space-y-1.5">
          <Label>Days per week</Label>
          <Input
            type="number"
            min={2}
            max={6}
            placeholder="3"
            value={fields.days_per_week ?? ""}
            onChange={(e) =>
              updateField("days_per_week", parseInt(e.target.value) || "")
            }
          />
        </div>
        <FormSelect
          label="Fitness level"
          value={fields.fitness_level as string}
          onChange={(v) => updateField("fitness_level", v)}
          options={[
            { value: "sedentary", label: "Sedentary" },
            { value: "lightly_active", label: "Lightly active" },
            { value: "active", label: "Active" },
            { value: "very_active", label: "Very active" },
          ]}
        />
        <FormSelect
          label="Preferred cardio"
          value={fields.preferred_cardio as string}
          onChange={(v) => updateField("preferred_cardio", v)}
          options={[
            { value: "running", label: "Running" },
            { value: "cycling", label: "Cycling" },
            { value: "swimming", label: "Swimming" },
            { value: "mixed", label: "Mixed" },
          ]}
        />
      </>
    )
  }

  function renderMealFields() {
    return (
      <>
        <FormSelect
          label="Goal"
          value={fields.goal as string}
          onChange={(v) => updateField("goal", v)}
          options={[
            { value: "weight_loss", label: "Weight loss" },
            { value: "maintenance", label: "Maintenance" },
            { value: "muscle_gain", label: "Muscle gain" },
          ]}
        />
        <div className="space-y-1.5">
          <Label>Daily calories</Label>
          <Input
            type="number"
            min={1000}
            max={6000}
            placeholder="2000"
            value={fields.daily_calories ?? ""}
            onChange={(e) =>
              updateField("daily_calories", parseInt(e.target.value) || "")
            }
          />
        </div>
        <FormSelect
          label="Dietary restrictions"
          value={fields.dietary_restrictions as string}
          onChange={(v) => updateField("dietary_restrictions", v)}
          options={[
            { value: "none", label: "None" },
            { value: "vegetarian", label: "Vegetarian" },
            { value: "vegan", label: "Vegan" },
            { value: "keto", label: "Keto" },
            { value: "gluten_free", label: "Gluten-free" },
          ]}
        />
        <FormSelect
          label="Meals per day"
          value={fields.meals_per_day as string}
          onChange={(v) => updateField("meals_per_day", v)}
          options={[
            { value: "3", label: "3" },
            { value: "4", label: "4" },
            { value: "5", label: "5" },
          ]}
        />
      </>
    )
  }

  function renderGoalsFields() {
    return (
      <>
        <FormSelect
          label="Area"
          value={fields.area as string}
          onChange={(v) => updateField("area", v)}
          options={[
            { value: "weight", label: "Weight" },
            { value: "strength", label: "Strength" },
            { value: "activity", label: "Activity" },
            { value: "nutrition", label: "Nutrition" },
            { value: "body_composition", label: "Body composition" },
          ]}
        />
        <div className="space-y-1.5">
          <Label>Current status</Label>
          <Input
            type="text"
            placeholder="e.g. 180 lbs, sedentary lifestyle"
            value={fields.current_status ?? ""}
            onChange={(e) => updateField("current_status", e.target.value)}
          />
        </div>
        <FormSelect
          label="Timeframe"
          value={fields.timeframe as string}
          onChange={(v) => updateField("timeframe", v)}
          options={[
            { value: "1_month", label: "1 month" },
            { value: "3_months", label: "3 months" },
            { value: "6_months", label: "6 months" },
            { value: "1_year", label: "1 year" },
          ]}
        />
      </>
    )
  }

  // ── Step 3: Chat Interface ──

  function renderChat() {
    return (
      <div className="flex flex-col h-[calc(100vh-12rem)]">
        <div className="flex items-center gap-3 mb-4">
          <Button variant="ghost" size="icon-sm" onClick={handleBack}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold">Refine your plan</h2>
            <p className="text-xs text-muted-foreground">
              Answer a few follow-up questions
            </p>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto space-y-3 pb-4">
          {chatMessages.map((msg, i) => (
            <div
              key={i}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted"
                }`}
              >
                {msg.content}
              </div>
            </div>
          ))}
          {generating && (
            <div className="flex justify-start">
              <div className="bg-muted rounded-2xl px-4 py-2.5 text-sm">
                <Loader2 className="size-4 animate-spin" />
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        <Separator />

        <div className="pt-3 space-y-3">
          <div className="flex gap-2">
            <Textarea
              placeholder="Type your response..."
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              className="min-h-10 max-h-24"
            />
            <Button
              size="icon"
              onClick={handleSendMessage}
              disabled={!chatInput.trim() || generating}
            >
              <Send className="size-4" />
            </Button>
          </div>

          {ready && (
            <Button
              className="w-full"
              onClick={handleGenerate}
              disabled={generating}
            >
              {generating ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Sparkles className="size-4" />
                  Generate Plan
                </>
              )}
            </Button>
          )}
        </div>
      </div>
    )
  }

  // ── Step 4: Preview ──

  function renderPreview() {
    if (!generatedData || !generationType) return null

    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon-sm" onClick={handleBack}>
            <ArrowLeft className="size-4" />
          </Button>
          <div>
            <h2 className="text-lg font-semibold">Preview</h2>
            <p className="text-xs text-muted-foreground">
              Review your generated plan before saving
            </p>
          </div>
        </div>

        {(generationType === "workout" || generationType === "cardio") &&
          renderWorkoutPreview()}
        {generationType === "meal" && renderMealPreview()}
        {generationType === "goals" && renderGoalsPreview()}

        <Button
          className="w-full"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Saving...
            </>
          ) : (
            "Save"
          )}
        </Button>
      </div>
    )
  }

  function renderWorkoutPreview() {
    const weeks = generatedData?.weeks || []
    return (
      <div className="space-y-3">
        {generatedData?.name && (
          <h3 className="font-semibold">{generatedData.name}</h3>
        )}
        {weeks.map((week: any, wi: number) => {
          const weekKey = `week-${wi}`
          const isExpanded = expandedSections[weekKey] ?? wi === 0
          return (
            <Card key={wi} size="sm">
              <CardHeader
                className="cursor-pointer"
                onClick={() => toggleSection(weekKey)}
              >
                <CardTitle className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="size-4" />
                  ) : (
                    <ChevronRight className="size-4" />
                  )}
                  Week {wi + 1}
                  {week.name && (
                    <span className="text-muted-foreground font-normal">
                      - {week.name}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              {isExpanded && (
                <CardContent className="space-y-3">
                  {(week.workouts || []).map((workout: any, woi: number) => (
                    <div key={woi} className="space-y-1.5">
                      <p className="text-sm font-medium">{workout.name || `Day ${woi + 1}`}</p>
                      {(workout.exercises || []).map((ex: any, ei: number) => (
                        <div
                          key={ei}
                          className="flex items-center justify-between text-xs text-muted-foreground pl-3"
                        >
                          <span>{ex.name}</span>
                          <span>
                            {ex.sets} x {ex.reps}
                            {ex.weight && ` @ ${ex.weight}`}
                          </span>
                        </div>
                      ))}
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>
    )
  }

  function renderMealPreview() {
    const days = generatedData?.days || []
    return (
      <div className="space-y-3">
        {generatedData?.name && (
          <h3 className="font-semibold">{generatedData.name}</h3>
        )}
        {days.map((day: any, di: number) => {
          const dayKey = `day-${di}`
          const isExpanded = expandedSections[dayKey] ?? di === 0
          return (
            <Card key={di} size="sm">
              <CardHeader
                className="cursor-pointer"
                onClick={() => toggleSection(dayKey)}
              >
                <CardTitle className="flex items-center gap-2">
                  {isExpanded ? (
                    <ChevronDown className="size-4" />
                  ) : (
                    <ChevronRight className="size-4" />
                  )}
                  {day.name || `Day ${di + 1}`}
                </CardTitle>
              </CardHeader>
              {isExpanded && (
                <CardContent className="space-y-3">
                  {(day.meals || []).map((meal: any, mi: number) => (
                    <div key={mi} className="space-y-1.5">
                      <p className="text-sm font-medium">{meal.name}</p>
                      {(meal.foods || []).map((food: any, fi: number) => (
                        <div
                          key={fi}
                          className="flex items-center justify-between text-xs text-muted-foreground pl-3"
                        >
                          <span>{food.name}</span>
                          <div className="flex gap-2">
                            {food.calories && (
                              <Badge variant="secondary">{food.calories} cal</Badge>
                            )}
                            {food.protein && (
                              <Badge variant="outline">{food.protein}g P</Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>
    )
  }

  function renderGoalsPreview() {
    const goals = generatedData?.goals || []
    return (
      <div className="space-y-3">
        {goals.map((goal: any, gi: number) => (
          <Card key={gi} size="sm">
            <CardHeader>
              <CardTitle>{goal.title}</CardTitle>
              {goal.category && (
                <CardDescription>
                  <Badge variant="secondary">{goal.category}</Badge>
                </CardDescription>
              )}
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{goal.description}</p>
              {goal.target && (
                <p className="text-sm font-medium mt-2">
                  Target: {goal.target}
                </p>
              )}
              {goal.timeframe && (
                <p className="text-xs text-muted-foreground mt-1">
                  Timeframe: {goal.timeframe}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    )
  }

  // ── Main Render ──

  return (
    <div className="min-h-screen bg-background">
      <Header title="AI Generate" />
      <main className="px-4 py-6 pb-24 max-w-lg mx-auto">
        {step === 1 && renderTypeSelector()}
        {step === 2 && renderFormFields()}
        {step === 3 && renderChat()}
        {step === 4 && renderPreview()}
      </main>
    </div>
  )
}

// ── Reusable Form Select ──

function FormSelect({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: string | undefined
  onChange: (value: string) => void
  options: { value: string; label: string }[]
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Select value={value ?? ""} onValueChange={(v) => v && onChange(v)}>
        <SelectTrigger className="w-full">
          <SelectValue placeholder={`Select ${label.toLowerCase()}`} />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}
