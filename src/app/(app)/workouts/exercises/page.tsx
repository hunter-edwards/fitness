"use client"

import { useEffect, useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { useAuth } from "@/hooks/use-auth"
import { Header } from "@/components/layout/header"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import {
  Search,
  Plus,
  Dumbbell,
  ArrowLeft,
} from "lucide-react"
import Link from "next/link"

interface Exercise {
  id: string
  name: string
  category: string | null
  equipment: string | null
  muscle_groups: string[] | null
  exercise_type: string
  is_custom: boolean
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

export default function ExerciseLibraryPage() {
  const { user } = useAuth()
  const router = useRouter()
  const supabase = createClient()
  const [exercises, setExercises] = useState<Exercise[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState("")
  const [activeCategory, setActiveCategory] = useState<string>("all")

  useEffect(() => {
    if (!user) return

    async function fetchExercises() {
      const { data, error } = await supabase
        .from("exercises")
        .select(
          "id, name, category, equipment, muscle_groups, exercise_type, is_custom"
        )
        .or(`user_id.eq.${user!.id},is_custom.eq.false`)
        .order("name")

      if (error) {
        console.error("Error fetching exercises:", error)
      } else {
        setExercises(data || [])
      }
      setLoading(false)
    }

    fetchExercises()
  }, [user, supabase])

  const filtered = useMemo(() => {
    return exercises.filter((ex) => {
      const matchesSearch =
        !search ||
        ex.name.toLowerCase().includes(search.toLowerCase()) ||
        ex.equipment?.toLowerCase().includes(search.toLowerCase()) ||
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
    <>
      <Header title="Exercises" />
      <div className="p-4 lg:p-8 space-y-6">
        {/* Page header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/workouts">
              <Button variant="ghost" size="icon">
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </Link>
            <div className="hidden lg:block">
              <h1 className="text-3xl font-bold">Exercise Library</h1>
              <p className="text-muted-foreground">
                Browse and manage your exercises
              </p>
            </div>
          </div>
          <Link href="/workouts/exercises/new">
            <Button size="sm">
              <Plus className="h-3.5 w-3.5 mr-1" />
              New Exercise
            </Button>
          </Link>
        </div>

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
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Dumbbell className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <h3 className="text-lg font-medium">No exercises found</h3>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              {search || activeCategory !== "all"
                ? "Try adjusting your search or filters"
                : "Create your first exercise to get started"}
            </p>
            {!search && activeCategory === "all" && (
              <Link href="/workouts/exercises/new">
                <Button>
                  <Plus className="h-4 w-4 mr-1.5" />
                  Create Exercise
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="space-y-1.5">
            {filtered.map((exercise) => (
              <Card
                key={exercise.id}
                className="cursor-pointer transition-colors hover:bg-accent/50"
                onClick={() =>
                  router.push(`/workouts/exercises/${exercise.id}`)
                }
              >
                <CardContent className="py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium truncate">
                          {exercise.name}
                        </p>
                        {exercise.is_custom && (
                          <Badge
                            variant="outline"
                            className="text-[10px] shrink-0"
                          >
                            Custom
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-xs text-muted-foreground">
                        {exercise.category && (
                          <span className="capitalize">
                            {exercise.category}
                          </span>
                        )}
                        {exercise.category && exercise.equipment && (
                          <span>-</span>
                        )}
                        {exercise.equipment && (
                          <span className="capitalize">
                            {exercise.equipment}
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      {exercise.muscle_groups &&
                        exercise.muscle_groups.slice(0, 2).map((mg) => (
                          <Badge
                            key={mg}
                            variant="secondary"
                            className="text-[10px] capitalize"
                          >
                            {mg}
                          </Badge>
                        ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        <p className="text-center text-xs text-muted-foreground pb-4">
          {filtered.length} {filtered.length === 1 ? "exercise" : "exercises"}
          {search || activeCategory !== "all" ? " matching filters" : " total"}
        </p>
      </div>
    </>
  )
}
