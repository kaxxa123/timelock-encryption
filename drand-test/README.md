# drand

This test code demonstrated how to use the `tlock-js` and `drand-client` APIs.
Tests includes:

1. Generic access to the drand round randomness.
1. Timelocked encryption/decryption.

## Setup
```BASH
npm init -y
npm i tlock-js
npm i drand-client

npm i --save-dev typescript
npm i --save-dev ts-node
npm i --save-dev @types/node

tsc --init
```

## Notes

1. The drand network is running three randomness beacons.

    * __default__ -  A chained beacon with a 30 second frequency.
        This is not useful for timelock encryption as the beacon
        values are chained with the latest value including the
        previous value in its computation: <BR />
        `b(i+1) = Sign(m || b(i))`

    * __quicknet__ - An unchained beacon with 3 seconds frequency.
        This allows implementing timelock encryption as the beacon
        values are unchained and only dependent on the round number.

    * __fastnet__ - Deprecated don't use.


2. Checkout the [HTTP endpoints](https://drand.love/developer/http-api/#public-endpoints) for drand.
