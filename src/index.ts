import { FS, FN } from './firebase';
import { collectionData, docData } from 'rxfire/firestore';
import { combineLatest, merge, Observable, of } from 'rxjs';
import { filter, map, startWith, take } from 'rxjs/operators';
import { Pair } from './models/pair.class';
import { Order, OrderSide, OrderStatus, OrderType, AggregateOrderEntry } from './models/order.class';
import { Trade } from './models/trade.class';
import * as Utils from './utils';
import { TimeSlice } from './models/time-slice.class';

const fb = FS();
const fn = FN();

const pairsCollectionRef = fb.collection('pairs');

export { Pair, Order, OrderSide, OrderStatus, OrderType, AggregateOrderEntry, Trade };
export { Utils };
export const SUCCESS = 'SUCCESS';

// WRITE/CREATE API functions

// API
// Submits an order for processing by the RaDeX exchange
// Order will either be matched immediately with an existing order, added to the list of pending orders or rejected with an error message
export async function submitOrder(order: Order): Promise<string> {
  const addOrderToQFn = fn.httpsCallable('addOrderToQFn');

  const result = await addOrderToQFn({ order: order });
  if (result.data.success) {
    // console.log("Order added to queue. Waiting for processing. Id: " + result.data.success);
    const orderPath = 'pairs/' + order.pair + '/queued-orders/' + result.data.success;
    const qMsg = await docData(fb.doc(orderPath))
      .pipe(
        map((orderObj: any) => {
          return orderObj.qMsg;
        }),
        filter((tMsg) => {
          return tMsg !== '';
        }),
        take(1),
      )
      .toPromise();
    if (qMsg !== SUCCESS) {
      console.warn('Order not processed: ' + qMsg);
    }
    const delResult = await fn.httpsCallable('deleteOrderFn')({ path: orderPath });
    if (delResult.data === SUCCESS) {
      // console.log("Order processed and deleted from queue. Id: ", result.data.success);
    } else {
      console.error('Unexpected Error! Could not delete order from queue. Id: ', result.data.success);
    }
    return qMsg;
  } else {
    console.log('Order not submitted: ', result.data);
    return result.data;
  }
}

// API
// Cancels an order that has been submitted previously for processing by the RaDeX exchange
// Only orders with Status "PENDING" can be cancelled. Any part of the order that has already been fulfilled cannot be cancelled.
export async function cancelOrder(order: Order): Promise<string> {
  const cancelOrderFn = fn.httpsCallable('cancelOrderFn');
  const result = await cancelOrderFn({ order: order });
  if (result.data.success) {
    console.log('Order cancelled successfully');
    return SUCCESS;
  } else {
    console.log('Order not cancelled', result.data);
    return result.data.error;
  }
}

// TODO add a function to create a new pair

// READ-ONLY API functions

