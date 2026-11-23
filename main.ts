// SPDX-License-Identifier: MIT
// Dip-sniper for CBBTC/USDC, bars-replay/v1, long only.
//
// On this dev window (24h of 1-minute cbBTC bars, 2026-11-22T05:12Z to
// 2026-11-23T05:11Z, +3.64% overall with a 5.09% range) the money is in
// short, sharp pullbacks inside a rising market — not in chasing trends
// (every EMA-cross and Bollinger/RSI variant lost money in the grid) and
// not in holding through the chop (buy-and-hold makes +32.17 USDC but
// keeps a 1.98% drawdown and bets the whole window on one direction).
// A 30-minute pullback of 0.40% or more snaps back often enough that
// taking a quick +0.80% and getting out beats waiting for a bigger move:
// the round trip costs ~26 bps, so +0.80% clears costs three times over,
// and the -1.50% stop caps the trades where the dip keeps falling.
//
// Entry (full cash, one position at a time):
//   - close down at least 0.40% against its close 30 bars ago.
// Exit (whole position):
//   - take profit at +0.80% over the entry fill price, or
//   - stop loss at -1.50% under the entry fill price, or
//   - time stop after 720 bars held (12h: a stale position is closed
//     rather than left to drift into the final flatten).
// It never enters in the last 60 bars of the 1,440-bar window: a position
// opened there cannot reach its target before the final flatten, so it
// would only pay fees. No lookahead (only closes already sent), no clock,
// no randomness, no environment reads: the same bars give the same orders,
// run after run.
//
// Local dev grade (kit grade-local, process driver): +35.06 USDC net PnL
// on the published dev window, 11 trades, max drawdown 1.58%. The
// parameters sit on a plateau, not a knife edge: the 36-point neighbourhood
// around them (lookback 25-35, dip 0.30-0.50%, take-profit 0.60-1.00%,
// time stop 360-720 bars) grades between +13.19 and +42.96 USDC, worst
// case still positive, average +26.72 USDC.
//
// TypeScript, not Python: the kit's local grader on this machine runs Node
// only (python3.13 runs only inside Docker, which is unavailable here), so
// the entry is written in TypeScript to be verifiable with the kit's own
// grade-local command before submission.

import { BPS, runBars, type Bar, type BarsState, type BuyInput, type SellInput } from './vendor/makefun-bars.ts';

const SYMBOL = 'CBBTC';
const LOOKBACK_BARS = 30;
const DIP_BPS = 40; // 0.40% down over the lookback
const TAKE_PROFIT_BPS = 80; // +0.80% over the entry fill price
const STOP_LOSS_BPS = 150; // -1.50% under the entry fill price
const MAX_HOLD_BARS = 720;
const NO_ENTRY_TAIL_BARS = 60; // last bars of the 1,440-bar window
const WINDOW_BARS = 1440;
const MAX_SLIPPAGE_BPS = 500;

/** Last LOOKBACK_BARS + 1 closes, oldest first (raw price units, scale 5). */
const history: number[] = [];
/** Fill price of the current entry (raw price units), 0 when flat. */
let entryPrice = 0;
/** Seq of the batch that decided the current entry (for the time stop). */
let entrySeq = -1;

function note(bar: Bar): void {
  history.push(Number(bar.c));
  if (history.length > LOOKBACK_BARS + 1) history.shift();
}

await runBars({
  onBatch(state, batch) {
    for (const bar of batch.bars) if (bar.symbol === SYMBOL) note(bar);
    // Record the fill price of any buy that just landed.
    for (const fill of batch.fills) {
      if (fill.symbol === SYMBOL && fill.side === 'buy' && fill.status === 'filled') {
        entryPrice = Number(fill.price);
      }
      if (fill.symbol === SYMBOL && fill.side === 'sell' && fill.status === 'filled') {
        entryPrice = 0;
      }
    }
    if (state.warmingUp) return [];
    if (!batch.bars.some((b) => b.symbol === SYMBOL)) return [];
    const { caps, fees } = state.hello;
    const held = state.positions.get(SYMBOL);
    const now = history[history.length - 1]!;

    if (held !== undefined && entryPrice > 0) {
      const takeProfit = now * 10_000 >= entryPrice * (10_000 + TAKE_PROFIT_BPS);
      const stopLoss = now * 10_000 <= entryPrice * (10_000 - STOP_LOSS_BPS);
      const timeStop = entrySeq >= 0 && batch.seq - entrySeq >= MAX_HOLD_BARS;
      if (takeProfit || stopLoss || timeStop) {
        const sell: SellInput = { side: 'sell', symbol: SYMBOL, qty: held.qty, max_slippage_bps: MAX_SLIPPAGE_BPS };
        entrySeq = -1;
        entryPrice = 0;
        return [sell];
      }
      return [];
    }

    entryPrice = 0;
    if (batch.seq >= WINDOW_BARS - NO_ENTRY_TAIL_BARS) return [];
    if (history.length <= LOOKBACK_BARS) return [];
    const then = history[0]!;
    const dipBps = then === 0 ? 0 : ((then - now) / then) * 10_000;
    if (dipBps < DIP_BPS) return [];
    const byWeight = (BigInt(caps.max_weight_bps) * state.equity) / BPS;
    const slice = state.cash < byWeight ? state.cash : byWeight;
    if (slice === 0n || slice < BigInt(fees.min_notional_quote_units)) return [];
    entrySeq = batch.seq;
    const buy: BuyInput = { side: 'buy', symbol: SYMBOL, notional_quote_units: slice, max_slippage_bps: MAX_SLIPPAGE_BPS };
    return [buy];
  },
});
