/** A parsed response body together with the raw response it came from. */
export interface WithResponse<T> {
  data: T;
  response: Response;
  /** The `X-Request-Id` header. Quote it when you contact Edgaze support. */
  requestId: string | null;
}

/**
 * The value every SDK method returns. Await it for the parsed body, or call `.withResponse()` to
 * also get the HTTP response (headers, status, request id).
 */
export class APIPromise<T> implements PromiseLike<T> {
  private parsed: Promise<T> | undefined;

  constructor(protected readonly responsePromise: Promise<WithResponse<T>>) {}

  /** Resolves with the parsed body, the raw `Response`, and the request id. */
  withResponse(): Promise<WithResponse<T>> {
    return this.responsePromise;
  }

  private value(): Promise<T> {
    this.parsed ??= this.responsePromise.then((r) => r.data);
    return this.parsed;
  }

  then<R1 = T, R2 = never>(
    onfulfilled?: ((value: T) => R1 | PromiseLike<R1>) | null,
    onrejected?: ((reason: unknown) => R2 | PromiseLike<R2>) | null,
  ): Promise<R1 | R2> {
    return this.value().then(onfulfilled, onrejected);
  }

  catch<R = never>(onrejected?: ((reason: unknown) => R | PromiseLike<R>) | null): Promise<T | R> {
    return this.value().catch(onrejected);
  }

  finally(onfinally?: (() => void) | null): Promise<T> {
    return this.value().finally(onfinally);
  }

  get [Symbol.toStringTag]() {
    return "APIPromise";
  }
}
