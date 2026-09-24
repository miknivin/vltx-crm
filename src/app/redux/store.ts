import { configureStore } from "@reduxjs/toolkit";
import rootReducer from "./rootReducer";
import { authApi } from "./api/authApi";
import { userApi } from "./api/userApi"
import { contactApi } from "./api/contactApi";
import { pipelineApi } from "./api/pipelineApi";
import { dashboardApi } from "./api/dashboardApi";
import { aiReportApi } from "./api/aiReportApi";
import { settingsApi } from "./api/settingsApi";
import { sourceApi } from "./api/sourceApi";

const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware().concat(
      userApi.middleware,
      authApi.middleware,
      contactApi.middleware,
      pipelineApi.middleware,
      dashboardApi.middleware,
      aiReportApi.middleware,
      settingsApi.middleware,
      sourceApi.middleware
    ),
});

export default store;
export type AppDispatch = typeof store.dispatch;
export type AppState = ReturnType<typeof store.getState>;