// API
// Returns quote information for a specified market order - how many tokens it will cost, how many tokens will be received and fee payable
// Will return NULL if the order is not a MARKET order or if the market order will not be executed
export async function getMarketOrderQuote(order: Order): Promise<{
  pay: number;
  receive: number;
  fee: number;
  payToken: string;
  receiveToken: string;
  feeToken: string;
} | null> {
  if (order && order.type === OrderType.MARKET) {
    // console.log("Starting to get quote for order: ", order);
    const pairInfo = Pair.create(await getPairInfo(order.pair));
    let existingOrders = new Map<number, Order[]>();
    if (order.side === OrderSide.BUY) {
      const tOrders = await getPairSellOrders$(order.pair).pipe(take(1)).toPromise();
      if (tOrders) {
        existingOrders = tOrders;
      }
    } else {
      const tOrders = await getPairBuyOrders$(order.pair).pipe(take(1)).toPromise();
      if (tOrders) {
        existingOrders = tOrders;
      }
    }
    // console.log("Got existing orders: ", existingOrders);
    let priceLimit = order.price;
    if (!priceLimit) {
      priceLimit = Utils.getLastElement(Array.from(existingOrders.keys())) as number;
    }
    // let orderReq = {quantity: 0, value: 0};
    let orderReq = null;
    orderReq = calcMarketOrderRequirements(
      order,
      existingOrders,
      priceLimit,
      pairInfo.token1Decimals,
      pairInfo.token2Decimals,
    );
    if (orderReq == null) {
      return null;
    }
    // add effect of fees to orderValue
    let fee: number;
    if (order.side === OrderSide.BUY) {
      if (order.quantitySpecified) {
        fee = Utils.roundTo(pairInfo.token2Decimals, orderReq.value * (pairInfo.liquidityFee + pairInfo.platformFee));
        orderReq.value = Utils.roundTo(pairInfo.token2Decimals, orderReq.value + fee);
      } else {
        fee = Utils.roundTo(
          pairInfo.token1Decimals,
          orderReq.quantity * (pairInfo.liquidityFee + pairInfo.platformFee),
        );
        orderReq.quantity = Utils.roundTo(pairInfo.token1Decimals, orderReq.quantity - fee);
      }
    } else {
      if (order.quantitySpecified) {
        fee = Utils.roundTo(pairInfo.token2Decimals, orderReq.value * (pairInfo.liquidityFee + pairInfo.platformFee));
        orderReq.value = Utils.roundTo(pairInfo.token2Decimals, orderReq.value - fee);
      } else {
        fee = Utils.roundTo(
          pairInfo.token1Decimals,
          orderReq.quantity * (pairInfo.liquidityFee + pairInfo.platformFee),
        );
        orderReq.quantity = Utils.roundTo(pairInfo.token1Decimals, orderReq.quantity + fee);
      }
    }
    return {
      pay: order.side === OrderSide.BUY ? orderReq.value : orderReq.quantity,
      receive: order.side === OrderSide.BUY ? orderReq.quantity : orderReq.value,
      fee: fee,
      payToken: order.side === OrderSide.BUY ? pairInfo.token2 : pairInfo.token1,
      receiveToken: order.side === OrderSide.BUY ? pairInfo.token1 : pairInfo.token2,
      feeToken: order.quantitySpecified ? pairInfo.token2 : pairInfo.token1,
    };
  } else {
    return null;
  }
}

// API
// Returns an array all the tokens that can be exchanged.
export async function getTokensList(): Promise<string[]> {
  const tokenList = await getTokensPairMap$()
    .pipe(
      take(1),
      map((tokensMap) => {
        return Array.from(tokensMap.keys());
      }),
    )
    .toPromise();
  if (tokenList) {
    return tokenList;
  } else {
    return [];
  }
}

// API
// Returns a map of all the tokens that can be exchanged as well as the pairs they appear in.
export async function getTokensPairMap(): Promise<Map<string, { pairCode: string; pairId: string }[]>> {
  const tokenList = await getTokensPairMap$().pipe(take(1)).toPromise();
  if (tokenList) {
    return tokenList;
  } else {
    return new Map<string, { pairCode: string; pairId: string }[]>();
  }
}

// API
// Returns an Observable of a map of all the tokens that can be exchanged as well as the pairs they appear in.
export function getTokensPairMap$(): Observable<Map<string, { pairCode: string; pairId: string }[]>> {
  // return collectionData(tokensCollectionRef, "tokenId");
  return getPairsMap$().pipe(
    map((pairsMap) => {
      const tokensMap = new Map<string, { pairCode: string; pairId: string }[]>();
      pairsMap.forEach((pair: Pair, pairId: string) => {
        if (tokensMap.has(pair.token1)) {
          const oldPairArray = tokensMap.get(pair.token1) as { pairCode: string; pairId: string }[];
          tokensMap.set(pair.token1, [...oldPairArray, { pairCode: pair.code, pairId: pairId }]);
        } else {
          tokensMap.set(pair.token1, [{ pairCode: pair.code, pairId: pairId }]);
        }
        if (tokensMap.has(pair.token2)) {
          const oldPairArray = tokensMap.get(pair.token2) as { pairCode: string; pairId: string }[];
          tokensMap.set(pair.token2, [...oldPairArray, { pairCode: pair.code, pairId: pairId }]);
        } else {
          tokensMap.set(pair.token2, [{ pairCode: pair.code, pairId: pairId }]);
        }
      });
      return tokensMap;
    }),
  );
}

// API
// Returns info for the specified pair
export async function getPairInfo(pairCode: string): Promise<Pair> {
  const pairInfo = await getPairInfo$(pairCode).pipe(take(1)).toPromise();
  if (pairInfo) {
    return pairInfo;
  } else {
    throw new Error('Could not get pair info for pair: ' + pairCode);
  }
}

// API
// Returns observable of info for the specified pair
export function getPairInfo$(pairCode: string): Observable<Pair> {
  return docData(fb.doc('pairs/' + pairCode)).pipe(map((doc) => Pair.create(doc)));
}

