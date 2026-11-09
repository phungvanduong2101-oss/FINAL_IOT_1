# Final-IOT — giám sát khí mô phỏng

Mở rộng từ repo Final-IOT, commit 861d010. Giữ dashboard cảm biến thật và các chức năng điều khiển cũ. Trang mới: **/gas-dashboard** (GAS ALERTS trên navbar).

## 1. Cài đặt

Yêu cầu Node.js 20+, MySQL 8, MQTT broker hỗ trợ retained message, ESP32 và Arduino IDE.

1. Chọn database hiện có trong MySQL Workbench và chạy `sql/setup.sql`. Với database mới, tạo database `iot`, chọn nó rồi chạy script.
2. Copy `.env.example` thành `.env`, điền thông tin MySQL và broker. Chạy `npm ci`, sau đó `npm start` (hoặc `npm run dev`).
3. Mở http://localhost:3000 và http://localhost:3000/gas-dashboard.
4. Arduino IDE: cài board ESP32, thư viện PubSubClient, ArduinoJson **7**, DHT sensor library và Adafruit Unified Sensor. Mở `firmware/default/default.ino`, điền Wi-Fi, MQTT host/port/user/password và nạp board.
5. ESP32 và backend phải truy cập cùng broker. `localhost` trong .env chỉ hợp lệ nếu broker chạy trên máy backend; firmware phải dùng IP/hostname broker có thể truy cập từ Wi-Fi.

Không đưa mật khẩu thật vào source được chia sẻ. Firmware xuất ra dùng placeholder cho Wi-Fi và tài khoản MQTT.

## 2. Database

`sql/setup.sql` có đủ CREATE TABLE cho 4 bảng gốc và 2 bảng mới. Dữ liệu gốc suy ra từ Sequelize model, **không phải bản backup database đang chạy của bạn**. Script không DROP/TRUNCATE/ghi đè các dòng đã có. Không cần ALTER vì không thay đổi cột bảng cũ. Chạy script tuần tự, không chạy đồng thời nhiều phiên.

Bảng thực tế là `sensors`; có `id`, `name`, `type`, không có cột đơn vị/phân loại ảo. Vì vậy tên cảm biến có chữ `(ảo)`; đơn vị được khai báo ở backend. DHT11 là một sensor cung cấp hai phép đo, nên ba phép đo thật tương ứng hai dòng sensor (ID 1, 2).

SQL chỉ thêm các ID thiết bị/cảm biến cũ còn thiếu theo quy ước firmware gốc. Nếu database đã có ID đó với ý nghĩa khác, cần kiểm tra trước khi chạy; script không ghi đè. Các ID khí và LED cảnh báo được cấp tự động, liên kết bằng FK. Script chạy lại không thêm trùng các dòng seed. Nếu đã tự tạo bảng `alert_device`/`alert_history` có schema khác, đối chiếu trước; CREATE IF NOT EXISTS không tự chuyển đổi schema tùy biến.

Không có INSERT lịch sử giả. Tổng cảnh báo = COUNT các dòng `alert_history` theo `alert_device_id`.

## 3. MQTT và GPIO

Giữ topic **sensors/data** và mảng `sensorsData` gốc. Bổ sung ba field số ở cấp gốc:

```json
{"sensorsData":[{"sensor_id":1,"temperature":30,"humidity":65},{"sensor_id":2,"light":2048}],"n2":81,"co2":1100,"ch4":600}
```

| Loại | GPIO | Quy ước |
|---|---|---|
| DHT11 | 22 | Giữ nguyên |
| Ánh sáng | 34 | ADC thô, backend quy đổi như cũ |
| Thiết bị cũ | 2 / 5 / 23 | Quạt / điều hòa / đèn |
| LED khí | 18 / 19 / 21 | N2 / CO2 / CH4 |

Nối mỗi LED cảnh báo qua điện trở hạn dòng, cực âm về GND; firmware dùng HIGH để bật. Ba GPIO mới không trùng các chân cũ.

- `alert/config`: backend publish retained JSON `[{"id":41,"gpio":18},...]`, lấy từ database.
- `alert/{id}/blink`: payload `1` hoặc `0`, retained và QoS 1 ở phía backend.
- ESP32 đăng ký `alert/+/blink`, nhận cấu hình rồi đăng ký lại từng topic cụ thể để lấy retained state đúng ánh xạ. ID không bị hardcode.
- Backend đồng bộ cấu hình và trạng thái khi MQTT connect/reconnect; ESP32 nhận lại retained message khi reconnect. Broker phải cho phép các topic `alert/#`; bật persistence của broker nếu muốn giữ retained qua lần restart broker.
- Các topic `device/...` cũ không đổi. Cơ chế reset trạng thái thiết bị cũ về OFF khi backend reconnect vẫn là hành vi từ repo gốc; LED khí có cơ chế khôi phục riêng từ DB.

## 4. Ngưỡng và lịch sử

Sửa `ALERT_THRESHOLDS` tại `services/alert.service.js`: N2 > 80 %, CO2 > 1000 ppm, CH4 > 500 ppm. Đây chỉ là ngưỡng mô phỏng, không phải ngưỡng an toàn khí thực tế.

