/**
 * LIVE COMPONENT — this is the only part of the project that touches a network.
 *
 * Uploads the evidence bundle to Walrus (Sui's decentralized blob storage)
 * via the public testnet publisher. Runs server-side so the browser never
 * calls Walrus directly, which sidesteps CORS entirely.
 *
 * Testnet publisher/aggregator are public and need no Sui wallet or keypair.
 * Walrus has no public mainnet publisher by design — a publisher spends real
 * SUI and WAL on the service side — so this is testnet-only as written.
 * That matches the team's Sepolia-only scope.
 */

import { NextResponse } from 'next/server';

const PUBLISHER =
  process.env.WALRUS_PUBLISHER ?? 'https://publisher.walrus-testnet.walrus.space';
const AGGREGATOR =
  process.env.WALRUS_AGGREGATOR ?? 'https://aggregator.walrus-testnet.walrus.space';
const EPOCHS = process.env.WALRUS_EPOCHS ?? '5';

/** Public testnet publisher caps request bodies at 10 MiB. */
const MAX_BYTES = 10 * 1024 * 1024;

interface WalrusStoreResponse {
  newlyCreated?: { blobObject: { blobId: string; size: number } };
  alreadyCertified?: { blobId: string };
}

export async function POST(request: Request) {
  const body = await request.text();

  const size = new TextEncoder().encode(body).length;
  if (size > MAX_BYTES) {
    return NextResponse.json(
      {
        error: `Bundle is ${(size / 1024 / 1024).toFixed(1)} MiB, over the 10 MiB publisher limit. Trim it or run your own publisher.`,
      },
      { status: 413 }
    );
  }

  try {
    const res = await fetch(`${PUBLISHER}/v1/blobs?epochs=${EPOCHS}`, {
      method: 'PUT',
      body,
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: `Walrus publisher returned ${res.status}: ${await res.text()}` },
        { status: 502 }
      );
    }

    const data = (await res.json()) as WalrusStoreResponse;

    // Walrus dedups by content: a first upload returns newlyCreated, an
    // identical re-upload returns alreadyCertified instead.
    const blobId =
      data.newlyCreated?.blobObject.blobId ?? data.alreadyCertified?.blobId;

    if (!blobId) {
      return NextResponse.json(
        { error: `Unexpected response shape from Walrus: ${JSON.stringify(data)}` },
        { status: 502 }
      );
    }

    return NextResponse.json({
      blobId,
      readUrl: `${AGGREGATOR}/v1/blobs/${blobId}`,
      sizeBytes: size,
      deduplicated: Boolean(data.alreadyCertified),
    });
  } catch (err) {
    return NextResponse.json(
      { error: `Could not reach the Walrus publisher: ${(err as Error).message}` },
      { status: 502 }
    );
  }
}
