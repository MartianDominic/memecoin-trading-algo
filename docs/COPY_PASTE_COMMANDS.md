# Copy-Paste Commands to Launch the App

## 🎯 Three Required Steps (Copy-Paste Each Block)

### Step 1: Create Environment File
```bash
cd /home/galaxy/Documents/memecoin-trading-algo
cp .env.example .env
```

**IMPORTANT**: Now edit `.env` and update these values:
- `DB_PASSWORD` - Your PostgreSQL password
- `REDIS_PASSWORD` - Your Redis password (or remove if no password)
- `JWT_SECRET` - Generate a long random string

### Step 2: Start Services & Setup Database
```bash
# Start Redis
sudo systemctl start redis-server

# Create database
sudo -u postgres psql -c "CREATE DATABASE memecoin_trading OWNER postgres;"

# Setup Prisma
npx prisma db push

# Create logs directory
mkdir -p logs
```

### Step 3: Build and Launch
```bash
# Build (ignoring TypeScript errors for now)
npx tsc --skipLibCheck

# Start the application
npm start
```

## ✅ Verification Commands

After starting, run these to verify everything works:

```bash
# Check services
systemctl is-active postgresql redis-server

# Test Redis
redis-cli ping

# Test database
psql -U postgres -d memecoin_trading -c "SELECT version();"

# Check app health
curl http://localhost:3000/health

# View logs
tail -f logs/app.log
```

## 🚀 Alternative: One-Command Setup

If you want everything automated:

```bash
cd /home/galaxy/Documents/memecoin-trading-algo
bash scripts/complete-setup.sh
```

This script will guide you through:
1. Creating .env (you'll need to edit it)
2. Starting all services
3. Setting up the database
4. Building the project
5. Launching the application

## 📱 Individual Service Commands

Start specific services separately:

```bash
# API Server only
npm run start:api

# WebSocket Server only
npm run start:websocket

# Token Aggregator only
npm run start:aggregator

# All services together
npm run start:all
```

## 🔧 If Something Goes Wrong

### Redis won't start
```bash
# Check status
systemctl status redis-server

# Try alternative start
sudo service redis-server start

# Check if port is available
lsof -i :6379
```

### PostgreSQL issues
```bash
# Check status
systemctl status postgresql

# View logs
journalctl -u postgresql -n 50
```

### Build errors
```bash
# Clean and rebuild
rm -rf dist/
npm run build -- --skipLibCheck
```

### Port conflicts
```bash
# Find what's using port 3000
lsof -i :3000

# Kill the process or change PORT in .env
PORT=3005 npm start
```

## 📊 After Launch

The application will be available at:
- Main App: http://localhost:3000
- API: http://localhost:3001
- WebSocket: ws://localhost:8080
- Health: http://localhost:3000/health

Monitor with:
```bash
# Live logs
tail -f logs/app.log

# Health check
npm run health

# Stop all services
npm run stop:all
```

---

**Quick Reference**:
1. `cp .env.example .env` → Edit passwords
2. `sudo systemctl start redis-server`
3. `sudo -u postgres psql -c "CREATE DATABASE memecoin_trading;"`
4. `npx prisma db push && npx tsc --skipLibCheck && npm start`

Done! 🎉
