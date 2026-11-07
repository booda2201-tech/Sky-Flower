/**
 * Real videos from the brand's own YouTube channel (youtube.com/@skyflowerofficial).
 *
 * Nothing is copied or re-hosted: thumbnails load from YouTube's CDN and playback uses
 * YouTube's official embed, so the clips stay the owner's property and disappear from the
 * site if he removes them. View counts are a snapshot (see `BRAND.statsAsOf`).
 *
 * To add a reel, append `{ id, views }` - the id is the part after `/shorts/` in the link.
 */
export interface BrandReel {
  /** YouTube video id. */
  readonly id: string;
  /** Short, display-ready view count, e.g. "686K". */
  readonly views: string;
  /**
   * Optional override for the original file (relative to `public/`). By default the site
   * looks for `videos/<id>.mp4` and, when it exists, plays it in its own player with no
   * third-party branding at all.
   */
  readonly file?: string;
  /** Optional poster for `file` (e.g. `videos/xbhB5GjSMsQ.jpg`); falls back to the YouTube frame. */
  readonly poster?: string;
}

export const BRAND_REELS: readonly BrandReel[] = [
  { id: 'xbhB5GjSMsQ', views: '686K' },
  { id: 'qFOTybgCtg4', views: '173K' },
  { id: 'iKoCuyQTZgA', views: '134K' },
  { id: '9i5-ihCHhLE', views: '113K' },
  { id: '3Uc-ga-zH40', views: '84K' },
  { id: 'tP9kPbOEQaQ', views: '80K' },
  { id: '7boFnY-gfds', views: '42K' },
  { id: 'SI8DEjKK16Y', views: '39K' },
  { id: 'LeqglrBVRpI', views: '35K' },
  { id: 'CWQH5dHs4Kc', views: '25K' },
  { id: 'fkp2kgZBwjM', views: '21K' },
  { id: 'wizzPW8H1eU', views: '19K' },
  { id: 'e0usfdxx150', views: '14K' },
  { id: '14hFI8pWhYo', views: '14K' },
  { id: 'kwNToYsUPBc', views: '11K' },
  { id: '3u2MtbQrWMw', views: '10K' },
];

/**
 * Where the original file of a reel is expected: `public/videos/<id>.mp4`.
 * If the file is not there the site quietly falls back to the YouTube player.
 */
export const reelFile = (reel: BrandReel): string => reel.file ?? `videos/${reel.id}.mp4`;

/** Cover image: the poster of the original file if there is one, else YouTube's tall frame. */
export const reelThumb = (reel: BrandReel): string =>
  reel.poster ?? `https://i.ytimg.com/vi/${reel.id}/oar2.jpg`;

/** Embed URL with as little player chrome as YouTube allows, looping like a reel. */
export const reelEmbedUrl = (id: string): string =>
  `https://www.youtube-nocookie.com/embed/${id}?autoplay=1&controls=0&rel=0&playsinline=1&modestbranding=1` +
  `&iv_load_policy=3&fs=0&disablekb=1&loop=1&playlist=${id}&cc_load_policy=0`;