ESP32 random độc lập: N2 75–85 %, CO2 600–1400 ppm, CH4 100–900 ppm; mỗi 2 giây theo chu kỳ gốc. Blink dùng millis(), 500 ms đổi mức một lần. Kết nối lại MQTT được thử theo thời gian thay vì vòng while có delay; kết nối TCP đồng bộ vẫn có thể gây trễ ngắn khi broker không truy cập được.

Backend xử lý MQTT tuần tự; khóa dòng LED trong transaction trước khi xét chuyển trạng thái. Lưu phép đo khí mỗi gói hợp lệ để khôi phục biểu đồ. Chỉ sửa trạng thái LED và lịch sử khi đổi trạng thái; phát MQTT/Socket mỗi lần đo hợp lệ. Field thiếu, null, chuỗi, NaN hoặc số âm bị bỏ qua, không tự tắt cảnh báo; N2 > 100 cũng bị bỏ qua.

`GET /api/gas-dashboard` trả snapshot, 10 phép đo mới nhất từng khí, ngưỡng, đơn vị và tổng cảnh báo. Socket `alert:status` cập nhật biểu đồ, đèn và bộ đếm. Frontend không so sánh ngưỡng để điều khiển đèn. Khi reconnect web, tải lại snapshot và xử lý các sự kiện đang chờ. Snapshot biểu thị trạng thái backend ra lệnh, không phải xác nhận vật lý rằng LED đã sáng.

## 5. Kiểm thử

Chạy từ thư mục project:

```sh
node --test tests/alerts.test.js
```

Đã chạy 3 nhóm kiểm thử service với database/MQTT/Socket giả lập: từng khí ở ngưỡng, vượt liên tiếp, trở về bình thường, đợt thứ hai; cả ba khí cùng cảnh báo; dữ liệu không hợp lệ; reload snapshot; nạp lại service dùng trạng thái đã lưu; đồng bộ retained với ID khác 1/2/3. Tất cả pass. Đây là unit test, không phải kiểm thử MySQL/broker thật.

Đã cài dependencies, kiểm tra cú pháp các file JS mới/chỉnh sửa và render toàn bộ 5 trang Pug. `public/js/test.js` là đoạn code dang dở có lỗi cú pháp từ repo gốc, được giữ nguyên và không được trang nào nạp. Không dùng file đó làm test runner.

Chưa chạy MySQL thực, broker thực, biên dịch bằng Arduino toolchain hoặc thử ESP32 vật lý trong môi trường này.

Kiểm thử thủ công sau khi import SQL:

1. Dừng ESP32 publish tạm để không trộn mẫu random. Dùng MQTT Explorer gửi JSON trên vào `sensors/data`.
2. CO2 lần lượt 800 → 1100 → 1200 → 1150 → 900 → 1300: tổng đợt phải là 0 → 1 → 1 → 1 → 1 → 2 trên database mới. Nếu đã có lịch sử, so phần tăng thêm.
3. Lặp tương tự cho N2 quanh 80 và CH4 quanh 500; thử cả ba vượt đồng thời.
4. Gửi thiếu field CO2 hoặc `"co2":null`: trạng thái CO2 không tự trở về normal.
5. Mở hai tab, F5, khởi động lại backend: tổng lịch sử không tăng chỉ vì mở trang/restart.
6. Ngắt/nối lại broker và ESP32; kiểm tra cấu hình retained rồi trạng thái từng LED. Đèn ngừng nháy và tắt khi nhận 0.
7. Kiểm tra dashboard cũ, bật/tắt ba thiết bị cũ, tìm kiếm dữ liệu/lịch sử. Các phép đo khí cũng được lưu trong sensor_data nên tìm theo ALL có thể thấy chúng; dashboard gốc vẫn chỉ vẽ ba phép đo thật.

## 6. File bổ sung/thay đổi

- Mới: models/alert-device.model.js, models/alert-history.model.js, services/alert.service.js.
- Mới: views/gas-dashboard.pug, public/css/gas-dashboard.css, public/js/gas-dashboard.js.
- Mới: sql/setup.sql, firmware/default/default.ino, .env.example, tests/alerts.test.js, README.md, package-lock.json.
- Sửa: config/mqtt.js, routes/api.route.js, routes/web.route.js, views/partials/navbar.pug.
- Giữ toàn bộ file gốc; ZIP không chứa .git, node_modules hoặc .env thật.

## Thống kê hàng 3 theo ngày
Hàng 3 thay tổng tích lũy bằng số đợt bắt đầu trong ngày được chọn (mặc định hôm nay), dùng `GET /api/alerts/daily?date=YYYY-MM-DD`. Tính theo `started_at`, khoảng [00:00, 00:00 hôm sau) theo UTC+7; một đợt kéo dài qua đêm chỉ tính ở ngày bắt đầu. Ngày không có cảnh báo trả 0. Hai hàng biểu đồ và LED vẫn hiển thị realtime. Firmware hiện dùng random trực tiếp. Không cần đổi schema hoặc import lại SQL.

## Controller và MQTT
Đã bỏ services/alert.service.js. Hai route API dùng controllers/alert.controller.js. Xử lý ngưỡng, lịch sử, phát Socket và MQTT nằm trong config/mqtt.js. config/alert.js chỉ chứa ngưỡng và đơn vị dùng chung. Giữ nguyên logic repo hiện tại: tạo lịch sử khi bắt đầu, cập nhật resolved khi kết thúc.
