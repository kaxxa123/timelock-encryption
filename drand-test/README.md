# drand

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

1. The drand network is running two randomness beacons.

    * __default__ -  A chained beacon with a 30 second frequency.
        This is not useful for timelock encryption as the beacon
        values are chained with the latest value including the
        previous value in its computation: <BR />
        `b(i+1) = Sign(m || b(i))`

    * __quicknet__ - An unchained beacon with 3 seconds frequence.
        This allows implementing timelock encryption as the beacon
        values are unchained only dependent on the round number.


2. Checkout the [HTTP endpoints](https://drand.love/developer/http-api/#public-endpoints) for drand.
