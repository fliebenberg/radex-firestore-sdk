import { TimeSlice } from './time-slice.class';

export class Pair {
  static requiredFields = ['token1', 'token2'];

  constructor(
    public code: string = '',
    public token1: string = '', // identifier only
    public token2: string = '',
    public token1Decimals: number = 0,
    public token2Decimals: number = 0,
    public liquidityFee: number = 0,
    public platformFee: number = 0,
    public latestTimeSlice: TimeSlice = new TimeSlice(),
  ) {}

  static create(pairObj: any): Pair {
    const newPair = new Pair();
    Object.keys(newPair).forEach((field) => {
      if (field === 'latestTimeSlice' && pairObj[field]) {
        newPair[field] = pairObj[field];
      } else if (pairObj[field] || typeof pairObj[field] === 'boolean') {
        // @ts-ignore
        newPair[field] = pairObj[field];
      } else if (Pair.requiredFields.includes(field)) {
        throw new Error(field + ' is a required field to create a pair');
      }
    });
    return newPair;
  }
}
