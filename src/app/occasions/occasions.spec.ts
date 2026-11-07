import { FLOWER_PRODUCTS, OCCASION_FILTERS } from '../data/flower-data';
import { BRAND_REELS, reelEmbedUrl, reelThumb } from '../data/brand-media';
import { OCCASION_CARDS, designsLabel, occasionCount } from '../data/occasion-data';

describe('occasion data', () => {
  it('every occasion card has a matching filter chip and at least one design', () => {
    for (const card of OCCASION_CARDS) {
      expect(OCCASION_FILTERS.some((f) => f.id === card.id)).toBe(true);
      expect(occasionCount(card.id)).toBeGreaterThan(0);
    }
  });

  it('counts only the products tagged with the occasion', () => {
    const expected = FLOWER_PRODUCTS.filter((p) => p.occasions.includes('Graduation')).length;
    expect(occasionCount('Graduation')).toBe(expected);
  });

  it('lists each brand reel once, with valid YouTube links', () => {
    const ids = BRAND_REELS.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const r of BRAND_REELS) {
      expect(r.id).toMatch(/^[\w-]{11}$/);
      expect(reelThumb(r)).toContain(`/vi/${r.id}/`);
      expect(reelEmbedUrl(r.id)).toContain(`youtube-nocookie.com/embed/${r.id}`);
    }
  });

  it('pluralises design counts in both languages', () => {
    expect(designsLabel(1, 'en')).toBe('1 design');
    expect(designsLabel(3, 'en')).toBe('3 designs');
    expect(designsLabel(2, 'ar')).toBe('تصميمان');
    expect(designsLabel(4, 'ar')).toBe('4 تصاميم');
  });
});
