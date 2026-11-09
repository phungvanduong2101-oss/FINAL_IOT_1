const express = require("express");
const router = express.Router();

const deviceController = require("../controllers/device.controller");
const sensorController = require("../controllers/sensor.controller");
const actionHistoryController = require("../controllers/action.controller");
const { requireAuth } = require("../middlewares/auth.middleware");

router.use(requireAuth);
/**
 * @openapi
 * /api/sensors-data/latest:
 *   get:
 *     tags:
 *     - Sensors
 *     summary: Lấy dữ liệu mới nhất của 3 cảm biến thật
 *     description: Mỗi loại Temperature, Humidity, Light tối đa 10 bản ghi; thời gian
 *       giảm dần rồi ID giảm dần. Không trả N2/CO2/CH4 ở endpoint này.
 *     operationId: getApiSensorsDataLatest
 *     responses:
 *       '200':
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: string
 *                   example: success
 *                 Temperature:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SensorData'
 *                 Humidity:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SensorData'
 *                 Light:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SensorData'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         description: Lỗi xử lý máy chủ; message theo controller.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 */
router.get(
  "/sensors-data/latest",
  sensorController.getSensorsDataLatest
);

/**
 * @openapi
 * /api/devices/status:
 *   get:
 *     tags:
 *     - Devices
 *     summary: Lấy trạng thái thiết bị
 *     description: Trả toàn bộ thiết bị trong CSDL, không bảo đảm thứ tự.
 *     operationId: getApiDevicesStatus
 *     responses:
 *       '200':
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Device'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         description: Lỗi xử lý máy chủ; message theo controller.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 */
router.get("/devices/status", deviceController.getDevicesStatus);

/**
 * @openapi
 * /api/devices/{id}/control:
 *   post:
 *     tags:
 *     - Devices
 *     summary: Gửi lệnh bật/tắt thiết bị
 *     description: Tạo lịch sử WAITING, publish device/{id}/command với action và action_id,
 *       retain=false. HTTP 200 chỉ xác nhận đã gửi lệnh MQTT. Chờ thiết bị xác nhận;
 *       quá 5 giây còn WAITING thì chuyển TIMEOUT. Publish lỗi chuyển FAILED.
 *     operationId: postApiDevicesIdControl
 *     responses:
 *       '200':
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: string
 *                   example: success
 *                 message:
 *                   type: string
 *                   example: Đã gửi lệnh, đang chờ thiết bị phản hồi.
 *                 action_id:
 *                   type: integer
 *                   example: 123
 *                   format: int64
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '400':
 *         description: Lệnh không hợp lệ.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *             example:
 *               message: Lệnh phải là ON hoặc OFF.
 *       '404':
 *         description: Không có thiết bị.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *             example:
 *               message: Không tìm thấy thiết bị.
 *       '503':
 *         description: MQTT chưa kết nối.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *             example:
 *               message: MQTT chưa kết nối.
 *       '500':
 *         description: Gửi MQTT thất bại hoặc lỗi máy chủ.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *             example:
 *               message: Gửi lệnh MQTT thất bại.
 *     parameters:
 *     - name: id
 *       in: path
 *       required: true
 *       description: ID thiết bị trong bảng devices.
 *       schema:
 *         type: integer
 *         example: 1
 *         minimum: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               action:
 *                 type: string
 *                 enum:
 *                 - 'ON'
 *                 - 'OFF'
 *                 example: 'ON'
 *             required:
 *             - action
 */
router.post("/devices/:id/control", deviceController.controlDevice);

