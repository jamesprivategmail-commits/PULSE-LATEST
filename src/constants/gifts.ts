import { VirtualGift } from '../types';

export const VIRTUAL_GIFTS: VirtualGift[] = [
  {
    id: 'gift_rose',
    name: 'Rose',
    icon: '🌹',
    coins: 1,
    points: 10,
    animationType: 'pop',
    color: '#ff2d55',
    tier: 'common'
  },
  {
    id: 'gift_ice_cream',
    name: 'Ice Cream',
    icon: '🍦',
    coins: 5,
    points: 50,
    animationType: 'float',
    color: '#ff9ff3',
    tier: 'common'
  },
  {
    id: 'gift_donut',
    name: 'Glazed Donut',
    icon: '🍩',
    coins: 15,
    points: 150,
    animationType: 'pop',
    color: '#feca57',
    tier: 'common'
  },
  {
    id: 'gift_confetti',
    name: 'Party Popper',
    icon: '🎉',
    coins: 30,
    points: 300,
    animationType: 'fireworks',
    color: '#00d2d3',
    tier: 'rare'
  },
  {
    id: 'gift_fire',
    name: 'Pulse Flame',
    icon: '🔥',
    coins: 50,
    points: 500,
    animationType: 'fireworks',
    color: '#ff6b6b',
    tier: 'rare'
  },
  {
    id: 'gift_rocket',
    name: 'Pulse Rocket',
    icon: '🚀',
    coins: 100,
    points: 1000,
    animationType: 'rocket',
    color: '#54a0ff',
    tier: 'rare'
  },
  {
    id: 'gift_crown',
    name: 'Golden Crown',
    icon: '👑',
    coins: 500,
    points: 5000,
    animationType: 'crown',
    color: '#ffd32a',
    tier: 'epic'
  },
  {
    id: 'gift_diamond',
    name: 'Pulse Diamond',
    icon: '💎',
    coins: 1000,
    points: 10000,
    animationType: 'galaxy',
    color: '#25f4ee',
    tier: 'epic'
  },
  {
    id: 'gift_galaxy',
    name: 'Cosmic Galaxy',
    icon: '🌌',
    coins: 2500,
    points: 25000,
    animationType: 'galaxy',
    color: '#a29bfe',
    tier: 'legendary'
  },
  {
    id: 'gift_lion',
    name: 'Golden Lion',
    icon: '🦁',
    coins: 5000,
    points: 50000,
    animationType: 'lion',
    color: '#ff9f1a',
    tier: 'legendary'
  }
];

export interface CoinRechargePackage {
  id: string;
  coins: number;
  bonusCoins: number;
  priceUSD: number;
  priceNGN: number;
  isPopular?: boolean;
  isBestValue?: boolean;
}

export const OPAY_PAYMENT_CONFIG = {
  bankName: 'OPay (Paycom)',
  accountNumber: '8116324053',
  accountName: 'Irete Gideon Osemudiamen',
  currency: 'NGN (₦)',
  adminTelegram: 'nova_tech_1'
};

export const COIN_PACKAGES: CoinRechargePackage[] = [
  { id: 'coin_pack_70', coins: 70, bonusCoins: 0, priceUSD: 0.99, priceNGN: 1500 },
  { id: 'coin_pack_350', coins: 350, bonusCoins: 15, priceUSD: 4.99, priceNGN: 7500, isPopular: true },
  { id: 'coin_pack_700', coins: 700, bonusCoins: 50, priceUSD: 9.99, priceNGN: 15000 },
  { id: 'coin_pack_1400', coins: 1400, bonusCoins: 120, priceUSD: 19.99, priceNGN: 30000 },
  { id: 'coin_pack_3500', coins: 3500, bonusCoins: 350, priceUSD: 49.99, priceNGN: 75000, isBestValue: true },
  { id: 'coin_pack_7000', coins: 7000, bonusCoins: 1000, priceUSD: 99.99, priceNGN: 150000 }
];
