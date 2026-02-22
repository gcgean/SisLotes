import express, { Request, Response } from "express";
import cors from "cors";
import morgan from "morgan";
import { json, urlencoded } from "express";
import { router } from "./routes";

export function createApp() {
  const app = express();

  app.use(
    cors({
      origin: true,
      credentials: true,
    }),
  );

  app.use(morgan("dev"));
  app.use(json());
  app.use(urlencoded({ extended: true }));

  app.use("/api", router);

  app.get("/health", (_req: Request, res: Response) => {
    res.json({ status: "ok", service: "sislote-backend" });
  });

  return app;
}
