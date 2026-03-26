import { Router } from "express";
import { z } from "zod";
import { AppDataSource } from "../../db/data-source";
import { Empresa } from "../../entities/Empresa";
import { Usuario } from "../../entities/Usuario";

export const setupRouter = Router();

// ─── Status: sistema já tem empresas? (rota pública) ─────────────────────────
setupRouter.get("/status", async (_req, res) => {
  try {
    const empresaRepo = AppDataSource.getRepository(Empresa);
    const totalEmpresas = await empresaRepo.count();
    return res.json({ totalEmpresas });
  } catch (error) {
    console.error("Erro ao verificar status do setup:", error);
    return res.status(500).json({ error: "Erro ao verificar status" });
  }
});

// ─── Schema de validação ──────────────────────────────────────────────────────
const primeiroAcessoSchema = z.object({
  empresa: z.object({
    nome_fantasia: z.string().min(1, "Nome da empresa é obrigatório").max(200),
    razao_social: z.string().max(200).optional(),
    cnpj: z
      .string()
      .min(14, "CNPJ inválido")
      .max(18, "CNPJ inválido"),
    ie: z.string().max(20).optional(),
    endereco: z.string().max(300).optional(),
    bairro: z.string().max(100).optional(),
    cidade: z.string().max(100).optional(),
    estado: z.string().max(2).optional(),
    cep: z.string().max(9).optional(),
    telefone: z.string().max(20).optional(),
    email: z.string().max(200).optional(),
  }),
  usuario: z.object({
    login: z
      .string()
      .min(3, "Login deve ter pelo menos 3 caracteres")
      .max(100)
      .regex(/^[a-zA-Z0-9._@-]+$/, "Login deve conter apenas letras, números e . _ @ -"),
    senha: z.string().min(6, "Senha deve ter pelo menos 6 caracteres"),
    email: z
      .string()
      .email("E-mail inválido")
      .max(200)
      .optional()
      .or(z.literal("")),
    telefone: z.string().max(20).optional(),
  }),
});

// ─── Cadastro de novo tenant (rota pública) ───────────────────────────────────
setupRouter.post("/primeiro-acesso", async (req, res) => {
  const parseResult = primeiroAcessoSchema.safeParse(req.body);

  if (!parseResult.success) {
    return res.status(400).json({
      error: parseResult.error.issues[0]?.message ?? "Dados inválidos",
      issues: parseResult.error.issues,
    });
  }

  const { empresa: empresaData, usuario: usuarioData } = parseResult.data;

  const empresaRepo = AppDataSource.getRepository(Empresa);
  const usuarioRepo = AppDataSource.getRepository(Usuario);

  // ── 1. CNPJ já cadastrado?
  const cnpjExistente = await empresaRepo.findOne({
    where: { cnpj: empresaData.cnpj },
  });
  if (cnpjExistente) {
    return res.status(409).json({
      error: "Já existe uma empresa cadastrada com este CNPJ.",
      field: "cnpj",
    });
  }

  // ── 2. Login já existe?
  const loginExistente = await usuarioRepo
    .createQueryBuilder("u")
    .where("LOWER(u.login) = LOWER(:login)", { login: usuarioData.login.trim() })
    .getOne();
  if (loginExistente) {
    return res.status(409).json({
      error: "Este login já está em uso. Escolha outro nome de usuário.",
      field: "login",
    });
  }

  // ── 3. E-mail do admin já existe?
  const emailAdmin = usuarioData.email?.trim() || null;
  if (emailAdmin) {
    const emailExistente = await usuarioRepo
      .createQueryBuilder("u")
      .where("LOWER(u.email) = LOWER(:email)", { email: emailAdmin })
      .getOne();
    if (emailExistente) {
      return res.status(409).json({
        error: "Este e-mail já está vinculado a outro usuário.",
        field: "email",
      });
    }
  }

  // ── 4. Telefone + CNPJ — mesma combinação já existe?
  const telefoneAdmin = usuarioData.telefone?.trim() || null;
  if (telefoneAdmin) {
    const telefoneExistente = await usuarioRepo
      .createQueryBuilder("u")
      .innerJoin(Empresa, "e", "e.id_empresa = u.id_empresa")
      .where("u.telefone = :telefone", { telefone: telefoneAdmin })
      .andWhere("e.cnpj = :cnpj", { cnpj: empresaData.cnpj })
      .getOne();
    if (telefoneExistente) {
      return res.status(409).json({
        error: "Este telefone já está cadastrado para uma conta com este CNPJ.",
        field: "telefone",
      });
    }
  }

  // ── 5. Cria a empresa
  const empresa = empresaRepo.create({ ...empresaData, ativo: true });
  const empresaSalva = await empresaRepo.save(empresa);

  // ── 6. Cria o usuário master vinculado à empresa
  const usuario = usuarioRepo.create({
    id_empresa: empresaSalva.id_empresa,
    login: usuarioData.login.trim(),
    senha: usuarioData.senha,
    email: emailAdmin,
    telefone: telefoneAdmin,
    user_master: true,
    clientes_cadastrar: true,
    clientes_alterar: true,
    clientes_excluir: true,
    loteamentos_cadastrar: true,
    loteamentos_alterar: true,
    loteamentos_excluir: true,
    vendas_cadastrar: true,
    vendas_alterar: true,
    vendas_excluir: true,
  });
  await usuarioRepo.save(usuario);

  return res.status(201).json({
    success: true,
    message: "Empresa e usuário administrador criados com sucesso.",
    empresa: {
      id_empresa: empresaSalva.id_empresa,
      nome_fantasia: empresaSalva.nome_fantasia,
    },
  });
});

