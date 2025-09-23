const { faker } = require('@faker-js/faker');

/**
 * Generate mock Solana token data for testing
 */
class SolanaTokenDataMock {
  constructor() {
    this.tokenPairs = [];
    this.priceHistory = new Map();
  }

  /**
   * Generate a single mock token
   */
  generateToken(overrides = {}) {
    const baseToken = {
      address: faker.string.alphanumeric(44), // Solana address length
      symbol: faker.string.alpha({ length: { min: 3, max: 6 } }).toUpperCase(),
      name: faker.company.name() + ' Token',
      decimals: faker.number.int({ min: 6, max: 9 }),
      supply: faker.number.bigInt({ min: 1000000n, max: 1000000000000n }),
      marketCap: faker.number.float({ min: 1000, max: 10000000, fractionDigits: 2 }),
      price: faker.number.float({ min: 0.000001, max: 100, fractionDigits: 8 }),
      volume24h: faker.number.float({ min: 100, max: 1000000, fractionDigits: 2 }),
      priceChange24h: faker.number.float({ min: -50, max: 200, fractionDigits: 2 }),
      liquidity: faker.number.float({ min: 1000, max: 5000000, fractionDigits: 2 }),
      holders: faker.number.int({ min: 10, max: 100000 }),
      createdAt: faker.date.recent({ days: 30 }),
      verified: faker.datatype.boolean({ probability: 0.3 }),
      tags: faker.helpers.arrayElements(['meme', 'gaming', 'defi', 'nft', 'ai'], { min: 0, max: 3 }),
      socialLinks: {
        twitter: faker.datatype.boolean({ probability: 0.7 }) ? faker.internet.url() : null,
        telegram: faker.datatype.boolean({ probability: 0.5 }) ? faker.internet.url() : null,
        website: faker.datatype.boolean({ probability: 0.4 }) ? faker.internet.url() : null,
        discord: faker.datatype.boolean({ probability: 0.3 }) ? faker.internet.url() : null
      },
      metadata: {
        description: faker.lorem.sentence(),
        image: faker.image.url(),
        creator: faker.string.alphanumeric(44),
        mintAuthority: faker.datatype.boolean({ probability: 0.8 }) ? faker.string.alphanumeric(44) : null,
        freezeAuthority: faker.datatype.boolean({ probability: 0.2 }) ? faker.string.alphanumeric(44) : null
      }
    };

    return { ...baseToken, ...overrides };
  }

  /**
   * Generate multiple tokens with various characteristics
   */
  generateTokens(count = 100) {
    const tokens = [];

    for (let i = 0; i < count; i++) {
      let tokenOverrides = {};

      // Create specific token types for testing
      if (i % 20 === 0) {
        // High-volume meme token
        tokenOverrides = {
          tags: ['meme'],
          volume24h: faker.number.float({ min: 500000, max: 2000000 }),
          priceChange24h: faker.number.float({ min: 50, max: 500 }),
          holders: faker.number.int({ min: 5000, max: 50000 })
        };
      } else if (i % 15 === 0) {
        // New token with low liquidity
        tokenOverrides = {
          createdAt: faker.date.recent({ days: 1 }),
          liquidity: faker.number.float({ min: 100, max: 5000 }),
          holders: faker.number.int({ min: 5, max: 100 }),
          volume24h: faker.number.float({ min: 50, max: 1000 })
        };
      } else if (i % 10 === 0) {
        // Verified project token
        tokenOverrides = {
          verified: true,
          socialLinks: {
            twitter: faker.internet.url(),
            telegram: faker.internet.url(),
            website: faker.internet.url(),
            discord: faker.internet.url()
          },
          liquidity: faker.number.float({ min: 100000, max: 1000000 }),
          holders: faker.number.int({ min: 1000, max: 20000 })
        };
      }

      tokens.push(this.generateToken(tokenOverrides));
    }

    this.tokenPairs = tokens;
    return tokens;
  }

  /**
   * Generate price history for a token
   */
  generatePriceHistory(tokenAddress, hours = 24) {
    const history = [];
    const now = new Date();
    const basePrice = faker.number.float({ min: 0.000001, max: 1 });

    for (let i = hours; i >= 0; i--) {
      const timestamp = new Date(now.getTime() - (i * 60 * 60 * 1000));
      const volatility = faker.number.float({ min: -0.1, max: 0.1 });
      const price = Math.max(0.000001, basePrice * (1 + volatility));

      history.push({
        timestamp: timestamp.toISOString(),
        price,
        volume: faker.number.float({ min: 100, max: 10000 })
      });
    }

    this.priceHistory.set(tokenAddress, history);
    return history;
  }

