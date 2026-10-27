/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as functions_budget from "../functions/budget.js";
import type * as functions_budgets from "../functions/budgets.js";
import type * as functions_categories from "../functions/categories.js";
import type * as functions_helpers from "../functions/helpers.js";
import type * as functions_recurring from "../functions/recurring.js";
import type * as functions_rules from "../functions/rules.js";
import type * as functions_transactions from "../functions/transactions.js";
import type * as functions_users from "../functions/users.js";
import type * as http from "../http.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  "functions/budget": typeof functions_budget;
  "functions/budgets": typeof functions_budgets;
  "functions/categories": typeof functions_categories;
  "functions/helpers": typeof functions_helpers;
  "functions/recurring": typeof functions_recurring;
  "functions/rules": typeof functions_rules;
  "functions/transactions": typeof functions_transactions;
  "functions/users": typeof functions_users;
  http: typeof http;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
