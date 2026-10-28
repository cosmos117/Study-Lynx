-- RecallReview.topicId is in the Prisma schema but no earlier migration created it, so every
-- flashcard review failed on databases built from migrations. Written to be safe to re-run
-- on databases that already have the column.
SET @has_column := (
  SELECT COUNT(*) FROM information_schema.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'RecallReview' AND COLUMN_NAME = 'topicId'
);
SET @statement := IF(@has_column = 0, 'ALTER TABLE `RecallReview` ADD COLUMN `topicId` INTEGER NULL', 'SELECT 1');
PREPARE step FROM @statement; EXECUTE step; DEALLOCATE PREPARE step;

SET @has_key := (
  SELECT COUNT(*) FROM information_schema.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'RecallReview' AND CONSTRAINT_NAME = 'RecallReview_topicId_fkey'
);
SET @statement := IF(@has_key = 0,
  'ALTER TABLE `RecallReview` ADD CONSTRAINT `RecallReview_topicId_fkey` FOREIGN KEY (`topicId`) REFERENCES `Topic`(`id`) ON DELETE SET NULL ON UPDATE CASCADE',
  'SELECT 1');
PREPARE step FROM @statement; EXECUTE step; DEALLOCATE PREPARE step;
