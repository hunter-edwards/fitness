"use client"

import { cn } from "@/lib/utils"

interface MacroRingProps {
  current: number
  target: number
  label: string
  color?: string
  size?: number
}

export function MacroRing({
  current,
  target,
  label,
  color,
  size = 72,
}: MacroRingProps) {
  const percentage = target > 0 ? Math.min((current / target) * 100, 100) : 0
  const strokeWidth = 5
  const radius = (size - strokeWidth) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference - (percentage / 100) * circumference

  const progressColor =
    color ??
    (percentage >= 90
      ? "text-green-500"
      : percentage >= 70
        ? "text-yellow-500"
        : "text-red-500")

  const strokeColor = color
    ? undefined
    : percentage >= 90
      ? "#22c55e"
      : percentage >= 70
        ? "#eab308"
        : "#ef4444"

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          className="-rotate-90"
        >
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-muted/40"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className={cn(
              "transition-all duration-500 ease-out",
              color ? color : undefined
            )}
            style={color ? { stroke: "currentColor" } : undefined}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className={cn(
              "text-xs font-semibold",
              color ? color : progressColor
            )}
          >
            {Math.round(percentage)}%
          </span>
        </div>
      </div>
      <div className="text-center">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-xs tabular-nums">
          <span className="font-semibold">{Math.round(current)}</span>
          <span className="text-muted-foreground">/{target}</span>
        </p>
      </div>
    </div>
  )
}
