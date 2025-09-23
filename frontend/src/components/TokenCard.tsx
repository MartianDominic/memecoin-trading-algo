"use client"

import { Token } from "@/types"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { formatCurrency, formatPercentage, formatNumber, cn } from "@/lib/utils"
import { TrendingUp, TrendingDown, Users, Droplet, Clock, ExternalLink } from "lucide-react"

interface TokenCardProps {
  token: Token
  onClick?: (token: Token) => void
}

export function TokenCard({ token, onClick }: TokenCardProps) {
  const isPositive = token.priceChangePercentage24h >= 0
  const riskColor = {
    low: "bg-green-500",
    medium: "bg-yellow-500",
    high: "bg-red-500",
  }[token.risk]

  return (
    <Card
      className="cursor-pointer hover:shadow-lg transition-shadow duration-200"
      onClick={() => onClick?.(token)}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center text-white font-bold">
              {token.symbol.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <CardTitle className="text-lg">{token.symbol}</CardTitle>
              <p className="text-sm text-muted-foreground truncate max-w-[150px]">
                {token.name}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className={cn("text-xs", riskColor.replace("bg-", "border-"))}
            >
              {token.risk} risk
            </Badge>
            <Button variant="ghost" size="icon" className="h-6 w-6">
              <ExternalLink className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Price Information */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-2xl font-bold">
              {formatCurrency(token.price)}
            </span>
            <div className={cn(
              "flex items-center gap-1 px-2 py-1 rounded text-sm font-medium",
              isPositive
                ? "bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400"
                : "bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400"
            )}>
              {isPositive ? (
                <TrendingUp className="h-3 w-3" />
              ) : (
                <TrendingDown className="h-3 w-3" />
              )}
              {formatPercentage(token.priceChangePercentage24h)}
            </div>
          </div>
          <div className="text-sm text-muted-foreground">
            24h change: {formatCurrency(token.priceChange24h)}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 gap-4 pt-2 border-t">
          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              Market Cap
            </div>
            <div className="font-medium">
              {formatNumber(token.marketCap)}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <TrendingUp className="h-3 w-3" />
              Volume 24h
            </div>
            <div className="font-medium">
              {formatNumber(token.volume24h)}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Droplet className="h-3 w-3" />
              Liquidity
            </div>
            <div className="font-medium">
              {formatNumber(token.liquidity)}
            </div>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="h-3 w-3" />
              Holders
            </div>
            <div className="font-medium">
              {formatNumber(token.holders)}
            </div>
          </div>
        </div>

        {/* Additional Info */}
        <div className="flex items-center justify-between pt-2 border-t text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Age: {Math.floor(token.age / 24)}d
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
            Live
          </div>
        </div>

        {/* Chain Badge */}
        <div className="pt-2">
          <Badge variant="secondary" className="text-xs">
            {token.chain}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}