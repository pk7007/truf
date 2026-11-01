-- Authorized presentation fixtures. Only the existing isolated demo accounts
-- and venue are used; no payment or real customer records are changed.
INSERT INTO "Slot" ("id", "areaId", "startsAt", "endsAt", "pricePaise", "blocked")
SELECT 'demo-discovery-nov-' || n,
       'hosted-demo-20261015-month-v1-' ||
       CASE n % 3 WHEN 0 THEN 'Football' WHEN 1 THEN 'Cricket' ELSE 'Badminton' END,
       ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date + n + TIME '18:00') AT TIME ZONE 'Asia/Kolkata',
       ((CURRENT_TIMESTAMP AT TIME ZONE 'Asia/Kolkata')::date + n + TIME '19:00') AT TIME ZONE 'Asia/Kolkata',
       80000, false
FROM generate_series(1,7) AS n
WHERE EXISTS (SELECT 1 FROM "PlayingArea" WHERE "id" =
  'hosted-demo-20261015-month-v1-' || CASE n % 3 WHEN 0 THEN 'Football' WHEN 1 THEN 'Cricket' ELSE 'Badminton' END)
AND EXISTS (SELECT 1 FROM "User" WHERE "id" = 'hosted-demo-20261015-player')
ON CONFLICT DO NOTHING;

INSERT INTO "Match" ("id", "captainId", "slotId", "title", "capacity", "sharePaise", "visibility", "status", "createdAt")
SELECT s."id", 'hosted-demo-20261015-player', s."id",
       a."sport" || ' evening community game · Demo', 4, 20000, 'PUBLIC', 'REQUESTED', CURRENT_TIMESTAMP
FROM "Slot" s JOIN "PlayingArea" a ON a."id" = s."areaId"
WHERE s."id" LIKE 'demo-discovery-nov-%'
ON CONFLICT DO NOTHING;