/**
 * @openapi
 * /api/sensors-data:
 *   get:
 *     tags:
 *     - Sensors
 *     summary: Tìm kiếm và phân trang dữ liệu cảm biến
 *     description: ALL tìm một phần giá trị, loại cảm biến hoặc thời gian. Time chỉ
 *       tìm thời gian. Loại cụ thể lọc measurement_type và tìm một phần giá trị. Thời
 *       gian tìm theo UTC+07 với định dạng D/MM/YYYY HH:mm:ss; ngày không đệm số 0.
 *       Trang vượt tổng trang trả mảng rỗng.
 *     operationId: getApiSensorsData
 *     responses:
 *       '200':
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/SensorDataWithSensor'
 *                 currentPage:
 *                   type: integer
 *                   example: 1
 *                 totalPages:
 *                   type: integer
 *                   example: 1
 *                   minimum: 0
 *                 totalItems:
 *                   type: integer
 *                   example: 1
 *                   minimum: 0
 *                 skip:
 *                   type: integer
 *                   example: 0
 *                   minimum: 0
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         description: Lỗi xử lý máy chủ; message theo controller.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *     parameters:
 *     - name: search
 *       in: query
 *       required: false
 *       description: Từ khóa tìm kiếm; bỏ khoảng trắng hai đầu.
 *       schema:
 *         type: string
 *         default: ''
 *     - name: searchBy
 *       in: query
 *       required: false
 *       description: Phạm vi tìm kiếm; loại cụ thể được so khớp measurement_type.
 *       schema:
 *         type: string
 *         enum:
 *         - ALL
 *         - Temperature
 *         - Humidity
 *         - Light
 *         - N2
 *         - CO2
 *         - CH4
 *         - Time
 *         default: ALL
 *     - name: page
 *       in: query
 *       required: false
 *       description: Trang hiện tại; giá trị không hợp lệ được đưa về 1.
 *       schema:
 *         type: integer
 *         minimum: 1
 *         default: 1
 *     - name: items
 *       in: query
 *       required: false
 *       description: Số bản ghi mỗi trang; không giới hạn vào 10/20/50. Giá trị không
 *         hợp lệ được đưa về 10, số âm về 1.
 *       schema:
 *         type: integer
 *         minimum: 1
 *         default: 10
 *     - name: sort
 *       in: query
 *       required: false
 *       description: Chỉ ASC cho thứ tự tăng dần, còn lại dùng DESC; sắp theo thời gian
 *         rồi ID.
 *       schema:
 *         type: string
 *         enum:
 *         - ASC
 *         - DESC
 *         default: DESC
 */
router.get("/sensors-data", sensorController.getSensorsData);

/**
 * @openapi
 * /api/actions-history:
 *   get:
 *     tags:
 *     - Actions
 *     summary: Tìm kiếm lịch sử điều khiển
 *     description: Tìm một phần tên thiết bị, action, status hoặc thời gian tạo theo
 *       UTC+07 (D/MM/YYYY HH:mm:ss). Kết hợp bộ lọc device và status bằng AND.
 *     operationId: getApiActionsHistory
 *     responses:
 *       '200':
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/ActionHistory'
 *                 currentPage:
 *                   type: integer
 *                   example: 1
 *                 totalPages:
 *                   type: integer
 *                   example: 1
 *                   minimum: 0
 *                 total:
 *                   type: integer
 *                   example: 1
 *                   minimum: 0
 *                 skip:
 *                   type: integer
 *                   example: 0
 *                   minimum: 0
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         description: Lỗi tải lịch sử.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthMessage'
 *             example:
 *               code: error
 *               message: Không tải được lịch sử thao tác.
 *     parameters:
 *     - name: search
 *       in: query
 *       required: false
 *       description: Từ khóa tìm kiếm.
 *       schema:
 *         type: string
 *         default: ''
 *     - name: device
 *       in: query
 *       required: false
 *       description: ALL hoặc chuỗi ID thiết bị, ví dụ 1.
 *       schema:
 *         type: string
 *         default: ALL
 *         example: ALL
 *     - name: status
 *       in: query
 *       required: false
 *       description: Trạng thái thao tác.
 *       schema:
 *         type: string
 *         enum:
 *         - ALL
 *         - WAITING
 *         - SUCCESS
 *         - FAILED
 *         - TIMEOUT
 *         default: ALL
 *     - name: page
 *       in: query
 *       required: false
 *       description: Trang hiện tại; giá trị không hợp lệ được đưa về 1.
 *       schema:
 *         type: integer
 *         minimum: 1
 *         default: 1
 *     - name: items
 *       in: query
 *       required: false
 *       description: Số bản ghi mỗi trang; không giới hạn vào 10/20/50. Giá trị không
 *         hợp lệ được đưa về 10, số âm về 1.
 *       schema:
 *         type: integer
 *         minimum: 1
 *         default: 10
 *     - name: sort
 *       in: query
 *       required: false
 *       description: Chỉ ASC cho thứ tự tăng dần, còn lại dùng DESC; sắp theo thời gian
 *         rồi ID.
 *       schema:
 *         type: string
 *         enum:
 *         - ASC
 *         - DESC
 *         default: DESC
 */
router.get(
  "/actions-history",
  actionHistoryController.getActionsHistory
);

const alertController = require("../controllers/alert.controller");