// API
// Returns an array of all the pairs available on the exchange
export async function getPairsList(): Promise<Pair[]> {
  const pairsList = await getPairsMap$()
    .pipe(
      take(1),
      map((pairsMap) => Array.from(pairsMap.values())),
    )
    .toPromise();
  if (pairsList) {
    return pairsList;
  } else {
    return [];
  }
}

// API
// Returns a map of all the pairs available on the exchange
export async function getPairsMap(): Promise<Map<string, Pair>> {
  const pairsMap = await getPairsMap$().pipe(take(1)).toPromise();
  if (pairsMap) {
    return pairsMap;
  } else {
    return new Map<string, Pair>();
  }
}

// API
// Returns an Observable of a map of all the pairs available on the exchange
export function getPairsMap$(): Observable<Map<string, Pair>> {
  return collectionData(pairsCollectionRef).pipe(
    map((docs: any[]) => {
      const pairsMap = new Map<string, Pair>();
      docs.forEach((doc: any) => {
        const newPair = Pair.create({ ...doc });
        if (newPair) {
          pairsMap.set(newPair.code, newPair);
        }
      });
      return pairsMap;
    }),
  );
}

// API
// Returns a list of aggregted Buys and Sells in the orderbook.
// Sell and Buy orders are sorted Ascending by price. Will only show "limit" results.
export function getPairOrderBook$(
  pairId: string,
  limit: number = 40,
): Observable<{ sells: AggregateOrderEntry[]; buys: AggregateOrderEntry[] }> {
  const buyOrderBook$ = getPairBuyOrders$(pairId).pipe(
    // aggregate orders per price
    map((fullOrdersMap: Map<number, Order[]>) => {
      return aggregateOrders(fullOrdersMap).slice(0, limit);
    }),
    startWith([]),
  );
  const sellOrderBook$ = getPairSellOrders$(pairId).pipe(
    // aggregate orders per price
    map((fullOrdersMap: Map<number, Order[]>) => {
      return aggregateOrders(fullOrdersMap).slice(0, limit).reverse();
    }),
    startWith([]),
  );

  return combineLatest([sellOrderBook$, buyOrderBook$]).pipe(
    map(([sellOB, buyOB]) => {
      return { sells: sellOB, buys: buyOB };
    }),
  );
}

// API
// Returns a price indexed map of all Buy orders for the specified pair.
// Prices are sorted descending and orders are sorted by ascending dateCreated for each price.
export function getPairBuyOrders$(pairId: string): Observable<Map<number, Order[]>> {
  return getPairOrdersMap('buy', pairId, Utils.SortOrder.DESCENDING);
}

// API
// Returns a price indexed map of all Sell orders for the specified pair.
// Prices are sorted ascending and orders are sorted by ascending dateCreated for each price.
export function getPairSellOrders$(pairId: string): Observable<Map<number, Order[]>> {
  return getPairOrdersMap('sell', pairId, Utils.SortOrder.ASCENDING);
}

// API
// Returns an array of trades for the specified pair.
// Trades are sorted ASCENDING based on the trade date. Results are limited to the last "limit" trades - default and max is 1000.
// TODO Add in startAt parameter to allow extracting subsets of results.
export function getPairTrades$(pairId: string, limit: number = 1000): Observable<Trade[]> {
  return getPairTradesByTime$(pairId, 0, 0, limit);
}

// API
// Returns an array of trades for the specified pair between the specified date/time.
// Date/time is specified in milliseconds since UTC.
// Trades are sorted ASCENDING based on the trade date. Results are limited to the last "limit" trades - default is 1000.
// TODO Add in startAt parameter to allow extracting subsets of results.
export function getPairTradesByTime$(
  pairId: string,
  startTime: number = 0,
  endTime: number = 0,
  limit: number = 1000,
): Observable<Trade[]> {
  const maxLimit = 1000;
  limit = Utils.roundTo(0, limit); // ensure limit is interger
  limit = Math.min(limit, maxLimit); // ensure limit is not larger than maxLimit
  startTime = Utils.roundTo(0, startTime); // ensure startTime is interger
  endTime = Utils.roundTo(0, endTime); // ensure endTime is integer
  const tradesCollectionRef = fb.collection('pairs/' + pairId + '/trades');
  const query = tradesCollectionRef
    // .where("pair", "==", pairId)
    .where('date', '>=', startTime)
    .where('date', endTime === 0 ? '>=' : '<=', endTime)
    .orderBy('date')
    .limitToLast(limit);
  return collectionData(query).pipe(
    map((docs: any[]) => {
      return docs.map((doc: any) => {
        return Trade.create({ ...doc });
      });
    }),
  );
}