// ─── Recuperar acesso por e-mail ou telefone (rota pública) ──────────────────
setupRouter.post("/recuperar-acesso", async (req, res) => {
  try {
    const { cnpj, email, telefone } = req.body as {
      cnpj?: string;
      email?: string;
      telefone?: string;
    };

    if (!cnpj?.trim()) {
      return res.status(400).json({ error: "CNPJ é obrigatório" });
    }
    if (!email?.trim() && !telefone?.trim()) {
      return res.status(400).json({ error: "Informe o e-mail ou telefone do administrador" });
    }

    const empresaRepo = AppDataSource.getRepository(Empresa);
    const usuarioRepo = AppDataSource.getRepository(Usuario);

    const empresa = await empresaRepo.findOne({ where: { cnpj: cnpj.trim() } });
    if (!empresa) {
      return res.status(404).json({ error: "Nenhuma empresa encontrada com este CNPJ" });
    }

    // Busca o usuário master da empresa pelo e-mail ou telefone
    let usuario: Usuario | null = null;

    if (email?.trim()) {
      usuario = await usuarioRepo
        .createQueryBuilder("u")
        .where("u.id_empresa = :id", { id: empresa.id_empresa })
        .andWhere("LOWER(u.email) = LOWER(:email)", { email: email.trim() })
        .andWhere("u.user_master = true")
        .getOne();
    }

    if (!usuario && telefone?.trim()) {
      usuario = await usuarioRepo
        .createQueryBuilder("u")
        .where("u.id_empresa = :id", { id: empresa.id_empresa })
        .andWhere("u.telefone = :telefone", { telefone: telefone.trim() })
        .andWhere("u.user_master = true")
        .getOne();
    }

    if (!usuario) {
      return res.status(404).json({
        error: "Nenhum administrador encontrado com os dados informados",
      });
    }

    // Gera senha temporária de 8 caracteres
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";
    let senhaTmp = "";
    for (let i = 0; i < 8; i++) {
      senhaTmp += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    usuario.senha = senhaTmp;
    await usuarioRepo.save(usuario);

    return res.json({
      success: true,
      login: usuario.login,
      senha_temporaria: senhaTmp,
    });
  } catch (error) {
    console.error("Erro ao recuperar acesso:", error);
    return res.status(500).json({ error: "Erro ao processar recuperação de acesso" });
  }
});
