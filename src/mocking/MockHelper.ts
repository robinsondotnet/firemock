import { IDictionary, createError } from "common-types";
import { getFakerLibrary } from "./fakerInitialiation";

export class MockHelper {
  constructor(public context?: IDictionary) {}
  public get faker() {
    const faker = getFakerLibrary();
    if (!faker) {
      throw createError(
        `firemock/not-ready`,
        `The mock helper can not provide the MockHelper object until after the faker library has been imported with a 'await importFakerLibrary()' call.`
      );
    }

    return faker;
  }
}
