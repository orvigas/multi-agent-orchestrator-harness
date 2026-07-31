import { test } from "node:test";
import assert from "node:assert";
import fs from "fs";
import path from "path";
import os from "os";
import { JavaParser } from "./JavaParser.js";

test("JavaParser", async (t) => {
  const parser = new JavaParser();

  await t.test("should extract classes", () => {
    const code = `
      public class UserService {
        public void createUser(String name) { }
      }
    `;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "java-test-"));
    const filePath = path.join(tmpDir, "Test.java");
    fs.writeFileSync(filePath, code);

    try {
      const symbols = parser.extractSymbols(filePath);
      const classes = symbols.filter((s) => s.type === "class");

      assert.ok(classes.length > 0);
      assert.strictEqual(classes[0].name, "UserService");
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  await t.test("should extract methods", () => {
    const code = `
      public class UserService {
        public void createUser(String name) { }
        private int calculateAge(String birthDate) { return 0; }
      }
    `;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "java-test-"));
    const filePath = path.join(tmpDir, "Test.java");
    fs.writeFileSync(filePath, code);

    try {
      const symbols = parser.extractSymbols(filePath);
      const methods = symbols.filter((s) => s.type === "method");

      assert.ok(methods.length >= 2);
      assert.ok(methods.some((m) => m.name === "createUser"));
      assert.ok(methods.some((m) => m.name === "calculateAge"));
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  await t.test("should extract interfaces", () => {
    const code = `
      public interface UserRepository {
        User findById(int id);
      }
    `;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "java-test-"));
    const filePath = path.join(tmpDir, "Test.java");
    fs.writeFileSync(filePath, code);

    try {
      const symbols = parser.extractSymbols(filePath);
      const interfaces = symbols.filter((s) => s.type === "interface");

      assert.ok(interfaces.length > 0);
      assert.strictEqual(interfaces[0].name, "UserRepository");
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  await t.test("should extract imports", () => {
    const code = `
      import java.util.List;
      import com.example.User;
      import static org.junit.jupiter.api.Assertions.*;

      public class UserService { }
    `;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "java-test-"));
    const filePath = path.join(tmpDir, "Test.java");
    fs.writeFileSync(filePath, code);

    try {
      const deps = parser.extractDependencies(filePath);
      const imports = deps.filter((d) => d.name.includes("import") === false);

      assert.ok(deps.length > 0);
      assert.ok(deps.some((d) => d.name.includes("java.util")));
      assert.ok(deps.some((d) => d.name.includes("com.example")));
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  await t.test("should find source files", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "java-test-"));

    try {
      fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "src", "Main.java"), "public class Main {}");
      fs.writeFileSync(path.join(tmpDir, "src", "User.java"), "public class User {}");

      const files = parser.findSourceFiles(tmpDir);

      assert.ok(files.length >= 2);
      assert.ok(files.some((f) => f.includes("Main.java")));
      assert.ok(files.some((f) => f.includes("User.java")));
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  await t.test("should skip excluded directories", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "java-test-"));

    try {
      fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
      fs.mkdirSync(path.join(tmpDir, "target"), { recursive: true });

      fs.writeFileSync(path.join(tmpDir, "src", "Main.java"), "public class Main {}");
      fs.writeFileSync(path.join(tmpDir, "target", "Compiled.java"), "public class Compiled {}");

      const files = parser.findSourceFiles(tmpDir);

      assert.ok(files.some((f) => f.includes("Main.java")));
      assert.ok(!files.some((f) => f.includes("target")));
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  await t.test("should extract method parameters", () => {
    const code = `
      public class UserService {
        public User createUser(String name, int age, boolean active) { return null; }
      }
    `;
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "java-test-"));
    const filePath = path.join(tmpDir, "Test.java");
    fs.writeFileSync(filePath, code);

    try {
      const symbols = parser.extractSymbols(filePath);
      const createUserMethod = symbols.find((s) => s.name === "createUser");

      assert.ok(createUserMethod);
      assert.ok(createUserMethod?.parameters);
      assert.ok(createUserMethod!.parameters!.length > 0);
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  await t.test("should search by pattern", () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "java-test-"));

    try {
      fs.mkdirSync(path.join(tmpDir, "src"), { recursive: true });
      fs.writeFileSync(path.join(tmpDir, "src", "Main.java"), "public class Main {\n  private String userName;\n}");

      const results = parser.searchByPattern(tmpDir, "userName");

      assert.ok(results.length > 0);
      assert.ok(results[0].matchedText.includes("userName"));
    } finally {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });
});
