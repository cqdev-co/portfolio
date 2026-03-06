import { db } from './index';
import { categories } from './schema';
import { v4 as uuid } from 'uuid';

const DEFAULT_CATEGORIES = [
  // Income
  { name: 'Salary', groupName: 'Income', icon: '💰', type: 'income' },
  { name: 'Freelance', groupName: 'Income', icon: '💻', type: 'income' },
  { name: 'Investments', groupName: 'Income', icon: '📈', type: 'income' },
  { name: 'Other Income', groupName: 'Income', icon: '💵', type: 'income' },

  // Housing
  { name: 'Rent/Mortgage', groupName: 'Housing', icon: '🏠', type: 'expense' },
  { name: 'Utilities', groupName: 'Housing', icon: '⚡', type: 'expense' },
  { name: 'Insurance', groupName: 'Housing', icon: '🛡️', type: 'expense' },
  { name: 'Maintenance', groupName: 'Housing', icon: '🔧', type: 'expense' },

  // Food & Drink
  { name: 'Groceries', groupName: 'Food & Drink', icon: '🛒', type: 'expense' },
  {
    name: 'Restaurants',
    groupName: 'Food & Drink',
    icon: '🍽️',
    type: 'expense',
  },
  {
    name: 'Coffee Shops',
    groupName: 'Food & Drink',
    icon: '☕',
    type: 'expense',
  },
  { name: 'Fast Food', groupName: 'Food & Drink', icon: '🍔', type: 'expense' },
  {
    name: 'Alcohol & Bars',
    groupName: 'Food & Drink',
    icon: '🍺',
    type: 'expense',
  },

  // Transportation
  { name: 'Gas', groupName: 'Transportation', icon: '⛽', type: 'expense' },
  {
    name: 'Car Payment',
    groupName: 'Transportation',
    icon: '🚗',
    type: 'expense',
  },
  {
    name: 'Car Insurance',
    groupName: 'Transportation',
    icon: '📋',
    type: 'expense',
  },
  {
    name: 'Public Transit',
    groupName: 'Transportation',
    icon: '🚇',
    type: 'expense',
  },
  {
    name: 'Rideshare',
    groupName: 'Transportation',
    icon: '🚕',
    type: 'expense',
  },
  { name: 'Parking', groupName: 'Transportation', icon: '🅿️', type: 'expense' },

  // Shopping
  { name: 'Clothing', groupName: 'Shopping', icon: '👕', type: 'expense' },
  { name: 'Electronics', groupName: 'Shopping', icon: '📱', type: 'expense' },
  { name: 'Amazon', groupName: 'Shopping', icon: '📦', type: 'expense' },
  {
    name: 'General Shopping',
    groupName: 'Shopping',
    icon: '🛍️',
    type: 'expense',
  },

  // Entertainment
  {
    name: 'Streaming Services',
    groupName: 'Entertainment',
    icon: '📺',
    type: 'expense',
  },
  { name: 'Games', groupName: 'Entertainment', icon: '🎮', type: 'expense' },
  {
    name: 'Movies & Events',
    groupName: 'Entertainment',
    icon: '🎬',
    type: 'expense',
  },
  { name: 'Hobbies', groupName: 'Entertainment', icon: '🎨', type: 'expense' },

  // Health & Fitness
  { name: 'Gym', groupName: 'Health & Fitness', icon: '🏋️', type: 'expense' },
  {
    name: 'Medical',
    groupName: 'Health & Fitness',
    icon: '🏥',
    type: 'expense',
  },
  {
    name: 'Pharmacy',
    groupName: 'Health & Fitness',
    icon: '💊',
    type: 'expense',
  },

  // Personal
  { name: 'Subscriptions', groupName: 'Personal', icon: '🔄', type: 'expense' },
  { name: 'Phone', groupName: 'Personal', icon: '📱', type: 'expense' },
  { name: 'Education', groupName: 'Personal', icon: '📚', type: 'expense' },
  { name: 'Gifts', groupName: 'Personal', icon: '🎁', type: 'expense' },
  { name: 'Personal Care', groupName: 'Personal', icon: '💇', type: 'expense' },

  // Travel
  { name: 'Flights', groupName: 'Travel', icon: '✈️', type: 'expense' },
  { name: 'Hotels', groupName: 'Travel', icon: '🏨', type: 'expense' },
  { name: 'Vacation', groupName: 'Travel', icon: '🏖️', type: 'expense' },

  // Financial
  { name: 'Transfer', groupName: 'Financial', icon: '🔄', type: 'transfer' },
  {
    name: 'Savings Transfer',
    groupName: 'Financial',
    icon: '🏦',
    type: 'transfer',
  },
  {
    name: 'Fees & Charges',
    groupName: 'Financial',
    icon: '💳',
    type: 'expense',
  },

  // Uncategorized
  { name: 'Uncategorized', groupName: 'Other', icon: '❓', type: 'expense' },
];

export async function seedCategories() {
  const existing = await db.select().from(categories);
  if (existing.length > 0) return;

  await db.insert(categories).values(
    DEFAULT_CATEGORIES.map((cat) => ({
      id: uuid(),
      ...cat,
      isCustom: false,
    }))
  );
}
