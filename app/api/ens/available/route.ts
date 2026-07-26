import { NextResponse } from 'next/server';
import { readNameAvailability } from '@/lib/ens-v2';

/**
 * Is a project name free on ENSv2 Sepolia, and what does a year cost?
 *
 * Read-only against the v2 ETHRegistrar, so the admin page can check a name
 * before anyone connects a wallet or spends gas.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const name = searchParams.get('name')?.trim();

  if (!name) {
    return NextResponse.json(
      { error: 'name query param is required' },
      { status: 400 }
    );
  }

  try {
    const result = await readNameAvailability(name);
    return NextResponse.json({
      ...result,
      // BigInt is not JSON-serialisable; the UI only needs the formatted total.
      priceBase: result.priceBase.toString(),
      pricePremium: result.pricePremium.toString(),
      priceTotal: result.priceTotal.toString(),
      currency: 'USDC (Sepolia test token)',
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
