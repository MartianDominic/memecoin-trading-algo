// Alerts Controller - Alert System Management
import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { z } from 'zod';
import { logger } from '../../backend/src/config/logger';
import { WebSocketManager } from '../websocket/websocket-manager';
import {
  ApiResponse,
  PaginatedResponse,
  Alert,
  CreateAlertRequest,
  AlertsQuery,
  createAlertSchema,
  alertsQuerySchema,
  API_ERROR_CODES
} from '../types/api.types';

// Alert trigger condition interface
interface AlertCondition {
  metric: string;
  operator: 'gt' | 'lt' | 'gte' | 'lte' | 'eq';
  value: number;
  period?: string;
}

// Alert trigger storage interface
interface AlertTrigger {
  id: string;
  condition: AlertCondition;
  alertType: Alert['type'];
  createdAt: string;
  isActive: boolean;
}

// In-memory alert storage (in production, use database)
class AlertStorage {
  private alerts: Map<string, Alert> = new Map();
  private alertTriggers: Map<string, AlertCondition> = new Map();

  public createAlert(alert: Alert): void {
    this.alerts.set(alert.id, alert);
  }

  public getAlert(id: string): Alert | undefined {
    return this.alerts.get(id);
  }

  public listAlerts(filters: Partial<AlertsQuery> = {}): Alert[] {
    let alerts = Array.from(this.alerts.values());

    if (filters.type) {
      alerts = alerts.filter(alert => alert.type === filters.type);
    }

    if (filters.severity) {
      alerts = alerts.filter(alert => alert.severity === filters.severity);
    }

    if (filters.isRead !== undefined) {
      alerts = alerts.filter(alert => alert.isRead === filters.isRead);
    }

    if (filters.tokenAddress) {
      alerts = alerts.filter(alert => alert.tokenAddress === filters.tokenAddress);
    }

    if (filters.startDate) {
      const startDate = new Date(filters.startDate);
      alerts = alerts.filter(alert => new Date(alert.triggeredAt) >= startDate);
    }

    if (filters.endDate) {
      const endDate = new Date(filters.endDate);
      alerts = alerts.filter(alert => new Date(alert.triggeredAt) <= endDate);
    }

    // Sort by triggered date (newest first)
    return alerts.sort((a, b) =>
      new Date(b.triggeredAt).getTime() - new Date(a.triggeredAt).getTime()
    );
  }

  public updateAlert(id: string, updates: Partial<Alert>): Alert | undefined {
    const alert = this.alerts.get(id);
    if (!alert) return undefined;

    const updatedAlert = { ...alert, ...updates };
    this.alerts.set(id, updatedAlert);
    return updatedAlert;
  }

  public deleteAlert(id: string): boolean {
    return this.alerts.delete(id);
  }

  public getActiveAlerts(): Alert[] {
    return Array.from(this.alerts.values()).filter(alert => !alert.isRead);
  }

  public createTrigger(alertId: string, condition: AlertCondition): void {
    this.alertTriggers.set(alertId, condition);
  }

  public getTrigger(alertId: string): AlertCondition | undefined {
    return this.alertTriggers.get(alertId);
  }

  public getAllTriggers(): Array<[string, AlertCondition]> {
    return Array.from(this.alertTriggers.entries());
  }
}

export class AlertsController {
  private alertStorage = new AlertStorage();

  constructor(
    private prisma: PrismaClient,
    private wsManager: WebSocketManager
  ) {
    // Initialize with sample alerts
    this.initializeSampleAlerts();
  }

