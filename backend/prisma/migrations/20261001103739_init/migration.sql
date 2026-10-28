-- CreateTable
CREATE TABLE `User` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `name` VARCHAR(191) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `password` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `User_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Exam` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `examDate` DATETIME(3) NOT NULL,
    `dailyStudyHours` DOUBLE NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Exam_userId_idx`(`userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Subject` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `examId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Subject_examId_idx`(`examId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Topic` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `subjectId` INTEGER NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `difficulty` ENUM('WEAK', 'AVERAGE', 'STRONG') NOT NULL DEFAULT 'AVERAGE',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Topic_subjectId_idx`(`subjectId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StudySession` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `topicId` INTEGER NOT NULL,
    `date` DATETIME(3) NOT NULL,
    `duration` INTEGER NOT NULL,
    `status` ENUM('PLANNED', 'COMPLETED', 'SKIPPED') NOT NULL DEFAULT 'PLANNED',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StudySession_userId_idx`(`userId`),
    INDEX `StudySession_topicId_idx`(`topicId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `QuizResult` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `topicId` INTEGER NOT NULL,
    `score` INTEGER NOT NULL,
    `totalQuestions` INTEGER NOT NULL,
    `attemptedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `QuizResult_userId_idx`(`userId`),
    INDEX `QuizResult_topicId_idx`(`topicId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Exam` ADD CONSTRAINT `Exam_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Subject` ADD CONSTRAINT `Subject_examId_fkey` FOREIGN KEY (`examId`) REFERENCES `Exam`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Topic` ADD CONSTRAINT `Topic_subjectId_fkey` FOREIGN KEY (`subjectId`) REFERENCES `Subject`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudySession` ADD CONSTRAINT `StudySession_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StudySession` ADD CONSTRAINT `StudySession_topicId_fkey` FOREIGN KEY (`topicId`) REFERENCES `Topic`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuizResult` ADD CONSTRAINT `QuizResult_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `QuizResult` ADD CONSTRAINT `QuizResult_topicId_fkey` FOREIGN KEY (`topicId`) REFERENCES `Topic`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
