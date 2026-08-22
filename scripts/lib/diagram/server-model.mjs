import { importsOf, loadProgram, relativeToRepo, ts } from "./program.mjs";

const MODULES_ROOT = "packages/server/src/modules/";
const CONTRACTS_ROOT = "packages/contracts/src/api/";

const moduleOf = (relative) =>
  relative.startsWith(MODULES_ROOT) ? relative.slice(MODULES_ROOT.length).split("/")[0] : undefined;

const calleeName = (call) => {
  const target = call.expression;
  if (ts.isIdentifier(target)) return target.text;
  if (ts.isPropertyAccessExpression(target))
    return `${target.expression.getText()}.${target.name.text}`;
  return "";
};

const eachCall = (node, visit) => {
  const walk = (current) => {
    if (ts.isCallExpression(current)) visit(current);
    ts.forEachChild(current, walk);
  };
  walk(node);
};

const topLevelConsts = (sourceFile) => {
  const found = [];
  sourceFile.forEachChild((node) => {
    if (!ts.isVariableStatement(node)) return;
    for (const declaration of node.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name) && declaration.initializer !== undefined) {
        found.push({ name: declaration.name.text, initializer: declaration.initializer });
      }
    }
  });
  return found;
};

const identifiersIn = (node) => {
  const names = new Set();
  const walk = (current) => {
    if (ts.isIdentifier(current)) names.add(current.text);
    ts.forEachChild(current, walk);
  };
  walk(node);
  return names;
};

const firstStringArgument = (call, at = 0) => {
  const argument = call.arguments[at];
  return argument !== undefined && ts.isStringLiteral(argument) ? argument.text : undefined;
};

const firstIdentifierArgument = (call, at = 0) => {
  const argument = call.arguments[at];
  if (argument === undefined) return undefined;
  if (ts.isIdentifier(argument)) return argument.text;
  if (ts.isPropertyAccessExpression(argument)) return argument.name.text;
  return undefined;
};

const readContracts = (program) => {
  const groups = new Map();
  for (const sourceFile of program.getSourceFiles()) {
    const relative = relativeToRepo(sourceFile.fileName);
    if (!relative.startsWith(CONTRACTS_ROOT) || sourceFile.isDeclarationFile) continue;

    let group;
    const operations = new Map();
    eachCall(sourceFile, (call) => {
      const callee = calleeName(call);
      if (callee === "HttpApiGroup.make") group = firstStringArgument(call);
      // Both spellings: `HttpApiEndpoint.post(op, path)` and the explicit-verb
      // form `HttpApiEndpoint.make("DELETE")(op, path)`.
      const verb = /^HttpApiEndpoint\.(get|post|put|patch|del|head|options)$/.exec(callee);
      const explicit =
        ts.isCallExpression(call.expression) &&
        calleeName(call.expression) === "HttpApiEndpoint.make"
          ? firstStringArgument(call.expression)
          : undefined;
      const method = verb !== null ? verb[1].replace(/^del$/, "delete").toUpperCase() : explicit;
      if (method === undefined) return;

      const operation = firstStringArgument(call);
      const route = firstStringArgument(call, 1);
      if (operation !== undefined) operations.set(operation, `${method} ${route ?? ""}`.trim());
    });

    const contract = relative.slice(CONTRACTS_ROOT.length).replace(/\.ts$/, "");
    if (group !== undefined) groups.set(contract, { group, operations });
  }
  return groups;
};

const endpointContract = (sourceFile) => {
  let found;
  const walk = (node) => {
    if (
      found === undefined &&
      ts.isTypeReferenceNode(node) &&
      node.typeName.getText() === "EndpointRequest" &&
      node.typeArguments?.length === 2
    ) {
      const [groupType, operationType] = node.typeArguments;
      const contract = groupType
        .getText()
        .replace(/^typeof\s+/, "")
        .split(".")[0];
      const operation =
        ts.isLiteralTypeNode(operationType) && ts.isStringLiteral(operationType.literal)
          ? operationType.literal.text
          : undefined;
      if (operation !== undefined) found = { contract, operation };
    }
    ts.forEachChild(node, walk);
  };
  walk(sourceFile);
  return found;
};

