import { createBrowserRouter } from "react-router";
import { RoleSelection } from "./pages/RoleSelection";
import { Dashboard } from "./pages/Dashboard";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: RoleSelection,
  },
  {
    path: "/dashboard",
    Component: Dashboard,
  },
]);
