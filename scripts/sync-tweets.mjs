// Keeps data/tweets.json in step with the tweets that are live on X.
//
// Runs hourly in GitHub Actions (.github/workflows/sync-tweets.yml). No login or API key:
// - New tweets come from X's public profile feed when it responds, plus any links listed
//   in data/tweet-links.txt (the fallback for when X rate-limits the feed).
// - Every known tweet is re-checked each run; deleted ones are dropped from the site.
//
// Usage: node scripts/sync-tweets.mjs          (FORCE_SYNC=true to skip the mass-removal guard)

import { readFile, writeFile } from 'node:fs/promises';

const HANDLE = 'TheByzGenRL';
const LINKS_FILE = new URL('../data/tweet-links.txt', import.meta.url);
const OUT_FILE = new URL('../data/tweets.json', import.meta.url);
const FORCE = process.env.FORCE_SYNC === 'true';
const UA = 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0 Safari/537.36';

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const isOwn = (t) => t.user?.screen_name?.toLowerCase() === HANDLE.toLowerCase();

// Same token X's own embed widget sends with tweet lookups.
const token = (id) => ((Number(id) / 1e15) * Math.PI).toString(36).replace(/(0+|\.)/g, '');

async function readLinks() {
  const text = await readFile(LINKS_FILE, 'utf8').catch(() => '');
  const ids = new Set();
  for (const raw of text.split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const id = line.match(/status(?:es)?\/(\d+)/)?.[1] ?? line.match(/^\d+$/)?.[0];
    if (id) ids.add(id);
    else console.warn(`tweet-links.txt: can't find a tweet ID in "${line}"`);
  }
  return ids;
}

async function readExisting() {
  try {
    return JSON.parse(await readFile(OUT_FILE, 'utf8'));
  } catch {
    return { handle: HANDLE, tweets: [] };
  }
}

// Best effort: X frequently answers this feed with 429, in which case we rely on tweet-links.txt.
async function discover() {
  try {
    const res = await fetch(
      `https://syndication.twitter.com/srv/timeline-profile/screen-name/${HANDLE}?showReplies=false`,
      { headers: { 'User-Agent': UA } },
    );
    if (!res.ok) {
      console.log(`Profile feed unavailable (HTTP ${res.status}); using known tweets and tweet-links.txt only.`);
      return [];
    }
    const html = await res.text();
    const json = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/)?.[1];
    const entries = json ? JSON.parse(json)?.props?.pageProps?.timeline?.entries ?? [] : [];
    const ids = entries
      .filter((e) => e.type === 'tweet')
      .map((e) => e.content?.tweet)
      .filter((t) => t && !t.retweeted_status && isOwn(t))
      .map((t) => t.id_str);
    console.log(`Profile feed returned ${ids.length} tweets.`);
    return ids;
  } catch (err) {
    console.log(`Profile feed unreadable (${err.message}); using known tweets and tweet-links.txt only.`);
    return [];
  }
}

// live: tweet exists; gone: deleted, protected or suspended; unknown: X didn't give a clear answer.
async function lookup(id) {
  try {
    const res = await fetch(
      `https://cdn.syndication.twimg.com/tweet-result?id=${id}&lang=en&token=${token(id)}`,
      { headers: { 'User-Agent': UA } },
    );
    if (res.status === 404) return { status: 'gone' };
    if (res.ok && res.headers.get('content-type')?.includes('application/json')) {
      const data = await res.json();
      if (data?.__typename === 'TweetTombstone') return { status: 'gone' };
      if (data?.id_str) return { status: 'live', data };
    }
    return { status: 'unknown', reason: `HTTP ${res.status}` };
  } catch (err) {
    return { status: 'unknown', reason: err.message };
  }
}

