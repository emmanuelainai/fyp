import type { Server as HttpServer } from "http";
import jwt from "jsonwebtoken";
import { Server, type Socket } from "socket.io";
import type { UserRole } from "@prisma/client";
import { env } from "../config/env";
import { prisma } from "../config/prisma";

let io: Server | null = null;

type SocketUser = {
  id: string;
  email: string;
  role: UserRole;
};

type AuthenticatedSocket = Socket & {
  user?: SocketUser;
};

export const initializeSocketServer = (server: HttpServer) => {
  io = new Server(server, {
    cors: {
      origin: env.CLIENT_URL,
      credentials: true
    }
  });

  io.use(async (socket: AuthenticatedSocket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.headers.authorization?.toString().replace("Bearer ", "");
    if (!token) {
      return next(new Error("Socket authentication token is required"));
    }

    try {
      const decoded = jwt.verify(token, env.JWT_SECRET) as SocketUser;
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, email: true, role: true, isActive: true }
      });
      if (!user || !user.isActive) {
        return next(new Error("Socket user is inactive or unavailable"));
      }
      socket.user = { id: user.id, email: user.email, role: user.role };
      return next();
    } catch {
      return next(new Error("Invalid socket token"));
    }
  });

  io.on("connection", (socket: AuthenticatedSocket) => {
    const user = socket.user;
    if (!user) return;

    socket.join(`examiner:${user.id}`);

    socket.on("session:join", async ({ sessionId }: { sessionId: string }) => {
      const session = await prisma.examSession.findUnique({
        where: { id: sessionId },
        include: { exam: true }
      });
      if (!session) return;

      const allowed =
        user.role === "ADMIN" ||
        session.studentId === user.id ||
        (user.role === "EXAMINER" && session.exam.createdById === user.id);
      if (allowed) {
        socket.join(`session:${sessionId}`);
        socket.join(`exam:${session.examId}`);
      }
    });

    socket.on("exam:join", async ({ examId }: { examId: string }) => {
      const exam = await prisma.exam.findUnique({ where: { id: examId } });
      if (!exam) return;
      if (user.role === "ADMIN" || exam.createdById === user.id) {
        socket.join(`exam:${examId}`);
      }
    });

    socket.on("session:heartbeat", async ({ sessionId }: { sessionId: string }) => {
      const session = await prisma.examSession.findUnique({ where: { id: sessionId } });
      if (session?.studentId === user.id) {
        emitToSession(sessionId, "session:heartbeat", { sessionId, at: new Date().toISOString() });
      }
    });
  });

  return io;
};

export const getIO = () => io;

export const emitToSession = (sessionId: string, event: string, payload: unknown) => {
  io?.to(`session:${sessionId}`).emit(event, payload);
};

export const emitToExam = (examId: string, event: string, payload: unknown) => {
  io?.to(`exam:${examId}`).emit(event, payload);
};

export const emitToExaminer = (examinerId: string, event: string, payload: unknown) => {
  io?.to(`examiner:${examinerId}`).emit(event, payload);
};
