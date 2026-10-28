-- CreateTable
CREATE TABLE `Document` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `userId` INTEGER NOT NULL,
    `topicId` INTEGER,
    `name` VARCHAR(191) NOT NULL,
    `type` ENUM('PDF', 'NOTE', 'YOUTUBE') NOT NULL,
    `status` ENUM('UPLOADING', 'PROCESSING', 'READY', 'FAILED') NOT NULL DEFAULT 'UPLOADING',
    `sourceUrl` LONGTEXT NOT NULL,
    `fileKey` VARCHAR(191),
    `mimeType` VARCHAR(191),
    `sizeBytes` INTEGER,
    `pageCount` INTEGER,
    `errorMessage` LONGTEXT,
    `processedAt` DATETIME(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `Document_userId_idx`(`userId`),
    INDEX `Document_userId_topicId_idx`(`userId`, `topicId`),
    INDEX `Document_userId_status_idx`(`userId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `DocumentChunk` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `documentId` INTEGER NOT NULL,
    `chunkIndex` INTEGER NOT NULL,
    `content` LONGTEXT NOT NULL,
    `metadata` JSON,
    `embedding` JSON,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `DocumentChunk_documentId_idx`(`documentId`),
    UNIQUE INDEX `DocumentChunk_documentId_chunkIndex_key`(`documentId`, `chunkIndex`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Document` ADD CONSTRAINT `Document_topicId_fkey` FOREIGN KEY (`topicId`) REFERENCES `Topic`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `DocumentChunk` ADD CONSTRAINT `DocumentChunk_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `Document`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
