

// These types mirror backend/models.py. Dates and datetimes arrive as ISO strings.

const Gender = {
    preferNotToSay: "prefer_not_to_say",
    male: "male",
    female: "female",
    nonBinary: "non_binary"
} as const;
type Gender = (typeof Gender)[keyof typeof Gender];
export { Gender };

const Major = {
    ComputerScience: "computer_science"
} as const;
type Major = (typeof Major)[keyof typeof Major];
export { Major };

const Degree = {
    Bachelor: "bachelor",
    Master: "master",
    PHD: "phd"
} as const;
type Degree = (typeof Degree)[keyof typeof Degree];
export { Degree };

const MemberRole = {
  admin: "admin",
  member: "member",
  requestPending: "request_pending"
} as const;
type MemberRole = (typeof MemberRole)[keyof typeof MemberRole];
export { MemberRole };

// A course name from GET /api/courses (backend/courses.py)
export type Course = string;


export interface User {
  id: string;
  firstName: string;
  lastName: string;
  emailAddress: string;
  dateOfBirth: string | null;
  gender: Gender | null;
  major: Major | null;
  degree: Degree | null;
  description: string;
}

export interface Listing {
  id: string;
  createdBy: User | null;
  description: string;
  startTime: string | null;
  endTime: string | null;
  location: string | null;
  courses: Course[];
  isPrivate: boolean;
  memberIds: string[];
}

export interface Message {
  id: string;
  listingId: string;
  author: User | null; // null if the author deleted their account
  sentAt: string;
  content: string;
}

export interface ListingMember {
  user: User;
  listing: Listing;
  role: MemberRole;
  joinedAt: string; // time of the request while the role is request_pending
}

export interface UserForCreate {
  firstName?: string;
  lastName?: string;
  emailAddress?: string;
  dateOfBirth?: string | null;
  gender?: Gender | null;
  major?: Major | null;
  degree?: Degree | null;
  description?: string;
}

// Only the fields that are sent get updated
export interface UserForUpdate {
  firstName?: string | null;
  lastName?: string | null;
  dateOfBirth?: string | null;
  gender?: Gender | null;
  major?: Major | null;
  degree?: Degree | null;
  description?: string | null;
}

export interface ListingForCreate {
  createdBy?: User | null; // set by the backend to the current user
  description?: string;
  startTime?: string | null;
  endTime?: string | null;
  location?: string | null;
  courses?: Course[];
  isPrivate?: boolean;
}

// Only the fields that are sent get updated; send null to unset start/end time or location
export interface ListingForUpdate {
  newDescription?: string | null;
  newStartTime?: string | null;
  newEndTime?: string | null;
  newLocation?: string | null;
  newCourses?: Course[] | null;
  newIsPrivate?: boolean | null;
}

// listing and author are set by the backend; clients only send content
export interface MessageForCreate {
  listing?: Listing | null;
  author?: User | null;
  content: string;
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


export function getMe(): Promise<User> {
  return request(`/api/me`, "GET");
}

export function createListing(listing: ListingForCreate): Promise<Listing> {
  return request<Listing>(`/api/listings`, "POST", listing);
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

// Outlook link that opens a prefilled "new event" form, e.g. window.open(url, "_blank")
export function getOutlookCalendarLink(listingId: string): Promise<string> {
  return request<{ url: string }>(
    `/api/listings/${encodeURIComponent(listingId)}/calendar`,
    "GET",
  ).then((response) => response.url);
}

export function getListingMembers(listingId: string): Promise<ListingMember[]> {
  return request(`/api/listings/${encodeURIComponent(listingId)}/members`, "GET");
}

export function getMessages(listingId: string): Promise<Message[]> {
  return request(`/api/listings/${encodeURIComponent(listingId)}/messages`, "GET");
}

export function sendMessage(listingId: string, message: MessageForCreate): Promise<Message> {
  return request(`/api/listings/${encodeURIComponent(listingId)}/messages`, "POST", message);
}

// Pending requests are ListingMembers with role request_pending
export function getMyRequests(): Promise<ListingMember[]> {
  return request("/api/me/requests", "GET");
}

export function hasPendingJoinRequest(listingId: string): Promise<boolean> {
  return getMyRequests().then((requests) => requests.some((item) => item.listing.id === listingId));
}

export function requestToJoin(listingId: string): Promise<void> {
  return request(`/api/listings/${encodeURIComponent(listingId)}/requests`, "POST");
}
