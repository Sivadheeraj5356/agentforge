export class BenchmarkAdapterRefusedError extends Error {
  readonly adapterId: string;

  constructor(adapterId: string, message: string) {
    super(message);
    this.name = "BenchmarkAdapterRefusedError";
    this.adapterId = adapterId;
  }
}
