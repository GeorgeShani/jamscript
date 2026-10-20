import type { Plugin } from "vite";
import { RolldownMagicString } from "rolldown";

/** Parse WebAudioFont preset data without executing the downloaded source. */
export function parseStrudelSoundfontsWithoutEval(): Plugin {
  return {
    name: "parse-strudel-soundfonts-without-eval",
    enforce: "pre",
    transform: {
      filter: { id: /[\\/]@strudel[\\/]soundfonts[\\/]dist[\\/]index\.mjs$/ },
      handler(source, id) {
        const expression = 'return eval("{" + data);';
        if (!source.includes(expression))
          throw new Error("Strudel's soundfont loader changed; review the preset parser");
        // Presets are object literals with comments and unquoted keys. The
        // upstream eval returns their zones array; preserve that return shape.
        const output = new RolldownMagicString(source, { filename: id });
        const start = source.indexOf(expression);
        output.overwrite(
          start,
          start + expression.length,
          'return JSON5.parse(("{" + data).replace(/;\\s*$/, "")).zones;',
        );
        output.prepend('import JSON5 from "json5";\n');
        return { code: output.toString(), map: output.generateMap({ hires: true }).toString() };
      },
    },
  };
}
