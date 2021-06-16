export class TimeSlice {
  constructor(
    public startTime: number = 0,
    public open: number = 0,
    public close: number = 0,
    public high: number = 0,
    public low: number = 0,
    public token1Volume: number = 0,
    public token2Volume: number = 0,
    public noOfTrades: number = 0,
  ) {}
}