// API
// Returns an array of slices for the specified pair.
export function getPairSlices$(pairId: string, limit: number = 1000): Observable<TimeSlice[]> {
  return getPairSlicesByTime$(pairId, 0, 0, limit);
}

// API
// Returns an array of slices for the specified pair between the specified date/time.
// Date/time is specified in milliseconds since UTC.
// Slices are sorted ASCENDING based on the slice startTime. Results are limited to the last "limit" slices - default is 1000.
// TODO Add in startAt parameter to allow extracting subsets of results.
export function getPairSlicesByTime$(
  pairId: string,
  startTime: number = 0,
  endTime: number = 0,
  limit: number = 1000,
): Observable<TimeSlice[]> {
  const maxLimit = 1000;
  limit = Utils.roundTo(0, limit); // ensure limit is interger
  limit = Math.min(limit, maxLimit); // ensure limit is not larger than maxLimit
  startTime = Utils.roundTo(0, startTime); // ensure startTime is interger
  endTime = Utils.roundTo(0, endTime); // ensure endTime is integer
  const query = fb
    .collection('pairs/' + pairId + '/slices')
    .where('startTime', '>=', Utils.getTimeSliceStart(startTime))
    .where('startTime', endTime === 0 ? '>=' : '<=', Utils.getTimeSliceStart(endTime))
    .orderBy('startTime')
    .limitToLast(limit);
  return collectionData(query).pipe(
    map((docs: any[]) => {
      return docs.map((doc: any) => {
        return new TimeSlice(
          doc.startTime,
          doc.open,
          doc.close,
          doc.high,
          doc.low,
          doc.token1Volume,
          doc.token2Volume,
          doc.noOfTrades,
        );
      });
    }),
  );
}

// API
// Returns an array of trades for the specified wallet and the specified time period
// Trades are sorted ASCENDING based on the trade date. Results are limited to the last "limit" trades - defualt is 1000.
export function getWalletTrades$(
  walletId: string,
  pairIds: string[],
  startTime: number = 0,
  endTime: number = 0,
  limit: number = 1000,
): Observable<Trade[]> {
  // console.log("getWalletTrades starting...", walletId, pairIds);
  const maxLimit = 1000;
  limit = Utils.roundTo(0, limit); // ensure limit is interger
  limit = Math.min(limit, maxLimit); // ensure limit is not larger than maxLimit
  startTime = Utils.roundTo(0, startTime); // ensure startTime is interger
  endTime = Utils.roundTo(0, endTime); // ensure endTime is integer
  const tradeObs: Observable<Trade[]>[] = [];
  pairIds.forEach((pairId) => {
    // console.log("getWalletTrades: Creating obs for pair: "+pairId, pairIds)
    const tradesCollectionRef = fb.collection('/pairs/' + pairId + '/trades');
    const query = tradesCollectionRef
      .where('parties', 'array-contains', walletId)
      .where('date', '>=', startTime)
      .where('date', endTime === 0 ? '>=' : '<=', endTime)
      .orderBy('date')
      .limitToLast(limit);
    const pairTradeObs = collectionData(query).pipe(
      map((docs: any[]) => {
        // console.log("getWalletTrades: Found new trades for wallet "+ walletId, docs);
        return docs.map((doc: any) => {
          const newTrade = Trade.create({ ...doc });
          // console.log("getWalletTrades: Found new trade for wallet "+ walletId, newTrade);
          return newTrade;
        });
      }),
    );
    // console.log("getWalletTrades: Created pairTradesObs for pair "+ pairId, pairTradeObs);
    tradeObs.push(pairTradeObs);
  });
  // console.log("getWalletTrades: Number of trade observables monitoring: ", tradeObs.length);
  const result = merge(...tradeObs).pipe(
    map((trades) => {
      // console.log("getWalletTrades updating trades: ", trades);
      return trades;
    }),
  );
  return result;
}

