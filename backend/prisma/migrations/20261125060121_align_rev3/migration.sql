/*
  Warnings:

  - The values [SCHEDULED,PROCESSING,COMPLETED,CANCELLED] on the enum `Email_status` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `errorMessage` on the `Recipient` table. All the data in the column will be lost.
  - The values [PROCESSING] on the enum `Recipient_status` will be removed. If these variants are still used in the database, this will fail.
  - You are about to drop the column `dailyLimit` on the `Sender` table. All the data in the column will be lost.
  - You are about to drop the column `email` on the `Sender` table. All the data in the column will be lost.
  - You are about to drop the column `isActive` on the `Sender` table. All the data in the column will be lost.
  - You are about to drop the column `name` on the `Sender` table. All the data in the column will be lost.
  - You are about to drop the column `sentToday` on the `Sender` table. All the data in the column will be lost.
  - You are about to drop the column `avatar` on the `User` table. All the data in the column will be lost.
  - You are about to drop the `OutboxEvent` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[idempotencyKey]` on the table `Email` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[userId,fromAddress]` on the table `Sender` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `idempotencyKey` to the `Email` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fromAddress` to the `Sender` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tokenAuthTag` to the `SlackToken` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tokenIv` to the `SlackToken` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE `Sender` DROP FOREIGN KEY `Sender_userId_fkey`;

-- DropIndex
DROP INDEX `Email_scheduledAt_status_idx` ON `Email`;

-- DropIndex
DROP INDEX `Recipient_status_idx` ON `Recipient`;

-- DropIndex
DROP INDEX `Sender_userId_email_key` ON `Sender`;

-- AlterTable
ALTER TABLE `Email` ADD COLUMN `bullJobId` VARCHAR(191) NULL,
    ADD COLUMN `failReason` TEXT NULL,
    ADD COLUMN `failedAt` DATETIME(3) NULL,
    ADD COLUMN `idempotencyKey` VARCHAR(191) NOT NULL,
    ADD COLUMN `sendingAt` DATETIME(3) NULL,
    ADD COLUMN `sentAt` DATETIME(3) NULL,
    MODIFY `status` ENUM('DRAFT', 'QUEUED', 'SENDING', 'PARTIAL', 'SENT', 'FAILED', 'RATE_LIMITED') NOT NULL DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE `Recipient` DROP COLUMN `errorMessage`,
    ADD COLUMN `failReason` TEXT NULL,
    ADD COLUMN `failedAt` DATETIME(3) NULL,
    ADD COLUMN `retryCount` INTEGER NOT NULL DEFAULT 0,
    MODIFY `status` ENUM('PENDING', 'SENDING', 'SENT', 'FAILED') NOT NULL DEFAULT 'PENDING';

-- AlterTable
ALTER TABLE `Sender` DROP COLUMN `dailyLimit`,
    DROP COLUMN `email`,
    DROP COLUMN `isActive`,
    DROP COLUMN `name`,
    DROP COLUMN `sentToday`,
    ADD COLUMN `displayName` VARCHAR(191) NULL,
    ADD COLUMN `fromAddress` VARCHAR(191) NOT NULL,
    ADD COLUMN `hourlyLimit` INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE `SlackToken` ADD COLUMN `botUserId` VARCHAR(191) NULL,
    ADD COLUMN `tokenAuthTag` VARCHAR(64) NOT NULL,
    ADD COLUMN `tokenIv` VARCHAR(64) NOT NULL,
    ADD COLUMN `webhookUrl` TEXT NULL;

-- AlterTable
ALTER TABLE `User` RENAME COLUMN `avatar` TO `avatarUrl`;

-- DropTable
DROP TABLE `OutboxEvent`;

-- CreateIndex
CREATE UNIQUE INDEX `Email_idempotencyKey_key` ON `Email`(`idempotencyKey`);

-- CreateIndex
CREATE INDEX `Email_senderId_status_idx` ON `Email`(`senderId`, `status`);

-- CreateIndex
CREATE INDEX `Email_status_sendingAt_idx` ON `Email`(`status`, `sendingAt`);

-- CreateIndex
CREATE INDEX `Email_scheduledAt_idx` ON `Email`(`scheduledAt`);

-- CreateIndex
CREATE INDEX `Recipient_emailId_idx` ON `Recipient`(`emailId`);

-- CreateIndex
CREATE INDEX `Recipient_emailId_status_idx` ON `Recipient`(`emailId`, `status`);

-- CreateIndex
CREATE UNIQUE INDEX `Sender_userId_fromAddress_key` ON `Sender`(`userId`, `fromAddress`);


-- Restore Sender to User relation
ALTER TABLE `Sender`
ADD CONSTRAINT `Sender_userId_fkey`
FOREIGN KEY (`userId`) REFERENCES `User`(`id`)
ON DELETE CASCADE ON UPDATE CASCADE;
