"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { ArrowLeft, Loader2, Save } from "lucide-react"
import { toast } from "sonner"
import Link from "next/link"
import type { Database } from "@/types/database"

type Goal = Database["public"]["Tables"]["goals"]["Row"]

export default function EditGoalPage() {
  const { user } = useAuth()
  const router = useRouter()
  const params = useParams()
  const goalId = params.id as string
  const supabase = createClient()

  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [category, setCategory] = useState("weight")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [targetValue, setTargetValue] = useState("")
  const [targetUnit, setTargetUnit] = useState("")
  const [currentValue, setCurrentValue] = useState("")
  const [targetDate, setTargetDate] = useState("")

  useEffect(() => {
    if (!user || !goalId) return

    async function fetchGoal() {
      const { data, error } = await supabase
        .from("goals")
        .select("*")
        .eq("id", goalId)
        .eq("user_id", user!.id)
        .single()

      if (error || !data) {
        console.error("Error fetching goal:", error)
        setLoading(false)
        return
      }

      setCategory(data.category)
      setTitle(data.title)
      setDescription(data.description ?? "")
      setTargetValue(data.target_value?.toString() ?? "")
      setTargetUnit(data.target_unit ?? "")
      setCurrentValue(data.current_value?.toString() ?? "")
      setTargetDate(data.target_date ?? "")
      setLoading(false)
    }

    fetchGoal()
  }, [user, goalId, supabase])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !title) return
    setSaving(true)

    const { error } = await supabase
      .from("goals")
      .update({
        category: category as Goal["category"],
        title,
        description: description || null,
        target_value: targetValue ? parseFloat(targetValue) : null,
        target_unit: targetUnit || null,
        current_value: currentValue ? parseFloat(currentValue) : null,
        target_date: targetDate || null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", goalId)
      .eq("user_id", user.id)

    if (error) {
      toast.error("Failed to update goal")
    } else {
      toast.success("Goal updated!")
      router.push("/goals")
    }
    setSaving(false)
  }

  if (loading) {
    return (
      <>
        <Header title="Edit Goal" />
        <div className="p-4 lg:p-8 max-w-lg mx-auto space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-96 w-full" />
        </div>
      </>
    )
  }

  return (
    <>
      <Header title="Edit Goal" />
      <div className="p-4 lg:p-8 max-w-lg mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <Link href="/goals">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-xl font-bold">Edit Goal</h1>
        </div>

        <Card>
          <CardContent className="pt-6">
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select
                  value={category}
                  onValueChange={(v) => v && setCategory(v)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weight">Weight</SelectItem>
                    <SelectItem value="body_fat">Body Fat</SelectItem>
                    <SelectItem value="strength">Strength</SelectItem>
                    <SelectItem value="nutrition">Nutrition</SelectItem>
                    <SelectItem value="activity">Activity</SelectItem>
                    <SelectItem value="custom">Custom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="goal-title">Title</Label>
                <Input
                  id="goal-title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goal-desc">Description</Label>
                <Textarea
                  id="goal-desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="current">Current Value</Label>
                  <Input
                    id="current"
                    type="number"
                    step="0.1"
                    value={currentValue}
                    onChange={(e) => setCurrentValue(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target">Target Value</Label>
                  <Input
                    id="target"
                    type="number"
                    step="0.1"
                    value={targetValue}
                    onChange={(e) => setTargetValue(e.target.value)}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="unit">Unit</Label>
                  <Input
                    id="unit"
                    placeholder="lbs, kg, g, steps"
                    value={targetUnit}
                    onChange={(e) => setTargetUnit(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="target-date">Target Date</Label>
                  <Input
                    id="target-date"
                    type="date"
                    value={targetDate}
                    onChange={(e) => setTargetDate(e.target.value)}
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={saving}>
                {saving ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Save className="mr-2 h-4 w-4" />
                )}
                Save Changes
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
