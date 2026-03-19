"use client"

import { useState, useEffect } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sparkles,
  ChevronDown,
  ChevronUp,
  Dumbbell,
  UtensilsCrossed,
  Footprints,
  Heart,
  Loader2,
} from "lucide-react"
import { format } from "date-fns"

interface Suggestion {
  text: string
  category: "nutrition" | "workout" | "activity" | "recovery"
}

interface Briefing {
  yesterdayRecap: string
  suggestions: Suggestion[]
}

interface CachedBriefing {
  date: string
  briefing: Briefing
}

const CACHE_KEY = "dailyBriefing"

const categoryIcon: Record<string, React.ReactNode> = {
  nutrition: <UtensilsCrossed className="h-3.5 w-3.5" />,
  workout: <Dumbbell className="h-3.5 w-3.5" />,
  activity: <Footprints className="h-3.5 w-3.5" />,
  recovery: <Heart className="h-3.5 w-3.5" />,
}

const categoryColor: Record<string, string> = {
  nutrition: "text-green-500",
  workout: "text-blue-500",
  activity: "text-orange-500",
  recovery: "text-purple-500",
}

export function DailyBriefing() {
  const [briefing, setBriefing] = useState<Briefing | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(true)
  const today = format(new Date(), "yyyy-MM-dd")

  // Load cached briefing on mount
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY)
      if (cached) {
        const parsed: CachedBriefing = JSON.parse(cached)
        if (parsed.date === today) {
          setBriefing(parsed.briefing)
        }
      }
    } catch {
      // ignore parse errors
    }
  }, [today])

  async function handleGenerate() {
    setLoading(true)
    try {
      const res = await fetch("/api/daily-briefing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })

      if (!res.ok) throw new Error("Failed to generate briefing")

      const data = await res.json()
      const b = data.briefing as Briefing
      setBriefing(b)
      setExpanded(true)

      // Cache for today
      localStorage.setItem(
        CACHE_KEY,
        JSON.stringify({ date: today, briefing: b })
      )
    } catch (err) {
      console.error("Briefing error:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Card className="border-purple-500/20 bg-gradient-to-br from-purple-500/5 to-blue-500/5">
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-purple-500" />
            <CardTitle className="text-sm font-medium">
              Daily Briefing
            </CardTitle>
          </div>
          <div className="flex items-center gap-2">
            {briefing && (
              <Button
                variant="ghost"
                size="icon-sm"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? (
                  <ChevronUp className="h-4 w-4" />
                ) : (
                  <ChevronDown className="h-4 w-4" />
                )}
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={handleGenerate}
              disabled={loading}
              className="h-7 text-xs"
            >
              {loading ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1" />
              ) : (
                <Sparkles className="h-3 w-3 mr-1" />
              )}
              {briefing ? "Refresh" : "Generate"}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loading && !briefing && (
          <div className="space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-4 w-1/2" />
          </div>
        )}

        {!briefing && !loading && (
          <p className="text-sm text-muted-foreground">
            Get an AI-powered recap of yesterday and personalized suggestions
            for today.
          </p>
        )}

        {briefing && !expanded && (
          <p className="text-sm text-muted-foreground line-clamp-1">
            {briefing.yesterdayRecap}
          </p>
        )}

        {briefing && expanded && (
          <div className="space-y-4">
            {/* Yesterday Recap */}
            <div>
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                Yesterday
              </p>
              <p className="text-sm leading-relaxed">
                {briefing.yesterdayRecap}
              </p>
            </div>

            {/* Today's Suggestions */}
            {briefing.suggestions.length > 0 && (
              <div>
                <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">
                  Today&apos;s Focus
                </p>
                <div className="space-y-2">
                  {briefing.suggestions.map((s, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-2.5 rounded-lg bg-background/60 px-3 py-2"
                    >
                      <span
                        className={`mt-0.5 ${categoryColor[s.category] || "text-muted-foreground"}`}
                      >
                        {categoryIcon[s.category] || (
                          <Sparkles className="h-3.5 w-3.5" />
                        )}
                      </span>
                      <p className="text-sm">{s.text}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
