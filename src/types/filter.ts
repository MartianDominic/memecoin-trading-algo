export interface FilterCondition {
  id: string;
  field: string;
  operator: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'in' | 'not_in' | 'contains' | 'not_contains' | 'between';
  value: any;
  label: string;
}

export interface FilterGroup {
  id: string;
  operator: 'AND' | 'OR';
  conditions: FilterCondition[];
  groups: FilterGroup[];
}

export interface FilterTemplate {
  id: string;
  name: string;
  description: string;
  category: 'safety' | 'trading' | 'market' | 'custom';
  filter: FilterGroup;
  isDefault: boolean;
}

export interface FilterField {
  id: string;
  label: string;
  type: 'number' | 'string' | 'boolean' | 'date' | 'select' | 'range';
  category: 'basic' | 'safety' | 'trading' | 'market' | 'creator';
  description: string;
  unit?: string;
  min?: number;
  max?: number;
  options?: { value: string; label: string }[];
  validation?: {
    required?: boolean;
    min?: number;
    max?: number;
  };
}

export interface FilterPreview {
  estimatedMatches: number;
  isValid: boolean;
  errors: string[];
  performance: {
    complexity: 'low' | 'medium' | 'high';
    estimatedTime: number;
  };
}

export interface SavedFilter {
  id: string;
  name: string;
  description?: string;
  filter: FilterGroup;
  createdAt: string;
  updatedAt: string;
  tags: string[];
  isPublic: boolean;
  usageCount: number;
}