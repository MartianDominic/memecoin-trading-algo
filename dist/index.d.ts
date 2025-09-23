/**
 * Main Entry Point for Memecoin Trading Algorithm
 * Orchestrates all services and components
 */
declare class MemecoinTradingSystem {
    private readonly logger;
    private readonly dbManager;
    private aggregatorService;
    private healthService;
    constructor();
    private setupEventHandlers;
    start(): Promise<void>;
    private logSystemConfiguration;
    private shutdown;
}
export { MemecoinTradingSystem };
//# sourceMappingURL=index.d.ts.map