// API
// Returns a map with the fees earned in various tokens for the specified wallet and the specified time period.
export function getWalletFees$(
  walletId: string,
  pairIds: string[],
  startTime: number = 0,
  endTime: number = 0,
): Observable<{ paid: Map<string, number>, earned: Map<string, number> }> {
  // console.log("Getting wallet fees for wallet: "+ walletId);
  startTime = Utils.roundTo(0, startTime); // ensure startTime is interger
  endTime = Utils.roundTo(0, endTime); // ensure endTime is integer
  const walletTrades = getWalletTrades$(walletId, pairIds, startTime, endTime);
  // const query = tradesCollectionRef
  //     .where("parties", "array-contains", walletId)
  //     .where("date", ">=", startTime)
  //     .where("date", endTime == 0? ">=" : "<=", endTime)
  // .orderBy("date")
  // .limitToLast(limit);
  return walletTrades.pipe(
    map((trades: Trade[]) => {
      // console.log("Starting to calc fees for trades: ", trades)
      const feesPaidMap = new Map<string, number>();
      const feesEarnedMap = new Map<string, number>();
      trades.forEach((trade: Trade) => {
        // const trade = Trade.create({...doc});
        const feePayer = trade.feePayer === 'BUYER' ? trade.buyer : trade.seller;
        if (feePayer === walletId) {
          // console.log("WalletId: "+ walletId +" matched the fee payer", trade);
          if (feesPaidMap.has(trade.feeToken)) {
            const oldFeesPaid = feesPaidMap.get(trade.feeToken) as number;
            feesPaidMap.set(trade.feeToken, oldFeesPaid + trade.platformFee + trade.liquidityFee);
          } else {
            feesPaidMap.set(trade.feeToken, trade.platformFee + trade.liquidityFee);
          }
        } else {
          if (feesEarnedMap.has(trade.feeToken)) {
            const oldFeesEarned = feesEarnedMap.get(trade.feeToken) as number;
            feesEarnedMap.set(trade.feeToken, oldFeesEarned + trade.liquidityFee);
          } else {
            feesEarnedMap.set(trade.feeToken, trade.liquidityFee);
          }
        }
      });
      // console.log("wallet fees done. ", {paid: feesPaidMap, earned: feesEarnedMap});
      return { paid: feesPaidMap, earned: feesEarnedMap };
    }),
  );
}

// API
// returns specified order based on order id
export async function getOrder(orderId: string): Promise<Order | null> {
  const orderPair = orderId.slice(0, orderId.search('_'));
  const orderTypes = ['buy', 'sell', 'completed', 'queued'];
  let foundOrder = null;
  let orderType = orderTypes.shift();
  while (orderType && !foundOrder) {
    const ordersArray = await getPairOrdersArray(orderType, orderPair).pipe(take(1)).toPromise();
    if (ordersArray) {
      foundOrder = ordersArray.find((order) => order.id === orderId);
    }
    if (!foundOrder) {
      orderType = orderTypes.shift();
    }
  }
  if (foundOrder) {
    return foundOrder;
  } else {
    return null;
  }
}

// UTILITY FUNCTIONS used in API bridge functions

// Utility function - creates an aggregated orderbook array from an ordersMap;
function aggregateOrders(ordersMap: Map<number, Order[]>): AggregateOrderEntry[] {
  const aggOrdersArray: AggregateOrderEntry[] = [];
  ordersMap.forEach((priceOrders: Order[], price: number) => {
    if (priceOrders.length > 0) {
      let totalQuantity = 0;
      priceOrders.forEach((order: Order) => {
        totalQuantity += order.quantity - order.quantityFulfilled;
      });
      const entry = {
        pair: priceOrders[0].pair,
        side: priceOrders[0].side,
        price: price,
        quantity: totalQuantity,
        orderCount: priceOrders.length,
      };
      aggOrdersArray.push(entry);
    }
  });
  return aggOrdersArray;
}

// Utility function - creates an ordersMap for the specified orderType for a pair
function getPairOrdersMap(
  orderType: string,
  pairId: string,
  sortOrder: Utils.SortOrder,
): Observable<Map<number, Order[]>> {
  const pairOrdersRef = fb.collection('pairs/' + pairId + '/' + orderType + '-orders');
  return collectionData(pairOrdersRef).pipe(
    map((orderDocs) => {
      const ordersMap = new Map<number, Order[]>();
      orderDocs.forEach((orderDoc) => {
        const newOrder = Order.create(orderDoc);
        if (!ordersMap.has(newOrder.price)) {
          ordersMap.set(newOrder.price, [newOrder]);
        } else {
          ordersMap.get(newOrder.price)?.push(newOrder);
        }
      });
      return Utils.sortOrdersMap(ordersMap, sortOrder);
    }),
  );
}
// utility function - creates an array of the specified order type for the specified pair
// the array can optionally be sorted by the specified field
function getPairOrdersArray(
  orderType: string,
  pairId: string,
  sortOrder: Utils.SortOrder = Utils.SortOrder.NONE,
  sortField: string = 'dateCreated',
): Observable<Order[]> {
  const pairOrdersRef = fb.collection('pairs/' + pairId + '/' + orderType + '-orders');
  return collectionData(pairOrdersRef).pipe(
    map((orderDocs) => {
      return Utils.sortOrdersArray(
        orderDocs.map((orderDoc) => {
          return Order.create(orderDoc);
        }),
        sortOrder,
        sortField,
      );
    }),
  );
}

