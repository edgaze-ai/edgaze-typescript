import { APIPromise, type WithResponse } from "./api-promise.js";
import type { RequestOptions } from "./transport.js";

/** Fetches one page given the params for it. */
export type PageFetcher<Params, Raw> = (params: Params, options: RequestOptions) => APIPromise<Raw>;

export interface PageDefinition<Params, Raw, Item> {
  items(raw: Raw): Item[];
  /** Params for the page after `raw`, or null when `raw` is the last page. */
  nextParams(raw: Raw, params: Params): Params | null;
}

/**
 * One page of a list. `data` holds this page's items. Iterate the page with `for await` to walk
 * every item across all following pages; the SDK fetches the next page when it needs it.
 */
export class Page<Params, Raw, Item> implements AsyncIterable<Item> {
  /** Items on this page. */
  readonly data: Item[];

  constructor(
    /** The page's full response body, including its pagination block. */
    readonly body: Raw,
    private readonly params: Params,
    private readonly fetchPage: PageFetcher<Params, Raw>,
    private readonly definition: PageDefinition<Params, Raw, Item>,
    private readonly options: RequestOptions,
  ) {
    this.data = definition.items(body);
  }

  hasNextPage(): boolean {
    return this.definition.nextParams(this.body, this.params) !== null;
  }

  /** Fetches the following page. Throws when there is none; check `hasNextPage()` first. */
  async getNextPage(): Promise<Page<Params, Raw, Item>> {
    const next = this.definition.nextParams(this.body, this.params);
    if (next === null) throw new Error("No next page. Check hasNextPage() before getNextPage().");
    const raw = await this.fetchPage(next, this.options);
    return new Page(raw, next, this.fetchPage, this.definition, this.options);
  }

  /** Yields each page, starting with this one. */
  async *iterPages(): AsyncGenerator<Page<Params, Raw, Item>> {
    let page: Page<Params, Raw, Item> = this;
    yield page;
    while (page.hasNextPage()) {
      page = await page.getNextPage();
      yield page;
    }
  }

  async *[Symbol.asyncIterator](): AsyncIterator<Item> {
    for await (const page of this.iterPages()) yield* page.data;
  }
}

/**
 * Returned by list methods. Await it for the first `Page`, or iterate it directly with
 * `for await (const item of client.runs.list())` to walk every item.
 */
export class PagePromise<Params, Raw, Item>
  extends APIPromise<Page<Params, Raw, Item>>
  implements AsyncIterable<Item>
{
  constructor(
    params: Params,
    fetchPage: PageFetcher<Params, Raw>,
    definition: PageDefinition<Params, Raw, Item>,
    options: RequestOptions,
  ) {
    super(
      fetchPage(params, options)
        .withResponse()
        .then((r): WithResponse<Page<Params, Raw, Item>> => ({
          ...r,
          data: new Page(r.data, params, fetchPage, definition, options),
        })),
    );
  }

  async *[Symbol.asyncIterator](): AsyncIterator<Item> {
    const page = await this;
    yield* page;
  }
}
