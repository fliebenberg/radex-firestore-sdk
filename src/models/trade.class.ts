import { __classPrivateFieldSet } from 'tslib';

export enum TradeFeePayer {
  EMPTY = '',
  BUYER = 'BUYER',
  SELLER = 'SELLER',
}

export class Trade {
  static requiredFields = [
    'buyer',
    'buyQuantity',
    'buyOrderId',
    'seller',
    'sellQuantity',
    'sellOrderId',
    'token1',
    'token2',
    'feePayer',
  ];

  private constructor(
    public id: string = '',
    public pair: string = '',
    public buyer: string = '',
    public buyOrderId: string = '',
    public seller: string = '',
    public sellOrderId: string = '',
    public token1: string = '',
    public token2: string = '',
    public quantity: number = 0,
    public price: number = 0,
    public feePayer: TradeFeePayer = TradeFeePayer.EMPTY,
    public feeToken: string = '',
    public liquidityFee: number = 0,
    public platformFee: number = 0,
    public date: number = new Date().getTime(),
    public parties: string[] = [],
  ) {}

  static create(tradeObj: any): Trade {
    const newTrade = new Trade();
    Object.keys(newTrade).forEach((field) => {
      if (tradeObj[field]) {
        // @ts-ignore
        newTrade[field] = tradeObj[field];
      } else if (Trade.requiredFields.includes(field)) {
        throw new Error(field + ' is a required field to create a trade');
      }
    });
    if (newTrade.parties.length === 0) {
      newTrade.parties = [newTrade.buyer, newTrade.seller];
    }
    return newTrade;
  }
}
