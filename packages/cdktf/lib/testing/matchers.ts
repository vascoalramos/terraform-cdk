// Copyright (c) HashiCorp, Inc
// SPDX-License-Identifier: MPL-2.0
import * as fs from "fs";
import * as path from "path";
import { execSync, SpawnSyncReturns } from "child_process";
import { snakeCase, terraformBinaryName } from "../util";

// TerraformConstructor is class with the static property 'tfResourceType'
export interface TerraformConstructor {
  readonly tfResourceType: string;
}

export type SynthesizedStack = {
  resource: Record<string, any>;
  data: Record<string, any>;
  provider: Record<string, any>;
};

/**
 * Class representing the contents of a return by an assertion
 */
export class AssertionReturn {
  /**
   * Create an AssertionReturn
   * @param message - String message containing information about the result of the assertion
   * @param pass - Boolean pass denoting the success of the assertion
   */
  constructor(public readonly message: string, public readonly pass: boolean) {}
}

export type MatcherReturnJest = { message: () => string; pass: boolean };

/**
 * Reformats the contents of the base testing matcher return type AssertionReturn into type useable by jest
 * @param toReturn
 * @returns {MatcherReturnJest}
 */
export function returnMatcherToJest(
  toReturn: AssertionReturn
): MatcherReturnJest {
  return {
    message: () => toReturn.message,
    pass: toReturn.pass,
  };
}

/**
 * PR DESCRIPTION
 * - Basic idea here is to allow for attributes in expected to be more strictly checked against received
 *  - The more specific case here is for returning false for an optional attribute that is set to None, null that isn't present in received
 *  - currently it returns true
 *    - Why? ->
 */

/**
 * Compares expected and received. All expected properties are matched and considered equal even if
 * there are more properties in the received object than in the expected object in which case it will still return true.
 * @param expected
 * @param received
 * @returns {boolean}
 */
export function asymetricDeepEqualIgnoringObjectCasing(
  expected: unknown,
  received: unknown
): boolean {
  switch (typeof expected) {
    case "object":
      console.log("CASE OBJECT");
      console.log("EXPECTED RESULT");
      console.log(expected);
      console.log("RECIEVED RESULT");
      console.log(received);
      if (Array.isArray(expected)) {
        return (
          Array.isArray(received) &&
          expected.length === received.length &&
          expected.every(
            (item, index) =>
              asymetricDeepEqualIgnoringObjectCasing(item, received[index]) // recursively compare arrays
          )
        );
      }
      if (expected === null && received === null) {
        console.log("expected === null && received === null");
        console.log("EXPECTED RESULT");
        console.log(expected);
        console.log("RECIEVED RESULT");
        console.log(received);
        return true;
      }
      if (expected === undefined && received === undefined) {
        console.log("expected === undefined && received === undefined");
        console.log("EXPECTED RESULT");
        console.log(expected);
        console.log("RECIEVED RESULT");
        console.log(received);
        return true;
      }
      if (expected === null || received === null) {
        console.log("expected === undefined || received === undefined");
        console.log("EXPECTED RESULT");
        console.log(expected);
        console.log("RECIEVED RESULT");
        console.log(received);
        return false;
      }

      // recursively compare objects and allow snake case as well as camel case
      return Object.keys(expected as Record<string, unknown>).every((key) => {
        console.log(
          "expected and recieved both non-null and expected is not array"
        );
        console.log("EXPECTED RESULT");
        console.log(expected);
        console.log("RECIEVED RESULT");
        console.log(received);
        if ((received as any)[key] !== undefined) {
          return asymetricDeepEqualIgnoringObjectCasing(
            (expected as any)[key],
            (received as any)[key]
          );
        }

        if ((received as any)[snakeCase(key)] !== undefined) {
          return asymetricDeepEqualIgnoringObjectCasing(
            (expected as any)[key],
            (received as any)[snakeCase(key)]
          );
        }

        return false;
      });
    default:
      console.log("default case");
      console.log("EXPECTED RESULT");
      console.log(expected);
      console.log("RECIEVED RESULT");
      console.log(received);
      return expected === received;
  }
}

const objectExcludes = (
  items: any[],
  excludedProperties: string[]
): boolean => {
  return Object.values(items).some(
    (item: any) => !excludedProperties.includes(item)
  );
};

const defaultPassEvaluation = (
  items: any,
  assertedProperties: Record<string, any>
) => {
  return Object.values(items).some((item: any) =>
    asymetricDeepEqualIgnoringObjectCasing(assertedProperties, item)
  );
};

