# Setup Required - Manual Steps and Configuration Issues

## 🚨 Critical: Items Requiring Your Input

This document contains all the configuration, fixes, and manual steps needed to launch the application.

---

## 1. Environment Configuration (.env file)

**Status**: Protected by security hooks - requires manual creation

**Action Required**:
```bash
# Copy the example file
cp .env.example .env
```

Then update the following values in `.env`:

### Database Configuration
```env
DB_PASSWORD=your_actual_secure_password_here
DATABASE_URL=postgresql://postgres:your_actual_secure_password_here@localhost:5432/memecoin_trading?schema=public
```

### Redis Configuration
```env
REDIS_PASSWORD=your_actual_redis_password_here
```

### JWT Secret
```env
JWT_SECRET=your_super_secure_jwt_secret_minimum_32_characters_long
```

### Optional: API Keys (if you have them)
```env
# Solana RPC (free tier available)
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com

# Add any API keys for premium services
DEXSCREENER_API_KEY=your_key_here
MORALIS_API_KEY=your_key_here
```

---

## 2. Start Required Services

### Option A: Using Docker (Recommended)
```bash
# Start PostgreSQL and Redis
docker-compose up -d postgres redis

# Check if services are running
docker ps
```

### Option B: Using System Services
```bash
# Start PostgreSQL
sudo systemctl start postgresql

# Start Redis
sudo systemctl start redis-server

# Verify services are running
systemctl is-active postgresql redis-server
```

---

## 3. Database Setup

After starting PostgreSQL and creating your `.env` file:

```bash
# Create the database
sudo -u postgres psql -c "CREATE DATABASE memecoin_trading OWNER postgres;"

# Push the Prisma schema
npx prisma db push --accept-data-loss

# Or run migrations
npx prisma migrate dev --name init
```

---

## 4. TypeScript Compilation Errors

**Status**: 200+ TypeScript errors detected

### Root Cause
The API controllers expect Prisma models and fields that don't exist in the current schema:

**Missing Fields**:
- `Token.chain`
- `Token.logoUrl`
- `Token.totalSupply`
- `Token.circulatingSupply`
- `Token.launchDate`

**Missing Models**:
- `PriceData`
- `TradingSignal`
- `SafetyScore`

**Missing Imports**:
- `../../backend/src/config/logger` (incorrect path)

### Temporary Workaround
Build with type checking disabled:

```bash
# Build without strict type checking
npm run build -- --skipLibCheck

# Or use ts-node with transpile-only
npx ts-node --transpile-only src/index.ts
```

### Proper Fix
Update the Prisma schema (`prisma/schema.prisma`) to add missing fields:

```prisma
model Token {
  id                String    @id @default(cuid())
  address           String    @unique
  symbol            String
  name              String
  decimals          Int
  supply            BigInt?
  price             Float?
  marketCap         Float?
  volume24h         Float?
  liquidity         Float?
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  // Add these missing fields
  chain             String?
  logoUrl           String?
  totalSupply       BigInt?
  circulatingSupply BigInt?
  launchDate        DateTime?

  // Analysis data
  rugScore          Float?
  safetyScore       Float?
  liquidityScore    Float?
  volumeScore       Float?
  overallScore      Float?

  // Metadata
  website           String?
  telegram          String?
  twitter           String?
  description       String?

  // Relations
  prices            TokenPrice[]
  alerts            Alert[]
  analyses          TokenAnalysis[]
  priceData         PriceData[]      // Add this
  safetyScores      SafetyScore[]    // Add this
  tradingSignals    TradingSignal[]  // Add this

  @@map("tokens")
}

model PriceData {
  id        String   @id @default(cuid())
  tokenId   String
  price     Float
  timestamp DateTime @default(now())

  token     Token    @relation(fields: [tokenId], references: [id], onDelete: Cascade)

  @@map("price_data")
  @@index([tokenId, timestamp])
}

model SafetyScore {
  id            String   @id @default(cuid())
  tokenId       String
  overallScore  Float
  rugScore      Float
  liquidityScore Float
  holderScore   Float
  timestamp     DateTime @default(now())

  token         Token    @relation(fields: [tokenId], references: [id], onDelete: Cascade)

  @@map("safety_scores")
  @@index([tokenId, timestamp])
}

model TradingSignal {
  id          String   @id @default(cuid())
  tokenId     String
  signalType  String
  strength    Float
  price       Float
  timestamp   DateTime @default(now())

  token       Token    @relation(fields: [tokenId], references: [id], onDelete: Cascade)

  @@map("trading_signals")
  @@index([tokenId, timestamp])
}
```

