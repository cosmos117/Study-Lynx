CREATE TABLE `RecallReview` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `flashcardId` INTEGER NOT NULL,
    `rating` ENUM('AGAIN', 'HARD', 'GOOD', 'EASY') NOT NULL,
    `reviewedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    INDEX `RecallReview_userId_reviewedAt_idx`(`userId`, `reviewedAt`),
    INDEX `RecallReview_flashcardId_reviewedAt_idx`(`flashcardId`, `reviewedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `RecallReview` ADD CONSTRAINT `RecallReview_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE `RecallReview` ADD CONSTRAINT `RecallReview_flashcardId_fkey` FOREIGN KEY (`flashcardId`) REFERENCES `Flashcard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
