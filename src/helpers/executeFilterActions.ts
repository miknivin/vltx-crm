/* eslint-disable @typescript-eslint/no-explicit-any */
/// Dispatches planned filter actions onto a builder. `args` is optional
/// because zero-argument methods (unassigned, isConverted, ...) omit it.
export function executeFilterActions(
  builder: any,
  actions: { method: string; args?: unknown[] }[]
) {
  for (const action of actions) {
    const { method, args } = action;

    if (typeof builder[method] !== "function") {
      throw new Error(`Unknown filter method: ${method}`);
    }

    builder[method](...(args ?? []));
  }

  return builder;
}