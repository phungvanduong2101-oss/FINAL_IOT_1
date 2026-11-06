-- Select your existing database in MySQL Workbench before running this script.
-- New database example: CREATE DATABASE iot CHARACTER SET utf8mb4; USE iot;
-- No DROP, TRUNCATE or replacement of existing rows.
CREATE TABLE IF NOT EXISTS sensors (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, name VARCHAR(100) NOT NULL, type VARCHAR(50) NOT NULL
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS devices (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,name VARCHAR(100) NOT NULL,
 current_status VARCHAR(10) NOT NULL DEFAULT 'OFF',created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS sensor_data (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,sensor_id INT NOT NULL,value FLOAT NOT NULL,
 measurement_type VARCHAR(30) NOT NULL,created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(sensor_id) REFERENCES sensors(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 INDEX sensor_time(sensor_id,created_at)
) ENGINE=InnoDB;
CREATE TABLE IF NOT EXISTS action_history (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,device_id INT NOT NULL,action VARCHAR(10) NOT NULL,
 status VARCHAR(20) NOT NULL DEFAULT 'WAITING',created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(device_id) REFERENCES devices(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;
-- Original firmware maps sensor 1 to DHT11 and sensor 2 to Light.
INSERT INTO sensors(id,name,type) SELECT 1,'DHT11','DHT11' WHERE NOT EXISTS(SELECT 1 FROM sensors WHERE id=1);
INSERT INTO sensors(id,name,type) SELECT 2,'Ánh sáng','LDR' WHERE NOT EXISTS(SELECT 1 FROM sensors WHERE id=2);
INSERT INTO devices(id,name) SELECT 1,'Quạt' WHERE NOT EXISTS(SELECT 1 FROM devices WHERE id=1);
INSERT INTO devices(id,name) SELECT 2,'Điều hòa' WHERE NOT EXISTS(SELECT 1 FROM devices WHERE id=2);
INSERT INTO devices(id,name) SELECT 3,'Đèn' WHERE NOT EXISTS(SELECT 1 FROM devices WHERE id=3);
-- Existing schema has no unit or virtual flag: identify virtual sensors by name/type.
INSERT INTO sensors(name,type) SELECT 'Khí Nitơ (ảo)','N2' WHERE NOT EXISTS(SELECT 1 FROM sensors WHERE type='N2');
INSERT INTO sensors(name,type) SELECT 'Khí Carbon Dioxide (ảo)','CO2' WHERE NOT EXISTS(SELECT 1 FROM sensors WHERE type='CO2');
INSERT INTO sensors(name,type) SELECT 'Khí Methane (ảo)','CH4' WHERE NOT EXISTS(SELECT 1 FROM sensors WHERE type='CH4');
CREATE TABLE IF NOT EXISTS alert_device (
 id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,sensor_id INT NOT NULL,
 name VARCHAR(100) NOT NULL,sensor_type VARCHAR(10) NOT NULL UNIQUE,gpio_pin INT NOT NULL UNIQUE,
 status VARCHAR(10) NOT NULL DEFAULT 'normal',is_blinking BOOLEAN NOT NULL DEFAULT FALSE,
 updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY(sensor_id) REFERENCES sensors(id) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB;
INSERT INTO alert_device(sensor_id,name,sensor_type,gpio_pin)
 SELECT MIN(id),'LED N2','N2',18 FROM sensors WHERE type='N2'
 HAVING COUNT(*)>0 AND NOT EXISTS(SELECT 1 FROM alert_device WHERE sensor_type='N2');
INSERT INTO alert_device(sensor_id,name,sensor_type,gpio_pin)
 SELECT MIN(id),'LED CO2','CO2',19 FROM sensors WHERE type='CO2'
 HAVING COUNT(*)>0 AND NOT EXISTS(SELECT 1 FROM alert_device WHERE sensor_type='CO2');
INSERT INTO alert_device(sensor_id,name,sensor_type,gpio_pin)
 SELECT MIN(id),'LED CH4','CH4',21 FROM sensors WHERE type='CH4'
 HAVING COUNT(*)>0 AND NOT EXISTS(SELECT 1 FROM alert_device WHERE sensor_type='CH4');
CREATE TABLE IF NOT EXISTS alert_history (
 id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,alert_device_id INT NOT NULL,
 sensor_value FLOAT NOT NULL,threshold_value FLOAT NOT NULL,started_at DATETIME NOT NULL,
 ended_at DATETIME NULL,status VARCHAR(10) NOT NULL DEFAULT 'active',
 FOREIGN KEY(alert_device_id) REFERENCES alert_device(id) ON DELETE RESTRICT ON UPDATE CASCADE,
 INDEX device_status(alert_device_id,status)
) ENGINE=InnoDB;
