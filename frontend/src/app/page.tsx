'use client'

import { useEffect } from 'react'
import { useTokenStore } from '@/stores/useTokenStore'
import { useWebSocket } from '@/hooks/useWebSocket'
import { useTokens } from '@/hooks/useTokens'
import { Header } from '@/components/Layout/Header'
import { Sidebar } from '@/components/Layout/Sidebar'
import { TokenTable } from '@/components/TokenTable'
import { TokenCard } from '@/components/TokenCard'
import { AlertPanel } from '@/components/AlertPanel'
import { FilterBuilder } from '@/components/FilterBuilder'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Grid, List, Download, Settings } from 'lucide-react'
import { useState } from 'react'

export default function Dashboard() {
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table')
  const [showFilterBuilder, setShowFilterBuilder] = useState(false)

  const {
    filteredTokens,
    isLoading,
    error,
    setTokens,
    activeFilters,
    isConnected,
    exportData,
  } = useTokenStore()

  // Fetch initial token data
  const { tokens, loading, error: fetchError, refetch } = useTokens()

  // Set up WebSocket connection
  useWebSocket({
    onOpen: () => console.log('WebSocket connected'),
    onClose: () => console.log('WebSocket disconnected'),
    onError: (error) => console.error('WebSocket error:', error),
  })

  // Update store when tokens are fetched
  useEffect(() => {
    if (tokens) {
      setTokens(tokens)
    }
  }, [tokens, setTokens])

  const handleExport = (format: 'csv' | 'json') => {
    exportData(format)
  }

  if (loading || isLoading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    )
  }

  if (error || fetchError) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Card className="w-96">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>
              {error || fetchError}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={refetch} variant="outline">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex h-screen bg-background">
      {/* Sidebar */}
      <Sidebar />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <Header />

        {/* Content Area */}
        <main className="flex-1 overflow-auto p-6">
          <div className="space-y-6">
            {/* Stats Overview */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Tokens</CardTitle>
                  <Badge variant={isConnected ? 'default' : 'destructive'}>
                    {isConnected ? 'Live' : 'Offline'}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{filteredTokens.length}</div>
                  <p className="text-xs text-muted-foreground">
                    {activeFilters.length} filters active
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Avg Safety Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {filteredTokens.length > 0
                      ? (filteredTokens.reduce((acc, token) => acc + token.safetyScore, 0) / filteredTokens.length).toFixed(1)
                      : '0'
                    }
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Out of 10
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">Total Volume</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    ${filteredTokens.reduce((acc, token) => acc + token.volume24h, 0).toLocaleString()}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    24h volume
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">New Tokens</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">
                    {filteredTokens.filter(token => token.age < 24).length}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Last 24 hours
                  </p>
                </CardContent>
              </Card>
            </div>

            {/* Main Content Tabs */}
            <Tabs defaultValue="tokens" className="w-full">
              <div className="flex justify-between items-center">
                <TabsList className="grid w-full max-w-md grid-cols-3">
                  <TabsTrigger value="tokens">Tokens</TabsTrigger>
                  <TabsTrigger value="alerts">Alerts</TabsTrigger>
                  <TabsTrigger value="filters">Filters</TabsTrigger>
                </TabsList>

                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setViewMode(viewMode === 'table' ? 'grid' : 'table')}
                  >
                    {viewMode === 'table' ? <Grid className="h-4 w-4" /> : <List className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowFilterBuilder(!showFilterBuilder)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport('csv')}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <TabsContent value="tokens" className="space-y-4">
                {showFilterBuilder && (
                  <Card>
                    <CardHeader>
                      <CardTitle>Filter Builder</CardTitle>
                      <CardDescription>
                        Create custom filters to find tokens that match your criteria
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <FilterBuilder />
                    </CardContent>
                  </Card>
                )}

                {viewMode === 'table' ? (
                  <Card>
                    <CardHeader>
                      <CardTitle>Token List</CardTitle>
                      <CardDescription>
                        Real-time token data with advanced filtering
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <TokenTable tokens={filteredTokens} />
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {filteredTokens.map((token) => (
                      <TokenCard key={token.id} token={token} />
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="alerts">
                <Card>
                  <CardHeader>
                    <CardTitle>Alert Center</CardTitle>
                    <CardDescription>
                      Real-time notifications and alerts
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AlertPanel />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="filters">
                <Card>
                  <CardHeader>
                    <CardTitle>Filter Management</CardTitle>
                    <CardDescription>
                      Manage your custom filters and presets
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <FilterBuilder />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>
        </main>
      </div>
    </div>
  )
}