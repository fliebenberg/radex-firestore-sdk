# radex-sdk-firestore

radex-sdk-firestore is a sdk for the radex exchange using firestore as the back end for testing purposes.

### ACTION functions
---
#### function submitOrder (order: Order)
Submits an order for processing by the RaDEX exchange
Order will either be matched immediately with an existing order, added to the list of pending orders or rejected with an error message

        Returns : Promise<string>
Will return "SUCCESS" if order was submitted successfully, otherwise will return error description in a string.

#### function cancelOrder (order: Order)
Cancels an order that has been submitted previously for processing by the RaDeX exchange
Only orders with Status "PENDING" can be cancelled. Any part of the order that has already been fulfilled cannot be cancelled.

        Returns: Promise<string>
Will return "SUCCESS" if order was cancelled successfully, otherwise will return error description in a string.

### READ-ONLY API functions
---
### function getMarketOrderQuote (order: Order)
    RETURNS: Promise<
        {pay: number;
        receive: number;
        fee: number;
        payToken: string;
        receiveToken: string;
        feeToken: string;
        } | null
    > 
Returns quote information for a specified market order - how many tokens it will cost (pay), how many tokens will be received (receive), fee payable (fee) and which tokens will be used.
Will return NULL if the order is not a MARKET order or if the market order will fail.

### function getTokensList()
    RETURNS: Promise<string[]> 
Returns an array all the tokens that can be exchanged.

### function getTokensPairMap ()
    RETURNS: Promise<
        Map<string, {pairCode: string; pairId: string}[]>
    > 
Returns a map of all the tokens that can be exchanged as well as an array of the pairs that contain each token.

### function getTokensPairMap$ ()
    RETURNS: Observable<
        Map<string, {pairCode: string; pairId: string }[]>
    > 
Returns an Observable of a map of all the tokens that can be exchanged as well as an array of the pairs that contain each token.

### function getPairInfo (pairCode: string)
    RETURNS: Promise<Pair> 
Returns info for the specified pair.

### function getPairInfo$ (pairCode: string)
    RETURNS: Observable<Pair> 
Returns observable of info for the specified pair.

### function getPairsList ()
    RETURNS: Promise<Pair[]> 
Returns an array of all the pairs available on the exchange.

### function getPairsMap ()
    RETURNS: Promise<Map<string, Pair>> 
Returns a map of all the pairs available on the exchange

### function getPairsMap$ ()
    RETURNS: Observable<Map<string, Pair>> 
Returns an Observable of a map of all the pairs available on the exchange

### function getPairOrderBook$ (pairId: string,  limit: number = 40)
    RETURNS: 
    Observable<{
        sells: AggregateOrderEntry[]; 
        buys: AggregateOrderEntry[] 
    }> 
Returns a list of aggregted Buys and Sells in the orderbook.
Sell and Buy orders are sorted Ascending by price. "limit" specifies the maximum number of results to show. Default = 40.

### function getPairBuyOrders$ (pairId: string)
    RETURNS: Observable<Map<number, Order[]>> 
Returns a price indexed map of all Buy orders for the specified pair.
Prices are sorted descending and orders are sorted by ascending dateCreated for each price.

### function getPairSellOrders$ (pairId: string)
    RETURNS: Observable<Map<number, Order[]>> 
Returns a price indexed map of all Sell orders for the specified pair.
Prices are sorted ascending and orders are sorted by ascending dateCreated for each price.

### function getPairTrades$ (pairId: string, limit: number = 1000)
    RETURNS: Observable<Trade[]> 
Returns an array of trades for the specified pair.
Trades are sorted ASCENDING based on the trade date. Results are limited to the last "limit" trades - default and max is 1000.

### function getPairTradesByTime$ 
    PARAMETERS:
    (
    pairId: string,
    startTime: number = 0,
    endTime: number = 0,
    limit: number = 1000,
    )
"startTime" and "endTime" is specified in milliseconds since UTC. 

    RETURNS: Observable<Trade[]> 
Returns an observable of an array of trades for the specified pair between the specified date/time.
Trades are sorted ASCENDING based on the trade date. Results are limited to the last "limit" trades - default is 1000.

### function getPairSlices$ (pairId: string, limit: number = 1000)
    RETURNS: Observable<TimeSlice[]> 
Returns an observable of an array of slices for the specified pair.

### function getPairSlicesByTime$
    PARAMETERS:
    (
    pairId: string,
    startTime: number = 0,
    endTime: number = 0,
    limit: number = 1000,
    )
"startTime" and "endTime" is specified in milliseconds since UTC.

    RETURNS: Observable<TimeSlice[]> 
Returns an observable of an array of slices for the specified pair between the specified date/time.
Slices are sorted ASCENDING based on the slice startTime. Results are limited to the last "limit" slices - default is 1000.

