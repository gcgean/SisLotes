import express, { Request, Response } from "express";
import cors from "cors";
import morgan from "morgan";
import { json, urlencoded } from "express";
import path from "path";
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

  // Serve static files from the React frontend app
  const frontendPath = path.join(__dirname, "../../dist");
  app.use(express.static(frontendPath));

  // Anything that doesn't match the above, send back index.html
  app.get("*", (req: Request, res: Response) => {
    if (req.path.startsWith("/api")) {
      return res.status(404).json({ error: "Not Found" });
    }
    res.sendFile(path.join(frontendPath, "index.html"));
  });

  return app;
}
