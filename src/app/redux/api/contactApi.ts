/* eslint-disable @typescript-eslint/no-explicit-any */
import { createApi, fetchBaseQuery, retry } from "@reduxjs/toolkit/query/react";
import type { IContact } from "@/app/types/enquiry";
import { FilterParams } from "@/components/tables/ContactTableOne";
import { userApi } from "./userApi";
import { pipelineApi } from "./pipelineApi";


export interface ResponseActivity {
  _id: string;
  /// Mirrors the EnquiryActivityAction enum in the Prisma schema.
  action:
    | 'ENQUIRY_CREATED'
    | 'ENQUIRY_UPDATED'
    | 'TAG_ADDED'
    | 'TAG_REMOVED'
    | 'NOTE_ADDED'
    | 'NOTE_UPDATED'
    | 'REMARK_ADDED'
    | 'PIPELINE_ADDED'
    | 'PIPELINE_REMOVED'
    | 'PIPELINE_STAGE_UPDATED'
    | 'ASSIGNED_TO_UPDATED'
    | 'PHOTO_ADDED'
    | 'VALUATION_RECORDED'
    | 'OFFER_MADE';
  user: { _id: string; name: string | null; email?: string } | null;
  details: Record<string, unknown>;
  createdAt: string;
  meetingScheduledDate?:any
}
export type ResponseContact = IContact & {
  /// Present only on the detail endpoint, which includes them alongside the
  /// paginated activity feed.
  remarks?: {
    _id: string;
    text: string;
    createdAt: string;
    createdBy: { _id: string; name: string | null; email?: string } | null;
  }[];
};

export type TaskStatus = "open" | "in_progress" | "done";
export type TaskPriority = "low" | "medium" | "high";
export type TaskType = "contact_linked" | "custom";

export interface TaskItem {
  _id: string;
  title: string;
  description?: string | null;
  type: TaskType;
  contactId?: string | { _id: string; name?: string } | null;
  assignedTo?: Array<{ _id: string; name: string; email?: string } | string>;
  dueDate?: string | null;
  dueTime?: string | null;
  priority: TaskPriority;
  status: TaskStatus;
  owner: { _id: string; name: string; email?: string } | string;
  createdBy: { _id: string; name: string; email?: string } | string;
  createdAt: string;
  updatedAt: string;
}

export interface ActivityLogItem {
  _id: string;
  contactId: string;
  event: string;
  description: string;
  performedBy: { _id: string; name: string; email?: string } | string;
  metadata?: Record<string, unknown>;
  createdAt: string;
}
interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface FilterContactsResponse {
  message: string;
  contacts: ResponseContact[];
  pagination: Pagination;
}



interface FilterContactsRequest {
  page?: number;
  limit?: number;
  keyword?: string;
  filter?: FilterParams;
}

interface ContactRequest {
  name: string;
  mobile: string;
  email?: string;
  city?: string;
  category: string;
  jewelleryType?: string;
  brand?: string;
  metalWeight?: number | string;
  carat?: number | string;
  shapeCut?: string;
  condition?: string;
  certificateAvailable?: string | boolean;
  certificateLab?: string;
  purchaseYear?: number | string;
  description?: string;
  notes?: string;
  tags?: string[];
  source?: string;
}

interface CreateContactApiResponse {
  message: string;
  contact: IContact;
}

interface UpdateContactsPipelineResponse {
  success: boolean;
  message: string;
  data: ResponseContact[];
}

interface UpdateContactsPipelineRequest {
  contactIds: string[];
  pipelineId: string;
  stageId: string;
  userId: string;
}

interface BatchUpdateContactDragRequest {
  updates: {
    contactId: string;
    pipelineId: string;
    stageId: string;
    order: number;
    userId?: string;
  }[];
  // Client-side only, for scoping pipelineApi cache invalidation to the
  // stages this drag actually touched — never sent to the server.
  affectedStageIds?: string[];
}

interface BatchUpdateContactDragResponse {
  success: boolean;
  data: ResponseContact[];
}

interface UpdateContactRequest {
  id: string;
  name?: string;
  email?: string;
  phone?: string;
  city?: string;
  preferredContact?: string;
  notes?: string;
  tags?: { name: string }[]; // Send only name, backend sets user
  jewelleryType?: string;
  brand?: string;
  metalWeight?: number | string;
  carat?: number | string;
  shapeCut?: string;
  condition?: string;
  certificateAvailable?: string;
  certificateLab?: string;
  purchaseYear?: number | string;
  description?: string;
  estimatedValue?: number | string;
  offeredAmount?: number | string;
  source?: string;
}

