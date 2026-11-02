-- Sources shared by a whole subject, e.g. a textbook. Existing sources stay on their topics.
-- AlterTable
ALTER TABLE `Document` ADD COLUMN `subjectId` INTEGER NULL;

-- CreateIndex
CREATE INDEX `Document_userId_subjectId_idx` ON `Document`(`userId`, `subjectId`);

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

