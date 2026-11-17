CREATE TABLE `appSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`settingKey` varchar(120) NOT NULL,
	`value` json,
	`updatedBy` int,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `appSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `appSettings_settingKey_unique` UNIQUE(`settingKey`)
);
--> statement-breakpoint
CREATE TABLE `auditLogs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`actorId` int,
	`branchId` int,
	`action` varchar(64) NOT NULL,
	`entityType` varchar(64) NOT NULL,
	`entityId` varchar(128),
	`idempotencyKey` varchar(128),
	`details` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `auditLogs_id` PRIMARY KEY(`id`),
	CONSTRAINT `auditLogs_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `branches` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branchCode` varchar(64) NOT NULL,
	`name` varchar(180) NOT NULL,
	`city` varchar(100),
	`address` text,
	`serviceType` text,
	`phone` varchar(32),
	`latitude` double,
	`longitude` double,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `branches_id` PRIMARY KEY(`id`),
	CONSTRAINT `branches_branchCode_unique` UNIQUE(`branchCode`)
);
--> statement-breakpoint
CREATE TABLE `cashBoxes` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branchId` int NOT NULL,
	`name` varchar(100) NOT NULL,
	`balance` int NOT NULL DEFAULT 0,
	`isActive` boolean NOT NULL DEFAULT true,
	CONSTRAINT `cashBoxes_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `categories` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sourceKey` varchar(100) NOT NULL,
	`name` varchar(180) NOT NULL,
	`sortOrder` int NOT NULL DEFAULT 0,
	`station` varchar(64),
	`isActive` boolean NOT NULL DEFAULT true,
	CONSTRAINT `categories_id` PRIMARY KEY(`id`),
	CONSTRAINT `categories_sourceKey_unique` UNIQUE(`sourceKey`)
);
--> statement-breakpoint
CREATE TABLE `driverLocations` (
	`id` int AUTO_INCREMENT NOT NULL,
	`driverId` int NOT NULL,
	`branchId` int,
	`latitude` double NOT NULL,
	`longitude` double NOT NULL,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `driverLocations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `expenses` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branchId` int NOT NULL,
	`shiftId` int,
	`userId` int NOT NULL,
	`amount` int NOT NULL,
	`reason` text NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `expenses_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `inventoryItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branchId` int NOT NULL,
	`name` varchar(180) NOT NULL,
	`unit` varchar(32) NOT NULL,
	`quantity` decimal(14,3),
	`lowStockThreshold` decimal(14,3),
	`unitCost` int,
	`supplier` varchar(180),
	`replenishedAt` timestamp,
	`isActive` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `inventoryItems_id` PRIMARY KEY(`id`),
	CONSTRAINT `inventory_branch_name_uq` UNIQUE(`branchId`,`name`)
);
--> statement-breakpoint
CREATE TABLE `journalEntries` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branchId` int NOT NULL,
	`cashBoxId` int,
	`shiftId` int,
	`userId` int,
	`entryType` varchar(32) NOT NULL,
	`amount` int NOT NULL,
	`referenceType` varchar(40),
	`referenceId` int,
	`idempotencyKey` varchar(128),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `journalEntries_id` PRIMARY KEY(`id`),
	CONSTRAINT `journalEntries_idempotencyKey_unique` UNIQUE(`idempotencyKey`)
);
--> statement-breakpoint
CREATE TABLE `menuItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`sku` varchar(100) NOT NULL,
	`branchId` int NOT NULL,
	`categoryId` int NOT NULL,
	`inventoryItemId` int,
	`name` varchar(220) NOT NULL,
	`price` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'YER',
	`station` varchar(64),
	`stock` int,
	`isAvailable` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `menuItems_id` PRIMARY KEY(`id`),
	CONSTRAINT `menuItems_sku_unique` UNIQUE(`sku`)
);
--> statement-breakpoint
CREATE TABLE `orderItems` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`menuItemId` int NOT NULL,
	`itemName` varchar(220),
	`quantity` int NOT NULL,
	`unitPrice` int NOT NULL,
	`lineTotal` int NOT NULL,
	`kdsStatus` varchar(32) NOT NULL DEFAULT 'pending',
	`station` varchar(64),
	`assignedChefId` int,
	`assignedAt` timestamp,
	CONSTRAINT `orderItems_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `orders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`clientOrderId` varchar(128) NOT NULL,
	`userId` int NOT NULL,
	`branchId` int NOT NULL,
	`orderType` enum('delivery','pickup','dine_in') NOT NULL,
	`status` enum('pending','confirmed','preparing','ready','out_for_delivery','completed','cancelled') NOT NULL DEFAULT 'pending',
	`tableNumber` varchar(32),
	`deliveryDetails` json,
	`splitMetadata` json,
	`couponCode` varchar(64),
	`discountAmount` int NOT NULL DEFAULT 0,
	`deliveryFee` int NOT NULL DEFAULT 0,
	`loyaltyPointsRedeemed` int NOT NULL DEFAULT 0,
	`subtotal` int NOT NULL,
	`total` int NOT NULL,
	`currency` varchar(3) NOT NULL DEFAULT 'YER',
	`paymentMethod` varchar(32),
	`paymentStatus` varchar(32) NOT NULL DEFAULT 'unpaid',
	`driverId` int,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `orders_id` PRIMARY KEY(`id`),
	CONSTRAINT `orders_clientOrderId_unique` UNIQUE(`clientOrderId`)
);
--> statement-breakpoint
CREATE TABLE `promotions` (
	`id` int AUTO_INCREMENT NOT NULL,
	`branchId` int,
	`name` varchar(180) NOT NULL,
	`code` varchar(64),
	`description` text,
	`discountPercent` int,
	`discountAmount` int,
	`minimumOrder` int NOT NULL DEFAULT 0,
	`startsAt` timestamp,
	`endsAt` timestamp,
	`isActive` boolean NOT NULL DEFAULT false,
	CONSTRAINT `promotions_id` PRIMARY KEY(`id`),
	CONSTRAINT `promotions_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `returnOrders` (
	`id` int AUTO_INCREMENT NOT NULL,
	`orderId` int NOT NULL,
	`userId` int NOT NULL,
	`reason` text NOT NULL,
	`amount` int NOT NULL,
	`status` enum('requested','pending','approved','rejected','processed') NOT NULL DEFAULT 'requested',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `returnOrders_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `shifts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`branchId` int NOT NULL,
	`startedAt` timestamp NOT NULL DEFAULT (now()),
	`endedAt` timestamp,
	`openingCash` int,
	`closingCash` int,
	`notes` text,
	`status` varchar(20) NOT NULL DEFAULT 'open',
	CONSTRAINT `shifts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `openId` varchar(128);--> statement-breakpoint
ALTER TABLE `users` MODIFY COLUMN `role` enum('user','admin','manager','cashier','chef','waiter','driver','inventory','accountant','customer') NOT NULL DEFAULT 'user';--> statement-breakpoint
ALTER TABLE `users` ADD `phone` varchar(32);--> statement-breakpoint
ALTER TABLE `users` ADD `passwordHash` varchar(255);--> statement-breakpoint
ALTER TABLE `users` ADD `branchId` int;--> statement-breakpoint
ALTER TABLE `users` ADD `points` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `walletBalance` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `isAvailable` boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD `mustChangePassword` boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_phone_unique` UNIQUE(`phone`);--> statement-breakpoint
ALTER TABLE `appSettings` ADD CONSTRAINT `appSettings_updatedBy_users_id_fk` FOREIGN KEY (`updatedBy`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditLogs` ADD CONSTRAINT `auditLogs_actorId_users_id_fk` FOREIGN KEY (`actorId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `auditLogs` ADD CONSTRAINT `auditLogs_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `cashBoxes` ADD CONSTRAINT `cashBoxes_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `driverLocations` ADD CONSTRAINT `driverLocations_driverId_users_id_fk` FOREIGN KEY (`driverId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `driverLocations` ADD CONSTRAINT `driverLocations_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_shiftId_shifts_id_fk` FOREIGN KEY (`shiftId`) REFERENCES `shifts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `expenses` ADD CONSTRAINT `expenses_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `inventoryItems` ADD CONSTRAINT `inventoryItems_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `journalEntries` ADD CONSTRAINT `journalEntries_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `journalEntries` ADD CONSTRAINT `journalEntries_cashBoxId_cashBoxes_id_fk` FOREIGN KEY (`cashBoxId`) REFERENCES `cashBoxes`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `journalEntries` ADD CONSTRAINT `journalEntries_shiftId_shifts_id_fk` FOREIGN KEY (`shiftId`) REFERENCES `shifts`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `journalEntries` ADD CONSTRAINT `journalEntries_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `menuItems` ADD CONSTRAINT `menuItems_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `menuItems` ADD CONSTRAINT `menuItems_categoryId_categories_id_fk` FOREIGN KEY (`categoryId`) REFERENCES `categories`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `menuItems` ADD CONSTRAINT `menuItems_inventoryItemId_inventoryItems_id_fk` FOREIGN KEY (`inventoryItemId`) REFERENCES `inventoryItems`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orderItems` ADD CONSTRAINT `orderItems_orderId_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orderItems` ADD CONSTRAINT `orderItems_menuItemId_menuItems_id_fk` FOREIGN KEY (`menuItemId`) REFERENCES `menuItems`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orderItems` ADD CONSTRAINT `orderItems_assignedChefId_users_id_fk` FOREIGN KEY (`assignedChefId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `orders` ADD CONSTRAINT `orders_driverId_users_id_fk` FOREIGN KEY (`driverId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `promotions` ADD CONSTRAINT `promotions_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `returnOrders` ADD CONSTRAINT `returnOrders_orderId_orders_id_fk` FOREIGN KEY (`orderId`) REFERENCES `orders`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `returnOrders` ADD CONSTRAINT `returnOrders_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shifts` ADD CONSTRAINT `shifts_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `shifts` ADD CONSTRAINT `shifts_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `driver_location_latest_idx` ON `driverLocations` (`driverId`,`recordedAt`);--> statement-breakpoint
CREATE INDEX `menu_branch_category_idx` ON `menuItems` (`branchId`,`categoryId`);--> statement-breakpoint
CREATE INDEX `order_items_order_idx` ON `orderItems` (`orderId`);--> statement-breakpoint
CREATE INDEX `orders_branch_status_idx` ON `orders` (`branchId`,`status`);--> statement-breakpoint
CREATE INDEX `orders_user_idx` ON `orders` (`userId`);--> statement-breakpoint
CREATE INDEX `shift_open_idx` ON `shifts` (`branchId`,`status`);--> statement-breakpoint
ALTER TABLE `users` ADD CONSTRAINT `users_branchId_branches_id_fk` FOREIGN KEY (`branchId`) REFERENCES `branches`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `users_branch_role_idx` ON `users` (`branchId`,`role`);