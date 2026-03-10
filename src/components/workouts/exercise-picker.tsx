"use client"

import { useState, useMemo } from "react"
import { cn } from "@/lib/utils"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Badge } from "@/components/ui/badge"
import { Search, Dumbbell } from "lucide-react"

export interface ExerciseItem {
  id: string
  name: string
  category: string | null
  equipment: string | null
  muscle_groups: string[] | null
}

interface ExercisePickerProps {
  exercises: ExerciseItem[]
  onSelect: (exercise: ExerciseItem) => void
  selectedIds?: string[]
}

const CATEGORIES = [
  "all",
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

export function ExercisePicker({
  exercises,
  onSelect,
  selectedIds = [],
}: ExercisePickerProps) {
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState<string>("all")

  const filtered = useMemo(() => {
    return exercises.filter((ex) => {
      const matchesSearch =
        !search ||
        ex.name.toLowerCase().includes(search.toLowerCase()) ||
        ex.muscle_groups?.some((m) =>
          m.toLowerCase().includes(search.toLowerCase())
        )
      const matchesCategory =
        activeCategory === "all" ||
        ex.category?.toLowerCase() === activeCategory
      return matchesSearch && matchesCategory
    })
  }, [exercises, search, activeCategory])

  return (
    <div className="flex flex-col gap-3">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Search exercises..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Category filter */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "shrink-0 rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors",
              activeCategory === cat
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:text-foreground"
            )}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Exercise list */}
      <ScrollArea className="h-[300px]">
        <div className="space-y-1">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
              <Dumbbell className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No exercises found</p>
            </div>
          ) : (
            filtered.map((exercise) => {
              const isSelected = selectedIds.includes(exercise.id)
              return (
                <button
                  key={exercise.id}
                  onClick={() => onSelect(exercise)}
                  className={cn(
                    "w-full flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                    isSelected
                      ? "bg-primary/10 ring-1 ring-primary/30"
                      : "hover:bg-accent/50"
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">
                      {exercise.name}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {exercise.category && (
                        <span className="text-xs text-muted-foreground capitalize">
                          {exercise.category}
                        </span>
                      )}
                      {exercise.equipment && (
                        <span className="text-xs text-muted-foreground capitalize">
                          {exercise.equipment}
                        </span>
                      )}
                    </div>
                  </div>
                  {exercise.muscle_groups && exercise.muscle_groups.length > 0 && (
                    <div className="flex gap-1 shrink-0">
                      {exercise.muscle_groups.slice(0, 2).map((mg) => (
                        <Badge
                          key={mg}
                          variant="secondary"
                          className="text-[10px] capitalize"
                        >
                          {mg}
                        </Badge>
                      ))}
                    </div>
                  )}
                </button>
              )
            })
          )}
        </div>
      </ScrollArea>
    </div>
  )
}
