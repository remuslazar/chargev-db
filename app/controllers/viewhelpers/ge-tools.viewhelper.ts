export class GEToolsViewHelper {

  constructor(protected baseURL: string) { }

  public chargePointDetailURL(chargepoint: string): string|null {
    const matches = chargepoint.match(/^chargepoint-(\d+)-(\d+)$/);

    if (!matches) {
      throw new Error(`weird chargepoint format: ${chargepoint}.`);
    }

    const registryID = matches[1];
    const id = matches[2];
    if (registryID === "0") {
      return `${this.baseURL}/chargelocations/${id}`;
    }

    return null;
  }

}
