#!/usr/bin/env node
// Batch-import verified public price calls into RECEIPTS through the exact same pipeline users hit:
//   /api/cournot/resolve → /api/cournot/probability → /api/anchor (CoinMarketCap snapshot + SourceFacet.anchorWithSource)
//
// usage: BASE=https://receipts-bnb.vercel.app node scripts/seed-calls.mjs data/real-calls.json [--dry]
//
// Honesty rule: a call is anchored ONLY if Cournot returns a market whose asset, price threshold (±2%)
// and direction match the call. Otherwise it is skipped, never forced onto a different market.

import fs from "node:fs";

const BASE = process.env.BASE || "https://receipts-bnb.vercel.app";
const file = process.argv[2];
const DRY = process.argv.includes("--dry");
const PACE_MS = Number(process.env.PACE_MS || 11_000); // /api/anchor allows 6/min per IP
if (!file) {
  console.error("usage: node scripts/seed-calls.mjs <calls.json> [--dry]");
  process.exit(1);
}

const NAMES = {
  BTC: ["bitcoin", "btc"],
  ETH: ["ethereum", "eth", "ether"],
  BNB: ["bnb"],
  SOL: ["solana", "sol"],
  XRP: ["xrp", "ripple"],
  DOGE: ["dogecoin", "doge"],
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const post = async (path, body) => {
  const r = await fetch(BASE + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  return { status: r.status, text: await r.text() };
};

function parseTitle(title) {
  const t = title.toLowerCase();
  const m = t.match(/\$\s?([\d,]+(?:\.\d+)?)\s*(k|m)?/);
  if (!m) return null;
  let n = Number(m[1].replace(/,/g, ""));
  if (m[2] === "k") n *= 1e3;
  if (m[2] === "m") n *= 1e6;
  const direction = /\bbelow\b|\bunder\b|\bdip\b|\bfall\b|\bless than\b/.test(t) ? "below" : "above";
  return { target: n, direction };
}

function matches(call, market) {
  const title = market.market_info.title;
  const names = NAMES[call.asset] ?? [call.asset.toLowerCase()];
  if (!names.some((n) => new RegExp(`\\b${n}\\b`, "i").test(title))) return false;
  const p = parseTitle(title);
  if (!p) return false;
  if (Math.abs(p.target - call.target) / call.target > 0.02) return false;
  if ((call.direction || "above") !== p.direction) return false;
  const end = new Date(market.market_info.end_time).getTime();
  if (!(end > Date.now())) return false;
  // a market that closes before the call's deadline understates the call: never usable
  if (call.deadline && end < Date.parse(call.deadline) - 10 * 86400e3) return false;
  return true;
}

const calls = JSON.parse(fs.readFileSync(file, "utf8")).filter((c) => c.verified !== false);
const report = { anchored: [], skipped: [] };

for (const c of calls) {
  const tag = `${c.handle} · ${c.claim}`;
  try {
    const res = await post("/api/cournot/resolve", { message: c.claim, limit: 10 });
    const j = JSON.parse(res.text);
    if (j.code !== 0) {
      report.skipped.push({ tag, why: `resolve: ${j.msg}` });
      console.log("SKIP", tag, "→ resolve", j.msg);
      continue;
    }
    const market = j.data.markets.find((m) => matches(c, m));
    if (!market) {
      report.skipped.push({ tag, why: `no exact market (top: ${j.data.markets[0]?.market_info.title})` });
      console.log("SKIP", tag, "→ no exact market; top was:", j.data.markets[0]?.market_info.title);
      continue;
    }
    console.log("MATCH", tag, "→", market.market_info.id, market.market_info.title);
    if (DRY) continue;

    const pr = await post("/api/cournot/probability", { message: c.claim, market_ids: [market.market_info.id] });
    if (pr.status === 402) {
      console.log("STOP: Cournot quota exhausted (402). Add COURNOT_API_KEY on the server and re-run.");
      report.skipped.push({ tag, why: "quota" });
      break;
    }
    const pj = JSON.parse(pr.text);
    if (pj.code !== 0 || typeof pj.data?.probability !== "number") {
      report.skipped.push({ tag, why: `probability: ${pj.msg}` });
      console.log("SKIP", tag, "→ probability", pj.msg);
      continue;
    }

    const an = await post("/api/anchor", {
      claim: c.claim,
      caller: c.handle,
      raw: pr.text,
      marketId: market.market_info.id,
      sourceUrl: c.sourceUrl,
      postedAt: c.postedAt,
    });
    const aj = JSON.parse(an.text);
    if (an.status !== 200) {
      report.skipped.push({ tag, why: `anchor: ${aj.error}` });
      console.log("FAIL", tag, "→", aj.error);
    } else {
      report.anchored.push({ tag, id: aj.id, tx: aj.txHash, p: pj.data.probability });
      console.log(`OK   #${aj.id}  p=${pj.data.probability}  ${aj.txHash}`);
    }
    await sleep(PACE_MS);
  } catch (e) {
    report.skipped.push({ tag, why: String(e.message || e) });
    console.log("ERR ", tag, e.message);
  }
}

console.log(`\n${report.anchored.length} anchored, ${report.skipped.length} skipped`);
fs.writeFileSync(file.replace(/\.json$/, "") + ".report.json", JSON.stringify(report, null, 2));
