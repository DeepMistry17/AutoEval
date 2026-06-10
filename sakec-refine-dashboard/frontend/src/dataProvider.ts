import type { DataProvider } from '@refinedev/core';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

function getHeaders(): HeadersInit {
  const token = sessionStorage.getItem('access_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse(response: Response) {
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || `HTTP ${response.status}`);
  }
  return response.json();
}

/**
 * Custom Refine DataProvider that maps Refine's CRUD conventions
 * to our Express REST API endpoints.
 *
 * Resource mapping:
 *   "dashboard-kpis"     ? GET /api/dashboard/kpis
 *   "pending-grades"     ? GET /api/dashboard/pending-grades
 *   "alignment"          ? GET /api/dashboard/alignment
 *   "student-summary"    ? GET /api/dashboard/student-summary
 *   "teams"              ? GET/POST /api/teams
 *   "teams-dropdown"     ? GET /api/teams/dropdown
 *   "assignments"        ? GET /api/assignments
 *   "submissions"        ? PATCH /api/submissions/:id/sync
 */
const resourceToEndpoint: Record<string, string> = {
  'dashboard-kpis': '/dashboard/kpis',
  'pending-grades': '/dashboard/pending-grades',
  alignment: '/dashboard/alignment',
  'student-summary': '/dashboard/student-summary',
  teams: '/teams',
  'teams-dropdown': '/teams/dropdown',
  assignments: '/assignments',
  submissions: '/submissions',
};

export const dataProvider: DataProvider = {
  getList: async ({ resource, filters }) => {
    const endpoint = resourceToEndpoint[resource] || `/${resource}`;
    const params = new URLSearchParams();

    // Map Refine filters to query params
    if (filters) {
      for (const filter of filters) {
        if ('field' in filter && filter.value !== undefined && filter.value !== null) {
          params.append(filter.field, String(filter.value));
        }
      }
    }

    const queryString = params.toString();
    const url = `${API_URL}${endpoint}${queryString ? `?${queryString}` : ''}`;

    const data = await handleResponse(await fetch(url, { headers: getHeaders() }));

    // If response is an array, return as list; otherwise wrap it
    const list = Array.isArray(data) ? data : [data];
    return { data: list, total: list.length };
  },

  getOne: async ({ resource, id }) => {
    const endpoint = resourceToEndpoint[resource] || `/${resource}`;
    const data = await handleResponse(
      await fetch(`${API_URL}${endpoint}/${id}`, { headers: getHeaders() })
    );
    return { data };
  },

  create: async ({ resource, variables }) => {
    const endpoint = resourceToEndpoint[resource] || `/${resource}`;
    const data = await handleResponse(
      await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: getHeaders(),
        body: JSON.stringify(variables),
      })
    );
    return { data };
  },

  update: async ({ resource, id, variables }) => {
    const endpoint = resourceToEndpoint[resource] || `/${resource}`;
    const data = await handleResponse(
      await fetch(`${API_URL}${endpoint}/${id}`, {
        method: 'PATCH',
        headers: getHeaders(),
        body: JSON.stringify(variables),
      })
    );
    return { data };
  },

  deleteOne: async ({ resource, id }) => {
    const endpoint = resourceToEndpoint[resource] || `/${resource}`;
    const data = await handleResponse(
      await fetch(`${API_URL}${endpoint}/${id}`, {
        method: 'DELETE',
        headers: getHeaders(),
      })
    );
    return { data };
  },

  getApiUrl: () => API_URL,

  // Custom method for syncing submission marks
  custom: async ({ url, method, payload, headers: customHeaders }) => {
    const data = await handleResponse(
      await fetch(`${API_URL}${url}`, {
        method: method?.toUpperCase() || 'GET',
        headers: { ...getHeaders(), ...customHeaders },
        ...(payload ? { body: JSON.stringify(payload) } : {}),
      })
    );
    return { data };
  },
};
