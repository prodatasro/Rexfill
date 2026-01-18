import { describe, it, expect, vi } from "vitest";
import PizZip from "pizzip";
import {
  escapeXml,
  escapeRegex,
  updateDocumentFieldsOptimized,
  fixSplitPlaceholders,
  fixSplitPlaceholdersOptimized,
  readCustomPropertiesFromZip,
  writeCustomPropertiesToZip,
  extractPlaceholdersFromZip,
} from "./documentProcessing";

describe("documentProcessing", () => {
  describe("escapeXml", () => {
    it("escapes ampersand", () => {
      expect(escapeXml("A & B")).toBe("A &amp; B");
    });

    it("escapes less than", () => {
      expect(escapeXml("A < B")).toBe("A &lt; B");
    });

    it("escapes greater than", () => {
      expect(escapeXml("A > B")).toBe("A &gt; B");
    });

    it("escapes double quotes", () => {
      expect(escapeXml('Say "Hello"')).toBe("Say &quot;Hello&quot;");
    });

    it("escapes single quotes", () => {
      expect(escapeXml("It's")).toBe("It&apos;s");
    });

    it("escapes all special characters together", () => {
      expect(escapeXml('<tag attr="value">A & B\'s</tag>')).toBe(
        "&lt;tag attr=&quot;value&quot;&gt;A &amp; B&apos;s&lt;/tag&gt;"
      );
    });

    it("returns empty string unchanged", () => {
      expect(escapeXml("")).toBe("");
    });

    it("returns string without special chars unchanged", () => {
      expect(escapeXml("Hello World 123")).toBe("Hello World 123");
    });
  });

  describe("escapeRegex", () => {
    it("escapes dot", () => {
      expect(escapeRegex("a.b")).toBe("a\\.b");
    });

    it("escapes asterisk", () => {
      expect(escapeRegex("a*b")).toBe("a\\*b");
    });

    it("escapes plus", () => {
      expect(escapeRegex("a+b")).toBe("a\\+b");
    });

    it("escapes question mark", () => {
      expect(escapeRegex("a?b")).toBe("a\\?b");
    });

    it("escapes caret", () => {
      expect(escapeRegex("^start")).toBe("\\^start");
    });

    it("escapes dollar", () => {
      expect(escapeRegex("end$")).toBe("end\\$");
    });

    it("escapes curly braces", () => {
      expect(escapeRegex("{{name}}")).toBe("\\{\\{name\\}\\}");
    });

    it("escapes parentheses", () => {
      expect(escapeRegex("(group)")).toBe("\\(group\\)");
    });

    it("escapes pipe", () => {
      expect(escapeRegex("a|b")).toBe("a\\|b");
    });

    it("escapes square brackets", () => {
      expect(escapeRegex("[abc]")).toBe("\\[abc\\]");
    });

    it("escapes backslash", () => {
      expect(escapeRegex("a\\b")).toBe("a\\\\b");
    });

    it("returns normal string unchanged", () => {
      expect(escapeRegex("normal text")).toBe("normal text");
    });
  });

  describe("readCustomPropertiesFromZip", () => {
    it("returns empty object when no custom.xml exists", () => {
      const zip = new PizZip();

      const result = readCustomPropertiesFromZip(zip);

      expect(result).toEqual({});
    });

    it("reads string properties (vt:lpwstr)", () => {
      const zip = new PizZip();
      const customXml = `<?xml version="1.0"?>
        <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties"
          xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
          <property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="Author">
            <vt:lpwstr>John Doe</vt:lpwstr>
          </property>
        </Properties>`;
      zip.file("docProps/custom.xml", customXml);

      const result = readCustomPropertiesFromZip(zip);

      expect(result).toEqual({ Author: "John Doe" });
    });

    it("reads integer properties (vt:i4)", () => {
      const zip = new PizZip();
      const customXml = `<?xml version="1.0"?>
        <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties"
          xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
          <property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="Version">
            <vt:i4>42</vt:i4>
          </property>
        </Properties>`;
      zip.file("docProps/custom.xml", customXml);

      const result = readCustomPropertiesFromZip(zip);

      expect(result).toEqual({ Version: "42" });
    });

    it("reads multiple properties", () => {
      const zip = new PizZip();
      const customXml = `<?xml version="1.0"?>
        <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties"
          xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
          <property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="Author">
            <vt:lpwstr>Jane</vt:lpwstr>
          </property>
          <property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="3" name="Count">
            <vt:i4>5</vt:i4>
          </property>
        </Properties>`;
      zip.file("docProps/custom.xml", customXml);

      const result = readCustomPropertiesFromZip(zip);

      expect(result).toEqual({ Author: "Jane", Count: "5" });
    });

    it("unescapes XML entities in property names and values", () => {
      const zip = new PizZip();
      const customXml = `<?xml version="1.0"?>
        <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties"
          xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
          <property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="A &amp; B">
            <vt:lpwstr>X &lt; Y</vt:lpwstr>
          </property>
        </Properties>`;
      zip.file("docProps/custom.xml", customXml);

      const result = readCustomPropertiesFromZip(zip);

      expect(result).toEqual({ "A & B": "X < Y" });
    });
  });

  describe("writeCustomPropertiesToZip", () => {
    it("creates custom.xml with properties", () => {
      const zip = new PizZip();
      const properties = { Author: "Test User", Project: "Demo" };

      writeCustomPropertiesToZip(zip, properties);

      const content = zip.file("docProps/custom.xml")!.asText();
      expect(content).toContain('name="Author"');
      expect(content).toContain("<vt:lpwstr>Test User</vt:lpwstr>");
      expect(content).toContain('name="Project"');
      expect(content).toContain("<vt:lpwstr>Demo</vt:lpwstr>");
    });

    it("escapes special characters", () => {
      const zip = new PizZip();
      const properties = { "Name<>": "Value&'\"" };

      writeCustomPropertiesToZip(zip, properties);

      const content = zip.file("docProps/custom.xml")!.asText();
      expect(content).toContain("Name&lt;&gt;");
      expect(content).toContain("Value&amp;&apos;&quot;");
    });

    it("assigns sequential pid values", () => {
      const zip = new PizZip();
      const properties = { A: "1", B: "2", C: "3" };

      writeCustomPropertiesToZip(zip, properties);

      const content = zip.file("docProps/custom.xml")!.asText();
      expect(content).toContain('pid="2"');
      expect(content).toContain('pid="3"');
      expect(content).toContain('pid="4"');
    });
  });

  describe("extractPlaceholdersFromZip", () => {
    it("returns empty array when no document.xml exists", () => {
      const zip = new PizZip();

      const result = extractPlaceholdersFromZip(zip);

      expect(result).toEqual([]);
    });

    it("extracts single placeholder", () => {
      const zip = new PizZip();
      const documentXml = `<?xml version="1.0"?>
        <w:document>
          <w:p><w:r><w:t>Hello {{name}}</w:t></w:r></w:p>
        </w:document>`;
      zip.file("word/document.xml", documentXml);

      const result = extractPlaceholdersFromZip(zip);

      expect(result).toEqual(["name"]);
    });

    it("extracts multiple placeholders", () => {
      const zip = new PizZip();
      const documentXml = `<?xml version="1.0"?>
        <w:document>
          <w:p><w:r><w:t>{{firstName}} {{lastName}}</w:t></w:r></w:p>
        </w:document>`;
      zip.file("word/document.xml", documentXml);

      const result = extractPlaceholdersFromZip(zip);

      expect(result).toContain("firstName");
      expect(result).toContain("lastName");
    });

    it("removes duplicate placeholders", () => {
      const zip = new PizZip();
      const documentXml = `<?xml version="1.0"?>
        <w:document>
          <w:p><w:r><w:t>{{name}} and {{name}} again</w:t></w:r></w:p>
        </w:document>`;
      zip.file("word/document.xml", documentXml);

      const result = extractPlaceholdersFromZip(zip);

      expect(result).toEqual(["name"]);
    });

    it("reconstructs placeholders from multiple w:t tags", () => {
      const zip = new PizZip();
      const documentXml = `<?xml version="1.0"?>
        <w:document>
          <w:p>
            <w:r><w:t>{{</w:t></w:r>
            <w:r><w:t>customer</w:t></w:r>
            <w:r><w:t>Name}}</w:t></w:r>
          </w:p>
        </w:document>`;
      zip.file("word/document.xml", documentXml);

      const result = extractPlaceholdersFromZip(zip);

      expect(result).toEqual(["customerName"]);
    });

    it("trims whitespace from placeholder names", () => {
      const zip = new PizZip();
      const documentXml = `<?xml version="1.0"?>
        <w:document>
          <w:p><w:r><w:t>{{ name }}</w:t></w:r></w:p>
        </w:document>`;
      zip.file("word/document.xml", documentXml);

      const result = extractPlaceholdersFromZip(zip);

      expect(result).toEqual(["name"]);
    });
  });

  describe("fixSplitPlaceholders", () => {
    it("returns unchanged content when no split placeholders", () => {
      const xml = "<w:t>{{name}}</w:t>";

      const result = fixSplitPlaceholders(xml, ["name"]);

      expect(result).toBe(xml);
    });

    it("fixes placeholder split across two w:t tags", () => {
      const xml =
        "<w:t>{{na</w:t></w:r><w:r><w:t>me}}</w:t>";

      const result = fixSplitPlaceholders(xml, ["name"]);

      expect(result).toContain("{{name}}");
    });

    it("handles empty placeholder array", () => {
      const xml = "<w:t>{{name}}</w:t>";

      const result = fixSplitPlaceholders(xml, []);

      expect(result).toBe(xml);
    });

    it("fixes generic split patterns with curly braces", () => {
      const xml =
        "<w:t>{{custom</w:t></w:r><w:r><w:t>Field}}</w:t>";

      const result = fixSplitPlaceholders(xml, []);

      expect(result).toContain("{{customField}}");
    });
  });

  describe("fixSplitPlaceholdersOptimized", () => {
    it("returns unchanged when no placeholders", () => {
      const xml = "<w:t>Some text</w:t>";

      const result = fixSplitPlaceholdersOptimized(xml, []);

      expect(result).toBe(xml);
    });

    it("returns early when all placeholders already present", () => {
      const xml = "<w:t>{{name}} and {{email}}</w:t>";

      const result = fixSplitPlaceholdersOptimized(xml, ["name", "email"]);

      expect(result).toBe(xml);
    });

    it("fixes split placeholders at strategic points", () => {
      const xml =
        "<w:t>{{customer</w:t></w:r><w:r><w:t>Name}}</w:t>";

      const result = fixSplitPlaceholdersOptimized(xml, ["customerName"]);

      expect(result).toContain("{{customerName}}");
    });

    it("only processes missing placeholders", () => {
      const xml =
        "<w:t>{{present}} and {{mis</w:t></w:r><w:r><w:t>sing}}</w:t>";

      const result = fixSplitPlaceholdersOptimized(xml, ["present", "missing"]);

      expect(result).toContain("{{present}}");
      expect(result).toContain("{{missing}}");
    });
  });

  describe("updateDocumentFieldsOptimized", () => {
    it("does nothing with empty properties", () => {
      const zip = new PizZip();
      zip.file("word/document.xml", "<w:document>test</w:document>");

      updateDocumentFieldsOptimized(zip, {});

      expect(zip.file("word/document.xml")!.asText()).toBe(
        "<w:document>test</w:document>"
      );
    });

    it("updates simple fields in document.xml", () => {
      const zip = new PizZip();
      const xml = `<w:document><w:fldSimple w:instr=" DOCPROPERTY Title "><w:r><w:t>Old</w:t></w:r></w:fldSimple></w:document>`;
      zip.file("word/document.xml", xml);

      updateDocumentFieldsOptimized(zip, { Title: "New" });

      const content = zip.file("word/document.xml")!.asText();
      expect(content).toContain("New");
    });

    it("updates fields in headers", () => {
      const zip = new PizZip();
      zip.file("word/document.xml", "<w:document></w:document>");
      const headerXml = `<w:hdr><w:fldSimple w:instr=" DOCPROPERTY Author "><w:r><w:t>Old</w:t></w:r></w:fldSimple></w:hdr>`;
      zip.file("word/header1.xml", headerXml);

      updateDocumentFieldsOptimized(zip, { Author: "New Author" });

      expect(zip.file("word/header1.xml")!.asText()).toContain("New Author");
    });

    it("updates fields in footers", () => {
      const zip = new PizZip();
      zip.file("word/document.xml", "<w:document></w:document>");
      const footerXml = `<w:ftr><w:fldSimple w:instr=" DOCPROPERTY Date "><w:r><w:t>Old</w:t></w:r></w:fldSimple></w:ftr>`;
      zip.file("word/footer1.xml", footerXml);

      updateDocumentFieldsOptimized(zip, { Date: "2024-01-01" });

      expect(zip.file("word/footer1.xml")!.asText()).toContain("2024-01-01");
    });

    it("calls progress callback", () => {
      const zip = new PizZip();
      zip.file("word/document.xml", "<w:document></w:document>");
      const onProgress = vi.fn();

      updateDocumentFieldsOptimized(zip, { Test: "value" }, onProgress);

      expect(onProgress).toHaveBeenCalledWith(100);
    });

    it("updates multiple properties in single pass", () => {
      const zip = new PizZip();
      const xml = `<w:document>
        <w:fldSimple w:instr=" DOCPROPERTY Title "><w:r><w:t>OldTitle</w:t></w:r></w:fldSimple>
        <w:fldSimple w:instr=" DOCPROPERTY Author "><w:r><w:t>OldAuthor</w:t></w:r></w:fldSimple>
      </w:document>`;
      zip.file("word/document.xml", xml);

      updateDocumentFieldsOptimized(zip, {
        Title: "NewTitle",
        Author: "NewAuthor",
      });

      const content = zip.file("word/document.xml")!.asText();
      expect(content).toContain("NewTitle");
      expect(content).toContain("NewAuthor");
    });

    it("escapes special characters in values", () => {
      const zip = new PizZip();
      const xml = `<w:document><w:fldSimple w:instr=" DOCPROPERTY Formula "><w:r><w:t>old</w:t></w:r></w:fldSimple></w:document>`;
      zip.file("word/document.xml", xml);

      updateDocumentFieldsOptimized(zip, { Formula: "x < y & z" });

      const content = zip.file("word/document.xml")!.asText();
      expect(content).toContain("x &lt; y &amp; z");
    });
  });
});
