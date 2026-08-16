import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ScreenHelp } from "@/components/layout/ScreenHelp";

describe("ajuda contextual da tela", () => {
  it("abre o tutorial com passos e espaço para o vídeo", () => {
    render(
      <ScreenHelp
        tutorial={{
          title: "Fechamento de Período",
          summary: "Proteja períodos já conferidos.",
          steps: ["Confira as movimentações.", "Escolha a data."],
        }}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Abrir tutorial: Fechamento de Período" }));

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Tutorial — Fechamento de Período")).toBeInTheDocument();
    expect(screen.getByText("Confira as movimentações.")).toBeInTheDocument();
    expect(screen.getByText(/Vídeo ainda não cadastrado/)).toBeInTheDocument();
  });
});
