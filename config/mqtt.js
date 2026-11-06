const mqtt = require("mqtt");
const { SensorData } = require("../models");
const { Device } = require("../models");
const { ActionHistory } = require("../models");
const { getIO } = require("./socket");

const alerts = require("../services/alert.service");
let queue = Promise.resolve();
const client = mqtt.connect(process.env.MQTT_URL, {
    username: process.env.MQTT_USERNAME,
    password: process.env.MQTT_PASSWORD,
    reconnectPeriod: 3000,
    connectTimeout: 10000,
});

client.on("connect", async () => {
    console.log("MQTT connected!");

    client.subscribe(
        ["sensors/data", "device/status"],
        (error) => {
            if (error) {
                console.error("Subscribe failed:", error.message);
                return;
            }

            console.log("Subscribed: sensors/data, device/status");
        }
    );

    queue = queue.then(() => alerts.sync(client)).catch(e => console.error("Alert sync:", e.message));
    try {
        await Device.update(
            { current_status: "OFF" },
            { where: {} }
        )
    } catch (error) {
        console.error("MQTT message error:", error.message);
    }

});

async function handleMessage(topic, message) {
    try {

        const data = JSON.parse(message.toString());

        if (topic === "sensors/data") {
            const records = [];
            //console.log("Dữ liệu cảm biến:", data);

            for (const record of (Array.isArray(data.sensorsData) ? data.sensorsData : [])) {
                if (record.sensor_id === 1) {
                    records.push({
                        sensor_id: record.sensor_id,
                        measurement_type: 'Temperature',
                        value: Number(record.temperature).toFixed(1),
                        created_at: new Date()
                    });

                    records.push({
                        sensor_id: record.sensor_id,
                        measurement_type: 'Humidity',
                        value: Number(record.humidity).toFixed(1),
                        created_at: new Date()
                    });

                } else if (record.sensor_id === 2) {
                    const light = Math.round(((4095 - record.light) / 4095) * 1000);
                    records.push({
                        sensor_id: record.sensor_id,
                        measurement_type: 'Light',
                        value: light,
                        created_at: new Date()
                    });
                }

            }
            const savedRecords = await SensorData.bulkCreate(records);

            getIO().emit(
                "sensors:update",
                savedRecords.map(row => row.toJSON())
            );
            await alerts.processPacket(data, client);
        }

        if (topic === "device/status") {

            console.log(data);
            for (const device of data.devicesState) {
                if (device.status == 'SUCCESS') {
                    await Device.update(
                        { current_status: device.state },
                        { where: { id: device.device_id } }
                    )
                    await ActionHistory.update(
                        { status: device.status },
                        { where: { device_id: device.device_id, id: data.action_id } }
                    )
                } else if (device.status == 'FAILED') {
                    await ActionHistory.update(
                        { status: device.status },
                        { where: { device_id: device.device_id, id: data.action_id } }
                    )
                }
            } 
            getIO().emit(
                "devices:update",
                data.devicesState
            );
        }
    } catch (error) {
        console.error("MQTT message error:", error.message);
    }
}
client.on("message", (topic,message) => {
 queue = queue.then(() => handleMessage(topic,message)).catch(e => console.error(e));
});

client.on("reconnect", () => {
    //console.log("MQTT reconnecting...");
});

client.on("error", (error) => {
    //console.error("MQTT error:", error.message);
});

module.exports = client;