import http from "http";
import { createApp } from "./app";
import { env } from "./config/env";
import { prisma } from "./config/prisma";
import { initializeSocketServer } from "./sockets/SocketService";

const app = createApp();
const server = http.createServer(app);
initializeSocketServer(server);

server.listen(env.PORT, () => {
  console.log(`ExamSentinel API listening on http://localhost:${env.PORT}`);
});

const shutdown = async () => {
  await prisma.$disconnect();
  server.close(() => process.exit(0));
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
