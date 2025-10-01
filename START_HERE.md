# 🚀 START HERE - Launch Your Memecoin Trading Algorithm

## ✅ Everything is Ready!

All code fixes have been applied:
- ✅ Prisma schema updated with missing models (PriceData, TradingSignal, SafetyScore)
- ✅ Import paths fixed in all controllers
- ✅ TypeScript compilation errors resolved
- ✅ Project built successfully
- ✅ Database migrations ready

## 🎯 Quick Start (3 Steps)

### Step 1: Create Environment File
```bash
cp .env.example .env
nano .env  # or your preferred editor
```

**Update these values:**
```env
DB_PASSWORD=your_actual_password
DATABASE_URL=postgresql://postgres:your_actual_password@localhost:5432/memecoin_trading?schema=public
JWT_SECRET=your_long_random_secret_at_least_32_characters
```

### Step 2: Run the Launch Script
```bash
./LAUNCH.sh
```

The script will:
- Check all services
- Create the database
- Run migrations
- Start the application

### Step 3: Access Your Application
```
http://localhost:3000        - Main Application
http://localhost:3001        - API Server
ws://localhost:8080          - WebSocket
http://localhost:3000/health - Health Check
```

---

## 🔧 Manual Launch (If Script Fails)

### 1. Start Services
```bash
sudo systemctl start postgresql
sudo systemctl start redis-server  # Optional
```

### 2. Create Database
```bash
sudo -u postgres psql -c "CREATE DATABASE memecoin_trading OWNER postgres;"
```

### 3. Setup Schema
```bash
npx prisma db push
```

### 4. Launch
```bash
npm start
```

---

## 📊 What Was Fixed

| Component | Status | Changes Made |
|-----------|--------|--------------|
| Prisma Schema | ✅ Fixed | Added PriceData, TradingSignal, SafetyScore models |
| Token Model | ✅ Fixed | Added chain, logoUrl, totalSupply, circulatingSupply, launchDate |
| Import Paths | ✅ Fixed | Fixed 6 controllers with wrong logger import |
| TypeScript Types | ✅ Fixed | Replaced 'any' types with proper interfaces |
| Build System | ✅ Fixed | Compiled successfully with skipLibCheck |

---

## 🎛️ Service Management

### Check Status
```bash
# PostgreSQL
systemctl status postgresql

# Redis
redis-cli ping

# Application
curl http://localhost:3000/health
```

### View Logs
```bash
tail -f logs/app.log
```

### Stop Application
```bash
Ctrl+C  # in the terminal running the app
```

---

## ⚡ Alternative Launch Methods

### Launch API Only
```bash
npm run start:api
```

### Launch WebSocket Only
```bash
npm run start:websocket
```

### Launch All Services Separately
```bash
npm run start:all
```

### Development Mode with Auto-Reload
```bash
npm run dev
```

---

## 🔍 Troubleshooting

### "Database connection failed"
```bash
# Check DATABASE_URL in .env
# Verify PostgreSQL is running
systemctl status postgresql

# Test connection
psql -U postgres -d memecoin_trading -c "SELECT version();"
```

### "Redis connection failed"
Redis is optional. The app will run without it (caching will be disabled).
```bash
# Start Redis if you want caching
sudo systemctl start redis-server
redis-cli ping  # Should return PONG
```

### "Port already in use"
```bash
# Find what's using the port
lsof -i :3000

# Kill it or change PORT in .env
```

### Build Errors
```bash
# Clean rebuild
rm -rf dist/
npm run build
```

---

## 📈 Next Steps

1. ✅ Launch the application (`./LAUNCH.sh`)
2. ✅ Test health endpoint: `curl http://localhost:3000/health`
3. ✅ Monitor logs: `tail -f logs/app.log`
4. ✅ Test token discovery (wait 5 minutes for first scan)
5. ✅ Check API endpoints: `http://localhost:3001/api/v1/tokens`

---

## 🆘 Need Help?

**Logs Location**: `logs/app.log`

**Quick Debug**:
```bash
# Check all services
systemctl status postgresql redis-server

# Test database
psql -U postgres -d memecoin_trading -c "\\dt"

# Test Redis
redis-cli info

# Check ports
netstat -tulpn | grep -E ':(3000|3001|8080|5432|6379)'
```

**If Still Stuck**:
1. Check logs: `tail -f logs/app.log`
2. Verify .env file has correct values
3. Ensure all services are running
4. Try manual launch steps above

---

## 🎉 You're All Set!

Run `./LAUNCH.sh` to start your memecoin trading algorithm!

The application will:
- Discover new tokens every 5 minutes
- Analyze safety scores and rug pull risks
- Track liquidity and volume
- Alert on high-quality opportunities
- Provide real-time WebSocket updates

**Documentation**: See `docs/` folder for detailed guides

**Happy Trading! 🚀**
