  device.status = status;
        device.toggle.checked = status === "ON";
        device.card.classList.toggle("home-off", status !== "ON");

        if (status === action) {
          device.note.textContent = "";
          return;
        } 
    device.note.textContent =
        "Chưa xác nhận được trạng thái thiết bị. Vui lòng thử lại."; 


        finally {
      device.card.classList.remove("home-loading");
      device.toggle.disabled = false;