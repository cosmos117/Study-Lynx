CREATE TABLE `LearningResource` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `topicId` INTEGER NOT NULL,
    `type` ENUM('YOUTUBE', 'PDF', 'NOTE', 'WEB', 'BOOK') NOT NULL,
    `title` VARCHAR(191) NOT NULL,
    `url` TEXT NOT NULL,
    `youtubeVideoId` VARCHAR(191) NULL,
    `transcript` TEXT NULL,
    `metadata` JSON NULL,
    `startedAt` DATETIME(3) NULL,
    `watchedPercent` INTEGER NOT NULL DEFAULT 0,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    INDEX `LearningResource_userId_topicId_idx`(`userId`, `topicId`),
    INDEX `LearningResource_userId_type_idx`(`userId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `LearningResource` ADD CONSTRAINT `LearningResource_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `LearningResource` ADD CONSTRAINT `LearningResource_topicId_fkey` FOREIGN KEY (`topicId`) REFERENCES `Topic`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
