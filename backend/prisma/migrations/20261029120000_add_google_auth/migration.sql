-- Google sign-in: accounts created through Google have no password.
ALTER TABLE `User` MODIFY `password` VARCHAR(191) NULL;
ALTER TABLE `User` ADD COLUMN `googleId` VARCHAR(191) NULL;
CREATE UNIQUE INDEX `User_googleId_key` ON `User`(`googleId`);
