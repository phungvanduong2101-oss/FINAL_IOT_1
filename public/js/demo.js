"use strict";

document.addEventListener("DOMContentLoaded", () => {
    const random = (min, max) =>
        Math.round((min + Math.random() * (max - min)) * 10) / 10;

    function createChart(id, label, color, min, max, step, unit) {
        const chart = new Chart(document.getElementById(id), {
            type: "line",
            data: {
                labels: [],
                datasets: [{
                    label,
                    data: [],
                    borderColor: color,
                    backgroundColor: `${color}18`,
                    fill: true,
                    tension: 0.4,
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 4,
                }],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                animation: false,
                scales: {
                    x: {
                        ticks: {
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 10,
                        },
                    },
                    y: {
                        min,
                        max,
                        ticks: { stepSize: step },
                    },
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: context => `${context.parsed.y} ${unit}`,
                        },
                    },
                },
            },
        });

        return chart;
    }

    /* step là các mốc Y*/
    const sensors = [
        {
            chart: createChart(
                "tempChart", "Nhiệt độ", "#f44336", 5, 50, 5, "°C"
            ),
            valueId: "temp-value",
            min: 26,
            max: 33,
            unit: "°C",
        },
        {
            chart: createChart(
                "humidChart", "Độ ẩm", "#2196F3", 0, 100, 10, "%"
            ),
            valueId: "humid-value",
            min: 55,
            max: 80,
            unit: "%",
        },
        {
            chart: createChart(
                "lightChart", "Ánh sáng", "#FFC107", 0, 1000, 100, "LX"
            ),
            valueId: "light-value",
            min: 200,
            max: 800,
            unit: " LX",
        },
    ];

    function addPoint(sensor, time) {
        const value = sensor.valueId === "light-value"
            ? Math.round(random(sensor.min, sensor.max))
            : random(sensor.min, sensor.max);
        const chart = sensor.chart;

        chart.data.labels.push(
            new Date(time).toLocaleTimeString("vi-VN")
        );
        chart.data.datasets[0].data.push(value);

        while (chart.data.labels.length > 10) {
            chart.data.labels.shift();
            chart.data.datasets[0].data.shift();
        }

        document.getElementById(sensor.valueId).textContent =
            `${value}${sensor.unit}`;
    }

    // Vẽ sẵn 10 điểm.
    const now = Date.now();

    for (const sensor of sensors) {
        for (let i = 9; i >= 0; i--) {
            addPoint(sensor, now - i * 2000);
        }

        sensor.chart.update("none");
    }

    // Thêm dữ liệu giả mỗi 2 giây.
    setInterval(() => {
        for (const sensor of sensors) {
            addPoint(sensor, Date.now());
            sensor.chart.update("none");
        }
    }, 2000);

    // Demo bật/tắt thiết bị.
    for (const key of ["fan", "ac", "light"]) {
        const toggle = document.getElementById(`${key}-toggle`);
        const card = document.getElementById(`device-${key}`);

        let isOn = false;
        let busy = false;
        let noteTimer;

        const note = document.createElement("p");
        note.className = "home-loading-text";
        card.append(note);

        toggle.checked = false;
        toggle.disabled = false;
        card.classList.add("home-off");
        card.classList.remove("home-loading");

        toggle.addEventListener("change", () => {
            if (busy) return;

            const nextState = toggle.checked;

            clearTimeout(noteTimer);
            busy = true;

            // Giữ trạng thái cũ trong lúc chờ.
            toggle.checked = isOn;
            toggle.disabled = true;
            card.classList.add("home-loading");
            note.textContent = "Đang chờ thiết bị...";

            setTimeout(() => {
                isOn = nextState;
                toggle.checked = isOn;
                toggle.disabled = false;

                if (!isOn) {
                    card.classList.add("home-off");
                } else {
                    card.classList.remove("home-off");
                }
                card.classList.remove("home-loading");

                note.textContent = "Điều khiển thành công!";
                busy = false;

                noteTimer = setTimeout(() => {
                    note.textContent = "";
                }, 3000);
            }, 1500);
        });
    }
});