export interface Equipment {
  id: number;
  name: string;
  type: 'PC' | 'Console';
  status: 'available' | 'maintenance' | 'out_of_service';
}

export interface Peripheral {
  id: number;
  name: string;
  type: 'Controller' | 'Headset' | 'Keyboard' | 'Mouse' | 'Other';
  equipment_id: number | null;
  status: 'available' | 'maintenance' | 'out_of_service';
}

export interface Product {
  id: number;
  name: string;
  category: 'product' | 'recharge' | 'service' | 'giftcard' | 'console' | 'pc' | 'controller' | 'mouse' | 'keyboard' | 'headset';
  price: number;
  cost: number;
  stock: number;
}

export interface Rental {
  id: number;
  equipment_id: number | null;
  equipment_pc_id?: string | null;
  type: 'PC' | 'Console';
  identifier: string;
  start_time: string;
  end_time?: string;
  status: 'active' | 'timed_out' | 'completed' | 'cancelled';
  advance_payment: number;
  total_price: number;
  limit_minutes: number;
  is_frozen: boolean;
  is_overdue?: boolean;
  frozen_at: string | null;
  remaining_seconds: number | null;
}

export interface Expense {
  id: number;
  description: string;
  amount: number;
  category: 'execution' | 'investment' | 'other' | 'loss';
  timestamp: string;
}

export interface AnalyticsSummary {
  revenue: number;
  expenses: number;
  investment: number;
  execution: number;
  losses: number;
  profit: number;
  todayRevenue: number;
  todayProfit: number;
  topProducts?: Array<{ name: string; count: number }>;
  topEquipment?: Array<{ identifier: string; rental_count: number }>;
}

export interface Loss {
  id: number;
  product_id: number | null;
  equipment_id: number | null;
  peripheral_id: number | null;
  product_name?: string;
  equipment_name?: string;
  peripheral_name?: string;
  quantity: number;
  type: 'merma' | 'scrap' | 'damage';
  reason: string;
  amount: number;
  timestamp: string;
}