After updating the schema:
```bash
npx prisma generate
npx prisma db push
npm run build
```

---

## 5. Fix Import Errors

**Issue**: Controllers import from incorrect path
```typescript
// ❌ Wrong
import { logger } from '../../backend/src/config/logger';

// ✅ Correct
import { Logger } from '../../utils/logger';
```

**Files to fix**:
- `src/api/controllers/filters.controller.ts`
- `src/api/controllers/tokens.controller.ts`

---

## 6. Fix 'any' Types in blockchain.service.ts

Replace 'any' types with proper types:

```typescript
// Line 113
const topPair = pairs.sort((a: DexPair, b: DexPair) =>
  (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0)
)[0];

// Lines 200-202
.filter((pair: DexPair) => pair.chainId === network)
.sort((a: DexPair, b: DexPair) => (b.liquidity?.usd || 0) - (a.liquidity?.usd || 0))
.map((pair: DexPair) => pair.baseToken.address.toLowerCase());
```

Define the DexPair interface if it doesn't exist.

---

## 7. Launch the Application

### After completing steps 1-3:

```bash
# Quick automated setup (if services are running)
bash scripts/complete-setup.sh

# Or manual build and start
npm run build -- --skipLibCheck
npm start
```

### Start Individual Services:

```bash
# API Server
npm run start:api

# WebSocket Server
npm run start:websocket

# Token Aggregator
npm run start:aggregator

# All services together
npm run start:all
```

---

## 8. Verification

Test that services are running:

```bash
# Health check
npm run health
curl http://localhost:3000/health

# Check logs
npm run logs

# Or view directly
tail -f logs/app.log
```

---

## Summary of Issues

| Issue | Severity | Status | Action Required |
|-------|----------|--------|-----------------|
| .env file creation | 🔴 Critical | Manual | Copy .env.example and fill values |
| Start Redis | 🔴 Critical | Manual | sudo systemctl start redis-server |
| Start PostgreSQL | 🔴 Critical | Completed | Already running |
| Create database | 🔴 Critical | Manual | Run SQL command or script |
| Prisma schema mismatch | 🟡 High | Documented | Update schema with missing models |
| TypeScript errors | 🟡 High | Workaround | Use --skipLibCheck or fix types |
| Import path errors | 🟡 Medium | Documented | Fix import paths in controllers |
| 'any' types | 🟢 Low | Documented | Replace with proper types |

---

## Quick Start (If You Want to Skip Fixes)

If you just want to get the app running despite the TypeScript errors:

```bash
# 1. Create .env
cp .env.example .env
# Edit .env with your passwords

# 2. Start services
sudo systemctl start redis-server postgresql

# 3. Create database
sudo -u postgres psql -c "CREATE DATABASE memecoin_trading OWNER postgres;"

# 4. Setup database
npx prisma db push

# 5. Build (ignore type errors)
npx tsc --skipLibCheck

# 6. Run
npm start
```

---

## Need Help?

- Check logs: `tail -f logs/app.log`
- Test database: `psql -U postgres -d memecoin_trading -c "SELECT version();"`
- Test Redis: `redis-cli ping`
- Check ports: `netstat -tulpn | grep -E ':(3000|3001|5432|6379|8080)'`

---

**Last Updated**: $(date)
**Status**: Ready for manual configuration
