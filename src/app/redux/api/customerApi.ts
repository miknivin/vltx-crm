import { createApi, fetchBaseQuery, retry } from "@reduxjs/toolkit/query/react";
import type { CustomerEnquirySummary, TaskItem } from "./contactApi";

export interface CustomerListItem {
  _id: string;
  name: string;
  mobile: string;
  email: string | null;
  city: string | null;
  preferredContact: string | null;
  preferredContactLabel: string | null;
  enquiryCount: number;
  lastEnquiryAt: string | null;
  createdAt: string;
}

export interface CustomerDetail {
  _id: string;
  name: string;
  mobile: string;
  email: string | null;
  city: string | null;
  preferredContact: string | null;
  preferredContactLabel: string | null;
  notes: string | null;
  createdAt: string;
}

interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

interface GetCustomersRequest {
  page?: number;
  limit?: number;
  keyword?: string;
}

interface GetCustomersResponse {
  customers: CustomerListItem[];
  pagination: Pagination;
}

interface GetCustomerByIdResponse {
  success: boolean;
  data: CustomerDetail;
  enquiries: CustomerEnquirySummary[];
  tasks: TaskItem[];
}

export interface UpdateCustomerRequest {
  id: string;
  name?: string;
  email?: string | null;
  mobile?: string;
  city?: string | null;
  preferredContact?: string | null;
  notes?: string | null;
}

interface UpdateCustomerResponse {
  success: boolean;
  data: CustomerDetail;
}

const baseQueryWithRetry = retry(
  fetchBaseQuery({
    baseUrl: "/api",
    credentials: "include",
  }),
  { maxRetries: 0 }
);

export const customerApi = createApi({
  reducerPath: "customerApi",
  baseQuery: baseQueryWithRetry,
  tagTypes: ["Customers"],
  endpoints: (builder) => ({
    getCustomers: builder.query<GetCustomersResponse, GetCustomersRequest | void>({
      query: ({ page = 1, limit = 10, keyword = "" } = {}) => ({
        url: `/customers?page=${page}&limit=${limit}${keyword ? `&keyword=${encodeURIComponent(keyword)}` : ""}`,
        method: "GET",
      }),
      providesTags: (result) =>
        result
          ? [
              ...result.customers.map(({ _id }) => ({ type: "Customers" as const, id: _id })),
              { type: "Customers", id: "LIST" },
            ]
          : [{ type: "Customers", id: "LIST" }],
    }),
    getCustomerById: builder.query<GetCustomerByIdResponse, string>({
      query: (id) => ({
        url: `/customers/${id}`,
        method: "GET",
      }),
      providesTags: (result, error, id) => [{ type: "Customers", id }],
    }),
    updateCustomer: builder.mutation<UpdateCustomerResponse, UpdateCustomerRequest>({
      query: ({ id, ...body }) => ({
        url: `/customers/${id}`,
        method: "PUT",
        body,
      }),
      invalidatesTags: (result, error, { id }) => [
        { type: "Customers", id },
        { type: "Customers", id: "LIST" },
      ],
    }),
  }),
});

export const {
  useGetCustomersQuery,
  useGetCustomerByIdQuery,
  useUpdateCustomerMutation,
} = customerApi;
