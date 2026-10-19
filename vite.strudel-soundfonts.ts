import type { Plugin } from "vite";

/** Parse WebAudioFont preset data without executing the downloaded source. */
export function parseStrudelSoundfontsWithoutEval(): Plugin {
  return {
    name: "parse-strudel-soundfonts-without-eval",
    enforce: "pre",
    transform(source, id) {
      if (!id.replaceAll("\\", "/").endsWith("/@strudel/soundfonts/dist/index.mjs")) return;
      const expression = 'return eval("{" + data);';
      if (!source.includes(expression))
        throw new Error("Strudel's soundfont loader changed; review the desktop parser");
      // Presets are object literals with comments and unquoted keys. The
      // upstream eval returns their zones array; preserve that return shape.
      return `import JSON5 from "json5";\n${source.replace(
        expression,
        'return JSON5.parse(("{" + data).replace(/;\\s*$/, "")).zones;',
      )}`;
    },
  };
}
