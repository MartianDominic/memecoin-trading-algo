'use client'

import { useState } from 'react'
import { useTokenStore } from '@/stores/useTokenStore'
import { FilterCondition, FilterPreset } from '@/types/filters'
import { Token } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { Plus, X, Save, Trash2 } from 'lucide-react'

const FIELD_OPTIONS: { value: keyof Token; label: string }[] = [
  { value: 'price', label: 'Price' },
  { value: 'marketCap', label: 'Market Cap' },
  { value: 'volume24h', label: 'Volume 24h' },
  { value: 'liquidity', label: 'Liquidity' },
  { value: 'safetyScore', label: 'Safety Score' },
  { value: 'age', label: 'Age (hours)' },
  { value: 'slippagePercent', label: 'Slippage %' },
  { value: 'creatorRugCount', label: 'Creator Rug Count' },
  { value: 'topHoldersPercent', label: 'Top Holders %' },
  { value: 'priceChangePercentage24h', label: 'Price Change %' },
  { value: 'holders', label: 'Holders' },
]

const OPERATOR_OPTIONS = [
  { value: 'gt', label: 'Greater than' },
  { value: 'gte', label: 'Greater than or equal' },
  { value: 'lt', label: 'Less than' },
  { value: 'lte', label: 'Less than or equal' },
  { value: 'eq', label: 'Equal to' },
  { value: 'not_eq', label: 'Not equal to' },
]

const BOOLEAN_FIELDS: Array<keyof Token> = ['isHoneypot', 'hasRouting', 'verified', 'liquidityLocked']

export function FilterBuilder() {
  const { addFilter, removeFilter, customFilters } = useTokenStore()

  const [filterName, setFilterName] = useState('')
  const [filterDescription, setFilterDescription] = useState('')
  const [conditions, setConditions] = useState<FilterCondition[]>([
    { field: 'safetyScore', operator: 'gte', value: 6 }
  ])

  const addCondition = () => {
    setConditions([
      ...conditions,
      { field: 'volume24h', operator: 'gt', value: 1000 }
    ])
  }

  const removeCondition = (index: number) => {
    setConditions(conditions.filter((_, i) => i !== index))
  }

  const updateCondition = (index: number, updates: Partial<FilterCondition>) => {
    setConditions(conditions.map((condition, i) =>
      i === index ? { ...condition, ...updates } : condition
    ))
  }

  const saveFilter = () => {
    if (!filterName.trim() || conditions.length === 0) return

    const filter: FilterPreset = {
      id: `custom-${Date.now()}`,
      name: filterName.trim(),
      description: filterDescription.trim() || 'Custom filter',
      conditions,
    }

    addFilter(filter)

    // Reset form
    setFilterName('')
    setFilterDescription('')
    setConditions([{ field: 'safetyScore', operator: 'gte', value: 6 }])
  }

  const isBooleanField = (field: keyof Token) => BOOLEAN_FIELDS.includes(field)

  return (
    <div className="space-y-6">
      {/* Create New Filter */}
      <Card>
        <CardHeader>
          <CardTitle>Create Custom Filter</CardTitle>
          <CardDescription>
            Build a custom filter by adding conditions that tokens must meet
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Filter Details */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="filter-name">Filter Name</Label>
              <Input
                id="filter-name"
                placeholder="e.g., High Volume Safe Tokens"
                value={filterName}
                onChange={(e) => setFilterName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="filter-description">Description (Optional)</Label>
              <Input
                id="filter-description"
                placeholder="Brief description of your filter"
                value={filterDescription}
                onChange={(e) => setFilterDescription(e.target.value)}
              />
            </div>
          </div>

          {/* Conditions */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Conditions</Label>
              <Button onClick={addCondition} size="sm" variant="outline">
                <Plus className="h-4 w-4 mr-1" />
                Add Condition
              </Button>
            </div>

            <div className="space-y-3">
              {conditions.map((condition, index) => (
                <div key={index} className="flex items-center space-x-2 p-3 border rounded-lg">
                  <div className="grid grid-cols-1 md:grid-cols-4 gap-2 flex-1">
                    {/* Field */}
                    <Select
                      value={condition.field}
                      onValueChange={(value) => updateCondition(index, { field: value as keyof Token })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {FIELD_OPTIONS.map(option => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                        <Separator />
                        <SelectItem value="isHoneypot">Is Honeypot</SelectItem>
                        <SelectItem value="hasRouting">Has Routing</SelectItem>
                        <SelectItem value="verified">Verified</SelectItem>
                        <SelectItem value="liquidityLocked">Liquidity Locked</SelectItem>
                      </SelectContent>
                    </Select>

                    {/* Operator */}
                    <Select
                      value={condition.operator}
                      onValueChange={(value) => updateCondition(index, { operator: value as FilterCondition['operator'] })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {isBooleanField(condition.field) ? (
                          <>
                            <SelectItem value="eq">Is</SelectItem>
                            <SelectItem value="not_eq">Is Not</SelectItem>
                          </>
                        ) : (
                          OPERATOR_OPTIONS.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>

                    {/* Value */}
                    <div className="md:col-span-2">
                      {isBooleanField(condition.field) ? (
                        <Select
                          value={String(condition.value)}
                          onValueChange={(value) => updateCondition(index, { value: value === 'true' })}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="true">True</SelectItem>
                            <SelectItem value="false">False</SelectItem>
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          type="number"
                          placeholder="Value"
                          value={condition.value}
                          onChange={(e) => updateCondition(index, { value: Number(e.target.value) })}
                        />
                      )}
                    </div>
                  </div>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeCondition(index)}
                    disabled={conditions.length === 1}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end">
            <Button
              onClick={saveFilter}
              disabled={!filterName.trim() || conditions.length === 0}
            >
              <Save className="h-4 w-4 mr-1" />
              Save Filter
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Existing Custom Filters */}
      {customFilters.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Your Custom Filters</CardTitle>
            <CardDescription>
              Manage your saved custom filters
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {customFilters.map((filter) => (
                <div key={filter.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1">
                    <div className="font-medium">{filter.name}</div>
                    <div className="text-sm text-muted-foreground">{filter.description}</div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      {filter.conditions.map((condition, i) => (
                        <Badge key={i} variant="outline" className="text-xs">
                          {FIELD_OPTIONS.find(f => f.value === condition.field)?.label || condition.field} {condition.operator} {String(condition.value)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => removeFilter(filter.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}