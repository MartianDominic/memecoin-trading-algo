import WebSocket from 'ws';
import { createServer } from 'http';
import { jest } from '@jest/globals';

describe('WebSocket Real-time Integration', () => {
  let server: ReturnType<typeof createServer>;
  let wss: WebSocket.Server;
  let client: WebSocket;
  let port: number;

  beforeAll((done) => {
    server = createServer();
    wss = new WebSocket.Server({ server });

    server.listen(0, () => {
      const address = server.address();
      port = typeof address === 'object' && address ? address.port : 0;
      done();
    });
  });

  afterAll((done) => {
    if (client && client.readyState === WebSocket.OPEN) {
      client.close();
    }
    wss.close();
    server.close(done);
  });

  beforeEach((done) => {
    client = new WebSocket(`ws://localhost:${port}`);
    client.on('open', done);
  });

  afterEach(() => {
    if (client && client.readyState === WebSocket.OPEN) {
      client.close();
    }
  });

  describe('Token Price Updates', () => {
    it('should broadcast real-time price updates', (done) => {
      const testTokenAddress = '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R';
      const mockPriceUpdate = {
        type: 'PRICE_UPDATE',
        data: {
          address: testTokenAddress,
          symbol: 'TEST',
          price: 0.0156,
          priceChange24h: 5.2,
          volume24h: 98765,
          timestamp: Date.now()
        }
      };

      // Set up WebSocket server to handle connections
      wss.on('connection', (ws) => {
        ws.on('message', (message) => {
          const parsedMessage = JSON.parse(message.toString());

          if (parsedMessage.type === 'SUBSCRIBE_PRICE_UPDATES') {
            // Simulate price update broadcast
            setTimeout(() => {
              ws.send(JSON.stringify(mockPriceUpdate));
            }, 100);
          }
        });
      });

      // Client subscribes to price updates
      client.send(JSON.stringify({
        type: 'SUBSCRIBE_PRICE_UPDATES',
        tokens: [testTokenAddress]
      }));

      // Listen for price updates
      client.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'PRICE_UPDATE') {
          expect(message.data.address).toBe(testTokenAddress);
          expect(message.data.price).toBe(0.0156);
          expect(message.data.symbol).toBe('TEST');
          done();
        }
      });
    });

    it('should handle multiple subscribers', (done) => {
      const testTokenAddress = '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R';
      const clients: WebSocket[] = [];
      let receivedCount = 0;

      // Create multiple clients
      const createClient = (clientIndex: number) => {
        const client = new WebSocket(`ws://localhost:${port}`);
        clients.push(client);

        client.on('open', () => {
          client.send(JSON.stringify({
            type: 'SUBSCRIBE_PRICE_UPDATES',
            tokens: [testTokenAddress]
          }));
        });

        client.on('message', (data) => {
          const message = JSON.parse(data.toString());
          if (message.type === 'PRICE_UPDATE') {
            receivedCount++;
            if (receivedCount === 3) {
              // All clients received the update
              clients.forEach(c => c.close());
              done();
            }
          }
        });
      };

      // Set up server to broadcast to all clients
      wss.on('connection', (ws) => {
        ws.on('message', (message) => {
          const parsedMessage = JSON.parse(message.toString());

          if (parsedMessage.type === 'SUBSCRIBE_PRICE_UPDATES') {
            setTimeout(() => {
              // Broadcast to all connected clients
              wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                  client.send(JSON.stringify({
                    type: 'PRICE_UPDATE',
                    data: {
                      address: testTokenAddress,
                      price: 0.0200,
                      timestamp: Date.now()
                    }
                  }));
                }
              });
            }, 100);
          }
        });
      });

      // Create 3 clients
      for (let i = 0; i < 3; i++) {
        createClient(i);
      }
    });

    it('should handle subscription filtering', (done) => {
      const token1 = '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R';
      const token2 = '5fTwKZP2AK1RtyHPfsiryunHW8GHM7CRnqHcE7JSqyNt';

      const subscriptions = new Map<WebSocket, string[]>();

      wss.on('connection', (ws) => {
        ws.on('message', (message) => {
          const parsedMessage = JSON.parse(message.toString());

          if (parsedMessage.type === 'SUBSCRIBE_PRICE_UPDATES') {
            subscriptions.set(ws, parsedMessage.tokens);

            // Send updates only for subscribed tokens
            setTimeout(() => {
              const subscribedTokens = subscriptions.get(ws) || [];

              // Send token1 update (should be received)
              if (subscribedTokens.includes(token1)) {
                ws.send(JSON.stringify({
                  type: 'PRICE_UPDATE',
                  data: { address: token1, price: 0.0156 }
                }));
              }

              // Send token2 update (should not be received)
              if (subscribedTokens.includes(token2)) {
                ws.send(JSON.stringify({
                  type: 'PRICE_UPDATE',
                  data: { address: token2, price: 0.0200 }
                }));
              }
            }, 100);
          }
        });
      });

      // Subscribe only to token1
      client.send(JSON.stringify({
        type: 'SUBSCRIBE_PRICE_UPDATES',
        tokens: [token1]
      }));

      let messageCount = 0;
      client.on('message', (data) => {
        const message = JSON.parse(data.toString());
        messageCount++;

        if (message.type === 'PRICE_UPDATE') {
          expect(message.data.address).toBe(token1);
          // Should only receive one message (for token1)
          expect(messageCount).toBe(1);

          setTimeout(() => {
            expect(messageCount).toBe(1); // Verify no additional messages
            done();
          }, 200);
        }
      });
    });
  });

  describe('Alert Notifications', () => {
    it('should send alert notifications', (done) => {
      const mockAlert = {
        type: 'ALERT',
        data: {
          id: 'alert_123',
          alertType: 'PRICE_SPIKE',
          tokenAddress: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
          symbol: 'TEST',
          message: 'Price increased by 50% in 5 minutes',
          severity: 'HIGH',
          timestamp: Date.now()
        }
      };

      wss.on('connection', (ws) => {
        ws.on('message', (message) => {
          const parsedMessage = JSON.parse(message.toString());

          if (parsedMessage.type === 'SUBSCRIBE_ALERTS') {
            setTimeout(() => {
              ws.send(JSON.stringify(mockAlert));
            }, 100);
          }
        });
      });

      client.send(JSON.stringify({
        type: 'SUBSCRIBE_ALERTS',
        filters: {
          severity: ['HIGH', 'CRITICAL'],
          alertTypes: ['PRICE_SPIKE', 'VOLUME_SPIKE']
        }
      }));

      client.on('message', (data) => {
        const message = JSON.parse(data.toString());

        if (message.type === 'ALERT') {
          expect(message.data.alertType).toBe('PRICE_SPIKE');
          expect(message.data.severity).toBe('HIGH');
          expect(message.data.tokenAddress).toBe('4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R');
          done();
        }
      });
    });

    it('should filter alerts by severity', (done) => {
      const highSeverityAlert = {
        type: 'ALERT',
        data: {
          id: 'alert_high',
          severity: 'HIGH',
          alertType: 'PRICE_SPIKE'
        }
      };

      const lowSeverityAlert = {
        type: 'ALERT',
        data: {
          id: 'alert_low',
          severity: 'LOW',
          alertType: 'MINOR_CHANGE'
        }
      };

      wss.on('connection', (ws) => {
        ws.on('message', (message) => {
          const parsedMessage = JSON.parse(message.toString());

          if (parsedMessage.type === 'SUBSCRIBE_ALERTS') {
            const filters = parsedMessage.filters;

            setTimeout(() => {
              // Send both alerts, but only HIGH should be received
              if (filters.severity.includes('HIGH')) {
                ws.send(JSON.stringify(highSeverityAlert));
              }

              // This should be filtered out
              if (filters.severity.includes('LOW')) {
                ws.send(JSON.stringify(lowSeverityAlert));
              }
            }, 100);
          }
        });
      });

      client.send(JSON.stringify({
        type: 'SUBSCRIBE_ALERTS',
        filters: {
          severity: ['HIGH', 'CRITICAL']
        }
      }));

      let messageCount = 0;
      client.on('message', (data) => {
        const message = JSON.parse(data.toString());
        messageCount++;

        if (message.type === 'ALERT') {
          expect(message.data.severity).toBe('HIGH');
          expect(message.data.id).toBe('alert_high');

          setTimeout(() => {
            expect(messageCount).toBe(1); // Only one message should be received
            done();
          }, 200);
        }
      });
    });
  });

  describe('Connection Management', () => {
    it('should handle connection drops gracefully', (done) => {
      let reconnectionAttempts = 0;

      const attemptReconnection = () => {
        reconnectionAttempts++;
        const newClient = new WebSocket(`ws://localhost:${port}`);

        newClient.on('open', () => {
          if (reconnectionAttempts === 1) {
            // First connection - close it immediately
            newClient.close();
            setTimeout(attemptReconnection, 100);
          } else {
            // Second connection - this should succeed
            expect(reconnectionAttempts).toBe(2);
            newClient.close();
            done();
          }
        });

        newClient.on('error', () => {
          if (reconnectionAttempts < 3) {
            setTimeout(attemptReconnection, 100);
          }
        });
      };

      attemptReconnection();
    });

    it('should handle high-frequency updates', (done) => {
      const updateCount = 100;
      let receivedCount = 0;

      wss.on('connection', (ws) => {
        // Send rapid updates
        for (let i = 0; i < updateCount; i++) {
          setTimeout(() => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({
                type: 'PRICE_UPDATE',
                data: {
                  address: 'test_token',
                  price: 0.01 + (i * 0.001),
                  sequence: i
                }
              }));
            }
          }, i * 10); // 10ms intervals
        }
      });

      client.on('message', (data) => {
        const message = JSON.parse(data.toString());
        if (message.type === 'PRICE_UPDATE') {
          receivedCount++;

          if (receivedCount === updateCount) {
            expect(receivedCount).toBe(updateCount);
            done();
          }
        }
      });
    }, 10000); // Extended timeout for high-frequency test
  });
});