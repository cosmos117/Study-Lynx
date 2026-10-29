-- Subjects now belong directly to a user, with an optional exam date. The Exam level is removed.
-- Order matters: copy each exam's owner and date onto its subjects before dropping the exam.

-- 1. New columns, nullable while they are filled in.
ALTER TABLE `Subject` ADD COLUMN `userId` INTEGER NULL,
    ADD COLUMN `examDate` DATETIME(3) NULL;

-- 2. Backfill from the exam each subject belonged to.
UPDATE `Subject` s
    JOIN `Exam` e ON e.`id` = s.`examId`
    SET s.`userId` = e.`userId`, s.`examDate` = e.`examDate`;

-- 3. Every subject now has an owner, so the column can be required.
ALTER TABLE `Subject` MODIFY `userId` INTEGER NOT NULL;
CREATE INDEX `Subject_userId_idx` ON `Subject`(`userId`);
ALTER TABLE `Subject` ADD CONSTRAINT `Subject_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- 4. Remove the old link to Exam, then Exam itself.
ALTER TABLE `Subject` DROP FOREIGN KEY `Subject_examId_fkey`;
DROP INDEX `Subject_examId_idx` ON `Subject`;
ALTER TABLE `Subject` DROP COLUMN `examId`;

ALTER TABLE `Exam` DROP FOREIGN KEY `Exam_userId_fkey`;
DROP TABLE `Exam`;