interface UpdateContactApiResponse {
  success: boolean;
  data: ResponseContact;
}

export interface CustomerEnquirySummary {
  _id: string;
  reference: number;
  categoryLabel: string;
  brand: string | null;
  estimatedValue: number | null;
  stageName: string | null;
  createdAt: string;
}

interface GetContactByIdResponse {
  success: boolean;
  data: ResponseContact;
  contact: ResponseContact;
  tasks: TaskItem[];
  activityLogs: ActivityLogItem[];
  /// This customer's other enquiries (same person, a different asset) —
  /// empty when this is their only submission so far.
  customerEnquiries: CustomerEnquirySummary[];
}

interface AssignContactsRequest {
  contactIds: string[];
  userIds: string[];
  assignType: "every" | "equally" | "roundRobin";
  isAddAsNewLead?: boolean;
}

interface AssignContactsResponse {
  message: string;
}

interface UpdateProbabilityResponse {
  message: string;
  contact: {
    _id: string;
    probability: number;
  };
}

interface UpdateContactNotesRequest {
  id: string;
  tags?: { name: string; user?: string }[];
  notes?: string;
}

interface UpdateContactNotesResponse {
  message: string;
  contact: ResponseContact;
}

export interface Tag {
  user: string;
  name: string;
}
interface GetContactNotesAndTagsResponse {
  message: string;
  notes: string;
  tags: Tag[];
}

interface ContactPayload {
  contacts: (ImportRow & { isDuplicate?: boolean })[];
  assignedUsers: string[];
  assignType: "every" | "equally" | "roundRobin";
  addToPipeline: boolean;
  source?: string;
}

/// A spreadsheet row with its columns renamed to enquiry fields. Values stay
/// as raw cell text — the server coerces them, because a cell is always a
/// string while the columns it feeds are numbers and enums.
export type ImportRow = Partial<Record<keyof IContact, string>>;

interface CheckDuplicatesRequest {
  contacts: ImportRow[];
}

interface CheckDuplicatesResponse {
  totalContacts: number;
  duplicateCount: number;
  newCount: number;
  duplicates: { email: string | null; name: string | null; phone: string }[];
  newContacts: { email: string | null; name: string | null; phone: string }[];
}

interface BulkImportContactsResponse {
  message: string;
  contacts: ResponseContact[];
  failed: { contact: any; error: string }[];
}

interface UpdateContactStageResponse {
  success: boolean;
  message: string;
  contact: ResponseContact;
}

interface CreateTaskRequest {
  title: string;
  description?: string;
  type: TaskType;
  contactId?: string | null;
  assignedTo?: string[];
  dueDate?: string | null;
  dueTime?: string | null;
  priority?: TaskPriority;
  status?: TaskStatus;
  addToCalendar?: boolean;
}

interface UpdateTaskRequest extends Partial<CreateTaskRequest> {
  id: string;
}

interface TaskResponse {
  message?: string;
  task: TaskItem;
}

interface TasksResponse {
  tasks: TaskItem[];
  pagination: Pagination;
}

interface GetTasksRequest {
  contactId?: string;
  assignedTo?: string;
  status?: TaskStatus;
  page?: number;
  limit?: number;
  dueStartDate?: string;
  dueEndDate?: string;
  updatedStartDate?: string;
  updatedEndDate?: string;
}

const getTaskContactId = (task?: TaskItem) => {
  const contactId = task?.contactId;
  if (!contactId) return "LIST";
  return typeof contactId === "string" ? contactId : contactId._id;
};

interface UpdateContactStageRequest {
  contactId: string;
  stageId: string;
}

interface GetContactActivitiesRequest {
  contactId: string;
  page?: number;
  limit?: number;
}

interface ContactActivitiesResponse {
  activities: ResponseActivity[];
  pagination: Pagination;
}


// `maxRetries: 0` means no endpoint retries by default; one can opt in
// through `extraOptions.retryCondition`. The previous shared condition was
// written for the call-outcome mutations and went with them — retrying only
// network drops, timeouts and 5xx, never a 4xx, is the shape to restore if
// an endpoint needs it again.
const baseQueryWithRetry = retry(
  fetchBaseQuery({
    baseUrl: "/api",
    credentials: "include",
  }),
  { maxRetries: 0 }
);

