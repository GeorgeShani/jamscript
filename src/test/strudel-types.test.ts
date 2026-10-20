import { describe, expect, it } from "vitest";
import ts from "typescript";
import { strudelTypes } from "@/features/language/strudel-types";
import { JavaScriptIntelligence } from "@/features/language/javascript-intelligence";

function intelligence(source: string) {
  const service = new JavaScriptIntelligence();
  const uri = "file:///types.js";
  service.update(uri, source, 1);
  return { service, uri };
}

describe("Strudel type declarations", () => {
  it("infers numeric patterns from irand and keeps arithmetic and seg chainable", () => {
    const source = `const random = irand(8).sub(3).seg(16);
n(random);
n(irand("<4 8>").sub(3).seg(16));
random;`;
    const { service, uri } = intelligence(source);
    try {
      expect(service.diagnostics(uri)).toEqual([]);
      expect(service.hover(uri, source.lastIndexOf("random") + 2)?.contents.value).toContain(
        "Pattern<number>",
      );
    } finally {
      service.dispose();
    }
  });
  it("accepts transformed mini-notation as masks, structures and conditions", () => {
    const source = `const gate = "<[0 1] 1 1 1>/16".early(0.5);
const drums = stack(s("bd"), s("hh")).bank("crate").mask(gate);
s("bd").struct("x ~ x ~".early(0.5).slow(2));
s("hh").when(gate, pattern => pattern.gain(0.5));
drums;`;
    const { service, uri } = intelligence(source);
    try {
      expect(service.diagnostics(uri)).toEqual([]);
      expect(service.hover(uri, source.lastIndexOf("drums") + 2)?.contents.value).toContain(
        "Pattern<ControlMap>",
      );
    } finally {
      service.dispose();
    }
  });
  it("compiles every generated signature without implicit any or malformed JSDoc types", () => {
    const target = "/strudel.d.ts";
    const options: ts.CompilerOptions = {
      noEmit: true,
      types: [],
      lib: ["lib.es2022.d.ts"],
      target: ts.ScriptTarget.ES2022,
      strict: true,
    };
    const host = ts.createCompilerHost(options);
    const original = host.getSourceFile;
    host.getSourceFile = (name, ...args) =>
      name === target
        ? ts.createSourceFile(name, strudelTypes, ts.ScriptTarget.Latest, true)
        : original(name, ...args);
    const errors = ts.getPreEmitDiagnostics(ts.createProgram([target], options, host));
    expect(errors.map((error) => ts.flattenDiagnosticMessageText(error.messageText, "\n"))).toEqual(
      [],
    );
    expect(strudelTypes).not.toMatch(/:\s*any\b/);
  });

  it("infers generic callback values, transformed returns and event records", () => {
    const source =
      'const formatted = pure(1).fmap(value => value.toFixed(2));\nconst events = s("bd").queryArc(0, 1);\nconst mixed = stack(pure(1), pure(true));\nconst transformed = fast(2)(pure(1));\nformatted; events; mixed; transformed';
    const { service, uri } = intelligence(source);
    try {
      expect(service.diagnostics(uri)).toEqual([]);
      expect(service.hover(uri, source.lastIndexOf("formatted") + 2)?.contents.value).toContain(
        "Pattern<string>",
      );
      expect(service.hover(uri, source.lastIndexOf("events") + 2)?.contents.value).toContain(
        "Hap<ControlMap>[]",
      );
      const callback = source.indexOf("value.toFixed") + 2;
      expect(service.hover(uri, callback)?.contents.value).toContain("value: number");
      expect(service.hover(uri, source.lastIndexOf("mixed") + 2)?.contents.value).toContain(
        "Pattern<number | boolean>",
      );
      expect(service.hover(uri, source.lastIndexOf("transformed") + 2)?.contents.value).toContain(
        "Pattern<number>",
      );
    } finally {
      service.dispose();
    }
  });

  it("shows typed overloads and sample-loading promises in all IntelliSense surfaces", () => {
    const source = 'const loading = samples({ bd: ["kick.wav"] }, "/audio/");\nloading; fast(2, ';
    const { service, uri } = intelligence(source);
    try {
      expect(service.hover(uri, source.indexOf("loading;") + 2)?.contents.value).toContain(
        "Promise<void>",
      );
      const signature = service.signature(uri, source.length);
      expect(signature?.signatures).toHaveLength(2);
      expect(signature?.activeParameter).toBe(1);
      expect(signature?.signatures[1]?.label).toContain("Pattern<unknown>");
      expect(signature?.signatures[1]?.label).toContain("string");
      service.update(uri, 's("bd").gai', 2);
      const completion = service
        .completions(uri, 11, "gai")
        .items.find((entry) => entry.label === "gain");
      expect(completion?.detail).toContain("PatternArgument<number>");
      expect(completion?.documentation.value).toContain("Pattern<ControlMap>");
    } finally {
      service.dispose();
    }
  });

  it("keeps musical strings, shared transforms, optional controls and source-backed aliases valid", () => {
    const source = `samples('github:eddyflux/crate')
setcps(.75)
let chords = chord("<Bbm9 Fm9>/4").dict('ireal')
stack(
  s("bd").struct("<[x*<1 2> [~@3 x]] x>").gain("<.4 .8>"),
  n("[0 <1 3>]*<2!3 4>").s("hh").rarely(ply("2")),
  chords.offset(-1).voicing().s("gm_epiano1:1").phaser(4).room(.5),
  n("<0!3 1*2>").set(chords).mode("root:g2").voicing().s("gm_acoustic_bass"),
  chords.n("[0 <4 3 <2 5>>*2](<3 5>,8)").anchor("D5").voicing()
    .segment(4).clip(rand.range(.4,.8)).fm(sine.range(3,8).slow(8))
    .lpf(sine.range(500,1000).slow(8)).lpq(5)
    .rarely(ply("2")).chunk(4, fast(2)).gain(perlin.range(.6,.9))
).late("[0 .01]*4").size(4)
"0 1".early(.5)
pure(60).note()
s("bd").when("0 1", pattern => pattern.gain(.5))
slow(2, s("hh"))`;
    const { service, uri } = intelligence(source);
    try {
      expect(service.diagnostics(uri)).toEqual([]);
    } finally {
      service.dispose();
    }
  });

  it("reports definite invalid arguments and respects locally shadowed functions", () => {
    const source =
      's("bd").gain({ invalid: true });\nfunction samples(count) { return count + 1 }\nsamples(2';
    const { service, uri } = intelligence(source);
    try {
      expect(service.diagnostics(uri).some((error) => error.message.includes("invalid"))).toBe(
        true,
      );
      const signature = service.signature(uri, source.length);
      expect(signature?.signatures[0]?.label).toContain("samples(count:");
      expect(signature?.signatures[0]?.label).not.toContain("SampleMap");
    } finally {
      service.dispose();
    }
  });
});
