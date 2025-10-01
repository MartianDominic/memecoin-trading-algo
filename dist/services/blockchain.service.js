"use strict";
/**
 * Blockchain Service - Multi-chain token data fetching
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.BlockchainService = void 0;
const axios_1 = __importDefault(require("axios"));
const logger_1 = require("../utils/logger");
class BlockchainService {
    constructor(apiKeys) {
        this.apiKeys = apiKeys;
        this.apiClients = new Map();
        this.logger = logger_1.Logger.getInstance();
        this.rateLimit = new Map();
        this.initializeClients();
    }
    initializeClients() {
        // Etherscan API
        this.apiClients.set('etherscan', axios_1.default.create({
            baseURL: 'https://api.etherscan.io/api',
            timeout: 10000,
            params: { apikey: this.apiKeys.etherscan }
        }));
        // BSCScan API
        this.apiClients.set('bscscan', axios_1.default.create({
            baseURL: 'https://api.bscscan.com/api',
            timeout: 10000,
            params: { apikey: this.apiKeys.bscscan }
        }));
        // DexScreener API
        this.apiClients.set('dexscreener', axios_1.default.create({
            baseURL: 'https://api.dexscreener.com/latest/dex',
            timeout: 10000
        }));
        // Moralis API
        this.apiClients.set('moralis', axios_1.default.create({
            baseURL: 'https://deep-index.moralis.io/api/v2',
            timeout: 15000,
            headers: { 'X-API-Key': this.apiKeys.moralis }
        }));
    }
    async checkRateLimit(service) {
        const now = Date.now();
        const lastCall = this.rateLimit.get(service) || 0;
        const minInterval = service === 'dexscreener' ? 1000 : 200; // Different rate limits
        if (now - lastCall < minInterval) {
            await new Promise(resolve => setTimeout(resolve, minInterval - (now - lastCall)));
        }
        this.rateLimit.set(service, Date.now());
    }
    async getTokenData(address, network = 'ethereum') {
        try {
            await this.checkRateLimit('moralis');
            const client = this.apiClients.get('moralis');
            if (!client)
                throw new Error('Moralis client not initialized');
            const response = await client.get(`/erc20/metadata`, {
                params: {
                    chain: network,
                    addresses: [address]
                }
            });
            const tokenInfo = response.data[0];
            if (!tokenInfo)
                return null;
            return {
                address: tokenInfo.address.toLowerCase(),
                symbol: tokenInfo.symbol,
                name: tokenInfo.name,
                decimals: tokenInfo.decimals,
                totalSupply: tokenInfo.total_supply || '0',
                network,
                createdAt: new Date(tokenInfo.created_at || Date.now()),
                lastUpdated: new Date()
            };
        }
        catch (error) {
            this.logger.error('Failed to fetch token data', { address, network, error });
            return null;
        }
    }
    async getTokenMetrics(address, network = 'ethereum') {
        try {
            await this.checkRateLimit('dexscreener');
            const client = this.apiClients.get('dexscreener');
            if (!client)
                throw new Error('DexScreener client not initialized');
            const response = await client.get(`/tokens/${address}`);
            const pairs = response.data.pairs;
            if (!pairs || pairs.length === 0)
                return null;
            const topPair = pairs.sort((a, b) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))[0];
            return {
                address: address.toLowerCase(),
                price: parseFloat(topPair.priceUsd || '0'),
                priceChange24h: parseFloat(topPair.priceChange?.h24 || '0'),
                volume24h: parseFloat(topPair.volume?.h24 || '0'),
                marketCap: parseFloat(topPair.marketCap || '0'),
                liquidity: parseFloat(topPair.liquidity?.usd || '0'),
                holderCount: 0, // Would need additional API call
                transactionCount24h: parseFloat(topPair.txns?.h24?.buys || '0') + parseFloat(topPair.txns?.h24?.sells || '0'),
                timestamp: new Date()
            };
        }
        catch (error) {
            this.logger.error('Failed to fetch token metrics', { address, network, error });
            return null;
        }
    }
    async getTokenSecurity(address, network = 'ethereum') {
        try {
            // This would integrate with security analysis APIs like GoPlus Security
            // For now, providing a basic structure
            const defaultSecurity = {
                address: address.toLowerCase(),
                contractVerified: false,
                liquidityLocked: false,
                ownershipRenounced: false,
                maxTransactionLimit: 0,
                maxWalletLimit: 0,
                buyTax: 0,
                sellTax: 0,
                honeypotRisk: 'medium',
                rugPullRisk: 'medium',
                overallRisk: 'medium'
            };
            // Check contract verification
            if (network === 'ethereum' || network === 'bsc') {
                const scannerClient = this.apiClients.get(network === 'ethereum' ? 'etherscan' : 'bscscan');
                if (scannerClient) {
                    await this.checkRateLimit(network === 'ethereum' ? 'etherscan' : 'bscscan');
                    const verificationResponse = await scannerClient.get('', {
                        params: {
                            module: 'contract',
                            action: 'getsourcecode',
                            address
                        }
                    });
                    if (verificationResponse.data.status === '1' && verificationResponse.data.result[0].SourceCode) {
                        defaultSecurity.contractVerified = true;
                    }
                }
            }
            return defaultSecurity;
        }
        catch (error) {
            this.logger.error('Failed to fetch token security', { address, network, error });
            return {
                address: address.toLowerCase(),
                contractVerified: false,
                liquidityLocked: false,
                ownershipRenounced: false,
                maxTransactionLimit: 0,
                maxWalletLimit: 0,
                buyTax: 0,
                sellTax: 0,
                honeypotRisk: 'high',
                rugPullRisk: 'high',
                overallRisk: 'high'
            };
        }
    }
    async getNewTokens(network = 'ethereum', limit = 100) {
        try {
            await this.checkRateLimit('dexscreener');
            const client = this.apiClients.get('dexscreener');
            if (!client)
                throw new Error('DexScreener client not initialized');
            const response = await client.get(`/tokens/trending`);
            const tokens = response.data.pairs || [];
            return tokens
                .filter((pair) => pair.chainId === network)
                .slice(0, limit)
                .map((pair) => pair.baseToken.address.toLowerCase());
        }
        catch (error) {
            this.logger.error('Failed to fetch new tokens', { network, error });
            return [];
        }
    }
    async batchGetTokenData(addresses, network = 'ethereum') {
        const batchSize = 10;
        const results = [];
        for (let i = 0; i < addresses.length; i += batchSize) {
            const batch = addresses.slice(i, i + batchSize);
            const batchPromises = batch.map(address => this.getTokenData(address, network));
            const batchResults = await Promise.allSettled(batchPromises);
            const validResults = batchResults
                .filter((result) => result.status === 'fulfilled' && result.value !== null)
                .map(result => result.value);
            results.push(...validResults);
            // Rate limiting between batches
            if (i + batchSize < addresses.length) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        }
        return results;
    }
}
exports.BlockchainService = BlockchainService;
//# sourceMappingURL=blockchain.service.js.map