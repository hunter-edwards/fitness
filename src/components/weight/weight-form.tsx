"use client"

import { useState } from "react"
import { format } from "date-fns"
import { Loader2, Plus } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { lbsToKg } from "@/lib/utils/units"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

interface WeightFormProps {
  userId: string
  onSave: () => void
}

export function WeightForm({ userId, onSave }: WeightFormProps) {
  const [date, setDate] = useState(format(new Date(), "yyyy-MM-dd"))
  const [weightLbs, setWeightLbs] = useState("")
  const [bodyFatPct, setBodyFatPct] = useState("")
  const [notes, setNotes] = useState("")
  const [saving, setSaving] = useState(false)
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!weightLbs || !date) return

    setSaving(true)
    try {
      const weightKg = lbsToKg(parseFloat(weightLbs))
      const { error } = await supabase.from("weight_entries").insert({
        user_id: userId,
        date,
        weight_kg: weightKg,
        body_fat_pct: bodyFatPct ? parseFloat(bodyFatPct) : null,
        notes: notes.trim() || null,
      })

      if (error) throw error

      setWeightLbs("")
      setBodyFatPct("")
      setNotes("")
      setDate(format(new Date(), "yyyy-MM-dd"))
      onSave()
    } catch (err) {
      console.error("Failed to save weight entry:", err)
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Log Weight</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="space-y-1.5">
              <Label htmlFor="weight-date">Date</Label>
              <Input
                id="weight-date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="weight-lbs">Weight (lbs)</Label>
              <Input
                id="weight-lbs"
                type="number"
                step="0.1"
                min="0"
                placeholder="185.0"
                value={weightLbs}
                onChange={(e) => setWeightLbs(e.target.value)}
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="weight-bf">Body Fat %</Label>
              <Input
                id="weight-bf"
                type="number"
                step="0.1"
                min="0"
                max="100"
                placeholder="15.0"
                value={bodyFatPct}
                onChange={(e) => setBodyFatPct(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 col-span-2 sm:col-span-1">
              <Label htmlFor="weight-notes">Notes</Label>
              <Textarea
                id="weight-notes"
                placeholder="Morning, fasted..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="min-h-8 h-8 resize-none"
              />
            </div>
          </div>
          <Button type="submit" disabled={saving || !weightLbs} className="w-full sm:w-auto">
            {saving ? (
              <Loader2 className="animate-spin" />
            ) : (
              <Plus data-icon="inline-start" />
            )}
            {saving ? "Saving..." : "Log Weight"}
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
