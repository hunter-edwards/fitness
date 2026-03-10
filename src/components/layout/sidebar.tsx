"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, Scale, UtensilsCrossed, Dumbbell,
  ClipboardList, CalendarDays, Footprints, Target,
  TrendingUp, Settings, Activity,
} from "lucide-react"
import { cn } from "@/lib/utils"

const iconMap: Record<string, React.ElementType> = {
  LayoutDashboard, Scale, UtensilsCrossed, Dumbbell,
  ClipboardList, CalendarDays, Footprints, Target,
  TrendingUp, Settings,
}

const navItems = [
  { label: 'Dashboard', href: '/dashboard', icon: 'LayoutDashboard' },
  { label: 'Weight', href: '/weight', icon: 'Scale' },
  { label: 'Nutrition', href: '/nutrition', icon: 'UtensilsCrossed' },
  { label: 'Workouts', href: '/workouts', icon: 'Dumbbell' },
  { label: 'Plans', href: '/plans', icon: 'ClipboardList' },
  { label: 'Calendar', href: '/calendar', icon: 'CalendarDays' },
  { label: 'Activity', href: '/activity', icon: 'Footprints' },
  { label: 'Goals', href: '/goals', icon: 'Target' },
  { label: 'Insights', href: '/insights', icon: 'TrendingUp' },
  { label: 'Settings', href: '/settings', icon: 'Settings' },
]

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:border-r bg-card h-screen sticky top-0">
      <div className="flex items-center gap-2 px-6 py-5 border-b">
        <Activity className="h-7 w-7 text-primary" />
        <span className="text-xl font-bold">FitTrack</span>
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = iconMap[item.icon]
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent"
              )}
            >
              <Icon className="h-5 w-5" />
              {item.label}
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
