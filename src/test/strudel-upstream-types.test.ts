// @vitest-environment node
import { describe, expect, it } from "vitest";
import ts from "typescript";
import { auditExamples } from "../../scripts/audit-strudel-types";
import api from "@/features/language/strudel-api.generated.json";
import { strudelTypes } from "@/features/language/strudel-types";
import { JavaScriptIntelligence } from "@/features/language/javascript-intelligence";

describe("installed Strudel compatibility", () => {
  it("checks every supported upstream example without the IDE's 40-error display cap", () => {
    const audit = auditExamples();
    expect(audit.examples.length).toBeGreaterThanOrEqual(416);
    expect(audit.excluded).toHaveLength(26);
    expect(audit.excluded.every((example) => example.reason.length > 0)).toBe(true);
    expect(audit.diagnostics).toEqual([]);
  });

  it("declares every catalogued global, constructor and method", () => {
    const tree = ts.createSourceFile("strudel.d.ts", strudelTypes, ts.ScriptTarget.Latest, true);
    const globals = new Set<string>();
    const methods = new Set<string>();
    for (const statement of tree.statements) {
      if (ts.isFunctionDeclaration(statement) && statement.name) globals.add(statement.name.text);
      if (ts.isVariableStatement(statement))
        for (const declaration of statement.declarationList.declarations)
          if (ts.isIdentifier(declaration.name)) globals.add(declaration.name.text);
      if (ts.isInterfaceDeclaration(statement) && statement.name.text === "Pattern")
        for (const member of statement.members)
          if (member.name) methods.add(member.name.getText(tree));
    }
    expect(
      api.names.filter(
        (name) => !["in", "var", "super", "default"].includes(name) && !globals.has(name),
      ),
    ).toEqual([]);
    expect(api.constructors.filter((name) => !globals.has(name))).toEqual([]);
    expect(api.methods.filter((name) => !methods.has(name))).toEqual([]);
  });

  it("handles aliases, curried operators, callbacks and core constructors together", () => {
    const service = new JavaScriptIntelligence();
    const uri = "file:///compatibility.js";
    try {
      service.update(
        uri,
        `
const gate = "<[0 1] 1 1 1>/16".early(0.5);
stack(s("bd"), s("hh")).mask(gate).fm2(rand.mul(4)).fmh3(0.1);
n(irand(8).sub(3).seg(16)).scale("C:minor");
freq("110".mul.out(".5 1.5")).gain(brandBy(.4));
"0 1 2".withValue(value => value + 10).note();
"c3 e3".sub(12).note();
s("saw").lfo().env({ a: .1 }, 1).bmod({ b: 1 }).tremsync(4).tremolodepth(.5);
s("saw").diode(.3).soft("<1 2>").scope();
mini("0 1 2").fmap(value => value + 1).n();
mask(gate)(s("bd"));
struct(gate, s("hh"));
withValue(value => value + 1, pure(2));
s("bd").when(rand.gte(.5), pattern => pattern.tag("accent").filter(hap => hap.hasTag("accent")));
const span = new TimeSpan(0, 1);
const state = new State(span);
const custom = new Pattern(query => [new Hap(query.span, query.span, 60)]);
custom.query(state);
Fraction("1/2").mul(2);
`,
        1,
      );
      expect(service.diagnostics(uri, Infinity)).toEqual([]);
      service.update(
        uri,
        's("bd").gain({ invalid: true }); irand({ invalid: true }); s("bd").inventedControl(1);',
        2,
      );
      const errors = service.diagnostics(uri);
      expect(errors).toHaveLength(3);
      expect(errors.some((error) => error.message.includes("inventedControl"))).toBe(true);
      expect(errors.some((error) => error.message.includes("invalid"))).toBe(true);
    } finally {
      service.dispose();
    }
  });
});
