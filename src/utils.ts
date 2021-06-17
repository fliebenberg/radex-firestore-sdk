import { from } from 'rxjs';
import { Order, OrderSide } from './models/order.class';

export enum SortOrder {
  ASCENDING = 'ASCENDING',
  DESCENDING = 'DESCENDING',
  NONE = 'NONE',
}

function createOrdersMap(order: Order, orderObjs: any[]): Map<number, Order[]> {
  const ordersMap = new Map<number, Order[]>();
  orderObjs.forEach((orderObj: any) => {
    const tOrder = Order.create(orderObj);
    if (!ordersMap.has(tOrder.price)) {
      ordersMap.set(tOrder.price, [tOrder]);
    } else {
      ordersMap.get(tOrder.price)?.push(tOrder);
    }
  });
  const sort = order.side === OrderSide.BUY ? SortOrder.ASCENDING : SortOrder.DESCENDING;
  return sortOrdersMap(ordersMap, sort);
}

export function sortOrdersMap(
  ordersMap: Map<number, Order[]>,
  sortOrder: SortOrder = SortOrder.ASCENDING,
): Map<number, Order[]> {
  const newOrdersMap = new Map<number, Order[]>();
  let orderedKeys = Array.from(ordersMap.keys()).sort((a, b) => a - b);
  if (sortOrder === SortOrder.DESCENDING) {
    orderedKeys = orderedKeys.reverse();
  }
  orderedKeys.forEach((key) => {
    const newOrdersList = sortOrdersArray(ordersMap.get(key));
    newOrdersMap.set(key, newOrdersList);
  });
  return newOrdersMap;
}

export function sortOrdersArray(
  ordersArray: Order[] | undefined,
  sortOrder: SortOrder = SortOrder.ASCENDING,
  field: string = 'dateCreated',
): Order[] {
  if (!ordersArray) {
    return [];
  } else if (sortOrder === SortOrder.NONE) {
    return ordersArray;
  } else {
    const sortMultiplier = sortOrder === SortOrder.ASCENDING ? 1 : -1;
    const newOrdersArray = ordersArray.sort((a: any, b: any) => {
      return (a[field] - b[field]) * sortMultiplier;
    });
    return newOrdersArray;
  }
}

export function calcPriceQuantity(ordersArray: Order[] | undefined): number {
  if (ordersArray) {
    return ordersArray.reduce((total, order) => {
      return total + order.quantity - order.quantityFulfilled;
    }, 0);
  } else return 0;
}

export function roundTo(digits: number = 0, n: number): number {
  const negativeMultiplier = n < 0 ? -1 : 1;
  const multiplier = Math.pow(10, digits) * negativeMultiplier;
  const result = +(Math.round(n * multiplier) / multiplier).toFixed(digits);
  return result;
}

export function getLastElement<T>(a: T[] | undefined): T | null {
  if (a && a.length > 0) {
    return a[a.length - 1];
  } else {
    return null;
  }
}

export function getTimeSliceStart(date: number, TSDuration: number = 15): number {
  const timeSliceSize = TSDuration * 60 * 1000;
  return date - (date % timeSliceSize);
}

export function getTokenNameFromPair(pairCode: string, tokenNo: 'token1' | 'token2'): string {
  if (tokenNo === 'token1') {
    return pairCode.split('-')[0];
  } else {
    return pairCode.split('-')[1];
  }
}
