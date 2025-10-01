/**
 * Token Detection Engine - Core detection logic and algorithms
 */
import { BlockchainService } from '../services/blockchain.service';
import { DetectionResult, PipelineConfig } from '../types/tokens';
import { EventEmitter } from 'events';
export declare class TokenDetector extends EventEmitter {
    private readonly blockchainService;
    private readonly config;
    private readonly logger;
    private readonly cache;
    private readonly processedTokens;
    private isRunning;
    constructor(blockchainService: BlockchainService, config: PipelineConfig);
    start(): Promise<void>;
    stop(): Promise<void>;
    private startDetectionLoop;
    private detectNewTokens;
    private processBatch;
    analyzeToken(address: string, network: string): Promise<DetectionResult | null>;
    private calculateDetectionScore;
    private generateRecommendations;
    private generateAlerts;
    private handleDetectionResult;
    private sleep;
    getProcessedTokensCount(): number;
    clearProcessedTokens(): void;
}
//# sourceMappingURL=token-detector.d.ts.map