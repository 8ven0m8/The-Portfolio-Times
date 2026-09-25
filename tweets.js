/* The Wire: renders data/tweets.json, which .github/workflows/sync-tweets.yml keeps in sync with X */
const PROFILE_URL = 'https://x.com/TheByzGenRL';
const wireStatus = document.getElementById('wireStatus');
const wireBody = document.getElementById('wireBody');
const wireLead = document.getElementById('wireLead');
const wireColumns = document.getElementById('wireColumns');

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function outLink(href, className, text) {
  const a = el('a', className, text);
  a.href = href;
  a.target = '_blank';
  a.rel = 'noopener noreferrer';
  return a;
}

const isSafeUrl = (href) => typeof href === 'string' && href.startsWith('https://');

function formatDate(iso) {
  const d = new Date(iso);
  const day = d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const time = d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  return `${day} · ${time}`;
}

function renderText(segments, className) {
  const p = el('p', className);
  segments.forEach((s) => {
    p.append(s.href && isSafeUrl(s.href) ? outLink(s.href, null, s.text) : document.createTextNode(s.text));
  });
  return p;
}

function renderMedia(media, tweetUrl) {
  const shown = media.slice(0, 4);
  const grid = el('div', `wire-media count-${shown.length}`);
  shown.forEach((m) => {
    if (!isSafeUrl(m.src)) return;
    const shot = outLink(tweetUrl, 'wire-shot');
    const img = new Image();
    img.src = `${m.src}?name=medium`;
    img.onerror = () => { img.onerror = null; img.src = m.src; };
    img.alt = m.alt || (m.type === 'video' ? 'Video still from the tweet' : 'Image attached to the tweet');
    img.loading = 'lazy';
    img.decoding = 'async';
    if (m.width && m.height) {
      img.width = m.width;
      img.height = m.height;
    }
    shot.append(img);
    if (m.type === 'video') shot.append(el('span', 'exhibit-label', 'Video · play on X'));
    grid.append(shot);
  });
  return grid;
}

function renderQuote(q) {
  const box = el('blockquote', 'wire-quote');
  const by = el('div', 'wire-quote-by');
  by.append('Quoting ', outLink(q.url, null, `${q.name} @${q.handle}`));
  box.append(by);
  if (q.segments.length) box.append(renderText(q.segments, 'wire-quote-text'));
  if (q.media.length) box.append(renderMedia(q.media.slice(0, 2), q.url));
  return box;
}

function renderTweet(t, isLead) {
  const article = el('article', isLead ? 'wire-lead' : 'wire-brief');
  const copy = isLead ? el('div', 'wire-lead-copy') : article;

  const dateline = el('div', 'wire-dateline');
  if (isLead) dateline.append(el('span', 'wire-latest', 'Latest'));
  const time = el('time', null, formatDate(t.createdAt));
  time.dateTime = t.createdAt;
  dateline.append(time);
  copy.append(dateline);

  if (t.replyTo) {
    const reply = el('div', 'wire-reply', 'Replying to ');
    reply.append(outLink(`https://x.com/${t.replyTo}`, null, `@${t.replyTo}`));
    copy.append(reply);
  }

  if (t.segments.length) {
    const text = renderText(t.segments, 'wire-text');
    if (isLead && /^\p{L}/u.test(t.segments[0].text || '')) text.classList.add('has-dropcap');
    copy.append(text);
  }

  // Briefs run text, media, quote, footer top to bottom; the lead puts its media beside the text.
  if (!isLead && t.media.length) copy.append(renderMedia(t.media, t.url));
  if (t.quote) copy.append(renderQuote(t.quote));

  const foot = el('div', 'wire-foot');
  foot.append(outLink(t.url, 'open-case', 'Read on X'));
  copy.append(foot);

  if (isLead) {
    article.append(copy);
    if (t.media.length) {
      article.classList.add('has-media');
      article.append(renderMedia(t.media, t.url));
    }
  }
  return article;
}

function showMessage(text) {
  wireStatus.textContent = text + ' ';
  wireStatus.append(outLink(PROFILE_URL, null, 'See @TheByzGenRL on X'));
}

fetch('data/tweets.json', { cache: 'no-cache' })
  .then((res) => {
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  })
  .then(({ tweets }) => {
    if (!tweets.length) {
      showMessage('Nothing on the wire yet.');
      return;
    }
    const [lead, ...rest] = tweets;
    wireLead.append(renderTweet(lead, true));
    rest.forEach((t) => wireColumns.append(renderTweet(t, false)));
    wireStatus.hidden = true;
    wireBody.classList.add('ready');
  })
  .catch((err) => {
    console.error(err);
    showMessage('Tweets couldn’t be loaded.');
  });
