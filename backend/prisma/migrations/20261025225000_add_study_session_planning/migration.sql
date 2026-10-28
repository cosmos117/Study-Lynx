-- AlterTable
ALTER TABLE `StudySession`
    ADD COLUMN `startTime` DATETIME(3) NULL,
    ADD COLUMN `plannedDuration` INTEGER NULL,
    ADD COLUMN `actualDuration` INTEGER NULL,
    ADD COLUMN `technique` ENUM('POMODORO', 'DEEP_FOCUS', 'CUSTOM') NOT NULL DEFAULT 'POMODORO',
    ADD COLUMN `completedAt` DATETIME(3) NULL;

-- Backfill the new planned duration from the existing duration field.
UPDATE `StudySession` SET `plannedDuration` = `duration` WHERE `plannedDuration` IS NULL;
