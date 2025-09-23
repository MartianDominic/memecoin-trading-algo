import { FilterField } from '../../types/filter';

export const FILTER_FIELDS: FilterField[] = [
  // Basic Properties
  {
    id: 'age_hours',
    label: 'Age (Hours)',
    type: 'number',
    category: 'basic',
    description: 'Token age in hours since creation',
    unit: 'hours',
    min: 0,
    max: 8760, // 1 year
    validation: { min: 0 }
  },
  {
    id: 'market_cap',
    label: 'Market Cap',
    type: 'number',
    category: 'basic',
    description: 'Current market capitalization',
    unit: '$',
    min: 0,
    validation: { min: 0 }
  },
  {
    id: 'liquidity_usd',
    label: 'Liquidity',
    type: 'number',
    category: 'basic',
    description: 'Total liquidity in USD',
    unit: '$',
    min: 0,
    validation: { min: 0 }
  },

  // Trading Metrics
  {
    id: 'volume_24h',
    label: '24h Volume',
    type: 'number',
    category: 'trading',
    description: '24-hour trading volume',
    unit: '$',
    min: 0,
    validation: { min: 0 }
  },
  {
    id: 'volume_1h',
    label: '1h Volume',
    type: 'number',
    category: 'trading',
    description: '1-hour trading volume',
    unit: '$',
    min: 0,
    validation: { min: 0 }
  },
  {
    id: 'price_change_24h',
    label: '24h Price Change',
    type: 'number',
    category: 'trading',
    description: '24-hour price change percentage',
    unit: '%',
    min: -100,
    max: 10000
  },
  {
    id: 'price_change_1h',
    label: '1h Price Change',
    type: 'number',
    category: 'trading',
    description: '1-hour price change percentage',
    unit: '%',
    min: -100,
    max: 1000
  },
  {
    id: 'buys_count',
    label: 'Buy Count',
    type: 'number',
    category: 'trading',
    description: 'Number of buy transactions',
    min: 0,
    validation: { min: 0 }
  },
  {
    id: 'sells_count',
    label: 'Sell Count',
    type: 'number',
    category: 'trading',
    description: 'Number of sell transactions',
    min: 0,
    validation: { min: 0 }
  },
  {
    id: 'buy_sell_ratio',
    label: 'Buy/Sell Ratio',
    type: 'number',
    category: 'trading',
    description: 'Ratio of buys to sells',
    min: 0,
    validation: { min: 0 }
  },

  // Safety Metrics
  {
    id: 'safety_score',
    label: 'Safety Score',
    type: 'number',
    category: 'safety',
    description: 'Overall safety score (0-100)',
    min: 0,
    max: 100,
    validation: { min: 0, max: 100 }
  },
  {
    id: 'rug_risk',
    label: 'Rug Risk',
    type: 'select',
    category: 'safety',
    description: 'Rug pull risk assessment',
    options: [
      { value: 'low', label: 'Low Risk' },
      { value: 'medium', label: 'Medium Risk' },
      { value: 'high', label: 'High Risk' },
      { value: 'critical', label: 'Critical Risk' }
    ]
  },
  {
    id: 'honeypot_detected',
    label: 'Honeypot Detected',
    type: 'boolean',
    category: 'safety',
    description: 'Whether honeypot pattern was detected'
  },
  {
    id: 'holder_concentration',
    label: 'Holder Concentration',
    type: 'number',
    category: 'safety',
    description: 'Top 10 holders percentage',
    unit: '%',
    min: 0,
    max: 100,
    validation: { min: 0, max: 100 }
  },
  {
    id: 'contract_verified',
    label: 'Contract Verified',
    type: 'boolean',
    category: 'safety',
    description: 'Whether contract is verified on block explorer'
  },
  {
    id: 'liquidity_locked',
    label: 'Liquidity Locked',
    type: 'boolean',
    category: 'safety',
    description: 'Whether liquidity is locked'
  },

  // Creator Metrics
  {
    id: 'creator_success_rate',
    label: 'Creator Success Rate',
    type: 'number',
    category: 'creator',
    description: 'Creator historical success rate',
    unit: '%',
    min: 0,
    max: 100,
    validation: { min: 0, max: 100 }
  },
  {
    id: 'creator_token_count',
    label: 'Creator Token Count',
    type: 'number',
    category: 'creator',
    description: 'Number of tokens created by this creator',
    min: 0,
    validation: { min: 0 }
  },
  {
    id: 'creator_risk_score',
    label: 'Creator Risk Score',
    type: 'number',
    category: 'creator',
    description: 'Creator risk assessment score',
    min: 0,
    max: 100,
    validation: { min: 0, max: 100 }
  },

  // Market Metrics
  {
    id: 'holders_count',
    label: 'Holders Count',
    type: 'number',
    category: 'market',
    description: 'Total number of token holders',
    min: 0,
    validation: { min: 0 }
  },
  {
    id: 'unique_traders',
    label: 'Unique Traders',
    type: 'number',
    category: 'market',
    description: 'Number of unique traders',
    min: 0,
    validation: { min: 0 }
  },
  {
    id: 'trending_score',
    label: 'Trending Score',
    type: 'number',
    category: 'market',
    description: 'Social media trending score',
    min: 0,
    max: 100,
    validation: { min: 0, max: 100 }
  }
];

export const OPERATORS = {
  number: [
    { value: 'eq', label: 'Equals' },
    { value: 'ne', label: 'Not equals' },
    { value: 'gt', label: 'Greater than' },
    { value: 'gte', label: 'Greater than or equal' },
    { value: 'lt', label: 'Less than' },
    { value: 'lte', label: 'Less than or equal' },
    { value: 'between', label: 'Between' }
  ],
  string: [
    { value: 'eq', label: 'Equals' },
    { value: 'ne', label: 'Not equals' },
    { value: 'contains', label: 'Contains' },
    { value: 'not_contains', label: 'Does not contain' }
  ],
  select: [
    { value: 'eq', label: 'Is' },
    { value: 'ne', label: 'Is not' },
    { value: 'in', label: 'Is one of' },
    { value: 'not_in', label: 'Is not one of' }
  ],
  boolean: [
    { value: 'eq', label: 'Is' }
  ]
};