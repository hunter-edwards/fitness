"use client"

import { Activity } from "lucide-react"

export function Header({ title }: { title?: string }) {
  return (
    <header className="sticky top-0 z-40 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b lg:hidden">
      <div className="flex items-center gap-3 px-4 h-14">
        <Activity className="h-6 w-6 text-primary" />
        <h1 className="text-lg font-semibold">{title || "FitTrack"}</h1>
      </div>
    </header>
  )
}
