import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const packageRoot = fileURLToPath(new URL("../node_modules/@strudel/web/", import.meta.url));
const pkg = JSON.parse(readFileSync(`${packageRoot}package.json`, "utf8"));
const bundle = readFileSync(`${packageRoot}dist/index.mjs`, "utf8");
const exports = bundle.slice(bundle.lastIndexOf("\nexport {"));
const names = [...exports.matchAll(/\b(?:as\s+)?([A-Za-z_$][\w$]*)\s*,?\s*(?=\n)/g)]
  .map((match) => match[1])
  .filter((name) => /^[a-z][a-zA-Z0-9]*$/.test(name));
const gm = (await import("@strudel/soundfonts/gm.mjs")).default;
const documentation = {};
const methods = new Set();
const typing = {};
function describe(node, tree) {
  const tags = ts.getJSDocTags(node);
  const comment = (tag) => (typeof tag.comment === "string" ? tag.comment : "");
  const parameters = tags
    .filter(ts.isJSDocParameterTag)
    .map((tag) => ({
      name: tag.name.getText(tree),
      type: tag.typeExpression?.type.getText(tree) ?? "unknown",
      optional: !!tag.isBracketed,
      description: comment(tag),
    }))
    .filter((parameter) => /^[\w$]+$/.test(parameter.name));
  const returns = tags.find(ts.isJSDocReturnTag);
  return {
    parameters,
    returns:
      returns?.typeExpression?.type.getText(tree) ??
      comment(returns ?? {}).match(/^[\w[\]|<>]+/)?.[0] ??
      "unknown",
  };
}
function scan(directory) {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    if (["dist", "test", "node_modules"].includes(entry.name)) continue;
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) {
      scan(path);
      continue;
    }
    if (!entry.name.endsWith(".mjs")) continue;
    const source = readFileSync(path, "utf8");
    const tree = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.JS);
    function visit(node) {
      if (
        (ts.isVariableStatement(node) || ts.isFunctionDeclaration(node)) &&
        ts.isSourceFile(node.parent)
      ) {
        const info = describe(node, tree);
        const declarations = ts.isVariableStatement(node)
          ? node.declarationList.declarations
          : [node];
        for (const declaration of declarations) {
          const bound = ts.isObjectBindingPattern(declaration.name)
            ? declaration.name.elements.map((element) => element.name.getText(tree))
            : declaration.name
              ? [declaration.name.getText(tree)]
              : [];
          const initializer = declaration.initializer;
          const registration =
            initializer && ts.isCallExpression(initializer)
              ? initializer.expression.getText(tree)
              : "";
          const transform = /^(register|stepRegister)$/.test(registration);
          const control = /^(registerControl|registerMultiControl)$/.test(registration);
          const callable = transform
            ? initializer.arguments.find(
                (argument) => ts.isFunctionExpression(argument) || ts.isArrowFunction(argument),
              )
            : ts.isFunctionDeclaration(declaration)
              ? declaration
              : initializer &&
                  (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
                ? initializer
                : undefined;
          const actual = callable?.parameters
            .map((parameter) => ({
              name: parameter.name.getText(tree),
              type: "unknown",
              optional: !!parameter.initializer || !!parameter.questionToken,
              rest: !!parameter.dotDotDotToken,
            }))
            .filter((parameter) => /^[\w$]+$/.test(parameter.name));
          const parameters =
            actual?.map((parameter, index) => ({
              ...parameter,
              ...(info.parameters.find((p) => p.name === parameter.name) ?? info.parameters[index]),
              name: parameter.name,
              optional: parameter.optional || !!info.parameters[index]?.optional,
            })) ?? info.parameters;
          const aliases =
            initializer &&
            ts.isCallExpression(initializer) &&
            transform &&
            ts.isArrayLiteralExpression(initializer.arguments[0])
              ? initializer.arguments[0].elements
                  .filter(ts.isStringLiteral)
                  .map((element) => element.text)
              : [];
          for (const name of new Set([...bound, ...aliases]))
            if (
              /^[\w$]+$/.test(name) &&
              (control || transform || callable || info.parameters.length)
            ) {
              const entry = {
                kind: control ? "control" : transform ? "transform" : "function",
                parameters,
                returns: control || transform ? "Pattern" : info.returns,
              };
              if (!typing[name] || typing[name].returns === "unknown") typing[name] = entry;
            }
        }
      }
      if (
        ts.isCallExpression(node) &&
        /^(register|stepRegister|registerControl|registerMultiControl)$/.test(
          node.expression.getText(tree),
        )
      ) {
        for (const argument of node.arguments) {
          const values = ts.isArrayLiteralExpression(argument) ? argument.elements : [argument];
          for (const value of values) if (ts.isStringLiteral(value)) methods.add(value.text);
        }
      }
      if (ts.isClassDeclaration(node) && node.name?.text === "Pattern") {
        for (const member of node.members)
          if (ts.isMethodDeclaration(member) && member.name) {
            const name = member.name.getText(tree);
            methods.add(name);
            const info = describe(member, tree);
            typing[name] = {
              kind: "method",
              ...info,
              parameters: member.parameters.map((parameter, index) => ({
                name: parameter.name.getText(tree),
                type: "unknown",
                ...info.parameters[index],
                name: parameter.name.getText(tree),
                optional: !!parameter.initializer || !!info.parameters[index]?.optional,
                rest: !!parameter.dotDotDotToken,
              })),
            };
          }
      }
      ts.forEachChild(node, visit);
    }
    visit(tree);
    for (const match of source.matchAll(/Pattern\.prototype\.([\w$]+)\s*=/g)) methods.add(match[1]);
    for (const match of source.matchAll(
      /\/\*\*([\s\S]*?)\*\/\s*(?:export\s+)?(?:const\s+(\{[^}]*\}|[\w$]+)|function\s+([\w$]+))/g,
    )) {
      const comment = match[1].replace(/^\s*\* ?/gm, "").trim();
      const detail = comment
        .split(/\n\s*@/)[0]
        .trim()
        .slice(0, 1800);
      const named = comment.match(/@name\s+([\w$]+)/)?.[1];
      const declared = (match[2] ?? match[3]).match(/[A-Za-z_$][\w$]*/g) ?? [];
      const parameters = [
        ...comment.matchAll(/@param\s+(?:\{([^}]+)\}\s+)?(\[?[\w$]+(?:=[^\]\s]+)?\]?)/g),
      ].map((param) => ({
        name: param[2].replace(/[\[\]]/g, "").split("=")[0],
        type: param[1] ?? "any",
        optional: param[2].startsWith("["),
      }));
      for (const name of new Set([...(named ? [named] : []), ...declared])) {
        if (detail && !documentation[name])
          documentation[name] = {
            signature: `${name}(${parameters.map((p) => p.name).join(", ")})`,
            detail,
            parameters,
          };
      }
    }
  }
}
for (const pkg of ["core", "webaudio", "tonal", "mini", "draw"])
  scan(fileURLToPath(new URL(`../node_modules/@strudel/${pkg}/`, import.meta.url)));
const output = {
  package: "@strudel/web",
  version: pkg.version,
  names: [...new Set([...names, "setcps", "setcpm", "setbpm", "hush"])].sort(),
  sounds: Object.keys(gm).sort(),
  methods: [...methods].filter((name) => /^[a-zA-Z_$][\w$]*$/.test(name)).sort(),
  documentation,
  typing,
};
writeFileSync(
  fileURLToPath(new URL("../src/features/language/strudel-api.generated.json", import.meta.url)),
  `${JSON.stringify(output, null, 2)}\n`,
);
