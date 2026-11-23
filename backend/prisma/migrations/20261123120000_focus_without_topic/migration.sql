-- A focus block can be started without choosing a topic; it still counts toward the streak.
-- AlterTable
ALTER TABLE `StudySession` MODIFY `topicId` INTEGER NULL;
