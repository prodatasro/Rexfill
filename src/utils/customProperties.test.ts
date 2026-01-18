import { describe, it, expect, vi, beforeEach } from "vitest";
import PizZip from "pizzip";
import {
  readCustomProperties,
  writeCustomProperties,
  updateDocumentFields,
} from "./customProperties";

describe("customProperties", () => {
  describe("readCustomProperties", () => {
    it("returns empty object when no custom.xml exists", () => {
      const zip = new PizZip();

      const result = readCustomProperties(zip);

      expect(result).toEqual({});
    });

    it("reads string properties (vt:lpwstr)", () => {
      const zip = new PizZip();
      const customXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties"
          xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
          <property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="CompanyName">
            <vt:lpwstr>Acme Corp</vt:lpwstr>
          </property>
        </Properties>`;
      zip.file("docProps/custom.xml", customXml);

      const result = readCustomProperties(zip);

      expect(result).toEqual({ CompanyName: "Acme Corp" });
    });

    it("reads integer properties (vt:i4)", () => {
      const zip = new PizZip();
      const customXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties"
          xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
          <property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="Version">
            <vt:i4>42</vt:i4>
          </property>
        </Properties>`;
      zip.file("docProps/custom.xml", customXml);

      const result = readCustomProperties(zip);

      expect(result).toEqual({ Version: "42" });
    });

    it("reads floating point properties (vt:r8)", () => {
      const zip = new PizZip();
      const customXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties"
          xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
          <property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="Price">
            <vt:r8>99.99</vt:r8>
          </property>
        </Properties>`;
      zip.file("docProps/custom.xml", customXml);

      const result = readCustomProperties(zip);

      expect(result).toEqual({ Price: "99.99" });
    });

    it("reads boolean properties (vt:bool)", () => {
      const zip = new PizZip();
      const customXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties"
          xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
          <property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="IsActive">
            <vt:bool>true</vt:bool>
          </property>
        </Properties>`;
      zip.file("docProps/custom.xml", customXml);

      const result = readCustomProperties(zip);

      expect(result).toEqual({ IsActive: "true" });
    });

    it("reads multiple properties", () => {
      const zip = new PizZip();
      const customXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties"
          xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
          <property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="Author">
            <vt:lpwstr>John Doe</vt:lpwstr>
          </property>
          <property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="3" name="Department">
            <vt:lpwstr>Engineering</vt:lpwstr>
          </property>
          <property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="4" name="Revision">
            <vt:i4>3</vt:i4>
          </property>
        </Properties>`;
      zip.file("docProps/custom.xml", customXml);

      const result = readCustomProperties(zip);

      expect(result).toEqual({
        Author: "John Doe",
        Department: "Engineering",
        Revision: "3",
      });
    });

    it("handles empty property values", () => {
      const zip = new PizZip();
      const customXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
        <Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/custom-properties"
          xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes">
          <property fmtid="{D5CDD505-2E9C-101B-9397-08002B2CF9AE}" pid="2" name="EmptyField">
            <vt:lpwstr></vt:lpwstr>
          </property>
        </Properties>`;
      zip.file("docProps/custom.xml", customXml);

      const result = readCustomProperties(zip);

      expect(result).toEqual({ EmptyField: "" });
    });
  });

  describe("writeCustomProperties", () => {
    it("creates custom.xml with properties", () => {
      const zip = new PizZip();
      const properties = {
        Author: "Jane Smith",
        Project: "Test Project",
      };

      writeCustomProperties(zip, properties);

      const file = zip.file("docProps/custom.xml");
      expect(file).not.toBeNull();

      const content = file!.asText();
      expect(content).toContain('<?xml version="1.0"');
      expect(content).toContain('name="Author"');
      expect(content).toContain("<vt:lpwstr>Jane Smith</vt:lpwstr>");
      expect(content).toContain('name="Project"');
      expect(content).toContain("<vt:lpwstr>Test Project</vt:lpwstr>");
    });

    it("escapes XML special characters in values", () => {
      const zip = new PizZip();
      const properties = {
        Formula: "A < B & C > D",
        Quote: 'Say "Hello"',
      };

      writeCustomProperties(zip, properties);

      const content = zip.file("docProps/custom.xml")!.asText();
      expect(content).toContain("A &lt; B &amp; C &gt; D");
      expect(content).toContain("Say &quot;Hello&quot;");
    });

    it("escapes XML special characters in property names", () => {
      const zip = new PizZip();
      const properties = {
        "Name<With>Special&Chars": "value",
      };

      writeCustomProperties(zip, properties);

      const content = zip.file("docProps/custom.xml")!.asText();
      expect(content).toContain("Name&lt;With&gt;Special&amp;Chars");
    });

    it("assigns sequential pid values starting from 2", () => {
      const zip = new PizZip();
      const properties = {
        First: "1",
        Second: "2",
        Third: "3",
      };

      writeCustomProperties(zip, properties);

      const content = zip.file("docProps/custom.xml")!.asText();
      expect(content).toContain('pid="2"');
      expect(content).toContain('pid="3"');
      expect(content).toContain('pid="4"');
    });

    it("overwrites existing custom.xml", () => {
      const zip = new PizZip();
      zip.file("docProps/custom.xml", "<old>content</old>");

      writeCustomProperties(zip, { NewProp: "NewValue" });

      const content = zip.file("docProps/custom.xml")!.asText();
      expect(content).not.toContain("<old>");
      expect(content).toContain("NewProp");
    });
  });

  describe("updateDocumentFields", () => {
    it("does nothing when document.xml does not exist", () => {
      const zip = new PizZip();

      expect(() => updateDocumentFields(zip, { Test: "value" })).not.toThrow();
    });

    it("updates simple field values in document.xml", () => {
      const zip = new PizZip();
      // The regex expects the closing tag to be </w:fldSimple> immediately after </w:r>
      const documentXml = `<?xml version="1.0"?><w:document><w:fldSimple w:instr=" DOCPROPERTY CompanyName "><w:r><w:t>Old Value</w:t></w:r></w:fldSimple></w:document>`;
      zip.file("word/document.xml", documentXml);

      updateDocumentFields(zip, { CompanyName: "New Corp" });

      const content = zip.file("word/document.xml")!.asText();
      expect(content).toContain("New Corp");
      expect(content).not.toContain("Old Value");
    });

    it("updates complex field values in document.xml", () => {
      const zip = new PizZip();
      const documentXml = `<?xml version="1.0"?>
        <w:document>
          <w:r><w:fldChar w:fldCharType="begin"/></w:r>
          <w:r><w:instrText> DOCPROPERTY Author </w:instrText></w:r>
          <w:r><w:fldChar w:fldCharType="separate"/></w:r>
          <w:r><w:t>Old Author</w:t></w:r>
          <w:r><w:fldChar w:fldCharType="end"/></w:r>
        </w:document>`;
      zip.file("word/document.xml", documentXml);

      updateDocumentFields(zip, { Author: "New Author" });

      const content = zip.file("word/document.xml")!.asText();
      expect(content).toContain("New Author");
    });

    it("updates fields in header files", () => {
      const zip = new PizZip();
      zip.file("word/document.xml", "<w:document></w:document>");
      const headerXml = `<?xml version="1.0"?><w:hdr><w:fldSimple w:instr=" DOCPROPERTY HeaderTitle "><w:r><w:t>Old Header</w:t></w:r></w:fldSimple></w:hdr>`;
      zip.file("word/header1.xml", headerXml);

      updateDocumentFields(zip, { HeaderTitle: "New Header" });

      const content = zip.file("word/header1.xml")!.asText();
      expect(content).toContain("New Header");
    });

    it("updates fields in footer files", () => {
      const zip = new PizZip();
      zip.file("word/document.xml", "<w:document></w:document>");
      const footerXml = `<?xml version="1.0"?><w:ftr><w:fldSimple w:instr=" DOCPROPERTY FooterText "><w:r><w:t>Old Footer</w:t></w:r></w:fldSimple></w:ftr>`;
      zip.file("word/footer1.xml", footerXml);

      updateDocumentFields(zip, { FooterText: "New Footer" });

      const content = zip.file("word/footer1.xml")!.asText();
      expect(content).toContain("New Footer");
    });

    it("handles quoted property names in fields", () => {
      const zip = new PizZip();
      const documentXml = `<?xml version="1.0"?><w:document><w:fldSimple w:instr=" DOCPROPERTY &quot;Property Name&quot; "><w:r><w:t>Old</w:t></w:r></w:fldSimple></w:document>`;
      zip.file("word/document.xml", documentXml);

      updateDocumentFields(zip, { "Property Name": "New Value" });

      const content = zip.file("word/document.xml")!.asText();
      expect(content).toContain("New Value");
    });

    it("escapes special characters in field values", () => {
      const zip = new PizZip();
      const documentXml = `<?xml version="1.0"?><w:document><w:fldSimple w:instr=" DOCPROPERTY Formula "><w:r><w:t>old</w:t></w:r></w:fldSimple></w:document>`;
      zip.file("word/document.xml", documentXml);

      updateDocumentFields(zip, { Formula: "x < y & z > w" });

      const content = zip.file("word/document.xml")!.asText();
      expect(content).toContain("x &lt; y &amp; z &gt; w");
    });

    it("updates multiple fields across multiple files", () => {
      const zip = new PizZip();
      zip.file(
        "word/document.xml",
        `<w:document><w:fldSimple w:instr=" DOCPROPERTY Title "><w:r><w:t>Old Title</w:t></w:r></w:fldSimple></w:document>`
      );
      zip.file(
        "word/header1.xml",
        `<w:hdr><w:fldSimple w:instr=" DOCPROPERTY Author "><w:r><w:t>Old Author</w:t></w:r></w:fldSimple></w:hdr>`
      );
      zip.file(
        "word/footer1.xml",
        `<w:ftr><w:fldSimple w:instr=" DOCPROPERTY Date "><w:r><w:t>Old Date</w:t></w:r></w:fldSimple></w:ftr>`
      );

      updateDocumentFields(zip, {
        Title: "New Title",
        Author: "New Author",
        Date: "2024-01-01",
      });

      expect(zip.file("word/document.xml")!.asText()).toContain("New Title");
      expect(zip.file("word/header1.xml")!.asText()).toContain("New Author");
      expect(zip.file("word/footer1.xml")!.asText()).toContain("2024-01-01");
    });
  });
});
