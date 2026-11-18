import { parse } from "acorn";

// Locate literal parameter values without rewriting the surrounding JavaScript,
// formatting, comments, or other properties. Models remain ordinary JS files.
export function locateParameter(source, name) {
  const ast = parse(source, { ecmaVersion: "latest", sourceType: "script" });
  const declarations = [];
  for (const statement of ast.body) {
    if (statement.type === "VariableDeclaration") declarations.push(...statement.declarations);
  }
  const matches = declarations.filter(decl =>
    decl.id.type === "Identifier" && decl.id.name === "defaultParams"
  );
  if (matches.length !== 1 || matches[0].init?.type !== "ObjectExpression") {
    throw new Error("Editable parameters require one top-level const defaultParams = { ... } declaration.");
  }
  const matchesName = property => {
    if (property.type !== "Property" || property.computed || property.method) return false;
    return property.key.type === "Identifier"
      ? property.key.name === name
      : property.key.type === "Literal" && property.key.value === name;
  };
  const properties = matches[0].init.properties.filter(matchesName);
  if (properties.length !== 1) throw new Error("Parameter '" + name + "' must appear exactly once in defaultParams.");
  const property = properties[0];
  if (property.shorthand) throw new Error("Parameter '" + name + "' is shorthand; use " + name + ": value.");
  const node = property.value;
  const literal = node.type === "Literal" && ["number", "string", "boolean"].includes(typeof node.value);
  const negativeNumber = node.type === "UnaryExpression" && ["-", "+"].includes(node.operator) &&
    node.argument.type === "Literal" && typeof node.argument.value === "number";
  if (!literal && !negativeNumber) {
    throw new Error("Parameter '" + name + "' must have a directly editable number, string, or boolean literal.");
  }
  return { from: node.start, to: node.end };
}

export function parameterEdit(source, name, value) {
  if (typeof value === "number" && !Number.isFinite(value)) {
    throw new Error("Parameter '" + name + "' must be a finite number.");
  }
  if (!["number", "string", "boolean"].includes(typeof value)) {
    throw new Error("Unsupported parameter type for '" + name + "'.");
  }
  const { from, to } = locateParameter(source, name);
  const insert = JSON.stringify(value);
  return { from, to, insert, source: source.slice(0, from) + insert + source.slice(to) };
}
