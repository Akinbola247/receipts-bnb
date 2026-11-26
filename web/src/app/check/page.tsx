import { CheckFlow } from "@/components/CheckFlow";
import { Reveal } from "@/components/Motion";

export const metadata = { title: "Check a call — RECEIPTS" };

export default async function CheckPage({ searchParams }: { searchParams: Promise<{ q?: string; by?: string; src?: string; at?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="relative">
      <div className="bg-grid absolute inset-x-0 top-0 h-[480px]" />
      <div className="relative mx-auto max-w-7xl px-5 pt-14">
        <Reveal>
          <div className="font-mono text-xs tracking-[0.3em] text-bnb">CHECK A CALL</div>
          <h1 className="mt-3 text-4xl font-extrabold tracking-tight md:text-6xl">What are the odds, really?</h1>
          <p className="mt-4 max-w-2xl text-white/55">
            Paste a price call. We match it to a live prediction market, ask Cournot&apos;s Intelligence Oracle for the probability and
            evidence, add CoinMarketCap context, and print a receipt on BNB Chain. No wallet, no gas.
          </p>
        </Reveal>
        <div className="mt-10">
          <CheckFlow initialClaim={sp.q ?? ""} initialCaller={sp.by ?? ""} initialSource={sp.src ?? ""} initialPosted={sp.at ?? ""} />
        </div>
      </div>
    </div>
  );
}
