import { CompanyProfile, DropdownOptions, PurchaseRecord, PackingRecord, PaymentRecord, OtherCostRecord } from '../types/index.ts';

export const initialCompanyProfile: CompanyProfile = {
  companyName: 'ZSB AQUATICS',
  address: '29/B, Tarartek, Nolvog, Turag, Dhaka – 1230',
  mobiles: ['+8801671036114', '+8801841165902'],
  managingPartner: 'Md. Mizanur Rahman',
  partner: 'Md. Sohel Rana',
  currency: 'TK',
  rmbExchangeRate: 16.5,
};

export const initialDropdownOptions: DropdownOptions = {
  purchaseItems: [
    'FF1', 'F1', 'F2', 'F3', 'KS/3', 'XXL', 'XL', 'L', 'SM', 'SSM', 'PCS',
  ],
  suppliers: [
    'ABDULLAH VAI',
    'UZZAL VAI',
    'NAPAL VAI',
    'FAISAL VAI',
    'RAKIB VAI',
    'KABIR VAI',
    'SAJID INT.',
    'MAA ENTERPRISE',
    'MOON TRADES',
  ],
  shippingMarks: [
    'AAD', 'CHJ-22', 'LXB-52', 'ROE', 'SMR', 'LKE', '123', 'KKP', 'HY-AN',
    'RC10K', 'SJP-5', 'RN-3', 'A1144', 'SHAJIB MAMA', 'BOBZGS', 'RRP', 'WH3-33',
    'GXY-88', 'TGB', 'DF', 'HYB', 'HB-3', 'HM-105', 'HKF', 'AAA', 'BOB',
    'RH', 'KAI', 'RAKIB', 'VAI FAISAL', 'VAI ZSB', 'GDY', 'KABIR VAI',
  ],
  flights: [
    'HGH', 'NGB', 'CZ', 'CAN', 'YG CAN', 'MU KMG', 'NKG', 'BG CAN',
    'YG KMG', 'SZX', 'JD KMG', 'CTU', 'CKG', 'BS CAN', 'CO CAN',
  ],
  destinations: [
    'GUANGZHOU', 'SHANGHAI', 'KUNMING', 'XIAMEN', 'HUANGZHOU', 'CHANGSHA',
    'FUZHOU', 'NANJING', 'SOJIB MAMA', 'LTC', 'KABIR VAI', 'RAKIB VAI', 'MOON TRADES',
  ],
  shippers: [
    'SHISHIR MAMA', 'SAJID INT.', 'RIK INTERNATIONAL', 'RS TRADE', 'RAKIB TRADERS',
    'MAA ENTERPRISE', 'FAISAL VAI', 'CANCELED', 'OFFLOAD', 'ANJUM',
    'SHOWMIK SHISIR', 'SNR', 'WC', 'WCM', 'OCEAN TRADE', 'ZSB AQUATICS',
    'BANGLA TRADE', 'LIBERTY',
  ],
  exportItems: [
    '2F', '3F', '4F', '5F', '6F', 'M', 'L', 'XL', 'XXL', '3XL', '4XL', 'SM', 'SF',
  ],
  boxes: ['1', '2', '3', '4', '5', '6', '7', '8', '9'],
  weights: ['16', '15', '14', '13', '12', '11', '10', '9', '8', '7', '6', '5', '4', '3', '2'],
  units: ['KG', 'PCS', 'BOX', 'BAG'],
  paymentDescriptions: [
    'CASH',
    'BANK TRANSFER / ONLINE PAYMENT',
    'CHEQUE PAYMENT',
    'ADVANCE PAYMENT',
    'FISH BILL PAYMENT',
    'TRANSPORT REBATE / ADJUSTMENT',
    'COMMISSION / DISCOUNT',
    'OTHER PAYMENT',
  ],
  paymentStatuses: ['NO REPORT', 'REPORT', 'PAID'],
  costingCategories: [
    'Air Freight & Cargo',
    'Airport Handling & Customs',
    'Boxes & Packing Materials',
    'Ice & Oxygen Cylinders',
    'Labor & Handling',
    'Local Transport & Pickup',
    'Export Documentation & Quarantine',
    'Office & Overhead Expenses',
    'Miscellaneous Expense',
  ],
};

// All database records initialized as clean empty arrays
export const initialPurchases: PurchaseRecord[] = [];
export const initialPackings: PackingRecord[] = [];
export const initialPayments: PaymentRecord[] = [];
export const initialOtherCosts: OtherCostRecord[] = [];