  // GET /api/v1/alerts - Get alerts with pagination and filters
  public async getAlerts(req: Request, res: Response): Promise<void> {
    try {
      const query = alertsQuerySchema.parse(req.query);

      const allAlerts = this.alertStorage.listAlerts(query);
      const total = allAlerts.length;

      // Apply pagination
      const skip = (query.page - 1) * query.limit;
      const paginatedAlerts = allAlerts.slice(skip, skip + query.limit);

      const response: PaginatedResponse<Alert> = {
        success: true,
        data: paginatedAlerts,
        pagination: {
          page: query.page,
          limit: query.limit,
          total,
          totalPages: Math.ceil(total / query.limit),
          hasNext: skip + query.limit < total,
          hasPrev: query.page > 1
        },
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      };

      res.json(response);

      logger.info('Alerts retrieved successfully', {
        count: paginatedAlerts.length,
        total,
        filters: query
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: API_ERROR_CODES.VALIDATION_ERROR,
          message: 'Invalid query parameters',
          details: error.errors,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        });
        return;
      }

      logger.error('Error fetching alerts:', error);
      res.status(500).json({
        success: false,
        error: API_ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to fetch alerts',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    }
  }

  // GET /api/v1/alerts/:id - Get specific alert
  public async getAlert(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const alert = this.alertStorage.getAlert(id);

      if (!alert) {
        res.status(404).json({
          success: false,
          error: API_ERROR_CODES.ALERT_NOT_FOUND,
          message: 'Alert not found',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        });
        return;
      }

      const response: ApiResponse<Alert> = {
        success: true,
        data: alert,
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      };

      res.json(response);

      logger.info('Alert retrieved successfully', {
        alertId: id,
        type: alert.type
      });

    } catch (error) {
      logger.error('Error fetching alert:', error);
      res.status(500).json({
        success: false,
        error: API_ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to fetch alert',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    }
  }

  // POST /api/v1/alerts - Create new alert trigger
  public async createAlert(req: Request, res: Response): Promise<void> {
    try {
      const alertData = createAlertSchema.parse(req.body);

      const alert: Alert = {
        id: this.generateId(),
        type: alertData.type,
        title: this.generateAlertTitle(alertData),
        message: alertData.message || this.generateAlertMessage(alertData),
        severity: alertData.severity || 'MEDIUM',
        tokenAddress: alertData.tokenAddress,
        tokenSymbol: undefined, // Will be resolved from tokenAddress
        triggeredAt: new Date().toISOString(),
        isRead: false,
        metadata: {
          condition: alertData.condition,
          createdBy: req.headers['x-user-id'] || 'system'
        }
      };

      // Resolve token symbol if tokenAddress provided
      if (alert.tokenAddress) {
        try {
          const token = await this.prisma.token.findUnique({
            where: { address: alert.tokenAddress },
            select: { symbol: true }
          });
          if (token) {
            alert.tokenSymbol = token.symbol;
          }
        } catch (error) {
          logger.warn('Failed to resolve token symbol:', error);
        }
      }

      this.alertStorage.createAlert(alert);
      this.alertStorage.createTrigger(alert.id, alertData.condition);

      // Broadcast alert via WebSocket
      this.wsManager.broadcastAlert(alert);

      const response: ApiResponse<Alert> = {
        success: true,
        data: alert,
        message: 'Alert created successfully',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      };

      res.status(201).json(response);

      logger.info('Alert created successfully', {
        alertId: alert.id,
        type: alert.type,
        tokenAddress: alert.tokenAddress
      });

    } catch (error) {
      if (error instanceof z.ZodError) {
        res.status(400).json({
          success: false,
          error: API_ERROR_CODES.VALIDATION_ERROR,
          message: 'Invalid alert data',
          details: error.errors,
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        });
        return;
      }

      logger.error('Error creating alert:', error);
      res.status(500).json({
        success: false,
        error: API_ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to create alert',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    }
  }

  // POST /api/v1/alerts/:id/acknowledge - Mark alert as read/acknowledged
  public async acknowledgeAlert(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const alert = this.alertStorage.getAlert(id);

      if (!alert) {
        res.status(404).json({
          success: false,
          error: API_ERROR_CODES.ALERT_NOT_FOUND,
          message: 'Alert not found',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        });
        return;
      }

      const updatedAlert = this.alertStorage.updateAlert(id, {
        isRead: true,
        acknowledgedAt: new Date().toISOString()
      });

      const response: ApiResponse<Alert> = {
        success: true,
        data: updatedAlert!,
        message: 'Alert acknowledged successfully',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      };

      res.json(response);

      logger.info('Alert acknowledged successfully', {
        alertId: id
      });

    } catch (error) {
      logger.error('Error acknowledging alert:', error);
      res.status(500).json({
        success: false,
        error: API_ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to acknowledge alert',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    }
  }

  // DELETE /api/v1/alerts/:id - Dismiss/delete alert
  public async dismissAlert(req: Request, res: Response): Promise<void> {
    try {
      const { id } = req.params;

      const alert = this.alertStorage.getAlert(id);

      if (!alert) {
        res.status(404).json({
          success: false,
          error: API_ERROR_CODES.ALERT_NOT_FOUND,
          message: 'Alert not found',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        });
        return;
      }

      const deleted = this.alertStorage.deleteAlert(id);

      if (!deleted) {
        res.status(500).json({
          success: false,
          error: API_ERROR_CODES.INTERNAL_ERROR,
          message: 'Failed to dismiss alert',
          timestamp: new Date().toISOString(),
          version: '1.0.0'
        });
        return;
      }

      const response: ApiResponse<null> = {
        success: true,
        message: 'Alert dismissed successfully',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      };

      res.json(response);

      logger.info('Alert dismissed successfully', {
        alertId: id
      });

    } catch (error) {
      logger.error('Error dismissing alert:', error);
      res.status(500).json({
        success: false,
        error: API_ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to dismiss alert',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    }
  }

  // GET /api/v1/alerts/summary - Get alert summary statistics
  public async getAlertSummary(req: Request, res: Response): Promise<void> {
    try {
      const allAlerts = this.alertStorage.listAlerts();
      const activeAlerts = this.alertStorage.getActiveAlerts();

      const summary = {
        total: allAlerts.length,
        active: activeAlerts.length,
        acknowledged: allAlerts.filter(a => a.isRead).length,
        bySeverity: {
          LOW: allAlerts.filter(a => a.severity === 'LOW').length,
          MEDIUM: allAlerts.filter(a => a.severity === 'MEDIUM').length,
          HIGH: allAlerts.filter(a => a.severity === 'HIGH').length,
          CRITICAL: allAlerts.filter(a => a.severity === 'CRITICAL').length,
        },
        byType: {
          PRICE_ALERT: allAlerts.filter(a => a.type === 'PRICE_ALERT').length,
          VOLUME_ALERT: allAlerts.filter(a => a.type === 'VOLUME_ALERT').length,
          SAFETY_ALERT: allAlerts.filter(a => a.type === 'SAFETY_ALERT').length,
          SIGNAL_ALERT: allAlerts.filter(a => a.type === 'SIGNAL_ALERT').length,
          NEWS_ALERT: allAlerts.filter(a => a.type === 'NEWS_ALERT').length,
        },
        recent: allAlerts.slice(0, 5) // Last 5 alerts
      };

      const response: ApiResponse<typeof summary> = {
        success: true,
        data: summary,
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      };

      res.json(response);

      logger.info('Alert summary retrieved successfully');

    } catch (error) {
      logger.error('Error fetching alert summary:', error);
      res.status(500).json({
        success: false,
        error: API_ERROR_CODES.INTERNAL_ERROR,
        message: 'Failed to fetch alert summary',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      });
    }
  }

  // Trigger alert evaluation (called by data pipeline)
  public async triggerAlert(tokenAddress: string, metric: string, value: number): Promise<void> {
    try {
      // Find all active triggers that might be affected
      const triggers = this.alertStorage.getAllTriggers();

      for (const [alertId, condition] of triggers) {
        if (condition.metric === metric) {
          const shouldTrigger = this.evaluateCondition(condition, value);

          if (shouldTrigger) {
            const alert: Alert = {
              id: this.generateId(),
              type: this.getAlertTypeFromMetric(metric),
              title: `${metric} Alert`,
              message: `${metric} value ${value} triggered alert condition`,
              severity: 'MEDIUM',
              tokenAddress,
              triggeredAt: new Date().toISOString(),
              isRead: false,
              metadata: {
                metric,
                value,
                condition,
                triggeredBy: 'system'
              }
            };

            this.alertStorage.createAlert(alert);
            this.wsManager.broadcastAlert(alert);

            logger.info('Alert triggered automatically', {
              alertId: alert.id,
              tokenAddress,
              metric,
              value
            });
          }
        }
      }
    } catch (error) {
      logger.error('Error triggering alerts:', error);
    }
  }

  private evaluateCondition(condition: AlertCondition, value: number): boolean {
    switch (condition.operator) {
      case 'gt': return value > condition.value;
      case 'gte': return value >= condition.value;
      case 'lt': return value < condition.value;
      case 'lte': return value <= condition.value;
      case 'eq': return value === condition.value;
      default: return false;
    }
  }

  private getAlertTypeFromMetric(metric: string): Alert['type'] {
    if (metric.includes('price')) return 'PRICE_ALERT';
    if (metric.includes('volume')) return 'VOLUME_ALERT';
    if (metric.includes('safety') || metric.includes('risk')) return 'SAFETY_ALERT';
    if (metric.includes('signal')) return 'SIGNAL_ALERT';
    return 'NEWS_ALERT';
  }

  private generateAlertTitle(alertData: CreateAlertRequest): string {
    const metricName = alertData.condition.metric.replace('_', ' ').toUpperCase();
    return `${metricName} Alert`;
  }

  private generateAlertMessage(alertData: CreateAlertRequest): string {
    const { metric, operator, value } = alertData.condition;
    const operatorText = {
      'gt': 'greater than',
      'gte': 'greater than or equal to',
      'lt': 'less than',
      'lte': 'less than or equal to',
      'eq': 'equal to'
    }[operator];

    return `Alert triggered when ${metric} is ${operatorText} ${value}`;
  }

  private generateId(): string {
    return `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private initializeSampleAlerts(): void {
    // Create sample alerts for demonstration
    const sampleAlerts: Alert[] = [
      {
        id: 'alert_sample_1',
        type: 'PRICE_ALERT',
        title: 'High Price Movement Detected',
        message: 'Token DOGE has increased by 25% in the last hour',
        severity: 'HIGH',
        tokenAddress: 'DGFzH5FEcLJcr8T2Dv9jMKV9BxPGvXdLyKLv5qV8pump',
        tokenSymbol: 'DOGE',
        triggeredAt: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(), // 2 hours ago
        isRead: false,
        metadata: {
          priceChange: 25.5,
          previousPrice: 0.08,
          currentPrice: 0.1
        }
      },
      {
        id: 'alert_sample_2',
        type: 'VOLUME_ALERT',
        title: 'Volume Spike Alert',
        message: 'Unusual trading volume detected for PEPE',
        severity: 'MEDIUM',
        tokenAddress: 'PEPEjHzQqHQQfH5JnJLVKzPdqrGqqLxgN4VJ3Rnpump',
        tokenSymbol: 'PEPE',
        triggeredAt: new Date(Date.now() - 30 * 60 * 1000).toISOString(), // 30 minutes ago
        isRead: false,
        metadata: {
          volumeIncrease: 340,
          normalVolume: 50000,
          currentVolume: 220000
        }
      },
      {
        id: 'alert_sample_3',
        type: 'SAFETY_ALERT',
        title: 'Low Safety Score Warning',
        message: 'Token SCAM has a very low safety score of 2.1/10',
        severity: 'CRITICAL',
        tokenAddress: 'SCAMxyz123456789',
        tokenSymbol: 'SCAM',
        triggeredAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(), // 1 hour ago
        isRead: true,
        acknowledgedAt: new Date(Date.now() - 45 * 60 * 1000).toISOString(),
        metadata: {
          safetyScore: 2.1,
          riskLevel: 'VERY_HIGH',
          riskFactors: ['honeypot_detected', 'no_liquidity', 'mint_authority']
        }
      }
    ];

    sampleAlerts.forEach(alert => {
      this.alertStorage.createAlert(alert);
    });

    logger.info('Sample alerts initialized', { count: sampleAlerts.length });
  }
}