/**
 * @openapi
 * /api/gas-dashboard:
 *   get:
 *     tags:
 *     - Alerts
 *     summary: Lấy dữ liệu dashboard khí
 *     description: 'Mỗi thiết bị cảnh báo có giá trị mới nhất, trạng thái nháy, tổng
 *       lịch sử mọi ngày và tối đa 5 mẫu. Thiết bị sắp theo ID tăng dần. value=null,
 *       records=[] nếu chưa có mẫu. Ngưỡng hiện tại: N2=50 %, CO2=700 ppm, CH4=450 ppm.'
 *     operationId: getApiGasDashboard
 *     responses:
 *       '200':
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/GasSnapshot'
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         description: Lỗi xử lý máy chủ; message theo controller.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 */
router.get("/gas-dashboard", alertController.getDashboard);
/**
 * @openapi
 * /api/alerts/daily:
 *   get:
 *     tags:
 *     - Alerts
 *     summary: Đếm cảnh báo theo ngày
 *     description: 'Ngày được tính theo UTC+07: từ 00:00 ngày chọn đến trước 00:00 ngày
 *       sau. Đếm theo started_at của bản ghi trong alert_history, không theo ended_at.
 *       Trả từng thiết bị cảnh báo theo ID, kể cả count=0.'
 *     operationId: getApiAlertsDaily
 *     responses:
 *       '200':
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: string
 *                   example: success
 *                 date:
 *                   type: string
 *                   format: date
 *                   example: '2026-11-08'
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       sensor:
 *                         type: string
 *                         enum:
 *                         - n2
 *                         - co2
 *                         - ch4
 *                         example: n2
 *                       count:
 *                         type: integer
 *                         example: 3
 *                         minimum: 0
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '400':
 *         description: Thiếu ngày, sai định dạng hoặc ngày không tồn tại.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *             example:
 *               message: Ngày không hợp lệ.
 *       '500':
 *         description: Lỗi tải thống kê.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Message'
 *             example:
 *               message: Không tải được thống kê cảnh báo.
 *     parameters:
 *     - name: date
 *       in: query
 *       required: true
 *       description: Bắt buộc YYYY-MM-DD và phải là ngày tồn tại.
 *       schema:
 *         type: string
 *         format: date
 *         pattern: ^\d{4}-\d{2}-\d{2}$
 *         example: '2026-11-08'
 */
router.get("/alerts/daily", alertController.getDailyAlerts);
 
/**
 * @openapi
 * /api/alerts/history:
 *   get:
 *     tags:
 *     - Alerts
 *     summary: Tìm kiếm lịch sử cảnh báo
 *     description: Lọc n2/co2/ch4 lần lượt theo alert_device_id=1/2/3; ALL hoặc giá
 *       trị khác không lọc. search tìm một phần started_at theo UTC+07 dạng D/MM/YYYY
 *       HH:mm:ss. Không có tham số date hay lọc khoảng ngày.
 *     operationId: getApiAlertsHistory
 *     responses:
 *       '200':
 *         description: Thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 code:
 *                   type: string
 *                   example: success
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AlertHistory'
 *                 currentPage:
 *                   type: integer
 *                   example: 1
 *                 totalPages:
 *                   type: integer
 *                   example: 1
 *                   minimum: 0
 *                 total:
 *                   type: integer
 *                   example: 1
 *                   minimum: 0
 *                 skip:
 *                   type: integer
 *                   example: 0
 *                   minimum: 0
 *       '401':
 *         $ref: '#/components/responses/Unauthorized'
 *       '500':
 *         description: Lỗi tải lịch sử.
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/AuthMessage'
 *             example:
 *               code: error
 *               message: Không tải được lịch sử cảnh báo.
 *     parameters:
 *     - name: sensor
 *       in: query
 *       required: false
 *       description: Loại cảm biến cảnh báo.
 *       schema:
 *         type: string
 *         enum:
 *         - ALL
 *         - n2
 *         - co2
 *         - ch4
 *         default: ALL
 *     - name: search
 *       in: query
 *       required: false
 *       description: Tìm thời gian bắt đầu, bỏ khoảng trắng hai đầu.
 *       schema:
 *         type: string
 *         default: ''
 *         example: 8/11/2026
 *     - name: page
 *       in: query
 *       required: false
 *       description: Trang hiện tại; giá trị không hợp lệ được đưa về 1.
 *       schema:
 *         type: integer
 *         minimum: 1
 *         default: 1
 *     - name: items
 *       in: query
 *       required: false
 *       description: Số bản ghi mỗi trang; không giới hạn vào 10/20/50. Giá trị không
 *         hợp lệ được đưa về 10, số âm về 1.
 *       schema:
 *         type: integer
 *         minimum: 1
 *         default: 10
 *     - name: sort
 *       in: query
 *       required: false
 *       description: Chỉ ASC cho thứ tự tăng dần, còn lại dùng DESC; sắp theo thời gian
 *         rồi ID.
 *       schema:
 *         type: string
 *         enum:
 *         - ASC
 *         - DESC
 *         default: DESC
 */
router.get("/alerts/history", alertController.getAlertsHistory);

module.exports = router;
