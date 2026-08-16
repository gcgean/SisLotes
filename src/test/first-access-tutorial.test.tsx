import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import { FirstAccessTutorial } from "@/components/onboarding/FirstAccessTutorial";

describe("tutorial guiado de primeiro acesso", () => {
  it("avança pelas etapas", () => {
    render(<MemoryRouter><FirstAccessTutorial open onComplete={vi.fn()} onOpenChange={vi.fn()} /></MemoryRouter>);
    expect(screen.getByText("Bem-vindo ao SISLOTE")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /próximo/i }));
    expect(screen.getByText("Configure sua empresa")).toBeInTheDocument();
    expect(screen.getByText("Etapa 2 de 8")).toBeInTheDocument();
  });

  it("registra quando o usuário pula o tutorial", () => {
    const onComplete = vi.fn();
    const onOpenChange = vi.fn();
    render(<MemoryRouter><FirstAccessTutorial open onComplete={onComplete} onOpenChange={onOpenChange} /></MemoryRouter>);
    fireEvent.click(screen.getByRole("button", { name: "Pular tutorial" }));
    expect(onComplete).toHaveBeenCalledOnce();
    expect(onOpenChange).toHaveBeenCalledWith(false);
  });
});
