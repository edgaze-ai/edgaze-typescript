// Friendly names for the schemas in the OpenAPI document. The shapes come from
// src/generated/openapi.ts, which is generated from spec/openapi.json and never edited by hand.
import type { components } from "./generated/openapi.js";

type Schemas = components["schemas"];

// Workflows
export type Workflow = Schemas["WorkflowDetail"];
export type WorkflowListItem = Schemas["WorkflowListItem"];
export type WorkflowListResponse = Schemas["WorkflowListResponse"];
export type WorkflowInputField = Schemas["WorkflowInputField"];
export type WorkflowInputOption = Schemas["WorkflowInputOption"];
export type WorkflowInputType = Schemas["WorkflowInputType"];
export type WorkflowExampleRunRequest = Schemas["WorkflowExampleRunRequest"];
export type WorkflowVersionSummary = Schemas["WorkflowVersionSummary"];
export type WorkflowVersions = Schemas["WorkflowVersionsResponse"];
export type AcceptWorkflowUpdateResponse = Schemas["AcceptWorkflowUpdateResponse"];
export type UserAccess = Schemas["UserAccess"];
export type RunModel = Schemas["RunModel"];
export type CredentialMode = Schemas["CredentialMode"];
export type RequiredProvider = Schemas["RequiredProvider"];
export type Pagination = Schemas["Pagination"];

// Runs
export type Run = Schemas["Run"];
export type RunStatus = Schemas["PublicRunStatus"];
export type RunListStatus = Schemas["RunListStatus"];
export type RunListItem = Schemas["RunListItem"];
export type RunListResponse = Schemas["RunListResponse"];
export type RunListPagination = Schemas["RunListPagination"];
export type RunOutcome = Schemas["RunOutcome"];
export type RunOutputField = Schemas["RunOutputField"];
export type RunQueue = Schemas["RunQueue"];
export type BillingStatus = Schemas["BillingStatus"];
export type AcceptedRun = Schemas["AcceptedRun"];
export type CreateRunRequest = Schemas["CreateRunRequest"];
export type CreateRunResponse = Schemas["CreateRunResponse"];
export type CancelRunResponse = Schemas["CancelRunResponse"];

// Run events
export type RunEvent = Schemas["RunEvent"];
export type RunEventType = Schemas["RunEvent"]["type"];
export type RunEventData = Schemas["RunEventData"];
export type RunEventActivity = Schemas["RunEventActivity"];
export type RunProgressHint = Schemas["RunProgressHint"];
export type RunEventsPage = Schemas["RunEventsPage"];

// Run stream (Server-Sent Events)
export type RunStreamEvent = Schemas["RunStreamEvent"];
export type RunStreamSnapshot = Schemas["RunStreamSnapshot"];
export type RunStreamPing = Schemas["RunStreamPing"];
export type RunStreamReconnect = Schemas["RunStreamReconnect"];
export type RunStreamError = Schemas["RunStreamError"];

// Webhooks
export type WebhookRunEventPayload = Schemas["WebhookRunEventPayload"];
export type WebhookTestPayload = Schemas["WebhookTestPayload"];
/** Any body Edgaze posts to a webhook endpoint. Branch on `type`. */
export type WebhookEvent = WebhookRunEventPayload | WebhookTestPayload;

// Errors
export type ErrorCode = Schemas["ErrorCode"];
export type ErrorDetail = Schemas["ErrorDetail"];
export type IntegrationConnectionDetail = Schemas["IntegrationConnectionDetail"];
export type ErrorObject = Schemas["ErrorObject"];
export type ErrorEnvelope = Schemas["ErrorEnvelope"];
