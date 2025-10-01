/**
 * Blockchain Service - Multi-chain token data fetching
 */
import { TokenData, TokenMetrics, TokenSecurity } from '../types/tokens';
export interface BlockchainAPIConfig {
    etherscan: string;
    bscscan: string;
    polygonscan: string;
    dexscreener: string;
    moralis: string;
    coingecko: string;
}
export declare class BlockchainService {
    private readonly apiKeys;
    private readonly apiClients;
    private readonly logger;
    private readonly rateLimit;
    constructor(apiKeys: BlockchainAPIConfig);
    private initializeClients;
    private checkRateLimit;
    getTokenData(address: string, network?: string): Promise<TokenData | null>;
    getTokenMetrics(address: string, network?: string): Promise<TokenMetrics | null>;
    getTokenSecurity(address: string, network?: string): Promise<TokenSecurity>;
    getNewTokens(network?: string, limit?: number): Promise<string[]>;
    batchGetTokenData(addresses: string[], network?: string): Promise<TokenData[]>;
}
//# sourceMappingURL=blockchain.service.d.ts.map