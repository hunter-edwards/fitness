"use client"

import { useState, useEffect } from "react"
import { Header } from "@/components/layout/header"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Sparkles,
  Trophy,
  ArrowUp,
  Target,
  Loader2,
  Calendar,
  CheckCircle2,
  AlertCircle,
} from "lucide-react"

interface ReportSection {
  title: string
  grade: string
  body: string
}

interface Report {
  title: string
  grade: string
  summary: string
  sections: ReportSection[]
  wins: string[]
  improvements: string[]
  focusNextPeriod: string
}

interface CachedReport {
  period: string
  generatedAt: string
  report: Report
  periodLabel: string
}

const CACHE_KEY_PREFIX = "fitnessReport_"

function gradeColor(grade: string): string {
  const g = grade.replace("+", "").replace("-", "")
  switch (g) {
    case "A":
      return "text-green-500 bg-green-500/10 border-green-500/30"
    case "B":
      return "text-blue-500 bg-blue-500/10 border-blue-500/30"
    case "C":
      return "text-yellow-500 bg-yellow-500/10 border-yellow-500/30"
    case "D":
      return "text-orange-500 bg-orange-500/10 border-orange-500/30"
    case "F":
      return "text-red-500 bg-red-500/10 border-red-500/30"
    default:
      return "text-muted-foreground bg-muted border-border"
  }
}

export default function ReportsPage() {
  const [period, setPeriod] = useState<"weekly" | "monthly">("weekly")
  const [report, setReport] = useState<Report | null>(null)
  const [periodLabel, setPeriodLabel] = useState("")
  const [loading, setLoading] = useState(false)

  // Load cached report on mount and period change
  useEffect(() => {
    try {
      const cached = localStorage.getItem(CACHE_KEY_PREFIX + period)
      if (cached) {
        const parsed: CachedReport = JSON.parse(cached)
        // Cache valid for 1 day
        const cacheAge =
          Date.now() - new Date(parsed.generatedAt).getTime()
        if (cacheAge < 24 * 60 * 60 * 1000) {
          setReport(parsed.report)
          setPeriodLabel(parsed.periodLabel)
          return
        }
      }
    } catch {
      // ignore
    }
    setReport(null)
    setPeriodLabel("")
  }, [period])

  async function handleGenerate() {
    setLoading(true)
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ period }),
      })

      if (!res.ok) throw new Error("Failed to generate report")

      const data = await res.json()
      setReport(data.report)
      setPeriodLabel(data.period)

      // Cache
      localStorage.setItem(
        CACHE_KEY_PREFIX + period,
        JSON.stringify({
          period,
          generatedAt: new Date().toISOString(),
          report: data.report,
          periodLabel: data.period,
        })
      )
    } catch (err) {
      console.error("Report error:", err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <Header title="AI Reports" />
      <div className="p-4 lg:p-8 space-y-6 max-w-2xl mx-auto">
        <div className="hidden lg:block">
          <h1 className="text-3xl font-bold">AI Reports</h1>
          <p className="text-muted-foreground">
            Detailed AI-generated progress reports
          </p>
        </div>

        {/* Period Toggle */}
        <div className="flex gap-2">
          <Button
            variant={period === "weekly" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod("weekly")}
          >
            <Calendar className="h-4 w-4 mr-1.5" />
            Weekly
          </Button>
          <Button
            variant={period === "monthly" ? "default" : "outline"}
            size="sm"
            onClick={() => setPeriod("monthly")}
          >
            <Calendar className="h-4 w-4 mr-1.5" />
            Monthly
          </Button>
        </div>

        {/* Generate Button */}
        <Button
          onClick={handleGenerate}
          disabled={loading}
          className="w-full"
          variant="outline"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin mr-2" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          {report ? `Regenerate ${period} report` : `Generate ${period} report`}
        </Button>

        {/* Loading state */}
        {loading && !report && (
          <div className="space-y-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
          </div>
        )}

        {/* No report yet */}
        {!report && !loading && (
          <Card>
            <CardContent className="py-12 text-center">
              <Sparkles className="h-8 w-8 mx-auto mb-3 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Generate an AI-powered {period} report to see your progress,
                grades, and personalized recommendations.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Report Display */}
        {report && (
          <div className="space-y-4">
            {/* Header Card */}
            <Card>
              <CardContent className="py-5">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wider">
                      {periodLabel}
                    </p>
                    <h2 className="text-lg font-bold mt-0.5">
                      {report.title}
                    </h2>
                  </div>
                  <div
                    className={`px-3 py-1.5 rounded-lg border text-lg font-bold ${gradeColor(report.grade)}`}
                  >
                    {report.grade}
                  </div>
                </div>
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {report.summary}
                </p>
              </CardContent>
            </Card>

            {/* Section Cards */}
            {report.sections.map((section, i) => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm font-medium">
                      {section.title}
                    </CardTitle>
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold border ${gradeColor(section.grade)}`}
                    >
                      {section.grade}
                    </span>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm leading-relaxed">{section.body}</p>
                </CardContent>
              </Card>
            ))}

            {/* Wins */}
            {report.wins.length > 0 && (
              <Card className="border-green-500/20">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <Trophy className="h-4 w-4 text-green-500" />
                    <CardTitle className="text-sm font-medium">Wins</CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {report.wins.map((win, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                      <p className="text-sm">{win}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Improvements */}
            {report.improvements.length > 0 && (
              <Card className="border-amber-500/20">
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <ArrowUp className="h-4 w-4 text-amber-500" />
                    <CardTitle className="text-sm font-medium">
                      Areas to Improve
                    </CardTitle>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {report.improvements.map((item, i) => (
                    <div key={i} className="flex items-start gap-2">
                      <AlertCircle className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                      <p className="text-sm">{item}</p>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Focus for Next Period */}
            {report.focusNextPeriod && (
              <Card className="border-blue-500/20 bg-blue-500/5">
                <CardContent className="py-4">
                  <div className="flex items-start gap-3">
                    <Target className="h-5 w-5 text-blue-500 mt-0.5 shrink-0" />
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">
                        Focus for Next{" "}
                        {period === "monthly" ? "Month" : "Week"}
                      </p>
                      <p className="text-sm leading-relaxed">
                        {report.focusNextPeriod}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </>
  )
}
