import { FS, FN } from './firebase';
import { collectionData, docData } from 'rxfire/firestore';
import { Observable } from 'rxjs';
import { map, take } from 'rxjs/operators';
import { Pair } from './models/pair.class';
import { Order, OrderSide, OrderStatus, OrderType } from './models/order.class';

const fb = FS();
const fn = FN();

const pairsCollectionRef = fb.collection('pairs');

export { Pair, Order, OrderSide, OrderStatus, OrderType };

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
