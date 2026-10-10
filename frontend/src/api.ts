

const Gender = {
    prefer_not_to_say: 0,
    male: 1,
    female: 2,
    nonBinary: 3
} as const;
type Gender = (typeof Gender)[keyof typeof Gender];
export { Gender };

const Major = {
    cs: 0
} as const;
type Major = (typeof Major)[keyof typeof Major];
export { Major };

const Degree = {
    bachelor: 0,
    master: 1,
    phd: 2
} as const;
type Degree = (typeof Degree)[keyof typeof Degree];
export { Degree };

const FilterType = {
    gender: 0,
    degree: 1
} as const;
type FilterType = (typeof FilterType)[keyof typeof FilterType];
export { FilterType };

const MemberRole = {
  admin: "admin",
  member: "member",
  requestPending: "request_pending"
}
type MemberRole = (typeof MemberRole)[keyof typeof MemberRole];
export { MemberRole };


export interface User {
  id: string;
  firstName: string;
  lastName: string;
  emailAddress: string;
  dateOfBirth: Date;
  gender: Gender;
  major: Major;
  degree: Degree;
  pfp: string;
  description: string;
}

export interface ListingFilter {
  filterType: FilterType;
  value: String;
}

export interface Listing {
  id: String
  createdBy: String;
  subject: String;
  description: String;
  startTime: Date;
  endTime: Date;
  location: String;
  courses: String[];
  isPrivate: Boolean;
  inviteCode: String;
  filters: ListingFilter[];
}

export interface Message {
  id: string,
  listingId: string,
  author: User,
  sentAt: Date,
  subject: string,
  content: string
}

export interface TodoItem {
  id: number;
  title: string;
  description: string;
  deadline: Date;
}

export interface TodoItemForCreate {
  title: string;
  description: string;
  deadline: Date;
}

export class ApiError extends Error {
  constructor(status: number, message: string) {
    super(`${status} / ${message}`);
    this.name = "ApiError";
  }
}

async function request<T>(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "PATCH" | "DELETE",
  body?: unknown,
): Promise<T> {
  const headers = {
    "Content-Type": "application/json",
  };

  const config: RequestInit = {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  };

  const response = await fetch(endpoint, config);

  // If the response is not OK (e.g., 404, 500), throw a custom error.
  if (!response.ok) {
    const error = new ApiError(response.status, response.statusText);
    console.log(`${error.name}: ${error.message}`);
    throw error;
  }

  // For 204 No Content, there's no body to parse
  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}


// JSON has no date type, so the backend sends deadlines as strings
function parseDeadline<T extends { deadline: Date }>(todo: T): T {
  return { ...todo, deadline: new Date(todo.deadline) };
}

export function getMe(): Promise<User> {
  return request(`/api/me`, "GET");
}

export function getTodos(): Promise<TodoItem[]> {
  return request<TodoItem[]>(`/api/todos`, "GET").then((todos) =>
    todos.map(parseDeadline),
  );
}

export function createTodo(
  title: string,
  description: string,
  deadline: Date,
): Promise<TodoItem> {
  return request<TodoItem>(`/api/todos`, "POST", {
    title,
    description,
    deadline,
  }).then(parseDeadline);
}

export function generateTodo(prompt: string): Promise<TodoItemForCreate> {
  return request<TodoItemForCreate>(
    `/api/todos/generate?prompt=${encodeURIComponent(prompt)}`,
    "GET",
  ).then(parseDeadline);
} 

export function deleteTodo(id: number): Promise<void> {
  return request(`/api/todos/${id}`, "DELETE");
} 

// Calls onChange whenever the todos change, e.g. in another tab.
// Returns a function that stops listening (use it as the useEffect cleanup).
export function subscribeToTodoChanges(onChange: () => void): () => void {
  // Server-Sent Events: the browser keeps the request open and reconnects by itself
  const events = new EventSource("/api/todos/events");
  events.onmessage = (event) => {
    if (JSON.parse(event.data).type === "todos_changed") {
      onChange();
    }
  };
  return () => events.close();
}
