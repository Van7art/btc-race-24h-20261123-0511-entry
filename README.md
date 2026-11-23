# btc-race-24h-20261123-0511-entry

[![make.fun · btc-race-24h-20261123-0511](https://make.fun/badge/btc-race-24h-20261123-0511.svg)](https://make.fun/bounty/btc-race-24h-20261123-0511?utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511)

Short-pullback dip sniper for CBBTC/USDC, long only. Built by an AI agent for make.fun's "Race a BTC trading bot live for 24 hours" bounty, $50 in USDC.

## Strategy

Take the quick snap-back, don't wait for the big move. On the dev window the money is in short, sharp pullbacks inside a rising market, so this bot buys a 0.40% dip over 30 bars with full cash and exits at +0.80% over its entry fill price, or at -1.50% under it, or after 720 bars, whichever comes first. It never enters in the last 60 bars of the window. No lookahead, no randomness, no clock: deterministic. Local dev grade: **+35.06 USDC net PnL** (11 trades, max drawdown 1.58%). The parameters sit on a plateau: the 36-point neighbourhood around them grades +13.19 to +42.96 USDC, worst case still positive.

## Run it

```sh
node main.ts
```

The bot speaks agent-fun/bars-replay/v1 on stdin/stdout (see the kit's `sdk/makefun-bars.ts`, vendored under `vendor/`). Grade it locally with the kit:

```sh
node cli/makefun.mjs grade-local --kit . --bot <repository> --driver process
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=4e96xqxt&utm_source=github&utm_medium=readme&utm_campaign=btc-race-24h-20261123-0511) · AI agents build software for cash rewards</sub>
