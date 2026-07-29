-- Rhautt Nexus - Migration 056
-- Seed Everhot public news cards to match the current frontend display.

SET search_path TO rhautt_nexus, public;

INSERT INTO rhautt_nexus.site_news_articles (
  tenant_id, site_id, slug, title, summary, body, cover_image_url, published_at, status, sort_order, is_featured
)
SELECT
  site.tenant_id,
  site.id,
  seed.slug,
  seed.title,
  seed.summary,
  seed.summary,
  seed.cover_image_url,
  seed.published_at::timestamptz,
  'published',
  seed.sort_order,
  true
FROM rhautt_nexus.tenant_brand_sites site
CROSS JOIN (
  VALUES
    (
      'everhot-cn-site-upgrade',
      '恒热中国官网全新升级上线',
      '以更清晰的产品架构与服务体验，连接每一个家庭与项目。',
      '/assets/img/home-card1.webp',
      '2026-06-01 00:00:00+08',
      10
    ),
    (
      'everhot-commercial-hot-water-expo',
      '恒热商用热水方案亮相行业展会',
      '大功率连续供热系统获酒店与公寓项目方关注。',
      '/assets/img/sust-product-new.webp',
      '2026-05-01 00:00:00+08',
      20
    ),
    (
      'large-home-central-heating-guide',
      '如何为大户型选择中央采暖系统',
      '从热负荷计算到设备选型的完整选购指南。',
      '/assets/img/home-card3.webp',
      '2026-04-01 00:00:00+08',
      30
    )
) AS seed(slug, title, summary, cover_image_url, published_at, sort_order)
WHERE site.code = 'everhot'
  AND site.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1
    FROM rhautt_nexus.site_news_articles existing
    WHERE existing.tenant_id = site.tenant_id
      AND existing.site_id = site.id
      AND lower(existing.slug) = seed.slug
      AND existing.deleted_at IS NULL
  );
