import { Request, Response, Router } from "express";

export const contasRouter = Router();

contasRouter.get("/", (_req: Request, res: Response) => {
  const data = [
    {
      id_conta: 1,
      apelido: "BB Principal",
      titular: "Empresa ABC",
      agencia: "1234-5",
      conta: "12345-6",
      convenio: "123456",
    },
  ];

  return res.json(data);
});

contasRouter.post("/", (req: Request, res: Response) => {
  const payload = req.body;

  return res.status(201).json({
    id_conta: 1,
    ...payload,
  });
});

contasRouter.put("/:id", (req: Request, res: Response) => {
  const { id } = req.params;
  const payload = req.body;

  return res.json({
    id_conta: Number(id),
    ...payload,
  });
});

contasRouter.delete("/:id", (_req: Request, res: Response) => {
  return res.status(204).send();
});

