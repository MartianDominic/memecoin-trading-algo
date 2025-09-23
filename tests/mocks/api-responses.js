const { SolanaTokenDataMock } = require('./solana-token-data');

/**
 * Mock API responses for all external services
 */
class APIResponseMocks {
  constructor() {
    this.tokenMock = new SolanaTokenDataMock();
    this.setupMockData();
  }

  setupMockData() {
    this.tokens = this.tokenMock.generateTokens(200);
    this.apiResponses = this.tokenMock.generateAPIResponses();
  }

  /**
   * Mock successful DexScreener responses
   */
  getDexScreenerMocks() {
    return {
      // Search endpoint
      search: (query) => ({
        status: 200,
        data: {
          pairs: this.apiResponses.dexscreener.pairs.filter(pair =>
            pair.baseToken.symbol.toLowerCase().includes(query.toLowerCase()) ||
            pair.baseToken.name.toLowerCase().includes(query.toLowerCase())
          ).slice(0, 20)
        }
      }),

      // Latest pairs endpoint
      latest: () => ({
        status: 200,
        data: {
          pairs: this.apiResponses.dexscreener.pairs
            .sort((a, b) => b.pairCreatedAt - a.pairCreatedAt)
            .slice(0, 50)
        }
      }),

      // Specific pair endpoint
      pair: (address) => {
        const pair = this.apiResponses.dexscreener.pairs.find(p => p.pairAddress === address);
        return pair ? {
          status: 200,
          data: { pair }
        } : {
          status: 404,
          error: 'Pair not found'
        };
      }
    };
  }

  /**
   * Mock Jupiter API responses
   */
  getJupiterMocks() {
    return {
      // Token list endpoint
      tokenList: () => ({
        status: 200,
        data: this.apiResponses.jupiter
      }),

      // Price endpoint
      price: (ids) => {
        const prices = {};
        ids.split(',').forEach(id => {
          const token = this.tokens.find(t => t.address === id);
          if (token) {
            prices[id] = {
              id,
              price: (token.price * 100).toString(), // SOL to USD conversion
              timestamp: Date.now()
            };
          }
        });
        return {
          status: 200,
          data: prices
        };
      },

      // Quote endpoint for swaps
      quote: (inputMint, outputMint, amount) => ({
        status: 200,
        data: {
          inputMint,
          inAmount: amount,
          outputMint,
          outAmount: Math.floor(amount * 0.998), // Mock 0.2% slippage
          otherAmountThreshold: Math.floor(amount * 0.995),
          swapMode: 'ExactIn',
          slippageBps: 50,
          platformFee: null,
          priceImpactPct: '0.1',
          routePlan: [
            {
              swapInfo: {
                ammKey: 'mock-amm-key',
                label: 'Raydium',
                inputMint,
                outputMint,
                inAmount: amount,
                outAmount: Math.floor(amount * 0.998),
                feeAmount: Math.floor(amount * 0.002),
                feeMint: inputMint
              },
              percent: 100
            }
          ]
        }
      })
    };
  }

  /**
   * Mock CoinGecko API responses
   */
  getCoinGeckoMocks() {
    return {
      // Coins list endpoint
      coinsList: () => ({
        status: 200,
        data: this.apiResponses.coingecko.coins.map(coin => ({
          id: coin.id,
          symbol: coin.symbol,
          name: coin.name
        }))
      }),

      // Coin details endpoint
      coinDetails: (id) => {
        const coin = this.apiResponses.coingecko.coins.find(c => c.id === id);
        return coin ? {
          status: 200,
          data: coin
        } : {
          status: 404,
          error: 'Coin not found'
        };
      },

      // Market data endpoint
      markets: (vs_currency = 'usd', order = 'market_cap_desc', per_page = 100, page = 1) => ({
        status: 200,
        data: this.apiResponses.coingecko.coins
          .slice((page - 1) * per_page, page * per_page)
          .map(coin => ({
            id: coin.id,
            symbol: coin.symbol,
            name: coin.name,
            image: `https://assets.coingecko.com/coins/images/1/large/${coin.symbol}.png`,
            current_price: coin.market_data.current_price[vs_currency],
            market_cap: coin.market_data.market_cap[vs_currency],
            total_volume: coin.market_data.total_volume[vs_currency],
            price_change_percentage_24h: coin.market_data.price_change_percentage_24h,
            circulating_supply: coin.market_data.circulating_supply,
            total_supply: coin.market_data.total_supply,
            last_updated: new Date().toISOString()
          }))
      }),

      // Price history endpoint
      history: (id, days = 1) => {
        const coin = this.apiResponses.coingecko.coins.find(c => c.id === id);
        if (!coin) {
          return { status: 404, error: 'Coin not found' };
        }

        const prices = this.tokenMock.generatePriceHistory(coin.platforms.solana, days * 24);
        return {
          status: 200,
          data: {
            prices: prices.map(p => [new Date(p.timestamp).getTime(), p.price * 100]),
            market_caps: prices.map(p => [new Date(p.timestamp).getTime(), coin.market_data.market_cap.usd]),
            total_volumes: prices.map(p => [new Date(p.timestamp).getTime(), p.volume])
          }
        };
      }
    };
  }

