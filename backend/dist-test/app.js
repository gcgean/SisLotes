"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = createApp;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const morgan_1 = __importDefault(require("morgan"));
const express_2 = require("express");
const path_1 = __importDefault(require("path"));
const routes_1 = require("./routes");
function createApp() {
    const app = (0, express_1.default)();
    app.use((0, cors_1.default)({
        origin: true,
        credentials: true,
    }));
    app.use((0, morgan_1.default)("dev"));
    app.use((0, express_2.json)({
        limit: "8mb", // acomoda anexos em base64 (logo da empresa, comprovante/NF de despesa)
        verify: (req, _res, buf) => {
            req.rawBody = buf.toString("utf-8");
        },
    }));
    app.use((0, express_2.urlencoded)({ extended: true, limit: "8mb" }));
    app.use("/api", routes_1.router);
    app.get("/health", (_req, res) => {
        res.json({ status: "ok", service: "sislote-backend" });
    });
    // Serve static files from the React frontend app
    const frontendPath = path_1.default.join(__dirname, "../../dist");
    app.use(express_1.default.static(frontendPath));
    // Anything that doesn't match the above, send back index.html
    app.get("*", (req, res) => {
        if (req.path.startsWith("/api")) {
            return res.status(404).json({ error: "Not Found" });
        }
        res.sendFile(path_1.default.join(frontendPath, "index.html"));
    });
    return app;
}
