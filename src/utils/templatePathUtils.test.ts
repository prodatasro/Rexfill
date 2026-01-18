import { describe, it, expect } from "vitest";
import {
  buildTemplatePath,
  buildStoragePath,
  extractFolderPath,
  extractFilename,
  updateTemplatePathAfterRename,
  normalizeFolderPath,
} from "./templatePathUtils";

describe("templatePathUtils", () => {
  describe("buildTemplatePath", () => {
    it("builds path for root folder", () => {
      expect(buildTemplatePath("/", "document.docx")).toBe("/document.docx");
    });

    it("builds path for nested folder", () => {
      expect(buildTemplatePath("/Legal", "contract.docx")).toBe(
        "/Legal/contract.docx"
      );
    });

    it("builds path for deeply nested folder", () => {
      expect(buildTemplatePath("/Legal/Contracts", "template.docx")).toBe(
        "/Legal/Contracts/template.docx"
      );
    });
  });

  describe("buildStoragePath", () => {
    it("removes leading slash for storage", () => {
      expect(buildStoragePath("/Legal/contract.docx")).toBe(
        "Legal/contract.docx"
      );
    });

    it("handles root level files", () => {
      expect(buildStoragePath("/document.docx")).toBe("document.docx");
    });

    it("returns path unchanged if no leading slash", () => {
      expect(buildStoragePath("document.docx")).toBe("document.docx");
    });
  });

  describe("extractFolderPath", () => {
    it("extracts folder from nested path", () => {
      expect(extractFolderPath("/Legal/Contracts/template.docx")).toBe(
        "/Legal/Contracts"
      );
    });

    it("extracts folder from single level path", () => {
      expect(extractFolderPath("/Legal/contract.docx")).toBe("/Legal");
    });

    it("returns root for files at root level", () => {
      expect(extractFolderPath("/document.docx")).toBe("/");
    });

    it("returns root for files without leading slash", () => {
      expect(extractFolderPath("document.docx")).toBe("/");
    });
  });

  describe("extractFilename", () => {
    it("extracts filename from nested path", () => {
      expect(extractFilename("/Legal/Contracts/template.docx")).toBe(
        "template.docx"
      );
    });

    it("extracts filename from root path", () => {
      expect(extractFilename("/document.docx")).toBe("document.docx");
    });

    it("extracts filename without path", () => {
      expect(extractFilename("document.docx")).toBe("document.docx");
    });
  });

  describe("updateTemplatePathAfterRename", () => {
    it("updates path when folder is renamed", () => {
      expect(
        updateTemplatePathAfterRename(
          "/Legal/contract.docx",
          "/Legal",
          "/Law"
        )
      ).toBe("/Law/contract.docx");
    });

    it("updates nested folder paths", () => {
      expect(
        updateTemplatePathAfterRename(
          "/Legal/Contracts/template.docx",
          "/Legal/Contracts",
          "/Legal/Agreements"
        )
      ).toBe("/Legal/Agreements/template.docx");
    });

    it("updates parent folder affecting nested paths", () => {
      expect(
        updateTemplatePathAfterRename(
          "/Legal/Contracts/template.docx",
          "/Legal",
          "/Law"
        )
      ).toBe("/Law/Contracts/template.docx");
    });
  });

  describe("normalizeFolderPath", () => {
    it("returns root for empty string", () => {
      expect(normalizeFolderPath("")).toBe("/");
    });

    it("returns root for slash", () => {
      expect(normalizeFolderPath("/")).toBe("/");
    });

    it("adds leading slash if missing", () => {
      expect(normalizeFolderPath("Legal")).toBe("/Legal");
    });

    it("removes trailing slash", () => {
      expect(normalizeFolderPath("/Legal/")).toBe("/Legal");
    });

    it("adds leading and removes trailing slash", () => {
      expect(normalizeFolderPath("Legal/Contracts/")).toBe("/Legal/Contracts");
    });

    it("leaves correct path unchanged", () => {
      expect(normalizeFolderPath("/Legal/Contracts")).toBe("/Legal/Contracts");
    });
  });
});
