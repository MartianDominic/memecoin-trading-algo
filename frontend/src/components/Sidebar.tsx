"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import {
  Home,
  Filter,
  Bell,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Activity,
  Users,
  Clock,
  Settings
} from "lucide-react"

interface SidebarProps {
  onFilterChange: (filterId: string) => void
  activeFilter: string
}

const filterPresets = [
  {
    id: "all",
    name: "All Tokens",
    icon: Home,
    count: 1234,
  },
  {
    id: "trending",
    name: "Trending",
    icon: TrendingUp,
    count: 45,
    badge: "Hot",
  },
  {
    id: "gainers",
    name: "Top Gainers",
    icon: TrendingUp,
    count: 23,
    badge: "+50%",
  },
  {
    id: "losers",
    name: "Top Losers",
    icon: TrendingDown,
    count: 18,
    badge: "-30%",
  },
  {
    id: "high-volume",
    name: "High Volume",
    icon: Activity,
    count: 67,
  },
  {
    id: "new-listings",
    name: "New Listings",
    icon: Clock,
    count: 12,
    badge: "24h",
  },
  {
    id: "high-liquidity",
    name: "High Liquidity",
    icon: DollarSign,
    count: 89,
  },
  {
    id: "many-holders",
    name: "Many Holders",
    icon: Users,
    count: 156,
  },
]

const riskCategories = [
  {
    id: "low-risk",
    name: "Low Risk",
    count: 234,
    color: "bg-green-500",
  },
  {
    id: "medium-risk",
    name: "Medium Risk",
    count: 567,
    color: "bg-yellow-500",
  },
  {
    id: "high-risk",
    name: "High Risk",
    count: 123,
    color: "bg-red-500",
  },
]

export function Sidebar({ onFilterChange, activeFilter }: SidebarProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div className={cn(
      "bg-card border-r transition-all duration-300 ease-in-out",
      collapsed ? "w-16" : "w-64"
    )}>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="p-4 border-b">
          <div className="flex items-center justify-between">
            {!collapsed && (
              <h2 className="text-lg font-semibold">Memecoin Tracker</h2>
            )}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCollapsed(!collapsed)}
            >
              <Filter className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Navigation */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* Filter Presets */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">
                {collapsed ? "F" : "Filters"}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
              {filterPresets.map((preset) => {
                const Icon = preset.icon
                return (
                  <Button
                    key={preset.id}
                    variant={activeFilter === preset.id ? "default" : "ghost"}
                    className="w-full justify-start gap-2"
                    onClick={() => onFilterChange(preset.id)}
                  >
                    <Icon className="h-4 w-4 flex-shrink-0" />
                    {!collapsed && (
                      <>
                        <span className="flex-1 text-left">{preset.name}</span>
                        <div className="flex items-center gap-1">
                          {preset.badge && (
                            <Badge variant="secondary" className="text-xs">
                              {preset.badge}
                            </Badge>
                          )}
                          <span className="text-xs text-muted-foreground">
                            {preset.count}
                          </span>
                        </div>
                      </>
                    )}
                  </Button>
                )
              })}
            </CardContent>
          </Card>

          {/* Risk Categories */}
          {!collapsed && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Risk Levels</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {riskCategories.map((category) => (
                  <Button
                    key={category.id}
                    variant="ghost"
                    className="w-full justify-start gap-2"
                    onClick={() => onFilterChange(category.id)}
                  >
                    <div className={cn("w-3 h-3 rounded-full", category.color)} />
                    <span className="flex-1 text-left">{category.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {category.count}
                    </span>
                  </Button>
                ))}
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          {!collapsed && (
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-medium">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                <Button variant="ghost" className="w-full justify-start gap-2">
                  <Bell className="h-4 w-4" />
                  <span>Create Alert</span>
                </Button>
                <Button variant="ghost" className="w-full justify-start gap-2">
                  <Filter className="h-4 w-4" />
                  <span>Custom Filter</span>
                </Button>
                <Button variant="ghost" className="w-full justify-start gap-2">
                  <Settings className="h-4 w-4" />
                  <span>Settings</span>
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}