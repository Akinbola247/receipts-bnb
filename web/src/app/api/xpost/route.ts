import { NextResponse } from "next/server";

// Import a public X post (author, text, timestamp) so a call can be checked straight from its link.
// Uses the free, keyless FxTwitter API; nothing is stored server-side.
const RE = /^https?:\/\/(?:www\.|mobile\.)?(?:x|twitter)\.com\/([A-Za-z0-9_]{1,15})\/status(?:es)?\/(\d{1,25})/i;

export async function GET(req: Request) {
  const url = new URL(req.url).searchParams.get("url")?.trim() ?? "";
  const m = url.match(RE);
  if (!m) return NextResponse.json({ error: "Paste a link like https://x.com/<user>/status/<id>" }, { status: 400 });
  const [, user, id] = m;
  try {
    const r = await fetch(`https://api.fxtwitter.com/${user}/status/${id}`, {
      headers: { "user-agent": "receipts-bnb/1.0" },
      signal: AbortSignal.timeout(10_000),
      next: { revalidate: 3600 },
    });
    const j = await r.json();
    const t = j?.tweet;
    if (!r.ok || !t?.text) return NextResponse.json({ error: "Couldn't load that post (deleted, private or rate-limited)." }, { status: 404 });
    return NextResponse.json(
      {
        url: `https://x.com/${t.author?.screen_name ?? user}/status/${id}`,
        handle: `@${t.author?.screen_name ?? user}`,
        name: t.author?.name ?? user,
        avatar: t.author?.avatar_url ?? null,
        text: String(t.text),
        postedAt: Number(t.created_timestamp) || null,
        likes: t.likes ?? null,
        reposts: t.retweets ?? null,
      },
      { headers: { "Cache-Control": "s-maxage=3600" } },
    );
  } catch {
    return NextResponse.json({ error: "X post lookup timed out. Try again." }, { status: 504 });
  }
}
