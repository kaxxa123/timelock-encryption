import {
    fetchBeacon,
    fetchBeaconByTime,
    HttpChainClient,
    watch,
    HttpCachingChain,
    FastestNodeClient,
    MultiBeaconNode,
    ChainOptions,
    roundTime,
    roundAt,
    ChainInfo
} from 'drand-client'

import {
    timelockEncrypt,
    timelockDecrypt
} from 'tlock-js'

// The chain hash for the League of Entropy default chain.
// Running at a 30s frequency
// Running in chained mode on Mainnet (not useful for timelocked encryption)
// https://api.drand.sh/8990e7a9aaed2ffed73dbd7092123d6f289930540d7651336225dc172e51b2ce/info  OR
// https://api.drand.sh/info
const chainedHash = '8990e7a9aaed2ffed73dbd7092123d6f289930540d7651336225dc172e51b2ce' // (hex encoded)
const chainedPK = '868f005eb8e6e4ca0a47c8a77ceaa5309a47978a7c71bc5cce96366b5d7a569937c529eeda66c7293784a9402801af31' // (hex encoded)

// The chain hash for the League of Entropy quicknet network
// Running at a 3s frequency
// Running in unchained mode on Mainnet (can be used for timelocked encryption)
// https://api.drand.sh/52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971/info
const unchainedHash = '52db9ba70e0cc0f6eaf7803dd07447a1f5477735fd3f661792ba94600c84e971' // (hex encoded)
const unchainedPK = "83cf0f2896adee7eb8b5f01fcad3912212c437e0073e911fb90022d3e760183c8c4b450b6a0a6c3ac6a5776a2d1064510d1fec758c921cc22b0e17e63aaf4bcb5ed66304de9cf809bd274ca73bab4af5a6e9c76a4bc09e76eae8991ef5ece45a"

// Function to demonstrate how to query muliple nodes
//  If you're happy to get randomness from many APIs and automatically use the fastest
//  you can construct a `FastestNodeClient` with multiple URLs
//  The randomness beacons are cryptographically verifiable, so as long as you fill
//  the `chainVerificationParams` in the ChainOptions, you don't need to worry about
//  malicious providers sending you fake randomness!
async function multiNodeTest(opts: ChainOptions) {
    console.log()
    console.log("=== multiNodeTest ===")

    const urls = [
        `https://api.drand.sh/${opts.chainVerificationParams?.chainHash}`,
        `https://drand.cloudflare.com/${opts.chainVerificationParams?.chainHash}`
        // ...
    ]
    const fastestNodeClient = new FastestNodeClient(urls, opts)

    // Start the client, or it won't periodically optimise for the fastest node!
    fastestNodeClient.start()

    const theLatestBeacon = await fetchBeacon(fastestNodeClient)
    console.log("Latest beacon:")
    console.log(theLatestBeacon)
    console.log()

    // Stop the speed testing, or you may leak a `setInterval` call!
    fastestNodeClient.stop()

    console.log("=====================")
    console.log()
}

// Function to demonstrate how to query one node exposing multiple beacons
//  Prior to drand 1.4, each node could only follow and contribute to a
//  single beacon chain. Now nodes can contribute to many at once.
async function multiBeaconTest(opts: ChainOptions) {
    console.log()
    console.log("=== multiBeaconTest ===")

    const multiBeaconNode = new MultiBeaconNode('https://api.drand.sh', opts)

    // Monitor its health
    const health = await multiBeaconNode.health()
    if (health.status === 200) {
        console.log(`Multibeacon node is healthy and has processed ${health.current} of ${health.expected} rounds`)
    }

    // Get the chains it follows
    const chains = await multiBeaconNode.chains()
    for (const c of chains) {
        const info: ChainInfo = await c.info()
        console.log(info)
    }

    // Create clients straight from the chains it returns
    // WARNING ChainOptions is incorrect since chainVerificationParams
    // should be different for each beacon.
    const latestBeaconsFromAllChains = Promise.all(
        chains.map(chain => new HttpChainClient(chain, opts))
            .map(client => fetchBeacon(client))
    )

    console.log("=======================")
    console.log()
}

