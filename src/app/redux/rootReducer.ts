import { combineReducers } from "redux";

import { userApi } from "./api/userApi";
import { authApi } from "./api/authApi";
import { userSlice } from "./features/authSlice";
import { contactApi } from "./api/contactApi";
import { customerApi } from "./api/customerApi";
import { pipelineApi } from "./api/pipelineApi";
import { dashboardApi } from "./api/dashboardApi";
import { aiReportApi } from "./api/aiReportApi";
import { settingsApi } from "./api/settingsApi";
import { sourceApi } from "./api/sourceApi";

const rootReducer = combineReducers({
  user: userSlice.reducer,
  [userApi.reducerPath]: userApi.reducer,
  [authApi.reducerPath]: authApi.reducer,
  [contactApi.reducerPath]: contactApi.reducer,
  [customerApi.reducerPath]: customerApi.reducer,
  [pipelineApi.reducerPath]: pipelineApi.reducer,
  [dashboardApi.reducerPath]:dashboardApi.reducer,
  [aiReportApi.reducerPath]: aiReportApi.reducer,
  [settingsApi.reducerPath]: settingsApi.reducer,
  [sourceApi.reducerPath]: sourceApi.reducer
});

export type RootState = ReturnType<typeof rootReducer>;
export default rootReducer;
