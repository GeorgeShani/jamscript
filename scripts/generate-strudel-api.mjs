import { readFileSync, writeFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const packageRoot = fileURLToPath(new URL("../node_modules/@strudel/web/", import.meta.url));
const pkg = JSON.parse(readFileSync(`${packageRoot}package.json`, "utf8"));
const bundle = readFileSync(`${packageRoot}dist/index.mjs`, "utf8");
const exports = bundle.slice(bundle.lastIndexOf("\nexport {"));
const names = [...exports.matchAll(/\b(?:as\s+)?([A-Za-z_$][\w$]*)\s*,?\s*(?=\n)/g)]
  .map((match) => match[1])
  .filter((name) => /^[A-Za-z][a-zA-Z0-9]*$/.test(name));
const gm = (await import("@strudel/soundfonts/gm.mjs")).default;
const documentation = {};
const methods = new Set();
const typing = {};
const methodTyping = {};
const declarationsToInfer = [];
const valueTypes = new Map();
const operators = new Set();
const patternFactories = new Map();
const methodAliases = [];
const actualParameters = (callable, info, tree) => {
  const named = callable.parameters.some((parameter) =>
    info.parameters.some((documented) => documented.name === parameter.name.getText(tree)),
  );
  return callable.parameters
    .map((parameter, index) => {
      const documented =
        info.parameters.find((p) => p.name === parameter.name.getText(tree)) ??
        (!named ? info.parameters[index] : undefined);
      return {
        type: "unknown",
        ...documented,
        name: parameter.name.getText(tree),
        optional: !!parameter.initializer || !!parameter.questionToken || !!documented?.optional,
        rest: !!parameter.dotDotDotToken,
      };
    })
    .filter((parameter) => /^[\w$]+$/.test(parameter.name));
};
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
          const curried = registration === "curry";
          const callable =
            transform || curried
              ? initializer.arguments.find(
                  (argument) => ts.isFunctionExpression(argument) || ts.isArrowFunction(argument),
                )
              : ts.isFunctionDeclaration(declaration)
                ? declaration
                : initializer &&
                    (ts.isArrowFunction(initializer) || ts.isFunctionExpression(initializer))
                  ? initializer
                  : undefined;
          const parameters = callable ? actualParameters(callable, info, tree) : info.parameters;
          if (callable && bound.length === 1 && callable.parameters[0]) {
            const key = callable.parameters[0].name.getText(tree);
            function findFactory(node) {
              if (
                ts.isBinaryExpression(node) &&
                ts.isElementAccessExpression(node.left) &&
                node.left.expression.getText(tree) === "Pattern.prototype" &&
                node.left.argumentExpression.getText(tree) === key &&
                (ts.isFunctionExpression(node.right) || ts.isArrowFunction(node.right))
              )
                patternFactories.set(bound[0], node.right);
              ts.forEachChild(node, findFactory);
            }
            findFactory(callable);
          }
          const factory = patternFactories.get(registration);
          if (
            factory &&
            initializer &&
            ts.isCallExpression(initializer) &&
            ts.isStringLiteral(initializer.arguments[0])
          ) {
            const name = initializer.arguments[0].text;
            methods.add(name);
            const entry = {
              kind: "control",
              parameters: actualParameters(factory, info, tree),
              returns: "Pattern",
              parametersKnown: true,
            };
            typing[name] = entry;
            methodTyping[name] = entry;
          }
          const aliases =
            initializer && ts.isCallExpression(initializer) && transform
              ? (ts.isArrayLiteralExpression(initializer.arguments[0])
                  ? initializer.arguments[0].elements
                  : [initializer.arguments[0]]
                )
                  .filter(ts.isStringLiteral)
                  .map((element) => element.text)
              : [];
          const controlNames =
            control && ts.isCallExpression(initializer)
              ? initializer.arguments.flatMap((argument, index) => {
                  if (ts.isStringLiteral(argument)) return [argument.text];
                  if (index === 0 && ts.isArrayLiteralExpression(argument))
                    return argument.elements.filter(ts.isStringLiteral).map((value) => value.text);
                  return [];
                })
              : [];
          for (const name of new Set([...bound, ...aliases, ...controlNames]))
            if (
              /^[\w$]+$/.test(name) &&
              (control || transform || callable || info.parameters.length)
            ) {
              const entry = {
                kind: control ? "control" : transform ? "transform" : "function",
                parameters,
                returns: control || transform ? "Pattern" : info.returns,
                parametersKnown: !!callable || parameters.length > 0 || control,
              };
              if (!typing[name] || typing[name].returns === "unknown" || control || transform)
                typing[name] = entry;
              if (control || transform) methodTyping[name] = entry;
            }
          for (const name of bound)
            declarationsToInfer.push({ name, initializer, callable, curried });
          if (
            control &&
            registration === "registerMultiControl" &&
            ts.isNumericLiteral(initializer.arguments[1])
          ) {
            const count = Number(initializer.arguments[1].text);
            const first = initializer.arguments[0];
            const base = ts.isStringLiteral(first)
              ? first.text
              : ts.isArrayLiteralExpression(first) && ts.isStringLiteral(first.elements[0])
                ? first.elements[0].text
                : null;
            const bases = [
              base,
              ...initializer.arguments
                .slice(2)
                .filter(ts.isStringLiteral)
                .map((arg) => arg.text),
            ].filter(Boolean);
            for (const base of bases)
              for (let index = 1; index <= count; index++) {
                const name = `${base}${index}`;
                methods.add(name);
                methodTyping[name] = {
                  ...methodTyping[base],
                  kind: "control",
                  returns: "Pattern",
                  parameters: methodTyping[base]?.parameters ?? [],
                  parametersKnown: true,
                };
              }
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
            methodTyping[name] = {
              kind: "method",
              ...info,
              parameters: actualParameters(member, info, tree),
              parametersKnown: true,
            };
            declarationsToInfer.push({ name, callable: member, method: true });
          }
      }
      if (
        ts.isBinaryExpression(node) &&
        node.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
        ts.isPropertyAccessExpression(node.left) &&
        node.left.expression.getText(tree) === "Pattern.prototype"
      ) {
        const name = node.left.name.text;
        methods.add(name);
        if (ts.isFunctionExpression(node.right) || ts.isArrowFunction(node.right)) {
          const info = describe(node.parent, tree);
          methodTyping[name] = {
            kind: "method",
            ...info,
            parameters: actualParameters(node.right, info, tree),
            parametersKnown: true,
          };
          declarationsToInfer.push({ name, callable: node.right, method: true });
        }
        if (
          ts.isPropertyAccessExpression(node.right) &&
          node.right.expression.getText(tree) === "Pattern.prototype"
        )
          methodAliases.push([name, node.right.name.text]);
      }
      if (
        ts.isVariableDeclaration(node) &&
        ts.isIdentifier(node.name) &&
        node.name.text === "composers" &&
        node.initializer &&
        ts.isObjectLiteralExpression(node.initializer)
      ) {
        for (const property of node.initializer.properties) {
          if (!ts.isPropertyAssignment(property) || !ts.isIdentifier(property.name)) continue;
          const name = property.name.text;
          operators.add(name);
          methods.add(name);
          methodTyping[name] = {
            kind: "operator",
            parameters: [{ name: "value", type: "unknown" }],
            returns: "Pattern",
            parametersKnown: true,
          };
          typing[name] = { ...methodTyping[name] };
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(tree);
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
for (const [name, original] of methodAliases)
  if (methodTyping[original] ?? typing[original])
    methodTyping[name] = methodTyping[original] ?? typing[original];

// Infer only results supported by the AST. Follow aliases and pattern-valued
// receivers to a fixed point; never turn an arbitrary undocumented helper into
// a Pattern merely because its name sounds musical.
function inferExpression(node, locals = new Map(), method = false) {
  if (!node) return "unknown";
  if (ts.isNumericLiteral(node)) return "number";
  if (ts.isStringLiteralLike(node)) return "string";
  if (node.kind === ts.SyntaxKind.TrueKeyword || node.kind === ts.SyntaxKind.FalseKeyword)
    return "boolean";
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.ExclamationToken)
    return "boolean";
  if (ts.isBinaryExpression(node)) {
    if (
      [
        ts.SyntaxKind.EqualsEqualsToken,
        ts.SyntaxKind.EqualsEqualsEqualsToken,
        ts.SyntaxKind.ExclamationEqualsToken,
        ts.SyntaxKind.ExclamationEqualsEqualsToken,
        ts.SyntaxKind.LessThanToken,
        ts.SyntaxKind.GreaterThanToken,
        ts.SyntaxKind.LessThanEqualsToken,
        ts.SyntaxKind.GreaterThanEqualsToken,
      ].includes(node.operatorToken.kind)
    )
      return "boolean";
    const left = inferExpression(node.left, locals, method);
    const right = inferExpression(node.right, locals, method);
    if (
      node.operatorToken.kind === ts.SyntaxKind.PlusToken &&
      left === "number" &&
      right === "number"
    )
      return "number";
    if (
      [
        ts.SyntaxKind.MinusToken,
        ts.SyntaxKind.AsteriskToken,
        ts.SyntaxKind.SlashToken,
        ts.SyntaxKind.PercentToken,
      ].includes(node.operatorToken.kind) &&
      (left === "number" || right === "number")
    )
      return "number";
  }
  if (node.kind === ts.SyntaxKind.ThisKeyword) return method ? "Pattern" : "unknown";
  if (ts.isParenthesizedExpression(node)) return inferExpression(node.expression, locals, method);
  if (ts.isIdentifier(node)) return locals.get(node.text) ?? valueTypes.get(node.text) ?? "unknown";
  if (ts.isNewExpression(node) && node.expression.getText() === "Pattern") return "Pattern";
  if (ts.isCallExpression(node)) {
    if (
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText() === "Math"
    )
      return "number";
    if (
      ts.isIdentifier(node.expression) &&
      ["Number", "parseFloat", "parseInt"].includes(node.expression.text)
    )
      return "number";
    if (ts.isIdentifier(node.expression) && node.expression.text === "String") return "string";
    if (ts.isIdentifier(node.expression))
      return node.expression.text === "reify"
        ? "Pattern"
        : (typing[node.expression.text]?.returns ?? "unknown");
    if (
      ts.isPropertyAccessExpression(node.expression) &&
      inferExpression(node.expression.expression, locals, method) === "Pattern"
    ) {
      const name = node.expression.name.text;
      return methodTyping[name]?.returns ?? typing[name]?.returns ?? "unknown";
    }
  }
  if (ts.isConditionalExpression(node)) {
    const left = inferExpression(node.whenTrue, locals, method);
    return left === inferExpression(node.whenFalse, locals, method) ? left : "unknown";
  }
  return "unknown";
}
for (let pass = 0; pass < 12; pass++) {
  for (const declaration of declarationsToInfer) {
    const { name, callable, initializer, method } = declaration;
    const target = method ? methodTyping : typing;
    if (!callable) {
      if (initializer && ts.isIdentifier(initializer) && typing[initializer.text]) {
        target[name] ??= { ...typing[initializer.text] };
      }
      const result = inferExpression(initializer);
      if (result === "Pattern") {
        valueTypes.set(name, result);
        target[name] = { kind: "value", parameters: [], returns: result, parametersKnown: true };
      }
      continue;
    }
    if (
      declaration.curried &&
      target[name]?.returns === "Pattern" &&
      target[name].kind !== "operator"
    )
      target[name].kind = "transform";
    if (target[name]?.returns !== "unknown") continue;
    const locals = new Map();
    for (const parameter of target[name]?.parameters ?? [])
      if (parameter.type === "Pattern") locals.set(parameter.name, "Pattern");
    const returns = [];
    function visit(node) {
      if (node !== callable && ts.isFunctionLike(node)) return;
      if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name))
        locals.set(node.name.text, inferExpression(node.initializer, locals, method));
      if (ts.isReturnStatement(node))
        returns.push(inferExpression(node.expression, locals, method));
      ts.forEachChild(node, visit);
    }
    if (callable.body && !ts.isBlock(callable.body))
      returns.push(inferExpression(callable.body, locals, method));
    else if (callable.body) visit(callable.body);
    if (returns.length && returns[0] !== "unknown" && returns.every((type) => type === returns[0]))
      target[name].returns = returns[0];
  }
}
const output = {
  package: "@strudel/web",
  version: pkg.version,
  names: [
    ...new Set([
      ...names.filter((name) => /^[a-z]/.test(name) || typing[name]),
      "setcps",
      "setcpm",
      "setbpm",
      "hush",
    ]),
  ].sort(),
  constructors: ["Pattern", "Hap", "TimeSpan", "Fraction", "State"],
  sounds: Object.keys(gm).sort(),
  methods: [...methods].filter((name) => /^[a-zA-Z_$][\w$]*$/.test(name)).sort(),
  documentation,
  typing,
  methodTyping: Object.fromEntries(
    Object.entries(methodTyping).filter(
      ([name, entry]) => JSON.stringify(entry) !== JSON.stringify(typing[name]),
    ),
  ),
  operators: [...operators].sort(),
};
writeFileSync(
  fileURLToPath(new URL("../src/features/language/strudel-api.generated.json", import.meta.url)),
  `${JSON.stringify(output, null, 2)}\n`,
);
