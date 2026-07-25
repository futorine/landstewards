import { NextResponse } from 'next/server';
import { readEnsText } from '@/lib/ens';

/**
 * Live ENS text-record read, server-side so the RPC URL never reaches the
 * browser. Used to read the `evidence` record straight back off the resolver
 * after the client-side write, proving the round trip on-chain.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name');
  const key = searchParams.get('key');

  if (!name || !key) {
    return NextResponse.json(
      { error: 'name and key query params are required' },
      { status: 400 }
    );
  }

  try {
    const value = await readEnsText(name, key);
    return NextResponse.json({ name, key, value });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
