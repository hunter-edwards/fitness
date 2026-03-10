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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

export default function NewGoalPage() {
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  const [saving, setSaving] = useState(false)
  const [category, setCategory] = useState("weight")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [targetValue, setTargetValue] = useState("")
  const [targetUnit, setTargetUnit] = useState("lbs")
  const [currentValue, setCurrentValue] = useState("")
  const [targetDate, setTargetDate] = useState("")

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!user || !title) return
    setSaving(true)

    const { error } = await supabase.from("goals").insert({
      user_id: user.id,
      category: category as "weight" | "body_fat" | "strength" | "nutrition" | "activity" | "custom",
      title,
      description: description || null,
      target_value: targetValue ? parseFloat(targetValue) : null,
      target_unit: targetUnit || null,
      current_value: currentValue ? parseFloat(currentValue) : null,
      start_date: new Date().toISOString().split("T")[0],
      target_date: targetDate || null,
    })

    if (error) {
      toast.error("Failed to create goal")
    } else {
      toast.success("Goal created!")
      router.push("/goals")
    }
    setSaving(false)
  }

  return (
    <>
      <Header title="New Goal" />
      <div className="p-4 lg:p-8 max-w-lg mx-auto">
        <Card>
          <CardHeader>
            <CardTitle>Create Goal</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSave} className="space-y-4">
              <div className="space-y-2">
                <Label>Category</Label>
                <Select value={category} onValueChange={(v) => v && setCategory(v)}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
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
                  placeholder="e.g., Reach 180 lbs, Bench 225 lbs"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="goal-desc">Description (optional)</Label>
                <Textarea
                  id="goal-desc"
                  placeholder="More details about your goal"
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
                    placeholder="195"
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
                    placeholder="180"
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
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Create Goal
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </>
  )
}
