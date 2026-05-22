import net from "net";
import tls from "tls";

interface EmailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

interface SmtpConfig {
  host: string;
  port: number;
  secure: boolean;
  user?: string;
  pass?: string;
  from: string;
}

export class EmailService {
  private getConfig(): SmtpConfig {
    const host = process.env.SMTP_HOST;

    if (!host) {
      throw new Error("Servicio de correo no configurado");
    }

    const port = Number(process.env.SMTP_PORT || "587");

    return {
      host,
      port,
      secure: process.env.SMTP_SECURE === "true" || port === 465,
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS || process.env.SMTP_PASSWORD,
      from:
        process.env.SMTP_FROM ||
        process.env.SMTP_USER ||
        "no-reply@automed.local",
    };
  }

  async sendMail(message: EmailMessage): Promise<void> {
    const config = this.getConfig();
    let socket: net.Socket | tls.TLSSocket = await this.connect(config);

    try {
      await this.expect(socket, 220);
      await this.command(socket, `EHLO ${this.getClientName()}`, 250);

      if (!config.secure) {
        await this.command(socket, "STARTTLS", 220);
        socket = await this.upgradeToTls(socket, config.host);
        await this.command(socket, `EHLO ${this.getClientName()}`, 250);
      }

      if (config.user && config.pass) {
        await this.command(socket, "AUTH LOGIN", 334);
        await this.command(
          socket,
          Buffer.from(config.user).toString("base64"),
          334,
        );
        await this.command(
          socket,
          Buffer.from(config.pass).toString("base64"),
          235,
        );
      }

      await this.command(socket, `MAIL FROM:<${config.from}>`, 250);
      await this.command(socket, `RCPT TO:<${message.to}>`, [250, 251]);
      await this.command(socket, "DATA", 354);
      await this.command(socket, this.buildMessage(config.from, message), 250);
      await this.command(socket, "QUIT", 221);
    } finally {
      socket.end();
    }
  }

  private connect(config: SmtpConfig): Promise<net.Socket | tls.TLSSocket> {
    return new Promise((resolve, reject) => {
      const onError = (error: Error) => reject(error);
      const socket = config.secure
        ? tls.connect(
            {
              host: config.host,
              port: config.port,
              servername: config.host,
            },
            () => resolve(socket),
          )
        : net.connect(config.port, config.host, () => resolve(socket));

      socket.once("error", onError);
    });
  }

  private upgradeToTls(
    socket: net.Socket | tls.TLSSocket,
    host: string,
  ): Promise<tls.TLSSocket> {
    return new Promise((resolve, reject) => {
      const secureSocket = tls.connect(
        {
          socket,
          servername: host,
        },
        () => resolve(secureSocket),
      );

      secureSocket.once("error", reject);
    });
  }

  private command(
    socket: net.Socket | tls.TLSSocket,
    command: string,
    expected: number | number[],
  ): Promise<string> {
    socket.write(`${command}\r\n`);
    return this.expect(socket, expected);
  }

  private expect(
    socket: net.Socket | tls.TLSSocket,
    expected: number | number[],
  ): Promise<string> {
    const expectedCodes = Array.isArray(expected) ? expected : [expected];

    return new Promise((resolve, reject) => {
      let response = "";

      const onData = (chunk: Buffer) => {
        response += chunk.toString("utf8");
        const lines = response.split(/\r?\n/).filter(Boolean);
        const lastLine = lines[lines.length - 1];

        if (!lastLine || !/^\d{3} /.test(lastLine)) {
          return;
        }

        socket.off("data", onData);
        socket.off("error", onError);

        const code = Number(lastLine.slice(0, 3));
        if (expectedCodes.includes(code)) {
          resolve(response);
        } else {
          reject(new Error(`SMTP respondió ${code}: ${response}`));
        }
      };

      const onError = (error: Error) => {
        socket.off("data", onData);
        reject(error);
      };

      socket.on("data", onData);
      socket.once("error", onError);
    });
  }

  private buildMessage(from: string, message: EmailMessage): string {
    if (message.html) {
      return this.buildMultipartMessage(from, message);
    }

    const headers = [
      `From: ${from}`,
      `To: ${message.to}`,
      `Subject: ${this.encodeHeader(message.subject)}`,
      "MIME-Version: 1.0",
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
    ];

    return `${headers.join("\r\n")}\r\n\r\n${this.toBase64Lines(message.text)}\r\n.`;
  }

  private buildMultipartMessage(from: string, message: EmailMessage): string {
    const boundary = `automed-${Date.now().toString(36)}`;
    const headers = [
      `From: ${from}`,
      `To: ${message.to}`,
      `Subject: ${this.encodeHeader(message.subject)}`,
      "MIME-Version: 1.0",
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
    ];

    const parts = [
      `--${boundary}`,
      'Content-Type: text/plain; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      this.toBase64Lines(message.text),
      `--${boundary}`,
      'Content-Type: text/html; charset="UTF-8"',
      "Content-Transfer-Encoding: base64",
      "",
      this.toBase64Lines(message.html || ""),
      `--${boundary}--`,
    ];

    return `${headers.join("\r\n")}\r\n\r\n${parts.join("\r\n")}\r\n.`;
  }

  private encodeHeader(value: string): string {
    return `=?UTF-8?B?${Buffer.from(value, "utf8").toString("base64")}?=`;
  }

  private toBase64Lines(value: string): string {
    return Buffer.from(value, "utf8")
      .toString("base64")
      .replace(/.{1,76}/g, "$&\r\n")
      .trim();
  }

  private getClientName(): string {
    return process.env.SMTP_CLIENT_NAME || "automed.local";
  }
}
