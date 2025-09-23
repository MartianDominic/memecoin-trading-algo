'use client'

import { useState, useEffect } from 'react'
import { useTokenStore } from '@/stores/useTokenStore'
import { Alert } from '@/types'
import { formatCurrency, formatTimeAgo } from '@/lib/utils'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import {
  AlertTriangle,
  TrendingUp,
  TrendingDown,
  Volume2,
  Droplets,
  Users,
  Bell,
  BellOff,
  X,
  Clock,
} from 'lucide-react'

// Mock alerts for demonstration
const mockAlerts: Alert[] = [
  {
    id: '1',
    tokenId: 'token-1',
    type: 'price',
    condition: { field: 'price', operator: 'gt', value: 0.001 },
    triggered: true,
    createdAt: new Date(Date.now() - 300000).toISOString(), // 5 minutes ago
    severity: 'high',
    message: 'DOGE price increased by 25% in the last hour',
  },
  {
    id: '2',
    tokenId: 'token-2',
    type: 'volume',
    condition: { field: 'volume24h', operator: 'gt', value: 50000 },
    triggered: true,
    createdAt: new Date(Date.now() - 600000).toISOString(), // 10 minutes ago
    severity: 'medium',
    message: 'SHIB volume spike: 150% increase detected',
  },
  {
    id: '3',
    tokenId: 'token-3',
    type: 'liquidity',
    condition: { field: 'liquidity', operator: 'lt', value: 10000 },
    triggered: true,
    createdAt: new Date(Date.now() - 900000).toISOString(), // 15 minutes ago
    severity: 'high',
    message: 'PEPE liquidity dropped below $10,000 - potential rug risk',
  },
  {
    id: '4',
    tokenId: 'token-4',
    type: 'holders',
    condition: { field: 'holders', operator: 'gt', value: 1000 },
    triggered: true,
    createdAt: new Date(Date.now() - 1200000).toISOString(), // 20 minutes ago
    severity: 'low',
    message: 'FLOKI holder count reached 1,500',
  },
]

export function AlertPanel() {
  const [alerts, setAlerts] = useState<Alert[]>(mockAlerts)
  const [isEnabled, setIsEnabled] = useState(true)
  const { isConnected } = useTokenStore()

  // Simulate new alerts coming in
  useEffect(() => {
    if (!isConnected) return

    const interval = setInterval(() => {
      // Randomly add new alerts
      if (Math.random() > 0.7) {
        const newAlert: Alert = {
          id: `alert-${Date.now()}`,
          tokenId: `token-${Math.floor(Math.random() * 100)}`,
          type: ['price', 'volume', 'liquidity', 'holders'][Math.floor(Math.random() * 4)] as Alert['type'],
          condition: { field: 'price', operator: 'gt', value: Math.random() * 1000 },
          triggered: true,
          createdAt: new Date().toISOString(),
          severity: ['low', 'medium', 'high'][Math.floor(Math.random() * 3)] as Alert['severity'],
          message: `New alert generated at ${new Date().toLocaleTimeString()}`,
        }

        setAlerts(prev => [newAlert, ...prev.slice(0, 9)]) // Keep only last 10 alerts
      }
    }, 30000) // Check every 30 seconds

    return () => clearInterval(interval)
  }, [isConnected])

  const dismissAlert = (alertId: string) => {
    setAlerts(prev => prev.filter(alert => alert.id !== alertId))
  }

  const getAlertIcon = (type: Alert['type']) => {
    switch (type) {
      case 'price':
        return <TrendingUp className="h-4 w-4" />
      case 'volume':
        return <Volume2 className="h-4 w-4" />
      case 'liquidity':
        return <Droplets className="h-4 w-4" />
      case 'holders':
        return <Users className="h-4 w-4" />
      default:
        return <AlertTriangle className="h-4 w-4" />
    }
  }

  const getSeverityColor = (severity: Alert['severity']) => {
    switch (severity) {
      case 'high':
        return 'destructive'
      case 'medium':
        return 'secondary'
      case 'low':
        return 'outline'
      default:
        return 'outline'
    }
  }

  return (
    <div className="space-y-4">
      {/* Alert Controls */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <h3 className="text-lg font-semibold">Real-time Alerts</h3>
          <Badge variant={isConnected ? 'default' : 'destructive'}>
            {isConnected ? 'Live' : 'Offline'}
          </Badge>
        </div>
        <div className="flex items-center space-x-2">
          <span className="text-sm text-muted-foreground">Notifications</span>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsEnabled(!isEnabled)}
          >
            {isEnabled ? (
              <Bell className="h-4 w-4" />
            ) : (
              <BellOff className="h-4 w-4" />
            )}
          </Button>
        </div>
      </div>

      {/* Alert Statistics */}
      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-red-600">
              {alerts.filter(a => a.severity === 'high').length}
            </div>
            <div className="text-sm text-muted-foreground">High Priority</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-yellow-600">
              {alerts.filter(a => a.severity === 'medium').length}
            </div>
            <div className="text-sm text-muted-foreground">Medium Priority</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-blue-600">
              {alerts.filter(a => a.severity === 'low').length}
            </div>
            <div className="text-sm text-muted-foreground">Low Priority</div>
          </CardContent>
        </Card>
      </div>

      {/* Alert List */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Alerts</CardTitle>
          <CardDescription>
            Latest notifications from your trading criteria
          </CardDescription>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Bell className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>No alerts yet</p>
              <p className="text-sm">Alerts will appear here when conditions are met</p>
            </div>
          ) : (
            <ScrollArea className="h-96">
              <div className="space-y-3">
                {alerts.map((alert, index) => (
                  <div key={alert.id}>
                    <div className="flex items-start space-x-3 p-3 rounded-lg border hover:bg-muted/50">
                      <div className="flex-shrink-0">
                        <div className={`p-2 rounded-full ${
                          alert.severity === 'high' ? 'bg-red-100 text-red-600' :
                          alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-600' :
                          'bg-blue-100 text-blue-600'
                        }`}>
                          {getAlertIcon(alert.type)}
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between">
                          <Badge variant={getSeverityColor(alert.severity)} className="text-xs">
                            {alert.severity.toUpperCase()}
                          </Badge>
                          <div className="flex items-center space-x-2">
                            <div className="flex items-center text-xs text-muted-foreground">
                              <Clock className="h-3 w-3 mr-1" />
                              {formatTimeAgo(new Date(alert.createdAt))}
                            </div>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => dismissAlert(alert.id)}
                              className="h-6 w-6 p-0"
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm mt-1">{alert.message}</p>
                        <div className="flex items-center space-x-2 mt-2 text-xs text-muted-foreground">
                          <span className="capitalize">{alert.type}</span>
                          <span>•</span>
                          <span>Token ID: {alert.tokenId}</span>
                        </div>
                      </div>
                    </div>
                    {index < alerts.length - 1 && <Separator className="my-2" />}
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}
        </CardContent>
      </Card>

      {/* Quick Actions */}
      <div className="flex justify-between">
        <Button variant="outline" size="sm">
          Create Alert Rule
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setAlerts([])}
          disabled={alerts.length === 0}
        >
          Clear All
        </Button>
      </div>
    </div>
  )
}