export const contactApi = createApi({
  reducerPath: "contactApi",
  baseQuery: baseQueryWithRetry,
  tagTypes: ["Contacts", "Tasks", "ActivityLog"],
  endpoints: (builder) => ({
    createContact: builder.mutation<CreateContactApiResponse, ContactRequest>({
      query: (body) => ({
        url: "/contacts",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Contacts"],
      // Team member cards show assignedContacts/closedContacts counts
      // (userApi's "TeamMembers" tag) — a new contact can change those, but
      // it's a separate RTK Query api slice so invalidatesTags can't reach
      // it directly.
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(userApi.util.invalidateTags(["TeamMembers"]));
        } catch {
          // Contact creation failed — nothing to invalidate.
        }
      },
    }),
     bulkImportContacts: builder.mutation<BulkImportContactsResponse, ContactPayload>({
      query: (body) => ({
        url: "/contacts/bulk",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Contacts"],
      async onQueryStarted(_args, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;
          dispatch(userApi.util.invalidateTags(["TeamMembers"]));
        } catch {
          // Bulk import failed outright — nothing to invalidate.
        }
      },
    }),
    getContacts: builder.query<FilterContactsResponse, FilterContactsRequest>({
      query: ({ page = 1, limit = 10, keyword = "", filter = {} }) => ({
        url: `/contacts/filter?page=${page}&limit=${limit}${keyword ? `&keyword=${encodeURIComponent(keyword)}` : ""}`,
        method: "POST",
        body: filter,
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.contacts.map(({ _id }) => ({ type: "Contacts" as const, id: _id })),
              { type: "Contacts", id: "LIST" },
            ]
          : [{ type: "Contacts", id: "LIST" }],
    }),
    updateContactsPipeline: builder.mutation<UpdateContactsPipelineResponse, UpdateContactsPipelineRequest>({
      query: (body) => ({
        url: "/contacts/update-pipeline",
        method: "PATCH",
        body,
      }),
      invalidatesTags: ["Contacts"],
    }),
    batchUpdateContactDrag: builder.mutation<BatchUpdateContactDragResponse, BatchUpdateContactDragRequest>({
      query: ({ updates }) => ({
        url: "/contacts/update-drag/batch",
        method: "PATCH",
        body: { updates },
      }),
      invalidatesTags: ["Contacts"],
      // The pipeline board reads stage contacts from pipelineApi's
      // getContactsByStage (a separate api slice), so this slice's own
      // "Contacts" invalidation above doesn't reach it. Scoped to just the
      // stages this drag touched (source + destination) — not every stage
      // on the board — using affectedStageIds when the caller provides it,
      // falling back to the updates' own stageIds otherwise.
      async onQueryStarted(args, { dispatch, queryFulfilled }) {
        try {
          await queryFulfilled;

          const pipelineId = args.updates[0]?.pipelineId;
          const stageIds = args.affectedStageIds?.length
            ? args.affectedStageIds
            : Array.from(new Set(args.updates.map((update) => update.stageId)));

          if (pipelineId && stageIds.length > 0) {
            dispatch(
              pipelineApi.util.invalidateTags(
                stageIds.map((stageId) => ({ type: "Contacts" as const, id: `${pipelineId}-${stageId}` }))
              )
            );
          }
        } catch {
          // Drag update failed — nothing to invalidate.
        }
      },
    }),
    checkContactDuplicates: builder.mutation<CheckDuplicatesResponse, CheckDuplicatesRequest>({
      query: (body) => ({
        url: "/contacts/check-duplicates",
        method: "POST",
        body,
      }),
      invalidatesTags: [],
    }),
    getContactById: builder.query<GetContactByIdResponse, string>({
      query: (id) => ({
        url: `/contacts/${id}`,
        method: "GET",
      }),
      providesTags: (result, error, id) => [{ type: "Contacts", id }],
    }),
    updateContact: builder.mutation<UpdateContactApiResponse, UpdateContactRequest>({
      query: ({ id, ...body }) => ({
        url: `/contacts/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: "Contacts", id }, { type: "Contacts", id: "LIST" }],
    }),
    assignContacts: builder.mutation<AssignContactsResponse, AssignContactsRequest>({
      query: (body) => ({
        url: "/contacts/assign",
        method: "POST",
        body,
      }),
      invalidatesTags: ["Contacts"],
    }),
    updateProbability: builder.mutation<UpdateProbabilityResponse, { id: string; probability: number }>({
      query: ({ id, probability }) => ({
        url: `/contacts/probability/${id}`,
        method: "PATCH",
        body: { probability },
      }),
      invalidatesTags: (result, error, { id }) => [{ type: "Contacts", id }, { type: "Contacts", id: "LIST" }],
    }),
    updateContactNotes: builder.mutation<UpdateContactNotesResponse, UpdateContactNotesRequest>({
      query: ({ id, ...body }) => ({
        url: `/contacts/notes/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (result, error, { id }) => [{ type: "Contacts", id }, { type: "Contacts", id: "LIST" }],
    }),
    getContactNotesAndTags: builder.query<GetContactNotesAndTagsResponse, string>({
      query: (id) => ({
        url: `/contacts/notes/${id}`,
        method: "GET",
      }),
      providesTags: (result, error, id) => [{ type: "Contacts", id }],
    }),
    updateContactStage: builder.mutation<UpdateContactStageResponse, UpdateContactStageRequest>({
      query: ({ contactId, stageId }) => ({
        url: `/contacts/${contactId}/stage`,
        method: "PATCH",
        body: { stageId },
      }),
      invalidatesTags: (result, error, { contactId }) => [
        { type: "Contacts", id: contactId },
        { type: "Contacts", id: "LIST" },
      ],
    }),
    createTask: builder.mutation<TaskResponse, CreateTaskRequest>({
      query: (body) => ({
        url: "/tasks",
        method: "POST",
        body,
      }),
      invalidatesTags: (result) => [
        { type: "Tasks", id: getTaskContactId(result?.task) },
        { type: "Contacts", id: getTaskContactId(result?.task) },
      ],
    }),
    getTasks: builder.query<TasksResponse, GetTasksRequest | void>({
      query: (params) => ({
        url: `/tasks${
          params
            ? `?${new URLSearchParams(
                Object.entries(params).reduce<Record<string, string>>((acc, [key, value]) => {
                  if (value) acc[key] = value;
                  return acc;
                }, {})
              ).toString()}`
            : ""
        }`,
        method: "GET",
      }),
      providesTags: (result, error, params) => [
        { type: "Tasks", id: params?.contactId || "LIST" },
      ],
    }),
    updateTask: builder.mutation<TaskResponse, UpdateTaskRequest>({
      query: ({ id, ...body }) => ({
        url: `/tasks/${id}`,
        method: "PATCH",
        body,
      }),
      invalidatesTags: (result) => [
        { type: "Tasks", id: "LIST" },
        { type: "Tasks", id: getTaskContactId(result?.task) },
        { type: "Contacts", id: getTaskContactId(result?.task) },
      ],
    }),
    deleteTask: builder.mutation<{ message: string }, { id: string; contactId?: string | null }>({
      query: ({ id }) => ({
        url: `/tasks/${id}`,
        method: "DELETE",
      }),
      invalidatesTags: (result, error, { contactId }) => [
        { type: "Tasks", id: "LIST" },
        { type: "Tasks", id: contactId || "LIST" },
        { type: "Contacts", id: contactId || "LIST" },
      ],
    }),
    getContactActivities: builder.query<ContactActivitiesResponse, GetContactActivitiesRequest>({
      query: ({ contactId, page = 1, limit = 5 }) => ({
        url: `/contacts/${contactId}/activities?page=${page}&limit=${limit}`,
        method: "GET",
      }),
      providesTags: (result, error, { contactId }) => [{ type: "ActivityLog", id: contactId }],
    }),
  }),
});

export const {
  useCreateContactMutation,
  useBulkImportContactsMutation,
  useCheckContactDuplicatesMutation,
  useGetContactsQuery,
  useUpdateContactsPipelineMutation,
  useBatchUpdateContactDragMutation,
  useGetContactByIdQuery,
  useUpdateContactMutation,
  useAssignContactsMutation,
  useUpdateProbabilityMutation,
  useUpdateContactNotesMutation,
  useGetContactNotesAndTagsQuery,
  useUpdateContactStageMutation,
  useCreateTaskMutation,
  useGetTasksQuery,
  useUpdateTaskMutation,
  useDeleteTaskMutation,
  useGetContactActivitiesQuery,
} = contactApi;
