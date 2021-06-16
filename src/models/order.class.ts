export enum OrderSide {
  EMPTY = '',
  BUY = 'BUY',
  SELL = 'SELL',
}

export enum OrderType {
  EMPTY = '',
  MARKET = 'MARKET',
  LIMIT = 'LIMIT',
  LIMITONLY = 'LIMIT-ONLY',
}

export enum OrderStatus {
  EMPTY = '',
  SUBMITTING = 'SUBMITTING', // order has been added to queue, but not yet processed
  PENDING = 'PENDING', // order has been added to order book, awaiting fulfilment
  COMPLETED = 'COMPLETED', // order has been fulfilled
  CANCELLED = 'CANCELLED', // order has been cancelled by owner
}

export interface AggregateOrderEntry {
  pair: string;
  side: OrderSide;
  price: number;
  quantity: number;
  orderCount: number;
}

export class Order {
  static requiredFields = ['owner', 'pair', 'token1', 'token2', 'side', 'type'];

  private constructor(
    public id: string = '',
    public owner: string = '',
    public pair: string = '',
    public token1: string = '',
    public token2: string = '',
    public dateCreated: number = 0,
    public dateCompleted: number = 0,
    public side: OrderSide = OrderSide.EMPTY,
    public type: OrderType = OrderType.EMPTY,
    public price: number = 0,
    public quantity: number = 0,
    public value: number = 0,
    public quantityFulfilled: number = 0,
    public valueFulfilled: number = 0,
    public quantitySpecified: boolean = true,
    public status: OrderStatus = OrderStatus.EMPTY,
  ) {}

  static create(orderObj: any): Order {
    // console.log("Creating new order with orderObj: ", orderObj);
    const newOrder = new Order();
    // console.log("Empty new order:", newOrder);
    Object.keys(newOrder).forEach((field) => {
      if (orderObj[field]) {
        // @ts-ignore
        newOrder[field] = orderObj[field];
      } else if (field === 'quantitySpecified' && orderObj[field] !== undefined) {
        newOrder[field] = orderObj[field];
      } else if (
        Order.requiredFields.includes(field) ||
        ((field === 'price' || field === 'quantity') && orderObj.type !== OrderType.MARKET)
      ) {
        throw new Error(field + ' is a required field to create an order');
      }
    });
    if (newOrder.quantitySpecified === true) {
      if (!newOrder.quantity) {
        throw new Error('quantity must be specified to create this order');
      }
      if (!newOrder.value && newOrder.type !== OrderType.MARKET) {
        newOrder.value = newOrder.price * newOrder.quantity;
      }
    }
    if (newOrder.quantitySpecified === false) {
      if (!newOrder.value) {
        throw new Error('value must be specified to create this order');
      }
    }
    if (newOrder.id && newOrder.id.search('_') === -1) {
      newOrder.id = newOrder.pair + '_' + newOrder.id;
    }
    // console.log("Finished creating new order:", newOrder);
    return newOrder;
  }
}