### function getWalletTrades$
    PARAMETERS:
    (
    walletId: string,
    pairIds: string[],
    startTime: number = 0,
    endTime: number = 0,
    limit: number = 1000,
    )
"startTime" and "endTime" is specified in milliseconds since UTC.

    RETURNS: Observable<Trade[]> 
Returns an observable of an array of trades for the specified wallet and the specified time period
Trades are sorted ASCENDING based on the trade date. Results are limited to the last "limit" trades - defualt is 1000.

### function getWalletFees$
    PARAMETERS:
    (
    walletId: string,
    pairIds: string[],
    startTime: number = 0,
    endTime: number = 0,
    )
"startTime" and "endTime" is specified in milliseconds since UTC.

    RETURNS: Observable<
    {   paid: Map<string, number>,
        earned: Map<string, number> 
    }
    > 
Returns a map with the fees paid and earned in various tokens for the specified wallet and the specified time period.

### function getOrder (orderId: string)
    RETURNS: Promise<Order | null> 
Returns specified order based on order id

## DEV ONLY functions
These functions are only for testing and will not be included in the production version

### function getWallets (wallets: string[])
    RETURNS: Map<string, Observable<Map<string, number>>> 
Returns a map of all wallets with an observable of a map of the tokens held in each wallet.
### function getWalletTokens (wallet: string)
    RETURNS: Observable<Map<string, number>>
Returns an observable of a map of the tokens held in the specified wallet.


## CLASSES, INTERFACES, ENUMS and CONSTANTS
### CLASS: Token
    code: string
    decimals: number

### CLASSS: Pair
    code: string
    token1: string  //required
    token2: string  //required
    token1Decimals: number
    token2Decimals: number
    liquidityFee: number
    platformFee: number
    latestTimeSlice: TimeSlice
#### Creation function: create( pairObj )
pairObj is an object with at least the required fields and any other optional fields specified.

Example Usage:

    Pair.create({token1: "BTC", token2: "XRD, code: "BTC-XRD"})

### CLASS: Order
    id: string = ''
    owner: string = ''                  //required
    pair: string = ''                   //required
    token1: string = ''                 //required
    token2: string = ''                 //required
    dateCreated: number = 0
    dateCompleted: number = 0
    side: OrderSide = OrderSide.EMPTY   //required
    type: OrderType = OrderType.EMPTY   //required
    price: number = 0       //required for limit order
    quantity: number = 0    //required for limit order if quantitySpecified = true
    value: number = 0       //required for limit order if quantitySpecified = false
    quantityFulfilled: number = 0
    valueFulfilled: number = 0
    quantitySpecified: boolean = true
    status: OrderStatus = OrderStatus.EMPTY
#### Creation function: create( orderObj )
orderObj is an object with at least the required fields and any other optional fields specified.

Example Usage:

    Order.create({owner: "Fred", pair: "BTC-XRD", token1: "BTC", token2: "XRD, side: OrderSide.BUY, type: OrderType.LIMIT, price: 23.4, quantity: 400.3})

#### ENUM: OrderSide
    EMPTY = '',
    BUY = 'BUY',
    SELL = 'SELL',

#### ENUM: OrderType 
    EMPTY = '',
    MARKET = 'MARKET',
    LIMIT = 'LIMIT',
    LIMITONLY = 'LIMIT-ONLY',

#### ENUM: OrderStatus
    EMPTY = '',
    SUBMITTING = 'SUBMITTING', // order has been added to queue, but not yet processed
    PENDING = 'PENDING', // order has been added to order book, awaiting fulfilment
    COMPLETED = 'COMPLETED', // order has been fulfilled
    CANCELLED = 'CANCELLED', // order has been cancelled by owner
#### INTERFACE: AggregateOrderEntry
    pair: string;
    side: OrderSide;
    price: number;
    quantity: number;
    orderCount: number;

### CLASS: Trade
    id: string = ''
    pair: string = ''
    buyer: string = ''  
    buyOrderId: string = ''
    seller: string = ''
    sellOrderId: string = ''
    token1: string = ''
    token2: string = ''
    quantity: number = 0
    price: number = 0
    feePayer: TradeFeePayer = TradeFeePayer.EMPTY
    feeToken: string = ''
    liquidityFee: number = 0
    platformFee: number = 0
    date: number = 0
    parties: string[] = []

#### ENUM: TradeFeePayer 
    EMPTY = '',
    BUYER = 'BUYER',
    SELLER = 'SELLER',

### CLASS: TimeSlice
    startTime: number = 0,
    open: number = 0,
    close: number = 0,
    high: number = 0,
    low: number = 0,
    token1Volume: number = 0,
    token2Volume: number = 0,
    noOfTrades: number = 0,


### CONSTANT: SUCCESS = "SUCCESS"