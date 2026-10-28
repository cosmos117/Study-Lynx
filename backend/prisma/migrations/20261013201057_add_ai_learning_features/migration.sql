-- AlterTable
ALTER TABLE `quizresult` ADD COLUMN `answers` JSON NULL;

-- CreateTable
CREATE TABLE `AiContent` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `topicId` INTEGER NOT NULL,
    `type` ENUM('NOTES', 'FLASHCARDS', 'QUIZ', 'MINDMAP') NOT NULL,
    `status` ENUM('GENERATING', 'READY', 'FAILED') NOT NULL DEFAULT 'GENERATING',
    `content` JSON NULL,
    `promptVersion` VARCHAR(191) NOT NULL,
    `provider` VARCHAR(191) NULL,
    `model` VARCHAR(191) NULL,
    `lockedAt` DATETIME(3) NULL,
    `errorCode` VARCHAR(191) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `AiContent_userId_topicId_idx`(`userId`, `topicId`),
    UNIQUE INDEX `AiContent_userId_topicId_type_key`(`userId`, `topicId`, `type`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `AiUsage` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NULL,
    `date` DATETIME(3) NOT NULL,
    `feature` VARCHAR(191) NOT NULL,
    `count` INTEGER NOT NULL DEFAULT 0,

    UNIQUE INDEX `AiUsage_userId_date_feature_key`(`userId`, `date`, `feature`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Note` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `topicId` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `source` ENUM('AI', 'USER') NOT NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Note_userId_topicId_key`(`userId`, `topicId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Flashcard` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `topicId` INTEGER NOT NULL,
    `question` TEXT NOT NULL,
    `answer` TEXT NOT NULL,
    `source` ENUM('AI', 'USER') NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `Flashcard_userId_topicId_idx`(`userId`, `topicId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `CardReview` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `flashcardId` INTEGER NOT NULL,
    `userId` INTEGER NOT NULL,
    `easeFactor` DOUBLE NOT NULL DEFAULT 2.5,
    `intervalDays` INTEGER NOT NULL DEFAULT 0,
    `repetitions` INTEGER NOT NULL DEFAULT 0,
    `lapses` INTEGER NOT NULL DEFAULT 0,
    `dueAt` DATETIME(3) NOT NULL,
    `lastReviewedAt` DATETIME(3) NULL,

    UNIQUE INDEX `CardReview_flashcardId_key`(`flashcardId`),
    INDEX `CardReview_userId_dueAt_idx`(`userId`, `dueAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `AiContent` ADD CONSTRAINT `AiContent_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiContent` ADD CONSTRAINT `AiContent_topicId_fkey` FOREIGN KEY (`topicId`) REFERENCES `Topic`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `AiUsage` ADD CONSTRAINT `AiUsage_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Note` ADD CONSTRAINT `Note_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Note` ADD CONSTRAINT `Note_topicId_fkey` FOREIGN KEY (`topicId`) REFERENCES `Topic`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Flashcard` ADD CONSTRAINT `Flashcard_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Flashcard` ADD CONSTRAINT `Flashcard_topicId_fkey` FOREIGN KEY (`topicId`) REFERENCES `Topic`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CardReview` ADD CONSTRAINT `CardReview_flashcardId_fkey` FOREIGN KEY (`flashcardId`) REFERENCES `Flashcard`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `CardReview` ADD CONSTRAINT `CardReview_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
