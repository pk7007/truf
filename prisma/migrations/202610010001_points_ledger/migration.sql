CREATE TABLE "PointsEntry" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "participationId" TEXT NOT NULL REFERENCES "Participation"("id"),
 "userId" TEXT NOT NULL REFERENCES "User"("id"),
 "delta" INTEGER NOT NULL CHECK (delta IN (-100,100)),
 "reason" TEXT NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "PointsEntry_userId_createdAt_idx" ON "PointsEntry"("userId","createdAt");
INSERT INTO "PointsEntry" (id,"participationId","userId",delta,reason)
 SELECT 'initial-'||a.id,a."participationId",p."userId",100,'Existing verified attendance'
 FROM "Attendance" a JOIN "Participation" p ON a."participationId"=p.id WHERE a.status='ATTENDED';