  /**
   * Generate mock API responses
   */
  generateAPIResponses() {
    return {
      // DexScreener API response
      dexscreener: {
        schemaVersion: '1.0.0',
        pairs: this.tokenPairs.slice(0, 50).map(token => ({
          chainId: 'solana',
          dexId: 'raydium',
          url: `https://dexscreener.com/solana/${token.address}`,
          pairAddress: token.address,
          baseToken: {
            address: token.address,
            name: token.name,
            symbol: token.symbol
          },
          quoteToken: {
            address: 'So11111111111111111111111111111111111111112',
            name: 'Wrapped SOL',
            symbol: 'WSOL'
          },
          priceNative: token.price.toString(),
          priceUsd: (token.price * 100).toString(), // Mock SOL price
          volume: {
            h24: token.volume24h,
            h6: token.volume24h * 0.25,
            h1: token.volume24h * 0.042
          },
          priceChange: {
            h24: token.priceChange24h,
            h6: faker.number.float({ min: -20, max: 50 }),
            h1: faker.number.float({ min: -10, max: 20 })
          },
          liquidity: {
            usd: token.liquidity,
            base: token.liquidity / (token.price * 100),
            quote: token.liquidity / 100
          },
          fdv: token.marketCap,
          marketCap: token.marketCap * 0.8,
          pairCreatedAt: token.createdAt.getTime()
        }))
      },

      // Jupiter API response
      jupiter: this.tokenPairs.slice(0, 30).map(token => ({
        address: token.address,
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        logoURI: token.metadata.image,
        tags: token.tags,
        daily_volume: token.volume24h,
        verified: token.verified
      })),

      // CoinGecko API response
      coingecko: {
        coins: this.tokenPairs.slice(0, 25).map(token => ({
          id: token.symbol.toLowerCase() + '-token',
          symbol: token.symbol.toLowerCase(),
          name: token.name,
          platforms: {
            solana: token.address
          },
          market_data: {
            current_price: { usd: token.price * 100 },
            market_cap: { usd: token.marketCap },
            total_volume: { usd: token.volume24h },
            price_change_percentage_24h: token.priceChange24h,
            circulating_supply: Number(token.supply),
            total_supply: Number(token.supply)
          },
          community_data: {
            twitter_followers: faker.number.int({ min: 100, max: 100000 }),
            telegram_channel_user_count: faker.number.int({ min: 50, max: 50000 })
          },
          links: {
            homepage: [token.socialLinks.website].filter(Boolean),
            twitter_screen_name: token.socialLinks.twitter ? 'token_project' : null,
            telegram_channel_identifier: token.socialLinks.telegram ? 'tokenproject' : null
          }
        }))
      },

      // Solscan API response
      solscan: this.tokenPairs.slice(0, 40).map(token => ({
        tokenAddress: token.address,
        tokenName: token.name,
        tokenSymbol: token.symbol,
        tokenIcon: token.metadata.image,
        tokenAmount: Number(token.supply),
        decimals: token.decimals,
        holder: token.holders,
        price: token.price * 100, // in USD
        volume24h: token.volume24h,
        marketCap: token.marketCap,
        priceChange24h: token.priceChange24h,
        tag: token.tags,
        verified: token.verified,
        createdTime: Math.floor(token.createdAt.getTime() / 1000)
      }))
    };
  }

  /**
   * Generate error scenarios for testing
   */
  generateErrorScenarios() {
    return {
      rateLimited: {
        status: 429,
        error: 'Too Many Requests',
        message: 'Rate limit exceeded. Try again later.',
        retryAfter: 60
      },
      serverError: {
        status: 500,
        error: 'Internal Server Error',
        message: 'Upstream service temporarily unavailable'
      },
      invalidToken: {
        status: 400,
        error: 'Bad Request',
        message: 'Invalid token address format'
      },
      notFound: {
        status: 404,
        error: 'Not Found',
        message: 'Token not found'
      },
      networkTimeout: {
        code: 'ECONNABORTED',
        message: 'Request timeout'
      }
    };
  }

  /**
   * Generate performance test data
   */
  generatePerformanceData(tokenCount = 1000) {
    const tokens = this.generateTokens(tokenCount);
    const responses = this.generateAPIResponses();

    return {
      tokens,
      responses,
      metadata: {
        totalTokens: tokenCount,
        generatedAt: new Date().toISOString(),
        memoryUsage: process.memoryUsage(),
        estimatedSize: JSON.stringify(tokens).length
      }
    };
  }
}

module.exports = { SolanaTokenDataMock };