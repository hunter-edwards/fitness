"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  LayoutDashboard, UtensilsCrossed, Dumbbell,
  CalendarDays, Menu,
} from "lucide-react"
import { cn } from "@/lib/utils"

const navItems = [
  { label: 'Home', href: '/dashboard', icon: LayoutDashboard },
  { label: 'Nutrition', href: '/nutrition', icon: UtensilsCrossed },
  { label: 'Workout', href: '/workouts', icon: Dumbbell },
  { label: 'Calendar', href: '/calendar', icon: CalendarDays },
  { label: 'More', href: '/insights', icon: Menu },
]

export function BottomNav() {
  const pathname = usePathname()

  return (
    <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-50 bg-card border-t safe-area-bottom">
      <div className="flex items-center justify-around h-16">
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = pathname.startsWith(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center gap-1 px-3 py-2 rounded-lg min-w-[64px] transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
