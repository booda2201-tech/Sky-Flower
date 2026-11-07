// One-off helper: lists the public videos of the brand's YouTube channel (id, title, length, views).
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36';
const out = {};
for (const tab of ['videos', 'shorts']) {
  const res = await fetch(`https://www.youtube.com/@skyflowerofficial/${tab}`, {
    headers: { 'user-agent': UA, 'accept-language': 'en-US,en;q=0.9' },
  });
  const html = await res.text();
  const m = html.match(/var ytInitialData = (\{.*?\});<\/script>/s);
  if (!m) { console.log(tab, 'no data', res.status); continue; }
  const data = JSON.parse(m[1]);
  const items = [];
  (function walk(o) {
    if (!o || typeof o !== 'object') return;
    if (o.videoRenderer) items.push({ kind: 'video', id: o.videoRenderer.videoId, title: o.videoRenderer.title?.runs?.[0]?.text, len: o.videoRenderer.lengthText?.simpleText, views: o.videoRenderer.viewCountText?.simpleText, when: o.videoRenderer.publishedTimeText?.simpleText });
    if (o.reelItemRenderer) items.push({ kind: 'short', id: o.reelItemRenderer.videoId, title: o.reelItemRenderer.headline?.simpleText, views: o.reelItemRenderer.viewCountText?.simpleText });
    if (o.shortsLockupViewModel) items.push({ kind: 'short', id: o.shortsLockupViewModel.onTap?.innertubeCommand?.reelWatchEndpoint?.videoId, title: o.shortsLockupViewModel.overlayMetadata?.primaryText?.content, views: o.shortsLockupViewModel.overlayMetadata?.secondaryText?.content });
    for (const k of Object.keys(o)) walk(o[k]);
  })(data);
  out[tab] = items;
  const subs = html.match(/"subscriberCountText":"([^"]+)"/)?.[1] ?? html.match(/"content":"([\d.,KM]+ subscribers)"/)?.[1];
  console.log(tab, items.length, 'subs:', subs);
}
console.log(JSON.stringify(out, null, 1));