const ENTITIES = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'" };
const decode = (s) => s.replace(/&(amp|lt|gt|quot|#39);/g, (m) => ENTITIES[m]);

// Splits tweet text into plain runs and links. Entity indices count code points, not UTF-16 units.
function toSegments(t) {
  const chars = Array.from(t.text);
  const [start, end] = t.display_text_range ?? [0, chars.length];
  const e = t.entities ?? {};
  const links = [
    ...(e.urls ?? []).map((u) => ({ at: u.indices, text: u.display_url, href: u.expanded_url })),
    ...(e.user_mentions ?? []).map((u) => ({ at: u.indices, text: `@${u.screen_name}`, href: `https://x.com/${u.screen_name}` })),
    ...(e.hashtags ?? []).map((h) => ({ at: h.indices, text: `#${h.text}`, href: `https://x.com/hashtag/${encodeURIComponent(h.text)}` })),
    ...(e.symbols ?? []).map((s) => ({ at: s.indices, text: `$${s.text}`, href: `https://x.com/search?q=%24${encodeURIComponent(s.text)}` })),
  ]
    .filter((l) => l.at[0] >= start && l.at[1] <= end)
    .sort((a, b) => a.at[0] - b.at[0]);

  const segments = [];
  let pos = start;
  for (const l of links) {
    if (l.at[0] < pos) continue;
    if (l.at[0] > pos) segments.push({ text: decode(chars.slice(pos, l.at[0]).join('')) });
    segments.push({ text: l.text, href: l.href });
    pos = l.at[1];
  }
  if (pos < end) segments.push({ text: decode(chars.slice(pos, end).join('')) });
  return segments;
}

function toMedia(t) {
  return (t.mediaDetails ?? []).map((m) => ({
    type: m.type === 'photo' ? 'photo' : 'video',
    src: m.media_url_https,
    alt: m.ext_alt_text ?? '',
    width: m.original_info?.width ?? null,
    height: m.original_info?.height ?? null,
  }));
}

const tweetUrl = (t) => `https://x.com/${t.user.screen_name}/status/${t.id_str}`;

function normalize(t) {
  const q = t.quoted_tweet;
  return {
    id: t.id_str,
    url: tweetUrl(t),
    createdAt: t.created_at,
    replyTo: t.in_reply_to_screen_name ?? null,
    segments: toSegments(t),
    media: toMedia(t),
    quote: q?.user
      ? { name: q.user.name, handle: q.user.screen_name, url: tweetUrl(q), segments: toSegments(q), media: toMedia(q) }
      : null,
  };
}

const newestFirst = (a, b) => (BigInt(b.id) > BigInt(a.id) ? 1 : -1);

async function main() {
  const manual = await readLinks();
  const existing = await readExisting();
  const previous = new Map(existing.tweets.map((t) => [t.id, t]));
  const discovered = await discover();
  const ids = new Set([...previous.keys(), ...manual, ...discovered]);

  const tweets = [];
  const removed = [];
  for (const id of ids) {
    const result = await lookup(id);
    if (result.status === 'live') {
      if (isOwn(result.data)) tweets.push(normalize(result.data));
      else console.warn(`Skipping ${id}: posted by @${result.data.user?.screen_name}, not @${HANDLE}.`);
    } else if (result.status === 'gone') {
      if (previous.has(id)) removed.push(id);
      console.log(`${id}: no longer on X${previous.has(id) ? ', removing' : ''}.`);
    } else {
      // Never delete on an unclear answer; keep the last good copy until X responds properly.
      if (previous.has(id)) tweets.push(previous.get(id));
      console.warn(`${id}: lookup failed (${result.reason}), keeping previous copy.`);
    }
    await sleep(250);
  }

  // If X starts answering 404 for everything, don't wipe the page. A real mass deletion
  // can be confirmed by re-running the workflow with "force" ticked.
  if (!FORCE && previous.size >= 4 && removed.length > previous.size / 2) {
    console.error(
      `Refusing to remove ${removed.length} of ${previous.size} tweets in one run; this looks like an X outage. ` +
        'If you really deleted them, re-run the "Sync tweets" workflow with "force" ticked.',
    );
    process.exit(1);
  }

  tweets.sort(newestFirst);
  if (JSON.stringify(tweets) === JSON.stringify(existing.tweets)) {
    console.log(`No changes (${tweets.length} tweets).`);
    return;
  }
  const out = { handle: HANDLE, updatedAt: new Date().toISOString(), tweets };
  await writeFile(OUT_FILE, JSON.stringify(out, null, 2) + '\n');
  console.log(`Wrote ${tweets.length} tweets (${removed.length} removed).`);
}

await main();
