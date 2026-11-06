"use strict";

(() => {
  // =========================
  // BIỂU ĐỒ
  // =========================
  const charts = {};
  const message = document.getElementById("gas-message");

  for (const gas of ["n2", "co2", "ch4"]) {
    charts[gas] = new Chart(
      document.getElementById(`${gas}-chart`),
      {
        type: "line",
        data: {
          labels: [],
          datasets: [
            {
              label: gas.toUpperCase(),
              data: [],
              borderColor: "#2196f3",
              tension: 0.3,
            },
            {
              label: "Ngưỡng cảnh báo",
              data: [],
              borderColor: "#ef4444",
              borderDash: [5, 5],
              pointRadius: 0,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: false,
        },
      }
    );
  }

  function update(d, initial = false) {
    const c = charts[d.sensor];

    if (!c) return;

    document.getElementById(`${d.sensor}-value`).textContent =
      `${d.value ?? "--"} ${d.unit}`;

    document.getElementById(`${d.sensor}-status`).textContent =
      d.status === "alert" ? "Cảnh báo" : "Bình thường";

    document.getElementById(`${d.sensor}-led`).classList.toggle(
      "blink",
      Boolean(d.isBlinking)
    );

    if (initial) {
      c.data.labels = [];

      c.data.datasets.forEach(ds => {
        ds.data = [];
      });
    }

    for (const row of (initial ? d.records : [d.record])) {
      if (!row) continue;

      c.data.labels.push(
        new Date(row.created_at).toLocaleTimeString("vi-VN")
      );

      c.data.datasets[0].data.push(row.value);
      c.data.datasets[1].data.push(d.threshold);

      while (c.data.labels.length > 10) {
        c.data.labels.shift();

        c.data.datasets.forEach(ds => {
          ds.data.shift();
        });
      }
    }

    c.update();
  }

  // =========================
  // THỐNG KÊ THEO NGÀY
  // =========================
  const dateInput = document.getElementById("alert-date");
  const dailyMessage = document.getElementById("daily-message");

  const today = () =>
    new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date());

  dateInput.value = today();

  let countGeneration = 0;
  let countBusy = false;
  let countAgain = false;

  async function loadCounts() {
    const current = ++countGeneration;
    const day = dateInput.value;

    dailyMessage.textContent = "Đang tải…";

    for (const gas of ["n2", "co2", "ch4"]) {
      document.getElementById(`${gas}-count`).textContent = "--";
    }

    try {
      const response = await fetch(
        `/api/alerts/daily?date=${encodeURIComponent(day)}`,
        {
          signal: AbortSignal.timeout(10000),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message);
      }

      if (current !== countGeneration) return;

      for (const d of result.data) {
        document.getElementById(`${d.sensor}-count`).textContent =
          d.count;
      }

      dailyMessage.textContent =
        "";
    } catch (e) {
      if (current === countGeneration) {
        dailyMessage.textContent = e.message;
      }
    }
  }

  async function refreshCounts() {
    if (countBusy) {
      countAgain = true;
      return;
    }

    countBusy = true;

    do {
      countAgain = false;
      await loadCounts();
    } while (countAgain);

    countBusy = false;
  }

  dateInput.addEventListener("change", () => {
    countGeneration++;
    refreshCounts();
  });

  refreshCounts();

  // =========================
  // SOCKET.IO — CẬP NHẬT REALTIME
  // =========================
  const socket = io();

  let loading = true;
  let pending = [];
  let generation = 0;

  socket.on("alert:status", d => {
    if (dateInput.value === today()) {
      refreshCounts();
    }
  });

  socket.on("alert:status", d => {
    if (loading) {
      pending.push(d);
    } else {
      update(d);
    }
  });

  // =========================
  // SOCKET.IO — KẾT NỐI
  // =========================
  socket.on("connect", async () => {
    refreshCounts();

    const current = ++generation;

    loading = true;
    pending = [];

    try {
      const response = await fetch("/api/gas-dashboard", {
        signal: AbortSignal.timeout(10000),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message);
      }

      if (current !== generation) return;

      result.data.forEach(d => {
        update(d, true);
      });

      // Snapshot có thể đã chứa sự kiện nhận trong lúc chờ API.
      const latest = Object.fromEntries(
        result.data.map(d => [
          d.sensor,
          Number(d.records.at(-1)?.id || 0),
        ])
      );

      for (const d of pending) {
        if (Number(d.record.id) > latest[d.sensor]) {
          update(d);
        }
      }

      message.textContent = "Đang nhận dữ liệu trực tiếp";
    } catch (e) {
      message.textContent = e.message;

      pending.forEach(d => {
        update(d);
      });
    } finally {
      if (current === generation) {
        loading = false;
        pending = [];
      }
    }
  });

  socket.on("disconnect", () => {
    generation++;
    loading = true;

    message.textContent =
      "Mất kết nối — trạng thái hiển thị là dữ liệu cuối cùng.";
  });

  socket.on("connect_error", () => {
    message.textContent = "Không kết nối được máy chủ.";
  });
})();