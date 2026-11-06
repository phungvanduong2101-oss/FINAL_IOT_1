const { Server } = require("socket.io");

let io;

function initSocket(server) {
  io = new Server(server);

  io.on("connection", socket => {
    console.log("Client kết nối:", socket.id);

    socket.on("disconnect", () => {
      console.log("Client ngắt kết nối:", socket.id);
    });
  });

  return io;
}

function getIO() {
  if (!io) throw new Error("Socket.IO chưa khởi tạo.");
  return io;
}

module.exports = { initSocket, getIO };