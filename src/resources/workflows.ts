import type { APIPromise } from "../core/api-promise.js";
import { PagePromise, type Page } from "../core/pagination.js";
import type { RequestOptions } from "../core/transport.js";
import { pathSegment } from "../core/utils.js";
import type {
  AcceptWorkflowUpdateResponse,
  RunModel,
  Workflow,
  WorkflowListItem,
  WorkflowListResponse,
  WorkflowVersions,
} from "../types.js";
import { APIResource } from "./resource.js";

export interface WorkflowListParams {
  /** `marketplace` (default) lists the public catalog; `mine` lists the key holder's workflows. */
  scope?: "marketplace" | "mine";
  /** Search title, description, tags, owner handle, or Edgaze Code. */
  q?: string;
  /** Marketplace sort order. Defaults to `popular`. */
  sort?: "popular" | "newest";
  /** Filter by pricing model. */
  runModel?: RunModel;
  /** Only workflows the key holder can run right now. */
  runnableOnly?: boolean;
  /** Page size, 1 to 50. */
  limit?: number;
  /** Rows to skip. Pages after the first are fetched for you when you iterate. */
  offset?: number;
}

export type WorkflowPage = Page<WorkflowListParams, WorkflowListResponse, WorkflowListItem>;

export class Workflows extends APIResource {
  /**
   * Lists workflows in the marketplace catalog, or your own with `scope: "mine"`.
   *
   * ```ts
   * for await (const workflow of client.workflows.list({ q: "invoice" })) {
   *   console.log(workflow.id, workflow.name);
   * }
   * ```
   */
  list(
    params: WorkflowListParams = {},
    options: RequestOptions = {},
  ): PagePromise<WorkflowListParams, WorkflowListResponse, WorkflowListItem> {
    return new PagePromise(
      params,
      (p, o) =>
        this.transport.request<WorkflowListResponse>(
          {
            method: "GET",
            path: "/workflows",
            query: {
              scope: p.scope,
              q: p.q,
              sort: p.sort,
              runModel: p.runModel,
              runnableOnly: p.runnableOnly,
              limit: p.limit,
              offset: p.offset,
            },
            retryable: true,
          },
          o,
        ),
      {
        items: (raw) => raw.workflows,
        nextParams: (raw, p) => {
          if (!raw.pagination.hasMore || raw.workflows.length === 0) return null;
          return {
            ...p,
            offset: raw.pagination.offset + raw.workflows.length,
            limit: raw.pagination.limit,
          };
        },
      },
      options,
    );
  }

  /** Retrieves a workflow with its input schema, access state, pricing and an example request. */
  retrieve(id: string, options: RequestOptions = {}): APIPromise<Workflow> {
    return this.transport.request<Workflow>(
      { method: "GET", path: `/workflows/${pathSegment(id, "id")}`, retryable: true },
      options,
    );
  }

  /** Lists the versions you can see, your pinned and active version, and `updateAvailable`. */
  versions(id: string, options: RequestOptions = {}): APIPromise<WorkflowVersions> {
    return this.transport.request<WorkflowVersions>(
      { method: "GET", path: `/workflows/${pathSegment(id, "id")}/versions`, retryable: true },
      options,
    );
  }

  /**
   * Moves your purchase to the workflow's current active version. Needs the `workflow:write` scope.
   * Idempotent: calling it when already on the active version changes nothing.
   */
  acceptUpdate(id: string, options: RequestOptions = {}): APIPromise<AcceptWorkflowUpdateResponse> {
    return this.transport.request<AcceptWorkflowUpdateResponse>(
      {
        method: "POST",
        path: `/workflows/${pathSegment(id, "id")}/accept-update`,
        retryable: true,
      },
      options,
    );
  }
}