  /**
   * Mock Solscan API responses
   */
  getSolscanMocks() {
    return {
      // Token info endpoint
      tokenInfo: (address) => {
        const token = this.apiResponses.solscan.find(t => t.tokenAddress === address);
        return token ? {
          status: 200,
          data: token
        } : {
          status: 404,
          error: 'Token not found'
        };
      },

      // Token holders endpoint
      holders: (address, offset = 0, limit = 20) => {
        const token = this.apiResponses.solscan.find(t => t.tokenAddress === address);
        if (!token) {
          return { status: 404, error: 'Token not found' };
        }

        const holders = Array.from({ length: Math.min(limit, token.holder) }, (_, i) => ({
          address: this.tokenMock.generateToken().address,
          amount: Math.floor(Math.random() * 1000000),
          decimals: token.decimals,
          owner: this.tokenMock.generateToken().address,
          rank: offset + i + 1
        }));

        return {
          status: 200,
          data: {
            total: token.holder,
            data: holders
          }
        };
      },

      // Token transfers endpoint
      transfers: (address, offset = 0, limit = 20) => {
        const transfers = Array.from({ length: limit }, (_, i) => ({
          signature: this.tokenMock.generateToken().address,
          blockTime: Math.floor(Date.now() / 1000) - (i * 3600),
          slot: 150000000 + i,
          fee: Math.floor(Math.random() * 10000),
          status: 'Success',
          lamport: 0,
          signer: [this.tokenMock.generateToken().address],
          logMessage: [],
          inputAccount: [
            {
              account: address,
              signer: false,
              writable: true,
              preBalance: Math.floor(Math.random() * 1000000),
              postBalance: Math.floor(Math.random() * 1000000)
            }
          ],
          tokenBalanceChanges: []
        }));

        return {
          status: 200,
          data: transfers
        };
      }
    };
  }

  /**
   * Mock error responses for testing error handling
   */
  getErrorMocks() {
    const errorScenarios = this.tokenMock.generateErrorScenarios();

    return {
      // Rate limiting errors
      rateLimited: (service) => ({
        status: 429,
        error: errorScenarios.rateLimited,
        headers: {
          'x-ratelimit-remaining': '0',
          'x-ratelimit-reset': Math.floor(Date.now() / 1000) + 60,
          'retry-after': '60'
        }
      }),

      // Server errors
      serverError: (service) => ({
        status: 500,
        error: errorScenarios.serverError
      }),

      // Network timeouts
      timeout: (service) => ({
        code: 'ECONNABORTED',
        message: `${service} request timeout`,
        timeout: true
      }),

      // Invalid requests
      badRequest: (service, message = 'Bad request') => ({
        status: 400,
        error: {
          ...errorScenarios.invalidToken,
          message
        }
      }),

      // Not found errors
      notFound: (service, resource = 'Resource') => ({
        status: 404,
        error: {
          ...errorScenarios.notFound,
          message: `${resource} not found`
        }
      })
    };
  }

  /**
   * Setup fetch mocks for Jest
   */
  setupFetchMocks() {
    const dexMocks = this.getDexScreenerMocks();
    const jupiterMocks = this.getJupiterMocks();
    const geckoMocks = this.getCoinGeckoMocks();
    const solscanMocks = this.getSolscanMocks();

    return {
      mockFetch: jest.fn((url, options) => {
        const urlObj = new URL(url);
        const domain = urlObj.hostname;
        const path = urlObj.pathname;
        const searchParams = urlObj.searchParams;

        // DexScreener API
        if (domain.includes('dexscreener')) {
          if (path.includes('/search')) {
            const query = searchParams.get('q') || '';
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve(dexMocks.search(query).data)
            });
          }
          if (path.includes('/latest')) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve(dexMocks.latest().data)
            });
          }
        }

        // Jupiter API
        if (domain.includes('jupiter')) {
          if (path.includes('/tokens')) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve(jupiterMocks.tokenList().data)
            });
          }
          if (path.includes('/price')) {
            const ids = searchParams.get('ids') || '';
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve(jupiterMocks.price(ids).data)
            });
          }
        }

        // CoinGecko API
        if (domain.includes('coingecko')) {
          if (path.includes('/coins/markets')) {
            const vs_currency = searchParams.get('vs_currency') || 'usd';
            const per_page = parseInt(searchParams.get('per_page')) || 100;
            const page = parseInt(searchParams.get('page')) || 1;
            return Promise.resolve({
              ok: true,
              status: 200,
              json: () => Promise.resolve(geckoMocks.markets(vs_currency, 'market_cap_desc', per_page, page).data)
            });
          }
        }

        // Solscan API
        if (domain.includes('solscan')) {
          if (path.includes('/token/meta')) {
            const address = path.split('/').pop();
            const result = solscanMocks.tokenInfo(address);
            return Promise.resolve({
              ok: result.status === 200,
              status: result.status,
              json: () => Promise.resolve(result.data || result.error)
            });
          }
        }

        // Default mock response
        return Promise.resolve({
          ok: false,
          status: 404,
          json: () => Promise.resolve({ error: 'Mock endpoint not implemented' })
        });
      })
    };
  }
}

module.exports = { APIResponseMocks };