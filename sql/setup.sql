-- MySQL Workbench Forward Engineering

SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0;
SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0;
SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='ONLY_FULL_GROUP_BY,STRICT_TRANS_TABLES,NO_ZERO_IN_DATE,NO_ZERO_DATE,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION';

-- -----------------------------------------------------
-- Schema mydb
-- -----------------------------------------------------
-- -----------------------------------------------------
-- Schema project_iot_3
-- -----------------------------------------------------

-- -----------------------------------------------------
-- Schema project_iot_3
-- -----------------------------------------------------
CREATE SCHEMA IF NOT EXISTS `project_iot_3` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci ;
USE `project_iot_3` ;

-- -----------------------------------------------------
-- Table `project_iot_3`.`devices`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `project_iot_3`.`devices` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `current_status` VARCHAR(10) NOT NULL DEFAULT 'OFF',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`))
ENGINE = InnoDB
AUTO_INCREMENT = 4
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_unicode_ci;


-- -----------------------------------------------------
-- Table `project_iot_3`.`action_history`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `project_iot_3`.`action_history` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `device_id` INT NOT NULL,
  `action` VARCHAR(10) NOT NULL,
  `status` VARCHAR(20) NOT NULL DEFAULT 'WAITING',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `device_time` (`device_id` ASC, `created_at` ASC) VISIBLE,
  CONSTRAINT `action_history_ibfk_1`
    FOREIGN KEY (`device_id`)
    REFERENCES `project_iot_3`.`devices` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_unicode_ci;


-- -----------------------------------------------------
-- Table `project_iot_3`.`sensors`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `project_iot_3`.`sensors` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `name` VARCHAR(100) NOT NULL,
  `type` VARCHAR(50) NOT NULL,
  PRIMARY KEY (`id`))
ENGINE = InnoDB
AUTO_INCREMENT = 6
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_unicode_ci;


-- -----------------------------------------------------
-- Table `project_iot_3`.`alert_device`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `project_iot_3`.`alert_device` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `sensor_id` INT NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `sensor_type` VARCHAR(10) NOT NULL,
  `is_blinking` TINYINT(1) NOT NULL DEFAULT '0',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE INDEX `unique_sensor_type` (`sensor_type` ASC) VISIBLE,
  INDEX `sensor_id` (`sensor_id` ASC) VISIBLE,
  CONSTRAINT `alert_device_ibfk_1`
    FOREIGN KEY (`sensor_id`)
    REFERENCES `project_iot_3`.`sensors` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE)
ENGINE = InnoDB
AUTO_INCREMENT = 4
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_unicode_ci;


-- -----------------------------------------------------
-- Table `project_iot_3`.`alert_history`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `project_iot_3`.`alert_history` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `alert_device_id` INT NOT NULL,
  `threshold_value` FLOAT NOT NULL,
  `peak_value` FLOAT NOT NULL,
  `started_at` DATETIME NOT NULL,
  `ended_at` DATETIME NOT NULL,
  PRIMARY KEY (`id`),
  INDEX `device_started` (`alert_device_id` ASC, `started_at` ASC) VISIBLE,
  INDEX `started_at` (`started_at` ASC) VISIBLE,
  CONSTRAINT `alert_history_ibfk_1`
    FOREIGN KEY (`alert_device_id`)
    REFERENCES `project_iot_3`.`alert_device` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_unicode_ci;


-- -----------------------------------------------------
-- Table `project_iot_3`.`sensor_data`
-- -----------------------------------------------------
CREATE TABLE IF NOT EXISTS `project_iot_3`.`sensor_data` (
  `id` BIGINT NOT NULL AUTO_INCREMENT,
  `sensor_id` INT NOT NULL,
  `value` FLOAT NOT NULL,
  `measurement_type` VARCHAR(30) NOT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `sensor_time` (`sensor_id` ASC, `created_at` ASC) VISIBLE,
  CONSTRAINT `sensor_data_ibfk_1`
    FOREIGN KEY (`sensor_id`)
    REFERENCES `project_iot_3`.`sensors` (`id`)
    ON DELETE RESTRICT
    ON UPDATE CASCADE)
ENGINE = InnoDB
DEFAULT CHARACTER SET = utf8mb4
COLLATE = utf8mb4_unicode_ci;


SET SQL_MODE=@OLD_SQL_MODE;
SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS;
SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS;
