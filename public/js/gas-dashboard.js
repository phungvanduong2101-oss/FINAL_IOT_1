"use strict";

(() => {
  // ==========================================
  // PHẦN 1: DASHBOARD
  // ==========================================

  const gases = ["n2", "co2", "ch4"];
  const charts = {};

  const message = document.getElementById("gas-message");
  const dateInput = document.getElementById("alert-date");
  const dailyMessage = document.getElementById("daily-message");

  // =========================
  // KHỞI TẠO BIỂU ĐỒ
  // =========================

  for (const gas of gases) {
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

  // =========================
  // CẬP NHẬT BIỂU ĐỒ VÀ LED
  // =========================

  function update(d, initial = false) {
    const chart = charts[d.sensor];

    if (!chart) return;

    document.getElementById(`${d.sensor}-value`).textContent =
      `${d.value ?? "--"} ${d.unit ?? ""}`;

    document.getElementById(`${d.sensor}-status`).textContent =
      d.status === "alert" ? "Cảnh báo" : "Bình thường";

    document.getElementById(`${d.sensor}-led`).classList.toggle(
      "blink",
      Boolean(d.isBlinking)
    );

    if (initial) {
      chart.data.labels = [];

      chart.data.datasets.forEach(dataset => {
        dataset.data = [];
      });
    }

    const records = initial ? (d.records ?? []) : [d.record];

    for (const row of records) {
      if (!row) continue;

      chart.data.labels.push(
        new Date(row.created_at).toLocaleTimeString("vi-VN", {
          timeZone: "Asia/Ho_Chi_Minh",
          hourCycle: "h23",
        })
      );

      chart.data.datasets[0].data.push(row.value);
      chart.data.datasets[1].data.push(d.threshold);

      while (chart.data.labels.length > 5) {
        chart.data.labels.shift();

        chart.data.datasets.forEach(dataset => {
          dataset.data.shift();
        });
      }
    }

    chart.update();
  }

  // =========================
  // THỐNG KÊ THEO NGÀY
  // =========================

  function today() {
    const parts = {};

    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });

    for (const part of formatter.formatToParts(new Date())) {
      parts[part.type] = part.value;
    }

    return `${parts.year}-${parts.month}-${parts.day}`;
  }

  dateInput.value = today();

  let countGeneration = 0;

  async function loadCounts() {
    const current = ++countGeneration;
    const day = dateInput.value;

    try {
      const response = await fetch(
        `/api/alerts/daily?date=${encodeURIComponent(day)}`,
        {
          signal: AbortSignal.timeout(10000),
        }
      );

      const result = await response.json();

      if (current !== countGeneration) return;

      if (!response.ok) {
        throw new Error(
          result.message || "Không tải được thống kê."
        );
      }

      const counts = {
        n2: 0,
        co2: 0,
        ch4: 0,
      };

      for (const item of result.data) {
        if (item.sensor === "n2") {
          counts.n2 = item.count;
        } else if (item.sensor === "co2") {
          counts.co2 = item.count;
        } else if (item.sensor === "ch4") {
          counts.ch4 = item.count;
        }
      }

      for (const gas of gases) {
        document.getElementById(`${gas}-count`).textContent =
          counts[gas];
      }

      dailyMessage.textContent = "";
    } catch (error) {
      if (current === countGeneration) {
        dailyMessage.textContent = error.message;
      }
    }
  }

  dateInput.addEventListener("change", () => {
    dailyMessage.textContent = "";

    for (const gas of gases) {
      document.getElementById(`${gas}-count`).textContent = "--";
    }

    loadCounts();
  });

  loadCounts();

  // =========================
  // SOCKET.IO — REALTIME
  // =========================

  const socket = io();

  let loading = true;
  let generation = 0;

  socket.on("alert:history-updated", () => {
    if (dateInput.value === today()) {
      loadCounts();
    }
  });
  socket.on("alert:status", d => {
    if (loading) return;
    update(d);
    message.textContent = "Đang nhận dữ liệu trực tiếp";
  });

  socket.on("connect", async () => {
    loadCounts();

    const current = ++generation;
    loading = true;

    message.textContent = "Đang tải dữ liệu ban đầu…";

    try {
      const response = await fetch("/api/gas-dashboard", {
        signal: AbortSignal.timeout(10000),
      });

      const result = await response.json();

      if (current !== generation) return;

      if (!response.ok || result.code !== "success") {
        throw new Error(
          result.message || "Không tải được dashboard."
        );
      }

      result.data.forEach(d => {
        update(d, true);
      });

      message.textContent =
        "Đã tải dữ liệu — đang chờ cập nhật trực tiếp";
    } catch (error) {
      if (current !== generation) return;

      message.textContent =
        `${error.message} Đang chờ dữ liệu trực tiếp.`;
    } finally {
      if (current === generation) {
        loading = false;
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

  // ==========================================
  // PHẦN 2: POPUP LỊCH SỬ CẢNH BÁO
  // ==========================================

  const modal = document.getElementById("alert-detail-modal");
  const openButton = document.getElementById("alert-detail-open");
  const closeButton = document.getElementById("alert-detail-close");

  const modalGas = document.getElementById("alert-detail-gas");
  const modalSearch = document.getElementById("alert-detail-search");
  const modalRefresh = document.getElementById("alert-detail-refresh");
  const modalSort = document.getElementById("alert-detail-sort");
  const modalItems = document.getElementById("alert-detail-items");

  const modalBody = document.getElementById("alert-detail-body");
  const modalSummary = document.getElementById("alert-detail-summary");
  const modalPagination = document.getElementById(
    "alert-detail-pagination"
  );

  let alertController;
  let alertPage = 1;
  let searchTimer;

  // =========================
  // ĐỊNH DẠNG THỜI GIAN
  // =========================

  const alertTimeFormatter = new Intl.DateTimeFormat("vi-VN", {
    timeZone: "Asia/Ho_Chi_Minh",
    day: "numeric",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  function formatAlertTime(value) {
    const date = new Date(value);

    if (Number.isNaN(date.getTime())) return "—";

    const parts = {};

    for (const part of alertTimeFormatter.formatToParts(date)) {
      parts[part.type] = part.value;
    }

    return (
      `${Number(parts.day)}/${parts.month}/${parts.year} ` +
      `${parts.hour}:${parts.minute}:${parts.second}`
    );
  }

  // =========================
  // ĐẶT LẠI BỘ LỌC
  // =========================

  function setDefaultAlertSearch() {
    if (!dateInput.value) {
      modalSearch.value = "";
      return;
    }

    const [year, month, day] = dateInput.value.split("-");
    modalSearch.value = `${Number(day)}/${month}/${year} `;
  }

  function resetAlertFilters() {
    alertPage = 1;
    modalGas.value = "ALL";
    modalSort.value = "DESC";
    modalItems.value = "10";

    setDefaultAlertSearch();
  }

  // =========================
  // THÔNG BÁO VÀ HỦY REQUEST
  // =========================

  function showAlertMessage(text) {
    const tr = document.createElement("tr");
    const td = document.createElement("td");

    td.colSpan = 5;
    td.className = "alert-detail-empty";
    td.textContent = text;

    tr.append(td);
    modalBody.replaceChildren(tr);
  }

  function cancelAlertRequest() {
    clearTimeout(searchTimer);
    alertController?.abort();
    alertController = null;

    modalBody.removeAttribute("aria-busy");
  }

  // =========================
  // PHÂN TRANG
  // =========================

  function renderAlertPagination(currentPage, totalPages) {
    const fragment = document.createDocumentFragment();

    function addButton(text, page, disabled = false) {
      const button = document.createElement("button");

      button.type = "button";
      button.textContent = text;
      button.className = "alert-detail-page-button";
      button.disabled = disabled;

      if (text === "...") {
        button.classList.add("alert-detail-page-dots");
      }

      if (text === String(page) && page === currentPage) {
        button.classList.add("active");
        button.setAttribute("aria-current", "page");
      }

      button.addEventListener("click", () => {
        clearTimeout(searchTimer);
        alertPage = page;
        loadAlert();
      });

      fragment.append(button);
    }

    if (totalPages > 1) {
      addButton("<", currentPage - 1, currentPage <= 1);

      const pages = [...new Set([
        1,
        currentPage - 1,
        currentPage,
        currentPage + 1,
        totalPages,
      ])]
        .filter(page => page >= 1 && page <= totalPages)
        .sort((a, b) => a - b);

      let previousPage = 0;

      for (const page of pages) {
        if (previousPage && page - previousPage > 1) {
          addButton("...", 0, true);
        }

        addButton(String(page), page);
        previousPage = page;
      }

      addButton(
        ">",
        currentPage + 1,
        currentPage >= totalPages
      );
    }

    modalPagination.replaceChildren(fragment);
  }

  // =========================
  // TẢI LỊCH SỬ
  // =========================

  async function loadAlert() {
    alertController?.abort();

    const controller = new AbortController();
    alertController = controller;

    // Giữ bảng và phân trang cũ trong lúc tải.
    modalBody.setAttribute("aria-busy", "true");

    const params = new URLSearchParams({
      search: modalSearch.value.trim(),
      sensor: modalGas.value,
      sort: modalSort.value,
      page: alertPage,
      items: modalItems.value,
    });

    const timeout = setTimeout(() => {
      controller.abort();
    }, 10000);

    try {
      const response = await fetch(
        `/api/alerts/history?${params}`,
        {
          signal: controller.signal,
        }
      );

      const result = await response.json();

      if (controller !== alertController || !modal.open) return;

      if (!response.ok || result.code !== "success") {
        throw new Error(
          result.message || "Không tải được lịch sử."
        );
      }

      const fragment = document.createDocumentFragment();

      for (const row of result.data) {
        const gas = row.sensor.toUpperCase();
        const unit = row.sensor === "n2" ? "%" : "ppm";
        const tr = document.createElement("tr");

        const cells = [
          gas,
          `${row.threshold_value} ${unit}`,
          `${row.peak_value} ${unit}`,
          formatAlertTime(row.started_at),
          formatAlertTime(row.ended_at),
        ];

        cells.forEach((value, index) => {
          const td = document.createElement("td");
          td.textContent = value;

          if (index === 2) {
            td.className = "alert-detail-peak";
          }

          tr.append(td);
        });

        fragment.append(tr);
      }

      if (result.data.length > 0) {
        modalBody.replaceChildren(fragment);
      } else {
        showAlertMessage("Không có dữ liệu.");
      }

      alertPage = Number(result.currentPage);

      const skip = Number(result.skip);
      const total = Number(result.total);

      const start = result.data.length > 0
        ? skip + 1
        : 0;

      const end = result.data.length > 0
        ? skip + result.data.length
        : 0;

      modalSummary.textContent =
        `Hiển thị ${start}–${end} ` +
        `trên tổng số ${total} bản ghi.`;

      renderAlertPagination(
        alertPage,
        Number(result.totalPages)
      );
    } catch (error) {
      if (controller !== alertController || !modal.open) return;

      // Giữ bảng cũ khi gặp lỗi.
      modalSummary.textContent = controller.signal.aborted
        ? "Tải dữ liệu quá thời gian. Vui lòng thử lại."
        : error.message;
    } finally {
      clearTimeout(timeout);

      if (controller === alertController) {
        modalBody.removeAttribute("aria-busy");
      }
    }
  }

  function reloadAlertFromFirstPage() {
    clearTimeout(searchTimer);
    alertPage = 1;
    loadAlert();
  }

  // =========================
  // SỰ KIỆN POPUP
  // =========================

  if (
    modal &&
    openButton &&
    closeButton &&
    modalGas &&
    modalSearch &&
    modalRefresh &&
    modalSort &&
    modalItems &&
    modalBody &&
    modalSummary &&
    modalPagination
  ) {
    openButton.addEventListener("click", () => {
      cancelAlertRequest();
      resetAlertFilters();

      showAlertMessage("Đang tải lịch sử…");
      modalSummary.textContent = "";
      modalPagination.replaceChildren();

      modal.showModal();
      loadAlert();
    });

    closeButton.addEventListener("click", () => {
      modal.close();
    });

    modal.addEventListener("close", cancelAlertRequest);

    modalSearch.addEventListener("input", () => {
      cancelAlertRequest();
      alertPage = 1;

      searchTimer = setTimeout(() => {
        loadAlert();
      }, 200);
    });

    modalGas.addEventListener(
      "change",
      reloadAlertFromFirstPage
    );

    modalSort.addEventListener(
      "change",
      reloadAlertFromFirstPage
    );

    modalItems.addEventListener(
      "change",
      reloadAlertFromFirstPage
    );

    modalRefresh.addEventListener("click", () => {
      clearTimeout(searchTimer);
      resetAlertFilters();
      loadAlert();
    });
  }
})();