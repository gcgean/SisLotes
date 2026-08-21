"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requireAuth = requireAuth;
exports.requireMaster = requireMaster;
exports.requirePermission = requirePermission;
exports.requireFeature = requireFeature;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const data_source_1 = require("../db/data-source");
const Usuario_1 = require("../entities/Usuario");
const Empresa_1 = require("../entities/Empresa");
const HubBillingService_1 = require("../services/HubBillingService");
const license_features_1 = require("../config/license-features");
// Evita gravar a cada requisição: só atualiza "último acesso" se fizer mais de 5min do último registro.
const ACCESS_THROTTLE_MS = 5 * 60 * 1000;
function touchLastAccess(user, empresa) {
    const agora = new Date();
    const usuarioDesatualizado = !user.last_login_at || agora.getTime() - new Date(user.last_login_at).getTime() > ACCESS_THROTTLE_MS;
    if (usuarioDesatualizado) {
        data_source_1.AppDataSource.getRepository(Usuario_1.Usuario)
            .update({ id_usuario: user.id_usuario }, { last_login_at: agora })
            .catch(() => { });
    }
    if (empresa) {
        const empresaDesatualizada = !empresa.ultimo_acesso || agora.getTime() - new Date(empresa.ultimo_acesso).getTime() > ACCESS_THROTTLE_MS;
        if (empresaDesatualizada) {
            data_source_1.AppDataSource.getRepository(Empresa_1.Empresa)
                .update({ id_empresa: empresa.id_empresa }, { ultimo_acesso: agora })
                .catch(() => { });
        }
    }
}
async function requireAuth(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
        return res.status(401).json({ error: "Não autenticado" });
    }
    const token = header.slice(7);
    try {
        const secret = process.env.JWT_SECRET || "development-secret";
        const decoded = jsonwebtoken_1.default.verify(token, secret);
        const sub = decoded.sub ? Number(decoded.sub) : undefined;
        if (!sub) {
            return res.status(401).json({ error: "Token inválido" });
        }
        const repo = data_source_1.AppDataSource.getRepository(Usuario_1.Usuario);
        const user = await repo.findOne({ where: { id_usuario: sub } });
        if (!user) {
            return res.status(401).json({ error: "Usuário não encontrado" });
        }
        let empresaAutenticada = null;
        if (user.login.toLowerCase() !== "gcgean") {
            const empresaRepo = data_source_1.AppDataSource.getRepository(Empresa_1.Empresa);
            const empresa = await empresaRepo.findOne({ where: { id_empresa: user.id_empresa } });
            empresaAutenticada = empresa ?? null;
            // Token válido = acesso genuíno, mesmo que a licença bloqueie a requisição em seguida.
            touchLastAccess(user, empresaAutenticada);
            if (!empresa || !empresa.ativo) {
                return res.status(403).json({ error: "Empresa inativa. Acesso bloqueado." });
            }
            const ignorePlanControl = HubBillingService_1.HubBillingService.isPlanControlDisabled(empresa);
            if (!ignorePlanControl && HubBillingService_1.HubBillingService.isConfigured() && empresa.hub_customer_id) {
                try {
                    await HubBillingService_1.HubBillingService.syncEmpresaLicense(empresa);
                }
                catch (hubError) {
                    console.warn("Falha ao sincronizar licença no middleware auth:", hubError);
                }
            }
            // Bloqueia apenas ações de escrita (criar/editar/excluir) quando a licença
            // está suspensa/expirada — leitura continua liberada, e rotas de auth e de
            // cobrança (para o usuário conseguir regularizar o plano) nunca são bloqueadas.
            const isMutating = req.method !== "GET";
            const isRotaIsenta = req.originalUrl.includes("/hub-billing") || req.originalUrl.includes("/auth/");
            if (!ignorePlanControl && isMutating && !isRotaIsenta && HubBillingService_1.HubBillingService.isLicenseDenied(empresa)) {
                return res.status(403).json({
                    error: HubBillingService_1.HubBillingService.getLicenseMessage(empresa),
                    reason: empresa.hub_license_reason || empresa.hub_license_status,
                });
            }
        }
        req.user = user;
        if (user.login.toLowerCase() === "gcgean") {
            touchLastAccess(user, null);
        }
        next();
    }
    catch {
        return res.status(401).json({ error: "Token inválido" });
    }
}
function requireMaster(req, res, next) {
    const user = req.user;
    if (!user)
        return res.status(401).json({ error: "Não autenticado" });
    if (user.login.toLowerCase() !== "gcgean") {
        return res.status(403).json({ error: "Acesso restrito ao administrador da plataforma" });
    }
    return next();
}
function requirePermission(permission) {
    return (req, res, next) => {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: "Não autenticado" });
        }
        if (user.user_master) {
            return next();
        }
        if (user[permission]) {
            return next();
        }
        return res.status(403).json({ error: "Permissão negada" });
    };
}
function requireFeature(feature) {
    return async (req, res, next) => {
        const user = req.user;
        if (!user) {
            return res.status(401).json({ error: "Não autenticado" });
        }
        if (user.login.toLowerCase() === "gcgean") {
            return next();
        }
        const empresa = await data_source_1.AppDataSource.getRepository(Empresa_1.Empresa).findOne({
            where: { id_empresa: user.id_empresa },
        });
        if (!empresa) {
            return res.status(403).json({ error: "Empresa não encontrada" });
        }
        if (HubBillingService_1.HubBillingService.isPlanControlDisabled(empresa)) {
            return next();
        }
        const configured = Boolean(process.env.HUB_BILLING_BASE_URL && process.env.HUB_BILLING_API_KEY);
        if (!configured) {
            return next();
        }
        if (!(0, license_features_1.isFeatureEnabledForPlan)({
            plan: empresa.plano,
            rawFeatures: empresa.hub_features ?? {},
            feature,
        })) {
            return res.status(403).json({
                error: "Recurso indisponível no plano atual",
                feature,
            });
        }
        return next();
    };
}
