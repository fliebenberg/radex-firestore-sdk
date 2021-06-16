import firebase from 'firebase/app';
import 'firebase/firestore';
import 'firebase/functions';

const firebaseConfig = {
  apiKey: 'AIzaSyCb3t5dGJugoozwTY40n_FCkTxOHAjiW7Y',
  authDomain: 'tokenx-1551e.firebaseapp.com',
  projectId: 'tokenx-1551e',
  storageBucket: 'tokenx-1551e.appspot.com',
  messagingSenderId: '94484458060',
  appId: '1:94484458060:web:33f3170969ee52700822e9',
  measurementId: 'G-KWNK3P8GZ1',
};

firebase.initializeApp(firebaseConfig);

// export const fb = firebase.firestore();
// export const fn = firebase.functions();

const prod = false;

let firestore: firebase.firestore.Firestore | null = null;
let functions: firebase.functions.Functions | null = null;

export const FS = (): firebase.firestore.Firestore => {
  if (firestore === null) {
    firestore = firebase.firestore();
    // isProd environment variable set in rollup.config.js
    if (!prod) {
      // firebase.firestore.setLogLevel('debug');
      firestore.settings({
        host: 'localhost:8080',
        ssl: false,
      });
    }
  }
  return firestore;
};

export const FN = (): firebase.functions.Functions => {
  if (functions === null) {
    functions = firebase.functions();

    if (!prod) {
      // tell Firebase where to find the Firebase functions emulator
      functions.useEmulator('localhost', 5001);
    }
  }
  return functions;
};
