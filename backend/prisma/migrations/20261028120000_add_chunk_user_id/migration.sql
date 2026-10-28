-- DocumentChunk now carries its owner so every retrieval query can filter by userId directly.
ALTER TABLE `DocumentChunk` ADD COLUMN `userId` INTEGER NULL;

UPDATE `DocumentChunk` AS c
JOIN `Document` AS d ON d.`id` = c.`documentId`
SET c.`userId` = d.`userId`;

ALTER TABLE `DocumentChunk` MODIFY `userId` INTEGER NOT NULL;

-- Replaced by the composite (userId, documentId) index below.
-- The foreign key on documentId needs an index, so the unique (documentId, chunkIndex) index keeps serving it.
DROP INDEX `DocumentChunk_documentId_idx` ON `DocumentChunk`;
CREATE INDEX `DocumentChunk_userId_documentId_idx` ON `DocumentChunk`(`userId`, `documentId`);

ALTER TABLE `DocumentChunk` ADD CONSTRAINT `DocumentChunk_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `User`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- Raw uploads are no longer kept on disk; only chunks and embeddings are stored.
ALTER TABLE `Document` DROP COLUMN `fileKey`;