// eslint-disable-next-line jsdoc/require-jsdoc
function isAsymmetric(obj: any) {
  return !!obj && typeof obj === "object" && "asymmetricMatch" in obj;
}
// You can use expect.Anything(), expect.ObjectContaining, etc in jest, this makes it nicer to read
// when we print error messages
// eslint-disable-next-line jsdoc/require-jsdoc
function jestAsymetricMatcherStringifyReplacer(_key: string, value: any) {
  return isAsymmetric(value) ? `expect.${value.toString()}` : value;
}
// eslint-disable-next-line jsdoc/require-jsdoc
function getAssertElementWithProperties(
  // We have the evaluation function configurable so we can make use of the specific testing frameworks capabilities
  // This makes the resulting tests more native to the testing framework
  customPassEvaluation?: (
    items: any[], // configurations of the requested type
    assertedProperties: Record<string, any>
  ) => boolean,
  objectExcludesPassEvaluation?: (
    items: any[],
    excludedProperties: string[]
  ) => boolean
) {
  const passEvaluation = objectExcludesPassEvaluation
    ? objectExcludesPassEvaluation
    : customPassEvaluation || defaultPassEvaluation;
  return function getAssertElementWithProperties(
    type: keyof SynthesizedStack,
    received: string,
    itemType: TerraformConstructor,
    properties: Record<string, any> = {}
  ): AssertionReturn {
    console.log("getAssertElementWithProperties in matchers");
    console.log("RECIEVED");
    console.log(received);
    console.log("EXPECTED");
    console.log(properties);
    let stack: SynthesizedStack;
    try {
      stack = JSON.parse(received) as SynthesizedStack;
    } catch (e) {
      throw new Error(`invalid JSON string passed: ${received}`);
    }

    const items =
      Object.values(
        Object.entries(stack[type] || {}) // for all data/resource entries
          .find(
            // find the object with a matching name
            ([type, _values]) => type === itemType.tfResourceType
          )?.[1] || {} // get all items of that type (encoded as a record of name -> config)
      ) || []; // get a list of all configs of that type
    const pass = passEvaluation(items, properties);
    if (pass) {
      return new AssertionReturn(
        `Expected no ${
          itemType.tfResourceType
        } with properties ${JSON.stringify(
          properties,
          jestAsymetricMatcherStringifyReplacer
        )} to be present in synthesized stack.
Found ${items.length === 0 ? "no" : items.length} ${
          itemType.tfResourceType
        } resources instead${
          items.length > 0 ? ":\n" + JSON.stringify(items, null, 2) : ""
        }`,
        pass
      );
    } else {
      return new AssertionReturn(
        `Expected ${itemType.tfResourceType} with properties ${JSON.stringify(
          properties,
          jestAsymetricMatcherStringifyReplacer
        )} to be present in synthesized stack.
Found ${items.length === 0 ? "no" : items.length} ${
          itemType.tfResourceType
        } resources instead${
          items.length > 0 ? ":\n" + JSON.stringify(items, null, 2) : ""
        }`,
        pass
      );
    }
  };
}

/**
 * Returns the function toHaveDataSourceWithProperties using the evaluation properties of customPassEvaluation
 * @param customPassEvaluation
 * @returns {getToHaveDataSourceWithProperties~toHaveDataSourceWithProperties}
 */
export function getToHaveDataSourceWithProperties(
  customPassEvaluation?: (
    items: any,
    assertedProperties: Record<string, any>
  ) => boolean
) {
  /**
   * Evaluates the received stack to have the data source resourceType containing specified properties
   * @param received
   * @param resourceType
   * @param properties
   * @returns {AssertionReturn}
   */
  return function toHaveDataSourceWithProperties(
    received: string,
    resourceType: TerraformConstructor,
    properties: Record<string, any> = {}
  ): AssertionReturn {
    return getAssertElementWithProperties(customPassEvaluation)(
      "data",
      received,
      resourceType,
      properties
    );
  };
}

/**
 * Returns the function toHaveResourceWithProperties using the evaluation properties of customPassEvaluation
 * @param customPassEvaluation
 * @returns
 */
export function getToHaveResourceWithProperties(
  customPassEvaluation?: (
    items: any,
    assertedProperties: Record<string, any>
  ) => boolean
) {
  /**
   * Evaluates the received stack to have the resource resourceType containing specified properties
   * @param received
   * @param resourceType
   * @param properties
   * @returns {AssertionReturn}
   */
  return function toHaveResourceWithProperties(
    received: string,
    resourceType: TerraformConstructor,
    properties: Record<string, any> = {}
  ): AssertionReturn {
    console.log("toHaveResourceWithProperties in matchers");
    console.log("RECIEVED");
    console.log(received);
    console.log("EXPECTED");
    console.log(properties);
    return getAssertElementWithProperties(customPassEvaluation)(
      "resource",
      received,
      resourceType,
      properties
    );
  };
}

/**
 * Returns the function toHaveProviderWithProperties using the evaluation properties of customPassEvaluation
 * @param customPassEvaluation
 * @returns {getToHaveProviderWithProperties~toHaveProviderWithProperties}
 */
export function getToHaveProviderWithProperties(
  customPassEvaluation?: (
    items: any,
    assertedProperties: Record<string, any>
  ) => boolean
) {
  /**
   * Evaluates the received stack to have the provider resourceType containing specified properties
   * @param received
   * @param resourceType
   * @param properties
   * @returns {AssertionReturn}
   */
  return function toHaveProviderWithProperties(
    received: string,
    resourceType: TerraformConstructor,
    properties: Record<string, any> = {}
  ): AssertionReturn {
    return getAssertElementWithProperties(customPassEvaluation)(
      "provider",
      received,
      resourceType,
      properties
    );
  };
}

