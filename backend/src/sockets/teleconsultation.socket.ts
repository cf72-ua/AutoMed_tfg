import { Server, Socket } from "socket.io";
import jwt from "jsonwebtoken";
import { TeleconsultationService } from "../services/teleconsultation.service";
import type { JwtPayload } from "../types/index.d";

interface AuthenticatedSocket extends Socket {
  user?: {
    id: number;
    dni: string;
    roles: string[];
  };
}

const teleconsultationService = new TeleconsultationService();

function readToken(socket: Socket): string | null {
  const authToken = socket.handshake.auth?.token;
  if (typeof authToken === "string" && authToken.trim()) {
    return authToken;
  }

  const header = socket.handshake.headers.authorization;
  if (header?.startsWith("Bearer ")) {
    return header.slice("Bearer ".length);
  }

  return null;
}

export function registerTeleconsultationSocket(io: Server): void {
  const namespace = io.of("/teleconsultations");

  namespace.use((socket: AuthenticatedSocket, next) => {
    const token = readToken(socket);
    if (!token) {
      return next(new Error("Authentication token required"));
    }

    try {
      const decoded = jwt.verify(
        token,
        process.env.JWT_SECRET || "your_jwt_secret_key_change_in_production",
      ) as JwtPayload;
      const roles = decoded.roles || (decoded.role ? [decoded.role] : []);

      socket.user = {
        id: decoded.userId,
        dni: decoded.dni,
        roles: roles.map(String),
      };

      next();
    } catch (error) {
      next(new Error("Invalid or expired token"));
    }
  });

  namespace.on("connection", (socket: AuthenticatedSocket) => {
    socket.on("join_consultation", async (consultationId: number, ack) => {
      try {
        const parsedConsultationId = Number(consultationId);
        if (
          !Number.isFinite(parsedConsultationId) ||
          parsedConsultationId <= 0
        ) {
          throw new Error("Invalid consultationId");
        }

        await teleconsultationService.assertParticipant(
          parsedConsultationId,
          socket.user!.id,
        );
        await socket.join(`consultation:${parsedConsultationId}`);
        ack?.({ ok: true });
      } catch (error) {
        const message =
          error instanceof Error ? error.message : "Unknown error";
        ack?.({ ok: false, error: message });
      }
    });

    socket.on("leave_consultation", async (consultationId: number, ack) => {
      const parsedConsultationId = Number(consultationId);
      await socket.leave(`consultation:${parsedConsultationId}`);
      ack?.({ ok: true });
    });

    socket.on(
      "send_message",
      async (
        payload: {
          consultationId: number;
          content: string;
          type?: "text" | "file" | "system";
        },
        ack,
      ) => {
        try {
          const consultationId = Number(payload?.consultationId);
          if (!Number.isFinite(consultationId) || consultationId <= 0) {
            throw new Error("Invalid consultationId");
          }

          const message = await teleconsultationService.createMessage(
            consultationId,
            socket.user!.id,
            payload.content,
            payload.type || "text",
          );

          namespace
            .to(`consultation:${consultationId}`)
            .emit("message_created", message);
          ack?.({ ok: true, data: message });
        } catch (error) {
          const message =
            error instanceof Error ? error.message : "Unknown error";
          ack?.({ ok: false, error: message });
        }
      },
    );
  });
}