// Utility function - calcs the quantity and value of tokens required for a MARKET order
function calcMarketOrderRequirements(
  order: Order,
  existingOrders: Map<number, Order[]>,
  priceLimit: number,
  token1Decimals: number,
  token2Decimals: number,
): { quantity: number; value: number } | null {
  // console.log("Calculating order requirements for order: ", order);
  // console.log("Pricelimit: ", priceLimit);
  const orders = existingOrders;
  let totalValue = 0;
  let totalQuantity = 0;
  let remainingValue = order.value;
  let remainingQuantity = order.quantity;
  let currentPriceIndex = 0;
  let currentPrice = 0;
  const orderPrices = Array.from(orders.keys());
  if (orderPrices.length > 0) {
    currentPrice = orderPrices[currentPriceIndex];
  }
  while (
    ((order.quantitySpecified && remainingQuantity > 0) || (!order.quantitySpecified && remainingValue > 0)) &&
    currentPrice &&
    ((order.side === OrderSide.BUY && currentPrice <= priceLimit) ||
      (order.side === OrderSide.SELL && currentPrice >= priceLimit))
  ) {
    const quantityAtPrice = Utils.roundTo(token1Decimals, Utils.calcPriceQuantity(orders.get(currentPrice)));
    const valueAtPrice = Utils.roundTo(token2Decimals, quantityAtPrice * currentPrice);
    if (order.quantitySpecified) {
      if (quantityAtPrice >= remainingQuantity) {
        totalValue = totalValue + Utils.roundTo(token2Decimals, remainingQuantity * currentPrice);
        totalQuantity = totalQuantity + remainingQuantity;
        remainingQuantity = 0;
      } else {
        totalValue = totalValue + valueAtPrice;
        totalQuantity = totalQuantity + quantityAtPrice;
        remainingQuantity = Utils.roundTo(token1Decimals, remainingQuantity - quantityAtPrice);
      }
    } else {
      if (valueAtPrice > remainingValue) {
        totalValue = totalValue + remainingValue;
        totalQuantity = totalQuantity + Utils.roundTo(token1Decimals, remainingValue / currentPrice);
        remainingValue = 0;
      } else {
        totalValue = totalValue + valueAtPrice;
        totalQuantity = totalQuantity + quantityAtPrice;
        remainingValue = Utils.roundTo(token2Decimals, remainingValue - valueAtPrice);
      }
    }
    currentPriceIndex++;
    if (currentPriceIndex < orderPrices.length) {
      currentPrice = orderPrices[currentPriceIndex];
    } else {
      currentPrice = 0;
    }
  }
  if ((order.quantitySpecified && remainingQuantity > 0) || (!order.quantitySpecified && remainingValue > 0)) {
    // return {quantity: 0, value: 0};
    return null;
  } else {
    return { quantity: totalQuantity, value: totalValue };
  }
}

// these functions are only for testing and will not be included in the production version

export function getWallets(wallets: string[]): Map<string, Observable<Map<string, number>>> {
  const walletMap = new Map<string, Observable<Map<string, number>>>();
  const walletsRef = fb.collection('wallets');
  wallets.forEach((wallet) => {
    walletMap.set(wallet, getWalletTokens(wallet).pipe(startWith(new Map())));
  });
  return walletMap;
}

export function getWalletTokens(wallet: string): Observable<Map<string, number>> {
  if (!wallet) {
    return of(new Map());
  }
  const walletTokensRef = fb.collection('wallets/' + wallet + '/tokens');
  return collectionData(walletTokensRef, 'tokenId').pipe(
    map((docs: any[]) => {
      const tokensMap = new Map<string, number>();
      docs.forEach((doc: any) => {
        tokensMap.set(doc.tokenId, doc.owned);
      });
      return tokensMap;
    }),
  );
}
