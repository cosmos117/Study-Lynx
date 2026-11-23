-- A deleted topic now deletes its sources (and, through them, their chunks) instead of leaving them
-- attached to nothing. Remove the sources earlier topic deletions left behind.
DELETE FROM `Document` WHERE `topicId` IS NULL AND `subjectId` IS NULL;

-- DropForeignKey
ALTER TABLE `Document` DROP FOREIGN KEY `Document_topicId_fkey`;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_topicId_fkey` FOREIGN KEY (`topicId`) REFERENCES `Topic`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
