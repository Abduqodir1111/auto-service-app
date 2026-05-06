-- AlterTable
ALTER TABLE "Report" ADD COLUMN     "accusedUserId" UUID;

-- CreateIndex
CREATE INDEX "Report_accusedUserId_idx" ON "Report"("accusedUserId");

-- AddForeignKey
ALTER TABLE "Report" ADD CONSTRAINT "Report_accusedUserId_fkey" FOREIGN KEY ("accusedUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Backfill: parse legacy `[master:<uuid>]` prefix from existing comments,
-- populate the new FK column, and strip the prefix. Idempotent — only
-- touches rows that still match the old hack pattern.
-- Cast through TEXT because regexp_match returns TEXT[]; UUID column wants UUID.
UPDATE "Report"
SET
  "accusedUserId" = ((regexp_match(comment, '^\[master:([0-9a-fA-F-]{36})\]'))[1])::uuid,
  comment = NULLIF(regexp_replace(comment, '^\[master:[0-9a-fA-F-]{36}\] ?', ''), '')
WHERE "targetType" = 'SERVICE_CALL'
  AND comment ~ '^\[master:[0-9a-fA-F-]{36}\]';