/**
 * Evaluates the received stack to have the provider resourceType containing specified properties
 * @param received
 * @param resourceType
 * @param properties
 * @returns {AssertionReturn}
 */
export function toExcludeResourceWithProperties(
  received: string,
  resourceType: TerraformConstructor,
  properties: Record<string, any> = {}
): AssertionReturn {
  return getAssertElementWithProperties(undefined, objectExcludes)(
    "resource",
    received,
    resourceType,
    properties
  );
}

/**
 * Evaluates the received stack to have the provider resourceType containing specified properties
 * @param received
 * @param resourceType
 * @param properties
 * @returns {AssertionReturn}
 */
export function toExcludeDataSourceWithProperties(
  received: string,
  resourceType: TerraformConstructor,
  properties: Record<string, any> = {}
): AssertionReturn {
  return getAssertElementWithProperties(undefined, objectExcludes)(
    "data",
    received,
    resourceType,
    properties
  );
}

/**
 * A helper util to verify wether an Error was caused by the Nodejs `process.spawn` API.
 *
 * @param   {Error}   err The Error object to verify
 * @returns {Boolean}     A bool indicating wether the input Error is containing process.spawn output.
 */
const isExecSpawnError = (err: any): err is Error & SpawnSyncReturns<any> =>
  "output" in err &&
  Array.isArray(err.output) &&
  err.output.some((buf: any) => Buffer.isBuffer(buf));

/**
 * A helper util to append `process.spawn` output to assertion messages to improve developer expirience.
 *
 * @param   {String} message The message to optionally append process output to.
 * @param   {Error}  err     The error from which the `process.spawn` output should be retreived from.
 * @returns {String}         The finalized assertion message decorated with the `process.spawn` output.
 */
const withProcessOutput = (message: string, err: unknown) => {
  let output = "";

  if (isExecSpawnError(err)) {
    output =
      err.output
        ?.map((buffer: Buffer) => buffer?.toString("utf8"))
        .filter(Boolean)
        .join("\n") ?? "";
  }

  const appendix = output.length ? `. Output: ${output}` : "";

  return `${message}: ${err}${appendix}.`;
};

/**
 * Evaluates the validity of the received stack
 * @param received
 * @returns {AssertionReturn}
 */
export function toBeValidTerraform(received: string): AssertionReturn {
  try {
    if (!fs.statSync(received).isDirectory()) {
      throw new Error("Path is not a directory");
    }
  } catch (e) {
    return new AssertionReturn(
      `Expected subject to be a terraform directory: ${e}`,
      false
    );
  }

  try {
    const manifest = JSON.parse(
      fs.readFileSync(path.resolve(received, "manifest.json"), "utf8")
    );

    const stacks = Object.entries(manifest.stacks);

    stacks.forEach(([name, stack]) => {
      const opts = {
        cwd: path.resolve(received, (stack as any).workingDirectory),
        env: process.env,
        stdio: "pipe",
      } as any;
      execSync(`${terraformBinaryName} init`, opts);
      const out = execSync(`${terraformBinaryName} validate -json`, opts);

      const result = JSON.parse(out.toString());
      if (!result.valid) {
        throw new Error(
          `Found ${
            result.error_count
          } Errors in stack ${name}: ${result.diagnostics.join("\n")}`
        );
      }
    });
    return new AssertionReturn(
      `Expected subject not to be a valid terraform stack`,
      true
    );
  } catch (e) {
    return new AssertionReturn(
      withProcessOutput(`Expected subject to be a valid terraform stack`, e),
      false
    );
  }
}

/**
 * Evaluates the ability for the received stack to successfully plan
 * @param received
 * @returns {AssertionReturn}
 */
export function toPlanSuccessfully(received: string): AssertionReturn {
  try {
    if (!fs.statSync(received).isDirectory()) {
      throw new Error("Path is not a directory");
    }
  } catch (e) {
    return new AssertionReturn(
      `Expected subject to be a terraform directory: ${e}`,
      false
    );
  }

  try {
    const manifest = JSON.parse(
      fs.readFileSync(path.resolve(received, "manifest.json"), "utf8")
    );

    const stacks = Object.entries(manifest.stacks);

    stacks.forEach(([, stack]) => {
      const opts = {
        cwd: path.resolve(received, (stack as any).workingDirectory),
        env: process.env,
        stdio: "ignore",
      } as any;
      execSync(`${terraformBinaryName} init`, opts);

      // Throws on a non-zero exit code
      execSync(`${terraformBinaryName} plan -input=false -lock=false `, opts);
    });

    return new AssertionReturn(
      `Expected subject not to plan successfully`,
      true
    );
  } catch (e) {
    return new AssertionReturn(
      withProcessOutput(`Expected subject to plan successfully`, e),
      false
    );
  }
}
