# Memecoin Trading Dashboard Frontend

A comprehensive Next.js 14+ frontend for real-time memecoin tracking and analysis with advanced filtering capabilities.

## 🚀 Features

### Core Dashboard
- **Real-time Data**: WebSocket integration for live token updates
- **Advanced Filtering**: Custom filter builder with predefined presets
- **Multiple Views**: Table and card views for token display
- **Export Functionality**: CSV/JSON export of filtered data
- **Theme Support**: Dark/light/system theme with persistence

### Filtering Capabilities
Built-in filter presets including the exact criteria specified:
- **Safe New Tokens**: Age <24h, Liquidity >$5k, Volume >$1k, Safety ≥6, No honeypot, Routing exists, <10% slippage, Creator <3 rugs, Top holders <60%
- **High Volume**: Significant trading activity filters
- **Established & Safe**: Proven safety record tokens
- **Micro Cap Gems**: Small market cap with potential

### Components

#### Layout Components
- `Header.tsx` - Top navigation with search, theme toggle, and controls
- `Sidebar.tsx` - Filter presets, active filters, and navigation
- `Layout/` - Responsive layout components

#### Data Components
- `TokenTable.tsx` - Advanced data table with sorting, filtering, pagination
- `TokenCard.tsx` - Individual token cards with comprehensive metrics
- `FilterBuilder.tsx` - Custom filter creation interface
- `AlertPanel.tsx` - Real-time notifications and alerts

#### UI Components
Complete shadcn/ui component library including:
- `button`, `card`, `table`, `badge`, `input`, `select`
- `tabs`, `dropdown-menu`, `separator`, `scroll-area`
- `collapsible` components

## 🛠 Tech Stack

- **Framework**: Next.js 14+ with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS + shadcn/ui
- **State Management**: Zustand with persistence
- **Data Fetching**: React Query (TanStack Query)
- **Real-time**: WebSocket with auto-reconnection
- **Tables**: TanStack Table with sorting/filtering
- **Forms**: React Hook Form with Zod validation

## 📁 Project Structure

```
frontend/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── layout.tsx         # Root layout with providers
│   │   ├── page.tsx           # Main dashboard page
│   │   └── globals.css        # Global styles
│   ├── components/
│   │   ├── ui/                # shadcn/ui components
│   │   ├── Layout/            # Layout components
│   │   ├── providers/         # React providers
│   │   ├── TokenTable.tsx     # Data table component
│   │   ├── TokenCard.tsx      # Token card component
│   │   ├── FilterBuilder.tsx  # Filter creation
│   │   └── AlertPanel.tsx     # Notifications
│   ├── hooks/                 # Custom React hooks
│   │   ├── useTokens.ts       # Token data fetching
│   │   └── useWebSocket.ts    # WebSocket connection
│   ├── lib/                   # Utilities and configs
│   │   ├── utils.ts           # Helper functions
│   │   ├── api.ts             # API client
│   │   └── react-query.ts     # Query client config
│   ├── stores/                # Zustand stores
│   │   └── useTokenStore.ts   # Global state management
│   └── types/                 # TypeScript types
│       ├── index.ts           # Core types
│       └── filters.ts         # Filter types
├── components.json            # shadcn/ui config
├── package.json               # Dependencies
├── tailwind.config.js         # Tailwind config
└── tsconfig.json             # TypeScript config
```

## 🎯 Key Features Implementation

### 1. Real-time Data
- WebSocket connection with auto-reconnection
- Live token price and volume updates
- Connection status indicators

### 2. Advanced Filtering
- Predefined filter presets for common use cases
- Custom filter builder with multiple conditions
- Boolean, numeric, and string field support
- Filter persistence across sessions

### 3. Data Visualization
- Sortable and filterable data table
- Card view for visual token overview
- Safety score indicators and risk badges
- Price change indicators with color coding

### 4. Export & Analytics
- CSV/JSON export functionality
- Quick statistics dashboard
- Alert system for important events
- Performance metrics tracking

## 🚦 Getting Started

1. **Install Dependencies**
   ```bash
   cd frontend
   npm install
   ```

2. **Environment Setup**
   Create `.env.local`:
   ```
   NEXT_PUBLIC_API_URL=http://localhost:3001
   NEXT_PUBLIC_WS_URL=ws://localhost:3001/ws
   ```

3. **Development**
   ```bash
   npm run dev
   ```

4. **Build**
   ```bash
   npm run build
   npm start
   ```

## 🎨 Theming

The application supports three theme modes:
- **Light**: Traditional light theme
- **Dark**: Dark theme for low-light environments
- **System**: Automatically matches system preference

Theme preference is persisted across sessions.

## 📱 Responsive Design

Fully responsive design optimized for:
- **Desktop**: Full-featured dashboard layout
- **Tablet**: Collapsible sidebar, optimized table
- **Mobile**: Stacked layout, touch-friendly controls

## 🔄 State Management

- **Global State**: Zustand store with persistence
- **Server State**: React Query for caching and synchronization
- **Real-time Updates**: WebSocket integration with store updates
- **Filter State**: Persistent custom filters and presets

## 🚀 Performance

- **Code Splitting**: Automatic with Next.js
- **Image Optimization**: Next.js image optimization
- **Bundle Analysis**: Built-in bundle analyzer
- **Caching**: React Query with smart cache invalidation

## 🔐 Type Safety

Comprehensive TypeScript coverage including:
- API response types
- Component prop types
- Store state types
- Filter configuration types
- WebSocket message types

Built with strict TypeScript configuration and proper error handling throughout.