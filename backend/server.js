const http = require("http");
const dotenv = require("dotenv");
const connectDB = require("./config/db");
const app = require("./app");
const { attachSocket } = require("./socket");

dotenv.config();
connectDB().then(() => {
  const seedAdmin = require("./config/seedAdmin");
  seedAdmin();
});

const server = http.createServer(app);
const io = attachSocket(server);

// Pass socket.io instance to Express app
app.set("io", io);

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
