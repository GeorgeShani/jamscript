import { describe, expect, it } from "vitest";
import { captureTake, deleteDocumentTakes, listTakes } from "@/features/takes/take-store";

describe("persistent Takes", () => {
  it("captures successful sources, deduplicates consecutive plays, and isolates documents", async () => {
    const documentId = crypto.randomUUID();
    const otherId = crypto.randomUUID();
    try {
      await captureTake(documentId, 's("bd")');
      await captureTake(documentId, 's("bd")');
      expect(await listTakes(documentId)).toHaveLength(1);
      await captureTake(documentId, 's("sd")');
      await captureTake(otherId, 's("hh")');
      expect((await listTakes(documentId)).map((take) => take.source)).toEqual([
        's("sd")',
        's("bd")',
      ]);
      expect(await listTakes(otherId)).toHaveLength(1);
      await deleteDocumentTakes(documentId);
      expect(await listTakes(documentId)).toEqual([]);
      expect(await listTakes(otherId)).toHaveLength(1);
    } finally {
      await deleteDocumentTakes(documentId);
      await deleteDocumentTakes(otherId);
    }
  });

  it("retains the newest 200 evaluations", async () => {
    const documentId = crypto.randomUUID();
    try {
      for (let i = 0; i < 202; i++) await captureTake(documentId, `s("bd").gain(${i})`);
      const takes = await listTakes(documentId);
      expect(takes).toHaveLength(200);
      expect(takes[0]?.source).toBe('s("bd").gain(201)');
      expect(takes.at(-1)?.source).toBe('s("bd").gain(2)');
    } finally {
      await deleteDocumentTakes(documentId);
    }
  });
});