async function monitorBeacon(count: number, opts: ChainOptions) {
    console.log()
    console.log("=== monitorBeacon ===")

    // Connect to a single node for a specific beacon
    const chain = new HttpCachingChain(`https://api.drand.sh/${opts.chainVerificationParams?.chainHash}`, opts)
    const client = new HttpChainClient(chain, opts)
    const chainInfo = await chain.info();

    // Grab the latest beacon value...
    const theLatestBeacon = await fetchBeacon(client)
    let timeRnd = new Date(roundTime(chainInfo, theLatestBeacon.round)).toLocaleString();

    console.log(`Latest beacon: Round: ${theLatestBeacon.round}, Time: ${timeRnd}`)
    console.log(theLatestBeacon)
    console.log()

    // Get the beacon for a given time...
    const yesterdayBeacon = await fetchBeaconByTime(client, Date.now() - 24 * 60 * 60 * 1000)
    console.log("Yesterday Beacon")
    console.log(yesterdayBeacon)
    console.log()

    // Watch the latest randomness automatically!
    // Use an abort controller to stop it
    const abortController = new AbortController()
    let startRound = theLatestBeacon.round;
    let lastRound = startRound;
    for await (const beacon of watch(client, abortController)) {
        if (beacon.round >= startRound + count) {
            abortController.abort(`Round ${count} reached - Stopped.`)
        }
        else if (beacon.round > lastRound) {
            lastRound = beacon.round;

            console.log(`New Round: ${lastRound - startRound}`)
            console.log(beacon)
            console.log()
        }
    }

    console.log("=====================")
    console.log()
}

async function encryptString(timeOffsetSeconds: number, plaintext: string): Promise<string> {
    console.log()
    console.log("=== encryptString ===")

    const timestamp = Date.now() + timeOffsetSeconds * 1000;

    const options: ChainOptions = {
        disableBeaconVerification: false,
        noCache: false,
        chainVerificationParams: {
            chainHash: unchainedHash,
            publicKey: unchainedPK
        }
    }

    // Connect to a single node for a specific beacon
    const chain = new HttpCachingChain(`https://api.drand.sh/${options.chainVerificationParams?.chainHash}`, options)
    const client = new HttpChainClient(chain, options)
    const chainInfo = await chain.info();

    const round = roundAt(timestamp, chainInfo);
    let timeRnd = new Date(timestamp).toLocaleString();
    console.log(`Round number for time ${timeRnd} : ${round}`)

    const ciphertext = await timelockEncrypt(round, Buffer.from(plaintext), client)
    console.log('Ciphertext')
    console.log(ciphertext)
    console.log()

    console.log("=====================")
    console.log()

    return ciphertext;
}

async function decryptString(ciphertext: string): Promise<string> {

    console.log()
    console.log("=== decryptString ===")

    const options: ChainOptions = {
        disableBeaconVerification: false,
        noCache: false,
        chainVerificationParams: {
            chainHash: unchainedHash,
            publicKey: unchainedPK
        }
    }

    // Connect to a single node for a specific beacon
    const chain = new HttpCachingChain(`https://api.drand.sh/${options.chainVerificationParams?.chainHash}`, options)
    const client = new HttpChainClient(chain, options)

    let plaintext = "";
    try {
        const plainBuffer = await timelockDecrypt(ciphertext, client);
        plaintext = plainBuffer.toString()
        console.log('Plaintext')
        console.log(plaintext)
        console.log()
    }
    catch (err) {
        if (err instanceof Error) {
            console.log("Failed", err.message)
        }
        else {
            console.log("Failed Decryption")
        }
    }

    console.log("=====================")
    console.log()

    return plaintext;
}

function sleep(ms: number) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

async function mainTest(encrypt?: boolean) {
    const options: ChainOptions = {
        // `true` disables checking of signatures on beacons - faster but insecure!!!
        disableBeaconVerification: false,

        // `true` disables caching when retrieving beacons for some providers
        noCache: false,

        // These are optional, but recommended! They are compared for
        // parity against the `/info` output of a given node
        chainVerificationParams: {
            chainHash: unchainedHash,
            publicKey: unchainedPK
        }
    }

    if (encrypt) {
        const ciphertext = await encryptString(60, "Hello");
        await sleep(30000);
        await decryptString(ciphertext);

        await sleep(30001);
        await decryptString(ciphertext);
    }
    else {
        await multiNodeTest(options);
        await monitorBeacon(3, options);
        await multiBeaconTest(options);
    }
}

mainTest().catch((error) => {
    console.error(error);
    process.exitCode = 1;
});
