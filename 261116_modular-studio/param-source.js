import { parse } from "acorn";

// Only change literal tokens inside the user's original file. No parallel
// parameter database and no rewrite of unrelated whitespace or comments.
export function locateParameter(source, name) {
  const ast = parse(source, { ecmaVersion: "latest", sourceType: "script" });
  const matches = ast.body.filter(s => s.type === "VariableDeclaration")
    .flatMap(s => s.declarations).filter(d => d.id.type === "Identifier" && d.id.name === "defaultParams");
  if (matches.length !== 1 || matches[0].init?.type !== "ObjectExpression") {
    throw Error("Expected one top-level const defaultParams = { ... }.");
  }
  const properties = matches[0].init.properties.filter(p =>
    p.type === "Property" && !p.computed && !p.shorthand &&
    (p.key.name === name || p.key.value === name));
  if (properties.length !== 1) throw Error("Parameter " + name + " is not an editable property.");
  const node = properties[0].value;
  const literal = node.type === "Literal" && ["number","boolean","string"].includes(typeof node.value);
  const negativeNumber = node.type === "UnaryExpression" && ["-","+"].includes(node.operator) &&
    node.argument.type === "Literal" && typeof node.argument.value === "number";
  if (!literal && !negativeNumber) throw Error(name + " must be a literal number, string or boolean.");
  return { from: node.start, to: node.end };
}
export function editParameter(source, name, value) {
  if (!["number","boolean","string"].includes(typeof value) ||
      (typeof value === "number" && !Number.isFinite(value))) throw Error("Invalid parameter value.");
  const range = locateParameter(source, name);
  const insert = JSON.stringify(value);
  return { ...range, insert, source: source.slice(0,range.from) + insert + source.slice(range.to) };
}