const dispatchesIn = (node) => {
  const tags = [];
  eachCall(node, (call) => {
    if (!calleeName(call).endsWith(".execute")) return;
    const tag = firstIdentifierArgument(call);
    if (tag !== undefined && /(Command|Query)$/.test(tag)) tags.push(tag);
  });
  return tags;
};

const kebab = (tag) =>
  tag
    .replace(/(Command|Query)$/, "")
    .replace(/([a-z0-9])([A-Z])/g, "$1-$2")
    .toLowerCase();

export const useCaseSlug = (module, tag) => `server-usecase-${module}-${kebab(tag)}`;

export const readServerModel = () => {
  const { program } = loadProgram("packages/server/tsconfig.src.json");
  const contracts = readContracts(program);
  const modules = new Map();

  const moduleFor = (name) => {
    if (!modules.has(name)) {
      modules.set(name, {
        name,
        events: new Set(),
        opEvents: new Map(),
        commands: new Map(),
        queries: new Map(),
        ports: new Map(),
        adapters: new Map(),
        roots: new Set(),
        resources: new Map(),
        checks: new Set(),
        policyPorts: new Set(),
        policyQueries: new Set(),
        handlers: new Map(),
        bindings: new Map(),
        endpoints: [],
        subscriptions: [],
      });
    }
    return modules.get(name);
  };

  const files = [];
  for (const sourceFile of program.getSourceFiles()) {
    if (sourceFile.isDeclarationFile) continue;
    const relative = relativeToRepo(sourceFile.fileName);
    const name = moduleOf(relative);
    if (name === undefined) continue;
    files.push({
      sourceFile,
      relative,
      inner: relative.slice(`${MODULES_ROOT}${name}/`.length),
      module: moduleFor(name),
    });
  }

  for (const { inner, module, sourceFile } of files) {
    if (!inner.endsWith(".events.ts")) continue;
    for (const { initializer, name } of topLevelConsts(sourceFile)) {
      if (ts.isCallExpression(initializer) && calleeName(initializer) === "Event.make") {
        module.events.add(name);
      }
    }
  }

  for (const { inner, module, sourceFile } of files) {
    if (!/\.root\.ts$/.test(inner)) continue;
    sourceFile.forEachChild((node) => {
      if (ts.isClassDeclaration(node) && node.name !== undefined) module.roots.add(node.name.text);
    });
  }

  for (const { inner, module, sourceFile } of files) {
    if (!/\.(root-ops|entity-ops|aggregate-ops)\.ts$/.test(inner)) continue;
    const locals = new Map(topLevelConsts(sourceFile).map((c) => [c.name, c.initializer]));
    const eventsOf = (initializer) =>
      [...identifiersIn(initializer)].filter((identifier) => module.events.has(identifier));

    for (const { initializer, name } of topLevelConsts(sourceFile)) {
      if (!ts.isObjectLiteralExpression(initializer)) continue;
      for (const property of initializer.properties) {
        const opName = property.name?.getText();
        if (opName === undefined) continue;
        const target = ts.isShorthandPropertyAssignment(property)
          ? locals.get(opName)
          : ts.isPropertyAssignment(property) && ts.isIdentifier(property.initializer)
            ? locals.get(property.initializer.text)
            : undefined;
        if (target === undefined) continue;
        const emitted = eventsOf(target);
        if (emitted.length > 0) module.opEvents.set(`${name}.${opName}`, emitted);
      }
    }
  }

  for (const { inner, module, sourceFile } of files) {
    const isCommand = /^commands\/[^/]+\.command\.ts$/.test(inner);
    const isQuery = /^queries\/[^/]+\.(query|policy-query)\.ts$/.test(inner);
    if (!isCommand && !isQuery) continue;
    for (const { initializer, name } of topLevelConsts(sourceFile)) {
      if (!ts.isCallExpression(initializer)) continue;
      const callee = calleeName(initializer);
      if (callee === "Command.make") module.commands.set(name, { file: inner });
      if (callee === "Query.make")
        module.queries.set(name, { file: inner, policy: inner.includes(".policy-query.") });
    }
  }

  for (const { inner, module, sourceFile } of files) {
    // ADR-0022 tiers ports under domain/ports/, but a module that predates it
    // keeps its repository beside the aggregate — the suffix is the real marker.
    if (!inner.startsWith("domain/")) continue;
    const tier = /\.(repository|client|acl)\.ts$/.exec(inner)?.[1];
    if (tier === undefined) continue;
    sourceFile.forEachChild((node) => {
      if (ts.isClassDeclaration(node) && node.name !== undefined) {
        module.ports.set(node.name.text, {
          tier,
          file: inner,
          roots: [...module.roots].filter((root) => sourceFile.text.includes(root)),
        });
      }
    });
  }

  for (const { inner, module, sourceFile } of files) {
    if (!inner.startsWith("infrastructure/") || !/-(live|fake)\.ts$/.test(inner)) continue;
    const kind = inner.includes("-fake.") ? "fake" : "live";
    const tables = new Set();
    const externals = new Set();
    for (const match of sourceFile.text.matchAll(
      /\b(?:FROM|INTO|UPDATE|JOIN)\s+("?[a-z_]+"?\.[a-z_]+)/gi,
    )) {
      tables.add(match[1].replaceAll('"', ""));
    }
    for (const declaration of importsOf(sourceFile)) {
      if (declaration.specifier.startsWith("@org/database")) externals.add("Postgres");
      if (/stripe/i.test(declaration.specifier)) externals.add("Stripe");
      if (/openid|oidc|zitadel/i.test(declaration.specifier)) externals.add("Zitadel");
      if (/nodemailer|@react-email|resend/i.test(declaration.specifier)) externals.add("Email");
      const foreign = /^@\/modules\/([^/]+)\/index\.js$/.exec(declaration.specifier);
      if (foreign !== null) externals.add(`${foreign[1]} module`);
    }

    for (const { initializer, name } of topLevelConsts(sourceFile)) {
      if (!ts.isCallExpression(initializer)) continue;
      if (!/^Layer\.(effect|succeed|sync|scoped)$/.test(calleeName(initializer))) continue;
      const provides = firstIdentifierArgument(initializer);
      if (provides === undefined) continue;
      module.adapters.set(name, {
        file: inner,
        provides,
        kind,
        tables: [...tables],
        externals: [...externals],
      });
    }
  }

  for (const { inner, module, sourceFile } of files) {
    if (!/^(commands|event-handlers|queries)\/[^/]+\.handler\.ts$/.test(inner)) continue;
    for (const { initializer, name } of topLevelConsts(sourceFile)) {
      if (!name.endsWith("Handler")) continue;
      const emitted = new Set();
      eachCall(initializer, (call) => {
        const callee = calleeName(call);
        if (module.opEvents.has(callee))
          for (const event of module.opEvents.get(callee)) emitted.add(event);
        const direct = callee.replace(/\.make$/, "");
        if (callee.endsWith(".make") && module.events.has(direct)) emitted.add(direct);
      });
      const referenced = identifiersIn(initializer);
      module.handlers.set(name, {
        file: inner,
        events: [...emitted],
        dispatches: dispatchesIn(initializer),
        reactive: inner.startsWith("event-handlers/"),
        readSide: inner.startsWith("queries/"),
        readsDatabase: importsOf(sourceFile).some((d) => d.specifier.startsWith("@org/database")),
        ports: [...module.ports.keys()].filter((tag) => referenced.has(tag)),
        roots: [...module.roots].filter(
          (root) => referenced.has(root) || referenced.has(`${root}Ops`),
        ),
      });
    }
  }

  for (const { inner, module, sourceFile } of files) {
    if (!/^[^/]+\.command-handlers\.ts$/.test(inner) && !/^[^/]+\.query-handlers\.ts$/.test(inner))
      continue;
    eachCall(sourceFile, (call) => {
      const callee = calleeName(call);
      if (callee !== "Command.handlersOf" && callee !== "Query.handlersOf") return;
      const table = call.arguments[1];
      if (table === undefined || !ts.isObjectLiteralExpression(table)) return;
      for (const property of table.properties) {
        const tag = property.name?.getText();
        if (tag === undefined || !ts.isPropertyAssignment(property)) continue;
        const handler = [...identifiersIn(property.initializer)].find((name) =>
          name.endsWith("Handler"),
        );
        if (handler !== undefined) module.bindings.set(tag, handler);
      }
    });
  }

  for (const { inner, module, sourceFile } of files) {
    if (!/^interface\/(http|cli)\/[^/]+\.endpoint\.ts$/.test(inner)) continue;
    const protocol = inner.split("/")[1];
    const contract = endpointContract(sourceFile);
    const route =
      contract === undefined
        ? undefined
        : contracts.get(contract.contract)?.operations.get(contract.operation);

    for (const { initializer, name } of topLevelConsts(sourceFile)) {
      if (!ts.isCallExpression(initializer)) continue;
      // `Effect.fn("label")(function* …)` — the span sits on the inner call.
      let span;
      eachCall(initializer, (call) => {
        if (span === undefined && calleeName(call) === "Effect.fn")
          span = firstStringArgument(call);
      });
      if (span === undefined) continue;
      const policies = [];
      eachCall(initializer, (call) => {
        if (!calleeName(call).endsWith("hasPermissions")) return;
        const resource = firstIdentifierArgument(call);
        const action = firstIdentifierArgument(call, 1);
        if (resource !== undefined) policies.push({ resource, action });
      });
      module.endpoints.push({
        name,
        file: inner,
        protocol,
        span,
        route,
        dispatches: dispatchesIn(initializer),
        policies,
      });
    }
  }

  for (const { inner, module, sourceFile } of files) {
    if (!/^interface\/events\/[^/]+\.event-adapter\.ts$/.test(inner)) continue;
    eachCall(sourceFile, (call) => {
      const callee = calleeName(call);
      const mode = callee.endsWith(".subscribeAfterCommit")
        ? "after commit"
        : callee.endsWith(".subscribe")
          ? "immediate"
          : callee.endsWith(".stream")
            ? "stream"
            : undefined;
      if (mode === undefined) return;
      const event = firstIdentifierArgument(call);
      if (event === undefined) return;
      module.subscriptions.push({
        event,
        mode,
        file: inner,
        dispatches: call.arguments.slice(1).flatMap((argument) => dispatchesIn(argument)),
      });
    });
  }

  for (const { inner, module, sourceFile } of files) {
    if (!inner.startsWith("policies/")) continue;
    const referenced = identifiersIn(sourceFile);

    for (const { initializer, name } of topLevelConsts(sourceFile)) {
      if (ts.isAsExpression(initializer) && ts.isStringLiteral(initializer.expression)) {
        module.resources.set(name, initializer.expression.text);
      } else if (ts.isStringLiteral(initializer)) {
        module.resources.set(name, initializer.text);
      }
    }

    if (/^policies\/[^/]+\.policy\.ts$/.test(inner)) module.checks.add(inner);
    for (const tag of module.ports.keys()) if (referenced.has(tag)) module.policyPorts.add(tag);
    for (const tag of module.queries.keys()) if (referenced.has(tag)) module.policyQueries.add(tag);
  }

  const ownerOfEvent = new Map();
  const ownerOfCommand = new Map();
  const ownerOfQuery = new Map();
  for (const module of modules.values()) {
    for (const event of module.events) ownerOfEvent.set(event, module.name);
    for (const tag of module.commands.keys()) ownerOfCommand.set(tag, module.name);
    for (const tag of module.queries.keys()) ownerOfQuery.set(tag, module.name);
  }

  return { modules, ownerOfEvent, ownerOfCommand, ownerOfQuery };
};

export const importedNamesOf = (sourceFile) =>
  importsOf(sourceFile).flatMap((declaration) => declaration.names);
