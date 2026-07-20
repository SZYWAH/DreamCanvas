import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const styles = readFileSync("src/styles.css", "utf8").toLowerCase();

describe("冷银灰主题色", () => {
  it("暗色与亮色主题使用确定的冷银灰正向状态", () => {
    expect(styles).toContain("--success: #c9ced6;");
    expect(styles).toContain("--success-muted: #a7aeb8;");
    expect(styles).toContain("--success-bg: #15181c;");
    expect(styles).toContain("--success-border: #343a42;");
    expect(styles).toContain("--text-muted: #7d7d7d;");
    expect(styles).toContain("--success: #59616d;");
    expect(styles).toContain("--success-muted: #626b76;");
    expect(styles).toContain("--success-bg: #eef1f4;");
    expect(styles).toContain("--success-border: #cbd1d8;");
    expect(styles).toContain("--text-muted: #707070;");
    expect(styles).toContain(".viewer-notice.success { color: #c9ced6; }");
  });

  it("不再包含旧绿色或绿色命名色", () => {
    for (const oldColor of ["#75a987", "#0c1b12", "#254f34", "#397650", "#eaf4ed", "#bdd8c5", "#9bc4a8"]) {
      expect(styles).not.toContain(oldColor);
    }
    expect(styles).not.toMatch(/\b(?:green|emerald|teal)\b/);
  });
});
