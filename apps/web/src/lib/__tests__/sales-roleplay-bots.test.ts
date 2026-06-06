import { describe, expect, it } from "vitest";

import {
  getRoleplayBotReply,
  listRoleplayBots,
  parseRoleplayKnowledge,
} from "@/lib/sales-roleplay-bots";

describe("sales roleplay bots", () => {
  it("exposes the closing and non-closing bots", () => {
    expect(listRoleplayBots().map((bot) => bot.id)).toEqual([
      "closing",
      "non_closing",
    ]);
  });

  it("answers price objections with a closing-oriented prospect", () => {
    const reply = getRoleplayBotReply({
      botId: "closing",
      advisorMessage:
        "La beca te deja una mensualidad mas baja y hoy podemos apartar tu lugar.",
      scenario: "Prospecto pregunta por precio y beca.",
      turnIndex: 2,
    });

    expect(reply.detectedObjection).toBe("price");
    expect(reply.intent).toBe("moves_to_close");
    expect(reply.text.toLowerCase()).toContain("beca");
    expect(reply.text).toMatch(/[¿?]/);
  });

  it("keeps the non-closing bot realistic without accepting the close", () => {
    const reply = getRoleplayBotReply({
      botId: "non_closing",
      advisorMessage:
        "Si te inscribes hoy aseguras el descuento y arrancas en el proximo ciclo.",
      scenario: "Prospecto indeciso comparando opciones.",
      turnIndex: 4,
    });

    expect(reply.intent).toBe("resists_close");
    expect(reply.text.toLowerCase()).not.toContain("me inscribo hoy");
    expect(reply.text.toLowerCase()).toMatch(/revis|piens|compar|ahorita/);
  });

  it("allows simple extra knowledge lines to influence the reply", () => {
    const knowledge = parseRoleplayKnowledge(`
      Beca: Se puede apartar con documentos completos.
      Horarios: Hay turnos ejecutivos para quien trabaja.
    `);

    const reply = getRoleplayBotReply({
      botId: "closing",
      advisorMessage: "Trabajo todo el dia, no se si me dan los horarios.",
      extraKnowledge: knowledge,
      turnIndex: 1,
    });

    expect(reply.detectedObjection).toBe("schedule");
    expect(reply.usedKnowledge).toContain("turnos ejecutivos");
  });
});
