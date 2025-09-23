'use client'

import { useState } from 'react'
import { useTokenStore } from '@/stores/useTokenStore'
import { DEFAULT_FILTER_PRESETS } from '@/types/filters'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  Filter,
  ChevronDown,
  ChevronRight,
  Plus,
  Star,
  BarChart3,
  Shield,
  TrendingUp,
  Clock,
} from 'lucide-react'

export function Sidebar() {
  const [isFilterOpen, setIsFilterOpen] = useState(true)
  const [isPresetsOpen, setIsPresetsOpen] = useState(true)

  const {
    activeFilters,
    customFilters,
    toggleFilterActive,
    removeFilter,
  } = useTokenStore()

  const allFilters = [...DEFAULT_FILTER_PRESETS, ...customFilters]

  const getFilterIcon = (filterId: string) => {
    switch (filterId) {
      case 'safe-new-tokens':
        return <Shield className="h-4 w-4" />
      case 'high-volume':
        return <TrendingUp className="h-4 w-4" />
      case 'established-safe':
        return <Star className="h-4 w-4" />
      case 'micro-cap':
        return <BarChart3 className="h-4 w-4" />
      default:
        return <Filter className="h-4 w-4" />
    }
  }

  return (
    <aside className="w-80 border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="flex h-16 items-center px-6 border-b">
        <div className="flex items-center space-x-2">
          <Filter className="h-5 w-5" />
          <span className="font-semibold">Filters & Presets</span>
        </div>
      </div>

      <ScrollArea className="flex-1 px-4 py-6">
        <div className="space-y-6">
          {/* Active Filters */}
          <Collapsible open={isFilterOpen} onOpenChange={setIsFilterOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 h-auto">
                <div className="flex items-center space-x-2">
                  <span className="font-medium">Active Filters</span>
                  <Badge variant="secondary" className="text-xs">
                    {activeFilters.length}
                  </Badge>
                </div>
                {isFilterOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 mt-4">
              {activeFilters.length === 0 ? (
                <p className="text-sm text-muted-foreground">No active filters</p>
              ) : (
                activeFilters.map((filter) => (
                  <div
                    key={filter.id}
                    className="flex items-center justify-between p-3 rounded-lg border bg-card"
                  >
                    <div className="flex items-center space-x-3">
                      {getFilterIcon(filter.id)}
                      <div>
                        <div className="text-sm font-medium">{filter.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {filter.conditions.length} conditions
                        </div>
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleFilterActive(filter.id)}
                      className="h-8 w-8 p-0"
                    >
                      ×
                    </Button>
                  </div>
                ))
              )}
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Filter Presets */}
          <Collapsible open={isPresetsOpen} onOpenChange={setIsPresetsOpen}>
            <CollapsibleTrigger asChild>
              <Button variant="ghost" className="w-full justify-between p-0 h-auto">
                <div className="flex items-center space-x-2">
                  <span className="font-medium">Filter Presets</span>
                </div>
                {isPresetsOpen ? (
                  <ChevronDown className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="space-y-2 mt-4">
              {/* Default Presets */}
              <div className="space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Default Presets
                </h4>
                {DEFAULT_FILTER_PRESETS.map((preset) => {
                  const isActive = activeFilters.some(f => f.id === preset.id)
                  return (
                    <Button
                      key={preset.id}
                      variant={isActive ? "default" : "ghost"}
                      className="w-full justify-start h-auto p-3 text-left"
                      onClick={() => toggleFilterActive(preset.id)}
                    >
                      <div className="flex items-start space-x-3">
                        {getFilterIcon(preset.id)}
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium">{preset.name}</div>
                          <div className="text-xs text-muted-foreground line-clamp-2">
                            {preset.description}
                          </div>
                          {preset.isDefault && (
                            <Badge variant="outline" className="text-xs mt-1">
                              Recommended
                            </Badge>
                          )}
                        </div>
                      </div>
                    </Button>
                  )
                })}
              </div>

              {/* Custom Filters */}
              {customFilters.length > 0 && (
                <>
                  <Separator className="my-4" />
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                      Custom Filters
                    </h4>
                    {customFilters.map((filter) => {
                      const isActive = activeFilters.some(f => f.id === filter.id)
                      return (
                        <div key={filter.id} className="group relative">
                          <Button
                            variant={isActive ? "default" : "ghost"}
                            className="w-full justify-start h-auto p-3 text-left"
                            onClick={() => toggleFilterActive(filter.id)}
                          >
                            <div className="flex items-start space-x-3">
                              <Filter className="h-4 w-4" />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm font-medium">{filter.name}</div>
                                <div className="text-xs text-muted-foreground line-clamp-2">
                                  {filter.description}
                                </div>
                              </div>
                            </div>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="absolute top-1 right-1 h-6 w-6 p-0 opacity-0 group-hover:opacity-100"
                            onClick={(e) => {
                              e.stopPropagation()
                              removeFilter(filter.id)
                            }}
                          >
                            ×
                          </Button>
                        </div>
                      )
                    })}
                  </div>
                </>
              )}

              {/* Create New Filter */}
              <Separator className="my-4" />
              <Button variant="outline" className="w-full justify-start">
                <Plus className="h-4 w-4 mr-2" />
                Create Custom Filter
              </Button>
            </CollapsibleContent>
          </Collapsible>

          <Separator />

          {/* Quick Stats */}
          <div className="space-y-3">
            <h4 className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Quick Stats
            </h4>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg border bg-card">
                <div className="text-2xl font-bold">24</div>
                <div className="text-xs text-muted-foreground">New tokens</div>
              </div>
              <div className="p-3 rounded-lg border bg-card">
                <div className="text-2xl font-bold">8.2</div>
                <div className="text-xs text-muted-foreground">Avg safety</div>
              </div>
            </div>
          </div>
        </div>
      </ScrollArea>
    </aside>
  )
}