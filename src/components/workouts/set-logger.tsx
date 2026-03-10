"use client"

import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Check, Circle } from "lucide-react"

export type SetType = "warmup" | "working" | "dropset" | "failure" | "amrap"

export interface SetLoggerData {
  setNumber: number
  setType: SetType
  reps: number | null
  weight: number | null
  rpe: number | null
  completed: boolean
}

interface SetLoggerProps {
  setNumber: number
  setType: SetType
  reps: number | null
  weight: number | null
  rpe: number | null
  completed: boolean
  onChange: (data: Partial<SetLoggerData>) => void
  onComplete: () => void
}

const setTypeLabels: Record<SetType, { label: string; short: string; color: string }> = {
  warmup: { label: "Warm-up", short: "W", color: "text-yellow-400" },
  working: { label: "Working", short: "S", color: "text-foreground" },
  dropset: { label: "Drop Set", short: "D", color: "text-purple-400" },
  failure: { label: "Failure", short: "F", color: "text-red-400" },
  amrap: { label: "AMRAP", short: "A", color: "text-orange-400" },
}

export function SetLogger({
  setNumber,
  setType,
  reps,
  weight,
  rpe,
  completed,
  onChange,
  onComplete,
}: SetLoggerProps) {
  const typeConfig = setTypeLabels[setType]

  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors",
        completed
          ? "border-green-500/25 bg-green-500/5"
          : "border-border bg-card"
      )}
    >
      {/* Set number and type */}
      <div className="flex items-center gap-1.5 shrink-0 w-16">
        <span className={cn("text-xs font-bold", typeConfig.color)}>
          {typeConfig.short}
        </span>
        <Select
          value={setType}
          onValueChange={(val) => onChange({ setType: val as SetType })}
        >
          <SelectTrigger size="sm" className="h-6 w-10 px-1 text-xs border-0 bg-transparent">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="warmup">Warm-up</SelectItem>
            <SelectItem value="working">Working</SelectItem>
            <SelectItem value="dropset">Drop Set</SelectItem>
            <SelectItem value="failure">Failure</SelectItem>
            <SelectItem value="amrap">AMRAP</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Weight input */}
      <div className="flex-1 min-w-0">
        <Input
          type="number"
          inputMode="decimal"
          placeholder="lbs"
          value={weight ?? ""}
          onChange={(e) =>
            onChange({
              weight: e.target.value ? Number(e.target.value) : null,
            })
          }
          className="h-7 text-center text-sm"
          disabled={completed}
        />
      </div>

      {/* Reps input */}
      <div className="flex-1 min-w-0">
        <Input
          type="number"
          inputMode="numeric"
          placeholder="reps"
          value={reps ?? ""}
          onChange={(e) =>
            onChange({
              reps: e.target.value ? Number(e.target.value) : null,
            })
          }
          className="h-7 text-center text-sm"
          disabled={completed}
        />
      </div>

      {/* RPE input */}
      <div className="w-12 shrink-0">
        <Input
          type="number"
          inputMode="decimal"
          placeholder="RPE"
          min={1}
          max={10}
          step={0.5}
          value={rpe ?? ""}
          onChange={(e) =>
            onChange({
              rpe: e.target.value ? Number(e.target.value) : null,
            })
          }
          className="h-7 text-center text-xs"
          disabled={completed}
        />
      </div>

      {/* Complete button */}
      <Button
        variant={completed ? "default" : "outline"}
        size="icon-sm"
        className={cn(
          "shrink-0",
          completed && "bg-green-600 hover:bg-green-700 text-white"
        )}
        onClick={onComplete}
      >
        {completed ? (
          <Check className="h-3.5 w-3.5" />
        ) : (
          <Circle className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  )
}
