'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  initialLandState,
  registerSteward,
  attestSteward,
  transferSlot,
  releaseSlot,
  type LandState,
  type RegisterInput,
  type Steward,
} from '@/lib/mock/land';

/**
 * In-memory shared roster for the demo. Registrations and attestations made
 * on one page are visible on the others because all three routes read from
 * this one Context. State resets on reload — fine for a demo; swap for
 * localStorage or real reads later without touching the consumers.
 */
interface LandContextValue {
  state: LandState;
  register: (input: RegisterInput) => Steward;
  attest: (stewardId: string) => void;
  transfer: (slotIndex: number, newStewardId: string) => void;
  release: (slotIndex: number) => void;
  reset: () => void;
}

const LandContext = createContext<LandContextValue | null>(null);

export function LandStateProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<LandState>(initialLandState);

  // Mirror of the latest state so register() can return the created steward
  // while still basing the write on the freshest roster.
  const stateRef = useRef(state);
  stateRef.current = state;

  const register = useCallback((input: RegisterInput) => {
    const { state: next, steward } = registerSteward(stateRef.current, input);
    setState(next);
    return steward;
  }, []);

  const attest = useCallback((stewardId: string) => {
    setState((prev) => attestSteward(prev, stewardId));
  }, []);

  const transfer = useCallback((slotIndex: number, newStewardId: string) => {
    setState((prev) => transferSlot(prev, slotIndex, newStewardId));
  }, []);

  const release = useCallback((slotIndex: number) => {
    setState((prev) => releaseSlot(prev, slotIndex));
  }, []);

  const reset = useCallback(() => setState(initialLandState()), []);

  const value = useMemo(
    () => ({ state, register, attest, transfer, release, reset }),
    [state, register, attest, transfer, release, reset]
  );

  return <LandContext.Provider value={value}>{children}</LandContext.Provider>;
}

export function useLand(): LandContextValue {
  const ctx = useContext(LandContext);
  if (!ctx) {
    throw new Error('useLand must be used within a LandStateProvider');
  }
  return ctx;
}
