

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
  filterType: "gender" | "degree";
  value: string;
}

export interface Listing {
  id: string;
  createdBy: string | null;
  description: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  courses: string[];
  isPrivate: boolean;
  inviteCode: string | null;
  filters: ListingFilter[];
}

export interface ListingForCreate {
  description: string;
  startTime: string;
  endTime: string;
  location: string;
  courses: string[];
  isPrivate: boolean;
  filters: ListingFilter[];
}

export interface Message {
  id: string;
  listingId: string;
  author: User | null;
  sentAt: string;
  content: string;
}

export interface MessageForCreate {
  content: string;
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

export function createListing(listing: ListingForCreate): Promise<Listing> {
  return request<Listing>(`/api/listings`, "POST", {
    ...listing,
    subject: listing.courses[0],
  });
}

export function getListings(): Promise<Listing[]> {
  return request<Listing[]>(`/api/listings`, "GET");
}

export function getMyListings(): Promise<Listing[]> {
  return request<Listing[]>(`/api/me/listings`, "GET");
}

export function getListing(listingId: string): Promise<Listing> {
  return request<Listing>(
    `/api/listings/${encodeURIComponent(listingId)}`,
    "GET",
  );
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

export function getMessages(listingId: string): Promise<Message[]> {
  return request(`/api/listings/${encodeURIComponent(listingId)}/messages`, "GET");
}

export function sendMessage(listingId: string, message: MessageForCreate): Promise<Message> {
  return request(`/api/listings/${encodeURIComponent(listingId)}/messages`, "POST", message);
}

export interface PendingRequest {
  listing: Listing;
  user: User;
  requestedAt: string;
}

export function getMyRequests(): Promise<PendingRequest[]> {
  return request("/api/me/requests", "GET");
}

export function hasPendingJoinRequest(listingId: string): Promise<boolean> {
  return getMyRequests().then((requests) => requests.some((item) => item.listing.id === listingId));
}

export function requestToJoin(listingId: string): Promise<void> {
  return request(`/api/listings/${encodeURIComponent(listingId)}/requests`, "POST");
}
